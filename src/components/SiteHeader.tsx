import { Link, useNavigate } from "@tanstack/react-router";
import {
  Menu,
  Search,
  LogIn,
  LogOut,
  ShieldCheck,
  User as UserIcon,
  WifiOff,
  MapPin,
  Building2,
  Briefcase,
  AlertTriangle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useLogo, useCategories } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { NotificationBell } from "@/lib/notifications";
import { useNetworkStatus } from "@/lib/tasks";
import { SmartSearchModal } from "@/components/SmartSearchDialog";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const navigate = useNavigate();
  const { logo } = useLogo();
  const { categories } = useCategories();
  const { isAuthed, isStaff, isAdmin, isMainAdmin, user, signOut } = useAuth();
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    setAvatarError(false);
  }, [user?.photoURL]);

  // Keyboard shortcut Ctrl+K / Cmd+K
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
      <header className="sticky top-0 z-40 w-full max-w-[100vw] overflow-x-hidden border-t-2 border-amber-400/80 border-b border-emerald-200/15 bg-[#063924]/[0.97] text-white shadow-[0_6px_24px_-10px_rgba(4,35,22,0.5)] backdrop-blur-md">
        <div className="flex w-full min-w-0 items-center justify-between gap-2 px-3.5 py-2 sm:gap-4 sm:px-6 sm:py-2.5 lg:gap-6 lg:px-8 xl:px-10 2xl:px-12">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 lg:flex-none">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger
                aria-label="মেনু খুলুন"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] text-white transition-colors hover:bg-white/[0.16] active:scale-95 sm:h-10 sm:w-10"
              >
                <Menu className="h-[18px] w-[18px]" />
              </SheetTrigger>
              <SheetContent side="left" className="w-72 max-w-[85vw] overflow-y-auto border-sidebar-border bg-sidebar text-sidebar-foreground">
                <div className="mb-6 mt-2 flex items-center gap-3 border-b border-sidebar-border/70 pb-4">
                  <div className="flex h-13 w-13 shrink-0 items-center justify-center p-0.5">
                    <img
                      src={logo}
                      alt="Smart Noakhali Logo"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-brand text-[19px] font-extrabold tracking-tight text-white">
                      Smart Noakhali
                    </p>
                    <p className="mt-0.5 text-xs font-semibold tracking-wide text-amber-300">
                      স্মার্ট নোয়াখালী
                    </p>
                  </div>
                </div>

                <nav className="flex flex-col gap-1 pb-6">
                  <Link to="/" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-sidebar-accent">
                    হোম
                  </Link>

                  <div className="my-1 border-t border-sidebar-border/60" />
                  <p className="px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-amber-300/90">
                    নাগরিক ও জেলা সেবা
                  </p>
                  <Link
                    to="/map"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-sidebar-accent"
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-amber-300" />
                    <span>নোয়াখালী ম্যাপ ও দূরত্ব</span>
                  </Link>
                  <Link
                    to="/directory"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-sidebar-accent"
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-amber-300" />
                    <span>প্রতিষ্ঠান ও ব্যবসা ডিরেক্টরি</span>
                  </Link>
                  <Link
                    to="/career"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-sidebar-accent"
                  >
                    <Briefcase className="h-4 w-4 shrink-0 text-amber-300" />
                    <span>শিক্ষা ও ক্যারিয়ার হাব</span>
                  </Link>
                  <Link
                    to="/complaint-tracking"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-sidebar-accent"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
                    <span>নাগরিক অভিযোগ ট্র্যাকিং</span>
                  </Link>
                  <Link
                    to="/profile"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-sidebar-accent"
                  >
                    <UserIcon className="h-4 w-4 shrink-0 text-amber-300" />
                    <span>আমার প্রোফাইল ও বুকমার্ক</span>
                  </Link>

                  <div className="my-1 border-t border-sidebar-border/60" />
                  <p className="px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-amber-300/90">
                    প্রধান ক্যাটাগরিসমূহ
                  </p>
                  {categories
                    .filter((c) => c.slug !== "chat" && c.slug !== "app-download")
                    .map((c) => {
                      const common = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent";
                      if (c.customRoute) {
                        const cleanRoute = c.customRoute.trim();
                        if (cleanRoute.startsWith("/")) {
                          return (
                            <Link key={c.slug} to={cleanRoute as "/"} onClick={() => setOpen(false)} className={common}>
                              <c.icon className="h-4 w-4 shrink-0 text-gold" />
                              <span className="truncate">{c.bn}</span>
                            </Link>
                          );
                        }
                        if (/^https?:\/\//i.test(cleanRoute)) {
                          return (
                            <a key={c.slug} href={cleanRoute} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className={common}>
                              <c.icon className="h-4 w-4 shrink-0 text-gold" />
                              <span className="truncate">{c.bn}</span>
                            </a>
                          );
                        }
                      }
                      if (c.slug === "submit-info")
                        return <Link key={c.slug} to="/submit-info" onClick={() => setOpen(false)} className={common}><c.icon className="h-4 w-4 shrink-0 text-gold" /><span className="truncate">{c.bn}</span></Link>;
                      if (c.slug === "donation")
                        return <Link key={c.slug} to="/donation" onClick={() => setOpen(false)} className={common}><c.icon className="h-4 w-4 shrink-0 text-gold" /><span className="truncate">{c.bn}</span></Link>;
                      if (c.slug === "about")
                        return <Link key={c.slug} to="/about" onClick={() => setOpen(false)} className={common}><c.icon className="h-4 w-4 shrink-0 text-gold" /><span className="truncate">{c.bn}</span></Link>;
                      if (c.slug === "board-result")
                        return <Link key={c.slug} to="/board-result" onClick={() => setOpen(false)} className={common}><c.icon className="h-4 w-4 shrink-0 text-gold" /><span className="truncate">{c.bn}</span></Link>;
                      if (c.slug === "blood-donor")
                        return <Link key={c.slug} to="/blood-donor" onClick={() => setOpen(false)} className={common}><c.icon className="h-4 w-4 shrink-0 text-gold" /><span className="truncate">{c.bn}</span></Link>;
                      if (c.slug === "emergency-request")
                        return <Link key={c.slug} to="/emergency-request" onClick={() => setOpen(false)} className={common}><c.icon className="h-4 w-4 shrink-0 text-gold" /><span className="truncate">{c.bn}</span></Link>;
                      return (
                        <Link key={c.slug} to="/category/$slug" params={{ slug: c.slug }} onClick={() => setOpen(false)} className={common}>
                          <c.icon className="h-4 w-4 shrink-0 text-gold" />
                          <span className="truncate">{c.bn}</span>
                        </Link>
                      );
                    })}
                  <div className="my-2 h-px bg-sidebar-border" />
                  {isAuthed && (isMainAdmin || isStaff) && (
                    <Link
                      to="/mdmahmudulhashan"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-lg bg-gold/15 px-3 py-2 text-sm font-semibold text-gold transition hover:bg-gold/25"
                    >
                      <ShieldCheck className="h-4 w-4 shrink-0 text-gold" /> ড্যাশবোর্ড / এডমিন প্যানেল
                    </Link>
                  )}
                  {isAuthed ? (
                    <>
                      <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground">
                        <UserIcon className="h-4 w-4 shrink-0 text-gold" />
                        <span className="truncate">{user?.email || user?.displayName || "ব্যবহারকারী"}</span>
                        {isAdmin && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-gold" />}
                      </div>
                      <button onClick={() => void handleHeaderLogout()} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent">
                        <LogOut className="h-4 w-4 shrink-0 text-gold" /> লগআউট
                      </button>
                    </>
                  ) : (
                    <Link to="/auth" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent">
                      <LogIn className="h-4 w-4 shrink-0 text-gold" /> লগইন / নিবন্ধন
                    </Link>
                  )}
                </nav>
              </SheetContent>
            </Sheet>

            {/* Brand Lockup: Crisp Official Logo + Authoritative Typography */}
            <Link to="/" className="group flex min-w-0 items-center gap-2.5 sm:gap-3">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] p-0.5 ring-1 ring-white/15 min-[360px]:h-10 min-[360px]:w-10 sm:h-11 sm:w-11">
                <img
                  src={logo}
                  alt="Smart Noakhali Logo"
                  loading="eager"
                  decoding="sync"
                  className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.04]"
                />
              </div>
              <div className="min-w-0 text-left leading-tight">
                <span className="block truncate font-brand text-[15px] font-extrabold tracking-tight text-white min-[360px]:text-[17px] sm:text-[20px] lg:text-[21px]">
                  Smart Noakhali
                </span>
                <span className="block truncate font-bangla text-[10.5px] font-semibold tracking-wide text-amber-300/95 min-[360px]:text-[11px] sm:text-[11.5px]">
                  স্মার্ট নোয়াখালী
                </span>
              </div>
            </Link>
          </div>

          {/* Balanced Desktop Navigation */}
          <nav aria-label="প্রধান নেভিগেশন" className="hidden lg:flex items-center gap-1 xl:gap-2 text-[13.5px] font-semibold text-emerald-50/90">
            <Link to="/" className="whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 transition-colors hover:bg-white/10 hover:text-white">
              হোম
            </Link>
            <Link to="/directory" className="whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 transition-colors hover:bg-white/10 hover:text-white">
              ডিরেক্টরি
            </Link>
            <Link to="/blood-donor" className="whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 transition-colors hover:bg-white/10 hover:text-white">
              রক্তদাতা
            </Link>
            <Link to="/map" className="whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 transition-colors hover:bg-white/10 hover:text-white">
              জেলা ম্যাপ
            </Link>
            <Link to="/submit-info" className="whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 transition-colors hover:bg-white/10 hover:text-white">
              তথ্য দিন
            </Link>
          </nav>

          {/* Right Action Cluster */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="স্মার্ট সার্চ"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] text-xs font-semibold text-white transition-colors hover:bg-white/[0.16] active:scale-95 sm:w-auto sm:gap-1.5 sm:px-3"
              title="স্মার্ট সার্চ (Ctrl+K)"
            >
              <Search className="h-4 w-4 text-amber-300" />
              <span className="hidden sm:inline">সার্চ</span>
              <kbd className="hidden xl:inline-block rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-100/80">
                ⌘K
              </kbd>
            </button>

            {!isOnline && (
              <span
                className="flex h-9 items-center gap-1 rounded-xl border border-amber-300/40 bg-amber-500/20 px-2 text-[10.5px] font-bold text-amber-200 animate-pulse"
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
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-300/40 bg-amber-400/15 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-400/25 sm:w-auto sm:gap-1.5 sm:px-3"
                title="সিকিউরিটি / এডমিন ড্যাশবোর্ড"
                aria-label="সিকিউরিটি ড্যাশবোর্ড"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-amber-300" />
                <span className="hidden md:inline">ড্যাশবোর্ড</span>
              </Link>
            )}

            <Link
              to="/profile"
              aria-label={isAuthed && user?.displayName ? `${user.displayName} — আমার প্রোফাইল` : "আমার প্রোফাইল"}
              title={isAuthed && user?.displayName ? `${user.displayName} — আমার প্রোফাইল` : "আমার প্রোফাইল"}
              className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/75 bg-white/15 text-white shadow-sm ring-1 ring-white/20 transition hover:border-amber-300 hover:ring-amber-300/50 active:scale-95 sm:h-9 sm:w-9"
            >
              {isAuthed && user?.photoURL && !avatarError ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "আমার প্রোফাইল"}
                  onError={() => setAvatarError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserIcon className="h-4 w-4 text-white" />
              )}
            </Link>
          </div>
        </div>
      </header>

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