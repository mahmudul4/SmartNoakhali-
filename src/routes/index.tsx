import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef } from "react";
import {
  Phone,
  Droplet,
  Send,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  MapPin,
  Building2,
  Briefcase,
  AlertTriangle,
  HandCoins,
  ShieldAlert,
} from "lucide-react";
import { useCategories, useDivisions, useHeroBannerConfig } from "@/lib/store";
import type { Category, Division } from "@/data/categories";
import { BannerPopup } from "@/components/BannerPopup";
import { EmergencyBanner } from "@/components/EmergencyBanner";
import { ServiceCategoryCard } from "@/components/ServiceCategoryCard";

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

function HeroActionLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  const cleanHref = (href || "").trim();
  if (cleanHref.startsWith("/")) {
    return (
      <Link to={cleanHref as "/"} className={className}>
        {children}
      </Link>
    );
  }
  const isExternalHttp = /^https?:\/\//i.test(cleanHref);
  return (
    <a
      href={cleanHref || "#"}
      {...(isExternalHttp ? { target: "_blank", rel: "noreferrer" } : {})}
      className={className}
    >
      {children}
    </a>
  );
}

function Index() {
  const { categories } = useCategories();
  const { divisions } = useDivisions();
  const { banner } = useHeroBannerConfig();

  // Preserve all visible service categories across all 22 divisions
  const filteredCategories = useMemo(() => {
    return categories.filter(
      (c) => c.slug !== "chat" && c.slug !== "app-download" && c.visible !== false
    );
  }, [categories]);

  // Group all categories strictly into the 22 main divisions vertically
  const divisionSections = useMemo(() => {
    const visibleDivisionIds = new Set(divisions.map((d) => d.id));
    const bucket = new Map<string, Category[]>();
    for (const d of divisions) {
      bucket.set(d.id, []);
    }

    const fallbackDivisionId =
      divisions.find((d) => d.id === "other_services")?.id ??
      divisions[divisions.length - 1]?.id;

    for (const cat of filteredCategories) {
      if (visibleDivisionIds.has(cat.divisionId)) {
        bucket.get(cat.divisionId)?.push(cat);
      } else if (fallbackDivisionId) {
        bucket.get(fallbackDivisionId)?.push(cat);
      }
    }

    return divisions
      .map((div) => ({
        division: div,
        items: (bucket.get(div.id) ?? []).sort(
          (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
        ),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [divisions, filteredCategories]);

  const desktopHeroImg = banner.desktopImageUrl || banner.mobileImageUrl;
  const mobileHeroImg = banner.mobileImageUrl || banner.desktopImageUrl;
  const hasHeroImage = banner.backgroundMode === "image" && Boolean(desktopHeroImg || mobileHeroImg);

  return (
    <div className="mx-auto w-full max-w-3xl overflow-x-hidden px-3.5 pb-28 pt-3 sm:px-4 sm:pt-4">
      {/* Dynamic Premium Hero Banner (Controlled by Main Admin) */}
      {banner.visible !== false && (
        <section
          className={`relative overflow-hidden border border-emerald-300/20 p-5 shadow-[0_18px_40px_-14px_rgba(7,54,34,0.45)] sm:p-7 ${
            banner.borderRadius || "rounded-[26px]"
          }`}
          style={{
            background:
              banner.backgroundMode === "solid"
                ? banner.solidColor
                : `linear-gradient(135deg, ${banner.gradientFrom} 0%, ${banner.gradientVia} 50%, ${banner.gradientTo} 100%)`,
            color: banner.textColor || "#ffffff",
          }}
        >
          {/* Uploaded Desktop / Mobile Hero Image Layers + Contrast Scrim */}
          {hasHeroImage && (
            <>
              {mobileHeroImg && (
                <img
                  src={mobileHeroImg}
                  alt={banner.headingLine1 || "Smart Noakhali"}
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover md:hidden"
                  style={{ objectPosition: banner.imagePositionMobile || "center center" }}
                />
              )}
              {desktopHeroImg && (
                <img
                  src={desktopHeroImg}
                  alt={banner.headingLine1 || "Smart Noakhali"}
                  className="pointer-events-none absolute inset-0 hidden h-full w-full object-cover md:block"
                  style={{ objectPosition: banner.imagePositionDesktop || "center center" }}
                />
              )}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundColor: banner.overlayColor || "#042316",
                  opacity: Math.min(90, Math.max(0, banner.overlayOpacity ?? 55)) / 100,
                }}
              />
            </>
          )}

          {/* Subtle depth lighting & architectural glow */}
          {banner.showDecorativeGlow !== false && (
            <>
              <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-14 -left-10 h-44 w-44 rounded-full bg-emerald-300/20 blur-3xl" />
              <div className="pointer-events-none inset-x-0 top-0 absolute h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            </>
          )}

          <div className="relative">
            {banner.badgeText.trim() && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/12 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-50 backdrop-blur-sm">
                <Droplet className="h-3 w-3 text-amber-300" /> {banner.badgeText}
              </span>
            )}

            <h1
              className="mt-3.5 font-bangla text-[24px] font-extrabold leading-[1.24] tracking-tight drop-shadow-xs sm:text-[32px]"
              style={{ color: banner.textColor || "#ffffff" }}
            >
              {banner.headingLine1}
              {banner.headingLine2 && (
                <>
                  <br />
                  {banner.headingLine2}
                </>
              )}
            </h1>

            {banner.description.trim() && (
              <p
                className="mt-2.5 max-w-xl text-[12.5px] leading-relaxed sm:text-sm"
                style={{ color: banner.subtextColor || "#ecfdf5", opacity: 0.92 }}
              >
                {banner.description}
              </p>
            )}

            {(banner.primaryButtonText.trim() || banner.secondaryButtonText.trim()) && (
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                {banner.primaryButtonText.trim() && (
                  <HeroActionLink
                    href={banner.primaryButtonLink || "tel:999"}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-gradient-gold px-5 py-2.5 text-xs font-extrabold text-primary-deep shadow-gold transition hover:brightness-105 active:scale-95 sm:text-[13px]"
                  >
                    <Phone className="h-3.5 w-3.5" /> {banner.primaryButtonText}
                  </HeroActionLink>
                )}
                {banner.secondaryButtonText.trim() && (
                  <HeroActionLink
                    href={banner.secondaryButtonLink || "/submit-info"}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4.5 py-2.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95 sm:text-[13px]"
                  >
                    <Send className="h-3.5 w-3.5" /> {banner.secondaryButtonText}
                  </HeroActionLink>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Three Prominent Quick-Action Pill Buttons */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <QuickLink
          to="/emergency-request"
          label="জরুরী রক্ত"
          tone="red"
          icon={<ShieldAlert className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />}
        />
        <QuickLink
          to="/blood-donor"
          label="রক্তদাতা"
          tone="rose"
          icon={<Droplet className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />}
        />
        <QuickLink
          to="/donation"
          label="অনুদান তহবিল"
          tone="emerald"
          icon={<HandCoins className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />}
        />
      </div>

      {/* Featured District Service Shortcuts */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Link
          to="/map"
          className="group flex min-w-0 items-center gap-2.5 rounded-2xl border border-border/80 bg-card p-2.5 shadow-card transition hover:border-primary/40 hover:bg-muted/40 active:scale-95"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MapPin className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-xs font-bold text-foreground">
              নোয়াখালী ম্যাপ
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              ৯ উপজেলা ও দূরত্ব
            </p>
          </div>
        </Link>

        <Link
          to="/directory"
          className="group flex min-w-0 items-center gap-2.5 rounded-2xl border border-border/80 bg-card p-2.5 shadow-card transition hover:border-primary/40 hover:bg-muted/40 active:scale-95"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-xs font-bold text-foreground">
              ডিরেক্টরি
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              প্রতিষ্ঠান ও ব্যবসা
            </p>
          </div>
        </Link>

        <Link
          to="/career"
          className="group flex min-w-0 items-center gap-2.5 rounded-2xl border border-border/80 bg-card p-2.5 shadow-card transition hover:border-primary/40 hover:bg-muted/40 active:scale-95"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <Briefcase className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-xs font-bold text-foreground">
              শিক্ষা ও ক্যারিয়ার
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              চাকরি ও প্রতিষ্ঠান
            </p>
          </div>
        </Link>

        <Link
          to="/complaint-tracking"
          className="group flex min-w-0 items-center gap-2.5 rounded-2xl border border-border/80 bg-card p-2.5 shadow-card transition hover:border-primary/40 hover:bg-muted/40 active:scale-95"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-xs font-bold text-foreground">
              অভিযোগ ট্র্যাকিং
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              লাইভ অগ্রগতি
            </p>
          </div>
        </Link>
      </div>

      {/* Live Emergency Alert Banner */}
      <EmergencyBanner />

      {/* ALL 22 MAIN SECTIONS — Vertically Stacked, Each with 2-Row Horizontal Scroll */}
      <div className="mt-6 space-y-6">
        {divisionSections.map(({ division, items }, index) => (
          <DivisionHorizontalSection
            key={division.id}
            division={division}
            items={items}
            index={index}
          />
        ))}
      </div>

      {/* App Download Footer Callout */}
      <footer className="mt-9 flex flex-col items-center gap-2 border-t border-border/60 pt-6 text-center">
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
      </footer>

      <BannerPopup />
    </div>
  );
}

function DivisionHorizontalSection({
  division,
  items,
  index,
}: {
  division: Division;
  items: Category[];
  index: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const DivIcon = division.icon;

  const scrollByAmount = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = direction === "left" ? -260 : 260;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <section
      aria-labelledby={`division-heading-${division.id}`}
      className="border-b border-border/50 pb-5 last:border-b-0 last:pb-0"
    >
      {/* Clear Bengali Section Heading (clean layout without standalone count badge) */}
      <div className="mb-2.5 flex items-center justify-between gap-2 px-0.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-50 via-emerald-100 to-emerald-200/85 text-emerald-700 ring-1 ring-emerald-300/70 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),0_3px_8px_-3px_rgba(4,120,87,0.2)]">
            {division.customIconUrl ? (
              <img
                src={division.customIconUrl}
                alt={division.bn}
                loading="lazy"
                className="h-full w-full rounded-xl object-cover"
              />
            ) : (
              <DivIcon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
            )}
          </div>
          <div className="min-w-0">
            <h2
              id={`division-heading-${division.id}`}
              className="truncate font-bangla text-[15px] font-bold leading-snug text-primary-deep sm:text-base"
            >
              {index + 1}. {division.bn}
            </h2>
          </div>
        </div>

        {/* Desktop Left/Right Scroll Helpers */}
        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          <button
            type="button"
            onClick={() => scrollByAmount("left")}
            aria-label={`${division.bn} বামে স্ক্রল করুন`}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount("right")}
            aria-label={`${division.bn} ডানে স্ক্রল করুন`}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 2-Row Horizontally Scrollable Category Container */}
      <div
        ref={scrollRef}
        className={`grid grid-flow-col ${
          items.length === 1 ? "grid-rows-1" : "grid-rows-2"
        } auto-cols-[80px] min-[360px]:auto-cols-[86px] sm:auto-cols-[106px] md:auto-cols-[114px] gap-2 sm:gap-2.5 overflow-x-auto overscroll-x-contain touch-pan-x touch-pan-y scroll-smooth pb-1 scrollbar-none`}
      >
        {items.map((cat) => (
          <ServiceCategoryCard key={cat.slug} category={cat} />
        ))}
      </div>
    </section>
  );
}

function QuickLink({
  to,
  label,
  tone,
  icon,
}: {
  to: "/blood-donor" | "/donation" | "/emergency-request";
  label: string;
  tone: "rose" | "red" | "emerald";
  icon: React.ReactNode;
}) {
  const tones = {
    red: "border-red-200/80 bg-gradient-to-br from-red-50 via-rose-50 to-red-100/70 text-red-700 hover:border-red-300",
    rose: "border-rose-200/80 bg-gradient-to-br from-rose-50 via-pink-50 to-rose-100/70 text-rose-700 hover:border-rose-300",
    emerald:
      "border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/70 text-emerald-800 hover:border-emerald-300",
  };
  return (
    <Link
      to={to}
      className={`flex min-w-0 items-center justify-center gap-1 rounded-full border px-2 py-2.5 text-center text-[11px] font-bold shadow-card transition active:scale-95 min-[360px]:gap-1.5 min-[360px]:text-xs sm:py-3 ${tones[tone]}`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Link>
  );
}
