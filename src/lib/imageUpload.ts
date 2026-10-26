import {
  ref,
  uploadBytes,
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
}

export interface ImageUploadResult {
  downloadUrl: string;
  storagePath: string;
  processed: ProcessedImageResult;
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
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Compress an image and upload directly to Firebase Storage with live progress.
 */
export async function uploadImageToFirebaseStorage(
  file: File,
  options: ImageUploadOptions
): Promise<ImageUploadResult> {
  const timeoutMs = options.timeoutMs ?? 15000;

  if (options.abortSignal?.aborted) {
    throw new Error("আপলোড বাতিল করা হয়েছে।");
  }

  // 1. Validating
  options.onStageChange?.("validating");

  // 1. Ensure authentication session exists (signs in anonymously if visitor)
  const fbUser = await ensureFirebaseAuthUser();

  if (options.abortSignal?.aborted) {
    throw new Error("আপলোড বাতিল করা হয়েছে।");
  }

  // 2. Compress & optimize the image
  options.onStageChange?.("compressing");
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

  const processed = await processAndCompressImage(file, {
    preset: compressionPreset,
    ...options.compression,
  });

  if (options.abortSignal?.aborted) {
    throw new Error("আপলোড বাতিল করা হয়েছে।");
  }

  // 3. Build target Firebase Storage reference
  options.onStageChange?.("uploading");
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
      originalSize: file.size.toString(),
      compressedSize: processed.compressedSizeBytes.toString(),
      uploadedAt: new Date().toISOString(),
    },
  };

  // 4. Fast direct upload with progress reporting & safe fallback
  const attemptFirebaseUpload = async (): Promise<ImageUploadResult> => {
    options.onProgress?.(30);
    const snapshot = await uploadBytes(storageRef, processed.blob, metadata);
    options.onProgress?.(80);
    options.onStageChange?.("saving");
    const downloadUrl = await getDownloadURL(snapshot.ref);
    options.onProgress?.(100);
    return {
      downloadUrl,
      storagePath,
      processed,
    };
  };

  const timeoutLimit = Math.min(timeoutMs, 10000);
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("STORAGE_TIMEOUT"));
    }, timeoutLimit);

    if (options.abortSignal) {
      options.abortSignal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("আপলোড বাতিল করা হয়েছে।"));
      }, { once: true });
    }
  });

  try {
    return await Promise.race([attemptFirebaseUpload(), timeoutPromise]);
  } catch (err: any) {
    if (err?.message === "আপলোড বাতিল করা হয়েছে।") {
      throw err;
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
