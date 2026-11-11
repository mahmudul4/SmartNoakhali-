import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Navigation, Building2, Phone, ExternalLink } from "lucide-react";
import { InteractiveNoakhaliMap } from "@/components/InteractiveNoakhaliMap";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "ইন্টারেক্টিভ নোয়াখালী জেলা ম্যাপ — স্মার্ট নোয়াখালী" },
      {
        name: "description",
        content:
          "নোয়াখালীর ৯টি উপজেলার ডিজিটাল ম্যাপ, গুরুত্বপূর্ণ হাসপাতাল, কলেজ, জরুরি সেবা ও প্রতিষ্ঠানের অবস্থান এবং নেভিগেশন।",
      },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  return (
    <div className="mx-auto w-full max-w-4xl overflow-x-hidden px-3.5 pb-24 pt-4 sm:px-4">
      {/* Interactive Map Component */}
      <InteractiveNoakhaliMap />

      {/* District Info Footer Card */}
      <div className="mt-6 rounded-3xl border border-border bg-card p-5 text-center shadow-xs">
        <h3 className="font-display text-sm font-bold text-foreground">
          নোয়াখালী জেলা এক নজরে
        </h3>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-xl mx-auto">
          ৯টি উপজেলা, ৯১টি ইউনিয়ন এবং ৮টি পৌরসভা নিয়ে গঠিত প্রাচীন ও ঐতিহ্যবাহী নোয়াখালী জেলা। আয়তন প্রায় ৩,৬৮৫ বর্গ কিমি।
        </p>
        <div className="mt-3 flex justify-center gap-2">
          <Link
            to="/directory"
            className="rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition"
          >
            সকল প্রতিষ্ঠানের ডিরেক্টরি দেখুন
          </Link>
          <Link
            to="/submit-info"
            className="rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition"
          >
            নতুন লোকেশন যোগ করুন
          </Link>
        </div>
      </div>
    </div>
  );
}
