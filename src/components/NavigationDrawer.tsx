import { useCallback, useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  X,
  Home,
  MessageCircle,
  MapPin,
  Building2,
  Briefcase,
  Droplet,
  AlertTriangle,
  User as UserIcon,
  ShieldCheck,
  LogIn,
  LogOut,
  ChevronRight,
} from "lucide-react";
import type { Category } from "@/data/categories";

interface DrawerUser {
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

interface NavigationDrawerProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  logo: string;
  categories: Category[];
  isAuthed: boolean;
  isMainAdmin: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  user: DrawerUser | null;
  onLogout: () => Promise<void>;
  restoreFocusRef?: React.RefObject<HTMLElement | null>;
}

const EDGE_TRIGGER_PX = 38;
const DRAWER_MAX_WIDTH = 320;
const LOCK_HORIZONTAL_PX = 12;
const SWIPE_COMMIT_RATIO = 0.28;
const SWIPE_VELOCITY_THRESHOLD = 0.32;

function hasHorizontalScrollableAncestor(target: EventTarget | null): boolean {
  let el = target instanceof HTMLElement ? target : null;
  while (el && el !== document.body) {
    if (el.hasAttribute("data-no-edge-swipe")) return true;
    const style = window.getComputedStyle(el);
    const overflowX = style.overflowX;
    if (
      (overflowX === "auto" || overflowX === "scroll") &&
      el.scrollWidth > el.clientWidth + 4
    ) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

function isOtherModalOpen(): boolean {
  const openDialogs = document.querySelectorAll(
    '[role="dialog"][data-state="open"], [aria-modal="true"]:not([data-nav-drawer="true"])'
  );
  for (const node of openDialogs) {
    if (!node.hasAttribute("data-nav-drawer")) {
      return true;
    }
  }
  return false;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector =
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
  );
}

export function NavigationDrawer({
  open,
  onOpenChange,
  logo,
  categories,
  isAuthed,
  isMainAdmin,
  isStaff,
  isAdmin,
  user,
  onLogout,
  restoreFocusRef,
}: NavigationDrawerProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const drawerRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const gestureRef = useRef<{
    mode: "idle" | "candidate-open" | "opening" | "candidate-close" | "closing" | "aborted";
    startX: number;
    startY: number;
    lastX: number;
    startTime: number;
    drawerWidth: number;
  }>({
    mode: "idle",
    startX: 0,
    startY: 0,
    lastX: 0,
    startTime: 0,
    drawerWidth: DRAWER_MAX_WIDTH,
  });

  const closeDrawer = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Body scroll lock & focus management when drawer opens/closes
  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;

    if (open) {
      drawer.removeAttribute("inert");
      previousActiveElementRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const timer = window.setTimeout(() => {
        closeBtnRef.current?.focus({ preventScroll: true });
      }, 40);

      return () => {
        window.clearTimeout(timer);
        document.body.style.overflow = prevOverflow;
      };
    }

    drawer.setAttribute("inert", "");
    const active = document.activeElement;
    if (active instanceof HTMLElement && drawer.contains(active)) {
      const targetToFocus =
        restoreFocusRef?.current || previousActiveElementRef.current;
      targetToFocus?.focus({ preventScroll: true });
    }
    return undefined;
  }, [open, restoreFocusRef]);

  // Keyboard support: Escape to close, Alt+M to toggle, Tab trap inside open drawer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        onOpenChange(!openRef.current);
        return;
      }

      if (!openRef.current) return;

      if (e.key === "Escape") {
        e.preventDefault();
        closeDrawer();
        return;
      }

      if (e.key === "Tab" && drawerRef.current) {
        const focusables = getFocusableElements(drawerRef.current);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDrawer, onOpenChange]);

  // Real-time 60fps Left-Edge Swipe Open & Right-to-Left Swipe Close (Android & iOS)
  useEffect(() => {

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const g = gestureRef.current;
      const drawerEl = drawerRef.current;
      const measuredWidth = Math.min(
        drawerEl?.offsetWidth || DRAWER_MAX_WIDTH,
        window.innerWidth * 0.86
      );

      if (!openRef.current) {
        if (
          touch.clientX > EDGE_TRIGGER_PX ||
          isEditableElement(e.target) ||
          isOtherModalOpen() ||
          hasHorizontalScrollableAncestor(e.target)
        ) {
          g.mode = "idle";
          return;
        }
        g.mode = "candidate-open";
        g.startX = touch.clientX;
        g.startY = touch.clientY;
        g.lastX = touch.clientX;
        g.startTime = performance.now();
        g.drawerWidth = measuredWidth;
        return;
      }

      const insideDrawerOrBackdrop =
        (drawerEl && drawerEl.contains(e.target as Node)) ||
        (backdropRef.current && backdropRef.current.contains(e.target as Node));

      if (!insideDrawerOrBackdrop) {
        g.mode = "idle";
        return;
      }

      g.mode = "candidate-close";
      g.startX = touch.clientX;
      g.startY = touch.clientY;
      g.lastX = touch.clientX;
      g.startTime = performance.now();
      g.drawerWidth = measuredWidth;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const g = gestureRef.current;
      if (g.mode === "idle" || g.mode === "aborted") return;

      const touch = e.touches[0];
      const dx = touch.clientX - g.startX;
      const dy = touch.clientY - g.startY;
      g.lastX = touch.clientX;

      if (g.mode === "candidate-open") {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 1.1) {
          g.mode = "aborted";
          return;
        }
        if (dx < -6) {
          g.mode = "aborted";
          return;
        }
        if (dx >= LOCK_HORIZONTAL_PX && dx > Math.abs(dy) * 1.35) {
          g.mode = "opening";
        } else {
          return;
        }
      }

      if (g.mode === "candidate-close") {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 1.1) {
          g.mode = "aborted";
          return;
        }
        if (dx > 8) {
          g.mode = "aborted";
          return;
        }
        if (dx <= -LOCK_HORIZONTAL_PX && Math.abs(dx) > Math.abs(dy) * 1.3) {
          g.mode = "closing";
        } else {
          return;
        }
      }

      const drawer = drawerRef.current;
      const backdrop = backdropRef.current;
      if (!drawer || !backdrop) return;

      if (e.cancelable) e.preventDefault();

      if (g.mode === "opening") {
        const clampedX = Math.max(0, Math.min(g.drawerWidth, dx));
        const progress = clampedX / g.drawerWidth;
        const translatePx = clampedX - g.drawerWidth;
        drawer.style.transition = "none";
        drawer.style.visibility = "visible";
        drawer.style.transform = `translate3d(${translatePx}px, 0, 0)`;
        backdrop.style.transition = "none";
        backdrop.style.visibility = "visible";
        backdrop.style.opacity = String(progress * 0.52);
      } else if (g.mode === "closing") {
        const clampedDx = Math.min(0, Math.max(-g.drawerWidth, dx));
        const progress = 1 + clampedDx / g.drawerWidth;
        drawer.style.transition = "none";
        drawer.style.transform = `translate3d(${clampedDx}px, 0, 0)`;
        backdrop.style.transition = "none";
        backdrop.style.opacity = String(Math.max(0, progress) * 0.52);
      }
    };

    const smoothSnapReset = () => {
      const drawer = drawerRef.current;
      const backdrop = backdropRef.current;
      if (drawer) drawer.style.transition = "";
      if (backdrop) backdrop.style.transition = "";
      if (drawer) void drawer.offsetWidth;
      requestAnimationFrame(() => {
        if (drawer) {
          drawer.style.transform = "";
          drawer.style.visibility = "";
        }
        if (backdrop) {
          backdrop.style.opacity = "";
          backdrop.style.visibility = "";
        }
      });
    };

    const onTouchEnd = () => {
      const g = gestureRef.current;
      const prevMode = g.mode;
      g.mode = "idle";

      if (prevMode !== "opening" && prevMode !== "closing") return;

      const elapsedMs = Math.max(16, performance.now() - g.startTime);
      const dx = g.lastX - g.startX;
      const velocity = Math.abs(dx) / elapsedMs;

      smoothSnapReset();

      if (prevMode === "opening") {
        const shouldOpen =
          dx > g.drawerWidth * SWIPE_COMMIT_RATIO || velocity > SWIPE_VELOCITY_THRESHOLD;
        onOpenChange(shouldOpen);
      } else if (prevMode === "closing") {
        const shouldClose =
          -dx > g.drawerWidth * SWIPE_COMMIT_RATIO || velocity > SWIPE_VELOCITY_THRESHOLD;
        onOpenChange(!shouldClose);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onOpenChange]);

  const isRouteActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);

  const navLinkClass = (active: boolean) =>
    `flex min-h-[44px] items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 font-bangla text-[14.5px] leading-[1.35] transition-colors ${
      active
        ? "bg-[#064e3b] font-semibold text-white shadow-xs"
        : "font-medium text-slate-800 hover:bg-emerald-950/[0.06] hover:text-[#064e3b]"
    }`;

  const iconClass = (active: boolean) =>
    `h-[18px] w-[18px] shrink-0 ${active ? "text-amber-200" : "text-[#064e3b]"}`;

  const resolveCategoryHref = (c: Category): { type: "internal"; to: string } | { type: "external"; href: string } | { type: "slug"; slug: string } => {
    if (c.customRoute) {
      const cleanRoute = c.customRoute.trim();
      if (cleanRoute.startsWith("/")) return { type: "internal", to: cleanRoute };
      if (/^https?:\/\//i.test(cleanRoute)) return { type: "external", href: cleanRoute };
    }
    if (
      c.slug === "submit-info" ||
      c.slug === "donation" ||
      c.slug === "about" ||
      c.slug === "board-result" ||
      c.slug === "blood-donor" ||
      c.slug === "emergency-request"
    ) {
      return { type: "internal", to: `/${c.slug}` };
    }
    return { type: "slug", slug: c.slug };
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        ref={backdropRef}
        onClick={closeDrawer}
        aria-hidden="true"
        className={`fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] transition-[opacity,visibility] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          open ? "visible opacity-100 pointer-events-auto" : "invisible opacity-0 pointer-events-none"
        }`}
      />

      {/* Slide-in Navigation Drawer */}
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label="স্মার্ট নোয়াখালী নেভিগেশন মেনু"
        data-nav-drawer="true"
        className={`fixed inset-y-0 left-0 z-50 flex w-[84vw] max-w-[320px] flex-col border-r border-emerald-950/10 bg-white text-slate-900 shadow-2xl transition-[transform,visibility] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
          open ? "visible translate-x-0" : "invisible -translate-x-full pointer-events-none"
        }`}
      >
        {/* Drawer Header: Official Logo + Brand Wordmark + Close Button */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-emerald-950/10 bg-emerald-950/[0.02] px-4 py-3.5">
          <Link
            to="/"
            onClick={closeDrawer}
            className="flex min-w-0 items-center gap-3 focus-visible:rounded-xl"
          >
            <img
              src={logo}
              alt="Smart Noakhali Logo"
              className="h-11 w-11 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <p className="font-brand whitespace-nowrap text-[18px] font-bold tracking-[-0.015em] leading-none">
                <span className="text-[#064e3b]">Smart</span>{" "}
                <span className="text-[#b91c1c]">Noakhali</span>
              </p>
              <p className="mt-1 truncate font-bangla text-[11.5px] font-medium leading-[1.3] text-emerald-900/80">
                স্মার্ট নোয়াখালী
              </p>
            </div>
          </Link>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={closeDrawer}
            aria-label="মেনু বন্ধ করুন"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-950/12 bg-white text-slate-700 transition-colors hover:bg-emerald-950/[0.06] hover:text-[#b91c1c] active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Navigation Hierarchy */}
        <nav
          aria-label="ড্রয়ার নেভিগেশন"
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 space-y-5"
        >
          {/* Primary Section */}
          <div>
            <p className="px-3.5 pb-1.5 font-bangla text-[11.5px] font-semibold tracking-wide text-emerald-900/65">
              মূল নেভিগেশন
            </p>
            <div className="space-y-1">
              <Link to="/" onClick={closeDrawer} className={navLinkClass(isRouteActive("/"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Home className={iconClass(isRouteActive("/"))} />
                  <span className="truncate">হোম</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-40" />
              </Link>
              <Link to="/chat" onClick={closeDrawer} className={navLinkClass(isRouteActive("/chat"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <MessageCircle className={iconClass(isRouteActive("/chat"))} />
                  <span className="truncate">লাইভ চ্যাট ও AI সহায়তা</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-40" />
              </Link>
            </div>
          </div>

          <div className="border-t border-emerald-950/8" />

          {/* Civic & District Tools */}
          <div>
            <p className="px-3.5 pb-1.5 font-bangla text-[11.5px] font-semibold tracking-wide text-emerald-900/65">
              নাগরিক ও জেলা সেবা
            </p>
            <div className="space-y-1">
              <Link to="/blood-donor" onClick={closeDrawer} className={navLinkClass(isRouteActive("/blood-donor"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Droplet className={isRouteActive("/blood-donor") ? "h-[18px] w-[18px] shrink-0 text-rose-200" : "h-[18px] w-[18px] shrink-0 text-[#b91c1c]"} />
                  <span className="truncate">রক্তদাতা ডিরেক্টরি</span>
                </span>
              </Link>
              <Link to="/map" onClick={closeDrawer} className={navLinkClass(isRouteActive("/map"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <MapPin className={iconClass(isRouteActive("/map"))} />
                  <span className="truncate">নোয়াখালী ম্যাপ ও দূরত্ব</span>
                </span>
              </Link>
              <Link to="/directory" onClick={closeDrawer} className={navLinkClass(isRouteActive("/directory"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Building2 className={iconClass(isRouteActive("/directory"))} />
                  <span className="truncate">প্রতিষ্ঠান ও ব্যবসা ডিরেক্টরি</span>
                </span>
              </Link>
              <Link to="/career" onClick={closeDrawer} className={navLinkClass(isRouteActive("/career"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <Briefcase className={iconClass(isRouteActive("/career"))} />
                  <span className="truncate">শিক্ষা ও ক্যারিয়ার হাব</span>
                </span>
              </Link>
              <Link to="/complaint-tracking" onClick={closeDrawer} className={navLinkClass(isRouteActive("/complaint-tracking"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <AlertTriangle className={iconClass(isRouteActive("/complaint-tracking"))} />
                  <span className="truncate">নাগরিক অভিযোগ ট্র্যাকিং</span>
                </span>
              </Link>
              <Link to="/profile" onClick={closeDrawer} className={navLinkClass(isRouteActive("/profile"))}>
                <span className="flex items-center gap-3 min-w-0">
                  <UserIcon className={iconClass(isRouteActive("/profile"))} />
                  <span className="truncate">আমার প্রোফাইল ও বুকমার্ক</span>
                </span>
              </Link>
            </div>
          </div>

          <div className="border-t border-emerald-950/8" />

          {/* Dynamic Categories */}
          <div>
            <p className="px-3.5 pb-1.5 font-bangla text-[11.5px] font-semibold tracking-wide text-emerald-900/65">
              প্রধান ক্যাটাগরিসমূহ
            </p>
            <div className="space-y-1">
              {categories
                .filter((c) => c.slug !== "chat" && c.slug !== "app-download")
                .map((c) => {
                  const target = resolveCategoryHref(c);
                  if (target.type === "external") {
                    return (
                      <a
                        key={c.slug}
                        href={target.href}
                        target="_blank"
                        rel="noreferrer"
                        onClick={closeDrawer}
                        className={navLinkClass(false)}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <c.icon className={iconClass(false)} />
                          <span className="truncate">{c.bn}</span>
                        </span>
                      </a>
                    );
                  }
                  if (target.type === "internal") {
                    const active = isRouteActive(target.to);
                    return (
                      <Link
                        key={c.slug}
                        to={target.to as "/"}
                        onClick={closeDrawer}
                        className={navLinkClass(active)}
                      >
                        <span className="flex items-center gap-3 min-w-0">
                          <c.icon className={iconClass(active)} />
                          <span className="truncate">{c.bn}</span>
                        </span>
                      </Link>
                    );
                  }
                  const slugPath = `/category/${target.slug}`;
                  const active = isRouteActive(slugPath);
                  return (
                    <Link
                      key={c.slug}
                      to="/category/$slug"
                      params={{ slug: target.slug }}
                      onClick={closeDrawer}
                      className={navLinkClass(active)}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <c.icon className={iconClass(active)} />
                        <span className="truncate">{c.bn}</span>
                      </span>
                    </Link>
                  );
                })}
            </div>
          </div>

          <div className="border-t border-emerald-950/8" />

          {/* Account & Staff Permissions */}
          <div className="space-y-1.5 pb-4">
            {isAuthed && (isMainAdmin || isStaff) && (
              <Link
                to="/mdmahmudulhashan"
                onClick={closeDrawer}
                className={navLinkClass(isRouteActive("/mdmahmudulhashan"))}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <ShieldCheck className={isRouteActive("/mdmahmudulhashan") ? "h-[18px] w-[18px] shrink-0 text-amber-200" : "h-[18px] w-[18px] shrink-0 text-[#b91c1c]"} />
                  <span className="truncate font-semibold">ড্যাশবোর্ড / এডমিন প্যানেল</span>
                </span>
              </Link>
            )}

            {isAuthed ? (
              <>
                <div className="flex items-center gap-2.5 px-3.5 py-2 font-bangla text-xs text-slate-600">
                  <UserIcon className="h-4 w-4 shrink-0 text-[#064e3b]" />
                  <span className="truncate">
                    {user?.email || user?.displayName || "ব্যবহারকারী"}
                  </span>
                  {isAdmin && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#b91c1c]" />}
                </div>
                <button
                  type="button"
                  onClick={() => void onLogout()}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left font-bangla text-[14.5px] font-medium text-[#b91c1c] transition-colors hover:bg-rose-50"
                >
                  <LogOut className="h-[18px] w-[18px] shrink-0" />
                  <span>লগআউট</span>
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                onClick={closeDrawer}
                className={navLinkClass(isRouteActive("/auth"))}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <LogIn className={iconClass(isRouteActive("/auth"))} />
                  <span className="truncate">লগইন / নিবন্ধন</span>
                </span>
              </Link>
            )}
          </div>
        </nav>
      </aside>
    </>
  );
}
