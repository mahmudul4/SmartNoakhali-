import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  type HeroBannerItem,
  type HomepageQuickAction,
} from "@/lib/store";
import type { Category, Division } from "@/data/categories";
import { BannerPopup } from "@/components/BannerPopup";
import { EmergencyBanner } from "@/components/EmergencyBanner";
import { ServiceCategoryCard } from "@/components/ServiceCategoryCard";
import {
  getElementCanvasStyle,
  resolveBreakpointLayout,
  useHeroBreakpoint,
  type HeroDeviceBreakpoint,
} from "@/lib/heroPositioning";

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
    zIndex: 2,
  }),
  center: {
    x: "0%",
    opacity: 1,
    zIndex: 2,
  },
  exit: (dir: number) => ({
    x: dir >= 0 ? "-25%" : "25%",
    opacity: 1,
    zIndex: 1,
  }),
};

const HERO_FADE_VARIANTS = {
  enter: () => ({ opacity: 0, zIndex: 2 }),
  center: { opacity: 1, zIndex: 2 },
  exit: () => ({ opacity: 0, zIndex: 1 }),
};

const HERO_NONE_VARIANTS = {
  enter: () => ({ opacity: 1, x: "0%", zIndex: 2 }),
  center: { opacity: 1, x: "0%", zIndex: 2 },
  exit: () => ({ opacity: 0, zIndex: 1 }),
};

function HeroBannerSlide({
  banner,
  breakpoint,
  slideDirection,
  transitionStyle,
  hasControls,
}: {
  banner: HeroBannerItem;
  breakpoint: HeroDeviceBreakpoint;
  slideDirection: 1 | -1;
  transitionStyle: "slide" | "fade" | "none";
  hasControls: boolean;
}) {
  const isLegacyDefaultMain =
    banner.id === "hero_main_1" &&
    !banner.desktopImageUrl &&
    !banner.mobileImageUrl;
  const desktopImg =
    banner.desktopImageUrl ||
    banner.mobileImageUrl ||
    (isLegacyDefaultMain ? "/hero-noakhali.jpg" : "");
  const mobileImg =
    banner.mobileImageUrl ||
    banner.desktopImageUrl ||
    (isLegacyDefaultMain ? "/hero-noakhali.jpg" : "");
  const hasImage = Boolean(
    (banner.backgroundMode === "image" || isLegacyDefaultMain) &&
      (desktopImg || mobileImg)
  );
  const activeBreakpointLayout = resolveBreakpointLayout(
    banner.responsiveLayouts,
    breakpoint,
    banner.textAlign
  );
  const isCustomPositioned = activeBreakpointLayout.mode === "custom";
  const isSplitDesktop =
    !isCustomPositioned &&
    hasImage &&
    (banner.layoutMode === "split_left" || banner.layoutMode === "split_right");
  const isFullWidth = banner.layoutMode === "full_width";
  const imgFitClass = banner.imageFit === "contain" ? "object-contain" : "object-cover";

  const alignTextClass =
    banner.textAlign === "left"
      ? "text-left"
      : banner.textAlign === "right"
        ? "text-right"
        : "text-center";
  const alignButtonsClass =
    banner.textAlign === "left"
      ? "justify-start"
      : banner.textAlign === "right"
        ? "justify-end"
        : "justify-center";
  const alignDescMarginClass =
    banner.textAlign === "center"
      ? "mx-auto"
      : banner.textAlign === "right"
        ? "ml-auto"
        : "";

  const variants =
    transitionStyle === "none"
      ? HERO_NONE_VARIANTS
      : transitionStyle === "fade"
        ? HERO_FADE_VARIANTS
        : HERO_SLIDE_VARIANTS;

  const transition =
    transitionStyle === "none"
      ? { duration: 0.01 }
      : transitionStyle === "fade"
        ? { opacity: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const } }
        : { x: { duration: 0.44, ease: [0.22, 1, 0.36, 1] as const } };

  return (
    <motion.div
      custom={slideDirection}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={transition}
      className={`absolute inset-0 flex h-full w-full flex-col justify-center overflow-hidden p-5 sm:p-8 ${
        isFullWidth ? "lg:px-14" : "lg:px-10"
      } ${hasControls ? "pb-14 sm:pb-12" : ""}`}
      style={{
        willChange: transitionStyle === "slide" ? "transform" : "opacity",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        backgroundColor: banner.solidColor || "#0F4D3A",
        color: banner.headingColor || banner.textColor || "#ffffff",
      }}
    >
      {/* Background image (always on mobile; on desktop only when NOT split layout) */}
      {hasImage && (
        <>
          {mobileImg && (
            <img
              src={mobileImg}
              alt={banner.headingLine1 || "স্মার্ট নোয়াখালী"}
              loading="eager"
              decoding="sync"
              draggable={false}
              className={`pointer-events-none absolute inset-0 h-full w-full select-none ${imgFitClass} md:hidden`}
              style={{
                objectPosition: banner.imagePositionMobile || "center center",
              }}
            />
          )}
          {desktopImg && !isSplitDesktop && (
            <>
              <img
                src={desktopImg}
                alt={banner.headingLine1 || "স্মার্ট নোয়াখালী"}
                loading="eager"
                decoding="sync"
                draggable={false}
                className={`pointer-events-none absolute inset-0 hidden h-full w-full select-none ${imgFitClass} md:block lg:hidden`}
                style={{
                  objectPosition:
                    banner.imagePositionTablet || banner.imagePositionDesktop || "center center",
                }}
              />
              <img
                src={desktopImg}
                alt={banner.headingLine1 || "স্মার্ট নোয়াখালী"}
                loading="eager"
                decoding="sync"
                draggable={false}
                className={`pointer-events-none absolute inset-0 hidden h-full w-full select-none ${imgFitClass} lg:block`}
                style={{
                  objectPosition: banner.imagePositionDesktop || "center center",
                }}
              />
            </>
          )}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 ${isSplitDesktop ? "md:hidden" : ""}`}
            style={{
              backgroundColor: isLegacyDefaultMain ? "#0F4D3A" : banner.overlayColor || "#0F4D3A",
              opacity: isLegacyDefaultMain
                ? 0.45
                : Math.min(90, Math.max(0, banner.overlayOpacity ?? 45)) / 100,
            }}
          />
        </>
      )}

      {isCustomPositioned ? (
        <div className="relative z-10 h-full w-full">
          {banner.badgeText.trim() && (() => {
            const pos = activeBreakpointLayout.elements.badge;
            return (
              <div style={getElementCanvasStyle(pos, 22)}>
                <span
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 font-semibold tracking-wide backdrop-blur-sm"
                  style={{
                    color: banner.badgeColor || "#ffffff",
                    backgroundColor: banner.badgeBgColor || "rgba(255,255,255,0.14)",
                    fontSize: `${Math.round(11 * pos.fontScale * 10) / 10}px`,
                  }}
                >
                  <Droplet className="h-3 w-3 shrink-0 text-amber-300" />
                  <span className="truncate">{banner.badgeText}</span>
                </span>
              </div>
            );
          })()}

          {(banner.headingLine1.trim() || banner.headingLine2.trim()) && (() => {
            const pos = activeBreakpointLayout.elements.heading;
            const baseHeadingPx =
              breakpoint === "mobile" ? 24 : breakpoint === "tablet" ? 30 : 36;
            return (
              <div style={getElementCanvasStyle(pos, 23)}>
                <h1
                  className="font-display font-bold leading-[1.2] tracking-tight [text-wrap:balance]"
                  style={{
                    color: banner.headingColor || banner.textColor || "#ffffff",
                    fontSize: `${Math.round(baseHeadingPx * pos.fontScale)}px`,
                    marginBottom: `${Math.round(activeBreakpointLayout.elementSpacingPx * 0.25)}px`,
                  }}
                >
                  {banner.headingLine1}
                  {banner.headingLine2 && (
                    <>
                      <br />
                      {banner.headingLine2}
                    </>
                  )}
                </h1>
              </div>
            );
          })()}

          {banner.description.trim() && (() => {
            const pos = activeBreakpointLayout.elements.description;
            const baseDescPx = breakpoint === "mobile" ? 13.5 : 15;
            return (
              <div style={getElementCanvasStyle(pos, 22)}>
                <p
                  className="leading-relaxed"
                  style={{
                    color: banner.descriptionColor || banner.subtextColor || "#FAF7F2",
                    opacity: 0.95,
                    fontSize: `${Math.round(baseDescPx * pos.fontScale * 10) / 10}px`,
                  }}
                >
                  {banner.description}
                </p>
              </div>
            );
          })()}

          {banner.primaryButtonText.trim() && (() => {
            const pos = activeBreakpointLayout.elements.primaryButton;
            const alignFlex =
              pos.textAlign === "center"
                ? "justify-center"
                : pos.textAlign === "right"
                  ? "justify-end"
                  : "justify-start";
            return (
              <div style={getElementCanvasStyle(pos, 24)} className={`flex ${alignFlex}`}>
                <HeroActionLink
                  href={banner.primaryButtonLink || "tel:999"}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-[10px] px-5 py-2.5 font-semibold transition hover:opacity-95"
                  style={{
                    backgroundColor: banner.primaryButtonBgColor || "#C62828",
                    color: banner.primaryButtonColor || "#ffffff",
                    fontSize: `${Math.round((breakpoint === "mobile" ? 14 : 15) * pos.fontScale * 10) / 10}px`,
                  }}
                >
                  <Phone className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span className="truncate">{banner.primaryButtonText}</span>
                </HeroActionLink>
              </div>
            );
          })()}

          {banner.secondaryButtonText.trim() && (() => {
            const pos = activeBreakpointLayout.elements.secondaryButton;
            const alignFlex =
              pos.textAlign === "center"
                ? "justify-center"
                : pos.textAlign === "right"
                  ? "justify-end"
                  : "justify-start";
            return (
              <div style={getElementCanvasStyle(pos, 24)} className={`flex ${alignFlex}`}>
                <HeroActionLink
                  href={banner.secondaryButtonLink || "/submit-info"}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border border-[#E6E1D6] px-4 py-2 font-semibold transition hover:opacity-95"
                  style={{
                    backgroundColor: banner.secondaryButtonBgColor || "#ffffff",
                    color: banner.secondaryButtonColor || "#0F4D3A",
                    fontSize: `${Math.round((breakpoint === "mobile" ? 13 : 14) * pos.fontScale * 10) / 10}px`,
                  }}
                >
                  <Send className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span className="truncate">{banner.secondaryButtonText}</span>
                </HeroActionLink>
              </div>
            );
          })()}

          {banner.optionalButtonText?.trim() && (() => {
            const pos = activeBreakpointLayout.elements.optionalButton;
            const alignFlex =
              pos.textAlign === "center"
                ? "justify-center"
                : pos.textAlign === "right"
                  ? "justify-end"
                  : "justify-start";
            return (
              <div style={getElementCanvasStyle(pos, 24)} className={`flex ${alignFlex}`}>
                <HeroActionLink
                  href={banner.optionalButtonLink || "/directory"}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-white/25 px-3.5 py-2 font-bold backdrop-blur-sm transition hover:brightness-110 active:scale-95 sm:min-h-[42px] sm:gap-2 sm:px-4"
                  style={{
                    backgroundColor: banner.optionalButtonBgColor || "rgba(255,255,255,0.16)",
                    color: banner.optionalButtonColor || "#ffffff",
                    fontSize: `${Math.round((breakpoint === "mobile" ? 12 : 13) * pos.fontScale * 10) / 10}px`,
                  }}
                >
                  <span className="truncate">{banner.optionalButtonText}</span>
                </HeroActionLink>
              </div>
            );
          })()}

          {banner.optionalText?.trim() && (() => {
            const pos = activeBreakpointLayout.elements.optionalText;
            return (
              <div style={getElementCanvasStyle(pos, 21)}>
                <p
                  className="font-semibold tracking-wide"
                  style={{
                    color: banner.optionalTextColor || "#fde68a",
                    fontSize: `${Math.round((breakpoint === "mobile" ? 11.5 : 13) * pos.fontScale * 10) / 10}px`,
                  }}
                >
                  {banner.optionalText}
                </p>
              </div>
            );
          })()}
        </div>
      ) : (
        <div
          className={`relative z-10 w-full ${
            isSplitDesktop
              ? "md:grid md:grid-cols-12 md:items-center md:gap-8"
              : banner.textAlign === "center" && !isFullWidth
                ? "mx-auto max-w-3xl"
                : ""
          } ${alignTextClass}`}
        >
          {isSplitDesktop && banner.layoutMode === "split_right" && desktopImg && (
            <div className="hidden md:block md:col-span-5">
              <div className="h-[220px] lg:h-[256px] w-full overflow-hidden rounded-2xl border border-white/15 bg-black/15 shadow-lg">
                <img
                  src={desktopImg}
                  alt={banner.headingLine1 || "Smart Noakhali"}
                  loading="eager"
                  decoding="sync"
                  draggable={false}
                  className={`h-full w-full ${imgFitClass}`}
                  style={{
                    objectPosition:
                      breakpoint === "tablet"
                        ? banner.imagePositionTablet || banner.imagePositionDesktop || "center center"
                        : banner.imagePositionDesktop || "center center",
                  }}
                />
              </div>
            </div>
          )}

          <div className={isSplitDesktop ? "md:col-span-7" : ""}>
            {banner.badgeText.trim() && (
              <span
                className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold tracking-wide backdrop-blur-sm"
                style={{
                  color: banner.badgeColor || "#ffffff",
                  backgroundColor: banner.badgeBgColor || "rgba(255,255,255,0.14)",
                }}
              >
                <Droplet className="h-3 w-3 shrink-0 text-amber-300" />{" "}
                <span className="truncate">{banner.badgeText}</span>
              </span>
            )}

            <h1
              className="font-display text-[24px] font-bold leading-[1.2] tracking-tight [text-wrap:balance] sm:text-[31px] md:text-[34px] lg:text-[36px]"
              style={{
                color: banner.headingColor || banner.textColor || "#ffffff",
              }}
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
                className={`mt-2 max-w-2xl text-[13.5px] leading-relaxed line-clamp-3 sm:line-clamp-2 sm:text-[15px] ${alignDescMarginClass}`}
                style={{
                  color: banner.descriptionColor || banner.subtextColor || "#FAF7F2",
                  opacity: 0.95,
                }}
              >
                {banner.description}
              </p>
            )}

            {(banner.primaryButtonText.trim() ||
              banner.secondaryButtonText.trim() ||
              banner.optionalButtonText?.trim()) && (
              <div
                className={`mt-4 flex flex-wrap items-center gap-2.5 ${alignButtonsClass}`}
              >
                {banner.primaryButtonText.trim() && (
                  <HeroActionLink
                    href={banner.primaryButtonLink || "tel:999"}
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-semibold transition hover:opacity-95"
                    style={{
                      backgroundColor: banner.primaryButtonBgColor || "#C62828",
                      color: banner.primaryButtonColor || "#ffffff",
                    }}
                  >
                    <Phone className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                    <span>{banner.primaryButtonText}</span>
                  </HeroActionLink>
                )}
                {banner.secondaryButtonText.trim() && (
                  <HeroActionLink
                    href={banner.secondaryButtonLink || "/submit-info"}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border border-[#E6E1D6] px-4 py-2 text-xs font-semibold transition hover:opacity-95 sm:text-sm"
                    style={{
                      backgroundColor: banner.secondaryButtonBgColor || "#ffffff",
                      color: banner.secondaryButtonColor || "#0F4D3A",
                    }}
                  >
                    <Send className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                    <span>{banner.secondaryButtonText}</span>
                  </HeroActionLink>
                )}
                {banner.optionalButtonText?.trim() && (
                  <HeroActionLink
                    href={banner.optionalButtonLink || "/directory"}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[10px] border border-white/30 px-4 py-2 text-xs font-semibold transition hover:opacity-95 sm:text-sm"
                    style={{
                      backgroundColor: banner.optionalButtonBgColor || "rgba(255,255,255,0.16)",
                      color: banner.optionalButtonColor || "#ffffff",
                    }}
                  >
                    {banner.optionalButtonText}
                  </HeroActionLink>
                )}
              </div>
            )}

            {banner.optionalText?.trim() && (
              <p
                className="mt-2 text-xs font-semibold tracking-wide"
                style={{ color: banner.optionalTextColor || "#ffffff" }}
              >
                {banner.optionalText}
              </p>
            )}
          </div>

          {isSplitDesktop && banner.layoutMode === "split_left" && desktopImg && (
            <div className="hidden md:block md:col-span-5">
              <div className="h-[220px] lg:h-[256px] w-full overflow-hidden rounded-[12px] border border-white/20 bg-black/15">
                <img
                  src={desktopImg}
                  alt={banner.headingLine1 || "স্মার্ট নোয়াখালী"}
                  loading="eager"
                  decoding="sync"
                  draggable={false}
                  className={`h-full w-full ${imgFitClass}`}
                  style={{
                    objectPosition:
                      breakpoint === "tablet"
                        ? banner.imagePositionTablet || banner.imagePositionDesktop || "center center"
                        : banner.imagePositionDesktop || "center center",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function Index() {
  const prefersReducedMotion = useReducedMotion();
  const heroBreakpoint = useHeroBreakpoint();
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
  const touchStartY = useRef<number | null>(null);

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
  const hasHeroControls = Boolean(
    displayBanners.length > 1 && (carousel.showArrows || carousel.showDots)
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
    amber: "border-[#E6E1D6] bg-white text-[#1C1C1C]",
    emerald: "border-[#0F4D3A]/30 bg-white text-[#1C1C1C]",
    blue: "border-[#E6E1D6] bg-white text-[#1C1C1C]",
    rose: "border-[#C62828]/30 bg-white text-[#1C1C1C]",
  };

  const effectiveTransitionStyle: "slide" | "fade" | "none" = prefersReducedMotion
    ? "none"
    : carousel.transitionStyle || "slide";

  const lockUniform = carousel.lockUniformDimensions !== false;
  const baseBanner = displayBanners[0] || currentHeroBanner;
  const heroStageStyle = {
    "--hero-h-mobile": `${
      lockUniform
        ? carousel.uniformMobileHeightPx || baseBanner?.mobileHeightPx || 308
        : currentHeroBanner?.mobileHeightPx || 308
    }px`,
    "--hero-h-tablet": `${
      lockUniform
        ? carousel.uniformTabletHeightPx || baseBanner?.tabletHeightPx || 324
        : currentHeroBanner?.tabletHeightPx || 324
    }px`,
    "--hero-h-desktop": `${
      lockUniform
        ? carousel.uniformDesktopHeightPx || baseBanner?.desktopHeightPx || 336
        : currentHeroBanner?.desktopHeightPx || 336
    }px`,
  } as React.CSSProperties;

  return (
    <div className="mx-auto w-full max-w-7xl overflow-x-hidden px-4 pb-6 pt-4 sm:px-6 sm:pt-5 lg:px-8">
      {/* Optional Top Super Admin Announcement Strip */}
      {homepageConfig.announcement?.visible && homepageConfig.announcement.text.trim() && (
        <HeroActionLink
          href={homepageConfig.announcement.link || "/notifications"}
          className={`mb-4 flex items-start gap-2.5 rounded-[12px] border px-4 py-3 text-xs transition hover:border-[#0F4D3A] ${
            announcementToneMap[homepageConfig.announcement.tone || "amber"]
          }`}
        >
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-[#0F4D3A]" strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            {homepageConfig.announcement.title && (
              <p className="font-semibold text-[#1C1C1C]">{homepageConfig.announcement.title}</p>
            )}
            <p className="mt-0.5 text-xs text-[#5F5F5A]">{homepageConfig.announcement.text}</p>
          </div>
        </HeroActionLink>
      )}

      {/* Calm Civic Hero Section */}
      {homepageConfig.showHero !== false &&
        (heroLoading ? (
          <div
            aria-label="হিরো ব্যানার লোড হচ্ছে"
            className="hero-stage-dynamic w-full animate-pulse rounded-[12px] border border-[#E6E1D6] bg-white"
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
                touchStartY.current = e.touches[0]?.clientY ?? null;
              }}
              onTouchEnd={(e) => {
                if (touchStartX.current === null || displayBanners.length <= 1) return;
                const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
                const endY = e.changedTouches[0]?.clientY ?? (touchStartY.current ?? 0);
                const deltaX = endX - touchStartX.current;
                const deltaY = endY - (touchStartY.current ?? endY);
                touchStartX.current = null;
                touchStartY.current = null;
                if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
                  if (deltaX < 0) goToNextSlide(true);
                  else goToPrevSlide();
                }
              }}
              className="relative overflow-hidden rounded-[12px] border border-[#E6E1D6] bg-[#0F4D3A]"
            >
              <div
                style={heroStageStyle}
                className="hero-stage-dynamic relative w-full overflow-hidden"
              >
                <AnimatePresence initial={false} custom={slideDirection}>
                  <HeroBannerSlide
                    key={`${currentHeroBanner.id}_${heroSlideIdx}`}
                    banner={currentHeroBanner}
                    breakpoint={heroBreakpoint}
                    slideDirection={slideDirection}
                    transitionStyle={effectiveTransitionStyle}
                    hasControls={hasHeroControls}
                  />
                </AnimatePresence>
              </div>

              {/* Sequential Carousel Controls */}
              {hasHeroControls && (
                <div className="pointer-events-none absolute inset-x-4 bottom-3 z-20 flex items-center justify-between gap-2 sm:inset-0 sm:block">
                  {carousel.showArrows && (
                    <button
                      type="button"
                      aria-label="পূর্ববর্তী ব্যানার"
                      onClick={goToPrevSlide}
                      className="pointer-events-auto order-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-white/30 bg-black/30 text-white transition hover:bg-black/45 sm:absolute sm:right-12 sm:top-4"
                    >
                      <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  )}

                  {carousel.showDots && (
                    <div className="pointer-events-auto order-2 flex flex-1 items-center justify-center gap-1.5 sm:absolute sm:inset-x-0 sm:bottom-4">
                      {displayBanners.map((bItem, i) => (
                        <button
                          key={bItem.id}
                          type="button"
                          aria-label={`ব্যানার ${i + 1}`}
                          aria-current={i === heroSlideIdx ? "true" : undefined}
                          onClick={() => goToSpecificSlide(i)}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            i === heroSlideIdx ? "w-5 bg-white" : "w-1.5 bg-white/45 hover:bg-white/70"
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  {carousel.showArrows && (
                    <button
                      type="button"
                      aria-label="পরবর্তী ব্যানার"
                      onClick={() => goToNextSlide(true)}
                      className="pointer-events-auto order-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-white/30 bg-black/30 text-white transition hover:bg-black/45 sm:absolute sm:right-3 sm:top-4"
                    >
                      <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              )}
            </section>
          )
        ))}

      {/* Quick-Action Buttons */}
      {homepageConfig.showQuickActions !== false && visibleQuickActions.length > 0 && (
        <div
          className={`mt-4 grid gap-3 ${
            visibleQuickActions.length <= 2
              ? "grid-cols-2"
              : "grid-cols-2 sm:grid-cols-3 md:grid-flow-col md:auto-cols-fr"
          }`}
        >
          {visibleQuickActions.map((qa) => {
            const IconComp = HOMEPAGE_ICONS[qa.iconName] || Sparkles;
            return (
              <QuickLink
                key={qa.id}
                to={qa.to}
                label={qa.label}
                tone={qa.tone || "emerald"}
                icon={<IconComp className="h-4 w-4 shrink-0" strokeWidth={1.5} />}
              />
            );
          })}
        </div>
      )}

      {/* Featured District Service Shortcuts */}
      {homepageConfig.showFeaturedShortcuts !== false && visibleFeaturedShortcuts.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {visibleFeaturedShortcuts.map((fs) => {
            const IconComp = HOMEPAGE_ICONS[fs.iconName] || MapPin;
            return (
              <HeroActionLink
                key={fs.id}
                href={fs.to}
                className="group flex min-w-0 items-center gap-3 rounded-[12px] border border-[#E6E1D6] bg-white p-3 transition-colors hover:border-[#0F4D3A]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] text-[#0F4D3A]">
                  <IconComp className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display text-[13px] font-semibold text-[#1C1C1C]">
                    {fs.title}
                  </p>
                  <p className="truncate text-[11px] text-[#5F5F5A]">{fs.subtitle}</p>
                </div>
              </HeroActionLink>
            );
          })}
        </div>
      )}

      {/* Live Emergency Alert Banner */}
      {homepageConfig.showEmergencyBanner !== false && <EmergencyBanner />}

      {/* Optional Public Notices */}
      {activeNotices.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {activeNotices.map((notice) => (
            <div
              key={notice.id}
              className="rounded-[12px] border border-[#E6E1D6] bg-white px-4 py-3 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-sm font-semibold text-[#0F4D3A]">{notice.title}</p>
                {notice.date && (
                  <span className="text-[11px] text-[#5F5F5A]">{notice.date}</span>
                )}
              </div>
              {notice.body && (
                <p className="mt-1 text-xs leading-relaxed text-[#5F5F5A]">
                  {notice.body}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ALL MAIN SECTIONS — Vertically Stacked, Each with 2-Row Horizontal Scroll on Mobile */}
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

      {/* Offline Download & Civic Footer */}
      {homepageConfig.showFooterAppCallout !== false && (
        <footer className="mt-8 flex flex-col items-center gap-3 border-t border-[#E6E1D6] pt-6 text-center">
          <Link
            to="/app-download"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border border-[#E6E1D6] bg-white px-4 py-2 text-xs font-semibold text-[#0F4D3A] transition hover:border-[#0F4D3A]"
          >
            <Smartphone className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span>অফলাইন ডাউনলোড ও অ্যাপ</span>
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
                    className="inline-flex items-center gap-1 rounded-[8px] border border-[#E6E1D6] bg-white px-3 py-1 font-medium text-[#1C1C1C] hover:border-[#0F4D3A]"
                  >
                    Facebook <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                  </a>
                )}
                {contentConfig.socialLinks.youtube && (
                  <a
                    href={contentConfig.socialLinks.youtube}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-[8px] border border-[#E6E1D6] bg-white px-3 py-1 font-medium text-[#1C1C1C] hover:border-[#0F4D3A]"
                  >
                    YouTube <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                  </a>
                )}
                {contentConfig.socialLinks.whatsapp && (
                  <a
                    href={contentConfig.socialLinks.whatsapp}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-[8px] border border-[#E6E1D6] bg-white px-3 py-1 font-medium text-[#1C1C1C] hover:border-[#0F4D3A]"
                  >
                    WhatsApp <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                  </a>
                )}
              </div>
            )}

          <p className="text-[11px] text-[#5F5F5A]">
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
      className="border-b border-[#E6E1D6] pb-5 last:border-b-0 last:pb-0"
    >
      {/* Clear Bengali Section Heading */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] text-[#0F4D3A]">
            {division.customIconUrl ? (
              <img
                src={division.customIconUrl}
                alt={division.bn}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-contain p-1"
              />
            ) : (
              <DivIcon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            )}
          </div>
          <div className="min-w-0">
            <h2
              id={`division-heading-${division.id}`}
              className="truncate font-display text-[17px] font-semibold leading-snug text-[#1C1C1C] sm:text-[18px]"
            >
              {division.bn}
            </h2>
          </div>
        </div>

        {/* Tablet/Desktop Horizontal Scroll Helpers (hidden on lg+ where grid expands) */}
        <div className="hidden shrink-0 items-center gap-1.5 sm:flex lg:hidden">
          <button
            type="button"
            onClick={() => scrollByAmount("left")}
            aria-label={`${division.bn} বামে স্ক্রল করুন`}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#E6E1D6] bg-white text-[#5F5F5A] transition hover:border-[#0F4D3A] hover:text-[#0F4D3A]"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount("right")}
            aria-label={`${division.bn} ডানে স্ক্রল করুন`}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#E6E1D6] bg-white text-[#5F5F5A] transition hover:border-[#0F4D3A] hover:text-[#0F4D3A]"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* 2-Row Horizontally Scrollable Category Container on Mobile/Tablet; Full Responsive Grid on Desktop */}
      <div
        ref={scrollRef}
        className={`grid grid-flow-col ${
          items.length === 1 ? "grid-rows-1" : "grid-rows-2"
        } auto-cols-[84px] min-[360px]:auto-cols-[90px] sm:auto-cols-[108px] md:auto-cols-[116px] gap-2.5 sm:gap-3 lg:grid-flow-row lg:grid-rows-none lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 lg:auto-cols-auto lg:gap-3.5 overflow-x-auto lg:overflow-visible overscroll-x-contain touch-pan-x touch-pan-y scroll-smooth pb-1 scrollbar-none`}
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
  const isEmergency = tone === "red";
  return (
    <HeroActionLink
      href={to}
      className={`flex min-h-[48px] min-w-0 items-center justify-center gap-2 rounded-[12px] border px-3 py-2.5 text-center font-bangla text-[13.5px] font-semibold transition sm:text-sm ${
        isEmergency
          ? "border-[#C62828] bg-[#C62828] text-white hover:opacity-95"
          : "border-[#0F4D3A] bg-[#FFFFFF] text-[#0F4D3A] hover:bg-[#FAF7F2]"
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </HeroActionLink>
  );
}
