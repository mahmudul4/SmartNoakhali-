import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Phone, Droplet, Send, ChevronRight, Smartphone } from "lucide-react";
import { useCategories } from "@/lib/store";
import { BannerPopup } from "@/components/BannerPopup";
import { MobileSearch } from "@/components/SiteHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Noakhali — নোয়াখালীর ডিজিটাল সেবা ডিরেক্টরি" },
      { name: "description", content: "জনপ্রতিনিধি, পুলিশ, ডাক্তার, রক্তদাতা সহ নোয়াখালীর সকল জরুরী যোগাযোগ এক অ্যাপে।" },
    ],
  }),
  component: Index,
});

function Index() {
  const [query, setQuery] = useState("");
  const { categories } = useCategories();
  const filtered = categories.filter(
    (c) =>
      c.slug !== "chat" &&
      c.slug !== "app-download" &&
      `${c.bn} ${c.en} ${c.description}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="mx-auto w-full max-w-3xl overflow-x-hidden px-4 pb-28 pt-4">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-elevated">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/25 blur-3xl" />
        <div className="absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-primary-glow/30 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur">
            <Droplet className="h-3 w-3 text-gold" /> নোয়াখালীর ডিজিটাল সেবা
          </span>
          <h1 className="mt-3 font-display text-2xl font-extrabold leading-tight">
            এক ক্লিকে সকল<br />জরুরী যোগাযোগ
          </h1>
          <p className="mt-2 text-sm opacity-90">
            জনপ্রতিনিধি • ডাক্তার • রক্তদাতা • পুলিশ • ফায়ার সার্ভিস সহ আরও অনেক কিছু
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="tel:999" className="flex items-center gap-2 rounded-full bg-gradient-gold px-4 py-2 text-xs font-bold text-primary-deep shadow-gold">
              <Phone className="h-3.5 w-3.5" /> জরুরী 999
            </a>
            <Link to="/submit-info" className="flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-bold backdrop-blur">
              <Send className="h-3.5 w-3.5" /> তথ্য দিন
            </Link>
          </div>
        </div>
      </section>

      {/* Search */}
      <div className="mt-4">
        <MobileSearch value={query} onChange={setQuery} placeholder="ক্যাটাগরি খুঁজুন..." />
      </div>

      {/* Quick actions */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <QuickLink to="/emergency-request" label="জরুরী রক্ত" tone="red" />
        <QuickLink to="/blood-donor" label="রক্তদাতা" tone="rose" />
        <QuickLink to="/donation" label="অনুদান" tone="emerald" />
      </div>

      {/* Categories */}
      <div className="mt-6 mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-primary-deep">সকল ক্যাটাগরি</h2>
        <span className="text-xs text-muted-foreground">{filtered.length} টি</span>
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {filtered.map((c) => {
          const Icon = c.icon;
          const inner = (
            <div className="group relative flex h-full w-full min-w-0 flex-col items-center justify-center rounded-2xl border border-border/80 bg-card p-2.5 text-center shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated active:scale-95 sm:p-3.5">
              <div className={`mb-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${c.tint} text-primary-deep shadow-xs sm:h-11 sm:w-11`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="line-clamp-2 w-full text-center font-display text-[12px] font-bold leading-tight text-foreground sm:text-[13px] break-words">
                {c.bn}
              </p>
              {c.description && (
                <p className="mt-1 hidden w-full line-clamp-1 text-[10.5px] text-muted-foreground sm:block">
                  {c.description}
                </p>
              )}
            </div>
          );
          if (c.slug === "submit-info") return <Link key={c.slug} to="/submit-info" className="min-w-0 flex flex-col">{inner}</Link>;
          if (c.slug === "about") return <Link key={c.slug} to="/about" className="min-w-0 flex flex-col">{inner}</Link>;
          if (c.slug === "board-result") return <Link key={c.slug} to="/board-result" className="min-w-0 flex flex-col">{inner}</Link>;
          if (c.slug === "donation") return <Link key={c.slug} to="/donation" className="min-w-0 flex flex-col">{inner}</Link>;
          if (c.slug === "blood-donor") return <Link key={c.slug} to="/blood-donor" className="min-w-0 flex flex-col">{inner}</Link>;
          return (
            <Link key={c.slug} to="/category/$slug" params={{ slug: c.slug }} className="min-w-0 flex flex-col">{inner}</Link>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col items-center gap-2 text-center">
        <Link
          to="/app-download"
          className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-primary transition hover:text-primary-deep hover:underline"
        >
          <Smartphone className="h-3.5 w-3.5 shrink-0" />
          <span>Android / iOS অ্যাপ ডাউনলোড করুন</span>
        </Link>
        <p className="text-[11px] text-muted-foreground">
          © স্মার্ট নোয়াখালী • সকল অধিকার সংরক্ষিত
        </p>
      </div>

      <BannerPopup />
    </div>
  );
}

function QuickLink({ to, label, tone }: { to: "/blood-donor" | "/donation" | "/emergency-request"; label: string; tone: "rose" | "red" | "emerald" }) {
  const tones = {
    rose: "from-rose-500/15 to-rose-600/5 text-rose-700",
    red: "from-red-500/15 to-red-600/5 text-red-700",
    emerald: "from-emerald-500/15 to-emerald-700/5 text-emerald-800",
  };
  return (
    <Link to={to} className={`flex min-w-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tones[tone]} px-2 py-3 text-center text-xs font-bold shadow-card`}>
      <span className="truncate">{label}</span>
    </Link>
  );
}
