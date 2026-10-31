import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  Phone,
  Droplet,
  Send,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Layers,
  Sparkles,
} from "lucide-react";
import { useCategories, useDivisions } from "@/lib/store";
import { BannerPopup } from "@/components/BannerPopup";
import { MobileSearch } from "@/components/SiteHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Smart Noakhali — নোয়াখালীর ডিজিটাল সেবা ও ডিরেক্টরি" },
      {
        name: "description",
        content:
          "২২টি প্রধান বিভাগ ও নোয়াখালীর সকল জরুরি সেবা, ডাক্তার, রক্তদাতা, পুলিশ, আইনজীবী ও নাগরিক তথ্য এক ক্লিকে।",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [query, setQuery] = useState("");
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>("all");
  const { categories } = useCategories();
  const { divisions } = useDivisions();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Horizontal scroll helpers
  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === "left" ? -240 : 240;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  // Filter categories based on division and search query
  const filtered = categories.filter((c) => {
    if (c.slug === "chat" || c.slug === "app-download") return false;

    // Search query filter
    const searchTarget = `${c.bn} ${c.en} ${c.description} ${c.divisionId}`.toLowerCase();
    const matchesQuery = !query.trim() || searchTarget.includes(query.toLowerCase());

    // Division filter
    const matchesDivision =
      selectedDivisionId === "all" || c.divisionId === selectedDivisionId;

    return matchesQuery && matchesDivision;
  });

  const activeDivision =
    selectedDivisionId === "all"
      ? null
      : divisions.find((d) => d.id === selectedDivisionId);

  return (
    <div className="mx-auto w-full max-w-3xl overflow-x-hidden px-3.5 pb-28 pt-4 sm:px-4">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-elevated">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/25 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-primary-glow/30 blur-3xl pointer-events-none" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur">
            <Droplet className="h-3 w-3 text-gold" /> নোয়াখালীর ডিজিটাল সিটিজেন প্ল্যাটফর্ম
          </span>
          <h1 className="mt-3 font-display text-2xl font-extrabold leading-tight sm:text-3xl">
            এক ক্লিকে নোয়াখালীর<br />সকল সেবা ও যোগাযোগ
          </h1>
          <p className="mt-2 text-xs opacity-90 sm:text-sm">
            ২২টি বিভাগ • রক্তদাতা • ডাক্তার • আইনি সহায়তা • চাকরি • পরিবহন ও জরুরি হেল্পলাইন
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="tel:999"
              className="flex items-center gap-2 rounded-full bg-gradient-gold px-4 py-2 text-xs font-bold text-primary-deep shadow-gold active:scale-95 transition"
            >
              <Phone className="h-3.5 w-3.5" /> জরুরী 999
            </a>
            <Link
              to="/submit-info"
              className="flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-bold backdrop-blur active:scale-95 transition hover:bg-white/20"
            >
              <Send className="h-3.5 w-3.5" /> নতুন তথ্য দিন
            </Link>
          </div>
        </div>
      </section>

      {/* Global Search Bar */}
      <div className="mt-4">
        <MobileSearch
          value={query}
          onChange={setQuery}
          placeholder="ডাক্তার, পুলিশ, আইনজীবী বা সেবা খুঁজুন..."
        />
      </div>

      {/* Quick Action Buttons */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <QuickLink to="/emergency-request" label="জরুরী রক্ত" tone="red" />
        <QuickLink to="/blood-donor" label="রক্তদাতা" tone="rose" />
        <QuickLink to="/donation" label="অনুদান তহবিল" tone="emerald" />
      </div>

      {/* 22 Major Divisions Horizontal Swipe & Scroll Section */}
      <div className="mt-6 mb-2">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-sm font-bold text-primary-deep sm:text-base">
              ২২টি প্রধান বিভাগ
            </h2>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              {divisions.length} টি বিভাগ
            </span>
          </div>

          {/* Desktop Left/Right Scroll Arrows */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label="Scroll left"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label="Scroll right"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Horizontal Scroll Bar */}
        <div
          ref={scrollContainerRef}
          className="flex items-center gap-2 overflow-x-auto py-1.5 scrollbar-none scroll-smooth -mx-3.5 px-3.5 sm:-mx-0 sm:px-0"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* 'All' Division Button */}
          <button
            type="button"
            onClick={() => setSelectedDivisionId("all")}
            className={`flex shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold transition-all duration-200 active:scale-95 ${
              selectedDivisionId === "all"
                ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/40 scale-102"
                : "border border-border/80 bg-card text-foreground hover:bg-muted/60"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>সকল সেবা</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                selectedDivisionId === "all"
                  ? "bg-white/20 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {categories.length}
            </span>
          </button>

          {/* 22 Individual Division Pills */}
          {divisions.map((div) => {
            const isSelected = selectedDivisionId === div.id;
            const Icon = div.icon;
            const divCategoryCount = categories.filter((c) => c.divisionId === div.id).length;

            return (
              <button
                key={div.id}
                type="button"
                onClick={() => setSelectedDivisionId(div.id)}
                className={`flex shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold transition-all duration-200 active:scale-95 ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/40 scale-102"
                    : "border border-border/80 bg-card text-foreground hover:bg-muted/60"
                }`}
              >
                {div.customIconUrl ? (
                  <img
                    src={div.customIconUrl}
                    alt={div.bn}
                    className="h-4 w-4 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="whitespace-nowrap">{div.bn}</span>
                {divCategoryCount > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[9.5px] font-mono ${
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {divCategoryCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Division Header Banner (if a specific division is active) */}
      {activeDivision && (
        <div className="mt-2 mb-3 flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 border border-border/60">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary">{activeDivision.bn}:</span>
            <span className="text-[11px] text-muted-foreground line-clamp-1">
              {activeDivision.description}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDivisionId("all")}
            className="text-[11px] font-bold text-primary hover:underline shrink-0"
          >
            সকল বিভাগ দেখুন
          </button>
        </div>
      )}

      {/* Categories Grid Header */}
      <div className="mt-4 mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold text-foreground">
          {selectedDivisionId === "all" ? "ক্যাটাগরি তালিকা" : `${activeDivision?.bn} ক্যাটাগরি`}
        </h3>
        <span className="text-xs text-muted-foreground">{filtered.length} টি প্রাপ্ত</span>
      </div>

      {/* Categories Cards Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-xs text-muted-foreground">
            এই অনুসন্ধানে কোনো ক্যাটাগরি পাওয়া যায়নি।
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSelectedDivisionId("all");
            }}
            className="mt-2 text-xs font-bold text-primary hover:underline"
          >
            ফিল্টার রিসেট করুন
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {filtered.map((c) => {
            const Icon = c.icon;
            const inner = (
              <div className="group relative flex h-full w-full min-w-0 flex-col items-center justify-center rounded-2xl border border-border/80 bg-card p-2.5 text-center shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated active:scale-95 sm:p-3.5">
                <div
                  className={`mb-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${c.tint} text-primary-deep shadow-xs sm:h-11 sm:w-11 overflow-hidden`}
                >
                  {c.customIconUrl ? (
                    <img
                      src={c.customIconUrl}
                      alt={c.bn}
                      className="h-full w-full object-cover rounded-xl"
                    />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
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

            // Special dedicated routes
            if (c.slug === "submit-info")
              return (
                <Link key={c.slug} to="/submit-info" className="min-w-0 flex flex-col">
                  {inner}
                </Link>
              );
            if (c.slug === "about")
              return (
                <Link key={c.slug} to="/about" className="min-w-0 flex flex-col">
                  {inner}
                </Link>
              );
            if (c.slug === "board-result")
              return (
                <Link key={c.slug} to="/board-result" className="min-w-0 flex flex-col">
                  {inner}
                </Link>
              );
            if (c.slug === "donation")
              return (
                <Link key={c.slug} to="/donation" className="min-w-0 flex flex-col">
                  {inner}
                </Link>
              );
            if (c.slug === "blood-donor")
              return (
                <Link key={c.slug} to="/blood-donor" className="min-w-0 flex flex-col">
                  {inner}
                </Link>
              );
            if (c.slug === "emergency-request")
              return (
                <Link key={c.slug} to="/emergency-request" className="min-w-0 flex flex-col">
                  {inner}
                </Link>
              );

            // Dynamic category page
            return (
              <Link
                key={c.slug}
                to="/category/$slug"
                params={{ slug: c.slug }}
                className="min-w-0 flex flex-col"
              >
                {inner}
              </Link>
            );
          })}
        </div>
      )}

      {/* App Download Footer Callout */}
      <div className="mt-8 flex flex-col items-center gap-2 text-center">
        <Link
          to="/app-download"
          className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-primary transition hover:text-primary-deep hover:underline"
        >
          <Smartphone className="h-3.5 w-3.5 shrink-0" />
          <span>Android / iOS অ্যাপ ও PWA ডাউনলোড করুন</span>
        </Link>
        <p className="text-[11px] text-muted-foreground">
          © স্মার্ট নোয়াখালী • নোয়াখালীর ডিজিটাল সিটিজেন সেবা ডিরেক্টরি
        </p>
      </div>

      <BannerPopup />
    </div>
  );
}

function QuickLink({
  to,
  label,
  tone,
}: {
  to: "/blood-donor" | "/donation" | "/emergency-request";
  label: string;
  tone: "rose" | "red" | "emerald";
}) {
  const tones = {
    rose: "from-rose-500/15 to-rose-600/5 text-rose-700",
    red: "from-red-500/15 to-red-600/5 text-red-700",
    emerald: "from-emerald-500/15 to-emerald-700/5 text-emerald-800",
  };
  return (
    <Link
      to={to}
      className={`flex min-w-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tones[tone]} px-2 py-3 text-center text-xs font-bold shadow-card active:scale-95 transition`}
    >
      <span className="truncate">{label}</span>
    </Link>
  );
}
