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
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAppLinks } from "@/lib/cloud";
import { useAppPackages, useLogo, type AppPackageInfo } from "@/lib/store";

export const Route = createFileRoute("/app-download")({
  head: () => ({ meta: [{ title: "অ্যাপ ডাউনলোড — স্মার্ট নোয়াখালী" }] }),
  component: AppDownloadPage,
});

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "Direct Package";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function AppDownloadPage() {
  const { items: cloudLinks } = useAppLinks();
  const { packages } = useAppPackages();
  const { logo } = useLogo();
  const [downloadingPlatform, setDownloadingPlatform] = useState<string | null>(null);

  const platforms: Array<"android" | "ios"> = ["android", "ios"];

  const resolvedCards = platforms
    .map((platform) => {
      const pkg: AppPackageInfo = packages[platform];
      const cloudRow = cloudLinks.find((l) => l.platform === platform);

      const visible = pkg?.visible ?? cloudRow?.visible ?? true;
      const label =
        pkg?.label ||
        cloudRow?.label ||
        (platform === "android" ? "Android অ্যাপ (.APK)" : "iPhone অ্যাপ (iOS)");
      const version = pkg?.version || "2.0.0";
      const fileName =
        pkg?.fileName ||
        (platform === "android" ? "Smart-Noakhali-Android.apk" : "Smart-Noakhali-iOS.ipa");
      const fileSize = pkg?.fileSize || 0;
      const releaseNotes =
        pkg?.releaseNotes ||
        "দ্রুত সেবা, জরুরি রক্তদান, লাইভ চ্যাট ও সকল নোয়াখালী তথ্য এক ক্লিকে।";
      const uploadedAt = pkg?.uploadedAt || "";

      const embeddedUrl = pkg?.embeddedDataUrl?.startsWith("data:")
        ? pkg.embeddedDataUrl
        : cloudRow?.url?.startsWith("data:")
          ? cloudRow.url
          : "";

      const downloadHref =
        pkg?.downloadUrl || embeddedUrl || `/api/apps/download/${platform}`;

      return {
        platform,
        visible,
        label,
        version,
        fileName,
        fileSize,
        releaseNotes,
        uploadedAt,
        downloadHref,
      };
    })
    .filter((c) => c.visible);

  const handleDirectDownload = (card: (typeof resolvedCards)[number]) => {
    setDownloadingPlatform(card.platform);
    toast.success(`${card.label} ডাউনলোড শুরু হয়েছে...`);
    setTimeout(() => {
      setDownloadingPlatform(null);
    }, 1500);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-4">
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
              <Sparkles className="h-3 w-3" /> সরাসরি ওয়ান-ক্লিক ইনস্টলার
            </span>
            <h1 className="mt-1 font-display text-2xl font-bold">
              স্মার্ট নোয়াখালী মোবাইল অ্যাপ
            </h1>
            <p className="mt-1 text-xs opacity-90 sm:text-sm">
              কোনো বাহ্যিক লিংক ছাড়াই সরাসরি এন্ড্রয়েড (Android APK) এবং আইফোন (iPhone iOS) অ্যাপ এক ক্লিকে আপনার ফোনে ডাউনলোড করুন।
            </p>
          </div>
        </div>
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
                      <span className="text-[11px] text-muted-foreground">
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
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">ফাইল:</span>
                      <span className="truncate font-mono text-[10px]">{card.fileName}</span>
                    </div>
                    {card.uploadedAt && (
                      <div className="mt-0.5 flex items-center justify-between">
                        <span>আপডেট:</span>
                        <span>{new Date(card.uploadedAt).toLocaleDateString("bn-BD")}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5">
                  <a
                    href={card.downloadHref}
                    download={card.fileName}
                    onClick={() => handleDirectDownload(card)}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white shadow-elevated transition active:scale-[0.98] ${
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
                        এক ক্লিকে ডাউনলোড করুন
                      </>
                    )}
                  </a>
                  <p className="mt-2 flex items-center justify-center gap-1 text-center text-[11px] text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" /> ভেরিফাইড ও নিরাপদ ডিরেক্ট ফাইল
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
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>
            • <strong>Android:</strong> ডাউনলোড বাটনে ক্লিক করলে সরাসরি <code>.apk</code> ফাইল ডাউনলোড হবে। ফাইলটি ওপেন করে <em>Install</em> করুন।
          </li>
          <li>
            • <strong>iPhone (iOS):</strong> ডাউনলোড বাটনে ক্লিক করে আইওএস প্রোফাইল/অ্যাপ প্যাকেজটি ডাউনলোড করুন এবং ফোনের <em>Settings → Profile Downloaded</em> থেকে ইনস্টল সম্পন্ন করুন।
          </li>
        </ul>
      </div>
    </div>
  );
}
