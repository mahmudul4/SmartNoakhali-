import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, Home } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "পৃষ্ঠাটি পাওয়া যায়নি (404) — স্মার্ট নোয়াখালী" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminNotFoundRoute,
});

function AdminNotFoundRoute() {
  return (
    <div className="flex min-h-[65vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-destructive/10 text-destructive">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h1 className="font-display text-2xl font-bold text-foreground">
        404 — পৃষ্ঠাটি পাওয়া যায়নি
      </h1>
      <p className="mt-2 max-w-sm text-xs text-muted-foreground leading-relaxed">
        এই ইউআরএলটি আর কার্যকর নেই অথবা সরানো হয়েছে।
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
        >
          <Home className="h-4 w-4" />
          <span>হোমপেজে ফিরে যান</span>
        </Link>
      </div>
    </div>
  );
}
