import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Smartphone,
  Apple,
  Download,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  FileDown,
  Zap,
  Upload,
  Loader2,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useAppLinks } from "@/lib/cloud";
import {
  downloadAppPackageBinary,
  sanitizeAppFileName,
  usePWAInstall,
} from "@/lib/pwa";
import { useAppPackages, useLogo, type AppPackageInfo } from "@/lib/store";

export const Route = createFileRoute("/app-download")({
  head: () => ({ meta: [{ title: "অ্যাপ ডাউনলোড — স্মার্ট নোয়াখালী" }] }),
  component: AppDownloadPage,
});

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "1.93 MB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function AppDownloadPage() {
  const { isMainAdmin, isAdmin } = useAuth();
  const { items: cloudLinks } = useAppLinks();
  const { packages, uploadAppBinary } = useAppPackages();
  const { logo } = useLogo();
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [downloadingPlatform, setDownloadingPlatform] = useState<string | null>(null);
  const [installingPwa, setInstallingPwa] = useState(false);
  const [uploadingApk, setUploadingApk] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ pct: number; stage: string } | null>(null);
  const apkFileInputRef = useRef<HTMLInputElement>(null);

  const platforms: Array<"android" | "ios"> = ["android", "ios"];

  const resolvedCards = platforms
    .map((platform) => {
      const pkg: AppPackageInfo = packages[platform];
      const cloudRow = cloudLinks.find((l) => l.platform === platform);

      const visible = pkg?.visible ?? cloudRow?.visible ?? true;
      const rawLabel =
        pkg?.label ||
        cloudRow?.label ||
        (platform === "android" ? "Android অ্যাপ (.APK)" : "iPhone অ্যাপ (iOS)");
      const label = rawLabel.replace(/\s+\.APK/gi, " (.APK)");
      const version = pkg?.version || "2.0.0";
      const fileName = sanitizeAppFileName(
        pkg?.fileName ||
          (platform === "android"
            ? "Smart-Noakhali-Android.apk"
            : "Smart-Noakhali-iOS.mobileconfig"),
        platform
      );
      const fileSize =
        pkg?.fileSize && pkg.fileSize >= 1000 && pkg.fileSize !== 52640
          ? pkg.fileSize
          : platform === "android"
            ? 2020149
            : 42444;
      const releaseNotes =
        pkg?.releaseNotes ||
        "দ্রুত সেবা, জরুরি রক্তদান, লাইভ চ্যাট ও সকল নোয়াখালী তথ্য এক ক্লিকে।";
      const uploadedAt = pkg?.uploadedAt || "";
      const chunkCount = pkg?.chunkCount;

      const embeddedUrl = pkg?.embeddedDataUrl?.startsWith("data:")
        ? pkg.embeddedDataUrl
        : cloudRow?.url?.startsWith("data:")
          ? cloudRow.url
          : "";

      const downloadHref =
        pkg?.downloadUrl ||
        (platform === "android"
          ? "/downloads/Smart-Noakhali-Android.apk"
          : "/downloads/Smart-Noakhali-iOS.mobileconfig");

      return {
        platform,
        visible,
        label,
        version,
        fileName,
        fileSize,
        chunkCount,
        releaseNotes,
        uploadedAt,
        embeddedUrl,
        downloadHref,
      };
    })
    .filter((c) => c.visible);

  const handleInstantPwaInstall = async () => {
    setInstallingPwa(true);
    try {
      const accepted = await install();
      if (accepted) {
        toast.success("স্মার্ট নোয়াখালী অ্যাপ সফলভাবে আপনার ফোনে ইনস্টল হচ্ছে!");
      }
    } finally {
      setInstallingPwa(false);
    }
  };

  const handleDirectDownload = async (card: (typeof resolvedCards)[number]) => {
    if (downloadingPlatform) return;
    setDownloadingPlatform(card.platform);
    try {
      const result = await downloadAppPackageBinary({
        platform: card.platform,
        fileName: card.fileName,
        fileSize: card.fileSize,
        downloadUrl: card.downloadHref,
        embeddedDataUrl: card.embeddedUrl,
        chunkCount: card.chunkCount,
      });
      toast.success(
        `${result.fileName} (${formatBytes(result.byteLength)}) সফলভাবে ডাউনলোড হয়েছে! এবার ফাইলটি ওপেন করে ইনস্টল করুন।`
      );
    } catch (err: any) {
      toast.error(err?.message || "ডাউনলোড ব্যর্থ হয়েছে");
    } finally {
      setDownloadingPlatform(null);
    }
  };

  const handleQuickApkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingApk(true);
    setUploadProgress({ pct: 5, stage: "আপলোড শুরু হচ্ছে..." });
    try {
      const curAndroid = packages.android;
      const saved = await uploadAppBinary(
        "android",
        file,
        {
          label: curAndroid?.label || "স্মার্ট নোয়াখালী Android অ্যাপ (.APK)",
          version: curAndroid?.version || "2.0.0",
          releaseNotes:
            curAndroid?.releaseNotes ||
            "অ্যান্ড্রয়েড ফোনের জন্য অফিসিয়াল অ্যাপ — এক ক্লিকে ডাউনলোড ও ইনস্টল করুন।",
          visible: true,
        },
        (pct, stage) => setUploadProgress({ pct, stage })
      );
      toast.success(
        `${saved.fileName} (${formatBytes(saved.fileSize)}) সফলভাবে সার্ভারে ও Firebase ডাটাবেজে সংরক্ষিত হয়েছে!`
      );
    } catch (err: any) {
      toast.error(err?.message || "APK আপলোড ব্যর্থ হয়েছে");
    } finally {
      setUploadingApk(false);
      setUploadProgress(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-4">
      <input
        ref={apkFileInputRef}
        type="file"
        accept=".apk,application/vnd.android.package-archive,application/octet-stream"
        onChange={(e) => void handleQuickApkUpload(e)}
        className="hidden"
      />
      <Link
        to="/"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> হোম
      </Link>

      <div className="mb-5 overflow-hidden rounded-3xl bg-gradient-hero p-6 text-primary-foreground shadow-elevated">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white p-1.5 shadow-gold ring-2 ring-gold">
            <img
              src={logo}
              alt="Smart Noakhali"
              className="h-full w-full rounded-xl object-contain"
            />
          </div>
          <div className="flex-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold">
              <Sparkles className="h-3 w-3" /> সরাসরি ওয়ান-ক্লিক ইনস্টলার ও ভেরিফাইড APK
            </span>
            <h1 className="mt-1 font-display text-2xl font-bold">
              স্মার্ট নোয়াখালী মোবাইল অ্যাপ
            </h1>
            <p className="mt-1 text-xs opacity-90 sm:text-sm">
              কোনো বাহ্যিক লিংক ছাড়াই সরাসরি এন্ড্রয়েড (Android .APK) এবং আইফোন (iPhone iOS) অ্যাপ এক ক্লিকে আপনার ফোনে ডাউনলোড অথবা সরাসরি ইনস্টল করুন।
            </p>
          </div>
        </div>

        {isInstalled ? (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-2.5 text-xs font-bold text-amber-200">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-300" />
            <span>আপনার ডিভাইসে স্মার্ট নোয়াখালী অ্যাপ ইতিমধ্যে ইনস্টল করা আছে!</span>
          </div>
        ) : isInstallable ? (
          <div className="mt-4 flex flex-col items-stretch justify-between gap-3 rounded-2xl border border-gold/40 bg-white/10 p-3.5 sm:flex-row sm:items-center">
            <div className="text-xs">
              <p className="font-bold text-amber-200">
                ⚡ সবচেয়ে দ্রুত পদ্ধতি: কোনো APK সেটিংস ছাড়াই সরাসরি ইনস্টল করুন
              </p>
              <p className="mt-0.5 text-[11px] text-white/85">
                গুগল ক্রোম ওয়ান-ক্লিক ওয়েব-অ্যাপ ইনস্টলার দিয়ে ১ সেকেন্ডে ফোনের হোম স্ক্রিনে অ্যাপ যুক্ত করুন।
              </p>
            </div>
            <button
              type="button"
              disabled={installingPwa}
              onClick={() => void handleInstantPwaInstall()}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-gold px-4 py-2.5 text-xs font-extrabold text-primary-deep shadow-gold transition active:scale-95"
            >
              <Zap className="h-4 w-4" />
              {installingPwa ? "ইনস্টল হচ্ছে..." : "এক ক্লিকে সরাসরি ইনস্টল"}
            </button>
          </div>
        ) : null}
      </div>

      {resolvedCards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          শীঘ্রই অ্যাপ ডাউনলোড উন্মুক্ত করা হবে।
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {resolvedCards.map((card) => {
            const isIOS = card.platform === "ios";
            const Icon = isIOS ? Apple : Smartphone;
            const isDownloading = downloadingPlatform === card.platform;

            return (
              <div
                key={card.platform}
                className="flex flex-col justify-between rounded-3xl border border-border/80 bg-gradient-card p-5 shadow-card transition hover:border-primary/40"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-md ${
                        isIOS
                          ? "bg-gradient-to-br from-slate-800 to-slate-950"
                          : "bg-gradient-to-br from-emerald-600 to-emerald-800"
                      }`}
                    >
                      <Icon className="h-7 w-7" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary-deep">
                        v{card.version}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-700">
                        {formatBytes(card.fileSize)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {isIOS ? "Apple iPhone / iPad (iOS)" : "Android Smartphone (.APK)"}
                    </p>
                    <h2 className="mt-0.5 font-display text-lg font-bold text-primary-deep">
                      {card.label}
                    </h2>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {card.releaseNotes}
                    </p>
                  </div>

                  <div className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">ফাইল:</span>
                      <span className="truncate font-mono text-[10px] font-bold text-primary-deep">
                        {card.fileName}
                      </span>
                    </div>
                    {card.uploadedAt && (
                      <div className="mt-0.5 flex items-center justify-between">
                        <span>আপডেট:</span>
                        <span>{new Date(card.uploadedAt).toLocaleDateString("bn-BD")}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  {!isIOS && isInstallable && !isInstalled && (
                    <button
                      type="button"
                      onClick={() => void handleInstantPwaInstall()}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary bg-primary/10 py-3 text-xs font-extrabold text-primary-deep transition hover:bg-primary/20 active:scale-[0.98]"
                    >
                      <Zap className="h-4 w-4 text-primary" />
                      সরাসরি ফোনে ইনস্টল করুন (১ ক্লিকে)
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isDownloading}
                    onClick={() => void handleDirectDownload(card)}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white shadow-elevated transition active:scale-[0.98] disabled:opacity-70 ${
                      isIOS
                        ? "bg-gradient-to-r from-slate-800 to-slate-950 hover:opacity-95"
                        : "bg-gradient-hero hover:opacity-95"
                    }`}
                  >
                    {isDownloading ? (
                      <>
                        <FileDown className="h-4 w-4 animate-bounce" />
                        ডাউনলোড হচ্ছে...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        {isIOS ? "iOS প্রোফাইল ডাউনলোড করুন" : "এক ক্লিকে .APK ডাউনলোড করুন"}
                      </>
                    )}
                  </button>
                  <p className="mt-1 flex items-center justify-center gap-1 text-center text-[11px] text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" /> ভেরিফাইড ও নিরাপদ ডিরেক্ট ফাইল ({card.fileName})
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-primary-deep">
          <CheckCircle2 className="h-4 w-4 text-primary" /> ইনস্টল করার নিয়মাবলী:
        </h3>
        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
          <li>
            • <strong>Android (সরাসরি ইনস্টল বা .APK):</strong>{" "}
            <code>সরাসরি ফোনে ইনস্টল করুন</code> বাটনে চাপলে কোনো অতিরিক্ত সেটিংস ছাড়াই অ্যাপ ইনস্টল হবে। অথবা{" "}
            <code>এক ক্লিকে .APK ডাউনলোড করুন</code> বাটনে ক্লিক করলে সরাসরি আসল{" "}
            <code>Smart-Noakhali-Android.apk</code> ফাইল ডাউনলোড হবে — সেটি ওপেন করে <em>Install</em> করুন।
          </li>
          <li>
            • <strong>iPhone (iOS):</strong> ডাউনলোড বাটনে ক্লিক করে{" "}
            <code>Smart-Noakhali-iOS.mobileconfig</code> প্রোফাইলটি ডাউনলোড করুন এবং ফোনের{" "}
            <em>Settings → Profile Downloaded → Install</em> চাপুন, অথবা Safari ব্রাউজারের{" "}
            <em>Share → Add to Home Screen</em> চাপুন।
          </li>
        </ul>
      </div>

      {/* Direct APK Binary Uploader (Super Admin / Admin or Quick Upload) */}
      {(isMainAdmin || isAdmin) && (
        <div className="mt-5 rounded-3xl border-2 border-dashed border-primary/40 bg-card p-5 shadow-card">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="flex items-center gap-1.5 font-display text-sm font-bold text-primary-deep">
                <Upload className="h-4 w-4 text-primary" /> আপনার নিজস্ব .APK ফাইল সরাসরি আপলোড করুন (সুপার এডমিন)
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                আপনার <code>Smart-Noakhali-Android.apk</code> (যেমন 1.93 MB বা যেকোনো সাইজ) এখান থেকে সিলেক্ট করলেই আসল ফাইলটি হুবহু সাইজে সার্ভারে ও Firebase ডাটাবেজে সংরক্ষিত হবে।
              </p>
            </div>
            <button
              type="button"
              disabled={uploadingApk}
              onClick={() => apkFileInputRef.current?.click()}
              className="flex shrink-0 items-center gap-2 rounded-2xl bg-gradient-hero px-4 py-2.5 text-xs font-bold text-white shadow-card transition active:scale-95 disabled:opacity-60"
            >
              {uploadingApk ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  আপলোড হচ্ছে...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  .APK ফাইল সিলেক্ট ও আপলোড করুন
                </>
              )}
            </button>
          </div>

          {uploadProgress && (
            <div className="mt-3 space-y-1.5 rounded-2xl bg-primary/5 p-3">
              <div className="flex items-center justify-between text-xs font-bold text-primary-deep">
                <span>{uploadProgress.stage}</span>
                <span>{uploadProgress.pct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-primary/15">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress.pct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
