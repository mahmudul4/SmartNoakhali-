/**
 * Smart Noakhali — Centralized Cloudflare R2 Storage Service (Client SDK)
 *
 * All file uploads (images, category icons, banners, logos, branding, media library,
 * profile avatars, blood donor photos, submissions, chat media/voice, complaint
 * attachments, and private documents) route exclusively through Cloudflare R2
 * via Cloudflare Pages Functions (`/api/storage/*`).
 *
 * Firebase Authentication & Firestore remain completely intact.
 * Firebase Storage is never used for new uploads.
 */

import { useEffect, useState } from "react";
import { auth, ensureFirebaseAuthUser } from "@/lib/firebase";
import {
  processAndCompressImage,
  getFileSignature,
  type CompressionOptions,
  type ProcessedImageResult,
} from "@/lib/imageProcessor";

export type R2BucketType = "public" | "private";

export type R2UploadCategory =
  | "category_icon"
  | "category"
  | "banner"
  | "logo"
  | "branding"
  | "service"
  | "notice"
  | "media_library"
  | "profile"
  | "staff_avatar"
  | "submission"
  | "donor"
  | "donor_event"
  | "donation_slip"
  | "expense_receipt"
  | "complaint_attachment"
  | "chat"
  | "chat_public"
  | "chat_private"
  | "admin_private"
  | "general";

export interface R2UploadMetadata {
  success?: boolean;
  ok?: boolean;
  storageProvider: "cloudflare-r2";
  bucketType: R2BucketType;
  bucketName: string;
  objectKey: string;
  fileUrl: string;
  publicUrl: string | null;
  contentType: string;
  fileSize?: number;
  size: number;
  checksumSha256: string;
  uploadedAt: string;
  uploadedBy: string;
  category: string;
}

export interface R2UploadOptions {
  category: R2UploadCategory;
  bucketType?: R2BucketType;
  entityId?: string;
  customKey?: string;
  deterministicSlug?: string;
  compression?: CompressionOptions;
  skipCompression?: boolean;
  onProgress?: (progressPercent: number) => void;
  onStageChange?: (stage: "validating" | "compressing" | "uploading" | "saving") => void;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}

export interface R2ImageUploadResult {
  downloadUrl: string;
  storagePath: string;
  processed: ProcessedImageResult;
  r2: R2UploadMetadata;
}

const inFlightUploads = new Map<string, Promise<R2UploadMetadata & { processed?: ProcessedImageResult }>>();

export function isFirebaseStorageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  return (
    url.includes("firebasestorage.googleapis.com") ||
    url.includes("storage.googleapis.com/smartnoakhali")
  );
}

export function isPrivateR2Url(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  return url.startsWith("/api/storage/file/private/") || url.includes("/api/storage/file/private/");
}

export function isR2Url(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const cdnBase = (import.meta.env.VITE_PUBLIC_R2_CDN_URL || "").trim().replace(/\/+$/, "");
  if (cdnBase && url.startsWith(cdnBase)) return true;
  return (
    url.includes("/api/storage/file/public/") ||
    url.includes("/api/storage/file/private/") ||
    url.includes("cdn.smartnoakhali.com")
  );
}

/**
 * Checks whether a URL is a valid persisted icon URL (never blob:, data:text/html, or oversized base64).
 */
export function isValidPersistedIconUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/^blob:/i.test(trimmed)) return false;
  if (/^javascript:/i.test(trimmed)) return false;
  if (/^data:/i.test(trimmed) && trimmed.length > 2048) return false;
  return true;
}

/**
 * Returns true ONLY if the URL points to a per-category uploaded icon in R2_PUBLIC (`categories/<slug>/<file>`),
 * so replacing/removing an icon safely cleans up the old category-specific object without deleting
 * static `/icons/categories/*.png` assets or shared `media_library/*` items.
 */
export function isOwnedCategoryR2IconUrl(
  url: string | null | undefined,
  _categorySlug?: string
): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("/icons/categories/")) return false;
  const parsed = parseR2Url(trimmed);
  if (!parsed || parsed.bucketType !== "public") return false;
  return /^categories\/[^/]+\/[^/]+$/.test(parsed.objectKey);
}

export function parseR2Url(
  url: string | null | undefined
): { bucketType: R2BucketType; objectKey: string } | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  const publicMarker = "/api/storage/file/public/";
  const privateMarker = "/api/storage/file/private/";

  const pubIdx = trimmed.indexOf(publicMarker);
  if (pubIdx >= 0) {
    return {
      bucketType: "public",
      objectKey: trimmed.slice(pubIdx + publicMarker.length).split("?")[0],
    };
  }
  const privIdx = trimmed.indexOf(privateMarker);
  if (privIdx >= 0) {
    const key = trimmed.slice(privIdx + privateMarker.length).split("?")[0];
    return {
      bucketType: "private",
      objectKey: key.startsWith("private/") ? key : `private/${key}`,
    };
  }

  const cdnBase = (import.meta.env.VITE_PUBLIC_R2_CDN_URL || "https://cdn.smartnoakhali.com")
    .trim()
    .replace(/\/+$/, "");
  if (cdnBase && trimmed.startsWith(`${cdnBase}/`)) {
    return {
      bucketType: "public",
      objectKey: trimmed.slice(cdnBase.length + 1).split("?")[0],
    };
  }
  return null;
}

async function getFirebaseIdTokenOrThrow(): Promise<string> {
  let user = auth.currentUser;
  if (!user) {
    user = await ensureFirebaseAuthUser();
  }
  if (!user) {
    throw new Error("ফাইল আপলোড বা অ্যাক্সেসের জন্য লগইন সেশন প্রয়োজন।");
  }
  return user.getIdToken();
}

function mapServerCategory(cat: R2UploadCategory): string {
  if (cat === "category") return "category_icon";
  if (cat === "chat") return "chat_private";
  return cat;
}

function uploadViaXhr(params: {
  formData: FormData;
  idToken: string;
  timeoutMs: number;
  abortSignal?: AbortSignal;
  onProgress?: (pct: number) => void;
}): Promise<R2UploadMetadata> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/storage/upload", true);
    xhr.timeout = params.timeoutMs;
    xhr.setRequestHeader("Authorization", `Bearer ${params.idToken}`);

    let settled = false;
    const onAbort = () => {
      if (!settled) {
        settled = true;
        xhr.abort();
        reject(new Error("আপলোড বাতিল করা হয়েছে।"));
      }
    };

    if (params.abortSignal) {
      if (params.abortSignal.aborted) {
        return reject(new Error("আপলোড বাতিল করা হয়েছে।"));
      }
      params.abortSignal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        const pct = 25 + Math.round((ev.loaded / ev.total) * 68);
        params.onProgress?.(Math.min(93, Math.max(25, pct)));
      }
    };

    xhr.onload = () => {
      if (settled) return;
      settled = true;
      params.abortSignal?.removeEventListener("abort", onAbort);
      try {
        const parsed = JSON.parse(xhr.responseText || "{}") as R2UploadMetadata & {
          ok?: boolean;
          success?: boolean;
          error?: string;
        };
        const resolvedUrl = parsed.fileUrl || parsed.publicUrl || "";
        if (
          xhr.status >= 200 &&
          xhr.status < 300 &&
          (parsed.ok || parsed.success) &&
          parsed.objectKey &&
          resolvedUrl &&
          !resolvedUrl.startsWith("blob:")
        ) {
          params.onProgress?.(100);
          resolve({
            ...parsed,
            fileUrl: resolvedUrl,
            size: parsed.fileSize ?? parsed.size ?? 0,
          });
          return;
        }
        reject(
          new Error(
            parsed.error || `R2 আপলোড ব্যর্থ হয়েছে (HTTP ${xhr.status})। অনুগ্রহ করে পুনরায় চেষ্টা করুন।`
          )
        );
      } catch {
        reject(new Error(`সার্ভার থেকে সঠিক উত্তর পাওয়া যায়নি (HTTP ${xhr.status})।`));
      }
    };

    xhr.onerror = () => {
      if (settled) return;
      settled = true;
      params.abortSignal?.removeEventListener("abort", onAbort);
      reject(new Error("নেটওয়ার্ক সমস্যার কারণে Cloudflare R2-তে আপলোড সম্পন্ন হয়নি।"));
    };

    xhr.ontimeout = () => {
      if (settled) return;
      settled = true;
      params.abortSignal?.removeEventListener("abort", onAbort);
      reject(new Error("আপলোড সময়সীমা শেষ হয়েছে। ইন্টারনেট সংযোগ যাচাই করে পুনরায় চেষ্টা করুন।"));
    };

    xhr.send(params.formData);
  });
}

/**
 * Uploads any permitted file (image, icon, SVG, PDF, voice/audio) directly to Cloudflare R2
 * via `/api/storage/upload` with Firebase Authentication.
 */
export async function uploadFileToR2(
  file: File,
  options: R2UploadOptions
): Promise<R2UploadMetadata & { processed?: ProcessedImageResult }> {
  if (options.abortSignal?.aborted) {
    throw new Error("আপলোড বাতিল করা হয়েছে।");
  }

  const dedupKey = `${options.category}::${options.entityId || "default"}::${options.deterministicSlug || ""}::${getFileSignature(file)}`;
  const existing = inFlightUploads.get(dedupKey);
  if (existing && !options.abortSignal) {
    return existing;
  }

  const work = (async () => {
    options.onStageChange?.("validating");
    options.onProgress?.(8);

    const idToken = await getFirebaseIdTokenOrThrow();
    if (options.abortSignal?.aborted) {
      throw new Error("আপলোড বাতিল করা হয়েছে।");
    }

    let fileToUpload: File = file;
    let processed: ProcessedImageResult | undefined;

    const isRasterOrSvgImage =
      file.type.startsWith("image/") &&
      file.type !== "image/x-icon" &&
      file.type !== "image/vnd.microsoft.icon" &&
      !file.name.toLowerCase().endsWith(".ico");

    if (isRasterOrSvgImage && !options.skipCompression) {
      options.onStageChange?.("compressing");
      options.onProgress?.(16);

      const preset =
        options.compression?.preset ||
        (options.category === "profile" || options.category === "staff_avatar"
          ? "avatar"
          : options.category === "category" || options.category === "category_icon"
            ? "icon"
            : options.category === "logo" || options.category === "branding"
              ? "logo"
              : options.category === "banner"
                ? "banner"
                : options.category === "chat" || options.category === "chat_public" || options.category === "chat_private"
                  ? "chat"
                  : "content");

      processed = await processAndCompressImage(file, {
        preset,
        ...options.compression,
      });
      fileToUpload = processed.file;
      try {
        URL.revokeObjectURL(processed.previewUrl);
      } catch {
        // ignore
      }
    }

    if (options.abortSignal?.aborted) {
      throw new Error("আপলোড বাতিল করা হয়েছে।");
    }

    options.onStageChange?.("uploading");
    options.onProgress?.(25);

    const formData = new FormData();
    formData.append("file", fileToUpload, fileToUpload.name || file.name);
    formData.append("category", mapServerCategory(options.category));
    if (options.bucketType) {
      formData.append("bucketType", options.bucketType);
    }
    if (options.entityId) {
      formData.append("entityId", options.entityId);
    }
    if (options.customKey) {
      formData.append("customKey", options.customKey);
    }
    if (options.deterministicSlug) {
      formData.append("deterministicSlug", options.deterministicSlug);
    }

    const r2Result = await uploadViaXhr({
      formData,
      idToken,
      timeoutMs: options.timeoutMs ?? 45000,
      abortSignal: options.abortSignal,
      onProgress: options.onProgress,
    });

    options.onStageChange?.("saving");
    options.onProgress?.(100);

    return {
      ...r2Result,
      processed,
    };
  })().finally(() => {
    if (inFlightUploads.get(dedupKey) === work) {
      inFlightUploads.delete(dedupKey);
    }
  });

  if (!options.abortSignal) {
    inFlightUploads.set(dedupKey, work);
  }
  return work;
}

/**
 * Image-centric wrapper preserving the exact legacy upload result structure while using Cloudflare R2.
 */
export async function uploadImageToR2(
  file: File,
  options: R2UploadOptions
): Promise<R2ImageUploadResult> {
  const res = await uploadFileToR2(file, options);
  const fallbackProcessed: ProcessedImageResult = res.processed || {
    file,
    blob: file,
    previewUrl: "",
    originalSizeBytes: file.size,
    compressedSizeBytes: res.size || file.size,
    compressionRatio: 0,
    width: 0,
    height: 0,
    format: file.type.includes("svg")
      ? "svg"
      : file.type.includes("png")
        ? "png"
        : file.type.includes("jpeg") || file.type.includes("jpg")
          ? "jpeg"
          : "webp",
  };

  return {
    downloadUrl: res.fileUrl,
    storagePath: res.objectKey,
    processed: fallbackProcessed,
    r2: res,
  };
}

/**
 * Replaces / updates an existing file in Cloudflare R2 at its exact bucketType + objectKey
 * via authenticated `PUT /api/storage/file/(public|private)/<objectKey>`.
 */
export async function updateR2File(
  urlOrKey: string,
  file: File,
  options?: {
    bucketType?: R2BucketType;
    category?: R2UploadCategory;
  }
): Promise<R2UploadMetadata> {
  const parsed = parseR2Url(urlOrKey);
  const bucketType = parsed?.bucketType || options?.bucketType;
  const objectKey = parsed?.objectKey || (options?.bucketType ? urlOrKey.replace(/^\/+/, "") : null);

  if (!bucketType || !objectKey) {
    throw new Error("সঠিক R2 ফাইল পাথ পাওয়া যায়নি।");
  }

  const idToken = await getFirebaseIdTokenOrThrow();
  const cleanKey =
    bucketType === "private" && objectKey.startsWith("private/")
      ? objectKey.slice("private/".length)
      : objectKey;

  const formData = new FormData();
  formData.append("file", file, file.name);
  if (options?.category) {
    formData.append("category", mapServerCategory(options.category));
  }

  const res = await fetch(`/api/storage/file/${bucketType}/${cleanKey}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    body: formData,
  });

  const data = (await res.json().catch(() => ({}))) as R2UploadMetadata & { error?: string; ok?: boolean };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `ফাইল আপডেট ব্যর্থ হয়েছে (HTTP ${res.status})`);
  }
  return data;
}

/**
 * Deletes a file from Cloudflare R2 given its fileUrl or objectKey.
 * Safely skips data:/blob: or legacy Firebase URLs without throwing.
 */
export async function deleteR2FileByUrl(
  urlOrKey: string | null | undefined,
  explicitBucketType?: R2BucketType
): Promise<boolean> {
  if (!urlOrKey || typeof urlOrKey !== "string") return false;
  const trimmed = urlOrKey.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return false;
  if (isFirebaseStorageUrl(trimmed)) return false;

  const parsed = parseR2Url(trimmed);
  const bucketType = parsed?.bucketType || explicitBucketType;
  const objectKey = parsed?.objectKey || (explicitBucketType ? trimmed.replace(/^\/+/, "") : null);

  if (!bucketType || !objectKey) return false;

  try {
    const idToken = await getFirebaseIdTokenOrThrow();
    const cleanKey =
      bucketType === "private" && objectKey.startsWith("private/")
        ? objectKey.slice("private/".length)
        : objectKey;
    const res = await fetch(`/api/storage/file/${bucketType}/${cleanKey}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    return res.ok;
  } catch (err) {
    console.warn("[R2 Delete Warning]", err);
    return false;
  }
}

/**
 * Fetches a private R2 file using the current user's Firebase ID token and returns a local Blob URL.
 * Public / non-private URLs are returned immediately as-is.
 */
const privateBlobCache = new Map<string, string>();

export async function resolveProtectedR2Url(url: string): Promise<string> {
  if (!url || !isPrivateR2Url(url)) return url;
  const cached = privateBlobCache.get(url);
  if (cached) return cached;

  const idToken = await getFirebaseIdTokenOrThrow();
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`ফাইল অ্যাক্সেস করা যায়নি (HTTP ${res.status})`);
  }
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  privateBlobCache.set(url, objUrl);
  return objUrl;
}

export function useResolvedR2Url(url: string | null | undefined): {
  resolvedUrl: string | null;
  loading: boolean;
  error: string | null;
} {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(() => {
    if (!url) return null;
    if (!isPrivateR2Url(url)) return url;
    return privateBlobCache.get(url) || null;
  });
  const [loading, setLoading] = useState<boolean>(Boolean(url && isPrivateR2Url(url) && !privateBlobCache.get(url)));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!url) {
      setResolvedUrl(null);
      setLoading(false);
      setError(null);
      return;
    }
    if (!isPrivateR2Url(url)) {
      setResolvedUrl(url);
      setLoading(false);
      setError(null);
      return;
    }

    const cached = privateBlobCache.get(url);
    if (cached) {
      setResolvedUrl(cached);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    resolveProtectedR2Url(url)
      .then((objUrl) => {
        if (active) {
          setResolvedUrl(objUrl);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "ফাইল লোড ব্যর্থ হয়েছে");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [url]);

  return { resolvedUrl, loading, error };
}

export interface R2HealthReport {
  ok: boolean;
  provider: string;
  bindings?: {
    R2_PUBLIC: "configured" | "not_configured" | "unreachable";
    R2_PRIVATE: "configured" | "not_configured" | "unreachable";
  };
  publicReady?: boolean;
  privateReady?: boolean;
  cdnConfigured?: boolean;
  timestamp?: string;
  error?: string;
}

export async function checkR2StorageHealth(): Promise<R2HealthReport> {
  const res = await fetch("/api/storage/health");
  const data = (await res.json().catch(() => ({}))) as R2HealthReport;
  return {
    ...data,
    ok: Boolean(res.ok && data.ok),
  };
}

export async function migrateSourceUrlToR2(params: {
  sourceUrl: string;
  targetKey?: string;
  bucketType?: R2BucketType;
  category?: string;
  overwrite?: boolean;
}): Promise<R2UploadMetadata & { skippedExisting?: boolean; sourceUrl?: string }> {
  const idToken = await getFirebaseIdTokenOrThrow();
  const res = await fetch("/api/storage/migrate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as R2UploadMetadata & {
    ok?: boolean;
    error?: string;
    skippedExisting?: boolean;
    sourceUrl?: string;
  };
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `মাইগ্রেশন ব্যর্থ হয়েছে (HTTP ${res.status})`);
  }
  return data;
}
