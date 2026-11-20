import { Link, useNavigate } from "@tanstack/react-router";
import {
  Search,
  ShieldCheck,
  User as UserIcon,
  WifiOff,
  LayoutGrid,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { NavigationDrawer } from "@/components/NavigationDrawer";
import { useLogo, useCategories } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { NotificationBell } from "@/lib/notifications";
import { useNetworkStatus } from "@/lib/tasks";
import { SmartSearchModal } from "@/components/SmartSearchDialog";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const desktopMenuBtnRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const { logo } = useLogo();
  const { categories } = useCategories();
  const { isAuthed, isStaff, isAdmin, isMainAdmin, user, signOut } = useAuth();
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    setAvatarError(false);
  }, [user?.photoURL]);

  // Keyboard shortcut Ctrl+K / Cmd+K for Smart Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleHeaderLogout = async () => {
    setOpen(false);
    await signOut();
    toast.success("সফলভাবে লগআউট হয়েছে");
    navigate({ to: "/", replace: true });
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full max-w-[100vw] overflow-x-hidden border-t-[3px] border-t-[#064e3b] border-b border-emerald-950/10 bg-white/[0.97] text-[#063924] shadow-[0_4px_20px_-8px_rgba(6,57,36,0.14)] backdrop-blur-md">
        {/* Keyboard & Screen-Reader Accessible Skip / Drawer Controls (zero visual clutter) */}
        <div className="sr-only focus-within:not-sr-only focus-within:flex focus-within:items-center focus-within:gap-3 focus-within:bg-emerald-950/[0.04] focus-within:px-4 focus-within:py-2 focus-within:border-b focus-within:border-emerald-950/10">
          <a
            href="#main-content"
            className="rounded-lg bg-[#064e3b] px-3 py-1.5 font-bangla text-xs font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#064e3b]"
          >
            মূল কন্টেন্টে যান
          </a>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg border border-[#064e3b]/30 bg-white px-3 py-1.5 font-bangla text-xs font-semibold text-[#064e3b] outline-none focus-visible:ring-2 focus-visible:ring-[#064e3b]"
          >
            সম্পূর্ণ নেভিগেশন মেনু খুলুন (Alt+M)
          </button>
        </div>

        <div className="flex w-full min-w-0 items-center justify-between gap-2.5 px-3.5 py-2 sm:gap-4 sm:px-6 sm:py-2.5 lg:gap-6 lg:px-8 xl:px-10 2xl:px-12">
          {/* Left: Official Circular Logo + Refined English & Bangla Brand Lockup */}
          <Link
            to="/"
            className="group flex min-w-0 items-center gap-2.5 sm:gap-3 focus-visible:rounded-xl"
          >
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center min-[360px]:h-11 min-[360px]:w-11 sm:h-12 sm:w-12 lg:h-[50px] lg:w-[50px]">
              <img
                src={logo}
                alt="Smart Noakhali Logo"
                loading="eager"
                decoding="sync"
                className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
              />
            </div>
            <div className="flex min-w-0 flex-col justify-center text-left">
              <div className="flex items-baseline gap-1.5 whitespace-nowrap font-brand text-[17.5px] font-bold tracking-[-0.015em] leading-[1.12] min-[360px]:text-[19px] sm:text-[21px] lg:text-[23px]">
                <span className="text-[#064e3b]">Smart</span>
                <span className="text-[#b91c1c]">Noakhali</span>
              </div>
              <span className="mt-0.5 truncate font-bangla text-[11px] font-medium leading-[1.35] text-emerald-900/80 sm:text-[11.5px]">
                স্মার্ট নোয়াখালী
              </span>
            </div>
          </Link>

          {/* Right Cluster: Desktop Navigation + Action Controls */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5 lg:gap-5">
            <nav
              aria-label="প্রধান নেভিগেশন"
              className="hidden lg:flex items-center gap-5 xl:gap-6 font-bangla text-[14px] font-semibold text-[#064e3b]"
            >
              <Link to="/" className="whitespace-nowrap py-1 underline-offset-4 transition-colors hover:text-[#b91c1c] hover:underline">
                হোম
              </Link>
              <Link to="/directory" className="whitespace-nowrap py-1 underline-offset-4 transition-colors hover:text-[#b91c1c] hover:underline">
                ডিরেক্টরি
              </Link>
              <Link to="/blood-donor" className="whitespace-nowrap py-1 underline-offset-4 transition-colors hover:text-[#b91c1c] hover:underline">
                রক্তদাতা
              </Link>
              <Link to="/map" className="whitespace-nowrap py-1 underline-offset-4 transition-colors hover:text-[#b91c1c] hover:underline">
                জেলা ম্যাপ
              </Link>
              <Link to="/chat" className="whitespace-nowrap py-1 underline-offset-4 transition-colors hover:text-[#b91c1c] hover:underline">
                লাইভ চ্যাট
              </Link>
              <Link to="/submit-info" className="whitespace-nowrap py-1 underline-offset-4 transition-colors hover:text-[#b91c1c] hover:underline">
                তথ্য দিন
              </Link>
              <button
                ref={desktopMenuBtnRef}
                type="button"
                onClick={() => setOpen(true)}
                aria-expanded={open}
                aria-label="সকল সেবা ও বিভাগ ড্রয়ার খুলুন"
                className="inline-flex items-center gap-1.5 whitespace-nowrap py-1 underline-offset-4 transition-colors hover:text-[#b91c1c] hover:underline"
              >
                <LayoutGrid className="h-3.5 w-3.5 shrink-0 opacity-80" />
                <span>সকল সেবা</span>
              </button>
            </nav>

            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-label="সকল সেবা ও বিভাগ ড্রয়ার খুলুন"
              className="hidden md:inline-flex lg:hidden items-center gap-1.5 whitespace-nowrap py-1 font-bangla text-[13.5px] font-semibold text-[#064e3b] underline-offset-4 transition-colors hover:text-[#b91c1c] hover:underline"
            >
              <LayoutGrid className="h-3.5 w-3.5 shrink-0 opacity-80" />
              <span>সকল সেবা</span>
            </button>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="স্মার্ট সার্চ"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-950/15 bg-emerald-950/[0.04] font-bangla text-xs font-semibold text-[#064e3b] transition-colors hover:bg-emerald-950/[0.09] active:scale-95 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3"
                title="স্মার্ট সার্চ (Ctrl+K)"
              >
                <Search className="h-4 w-4 text-[#064e3b]" />
                <span className="hidden sm:inline">সার্চ</span>
                <kbd className="hidden xl:inline-block rounded border border-emerald-950/15 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-900/75">
                  ⌘K
                </kbd>
              </button>

              {!isOnline && (
                <span
                  className="flex h-9 items-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/15 px-2 font-bangla text-[10.5px] font-bold text-amber-900"
                  title="অফলাইন মোড সক্রিয়"
                >
                  <WifiOff className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">অফলাইন</span>
                </span>
              )}

              <NotificationBell />

              {isAuthed && (isMainAdmin || isStaff) && (
                <Link
                  to="/mdmahmudulhashan"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#b91c1c]/25 bg-[#b91c1c]/[0.07] font-bangla text-xs font-bold text-[#991b1b] transition-colors hover:bg-[#b91c1c]/[0.14] sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3"
                  title="সিকিউরিটি / এডমিন ড্যাশবোর্ড"
                  aria-label="সিকিউরিটি ড্যাশবোর্ড"
                >
                  <ShieldCheck className="h-4 w-4 shrink-0 text-[#b91c1c]" />
                  <span className="hidden md:inline">ড্যাশবোর্ড</span>
                </Link>
              )}

              <Link
                to="/profile"
                aria-label={isAuthed && user?.displayName ? `${user.displayName} — আমার প্রোফাইল` : "আমার প্রোফাইল"}
                title={isAuthed && user?.displayName ? `${user.displayName} — আমার প্রোফাইল` : "আমার প্রোফাইল"}
                className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#064e3b]/30 bg-emerald-950/[0.06] text-[#064e3b] shadow-2xs transition hover:border-[#b91c1c] active:scale-95 sm:h-9 sm:w-9"
              >
                {isAuthed && user?.photoURL && !avatarError ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "আমার প্রোফাইল"}
                    onError={() => setAvatarError(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserIcon className="h-4 w-4 text-[#064e3b]" />
                )}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Swipe-Enabled & Keyboard-Accessible Slide-In Navigation Drawer */}
      <NavigationDrawer
        open={open}
        onOpenChange={setOpen}
        logo={logo}
        categories={categories}
        isAuthed={isAuthed}
        isMainAdmin={isMainAdmin}
        isStaff={isStaff}
        isAdmin={isAdmin}
        user={user}
        onLogout={handleHeaderLogout}
        restoreFocusRef={desktopMenuBtnRef}
      />

      {/* Global Smart Search Modal */}
      <SmartSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </>
  );
}

export function MobileSearch({
  value,
  onChange,
  placeholder,
  onOpenDialog,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onOpenDialog?: () => void;
}) {
  return (
    <div className="relative w-full min-w-0">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "অনুসন্ধান করুন..."}
        className="w-full min-w-0 rounded-2xl border border-border bg-card py-3 pl-10 pr-20 text-sm shadow-card outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {onOpenDialog && (
        <button
          type="button"
          onClick={onOpenDialog}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-xl bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/20 transition active:scale-95"
        >
          <Search className="h-3 w-3" /> স্মার্ট সার্চ
        </button>
      )}
    </div>
  );
}