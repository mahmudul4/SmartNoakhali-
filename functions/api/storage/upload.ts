import { verifyAuthenticatedActor } from "../../lib/firebase-auth";
import {
  buildCorsHeaders,
  buildPrivateFileUrl,
  buildPublicFileUrl,
  buildR2ObjectKey,
  checkStorageRateLimit,
  getBucketBinding,
  inferExtensionFromMime,
  isAllowedOrigin,
  jsonResponse,
  normalizeMimeType,
  sanitizeObjectKey,
  sanitizeSlugSegment,
  sanitizeSvgTextServer,
  sha256Hex,
  verifyMagicBytes,
} from "../../lib/r2-security";
import {
  CATEGORY_POLICIES,
  resolveStorageCategory,
  type R2BucketType,
  type StorageEnv,
} from "../../lib/r2-types";

export const onRequestOptions = async (context: { request: Request; env: StorageEnv }) => {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(context.request, context.env),
  });
};

export const onRequestPost = async (context: { request: Request; env: StorageEnv }) => {
  const { request, env } = context;

  const origin = request.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin, env)) {
    return jsonResponse({ ok: false, error: "Origin not permitted" }, 403, request, env);
  }

  const clientIp =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "edge";

  const ipRate = checkStorageRateLimit(`upload:ip:${clientIp}`, 80, 60_000);
  if (!ipRate.allowed) {
    return jsonResponse(
      { ok: false, error: "অল্প সময়ে অনেক বেশি ফাইল আপলোড করা হয়েছে। ১ মিনিট পর চেষ্টা করুন।" },
      429,
      request,
      env
    );
  }

  // 1. Verify Firebase ID token & resolve authoritative roles from Firestore
  let actor;
  try {
    actor = await verifyAuthenticatedActor(request, env);
  } catch (authErr) {
    const msg = authErr instanceof Error ? authErr.message : "Unauthorized";
    return jsonResponse(
      {
        ok: false,
        error:
          msg === "AUTH_REQUIRED"
            ? "ফাইল আপলোড করতে লগইন সেশন প্রয়োজন।"
            : "অবৈধ বা মেয়াদোত্তীর্ণ সেশন। পুনরায় লগইন করুন।",
      },
      401,
      request,
      env
    );
  }

  if (actor.isSuspended) {
    return jsonResponse(
      { ok: false, error: "আপনার অ্যাকাউন্ট স্থগিত থাকায় ফাইল আপলোড অনুমোদিত নয়।" },
      403,
      request,
      env
    );
  }

  const uidRate = checkStorageRateLimit(`upload:uid:${actor.uid}`, 60, 60_000);
  if (!uidRate.allowed) {
    return jsonResponse(
      { ok: false, error: "আপলোড সীমা অতিক্রম করেছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" },
      429,
      request,
      env
    );
  }

  // 2. Parse multipart/form-data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse(
      { ok: false, error: "অবৈধ ফর্ম ডাটা। multipart/form-data ব্যবহার করুন।" },
      400,
      request,
      env
    );
  }

  const fileEntry = formData.get("file");
  if (!fileEntry || typeof fileEntry === "string") {
    return jsonResponse({ ok: false, error: "কোনো ফাইল সংযুক্ত করা হয়নি।" }, 400, request, env);
  }
  const file = fileEntry as File;

  const category = resolveStorageCategory(String(formData.get("category") || "general"));
  const policy = CATEGORY_POLICIES[category];
  const requestedBucketRaw = String(formData.get("bucketType") || "").trim().toLowerCase();
  const bucketType: R2BucketType =
    requestedBucketRaw === "private" || requestedBucketRaw === "public"
      ? requestedBucketRaw
      : policy.defaultBucket;

  // 3. Enforce category permissions & bucket policy
  if (!policy.allowedBuckets.includes(bucketType)) {
    return jsonResponse(
      { ok: false, error: `এই ক্যাটাগরির জন্য ${bucketType} বাকেট অনুমোদিত নয়।` },
      403,
      request,
      env
    );
  }

  if (actor.isAnonymous && !policy.allowAnonymousFirebaseAuth) {
    return jsonResponse(
      { ok: false, error: "এই ফাইল আপলোডের জন্য অনুমোদিত অ্যাকাউন্টে লগইন করতে হবে।" },
      403,
      request,
      env
    );
  }

  if (policy.adminOrStaffOnly && !actor.isMainAdmin && !actor.isStaff) {
    return jsonResponse(
      { ok: false, error: "এই সেকশনে ফাইল আপলোডের জন্য অ্যাডমিন বা স্টাফ অনুমতি প্রয়োজন।" },
      403,
      request,
      env
    );
  }

  // Profile images can only be uploaded under caller's own UID unless admin/staff
  const rawEntityId = String(formData.get("entityId") || "").trim();
  if (category === "profile" && rawEntityId && rawEntityId !== actor.uid && !actor.isMainAdmin && !actor.isStaff) {
    return jsonResponse(
      { ok: false, error: "অন্য ব্যবহারকারীর প্রোফাইল ছবি পরিবর্তন করার অনুমতি নেই।" },
      403,
      request,
      env
    );
  }

  // 4. Resolve R2 Bucket Binding
  const bucket = getBucketBinding(env, bucketType);
  if (!bucket) {
    return jsonResponse(
      {
        ok: false,
        error: `Cloudflare R2 বাকেট (${bucketType === "private" ? "R2_PRIVATE" : "R2_PUBLIC"}) বাইন্ডিং কনফিগার করা নেই।`,
      },
      503,
      request,
      env
    );
  }

  // 5. Validate Size, MIME, Magic Bytes & SVG XSS
  if (file.size <= 0) {
    return jsonResponse({ ok: false, error: "ফাইলটি খালি (০ বাইট)।" }, 400, request, env);
  }
  if (file.size > policy.maxSizeBytes) {
    const maxMb = Math.round(policy.maxSizeBytes / (1024 * 1024));
    return jsonResponse(
      { ok: false, error: `ফাইলের আকার সর্বোচ্চ ${maxMb} MB হতে পারবে।` },
      413,
      request,
      env
    );
  }

  const mimeType = normalizeMimeType(file.type, file.name);
  if (!policy.allowedMimes.includes(mimeType)) {
    return jsonResponse(
      { ok: false, error: `অসমর্থিত ফাইল ফরম্যাট (${mimeType || "unknown"})।` },
      415,
      request,
      env
    );
  }

  let arrayBuffer = await file.arrayBuffer();
  let bytes = new Uint8Array(arrayBuffer);

  if (!verifyMagicBytes(bytes, mimeType)) {
    return jsonResponse(
      { ok: false, error: "ফাইলের অভ্যন্তরীণ সিগনেচার ও ফরম্যাট মিলছে না (সন্দেহজনক ফাইল)।" },
      400,
      request,
      env
    );
  }

  if (mimeType === "image/svg+xml") {
    const rawText = new TextDecoder().decode(bytes);
    const cleanRes = sanitizeSvgTextServer(rawText);
    if (!cleanRes.ok || !cleanRes.sanitized) {
      return jsonResponse(
        { ok: false, error: cleanRes.error || "SVG নিরাপত্তা যাচাই ব্যর্থ হয়েছে।" },
        400,
        request,
        env
      );
    }
    const encoded = new TextEncoder().encode(cleanRes.sanitized);
    bytes = encoded;
    arrayBuffer = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
  }

  // 6. Build Safe Object Key
  const customKeyRaw = String(formData.get("customKey") || "").trim();
  const deterministicSlug = String(formData.get("deterministicSlug") || "").trim();
  const ext = inferExtensionFromMime(mimeType, file.name);

  let objectKey: string;
  if (customKeyRaw && (actor.isMainAdmin || actor.isStaff)) {
    const sanitized = sanitizeObjectKey(customKeyRaw);
    if (!sanitized) {
      return jsonResponse({ ok: false, error: "অবৈধ অবজেক্ট পাথ।" }, 400, request, env);
    }
    objectKey = sanitized;
  } else {
    objectKey = buildR2ObjectKey({
      category,
      entityId: rawEntityId || (category === "profile" ? actor.uid : undefined),
      uid: actor.uid,
      extension: ext,
      deterministicSlug: category === "category_icon" ? deterministicSlug : undefined,
    });
  }

  // Enforce private prefix isolation on private bucket
  if (bucketType === "private" && !objectKey.startsWith("private/")) {
    objectKey = `private/${objectKey}`;
  }

  const checksumSha256 = await sha256Hex(arrayBuffer);
  const uploadedAt = new Date().toISOString();
  const safeOriginalName = sanitizeSlugSegment(file.name.replace(/\.[^/.]+$/, ""), "file") + `.${ext}`;

  await bucket.put(objectKey, arrayBuffer, {
    httpMetadata: {
      contentType: mimeType,
      cacheControl:
        bucketType === "public"
          ? "public, max-age=31536000, immutable"
          : "private, no-store, no-cache, must-revalidate",
      contentDisposition: mimeType === "application/pdf" ? `inline; filename="${safeOriginalName}"` : "inline",
    },
    customMetadata: {
      storageProvider: "cloudflare-r2",
      bucketType,
      category,
      entityId: sanitizeSlugSegment(rawEntityId || actor.uid, "general"),
      uploadedBy: actor.uid,
      uploadedByEmail: actor.email || "",
      originalName: String(file.name || safeOriginalName).slice(0, 120),
      checksumSha256,
      uploadedAt,
    },
  });

  const fileUrl =
    bucketType === "public"
      ? buildPublicFileUrl(objectKey, env)
      : buildPrivateFileUrl(objectKey);

  return jsonResponse(
    {
      ok: true,
      storageProvider: "cloudflare-r2",
      bucketType,
      bucketName: bucketType === "private" ? "smart-noakhali-private" : "smart-noakhali-public",
      objectKey,
      fileUrl,
      publicUrl: bucketType === "public" ? fileUrl : null,
      contentType: mimeType,
      size: arrayBuffer.byteLength,
      checksumSha256,
      uploadedAt,
      uploadedBy: actor.uid,
      category,
    },
    201,
    request,
    env
  );
};
