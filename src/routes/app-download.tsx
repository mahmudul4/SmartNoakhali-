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
    <div className="w-full px-3.5 pb-28 pt-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
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
      <div className="mb-5 overflow-hidden rounded-[12px] border border-[#0B3C2D] bg-[#0F4D3A] p-5 text-white sm:p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white p-1.5">
            <img
              src={logo}
              alt="Smart Noakhali Logo"
              className="h-full w-full rounded-full object-contain"
            />
          </div>
          <div className="flex-1">
            <span className="inline-flex items-center gap-1 rounded-[8px] bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white">
              <Sparkles className="h-3 w-3" strokeWidth={1.5} /> অফিসিয়াল প্রোগ্রেসিভ ওয়েব অ্যাপ (PWA)
            </span>
            <h1 className="mt-1.5 font-display text-2xl font-bold">
              স্মার্ট নোয়াখালী ইনস্টল
            </h1>
            <p className="mt-1 text-xs text-white/90 sm:text-sm">
              কোনো বাড়তি মেমোরি খরচ ছাড়া যে কোনো ডিভাইসে (Android, iOS, PC) ১-ক্লিকে ইনস্টল করুন এবং নোটিফিকেশন চালু রাখুন।
            </p>
          </div>
        </div>
      </div>

      {/* 1-Click PWA Web App Install Card */}
      <section className="mb-5 overflow-hidden rounded-[12px] border border-[#E6E1D6] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#0F4D3A] text-white">
              <Zap className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-[6px] bg-[#0F4D3A]/10 px-2 py-0.5 text-[10px] font-bold text-[#0F4D3A]">
                  অফলাইন সাপোর্টেড PWA
                </span>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-[#5F5F5A]">
                  <Globe className="h-3 w-3 text-[#0F4D3A]" strokeWidth={1.5} /> সব ডিভাইসে চলবে
                </span>
              </div>
              <h2 className="font-display text-lg font-bold text-[#1C1C1C] sm:text-xl">
                ১-ক্লিকে অটো ওয়েব অ্যাপ ইনস্টল (PWA)
              </h2>
            </div>
          </div>

          {isInstalled && (
            <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-[#0F4D3A] px-3 py-1 text-xs font-bold text-white">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} /> ইনস্টল সম্পন্ন
            </span>
          )}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-[#5F5F5A] sm:text-sm">
          আপনার ফোনে কোনো ভারী ফাইল ডাউনলোড ছাড়াই হুবহু আসল মোবাইল অ্যাপের মতো হোম স্ক্রিনে যোগ হবে। দ্রুত লোড হয়, অফলাইনেও জরুরি নম্বর দেখা যায় এবং কোনো মেমোরি নষ্ট হয় না।
        </p>

        {/* Feature Badges */}
        <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] p-2.5">
            <Zap className="mx-auto h-4 w-4 text-[#0F4D3A]" strokeWidth={1.5} />
            <p className="mt-1 text-[11px] font-bold text-[#1C1C1C]">শূন্য মেমোরি খরচ</p>
            <p className="text-[10px] text-[#5F5F5A]">তাত্ক্ষণিক চালু</p>
          </div>
          <div className="rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] p-2.5">
            <Wifi className="mx-auto h-4 w-4 text-[#0F4D3A]" strokeWidth={1.5} />
            <p className="mt-1 text-[11px] font-bold text-[#1C1C1C]">অফলাইন সাপোর্ট</p>
            <p className="text-[10px] text-[#5F5F5A]">ইন্টারনেট ছাড়াও চলবে</p>
          </div>
          <div className="rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] p-2.5">
            <Smartphone className="mx-auto h-4 w-4 text-[#0F4D3A]" strokeWidth={1.5} />
            <p className="mt-1 text-[11px] font-bold text-[#1C1C1C]">ফুলস্ক্রিন অ্যাপ</p>
            <p className="text-[10px] text-[#5F5F5A]">হোম স্ক্রিন আইকন</p>
          </div>
        </div>

        {/* Action Button / iOS Guidance */}
        <div className="mt-5">
          {isInstalled ? (
            <div className="flex items-center justify-center gap-2 rounded-[10px] border border-[#0F4D3A]/20 bg-[#0F4D3A]/10 py-3.5 text-center text-sm font-bold text-[#0F4D3A]">
              <CheckCircle2 className="h-5 w-5" strokeWidth={1.5} />
              স্মার্ট নোয়াখালী অ্যাপ আপনার ডিভাইসে সফলভাবে ইনস্টল করা আছে!
            </div>
          ) : isIOS ? (
            <div className="space-y-3 rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] p-4 text-[#1C1C1C]">
              <p className="flex items-center gap-1.5 text-xs font-bold text-[#1C1C1C]">
                <Apple className="h-4 w-4 text-[#1C1C1C]" strokeWidth={1.5} /> iPhone / iPad (iOS) এ ইনস্টল করার সহজ ৩টি নিয়ম:
              </p>
              <ol className="space-y-1.5 text-xs leading-relaxed text-[#5F5F5A]">
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0F4D3A] font-bold text-white">১</span>
                  <span>সাফারি ব্রাউজারের নিচের দিকে <strong>শেয়ার বোতাম</strong> (<Share className="inline h-3.5 w-3.5 mx-0.5" /> Share) চাপুন।</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0F4D3A] font-bold text-white">২</span>
                  <span>মেনু স্ক্রল করে <strong>'Add to Home Screen'</strong> (<PlusSquare className="inline h-3.5 w-3.5 mx-0.5" /> হোম স্ক্রিনে যোগ করুন) চাপুন।</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0F4D3A] font-bold text-white">৩</span>
                  <span>উপরে ডানপাশে <strong>'Add'</strong> (যোগ করুন) চাপলেই অ্যাপ ইনস্টল সম্পন্ন হবে!</span>
                </li>
              </ol>
            </div>
          ) : (
            <button
              type="button"
              disabled={installingPWA}
              onClick={() => void handlePWAInstall()}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#0F4D3A] py-3.5 text-sm font-bold text-white transition hover:bg-[#0B3C2D] active:scale-[0.98] disabled:opacity-75 sm:text-base"
            >
              <Zap className="h-5 w-5" strokeWidth={1.5} />
              {installingPWA ? "ইনস্টল হচ্ছে..." : "১-ক্লিকে অটো ওয়েব অ্যাপ ইনস্টল করুন"}
            </button>
          )}
        </div>
      </section>

      {/* NOTIFICATION SYSTEM CARD */}
      <section className="overflow-hidden rounded-[12px] border border-[#E6E1D6] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-[#0F4D3A]/10 text-[#0F4D3A]">
            <BellRing className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <div>
            <span className="rounded-[6px] bg-[#0F4D3A]/10 px-2 py-0.5 text-[10px] font-bold text-[#0F4D3A]">
              রিয়েল-টাইম নোটিফিকেশন
            </span>
            <h2 className="font-display text-base font-bold text-[#1C1C1C] sm:text-lg">
              জরুরি নোটিফিকেশন সিস্টেম
            </h2>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-[#5F5F5A] sm:text-sm">
          নোয়াখালীতে কোনো জরুরি রক্তের প্রয়োজন হলে বা গুরুত্বপূর্ণ নাগরিক বিজ্ঞপ্তি প্রকাশিত হলে তাৎক্ষণিক আপনার ডিভাইসে নোটিফিকেশন পাঠানো হবে।
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#1C1C1C]">নোটিফিকেশন স্ট্যাটাস:</span>
            {permission === "granted" ? (
              <span className="inline-flex items-center gap-1 rounded-[8px] bg-[#0F4D3A]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#0F4D3A]">
                <Check className="h-3 w-3" strokeWidth={1.5} /> সক্রিয় (চালু আছে)
              </span>
            ) : permission === "denied" ? (
              <span className="rounded-[8px] bg-[#C62828]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#C62828]">
                ব্লক করা (ব্রাউজার সেটিংসে অনুমতি দিন)
              </span>
            ) : (
              <span className="rounded-[8px] border border-[#E6E1D6] bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#5F5F5A]">
                অনুমতি প্রয়োজন
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {permission !== "granted" ? (
              <button
                type="button"
                onClick={() => void enableNotifications()}
                className="flex min-h-[44px] items-center gap-1.5 rounded-[10px] bg-[#0F4D3A] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0B3C2D]"
              >
                <BellRing className="h-3.5 w-3.5" strokeWidth={1.5} /> নোটিফিকেশন চালু করুন
              </button>
            ) : (
              <button
                type="button"
                onClick={sendTestNotification}
                className="flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-[#E6E1D6] bg-white px-4 py-2 text-xs font-bold text-[#1C1C1C] transition hover:bg-[#FAF7F2]"
              >
                <Volume2 className="h-3.5 w-3.5 text-[#0F4D3A]" strokeWidth={1.5} /> টেস্ট নোটিফিকেশন
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
