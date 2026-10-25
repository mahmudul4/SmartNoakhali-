import React, { useRef, useState } from "react";
import {
  Upload,
  Camera,
  Trash2,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileImage,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  uploadImageToFirebaseStorage,
  deleteStorageImageByUrl,
  type ImageUploadCategory,
} from "@/lib/imageUpload";
import {
  formatFileSizeBn,
  type ProcessedImageResult,
  type CompressionOptions,
} from "@/lib/imageProcessor";

export type UploaderVariant = "avatar" | "card" | "inline" | "dropzone";

export interface UniversalImageUploaderProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  category: ImageUploadCategory;
  entityId?: string;
  variant?: UploaderVariant;
  label?: string;
  description?: string;
  hint?: string;
  disabled?: boolean;
  compression?: CompressionOptions;
  aspectRatioClass?: string; // e.g. "aspect-video", "aspect-square", "h-32 w-32"
  placeholderIcon?: React.ReactNode;
  autoDeleteOld?: boolean;
  className?: string;
}

export function UniversalImageUploader({
  value,
  onChange,
  category,
  entityId,
  variant = "card",
  label,
  description,
  hint,
  disabled = false,
  compression,
  aspectRatioClass,
  placeholderIcon,
  autoDeleteOld = false,
  className = "",
}: UniversalImageUploaderProps) {
  const displayHint = description || hint;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [stats, setStats] = useState<ProcessedImageResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSelectedFile, setLastSelectedFile] = useState<File | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset input so same file can be re-selected if desired
    if (!file) return;

    setLastSelectedFile(file);
    await startUploadProcess(file);
  };

  const startUploadProcess = async (file: File) => {
    setErrorMsg(null);
    setIsProcessing(true);
    setProgress(5);

    try {
      const oldUrl = value;
      const result = await uploadImageToFirebaseStorage(file, {
        category,
        entityId,
        compression,
        onProgress: (pct) => {
          setProgress(Math.max(10, pct));
        },
      });

      setStats(result.processed);
      onChange(result.downloadUrl);
      toast.success("ছবি সফলভাবে আপলোড ও অপ্টিমাইজ হয়েছে!");

      // If requested, clean up old storage image in background safely
      if (autoDeleteOld && oldUrl && oldUrl !== result.downloadUrl) {
        void deleteStorageImageByUrl(oldUrl);
      }
    } catch (err: any) {
      console.error("[UniversalImageUploader Error]", err);
      const msg = err?.message || "ছবি আপলোড ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || isProcessing) return;

    const oldUrl = value;
    onChange(null);
    setStats(null);
    setErrorMsg(null);
    setLastSelectedFile(null);

    if (autoDeleteOld && oldUrl) {
      void deleteStorageImageByUrl(oldUrl);
    }
    toast.info("ছবি মুছে ফেলা হয়েছে।");
  };

  const handleRetry = () => {
    if (lastSelectedFile) {
      void startUploadProcess(lastSelectedFile);
    } else {
      fileInputRef.current?.click();
    }
  };

  // Hidden File Input
  const hiddenInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
      onChange={handleFileChange}
      disabled={disabled || isProcessing}
      className="hidden"
      aria-label={label || "ছবি নির্বাচন করুন"}
    />
  );

  // -------------------------------------------------------------
  // VARIANT: AVATAR (Circular Profile / Staff photo)
  // -------------------------------------------------------------
  if (variant === "avatar") {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        {hiddenInput}
        <div className="relative group">
          <div
            className={`relative flex items-center justify-center overflow-hidden rounded-full border-2 border-primary/30 bg-muted/60 shadow-md transition-all ${
              aspectRatioClass || "h-24 w-24 sm:h-28 sm:w-28"
            } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-primary"}`}
            onClick={() => !disabled && !isProcessing && fileInputRef.current?.click()}
            title="গ্যালারি বা ক্যামেরা থেকে ছবি পরিবর্তন করুন"
          >
            {value ? (
              <img
                src={value}
                alt={label || "Avatar"}
                className="h-full w-full object-cover bg-white"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              placeholderIcon || <Camera className="h-8 w-8 text-muted-foreground/80" />
            )}

            {/* Loading Overlay */}
            {isProcessing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white backdrop-blur-xs">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="mt-1 text-[10px] font-bold font-mono">{progress}%</span>
              </div>
            )}

            {/* Hover Camera Overlay */}
            {!isProcessing && !disabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-6 w-6" />
              </div>
            )}
          </div>

          {/* Remove Button Badge */}
          {value && !disabled && !isProcessing && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white shadow hover:bg-destructive/90 transition active:scale-95"
              title="ছবি মুছে ফেলুন"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Change button & labels */}
        <div className="text-center">
          {label && <p className="text-xs font-bold text-foreground">{label}</p>}
          <button
            type="button"
            disabled={disabled || isProcessing}
            onClick={() => fileInputRef.current?.click()}
            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline disabled:opacity-50"
          >
            <Camera className="h-3 w-3" /> {value ? "ছবি পরিবর্তন করুন" : "ছবি যুক্ত করুন"}
          </button>
          {errorMsg && (
            <div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-destructive font-medium">
              <AlertCircle className="h-3 w-3" />
              <span>{errorMsg}</span>
              <button onClick={handleRetry} className="underline font-bold ml-1">
                আবার চেষ্টা
              </button>
            </div>
          )}
          {stats && (
            <p className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> অপ্টিমাইজড ({formatFileSizeBn(stats.compressedSizeBytes)})
            </p>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VARIANT: INLINE (Compact for table rows & small forms)
  // -------------------------------------------------------------
  if (variant === "inline") {
    return (
      <div className={`flex items-center gap-2.5 ${className}`}>
        {hiddenInput}
        <div
          onClick={() => !disabled && !isProcessing && fileInputRef.current?.click()}
          className={`relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40 transition hover:border-primary ${
            disabled ? "opacity-50 cursor-not-allowed" : ""
          }`}
          title="ছবি নির্বাচন করুন"
        >
          {value ? (
            <img src={value} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <FileImage className="h-5 w-5 text-muted-foreground" />
          )}
          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={disabled || isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
            >
              <Upload className="h-3 w-3 text-primary" />
              {value ? "পরিবর্তন" : "ছবি আপলোড"}
            </button>
            {value && !disabled && (
              <button
                type="button"
                onClick={handleRemove}
                className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition"
                title="ছবি মুছে ফেলুন"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {errorMsg ? (
            <p className="mt-0.5 text-[10px] text-destructive truncate">{errorMsg}</p>
          ) : stats ? (
            <p className="mt-0.5 text-[10px] text-emerald-600 truncate">
              ✓ সাইজ: {formatFileSizeBn(stats.compressedSizeBytes)}
            </p>
          ) : displayHint ? (
            <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{displayHint}</p>
          ) : null}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VARIANT: CARD & DROPZONE (Standard Banner / Post / Logo / General)
  // -------------------------------------------------------------
  return (
    <div className={`space-y-2 ${className}`}>
      {hiddenInput}

      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-foreground">{label}</label>
          {stats && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-3 w-3" />
              {formatFileSizeBn(stats.originalSizeBytes)} ➔ {formatFileSizeBn(stats.compressedSizeBytes)} (-
              {stats.compressionRatio}%)
            </span>
          )}
        </div>
      )}

      {/* Main Container / Dropzone */}
      <div
        onClick={() => !disabled && !isProcessing && fileInputRef.current?.click()}
        className={`group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all ${
          aspectRatioClass || "min-h-[140px] w-full"
        } ${
          value
            ? "border-primary/40 bg-card"
            : "border-border bg-muted/20 hover:border-primary/60 hover:bg-muted/40"
        } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      >
        {value ? (
          <>
            <img
              src={value}
              alt={label || "Uploaded Image"}
              className="h-full w-full object-contain p-2"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            {/* Hover Actions Bar */}
            {!isProcessing && !disabled && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow hover:bg-slate-100 transition active:scale-95"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-primary" /> পরিবর্তন করুন
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="inline-flex items-center gap-1 rounded-full bg-destructive px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-destructive/90 transition active:scale-95"
                >
                  <Trash2 className="h-3.5 w-3.5" /> মুছুন
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-5 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:scale-105">
              <Upload className="h-6 w-6" />
            </div>
            <p className="mt-2.5 text-xs font-bold text-foreground">
              গ্যালারি, ক্যামেরা বা ফাইল থেকে ছবি নির্বাচন করুন
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {displayHint || "JPG, PNG বা WebP • স্বয়ংক্রিয়ভাবে কম্প্রেস ও অপ্টিমাইজ হবে"}
            </p>
          </div>
        )}

        {/* Processing & Upload Progress Bar */}
        {isProcessing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 p-4 text-white backdrop-blur-xs">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="mt-2 text-xs font-bold">ছবি প্রসেস ও অপ্টিমাইজ হচ্ছে...</p>
            <div className="mt-2 w-48 overflow-hidden rounded-full bg-white/20 h-2">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="mt-1 text-[10px] font-mono font-semibold">{progress}%</span>
          </div>
        )}
      </div>

      {/* Error & Retry banner */}
      {errorMsg && (
        <div className="flex items-center justify-between rounded-xl bg-destructive/10 p-2.5 text-xs text-destructive">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="ml-2 rounded-lg bg-destructive px-2.5 py-1 text-[10px] font-bold text-white hover:bg-destructive/90 transition shrink-0"
          >
            পুনরায় চেষ্টা
          </button>
        </div>
      )}
    </div>
  );
}
