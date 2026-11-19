import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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
  HeartPulse,
  Hospital,
  GraduationCap,
  Newspaper,
  Users,
  Bell,
  Sparkles,
  Megaphone,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import {
  useCategories,
  useDivisions,
  useHeroBannerConfig,
  useHomepageConfig,
  useWebsiteContentConfig,
  DEFAULT_HERO_BANNER_ITEM,
  type HomepageQuickAction,
} from "@/lib/store";
import type { Category, Division } from "@/data/categories";
import { BannerPopup } from "@/components/BannerPopup";
import { EmergencyBanner } from "@/components/EmergencyBanner";
import { ServiceCategoryCard } from "@/components/ServiceCategoryCard";

const HOMEPAGE_ICONS: Record<string, LucideIcon> = {
  ShieldAlert,
  Droplet,
  HandCoins,
  MapPin,
  Building2,
  Briefcase,
  AlertTriangle,
  Phone,
  HeartPulse,
  Hospital,
  GraduationCap,
  Newspaper,
  Users,
  Bell,
  Sparkles,
};

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
  style,
  children,
}: {
  href: string;
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const cleanHref = (href || "").trim();
  const internalMatch = /^https?:\/\/(?:www\.)?smartnoakhali\.com(\/.*)?$/i.exec(cleanHref);
  const spaPath = internalMatch ? internalMatch[1] || "/" : cleanHref;

  if (spaPath.startsWith("/")) {
    return (
      <Link to={spaPath as "/"} className={className} style={style}>
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
      style={style}
    >
      {children}
    </a>
  );
}

const HERO_SLIDE_VARIANTS = {
  enter: (dir: number) => ({
    x: dir >= 0 ? "100%" : "-100%",
    opacity: 1,
  }),
  center: {
    x: "0%",
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir >= 0 ? "-100%" : "100%",
    opacity: 1,
  }),
};

function Index() {
  const { categories } = useCategories();
  const { divisions } = useDivisions();
  const { activeBanners, carousel, loading: heroLoading } = useHeroBannerConfig();
  const { homepageConfig } = useHomepageConfig();
  const { contentConfig } = useWebsiteContentConfig();

  const displayBanners = useMemo(
    () => (activeBanners.length > 0 ? activeBanners : [DEFAULT_HERO_BANNER_ITEM]),
    [activeBanners]
  );
  const preloadedImgsRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const [heroSlideIdx, setHeroSlideIdx] = useState(0);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const [heroPaused, setHeroPaused] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const manualPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);

  const pauseAfterManualInteraction = useCallback(() => {
    setManualPaused(true);
    if (manualPauseTimerRef.current) {
      clearTimeout(manualPauseTimerRef.current);
    }
    manualPauseTimerRef.current = setTimeout(() => {
      setManualPaused(false);
    }, 6500);
  }, []);

  useEffect(() => {
    return () => {
      if (manualPauseTimerRef.current) {
        clearTimeout(manualPauseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (heroSlideIdx >= displayBanners.length) {
      setHeroSlideIdx(0);
    }
  }, [displayBanners.length, heroSlideIdx]);

  const goToNextSlide = useCallback(
    (fromManual = false) => {
      if (displayBanners.length <= 1) return;
      if (fromManual) pauseAfterManualInteraction();
      setSlideDirection(1);
      setHeroSlideIdx((prev) => (prev + 1) % displayBanners.length);
    },
    [displayBanners.length, pauseAfterManualInteraction]
  );

  const goToPrevSlide = useCallback(() => {
    if (displayBanners.length <= 1) return;
    pauseAfterManualInteraction();
    setSlideDirection(-1);
    setHeroSlideIdx((prev) => (prev - 1 + displayBanners.length) % displayBanners.length);
  }, [displayBanners.length, pauseAfterManualInteraction]);

  const goToSpecificSlide = useCallback(
    (targetIdx: number) => {
      if (displayBanners.length <= 1 || targetIdx === heroSlideIdx) return;
      pauseAfterManualInteraction();
      setSlideDirection(targetIdx > heroSlideIdx ? 1 : -1);
      setHeroSlideIdx(targetIdx);
    },
    [displayBanners.length, heroSlideIdx, pauseAfterManualInteraction]
  );

  useEffect(() => {
    if (displayBanners.length <= 1 || !carousel.autoRotate || heroPaused || manualPaused) return;
    const ms = Math.max(2000, (carousel.intervalSeconds || 5) * 1000);
    const id = setInterval(() => {
      setSlideDirection(1);
      setHeroSlideIdx((prev) => (prev + 1) % displayBanners.length);
    }, ms);
    return () => clearInterval(id);
  }, [displayBanners.length, carousel.autoRotate, carousel.intervalSeconds, heroPaused, manualPaused]);

  // Preload and decode all active hero banner images persistently in memory to prevent frame delays
  useEffect(() => {
    if (heroLoading) return;
    const cache = preloadedImgsRef.current;
    const activeUrls = new Set<string>();
    for (const banner of displayBanners) {
      if (banner.backgroundMode !== "image") continue;
      if (banner.desktopImageUrl) activeUrls.add(banner.desktopImageUrl);
      if (banner.mobileImageUrl) activeUrls.add(banner.mobileImageUrl);
    }
    for (const url of activeUrls) {
      if (!cache.has(url)) {
        const preImg = new Image();
        preImg.decoding = "sync";
        preImg.src = url;
        if (typeof preImg.decode === "function") {
          preImg.decode().catch(() => {});
        }
        cache.set(url, preImg);
      }
    }
    for (const cachedUrl of Array.from(cache.keys())) {
      if (!activeUrls.has(cachedUrl)) {
        cache.delete(cachedUrl);
      }
    }
  }, [displayBanners, heroLoading]);

  useEffect(() => {
    if (contentConfig.seoTitle?.trim()) {
      document.title = contentConfig.seoTitle.trim();
    }
  }, [contentConfig.seoTitle]);

  // Preserve all visible service categories across all divisions
  const filteredCategories = useMemo(() => {
    return categories.filter(
      (c) => c.slug !== "chat" && c.slug !== "app-download" && c.visible !== false
    );
  }, [categories]);

  // Group all categories strictly into active main divisions vertically
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

  const currentHeroBanner = displayBanners[heroSlideIdx] ?? displayBanners[0];
  const desktopHeroImg = currentHeroBanner
    ? currentHeroBanner.desktopImageUrl || currentHeroBanner.mobileImageUrl
    : "";
  const mobileHeroImg = currentHeroBanner
    ? currentHeroBanner.mobileImageUrl || currentHeroBanner.desktopImageUrl
    : "";
  const hasHeroImage = Boolean(
    currentHeroBanner &&
      currentHeroBanner.backgroundMode === "image" &&
      (desktopHeroImg || mobileHeroImg)
  );

  const visibleQuickActions = useMemo(
    () => (homepageConfig.quickActions || []).filter((q) => q.visible !== false),
    [homepageConfig.quickActions]
  );

  const visibleFeaturedShortcuts = useMemo(
    () => (homepageConfig.featuredShortcuts || []).filter((s) => s.visible !== false),
    [homepageConfig.featuredShortcuts]
  );

  const activeNotices = useMemo(
    () => (contentConfig.publicNotices || []).filter((n) => n.visible !== false && (n.title || n.body)),
    [contentConfig.publicNotices]
  );

  const announcementToneMap = {
    amber: "border-amber-500/35 bg-amber-500/10 text-amber-950",
    emerald: "border-emerald-500/35 bg-emerald-500/10 text-emerald-950",
    blue: "border-blue-500/35 bg-blue-500/10 text-blue-950",
    rose: "border-rose-500/35 bg-rose-500/10 text-rose-950",
  };

  const shortcutToneMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    blue: "bg-blue-500/10 text-blue-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    rose: "bg-rose-500/10 text-rose-600",
  };

  return (
    <div className="mx-auto w-full max-w-3xl overflow-x-hidden px-3.5 pb-28 pt-3 sm:px-4 sm:pt-4">
      {/* Optional Top Super Admin Announcement Strip */}
      {homepageConfig.announcement?.visible && homepageConfig.announcement.text.trim() && (
        <HeroActionLink
          href={homepageConfig.announcement.link || "/notifications"}
          className={`mb-3 flex items-start gap-2.5 rounded-2xl border px-3.5 py-2.5 text-xs shadow-xs transition hover:opacity-95 ${
            announcementToneMap[homepageConfig.announcement.tone || "amber"]
          }`}
        >
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            {homepageConfig.announcement.title && (
              <p className="font-bold">{homepageConfig.announcement.title}</p>
            )}
            <p className="text-[11px] opacity-90">{homepageConfig.announcement.text}</p>
          </div>
        </HeroActionLink>
      )}

      {/* Dynamic Multi-Banner Hero Section / Sequential Slider */}
      {homepageConfig.showHero !== false &&
        (heroLoading ? (
          <div
            aria-label="হিরো ব্যানার লোড হচ্ছে"
            className="min-h-[224px] w-full animate-pulse rounded-[26px] border border-border/60 bg-muted/40 shadow-[0_18px_40px_-14px_rgba(7,54,34,0.18)] sm:min-h-[246px]"
          />
        ) : (
          currentHeroBanner && (
            <section
              aria-roledescription={displayBanners.length > 1 ? "carousel" : undefined}
              aria-label="হিরো ব্যানার"
              onMouseEnter={() => {
                if (carousel.pauseOnHover) setHeroPaused(true);
              }}
              onMouseLeave={() => setHeroPaused(false)}
              onFocusCapture={() => {
                if (carousel.pauseOnHover) setHeroPaused(true);
              }}
              onBlurCapture={() => setHeroPaused(false)}
              onTouchStart={(e) => {
                touchStartX.current = e.touches[0]?.clientX ?? null;
              }}
              onTouchEnd={(e) => {
                if (touchStartX.current === null || displayBanners.length <= 1) return;
                const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
                const delta = endX - touchStartX.current;
                touchStartX.current = null;
                if (Math.abs(delta) > 40) {
                  if (delta < 0) goToNextSlide(true);
                  else goToPrevSlide();
                }
              }}
              className={`relative overflow-hidden border border-emerald-300/20 shadow-[0_18px_40px_-14px_rgba(7,54,34,0.45)] ${
                currentHeroBanner.borderRadius || "rounded-[26px]"
              }`}
            >
              <div className="relative grid overflow-hidden">
                <AnimatePresence initial={false} custom={slideDirection}>
                  <motion.div
                    key={heroSlideIdx}
                    custom={slideDirection}
                    variants={HERO_SLIDE_VARIANTS}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      x: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
                    }}
                    className={`col-start-1 row-start-1 relative h-full w-full overflow-hidden p-5 sm:p-7 ${
                      displayBanners.length > 1
                        ? carousel.showArrows && carousel.showDots
                          ? "pb-[88px] sm:pb-12"
                          : carousel.showArrows
                          ? "pb-14 sm:pb-7"
                          : carousel.showDots
                          ? "pb-14 sm:pb-12"
                          : ""
                        : ""
                    }`}
                    style={{
                      background:
                        currentHeroBanner.backgroundMode === "image"
                          ? "#111827"
                          : currentHeroBanner.backgroundMode === "solid"
                          ? currentHeroBanner.solidColor
                          : `linear-gradient(135deg, ${currentHeroBanner.gradientFrom} 0%, ${currentHeroBanner.gradientVia} 50%, ${currentHeroBanner.gradientTo} 100%)`,
                      color:
                        currentHeroBanner.headingColor || currentHeroBanner.textColor || "#ffffff",
                    }}
                  >
                    {hasHeroImage && (
                      <>
                        {mobileHeroImg && (
                          <img
                            src={mobileHeroImg}
                            alt={currentHeroBanner.headingLine1 || "Smart Noakhali"}
                            loading="eager"
                            decoding="sync"
                            className="pointer-events-none absolute inset-0 h-full w-full object-cover md:hidden"
                            style={{
                              objectPosition:
                                currentHeroBanner.imagePositionMobile || "center center",
                            }}
                          />
                        )}
                        {desktopHeroImg && (
                          <img
                            src={desktopHeroImg}
                            alt={currentHeroBanner.headingLine1 || "Smart Noakhali"}
                            loading="eager"
                            decoding="sync"
                            className="pointer-events-none absolute inset-0 hidden h-full w-full object-cover md:block"
                            style={{
                              objectPosition:
                                currentHeroBanner.imagePositionDesktop || "center center",
                            }}
                          />
                        )}
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0"
                          style={{
                            backgroundColor: currentHeroBanner.overlayColor || "#042316",
                            opacity:
                              Math.min(90, Math.max(0, currentHeroBanner.overlayOpacity ?? 55)) /
                              100,
                          }}
                        />
                      </>
                    )}

                    {currentHeroBanner.showDecorativeGlow !== false && (
                      <>
                        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-14 -left-10 h-44 w-44 rounded-full bg-emerald-300/20 blur-3xl" />
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                      </>
                    )}

                    <div
                      className={`relative z-10 ${
                        currentHeroBanner.textAlign === "left"
                          ? "text-left"
                          : currentHeroBanner.textAlign === "right"
                          ? "text-right"
                          : "text-left sm:text-left"
                      }`}
                    >
                      {currentHeroBanner.badgeText.trim() && (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold tracking-wide backdrop-blur-sm"
                          style={{
                            color: currentHeroBanner.badgeColor || "#ffffff",
                            backgroundColor:
                              currentHeroBanner.badgeBgColor || "rgba(255,255,255,0.14)",
                          }}
                        >
                          <Droplet className="h-3 w-3 text-amber-300" />{" "}
                          {currentHeroBanner.badgeText}
                        </span>
                      )}

                      <h1
                        className="mt-3.5 font-bangla text-[24px] font-extrabold leading-[1.24] tracking-tight drop-shadow-xs sm:text-[32px]"
                        style={{
                          color:
                            currentHeroBanner.headingColor ||
                            currentHeroBanner.textColor ||
                            "#ffffff",
                        }}
                      >
                        {currentHeroBanner.headingLine1}
                        {currentHeroBanner.headingLine2 && (
                          <>
                            <br />
                            {currentHeroBanner.headingLine2}
                          </>
                        )}
                      </h1>

                      {currentHeroBanner.description.trim() && (
                        <p
                          className={`mt-2.5 max-w-xl text-[12.5px] leading-relaxed sm:text-sm ${
                            currentHeroBanner.textAlign === "center" ? "mx-auto sm:mx-0" : ""
                          }`}
                          style={{
                            color:
                              currentHeroBanner.descriptionColor ||
                              currentHeroBanner.subtextColor ||
                              "#ecfdf5",
                            opacity: 0.94,
                          }}
                        >
                          {currentHeroBanner.description}
                        </p>
                      )}

                      {(currentHeroBanner.primaryButtonText.trim() ||
                        currentHeroBanner.secondaryButtonText.trim() ||
                        currentHeroBanner.optionalButtonText?.trim()) && (
                        <div
                          className={`mt-5 flex flex-wrap items-center gap-2.5 ${
                            currentHeroBanner.textAlign === "right"
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          {currentHeroBanner.primaryButtonText.trim() && (
                            <HeroActionLink
                              href={currentHeroBanner.primaryButtonLink || "tel:999"}
                              className="inline-flex min-h-[40px] items-center gap-2 rounded-full px-5 py-2.5 text-xs font-extrabold shadow-md transition hover:brightness-105 active:scale-95 sm:text-[13px]"
                              style={{
                                backgroundColor:
                                  currentHeroBanner.primaryButtonBgColor || "#dc2626",
                                color: currentHeroBanner.primaryButtonColor || "#ffffff",
                              }}
                            >
                              <Phone className="h-3.5 w-3.5" />{" "}
                              {currentHeroBanner.primaryButtonText}
                            </HeroActionLink>
                          )}
                          {currentHeroBanner.secondaryButtonText.trim() && (
                            <HeroActionLink
                              href={currentHeroBanner.secondaryButtonLink || "/submit-info"}
                              className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-white/25 px-4.5 py-2.5 text-xs font-bold shadow-xs backdrop-blur-sm transition hover:brightness-95 active:scale-95 sm:text-[13px]"
                              style={{
                                backgroundColor:
                                  currentHeroBanner.secondaryButtonBgColor || "#ffffff",
                                color: currentHeroBanner.secondaryButtonColor || "#064e3b",
                              }}
                            >
                              <Send className="h-3.5 w-3.5" />{" "}
                              {currentHeroBanner.secondaryButtonText}
                            </HeroActionLink>
                          )}
                          {currentHeroBanner.optionalButtonText?.trim() && (
                            <HeroActionLink
                              href={currentHeroBanner.optionalButtonLink || "/directory"}
                              className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-white/25 px-4 py-2.5 text-xs font-bold backdrop-blur-sm transition hover:brightness-110 active:scale-95 sm:text-[13px]"
                              style={{
                                backgroundColor:
                                  currentHeroBanner.optionalButtonBgColor ||
                                  "rgba(255,255,255,0.16)",
                                color: currentHeroBanner.optionalButtonColor || "#ffffff",
                              }}
                            >
                              {currentHeroBanner.optionalButtonText}
                            </HeroActionLink>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Sequential Carousel Controls (kept stationary outside slide transition) */}
              {displayBanners.length > 1 && (carousel.showArrows || carousel.showDots) && (
                <div className="pointer-events-none absolute inset-x-5 bottom-4 z-20 flex flex-col gap-3.5 sm:inset-0 sm:block">
                  {carousel.showArrows && (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        aria-label="পূর্ববর্তী ব্যানার"
                        onClick={goToPrevSlide}
                        className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/25 text-white backdrop-blur-sm transition hover:bg-black/45 active:scale-95 sm:absolute sm:right-12 sm:top-4"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="পরবর্তী ব্যানার"
                        onClick={() => goToNextSlide(true)}
                        className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/25 text-white backdrop-blur-sm transition hover:bg-black/45 active:scale-95 sm:absolute sm:right-3 sm:top-4"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {carousel.showDots && (
                    <div className="pointer-events-auto flex items-center justify-center gap-1.5 sm:absolute sm:inset-x-0 sm:bottom-5">
                      {displayBanners.map((bItem, i) => (
                        <button
                          key={bItem.id}
                          type="button"
                          aria-label={`ব্যানার ${i + 1}`}
                          aria-current={i === heroSlideIdx ? "true" : undefined}
                          onClick={() => goToSpecificSlide(i)}
                          className={`h-2 rounded-full transition-all duration-300 ${
                            i === heroSlideIdx ? "w-6 bg-white" : "w-2 bg-white/40 hover:bg-white/65"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )
        ))}

      {/* Quick-Action Pill Buttons */}
      {homepageConfig.showQuickActions !== false && visibleQuickActions.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {visibleQuickActions.map((qa) => {
            const IconComp = HOMEPAGE_ICONS[qa.iconName] || Sparkles;
            return (
              <QuickLink
                key={qa.id}
                to={qa.to}
                label={qa.label}
                tone={qa.tone || "emerald"}
                icon={<IconComp className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />}
              />
            );
          })}
        </div>
      )}

      {/* Featured District Service Shortcuts */}
      {homepageConfig.showFeaturedShortcuts !== false && visibleFeaturedShortcuts.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {visibleFeaturedShortcuts.map((fs) => {
            const IconComp = HOMEPAGE_ICONS[fs.iconName] || MapPin;
            const toneClass = shortcutToneMap[fs.tone || "primary"] || shortcutToneMap.primary;
            return (
              <HeroActionLink
                key={fs.id}
                href={fs.to}
                className="group flex min-w-0 items-center gap-2.5 rounded-2xl border border-border/80 bg-card p-2.5 shadow-card transition hover:border-primary/40 hover:bg-muted/40 active:scale-95"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${toneClass}`}
                >
                  <IconComp className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display text-xs font-bold text-foreground">
                    {fs.title}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">{fs.subtitle}</p>
                </div>
              </HeroActionLink>
            );
          })}
        </div>
      )}

      {/* Live Emergency Alert Banner */}
      {homepageConfig.showEmergencyBanner !== false && <EmergencyBanner />}

      {/* Optional Public Notices (managed by Super Admin) */}
      {activeNotices.length > 0 && (
        <div className="mt-4 space-y-2">
          {activeNotices.map((notice) => (
            <div
              key={notice.id}
              className="rounded-2xl border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-xs shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-primary-deep">{notice.title}</p>
                {notice.date && (
                  <span className="text-[10px] text-muted-foreground">{notice.date}</span>
                )}
              </div>
              {notice.body && (
                <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                  {notice.body}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ALL MAIN SECTIONS — Vertically Stacked, Each with 2-Row Horizontal Scroll */}
      {homepageConfig.showDivisions !== false && (
        <div className="mt-6 space-y-6">
          {divisionSections.map(({ division, items }) => (
            <DivisionHorizontalSection
              key={division.id}
              division={division}
              items={items}
            />
          ))}
        </div>
      )}

      {/* App Download & Custom Footer Callout */}
      {homepageConfig.showFooterAppCallout !== false && (
        <footer className="mt-9 flex flex-col items-center gap-2.5 border-t border-border/60 pt-6 text-center">
          <Link
            to="/app-download"
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-primary transition hover:text-primary-deep hover:underline"
          >
            <Smartphone className="h-3.5 w-3.5 shrink-0" />
            <span>
              {contentConfig.footerTagline || "Android / iOS অ্যাপ ও PWA ডাউনলোড করুন"}
            </span>
          </Link>

          {contentConfig.socialLinks &&
            (contentConfig.socialLinks.facebook ||
              contentConfig.socialLinks.youtube ||
              contentConfig.socialLinks.whatsapp) && (
              <div className="flex flex-wrap items-center justify-center gap-2 text-[11px]">
                {contentConfig.socialLinks.facebook && (
                  <a
                    href={contentConfig.socialLinks.facebook}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 font-semibold text-foreground hover:border-primary/40"
                  >
                    Facebook <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
                {contentConfig.socialLinks.youtube && (
                  <a
                    href={contentConfig.socialLinks.youtube}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 font-semibold text-foreground hover:border-primary/40"
                  >
                    YouTube <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
                {contentConfig.socialLinks.whatsapp && (
                  <a
                    href={contentConfig.socialLinks.whatsapp}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 font-semibold text-foreground hover:border-primary/40"
                  >
                    WhatsApp <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
            )}

          <p className="text-[11px] text-muted-foreground">
            {contentConfig.footerCopyright ||
              "© স্মার্ট নোয়াখালী • নোয়াখালীর ডিজিটাল সিটিজেন সেবা ডিরেক্টরি"}
          </p>
        </footer>
      )}

      <BannerPopup />
    </div>
  );
}

function DivisionHorizontalSection({
  division,
  items,
}: {
  division: Division;
  items: Category[];
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
      {/* Clear Bengali Section Heading */}
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
              {division.bn}
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
  to: string;
  label: string;
  tone: HomepageQuickAction["tone"];
  icon: React.ReactNode;
}) {
  const tones = {
    red: "border-red-200/80 bg-gradient-to-br from-red-50 via-rose-50 to-red-100/70 text-red-700 hover:border-red-300",
    rose: "border-rose-200/80 bg-gradient-to-br from-rose-50 via-pink-50 to-rose-100/70 text-rose-700 hover:border-rose-300",
    emerald:
      "border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/70 text-emerald-800 hover:border-emerald-300",
    blue: "border-blue-200/80 bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100/70 text-blue-800 hover:border-blue-300",
    amber:
      "border-amber-200/80 bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100/70 text-amber-800 hover:border-amber-300",
  };
  return (
    <HeroActionLink
      href={to}
      className={`flex min-w-0 items-center justify-center gap-1 rounded-full border px-2 py-2.5 text-center text-[11px] font-bold shadow-card transition active:scale-95 min-[360px]:gap-1.5 min-[360px]:text-xs sm:py-3 ${tones[tone] || tones.emerald}`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </HeroActionLink>
  );
}
