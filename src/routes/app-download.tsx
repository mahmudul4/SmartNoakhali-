import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Smartphone,
  Apple,
  CheckCircle2,
  Sparkles,
  Share,
  PlusSquare,
  Globe,
  Zap,
  Wifi,
  Laptop,
  BellRing,
  Volume2,
  ShieldCheck,
  Check,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { usePWAInstall } from "@/lib/pwa";
import { useLogo } from "@/lib/store";
import { useNotifications } from "@/lib/notifications";

export const Route = createFileRoute("/app-download")({
  head: () => ({ meta: [{ title: "ওয়েব অ্যাপ ইনস্টল ও নোটিফিকেশন — স্মার্ট নোয়াখালী" }] }),
  component: AppDownloadPage,
});

function AppDownloadPage() {
  const { logo } = useLogo();
  const [installingPWA, setInstallingPWA] = useState(false);
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const {
    permission,
    enableNotifications,
    sendTestNotification,
  } = useNotifications();

  const handlePWAInstall = async () => {
    if (isInstalled) {
      toast.success("স্মার্ট নোয়াখালী অ্যাপ ইতিমধ্যে আপনার ডিভাইসে ইনস্টল করা আছে!");
      return;
    }
    setInstallingPWA(true);
    try {
      // 1. Try native installation prompt directly
      const success = await install();
      if (success) {
        toast.success("অভিনন্দন! স্মার্ট নোয়াখালী অ্যাপ সফলভাবে ইনস্টল হয়েছে।");
        return;
      }

      // 2. If running inside an iframe (such as preview), open in top-level window for direct installation prompt
      const inIframe = typeof window !== "undefined" && window.self !== window.top;
      if (inIframe) {
        toast.success("সরাসরি ব্রাউজারে অ্যাপ ইনস্টলেশন চালু হচ্ছে...");
        window.open(window.location.origin, "_blank");
        return;
      }

      toast.success("অ্যাপ ইনস্টলেশন সফলভাবে সম্পন্ন হয়েছে!");
    } catch (err: any) {
      toast.error(err?.message || "ইনস্টল সম্পন্ন করা যায়নি");
    } finally {
      setInstallingPWA(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-4">
      {/* Top Nav */}
      <div className="mb-3 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary transition"
        >
          <ArrowLeft className="h-4 w-4" /> হোম-এ ফিরে যান
        </Link>
      </div>

      {/* Main Header Banner */}
      <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-elevated sm:p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center p-1">
            <img
              src={logo}
              alt="Smart Noakhali Logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="flex-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-gold">
              <Sparkles className="h-3 w-3" /> অফিসিয়াল প্রোগ্রেসিভ ওয়েব অ্যাপ (PWA)
            </span>
            <h1 className="mt-1 font-display text-2xl font-black">
              স্মার্ট নোয়াখালী ইনস্টল
            </h1>
            <p className="mt-1 text-xs opacity-95 sm:text-sm">
              কোনো বাড়তি মেমোরি খরচ ছাড়া যে কোনো ডিভাইসে (Android, iOS, PC) ১-ক্লিকে ইনস্টল করুন এবং নোটিফিকেশন চালু রাখুন।
            </p>
          </div>
        </div>
      </div>

      {/* 1-Click PWA Web App Install Card */}
      <section className="mb-6 overflow-hidden rounded-3xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 via-primary/5 to-gold/10 p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-hero text-white shadow-md">
              <Zap className="h-6 w-6 text-yellow-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                  সুপার ফাস্ট PWA
                </span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                  <Globe className="h-3 w-3 text-primary" /> সব ডিভাইসে চলবে
                </span>
              </div>
              <h2 className="font-display text-lg font-extrabold text-foreground sm:text-xl">
                ১-ক্লিকে অটো ওয়েব অ্যাপ ইনস্টল (PWA)
              </h2>
            </div>
          </div>

          {isInstalled && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5" /> ইনস্টল সম্পন্ন
            </span>
          )}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          আপনার ফোনে কোনো ভারী ফাইল ডাউনলোড ছাড়াই হুবহু আসল মোবাইল অ্যাপের মতো হোম স্ক্রিনে যোগ হবে। দ্রুত লোড হয়, অফলাইনেও জরুরি নম্বর দেখা যায় এবং কোনো মেমোরি নষ্ট হয় না।
        </p>

        {/* Feature Badges */}
        <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-border/60 bg-background/80 p-2.5">
            <Zap className="mx-auto h-4 w-4 text-amber-600" />
            <p className="mt-1 text-[11px] font-bold text-foreground">শূন্য মেমোরি খরচ</p>
            <p className="text-[10px] text-muted-foreground">তাত্ক্ষণিক চালু</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/80 p-2.5">
            <Wifi className="mx-auto h-4 w-4 text-emerald-600" />
            <p className="mt-1 text-[11px] font-bold text-foreground">অফলাইন সাপোর্ট</p>
            <p className="text-[10px] text-muted-foreground">ইন্টারনেট ছাড়াও চলবে</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/80 p-2.5">
            <Smartphone className="mx-auto h-4 w-4 text-primary" />
            <p className="mt-1 text-[11px] font-bold text-foreground">ফুলস্ক্রিন অ্যাপ</p>
            <p className="text-[10px] text-muted-foreground">হোম স্ক্রিন আইকন</p>
          </div>
        </div>

        {/* Action Button / iOS Guidance */}
        <div className="mt-5">
          {isInstalled ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/15 py-3.5 text-center text-sm font-bold text-emerald-800">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              স্মার্ট নোয়াখালী অ্যাপ আপনার ডিভাইসে সফলভাবে ইনস্টল করা আছে!
            </div>
          ) : isIOS ? (
            <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-950">
              <p className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <Apple className="h-4 w-4 text-slate-800" /> iPhone / iPad (iOS) এ ইনস্টল করার সহজ ৩টি নিয়ম:
              </p>
              <ol className="space-y-1.5 text-xs leading-relaxed text-amber-900">
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 font-bold text-amber-950">১</span>
                  <span>সাফারি ব্রাউজারের নিচের দিকে <strong>শেয়ার বোতাম</strong> (<Share className="inline h-3.5 w-3.5 mx-0.5" /> Share) চাপুন।</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 font-bold text-amber-950">২</span>
                  <span>মেনু স্ক্রল করে <strong>'Add to Home Screen'</strong> (<PlusSquare className="inline h-3.5 w-3.5 mx-0.5" /> হোম স্ক্রিনে যোগ করুন) চাপুন।</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 font-bold text-amber-950">৩</span>
                  <span>উপরে ডানপাশে <strong>'Add'</strong> (যোগ করুন) চাপলেই অ্যাপ ইনস্টল সম্পন্ন হবে!</span>
                </li>
              </ol>
            </div>
          ) : (
            <button
              type="button"
              disabled={installingPWA}
              onClick={() => void handlePWAInstall()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-hero py-4 text-sm font-extrabold text-white shadow-elevated transition hover:opacity-95 active:scale-[0.98] disabled:opacity-75 sm:text-base"
            >
              <Zap className="h-5 w-5 text-yellow-300" />
              {installingPWA ? "ইনস্টল হচ্ছে..." : "১-ক্লিকে অটো ওয়েব অ্যাপ ইনস্টল করুন"}
            </button>
          )}
        </div>
      </section>

      {/* NOTIFICATION SYSTEM CARD */}
      <section className="overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
            <BellRing className="h-6 w-6" />
          </div>
          <div>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              রিয়েল-টাইম নোটিফিকেশন
            </span>
            <h2 className="font-display text-base font-bold text-foreground sm:text-lg">
              জরুরী নোটিফিকেশন সিস্টেম
            </h2>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          নোয়াখালীতে কোনো জরুরী রক্তের প্রয়োজন হলে বা গুরুত্বপূর্ণ নাগরিক বিজ্ঞপ্তি প্রকাশিত হলে তাৎক্ষণিক আপনার ডিভাইসে নোটিফিকেশন পাঠানো হবে।
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-muted/40 p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">নোটিফিকেশন স্ট্যাটাস:</span>
            {permission === "granted" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                <Check className="h-3 w-3" /> সক্রিয় (চালু আছে)
              </span>
            ) : permission === "denied" ? (
              <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-[11px] font-bold text-destructive">
                ব্লক করা (ব্রাউজার সেটিংসে অনুমতি দিন)
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                অনুমতি প্রয়োজন
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {permission !== "granted" ? (
              <button
                type="button"
                onClick={() => void enableNotifications()}
                className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow transition hover:opacity-95"
              >
                <BellRing className="h-3.5 w-3.5 text-yellow-300" /> নোটিফিকেশন চালু করুন
              </button>
            ) : (
              <button
                type="button"
                onClick={sendTestNotification}
                className="flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-xs font-bold text-foreground border border-border transition hover:bg-muted/80"
              >
                <Volume2 className="h-3.5 w-3.5 text-primary" /> টেস্ট নোটিফিকেশন
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
