/**
 * Smart Noakhali — Compatibility Bridge & Image Upload Helper (Cloudflare R2 Backed)
 *
 * All image uploads and deletions now route through Cloudflare R2 via `@/lib/r2Storage`.
 * Firebase Storage SDK is no longer imported or invoked.
 */

import {
  uploadImageToR2,
  deleteR2FileByUrl,
  checkR2StorageHealth,
  type R2UploadMetadata,
} from "@/lib/r2Storage";
import type { CompressionOptions, ProcessedImageResult } from "./imageProcessor";

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
  | "complaint_attachment"
  | "expense_receipt"
  | "donation_slip"
  | "service"
  | "notice"
  | "general";

export interface ImageUploadOptions {
  category: ImageUploadCategory;
  entityId?: string;
  compression?: CompressionOptions;
  onProgress?: (progressPercent: number) => void;
  onStageChange?: (stage: "validating" | "compressing" | "uploading" | "saving") => void;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  customPath?: string;
  allowClientFallback?: boolean;
  deterministicSlug?: string;
}

export interface ImageUploadResult {
  downloadUrl: string;
  storagePath: string;
  processed: ProcessedImageResult;
  r2?: R2UploadMetadata;
}

export async function probeStorageBucketAvailable(): Promise<boolean> {
  try {
    const health = await checkR2StorageHealth();
    return Boolean(health.ok || health.publicReady);
  } catch {
    return false;
  }
}

export function buildStoragePath(
  category: ImageUploadCategory,
  entityId?: string,
  fileName?: string
): string {
  const timestamp = Date.now();
  const safeEntity = (entityId || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const ext = fileName && fileName.includes(".") ? fileName.split(".").pop() : "webp";
  const uniqueName = `${timestamp}_${randomSuffix}.${ext}`;

  switch (category) {
    case "profile":
      return `profiles/${safeEntity}/${uniqueName}`;
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
      return `logos/${safeEntity}/${uniqueName}`;
    case "banner":
      return `banners/${safeEntity}/${uniqueName}`;
    case "service":
      return `services/${safeEntity}/${uniqueName}`;
    case "notice":
      return `notices/${safeEntity}/${uniqueName}`;
    case "complaint_attachment":
      return `private/complaints/${safeEntity}/${uniqueName}`;
    case "expense_receipt":
      return `expenses/${safeEntity}/${uniqueName}`;
    case "donation_slip":
      return `private/donations/${safeEntity}/${uniqueName}`;
    case "chat":
      return `private/chat/${safeEntity}/${uniqueName}`;
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

/**
 * Uploads an image directly to Cloudflare R2 via `/api/storage/upload`.
 * Name retained as compatibility wrapper while callers migrate cleanly to `@/lib/r2Storage`.
 */
export async function uploadImageToFirebaseStorage(
  file: File,
  options: ImageUploadOptions
): Promise<ImageUploadResult> {
  return uploadImageToR2(file, {
    category: options.category === "category" ? "category_icon" : options.category,
    entityId: options.entityId,
    customKey: options.customPath,
    deterministicSlug: options.deterministicSlug,
    compression: options.compression,
    onProgress: options.onProgress,
    onStageChange: options.onStageChange,
    timeoutMs: options.timeoutMs,
    abortSignal: options.abortSignal,
  });
}

export { uploadImageToR2 };

/**
 * Deletes an image stored on Cloudflare R2 using its fileUrl or objectKey.
 */
export async function deleteStorageImageByUrl(url: string | null | undefined): Promise<boolean> {
  return deleteR2FileByUrl(url);
}
