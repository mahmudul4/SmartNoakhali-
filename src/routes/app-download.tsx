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
  Settings,
} from "lucide-react";
import { useState } from "react";
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
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function AppDownloadPage() {
  const { isMainAdmin } = useAuth();
  const { items: cloudLinks } = useAppLinks();
  const { packages } = useAppPackages();
  const { logo } = useLogo();
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [downloadingPlatform, setDownloadingPlatform] = useState<string | null>(null);
  const [installingPwa, setInstallingPwa] = useState(false);

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
      const fileName = pkg?.fileName ? sanitizeAppFileName(pkg.fileName, platform) : "";
      const fileSize = pkg?.fileSize && pkg.fileSize > 0 ? pkg.fileSize : 0;
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

      const downloadHref = pkg?.downloadUrl || `/api/apps/download/${platform}`;
      const hasBinary = Boolean(
        fileSize > 0 && (fileName || downloadHref || embeddedUrl || (chunkCount && chunkCount > 0))
      );

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
        hasBinary,
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
    if (!card.hasBinary) {
      toast.info("এখনও কোনো অ্যাপ ফাইল আপলোড করা হয়নি।");
      return;
    }
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
        `${result.fileName} (${formatBytes(result.byteLength)}) হুবহু সাইজে সফলভাবে ডাউনলোড হয়েছে! এবার ফাইলটি ওপেন করে ইনস্টল করুন।`
      );
    } catch (err: any) {
      toast.error(err?.message || "ডাউনলোড ব্যর্থ হয়েছে");
    } finally {
      setDownloadingPlatform(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> হোম
        </Link>

        {isMainAdmin && (
          <Link
            to="/mdmahmudulhashan"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary-deep transition hover:bg-primary/20"
          >
            <Settings className="h-3.5 w-3.5 text-primary" /> সুপার এডমিন থেকে অ্যাপ আপলোড / পরিবর্তন করুন
          </Link>
        )}
      </div>

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
              <Sparkles className="h-3 w-3" /> সরাসরি ওয়ান-ক্লিক ইনস্টলার ও ভেরিফাইড অ্যাপ
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
                      {card.hasBinary && (
                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                          {formatBytes(card.fileSize)}
                        </span>
                      )}
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

                  {card.hasBinary ? (
                    <div className="mt-3 space-y-1 rounded-xl bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">অ্যাপ ফাইল:</span>
                        <span className="truncate font-mono text-[10px] font-bold text-primary-deep">
                          {card.fileName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">অরিজিনাল সাইজ:</span>
                        <span className="font-mono text-[10px] font-bold text-emerald-700">
                          {formatBytes(card.fileSize)} ({card.fileSize.toLocaleString("en-US")} bytes)
                        </span>
                      </div>
                      {card.uploadedAt && (
                        <div className="flex items-center justify-between">
                          <span>সর্বশেষ আপডেট:</span>
                          <span>{new Date(card.uploadedAt).toLocaleDateString("bn-BD")}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2 text-center text-[11px] text-muted-foreground">
                      এখনও কোনো ফাইল আপলোড করা হয়নি
                    </div>
                  )}
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

                  {card.hasBinary ? (
                    <>
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
                            ডাউনলোড হচ্ছে ({formatBytes(card.fileSize)})...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4" />
                            {isIOS
                              ? `iOS অ্যাপ ডাউনলোড করুন (${formatBytes(card.fileSize)})`
                              : `এক ক্লিকে .APK ডাউনলোড করুন (${formatBytes(card.fileSize)})`}
                          </>
                        )}
                      </button>
                      <p className="mt-1 flex items-center justify-center gap-1 text-center text-[11px] text-emerald-700">
                        <ShieldCheck className="h-3.5 w-3.5" /> ভেরিফাইড হুবহু সাইজের আসল ফাইল ({card.fileName})
                      </p>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-muted py-3.5 text-xs font-bold text-muted-foreground"
                    >
                      <Download className="h-4 w-4" />
                      {isIOS ? "iOS ফাইল শীঘ্রই আসছে" : ".APK ফাইল শীঘ্রই আসছে"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
