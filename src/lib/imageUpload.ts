import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadMetadata,
} from "firebase/storage";
import { storage, auth, ensureFirebaseAuthUser } from "@/lib/firebase";
import { processAndCompressImage, type CompressionOptions, type ProcessedImageResult } from "./imageProcessor";

export type ImageUploadCategory =
  | "profile"
  | "staff_avatar"
  | "submission"
  | "donor"
  | "donor_event"
  | "category"
  | "banner"
  | "logo"
  | "chat"
  | "general";

export interface ImageUploadOptions {
  category: ImageUploadCategory;
  entityId?: string; // e.g. uid, categorySlug, submissionId, donorId, threadId
  compression?: CompressionOptions;
  onProgress?: (progressPercent: number) => void;
  onStageChange?: (stage: "validating" | "compressing" | "uploading" | "saving") => void;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  customPath?: string;
  allowClientFallback?: boolean;
}

export interface ImageUploadResult {
  downloadUrl: string;
  storagePath: string;
  processed: ProcessedImageResult;
}

let cachedBucketStatus: "unknown" | "available" | "unavailable" = "unknown";
let bucketProbeInFlight: Promise<boolean> | null = null;

/**
 * Probes once per session whether the configured Firebase Storage bucket actually exists.
 * Prevents 10-second SDK retry stalls when the bucket has not been provisioned (HTTP 404).
 */
export async function probeStorageBucketAvailable(): Promise<boolean> {
  if (cachedBucketStatus === "available") return true;
  if (cachedBucketStatus === "unavailable") return false;
  if (bucketProbeInFlight) return bucketProbeInFlight;

  const bucket = (storage.app.options.storageBucket || "").trim();
  if (!bucket) {
    cachedBucketStatus = "unavailable";
    return false;
  }

  bucketProbeInFlight = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    try {
      const res = await fetch(
        `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o?maxResults=1`,
        { method: "GET", signal: controller.signal }
      );
      if (res.status === 404) {
        cachedBucketStatus = "unavailable";
        return false;
      }
      cachedBucketStatus = "available";
      return true;
    } catch {
      // Transient network error/timeout: don't permanently mark unavailable
      return true;
    } finally {
      clearTimeout(timer);
      bucketProbeInFlight = null;
    }
  })();

  return bucketProbeInFlight;
}

/**
 * Generates an organized, standardized Firebase Storage path
 */
export function buildStoragePath(category: ImageUploadCategory, entityId?: string, fileName?: string): string {
  const timestamp = Date.now();
  const safeEntity = (entityId || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const ext = fileName && fileName.includes(".") ? fileName.split(".").pop() : "webp";
  const uniqueName = `${timestamp}_${randomSuffix}.${ext}`;

  switch (category) {
    case "profile":
      return `users/${safeEntity}/avatar/${uniqueName}`;
    case "staff_avatar":
      return `staff_avatars/${safeEntity}/${uniqueName}`;
    case "submission":
      return `submissions/${safeEntity}/${uniqueName}`;
    case "donor":
      return `donors/${safeEntity}/${uniqueName}`;
    case "donor_event":
      return `donor-events/${safeEntity}/${uniqueName}`;
    case "category":
      return `categories/${safeEntity}/${uniqueName}`;
    case "logo":
      return `settings/logo/${uniqueName}`;
    case "banner":
      return `banners/${safeEntity}/${uniqueName}`;
    case "chat":
      return `chat/${safeEntity}/${uniqueName}`;
    default:
      return `uploads/${safeEntity}/${uniqueName}`;
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("ছবি এনকোড করা সম্ভব হয়নি।"));
    reader.readAsDataURL(blob);
  });
}

function mapUploadErrorMessage(err: any): string {
  const code = String(err?.code || "");
  if (err?.message === "আপলোড বাতিল করা হয়েছে।") return err.message;
  if (err?.message === "STORAGE_TIMEOUT") {
    return "আপলোড সময়সীমা শেষ হয়েছে। ইন্টারনেট সংযোগ যাচাই করে পুনরায় চেষ্টা করুন।";
  }
  if (code === "storage/unauthorized" || code === "storage/unauthenticated") {
    return "ছবি আপলোডের অনুমতি নেই। সুপার অ্যাডমিন হিসেবে লগইন যাচাই করুন।";
  }
  if (code === "storage/quota-exceeded") {
    return "Firebase Storage কোটা পূর্ণ হয়েছে।";
  }
  if (code === "storage/retry-limit-exceeded" || code === "storage/canceled") {
    return "নেটওয়ার্ক সমস্যার কারণে ছবি আপলোড সম্পন্ন হয়নি। পুনরায় চেষ্টা করুন।";
  }
  return err?.message || "ছবি আপলোড ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।";
}

/**
 * Compress an image and upload directly to Firebase Storage with live resumable progress,
 * or fast firestore_asset encoding if the project's Storage bucket is not yet provisioned.
 */
export async function uploadImageToFirebaseStorage(
  file: File,
  options: ImageUploadOptions
): Promise<ImageUploadResult> {
  const timeoutMs = options.timeoutMs ?? 20000;
  const allowFallback = options.allowClientFallback !== false;

  if (options.abortSignal?.aborted) {
    throw new Error("আপলোড বাতিল করা হয়েছে।");
  }

  // 1. Validating & auth session
  options.onStageChange?.("validating");
  options.onProgress?.(8);
  const fbUser = await ensureFirebaseAuthUser();

  if (options.abortSignal?.aborted) {
    throw new Error("আপলোড বাতিল করা হয়েছে।");
  }

  // 2. Compress & optimize image + probe bucket availability concurrently
  options.onStageChange?.("compressing");
  options.onProgress?.(16);

  const compressionPreset =
    options.compression?.preset ||
    (options.category === "profile" || options.category === "staff_avatar"
      ? "avatar"
      : options.category === "logo"
      ? "logo"
      : options.category === "banner"
      ? "banner"
      : options.category === "chat"
      ? "chat"
      : "content");

  const [processed, bucketAvailable] = await Promise.all([
    processAndCompressImage(file, {
      preset: compressionPreset,
      ...options.compression,
    }),
    probeStorageBucketAvailable(),
  ]);

  if (options.abortSignal?.aborted) {
    throw new Error("আপলোড বাতিল করা হয়েছে।");
  }

  // Fast exit when Firebase Storage bucket returns 404 (not yet provisioned in console)
  if (!bucketAvailable) {
    options.onStageChange?.("saving");
    options.onProgress?.(85);
    const dataUrl = await blobToDataUrl(processed.blob);
    options.onProgress?.(100);
    return {
      downloadUrl: dataUrl,
      storagePath: "firestore_asset",
      processed,
    };
  }

  // 3. Build target Firebase Storage reference
  options.onStageChange?.("uploading");
  options.onProgress?.(25);
  const resolvedEntityId =
    options.entityId ||
    (options.category === "profile" || options.category === "staff_avatar"
      ? fbUser?.uid || auth.currentUser?.uid || "anonymous"
      : "general");

  const storagePath =
    options.customPath || buildStoragePath(options.category, resolvedEntityId, processed.file.name);
  const storageRef = ref(storage, storagePath);

  const metadata: UploadMetadata = {
    contentType: processed.file.type,
    cacheControl: "public, max-age=31536000, immutable",
    customMetadata: {
      uploadedBy: auth.currentUser?.uid || "anonymous",
      originalName: file.name,
      category: options.category,
      width: String(processed.width),
      height: String(processed.height),
      format: processed.format,
      originalSize: file.size.toString(),
      compressedSize: processed.compressedSizeBytes.toString(),
      uploadedAt: new Date().toISOString(),
    },
  };

  // 4. Resumable upload with real byte-level progress + cancellation + timeout
  const attemptFirebaseUpload = (): Promise<ImageUploadResult> =>
    new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, processed.blob, metadata);
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            task.cancel();
          } catch {
            // ignore
          }
          reject(new Error("STORAGE_TIMEOUT"));
        }
      }, timeoutMs);

      const onAbort = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          try {
            task.cancel();
          } catch {
            // ignore
          }
          reject(new Error("আপলোড বাতিল করা হয়েছে।"));
        }
      };

      if (options.abortSignal) {
        options.abortSignal.addEventListener("abort", onAbort, { once: true });
      }

      task.on(
        "state_changed",
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            const pct = 25 + Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 68);
            options.onProgress?.(Math.min(93, Math.max(25, pct)));
          }
        },
        (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          options.abortSignal?.removeEventListener("abort", onAbort);
          reject(err);
        },
        async () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          options.abortSignal?.removeEventListener("abort", onAbort);
          try {
            options.onStageChange?.("saving");
            options.onProgress?.(95);
            const downloadUrl = await getDownloadURL(task.snapshot.ref);
            options.onProgress?.(100);
            resolve({
              downloadUrl,
              storagePath,
              processed,
            });
          } catch (urlErr) {
            reject(urlErr);
          }
        }
      );
    });

  try {
    return await attemptFirebaseUpload();
  } catch (err: any) {
    if (err?.message === "আপলোড বাতিল করা হয়েছে।") {
      throw err;
    }
    // If bucket returned 404 dynamically during upload, mark unavailable and encode cleanly
    const rawMsg = String(err?.message || err?.serverResponse || "");
    if (err?.code === "storage/bucket-not-found" || rawMsg.includes("404") || rawMsg.includes("bucket does not exist")) {
      cachedBucketStatus = "unavailable";
      options.onStageChange?.("saving");
      options.onProgress?.(95);
      const dataUrl = await blobToDataUrl(processed.blob);
      options.onProgress?.(100);
      return {
        downloadUrl: dataUrl,
        storagePath: "firestore_asset",
        processed,
      };
    }

    if (!allowFallback) {
      throw new Error(mapUploadErrorMessage(err));
    }

    console.warn("[Firebase Storage notice: falling back to client-optimized format]", err);
    options.onStageChange?.("saving");
    options.onProgress?.(100);
    const dataUrl = await blobToDataUrl(processed.blob);
    return {
      downloadUrl: dataUrl,
      storagePath: "client_fallback",
      processed,
    };
  }
}

/**
 * Safely delete an existing image from Firebase Storage using its download URL.
 * Only deletes if the URL belongs to this project's storage bucket.
 */
export async function deleteStorageImageByUrl(url: string | null | undefined): Promise<boolean> {
  if (!url || typeof url !== "string") return false;
  // Ignore base64 data URLs, local blob URLs, or external CDNs
  if (url.startsWith("data:") || url.startsWith("blob:") || !url.includes("firebasestorage.googleapis.com")) {
    return false;
  }

  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
    return true;
  } catch (err: any) {
    // 404 object-not-found is considered clean
    if (err?.code === "storage/object-not-found") {
      return true;
    }
    console.warn("[Storage Delete Warning] Could not delete image:", err);
    return false;
  }
}
