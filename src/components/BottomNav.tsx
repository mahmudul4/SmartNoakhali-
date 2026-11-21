import { Link, useRouterState } from "@tanstack/react-router";
import { Home, MapPin, Droplet, AlertTriangle, User } from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "হোম", icon: Home },
  { to: "/map", label: "ম্যাপ", icon: MapPin },
  { to: "/blood-donor", label: "রক্ত", icon: Droplet },
  { to: "/complaint-tracking", label: "অভিযোগ", icon: AlertTriangle },
  { to: "/profile", label: "আমি", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Hide BottomNav on full-screen live chat screen so message composer stays unobstructed
  if (pathname === "/chat" || pathname.startsWith("/chat/")) {
    return null;
  }

  return (
    <nav
      aria-label="মোবাইল বটম নেভিগেশন"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E6E1D6] bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="grid h-[60px] grid-cols-5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const isActive =
            to === "/"
              ? pathname === "/"
              : pathname === to || pathname.startsWith(`${to}/`);

          return (
            <Link
              key={to}
              to={to}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex min-h-[48px] min-w-[48px] flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? "text-[#0F4D3A]" : "text-[#5F5F5A] hover:text-[#1C1C1C]"
              }`}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-3 top-0 h-[2px] rounded-full bg-[#0F4D3A]"
                />
              )}
              <Icon className="h-[20px] w-[20px]" strokeWidth={isActive ? 2 : 1.5} />
              <span className={`font-bangla text-[11px] leading-none ${isActive ? "font-semibold" : "font-normal"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
