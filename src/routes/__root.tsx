import { useEffect } from "react";
import { Outlet, Link, createRootRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { FloatingLiveChat } from "@/components/FloatingLiveChat";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { OfflineIndicator } from "@/lib/pwa";
import { useWebsiteContentConfig, type ThemeAccentPreset } from "@/lib/store";

const THEME_TOKEN_MAP: Record<Exclude<ThemeAccentPreset, "emerald">, Record<string, string>> = {
  teal: {
    "--primary": "oklch(0.39 0.085 182)",
    "--primary-deep": "oklch(0.28 0.065 182)",
    "--primary-glow": "oklch(0.55 0.115 182)",
    "--ring": "oklch(0.55 0.115 182)",
    "--gradient-hero":
      "linear-gradient(135deg, oklch(0.28 0.065 182) 0%, oklch(0.39 0.085 182) 60%, oklch(0.55 0.115 182) 100%)",
  },
  blue: {
    "--primary": "oklch(0.41 0.11 245)",
    "--primary-deep": "oklch(0.29 0.09 245)",
    "--primary-glow": "oklch(0.58 0.14 245)",
    "--ring": "oklch(0.58 0.14 245)",
    "--gradient-hero":
      "linear-gradient(135deg, oklch(0.29 0.09 245) 0%, oklch(0.41 0.11 245) 60%, oklch(0.58 0.14 245) 100%)",
  },
  gold: {
    "--primary": "oklch(0.38 0.085 152)",
    "--primary-deep": "oklch(0.26 0.065 152)",
    "--primary-glow": "oklch(0.68 0.14 82)",
    "--ring": "oklch(0.68 0.14 82)",
    "--gradient-hero":
      "linear-gradient(135deg, oklch(0.24 0.06 155) 0%, oklch(0.36 0.085 155) 55%, oklch(0.65 0.14 82) 100%)",
  },
};

function ThemeAndSeoSync() {
  const { contentConfig } = useWebsiteContentConfig();

  useEffect(() => {
    const rootStyle = document.documentElement.style;
    const keys = ["--primary", "--primary-deep", "--primary-glow", "--ring", "--gradient-hero"];
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
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
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" },
      { title: "Smart Noakhali — স্মার্ট নোয়াখালী" },
      { name: "description", content: "নোয়াখালীর সকল জরুরী সেবা, আইনজীবী, ডাক্তার, রক্তদাতা ও তথ্য এক জায়গায়।" },
      { name: "author", content: "Smart Noakhali" },
      { property: "og:title", content: "Smart Noakhali — স্মার্ট নোয়াখালী" },
      { property: "og:description", content: "নোয়াখালীর সকল জরুরী সেবা, আইনজীবী, ডাক্তার, রক্তদাতা ও তথ্য এক জায়গায়।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Smart Noakhali — স্মার্ট নোয়াখালী" },
      { name: "twitter:description", content: "নোয়াখালীর সকল জরুরী সেবা, আইনজীবী, ডাক্তার, রক্তদাতা ও তথ্য এক জায়গায়।" },
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
      <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-background">
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="w-full max-w-[100vw] overflow-x-hidden outline-none">
          <Outlet />
        </main>
        <OfflineIndicator />
        <FloatingLiveChat />
        <Toaster position="top-center" richColors />
      </div>
    </AuthProvider>
  );
}
