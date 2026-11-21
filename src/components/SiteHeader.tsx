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
      <header className="sticky top-0 z-40 w-full max-w-[100vw] overflow-x-hidden border-b border-[#E6E1D6] bg-[#FFFFFF] text-[#1C1C1C]">
        {/* Keyboard & Screen-Reader Accessible Skip / Drawer Controls */}
        <div className="sr-only focus-within:not-sr-only focus-within:flex focus-within:items-center focus-within:gap-3 focus-within:border-b focus-within:border-[#E6E1D6] focus-within:bg-[#FAF7F2] focus-within:px-4 focus-within:py-2">
          <a
            href="#main-content"
            className="rounded-[8px] bg-[#0F4D3A] px-3 py-1.5 font-bangla text-xs font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#0F4D3A]"
          >
            মূল কন্টেন্টে যান
          </a>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-[8px] border border-[#E6E1D6] bg-white px-3 py-1.5 font-bangla text-xs font-semibold text-[#0F4D3A] outline-none focus-visible:ring-2 focus-visible:ring-[#0F4D3A]"
          >
            সম্পূর্ণ নেভিগেশন মেনু খুলুন (Alt+M)
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-7xl min-w-0 items-center justify-between gap-2.5 px-4 py-2.5 sm:px-6 lg:px-8">
          {/* Left: Official Circular Logo + Calm Civic Title */}
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2.5 focus-visible:rounded-[10px]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#E6E1D6] bg-white p-0.5 sm:h-11 sm:w-11">
              <img
                src={logo}
                alt="স্মার্ট নোয়াখালী লোগো"
                loading="eager"
                decoding="sync"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex min-w-0 flex-col justify-center text-left">
              <span className="truncate font-display text-[19px] font-bold leading-tight text-[#0F4D3A] sm:text-[21px]">
                স্মার্ট নোয়াখালী
              </span>
              <span className="hidden truncate font-bangla text-[11px] font-medium leading-none text-[#5F5F5A] sm:block">
                Smart Noakhali • নাগরিক সেবা
              </span>
            </div>
          </Link>

          {/* Right Cluster: Desktop Navigation + Action Controls (Mobile strictly 2 controls: Search + Profile) */}
          <div className="flex shrink-0 items-center gap-2 lg:gap-5">
            <nav
              aria-label="প্রধান নেভিগেশন"
              className="hidden lg:flex items-center gap-5 font-bangla text-[14px] font-medium text-[#1C1C1C]"
            >
              <Link to="/" className="whitespace-nowrap py-1 transition-colors hover:text-[#0F4D3A]">
                হোম
              </Link>
              <Link to="/directory" className="whitespace-nowrap py-1 transition-colors hover:text-[#0F4D3A]">
                ডিরেক্টরি
              </Link>
              <Link to="/blood-donor" className="whitespace-nowrap py-1 transition-colors hover:text-[#0F4D3A]">
                রক্তদাতা
              </Link>
              <Link to="/map" className="whitespace-nowrap py-1 transition-colors hover:text-[#0F4D3A]">
                জেলা ম্যাপ
              </Link>
              <Link to="/chat" className="whitespace-nowrap py-1 transition-colors hover:text-[#0F4D3A]">
                লাইভ চ্যাট
              </Link>
              <Link to="/submit-info" className="whitespace-nowrap py-1 transition-colors hover:text-[#0F4D3A]">
                তথ্য দিন
              </Link>
              <button
                ref={desktopMenuBtnRef}
                type="button"
                onClick={() => setOpen(true)}
                aria-expanded={open}
                aria-label="সকল সেবা ও বিভাগ ড্রয়ার খুলুন"
                className="inline-flex items-center gap-1.5 whitespace-nowrap py-1 transition-colors hover:text-[#0F4D3A]"
              >
                <LayoutGrid className="h-4 w-4 shrink-0 text-[#0F4D3A]" strokeWidth={1.5} />
                <span>সকল সেবা</span>
              </button>
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              {!isOnline && (
                <span
                  className="hidden lg:inline-flex h-10 items-center gap-1 rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] px-2.5 font-bangla text-xs font-medium text-[#5F5F5A]"
                  title="অফলাইন মোড সক্রিয়"
                >
                  <WifiOff className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                  <span>অফলাইন</span>
                </span>
              )}

              {/* Control 1 (Always Visible): Search */}
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="অনুসন্ধান"
                className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] font-bangla text-xs font-medium text-[#1C1C1C] transition-colors hover:border-[#0F4D3A] hover:text-[#0F4D3A] lg:h-10 lg:w-auto lg:gap-1.5 lg:px-3"
                title="অনুসন্ধান (Ctrl+K)"
              >
                <Search className="h-[18px] w-[18px] text-[#0F4D3A]" strokeWidth={1.5} />
                <span className="hidden lg:inline">অনুসন্ধান</span>
              </button>

              {/* Desktop-only Notifications & Admin Dashboard (available in Navigation Drawer on mobile) */}
              <div className="hidden lg:flex items-center gap-2">
                <NotificationBell />
                {isAuthed && (isMainAdmin || isStaff) && (
                  <Link
                    to="/mdmahmudulhashan"
                    className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-[#C62828]/30 bg-white px-3 font-bangla text-xs font-semibold text-[#C62828] transition-colors hover:bg-[#FAF7F2]"
                    title="এডমিন ড্যাশবোর্ড"
                    aria-label="এডমিন ড্যাশবোর্ড"
                  >
                    <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                    <span>ড্যাশবোর্ড</span>
                  </Link>
                )}
              </div>

              {/* Control 2 (Always Visible): Profile */}
              <Link
                to="/profile"
                aria-label={isAuthed && user?.displayName ? `${user.displayName} — আমার প্রোফাইল` : "আমার প্রোফাইল"}
                title={isAuthed && user?.displayName ? `${user.displayName} — আমার প্রোফাইল` : "আমার প্রোফাইল"}
                className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#E6E1D6] bg-[#FAF7F2] text-[#0F4D3A] transition-colors hover:border-[#0F4D3A] lg:h-10 lg:w-10"
              >
                {isAuthed && user?.photoURL && !avatarError ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "আমার প্রোফাইল"}
                    onError={() => setAvatarError(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserIcon className="h-[18px] w-[18px] text-[#0F4D3A]" strokeWidth={1.5} />
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
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5F5F5A]" strokeWidth={1.5} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "অনুসন্ধান করুন..."}
        className="w-full min-w-0 rounded-[12px] border border-[#E6E1D6] bg-white py-3 pl-10 pr-24 text-sm text-[#1C1C1C] placeholder:text-[#5F5F5A] outline-none transition focus:border-[#0F4D3A] focus:ring-2 focus:ring-[#0F4D3A]/15"
      />
      {onOpenDialog && (
        <button
          type="button"
          onClick={onOpenDialog}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex min-h-[34px] items-center gap-1 rounded-[8px] border border-[#E6E1D6] bg-[#FAF7F2] px-2.5 py-1 text-[11px] font-semibold text-[#0F4D3A] transition hover:border-[#0F4D3A]"
        >
          <Search className="h-3 w-3" strokeWidth={1.5} /> খুঁজুন
        </button>
      )}
    </div>
  );
}