import { useEffect } from "react";
import { Outlet, Link, createRootRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { BottomNav } from "@/components/BottomNav";
import { FloatingLiveChat } from "@/components/FloatingLiveChat";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { OfflineIndicator } from "@/lib/pwa";
import { useWebsiteContentConfig, type ThemeAccentPreset } from "@/lib/store";

const THEME_TOKEN_MAP: Record<Exclude<ThemeAccentPreset, "emerald">, Record<string, string>> = {
  teal: {
    "--primary": "#0F4D3A",
    "--primary-deep": "#0F4D3A",
    "--primary-glow": "#0F4D3A",
    "--ring": "#0F4D3A",
  },
  blue: {
    "--primary": "#0F4D3A",
    "--primary-deep": "#0F4D3A",
    "--primary-glow": "#0F4D3A",
    "--ring": "#0F4D3A",
  },
  gold: {
    "--primary": "#0F4D3A",
    "--primary-deep": "#0F4D3A",
    "--primary-glow": "#0F4D3A",
    "--ring": "#0F4D3A",
  },
};

function ThemeAndSeoSync() {
  const { contentConfig } = useWebsiteContentConfig();

  useEffect(() => {
    const rootStyle = document.documentElement.style;
    const keys = ["--primary", "--primary-deep", "--primary-glow", "--ring"];
    if (!contentConfig.themeAccent || contentConfig.themeAccent === "emerald") {
      for (const k of keys) rootStyle.removeProperty(k);
    } else {
      const tokens = THEME_TOKEN_MAP[contentConfig.themeAccent];
      if (tokens) {
        for (const [k, v] of Object.entries(tokens)) {
          rootStyle.setProperty(k, v);
        }
      }
    }
  }, [contentConfig.themeAccent]);

  useEffect(() => {
    if (contentConfig.seoDescription?.trim()) {
      const descEl = document.querySelector('meta[name="description"]');
      if (descEl) descEl.setAttribute("content", contentConfig.seoDescription.trim());
    }
  }, [contentConfig.seoDescription]);

  return null;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2] px-4">
      <div className="max-w-md rounded-[12px] border border-[#E6E1D6] bg-white p-6 text-center">
        <h1 className="font-display text-5xl font-bold text-[#0F4D3A]">৪০৪</h1>
        <h2 className="mt-3 font-display text-xl font-semibold text-[#1C1C1C]">পৃষ্ঠাটি পাওয়া যায়নি</h2>
        <p className="mt-2 text-sm text-[#5F5F5A]">
          আপনি যে পৃষ্ঠাটি খুঁজছেন তা সরানো হয়েছে অথবা বর্তমানে পাওয়া যাচ্ছে না।
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-[#0F4D3A] px-5 py-2 text-sm font-semibold text-white transition-colors hover:opacity-95"
          >
            হোম পেজে ফিরুন
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "স্মার্ট নোয়াখালী — Smart Noakhali" },
      { name: "description", content: "নোয়াখালীর সকল জরুরি সেবা, আইনজীবী, ডাক্তার, রক্তদাতা ও তথ্য এক জায়গায়।" },
      { name: "author", content: "Smart Noakhali" },
      { property: "og:title", content: "স্মার্ট নোয়াখালী — Smart Noakhali" },
      { property: "og:description", content: "নোয়াখালীর সকল জরুরি সেবা, আইনজীবী, ডাক্তার, রক্তদাতা ও তথ্য এক জায়গায়।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "স্মার্ট নোয়াখালী — Smart Noakhali" },
      { name: "twitter:description", content: "নোয়াখালীর সকল জরুরি সেবা, আইনজীবী, ডাক্তার, রক্তদাতা ও তথ্য এক জায়গায়।" },
    ],
    links: [
      { rel: "canonical", href: "https://smartnoakhali.com" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  return (
    <AuthProvider>
      <ThemeAndSeoSync />
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#FAF7F2]">
        <OfflineIndicator />
        <SiteHeader />
        <main
          id="main-content"
          tabIndex={-1}
          className="w-full max-w-[100vw] overflow-x-hidden pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-8 outline-none"
        >
          <Outlet />
        </main>
        <BottomNav />
        <FloatingLiveChat />
        <Toaster position="top-center" richColors />
      </div>
    </AuthProvider>
  );
}
