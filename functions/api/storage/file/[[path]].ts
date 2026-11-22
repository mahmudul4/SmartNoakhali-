import {
  verifyAuthenticatedActor,
  verifyChatThreadParticipant,
} from "../../../lib/firebase-auth";
import {
  buildCorsHeaders,
  buildPrivateFileUrl,
  buildPublicFileUrl,
  checkStorageRateLimit,
  getBucketBinding,
  isAllowedOrigin,
  jsonResponse,
  normalizeMimeType,
  sanitizeObjectKey,
  sanitizeSlugSegment,
  sanitizeSvgTextServer,
  sha256Hex,
  verifyMagicBytes,
} from "../../../lib/r2-security";
import {
  CATEGORY_POLICIES,
  resolveStorageCategory,
  type R2BucketType,
  type StorageEnv,
} from "../../../lib/r2-types";

interface RouteContext {
  request: Request;
  env: StorageEnv;
  params: { path?: string | string[] };
}

function parseBucketAndKey(context: RouteContext): {
  bucketType: R2BucketType;
  objectKey: string;
} | null {
  const rawSegments = Array.isArray(context.params?.path)
    ? context.params.path
    : typeof context.params?.path === "string"
      ? context.params.path.split("/")
      : new URL(context.request.url).pathname
          .replace(/^\/api\/storage\/file\/?/, "")
          .split("/");

  const segments = rawSegments.filter(Boolean);
  if (segments.length < 2) return null;

  const first = segments[0].toLowerCase();
  if (first !== "public" && first !== "private") return null;

  const rawKey = segments.slice(1).join("/");
  const sanitizedKey = sanitizeObjectKey(rawKey);
  if (!sanitizedKey) return null;

  const finalKey =
    first === "private" && !sanitizedKey.startsWith("private/")
      ? `private/${sanitizedKey}`
      : sanitizedKey;

  return {
    bucketType: first as R2BucketType,
    objectKey: finalKey,
  };
}

export const onRequestOptions = async (context: RouteContext) => {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(context.request, context.env),
  });
};

async function handleReadOrHead(context: RouteContext, isHead: boolean): Promise<Response> {
  const { request, env } = context;
  const parsed = parseBucketAndKey(context);
  if (!parsed) {
    return jsonResponse({ ok: false, error: "Invalid storage path" }, 400, request, env);
  }

  const bucket = getBucketBinding(env, parsed.bucketType);
  if (!bucket) {
    return jsonResponse({ ok: false, error: "R2 bucket binding unavailable" }, 503, request, env);
  }

  // Private files ALWAYS require Firebase Authentication & Ownership / Staff check
  if (parsed.bucketType === "private") {
    let actor;
    try {
      actor = await verifyAuthenticatedActor(request, env);
    } catch {
      return jsonResponse(
        { ok: false, error: "এই ব্যক্তিগত ফাইল দেখার জন্য লগইন প্রয়োজন।" },
        401,
        request,
        env
      );
    }

    if (actor.isSuspended) {
      return jsonResponse({ ok: false, error: "Account suspended" }, 403, request, env);
    }

    const headObj = await bucket.head(parsed.objectKey);
    if (!headObj) {
      return jsonResponse({ ok: false, error: "File not found" }, 404, request, env);
    }

    const uploadedBy = headObj.customMetadata?.uploadedBy || "";
    const entityId = headObj.customMetadata?.entityId || "";
    const isOwner = uploadedBy === actor.uid || parsed.objectKey.includes(`/${actor.uid}/`);
    let isAllowed = actor.isMainAdmin || actor.isStaff || isOwner;

    if (!isAllowed && parsed.objectKey.startsWith("private/chat/")) {
      const threadSegment = parsed.objectKey.split("/")[2] || entityId;
      isAllowed = await verifyChatThreadParticipant(threadSegment, actor.uid, actor.rawToken, env);
    }

    if (!isAllowed) {
      return jsonResponse(
        { ok: false, error: "এই ব্যক্তিগত ফাইলে আপনার প্রবেশাধিকার নেই।" },
        403,
        request,
        env
      );
    }
  }

  const obj = isHead ? await bucket.head(parsed.objectKey) : await bucket.get(parsed.objectKey);
  if (!obj) {
    return jsonResponse({ ok: false, error: "File not found" }, 404, request, env);
  }

  const contentType = obj.httpMetadata?.contentType || "application/octet-stream";
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Content-Length", String(obj.size));
  if (obj.httpEtag) headers.set("ETag", obj.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set(
    "Cache-Control",
    parsed.bucketType === "public"
      ? obj.httpMetadata?.cacheControl || "public, max-age=31536000, immutable"
      : "private, no-store, no-cache, must-revalidate"
  );
  if (contentType === "image/svg+xml") {
    headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  }
  const cors = buildCorsHeaders(request, env);
  for (const [k, v] of Object.entries(cors)) {
    headers.set(k, v);
  }

  if (isHead || !("body" in obj)) {
    return new Response(null, { status: 200, headers });
  }
  return new Response(obj.body as BodyInit, { status: 200, headers });
}

export const onRequestGet = async (context: RouteContext) => {
  return handleReadOrHead(context, false);
};

export const onRequestHead = async (context: RouteContext) => {
  return handleReadOrHead(context, true);
};

export const onRequestDelete = async (context: RouteContext) => {
  const { request, env } = context;

  const origin = request.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin, env)) {
    return jsonResponse({ ok: false, error: "Origin not permitted" }, 403, request, env);
  }

  const clientIp =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "edge";
  const rate = checkStorageRateLimit(`delete:${clientIp}`, 60, 60_000);
  if (!rate.allowed) {
    return jsonResponse({ ok: false, error: "Rate limit exceeded" }, 429, request, env);
  }

  const parsed = parseBucketAndKey(context);
  if (!parsed) {
    return jsonResponse({ ok: false, error: "Invalid storage path" }, 400, request, env);
  }

  let actor;
  try {
    actor = await verifyAuthenticatedActor(request, env);
  } catch {
    return jsonResponse({ ok: false, error: "অনুমোদিত লগইন প্রয়োজন।" }, 401, request, env);
  }

  if (actor.isSuspended) {
    return jsonResponse({ ok: false, error: "Account suspended" }, 403, request, env);
  }

  const bucket = getBucketBinding(env, parsed.bucketType);
  if (!bucket) {
    return jsonResponse({ ok: false, error: "R2 bucket binding unavailable" }, 503, request, env);
  }

  const existing = await bucket.head(parsed.objectKey);
  if (!existing) {
    return jsonResponse(
      { ok: true, deleted: true, alreadyMissing: true, bucketType: parsed.bucketType, objectKey: parsed.objectKey },
      200,
      request,
      env
    );
  }

  const uploadedBy = existing.customMetadata?.uploadedBy || "";
  const isOwner = uploadedBy === actor.uid || parsed.objectKey.includes(`/${actor.uid}/`);
  if (!actor.isMainAdmin && !actor.isStaff && !isOwner) {
    return jsonResponse(
      { ok: false, error: "এই ফাইলটি ডিলিট করার অনুমতি আপনার নেই।" },
      403,
      request,
      env
    );
  }

  await bucket.delete(parsed.objectKey);
  return jsonResponse(
    {
      ok: true,
      deleted: true,
      bucketType: parsed.bucketType,
      objectKey: parsed.objectKey,
    },
    200,
    request,
    env
  );
};

export const onRequestPut = async (context: RouteContext) => {
  const { request, env } = context;

  const origin = request.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin, env)) {
    return jsonResponse({ ok: false, error: "Origin not permitted" }, 403, request, env);
  }

  const clientIp =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "edge";
  const rate = checkStorageRateLimit(`put:${clientIp}`, 60, 60_000);
  if (!rate.allowed) {
    return jsonResponse({ ok: false, error: "Rate limit exceeded" }, 429, request, env);
  }

  const parsed = parseBucketAndKey(context);
  if (!parsed) {
    return jsonResponse({ ok: false, error: "Invalid storage path" }, 400, request, env);
  }

  let actor;
  try {
    actor = await verifyAuthenticatedActor(request, env);
  } catch {
    return jsonResponse({ ok: false, error: "অনুমোদিত লগইন প্রয়োজন।" }, 401, request, env);
  }

  if (actor.isSuspended) {
    return jsonResponse({ ok: false, error: "Account suspended" }, 403, request, env);
  }

  const bucket = getBucketBinding(env, parsed.bucketType);
  if (!bucket) {
    return jsonResponse({ ok: false, error: "R2 bucket binding unavailable" }, 503, request, env);
  }

  const existing = await bucket.head(parsed.objectKey);
  if (existing) {
    const uploadedBy = existing.customMetadata?.uploadedBy || "";
    const isOwner = uploadedBy === actor.uid || parsed.objectKey.includes(`/${actor.uid}/`);
    if (!actor.isMainAdmin && !actor.isStaff && !isOwner) {
      return jsonResponse(
        { ok: false, error: "এই ফাইলটি আপডেট করার অনুমতি আপনার নেই।" },
        403,
        request,
        env
      );
    }
  } else {
    const isOwnScopedPath = parsed.objectKey.includes(`/${actor.uid}/`);
    if (!actor.isMainAdmin && !actor.isStaff && !isOwnScopedPath) {
      return jsonResponse(
        { ok: false, error: "নতুন অবজেক্ট পাথে সরাসরি আপডেট অনুমোদিত নয়।" },
        403,
        request,
        env
      );
    }
  }

  const contentTypeHeader = request.headers.get("Content-Type") || "";
  let rawBytesBuf: ArrayBuffer;
  let mimeType = "";
  let originalName = parsed.objectKey.split("/").pop() || "file";
  let categoryRaw = existing?.customMetadata?.category || "general";

  if (contentTypeHeader.toLowerCase().includes("multipart/form-data")) {
    let fd: FormData;
    try {
      fd = await request.formData();
    } catch {
      return jsonResponse({ ok: false, error: "অবৈধ ফর্ম ডাটা।" }, 400, request, env);
    }
    const fileEntry = fd.get("file");
    if (!fileEntry || typeof fileEntry === "string") {
      return jsonResponse({ ok: false, error: "আপডেটের জন্য ফাইল সংযুক্ত করুন।" }, 400, request, env);
    }
    const file = fileEntry as File;
    originalName = file.name || originalName;
    if (fd.get("category")) categoryRaw = String(fd.get("category"));
    mimeType = normalizeMimeType(file.type, originalName);
    rawBytesBuf = await file.arrayBuffer();
  } else {
    mimeType = normalizeMimeType(contentTypeHeader, originalName);
    rawBytesBuf = await request.arrayBuffer();
  }

  const category = resolveStorageCategory(categoryRaw);
  const policy = CATEGORY_POLICIES[category];
  if (!policy.allowedBuckets.includes(parsed.bucketType)) {
    return jsonResponse(
      { ok: false, error: `এই ক্যাটাগরির জন্য ${parsed.bucketType} বাকেট অনুমোদিত নয়।` },
      403,
      request,
      env
    );
  }
  if (policy.adminOrStaffOnly && !actor.isMainAdmin && !actor.isStaff) {
    return jsonResponse(
      { ok: false, error: "এই সেকশনের ফাইল আপডেট করার জন্য অ্যাডমিন বা স্টাফ অনুমতি প্রয়োজন।" },
      403,
      request,
      env
    );
  }
  if (rawBytesBuf.byteLength <= 0 || rawBytesBuf.byteLength > policy.maxSizeBytes) {
    return jsonResponse({ ok: false, error: "অবৈধ ফাইল সাইজ।" }, 400, request, env);
  }
  if (!policy.allowedMimes.includes(mimeType)) {
    return jsonResponse({ ok: false, error: `অসমর্থিত ফাইল ফরম্যাট (${mimeType})।` }, 415, request, env);
  }

  const bytes = new Uint8Array(rawBytesBuf);
  if (!verifyMagicBytes(bytes, mimeType)) {
    return jsonResponse({ ok: false, error: "ফাইল সিগনেচার যাচাই ব্যর্থ হয়েছে।" }, 400, request, env);
  }

  if (mimeType === "image/svg+xml") {
    const cleanRes = sanitizeSvgTextServer(new TextDecoder().decode(bytes));
    if (!cleanRes.ok || !cleanRes.sanitized) {
      return jsonResponse({ ok: false, error: cleanRes.error || "SVG নিরাপত্তা যাচাই ব্যর্থ হয়েছে।" }, 400, request, env);
    }
    const encoded = new TextEncoder().encode(cleanRes.sanitized);
    rawBytesBuf = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
  }

  const checksumSha256 = await sha256Hex(rawBytesBuf);
  const updatedAt = new Date().toISOString();
  const safeName = sanitizeSlugSegment(originalName.replace(/\.[^/.]+$/, ""), "file");

  await bucket.put(parsed.objectKey, rawBytesBuf, {
    httpMetadata: {
      contentType: mimeType,
      cacheControl:
        parsed.bucketType === "public"
          ? "public, max-age=31536000, immutable"
          : "private, no-store, no-cache, must-revalidate",
      contentDisposition: mimeType === "application/pdf" ? `inline; filename="${safeName}.pdf"` : "inline",
    },
    customMetadata: {
      ...(existing?.customMetadata || {}),
      storageProvider: "cloudflare-r2",
      bucketType: parsed.bucketType,
      category,
      uploadedBy: existing?.customMetadata?.uploadedBy || actor.uid,
      updatedBy: actor.uid,
      updatedAt,
      checksumSha256,
    },
  });

  const fileUrl =
    parsed.bucketType === "public"
      ? buildPublicFileUrl(parsed.objectKey, env)
      : buildPrivateFileUrl(parsed.objectKey);

  return jsonResponse(
    {
      ok: true,
      updated: true,
      storageProvider: "cloudflare-r2",
      bucketType: parsed.bucketType,
      bucketName: parsed.bucketType === "private" ? "smart-noakhali-private" : "smart-noakhali-public",
      objectKey: parsed.objectKey,
      fileUrl,
      publicUrl: parsed.bucketType === "public" ? fileUrl : null,
      contentType: mimeType,
      size: rawBytesBuf.byteLength,
      checksumSha256,
      updatedAt,
      updatedBy: actor.uid,
      category,
    },
    200,
    request,
    env
  );
};

export const onRequestPatch = async (context: RouteContext) => {
  const { request, env } = context;

  const origin = request.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin, env)) {
    return jsonResponse({ ok: false, error: "Origin not permitted" }, 403, request, env);
  }

  const parsed = parseBucketAndKey(context);
  if (!parsed) {
    return jsonResponse({ ok: false, error: "Invalid storage path" }, 400, request, env);
  }

  let actor;
  try {
    actor = await verifyAuthenticatedActor(request, env);
  } catch {
    return jsonResponse({ ok: false, error: "অনুমোদিত লগইন প্রয়োজন।" }, 401, request, env);
  }

  if (actor.isSuspended) {
    return jsonResponse({ ok: false, error: "Account suspended" }, 403, request, env);
  }

  const bucket = getBucketBinding(env, parsed.bucketType);
  if (!bucket) {
    return jsonResponse({ ok: false, error: "R2 bucket binding unavailable" }, 503, request, env);
  }

  const existing = await bucket.get(parsed.objectKey);
  if (!existing) {
    return jsonResponse({ ok: false, error: "File not found" }, 404, request, env);
  }

  const uploadedBy = existing.customMetadata?.uploadedBy || "";
  const isOwner = uploadedBy === actor.uid || parsed.objectKey.includes(`/${actor.uid}/`);
  if (!actor.isMainAdmin && !actor.isStaff && !isOwner) {
    return jsonResponse({ ok: false, error: "মেটাডাটা আপডেটের অনুমতি নেই।" }, 403, request, env);
  }

  let body: { cacheControl?: string; customMetadata?: Record<string, string> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400, request, env);
  }

  const sanitizedMeta: Record<string, string> = {};
  if (body.customMetadata && typeof body.customMetadata === "object") {
    for (const [k, v] of Object.entries(body.customMetadata)) {
      if (["uploadedBy", "storageProvider", "bucketType", "checksumSha256"].includes(k)) continue;
      if (typeof v === "string") {
        sanitizedMeta[k.slice(0, 48)] = v.slice(0, 200);
      }
    }
  }

  const buf = await existing.arrayBuffer();
  const updatedAt = new Date().toISOString();

  await bucket.put(parsed.objectKey, buf, {
    httpMetadata: {
      ...(existing.httpMetadata || {}),
      cacheControl:
        typeof body.cacheControl === "string" && body.cacheControl.trim()
          ? body.cacheControl.trim().slice(0, 120)
          : existing.httpMetadata?.cacheControl,
    },
    customMetadata: {
      ...(existing.customMetadata || {}),
      ...sanitizedMeta,
      updatedBy: actor.uid,
      updatedAt,
    },
  });

  return jsonResponse(
    {
      ok: true,
      updated: true,
      bucketType: parsed.bucketType,
      objectKey: parsed.objectKey,
      updatedAt,
    },
    200,
    request,
    env
  );
};

