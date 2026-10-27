import { Link, useNavigate } from "@tanstack/react-router";
import { Menu, Search, LogIn, LogOut, ShieldCheck, User as UserIcon, WifiOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useLogo, useCategories } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { NotificationBell } from "@/lib/notifications";
import { useNetworkStatus } from "@/lib/tasks";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { logo } = useLogo();
  const { categories } = useCategories();
  const { isAuthed, isStaff, isAdmin, isMainAdmin, user, signOut } = useAuth();
  const { isOnline } = useNetworkStatus();

  const handleHeaderLogout = async () => {
    setOpen(false);
    await signOut();
    toast.success("সফলভাবে লগআউট হয়েছে");
    navigate({ to: "/", replace: true });
  };

  return (
    <header className="sticky top-0 z-40 w-full max-w-[100vw] overflow-x-hidden border-b border-gold/25 bg-gradient-hero text-primary-foreground shadow-elevated">
      <div className="mx-auto flex w-full max-w-3xl min-w-0 items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="shrink-0 rounded-xl border border-white/15 bg-white/10 p-2 transition hover:bg-white/20 active:scale-95">
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 max-w-[85vw] overflow-y-auto border-sidebar-border bg-sidebar text-sidebar-foreground">
            <div className="mb-6 mt-2 flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 flex items-center justify-center p-0.5">
                <img
                  src={logo}
                  alt="Smart Noakhali Logo"
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <p className="font-brand text-xl font-black tracking-wide text-brand-shimmer">
                  Smart Noakhali
                </p>
                <p className="mt-0.5 text-xs font-bold tracking-wider text-amber-300">
                  স্মার্ট নোয়াখালী
                </p>
              </div>
            </div>
            <nav className="flex flex-col gap-1 pb-6">
              <Link to="/" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent">হোম</Link>
              {categories
                .filter((c) => c.slug !== "chat" && c.slug !== "app-download")
                .map((c) => {
                  const common = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent";
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
                    <span className="truncate">{user?.email}</span>
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

        <Link to="/" className="group flex min-w-0 flex-1 items-center justify-center gap-2.5">
          <div className="relative h-10 w-10 shrink-0 sm:h-11 sm:w-11 flex items-center justify-center">
            <img
              src={logo}
              alt="Smart Noakhali Logo"
              className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
            />
          </div>
          <div className="min-w-0 text-left leading-none">
            <p className="truncate font-brand text-[17px] font-black tracking-wide text-brand-shimmer sm:text-[21px]">
              Smart Noakhali
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300 shadow-[0_0_6px_#fcd34d]" />
              <p className="truncate text-[11px] font-bold tracking-wider text-amber-200 drop-shadow-sm sm:text-xs">
                স্মার্ট নোয়াখালী
              </p>
            </div>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-1.5">
          {!isOnline && (
            <span
              className="flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-500/25 px-2 py-1 text-[10px] font-bold text-amber-200 animate-pulse"
              title="অফলাইন মোড সক্রিয় — তথ্য ডিভাইসে সেভ হচ্ছে এবং ইন্টারনেট পেলে অটো-সিঙ্ক হবে"
            >
              <WifiOff className="h-3 w-3 shrink-0" />
              <span className="hidden sm:inline">অফলাইন</span>
            </span>
          )}
          <NotificationBell />
          {isAuthed && (isMainAdmin || isStaff) && (
            <Link
              to="/mdmahmudulhashan"
              className="flex shrink-0 items-center gap-1 rounded-full border border-gold/50 bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-gold transition hover:bg-white/20"
              title="ড্যাশবোর্ড / এডমিন প্যানেল"
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span>ড্যাশবোর্ড</span>
            </Link>
          )}
          {isAuthed ? (
            <button onClick={() => void handleHeaderLogout()} className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-white/25 sm:px-3">
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">লগআউট</span>
            </button>
          ) : (
            <Link to="/auth" className="flex shrink-0 items-center gap-1 rounded-full bg-gradient-gold px-2.5 py-1.5 text-xs font-extrabold text-primary-deep shadow-gold transition active:scale-95 sm:px-3">
              <LogIn className="h-3.5 w-3.5 shrink-0" />
              <span>লগইন</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full min-w-0">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "অনুসন্ধান করুন..."}
        className="w-full min-w-0 rounded-2xl border border-border bg-card py-3 pl-10 pr-4 text-sm shadow-card outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}