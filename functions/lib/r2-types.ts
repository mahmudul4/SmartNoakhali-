/**
 * Shared Cloudflare R2 & Storage Domain Types for Pages Functions
 * Compatible with Cloudflare Workers runtime (zero Node-only dependencies).
 */

export interface R2HTTPMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
}

export interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
  sha256?: ArrayBuffer | string;
}

export interface R2GetOptions {
  onlyIf?: Record<string, unknown>;
  range?: { offset?: number; length?: number; suffix?: number };
}

export interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
}

export interface R2ObjectBody extends R2Object {
  body: ReadableStream<Uint8Array>;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

export interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
}

export interface R2ListOptions {
  limit?: number;
  prefix?: string;
  cursor?: string;
  delimiter?: string;
}

export interface R2BucketBinding {
  head(key: string): Promise<R2Object | null>;
  get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: R2PutOptions
  ): Promise<R2Object | null>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: R2ListOptions): Promise<R2Objects>;
}

export interface WorkerAssetsBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface StorageEnv {
  ASSETS?: WorkerAssetsBinding;
  R2_PUBLIC?: R2BucketBinding;
  R2_PRIVATE?: R2BucketBinding;
  PUBLIC_R2_CDN_URL?: string;
  FIREBASE_PROJECT_ID?: string;
  R2_ALLOWED_ORIGINS?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
}

export type R2BucketType = "public" | "private";

export type StorageCategory =
  | "category_icon"
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
  | "chat_public"
  | "chat_private"
  | "admin_private"
  | "general";

export interface CategoryPolicy {
  defaultBucket: R2BucketType;
  allowedBuckets: R2BucketType[];
  maxSizeBytes: number;
  allowedMimes: readonly string[];
  adminOrStaffOnly: boolean;
  allowAnonymousFirebaseAuth: boolean;
  prefix: string;
}

const IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
] as const;

const BRANDING_MIMES = [
  ...IMAGE_MIMES,
  "image/x-icon",
  "image/vnd.microsoft.icon",
] as const;

const DOCUMENT_AND_IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/avif",
  "application/pdf",
] as const;

const CHAT_MIMES = [
  ...DOCUMENT_AND_IMAGE_MIMES,
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "video/webm",
] as const;

export const CATEGORY_POLICIES: Record<StorageCategory, CategoryPolicy> = {
  category_icon: {
    defaultBucket: "public",
    allowedBuckets: ["public"],
    maxSizeBytes: 5 * 1024 * 1024,
    allowedMimes: IMAGE_MIMES,
    adminOrStaffOnly: true,
    allowAnonymousFirebaseAuth: false,
    prefix: "categories",
  },
  logo: {
    defaultBucket: "public",
    allowedBuckets: ["public"],
    maxSizeBytes: 5 * 1024 * 1024,
    allowedMimes: BRANDING_MIMES,
    adminOrStaffOnly: true,
    allowAnonymousFirebaseAuth: false,
    prefix: "logos",
  },
  branding: {
    defaultBucket: "public",
    allowedBuckets: ["public"],
    maxSizeBytes: 5 * 1024 * 1024,
    allowedMimes: BRANDING_MIMES,
    adminOrStaffOnly: true,
    allowAnonymousFirebaseAuth: false,
    prefix: "branding",
  },
  banner: {
    defaultBucket: "public",
    allowedBuckets: ["public"],
    maxSizeBytes: 10 * 1024 * 1024,
    allowedMimes: IMAGE_MIMES,
    adminOrStaffOnly: true,
    allowAnonymousFirebaseAuth: false,
    prefix: "banners",
  },
  service: {
    defaultBucket: "public",
    allowedBuckets: ["public"],
    maxSizeBytes: 10 * 1024 * 1024,
    allowedMimes: IMAGE_MIMES,
    adminOrStaffOnly: true,
    allowAnonymousFirebaseAuth: false,
    prefix: "services",
  },
  notice: {
    defaultBucket: "public",
    allowedBuckets: ["public"],
    maxSizeBytes: 10 * 1024 * 1024,
    allowedMimes: DOCUMENT_AND_IMAGE_MIMES,
    adminOrStaffOnly: true,
    allowAnonymousFirebaseAuth: false,
    prefix: "notices",
  },
  media_library: {
    defaultBucket: "public",
    allowedBuckets: ["public"],
    maxSizeBytes: 10 * 1024 * 1024,
    allowedMimes: BRANDING_MIMES,
    adminOrStaffOnly: true,
    allowAnonymousFirebaseAuth: false,
    prefix: "media_library",
  },
  staff_avatar: {
    defaultBucket: "public",
    allowedBuckets: ["public"],
    maxSizeBytes: 5 * 1024 * 1024,
    allowedMimes: IMAGE_MIMES,
    adminOrStaffOnly: true,
    allowAnonymousFirebaseAuth: false,
    prefix: "staff_avatars",
  },
  profile: {
    defaultBucket: "public",
    allowedBuckets: ["public"],
    maxSizeBytes: 5 * 1024 * 1024,
    allowedMimes: IMAGE_MIMES,
    adminOrStaffOnly: false,
    allowAnonymousFirebaseAuth: true,
    prefix: "profiles",
  },
  submission: {
    defaultBucket: "public",
    allowedBuckets: ["public"],
    maxSizeBytes: 10 * 1024 * 1024,
    allowedMimes: DOCUMENT_AND_IMAGE_MIMES,
    adminOrStaffOnly: false,
    allowAnonymousFirebaseAuth: true,
    prefix: "submissions",
  },
  donor: {
    defaultBucket: "public",
    allowedBuckets: ["public"],
    maxSizeBytes: 5 * 1024 * 1024,
    allowedMimes: IMAGE_MIMES,
    adminOrStaffOnly: false,
    allowAnonymousFirebaseAuth: true,
    prefix: "donors",
  },
  donor_event: {
    defaultBucket: "public",
    allowedBuckets: ["public"],
    maxSizeBytes: 10 * 1024 * 1024,
    allowedMimes: IMAGE_MIMES,
    adminOrStaffOnly: false,
    allowAnonymousFirebaseAuth: true,
    prefix: "donor-events",
  },
  donation_slip: {
    defaultBucket: "private",
    allowedBuckets: ["private", "public"],
    maxSizeBytes: 10 * 1024 * 1024,
    allowedMimes: DOCUMENT_AND_IMAGE_MIMES,
    adminOrStaffOnly: false,
    allowAnonymousFirebaseAuth: true,
    prefix: "private/donations",
  },
  expense_receipt: {
    defaultBucket: "public",
    allowedBuckets: ["public", "private"],
    maxSizeBytes: 15 * 1024 * 1024,
    allowedMimes: DOCUMENT_AND_IMAGE_MIMES,
    adminOrStaffOnly: true,
    allowAnonymousFirebaseAuth: false,
    prefix: "expenses",
  },
  complaint_attachment: {
    defaultBucket: "private",
    allowedBuckets: ["private"],
    maxSizeBytes: 15 * 1024 * 1024,
    allowedMimes: DOCUMENT_AND_IMAGE_MIMES,
    adminOrStaffOnly: false,
    allowAnonymousFirebaseAuth: true,
    prefix: "private/complaints",
  },
  chat_public: {
    defaultBucket: "public",
    allowedBuckets: ["public"],
    maxSizeBytes: 15 * 1024 * 1024,
    allowedMimes: CHAT_MIMES,
    adminOrStaffOnly: false,
    allowAnonymousFirebaseAuth: true,
    prefix: "chat",
  },
  chat_private: {
    defaultBucket: "private",
    allowedBuckets: ["private"],
    maxSizeBytes: 20 * 1024 * 1024,
    allowedMimes: CHAT_MIMES,
    adminOrStaffOnly: false,
    allowAnonymousFirebaseAuth: true,
    prefix: "private/chat",
  },
  admin_private: {
    defaultBucket: "private",
    allowedBuckets: ["private"],
    maxSizeBytes: 15 * 1024 * 1024,
    allowedMimes: DOCUMENT_AND_IMAGE_MIMES,
    adminOrStaffOnly: true,
    allowAnonymousFirebaseAuth: false,
    prefix: "private/admin",
  },
  general: {
    defaultBucket: "public",
    allowedBuckets: ["public", "private"],
    maxSizeBytes: 10 * 1024 * 1024,
    allowedMimes: DOCUMENT_AND_IMAGE_MIMES,
    adminOrStaffOnly: false,
    allowAnonymousFirebaseAuth: true,
    prefix: "uploads",
  },
};

export function resolveStorageCategory(raw: string | null | undefined): StorageCategory {
  const val = String(raw || "general").trim().toLowerCase();
  if (val === "category") return "category_icon";
  if (val in CATEGORY_POLICIES) return val as StorageCategory;
  return "general";
}
