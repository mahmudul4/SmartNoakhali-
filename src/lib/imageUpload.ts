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

/**
 * Compress an image and upload directly to Firebase Storage with live progress.
 */
export async function uploadImageToFirebaseStorage(
  file: File,
  options: ImageUploadOptions
): Promise<ImageUploadResult> {
  const timeoutMs = options.timeoutMs ?? 45000;

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

  // 4. Upload with progress reporting & safety timeout
  return new Promise((resolve, reject) => {
    let isSettled = false;
    const uploadTask = uploadBytesResumable(storageRef, processed.blob, metadata);

    const timer = setTimeout(() => {
      if (isSettled) return;
      isSettled = true;
      try {
        uploadTask.cancel();
      } catch (_) {}
      reject(new Error("আপলোড সম্পন্ন হতে অতিরিক্ত সময় লাগছে (নেটওয়ার্ক টাইমআউট)। অনুগ্রহ করে ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।"));
    }, timeoutMs);

    const onAbort = () => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timer);
      try {
        uploadTask.cancel();
      } catch (_) {}
      reject(new Error("আপলোড বাতিল করা হয়েছে।"));
    };

    if (options.abortSignal) {
      if (options.abortSignal.aborted) {
        onAbort();
        return;
      }
      options.abortSignal.addEventListener("abort", onAbort, { once: true });
    }

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        if (isSettled) return;
        if (snapshot.totalBytes > 0) {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          options.onProgress?.(progress);
        }
      },
      (error) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timer);
        if (options.abortSignal) {
          options.abortSignal.removeEventListener("abort", onAbort);
        }

        console.error("[Storage Upload Error]", error);
        let userMessage = "ছবি আপলোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।";
        if (error.code === "storage/unauthorized") {
          userMessage = "ছবি আপলোডের অনুমতি নেই (Permission Denied)। অনুগ্রহ করে লগইন করুন।";
        } else if (error.code === "storage/canceled") {
          userMessage = "আপলোড বাতিল করা হয়েছে।";
        } else if (error.code === "storage/retry-limit-exceeded") {
          userMessage = "নেটওয়ার্ক ধীরগতির কারণে আপলোড টাইমআউট হয়েছে। ইন্টারনেট চেক করুন।";
        }
        reject(new Error(userMessage));
      },
      async () => {
        if (isSettled) return;
        clearTimeout(timer);
        if (options.abortSignal) {
          options.abortSignal.removeEventListener("abort", onAbort);
        }

        try {
          options.onStageChange?.("saving");
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          isSettled = true;
          options.onProgress?.(100);
          resolve({
            downloadUrl,
            storagePath,
            processed,
          });
        } catch (urlErr) {
          isSettled = true;
          reject(new Error("ছবির ডাউনলোড লিংক তৈরি করা যায়নি।"));
        }
      }
    );
  });
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
