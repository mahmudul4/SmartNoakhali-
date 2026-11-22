/**
 * Cloudflare R2 Security, Validation, Sanitization, CORS & Rate Limiting Helpers
 * Runs natively on Cloudflare Pages Functions (Web Standards only).
 */

import {
  CATEGORY_POLICIES,
  type R2BucketBinding,
  type R2BucketType,
  type StorageCategory,
  type StorageEnv,
} from "./r2-types";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkStorageRateLimit(
  identifier: string,
  maxRequests = 90,
  windowMs = 60_000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  if (!entry || entry.resetAt <= now) {
    const next = { count: 1, resetAt: now + windowMs };
    rateLimitStore.set(identifier, next);
    return { allowed: true, remaining: maxRequests - 1, resetAt: next.resetAt };
  }
  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

export function getAllowedOrigins(env?: StorageEnv): string[] {
  const custom = (env?.R2_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [
    "https://smartnoakhali.com",
    "https://www.smartnoakhali.com",
    ...custom,
  ];
}

export function isAllowedOrigin(origin: string | null, env?: StorageEnv): boolean {
  if (!origin) return true; // same-origin or server-to-server
  const lower = origin.toLowerCase();
  if (
    lower.startsWith("http://localhost:") ||
    lower.startsWith("http://127.0.0.1:") ||
    lower.startsWith("https://localhost:")
  ) {
    return true;
  }
  if (/^https:\/\/([a-z0-9-]+\.)?smartnoakhali\.pages\.dev$/i.test(lower)) {
    return true;
  }
  if (/^https:\/\/([a-z0-9-]+\.)?smartnoakhali(?:\.[a-z0-9-]+)?\.workers\.dev$/i.test(lower)) {
    return true;
  }
  return getAllowedOrigins(env).some((allowed) => allowed.toLowerCase() === lower);
}

export function buildCorsHeaders(request: Request, env?: StorageEnv): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allowed = origin && isAllowedOrigin(origin, env);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Requested-With",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowed && origin) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else {
    headers["Access-Control-Allow-Origin"] = "https://smartnoakhali.com";
  }
  return headers;
}

export function jsonResponse(
  body: unknown,
  status: number,
  request: Request,
  env?: StorageEnv
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...buildCorsHeaders(request, env),
    },
  });
}

export function sanitizeObjectKey(rawKey: string): string | null {
  let key = String(rawKey || "").trim();
  try {
    key = decodeURIComponent(key);
  } catch {
    return null;
  }
  key = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!key || key.length > 512) return null;
  if (key.includes("\0") || key.includes("..")) return null;
  // Disallow control chars or weird double slashes
  if (/[\u0000-\u001f\u007f]/.test(key)) return null;
  const segments = key.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  for (const seg of segments) {
    if (seg === "." || seg === ".." || !/^[a-zA-Z0-9._-]+$/.test(seg)) {
      return null;
    }
  }
  return segments.join("/");
}

export function sanitizeSlugSegment(raw: string | null | undefined, fallback = "general"): string {
  const cleaned = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return cleaned || fallback;
}

export function inferExtensionFromMime(mime: string, originalFilename?: string): string {
  const m = mime.toLowerCase().split(";")[0].trim();
  switch (m) {
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/avif":
      return "avif";
    case "image/svg+xml":
      return "svg";
    case "image/x-icon":
    case "image/vnd.microsoft.icon":
      return "ico";
    case "application/pdf":
      return "pdf";
    case "audio/webm":
    case "video/webm":
      return "webm";
    case "audio/ogg":
      return "ogg";
    case "audio/mpeg":
    case "audio/mp3":
      return "mp3";
    case "audio/mp4":
      return "m4a";
    case "audio/wav":
    case "audio/x-wav":
      return "wav";
    default: {
      const ext = (originalFilename || "").split(".").pop()?.toLowerCase() || "bin";
      return ext.replace(/[^a-z0-9]/g, "") || "bin";
    }
  }
}

export function normalizeMimeType(rawMime: string, filename?: string): string {
  let m = String(rawMime || "").toLowerCase().split(";")[0].trim();
  if (m === "image/jpg") m = "image/jpeg";
  if (m === "audio/mp3") m = "audio/mpeg";
  if (m === "audio/x-wav") m = "audio/wav";
  if (!m || m === "application/octet-stream") {
    const lowerName = (filename || "").toLowerCase();
    if (lowerName.endsWith(".png")) return "image/png";
    if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
    if (lowerName.endsWith(".webp")) return "image/webp";
    if (lowerName.endsWith(".gif")) return "image/gif";
    if (lowerName.endsWith(".avif")) return "image/avif";
    if (lowerName.endsWith(".svg")) return "image/svg+xml";
    if (lowerName.endsWith(".ico")) return "image/x-icon";
    if (lowerName.endsWith(".pdf")) return "application/pdf";
    if (lowerName.endsWith(".webm")) return "audio/webm";
    if (lowerName.endsWith(".ogg")) return "audio/ogg";
    if (lowerName.endsWith(".mp3")) return "audio/mpeg";
    if (lowerName.endsWith(".m4a")) return "audio/mp4";
    if (lowerName.endsWith(".wav")) return "audio/wav";
  }
  return m;
}

/**
 * Validates file content magic bytes so attackers cannot disguise executable/HTML payloads
 * as images or PDFs.
 */
export function verifyMagicBytes(bytes: Uint8Array, mime: string): boolean {
  if (bytes.length < 4) return false;
  const m = normalizeMimeType(mime);

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (m === "image/png") {
    return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  // JPEG: FF D8 FF
  if (m === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  // GIF: GIF87a or GIF89a
  if (m === "image/gif") {
    return bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38;
  }
  // WebP: RIFF....WEBP
  if (m === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }
  // AVIF / MP4 / M4A: ....ftyp
  if (m === "image/avif" || m === "audio/mp4") {
    return bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  }
  // ICO: 00 00 01 00
  if (m === "image/x-icon" || m === "image/vnd.microsoft.icon") {
    return bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00;
  }
  // PDF: %PDF-
  if (m === "application/pdf") {
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  }
  // WebM: 1A 45 DF A3
  if (m === "audio/webm" || m === "video/webm") {
    return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  }
  // OGG: OggS
  if (m === "audio/ogg") {
    return bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;
  }
  // WAV: RIFF....WAVE
  if (m === "audio/wav") {
    return (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x41 &&
      bytes[10] === 0x56 &&
      bytes[11] === 0x45
    );
  }
  // MP3: ID3 or frame sync FF FB / FF F3 / FF F2
  if (m === "audio/mpeg") {
    const isId3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
    const isSync = bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
    return isId3 || isSync;
  }
  // SVG: textual check
  if (m === "image/svg+xml") {
    const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 1024))).trimStart();
    return /^<\?xml/i.test(head) || /<svg[\s>]/i.test(head);
  }
  return false;
}

/**
 * Server-side regex/state sanitizer for SVG uploads to neutralize XSS vectors.
 */
export function sanitizeSvgTextServer(rawSvg: string): { ok: boolean; sanitized?: string; error?: string } {
  const trimmed = String(rawSvg || "").trim();
  if (!trimmed) return { ok: false, error: "SVG file is empty" };
  if (trimmed.length > 512 * 1024) {
    return { ok: false, error: "SVG file exceeds 512KB limit" };
  }
  if (!/<svg[\s>]/i.test(trimmed)) {
    return { ok: false, error: "Missing <svg> root element" };
  }

  let cleaned = trimmed
    .replace(/<\s*(script|foreignObject|iframe|object|embed|base|link|meta)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|foreignObject|iframe|object|embed|base|link|meta)\b[^>]*\/?>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(
      /\s+(?:href|xlink:href|src|action|formaction)\s*=\s*(?:"\s*(?:javascript|vbscript|data:text\/html)[^"]*"|'\s*(?:javascript|vbscript|data:text\/html)[^']*')/gi,
      ""
    )
    .replace(/expression\s*\(|javascript:|vbscript:/gi, "");

  if (!/<svg[\s>]/i.test(cleaned)) {
    return { ok: false, error: "Sanitized SVG is invalid" };
  }
  return { ok: true, sanitized: cleaned };
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function buildR2ObjectKey(params: {
  category: StorageCategory;
  entityId?: string;
  uid: string;
  extension: string;
  deterministicSlug?: string;
}): string {
  const policy = CATEGORY_POLICIES[params.category];
  const rawEntity =
    params.category === "category_icon" && params.deterministicSlug
      ? params.deterministicSlug
      : params.entityId || (params.category === "profile" ? params.uid : "general");
  const safeEntity = sanitizeSlugSegment(rawEntity, "general");
  const rand = crypto.randomUUID().slice(0, 8);
  const uniqueName = `${Date.now()}_${rand}.${params.extension}`;
  return `${policy.prefix}/${safeEntity}/${uniqueName}`;
}

export function getBucketBinding(
  env: StorageEnv,
  bucketType: R2BucketType
): R2BucketBinding | null {
  return bucketType === "private" ? env.R2_PRIVATE || null : env.R2_PUBLIC || null;
}

export function buildPublicFileUrl(objectKey: string, env: StorageEnv): string {
  const cleanKey = objectKey.replace(/^\/+/, "");
  const cdnBase = (env.PUBLIC_R2_CDN_URL || "").trim().replace(/\/+$/, "");
  if (cdnBase && /^https?:\/\//i.test(cdnBase)) {
    return `${cdnBase}/${cleanKey}`;
  }
  return `/api/storage/file/public/${cleanKey}`;
}

export function buildPrivateFileUrl(objectKey: string): string {
  const cleanKey = objectKey.replace(/^\/+/, "");
  return `/api/storage/file/private/${cleanKey}`;
}
