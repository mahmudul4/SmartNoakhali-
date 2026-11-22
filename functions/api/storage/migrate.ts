import { verifyAuthenticatedActor } from "../../lib/firebase-auth";
import {
  buildCorsHeaders,
  buildPublicFileUrl,
  buildPrivateFileUrl,
  checkStorageRateLimit,
  getBucketBinding,
  inferExtensionFromMime,
  isAllowedOrigin,
  jsonResponse,
  normalizeMimeType,
  sanitizeObjectKey,
  sanitizeSlugSegment,
  sha256Hex,
  verifyMagicBytes,
} from "../../lib/r2-security";
import type { R2BucketType, StorageEnv } from "../../lib/r2-types";

export const onRequestOptions = async (context: { request: Request; env: StorageEnv }) => {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(context.request, context.env),
  });
};

function isAllowedMigrationSource(sourceUrl: string, requestOrigin: string): boolean {
  try {
    const parsed = new URL(sourceUrl, requestOrigin);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;

    // 1. Same-origin category icons or local assets
    if (parsed.origin === requestOrigin && parsed.pathname.startsWith("/icons/categories/")) {
      return !parsed.pathname.includes("..");
    }

    // 2. Firebase Storage URLs belonging to smartnoakhali-f38e9
    if (
      parsed.hostname === "firebasestorage.googleapis.com" &&
      (parsed.pathname.includes("/v0/b/smartnoakhali-f38e9") ||
        parsed.pathname.includes("/v0/b/smartnoakhali"))
    ) {
      return true;
    }

    if (parsed.hostname === "storage.googleapis.com" && parsed.pathname.includes("smartnoakhali")) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export const onRequestPost = async (context: { request: Request; env: StorageEnv }) => {
  const { request, env } = context;

  const origin = request.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin, env)) {
    return jsonResponse({ ok: false, error: "Origin not permitted" }, 403, request, env);
  }

  let actor;
  try {
    actor = await verifyAuthenticatedActor(request, env);
  } catch {
    return jsonResponse({ ok: false, error: "সুপার অ্যাডমিন লগইন প্রয়োজন।" }, 401, request, env);
  }

  if (!actor.isMainAdmin) {
    return jsonResponse(
      { ok: false, error: "শুধুমাত্র মেইন সুপার অ্যাডমিন মাইগ্রেশন পরিচালনা করতে পারবেন।" },
      403,
      request,
      env
    );
  }

  const rate = checkStorageRateLimit(`migrate:${actor.uid}`, 400, 60_000);
  if (!rate.allowed) {
    return jsonResponse({ ok: false, error: "Rate limit exceeded" }, 429, request, env);
  }

  let body: {
    sourceUrl?: string;
    targetKey?: string;
    bucketType?: R2BucketType;
    category?: string;
    overwrite?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400, request, env);
  }

  const sourceUrl = String(body.sourceUrl || "").trim();
  const requestOrigin = new URL(request.url).origin;
  if (!sourceUrl || !isAllowedMigrationSource(sourceUrl, requestOrigin)) {
    return jsonResponse(
      {
        ok: false,
        error: "অনুমোদিত উৎস নয়: শুধুমাত্র Firebase Storage বা বিল্ট-ইন ক্যাটাগরি আইকন মাইগ্রেট করা যাবে।",
      },
      400,
      request,
      env
    );
  }

  const bucketType: R2BucketType = body.bucketType === "private" ? "private" : "public";
  const bucket = getBucketBinding(env, bucketType);
  if (!bucket) {
    return jsonResponse({ ok: false, error: "R2 bucket binding unavailable" }, 503, request, env);
  }

  const resolvedUrl = new URL(sourceUrl, requestOrigin);
  const resolvedSource = resolvedUrl.toString();
  let upstream: Response;
  if (
    env.ASSETS &&
    resolvedUrl.origin === requestOrigin &&
    resolvedUrl.pathname.startsWith("/icons/categories/")
  ) {
    upstream = await env.ASSETS.fetch(new Request(resolvedSource, { method: "GET" }));
  } else {
    upstream = await fetch(resolvedSource, {
      headers: { Accept: "image/*,application/pdf,audio/*,*/*" },
    });
  }
  if (!upstream.ok) {
    return jsonResponse(
      { ok: false, error: `Source fetch failed (HTTP ${upstream.status})`, sourceUrl },
      upstream.status === 404 ? 404 : 502,
      request,
      env
    );
  }

  const arrayBuffer = await upstream.arrayBuffer();
  if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > 15 * 1024 * 1024) {
    return jsonResponse({ ok: false, error: "Invalid migrated file size" }, 400, request, env);
  }

  const rawMime = upstream.headers.get("Content-Type") || "";
  const mimeType = normalizeMimeType(rawMime, resolvedSource);
  const bytes = new Uint8Array(arrayBuffer);
  if (!verifyMagicBytes(bytes, mimeType)) {
    return jsonResponse(
      { ok: false, error: `Unsupported or corrupt file content (${mimeType})` },
      400,
      request,
      env
    );
  }

  const ext = inferExtensionFromMime(mimeType, resolvedSource);
  const defaultKey = `migrated/${sanitizeSlugSegment(body.category || "asset", "asset")}/${Date.now()}_${crypto.randomUUID().slice(0, 6)}.${ext}`;
  const rawTargetKey = body.targetKey ? sanitizeObjectKey(body.targetKey) : defaultKey;
  if (!rawTargetKey) {
    return jsonResponse({ ok: false, error: "Invalid target object key" }, 400, request, env);
  }

  const finalKey =
    bucketType === "private" && !rawTargetKey.startsWith("private/")
      ? `private/${rawTargetKey}`
      : rawTargetKey;

  if (body.overwrite === false) {
    const existing = await bucket.head(finalKey);
    if (existing) {
      const existingUrl =
        bucketType === "public" ? buildPublicFileUrl(finalKey, env) : buildPrivateFileUrl(finalKey);
      return jsonResponse(
        {
          ok: true,
          skippedExisting: true,
          storageProvider: "cloudflare-r2",
          bucketType,
          objectKey: finalKey,
          fileUrl: existingUrl,
          size: existing.size,
          contentType: existing.httpMetadata?.contentType || mimeType,
        },
        200,
        request,
        env
      );
    }
  }

  const checksumSha256 = await sha256Hex(arrayBuffer);
  const uploadedAt = new Date().toISOString();

  await bucket.put(finalKey, arrayBuffer, {
    httpMetadata: {
      contentType: mimeType,
      cacheControl:
        bucketType === "public"
          ? "public, max-age=31536000, immutable"
          : "private, no-store, no-cache, must-revalidate",
    },
    customMetadata: {
      storageProvider: "cloudflare-r2",
      bucketType,
      category: sanitizeSlugSegment(body.category || "migrated", "migrated"),
      migratedFrom: sourceUrl.slice(0, 300),
      uploadedBy: actor.uid,
      uploadedByEmail: actor.email || "",
      checksumSha256,
      uploadedAt,
    },
  });

  // Verify integrity after write
  const verified = await bucket.head(finalKey);
  if (!verified || verified.size !== arrayBuffer.byteLength) {
    return jsonResponse(
      { ok: false, error: "R2 integrity verification failed after upload" },
      500,
      request,
      env
    );
  }

  const fileUrl =
    bucketType === "public" ? buildPublicFileUrl(finalKey, env) : buildPrivateFileUrl(finalKey);

  return jsonResponse(
    {
      ok: true,
      storageProvider: "cloudflare-r2",
      bucketType,
      bucketName: bucketType === "private" ? "smart-noakhali-private" : "smart-noakhali-public",
      objectKey: finalKey,
      fileUrl,
      publicUrl: bucketType === "public" ? fileUrl : null,
      contentType: mimeType,
      size: verified.size,
      checksumSha256,
      uploadedAt,
      sourceUrl,
    },
    201,
    request,
    env
  );
};
