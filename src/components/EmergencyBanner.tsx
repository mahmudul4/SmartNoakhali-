import { AlertTriangle, Phone, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useEmergencyBanners } from "@/lib/cloud";

export function EmergencyBanner() {
  const { items } = useEmergencyBanners();
  const visible = items.filter((b) => b.visible).slice(0, 10);
  const [idx, setIdx] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(sessionStorage.getItem("eb-dismissed") || "[]"); } catch { return []; }
  });
  const shown = visible.filter((b) => !dismissedIds.includes(b.id));
  useEffect(() => { if (idx >= shown.length) setIdx(0); }, [shown.length, idx]);
  if (shown.length === 0) return null;
  const cur = visible[Math.min(idx, visible.length - 1)];
  const dismiss = () => {
    const next = [...dismissedIds, cur.id];
    setDismissedIds(next);
    try { sessionStorage.setItem("eb-dismissed", JSON.stringify(next)); } catch { /* noop */ }
  };

  return (
    <div className="mt-4 animate-in fade-in slide-in-from-top-2">
      <div className="relative overflow-hidden rounded-2xl border-2 border-red-500/60 bg-gradient-to-br from-red-600 via-red-700 to-rose-800 p-4 text-white shadow-elevated">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-yellow-300/20 blur-2xl" />
        <button onClick={dismiss} aria-label="বন্ধ" className="absolute right-2 top-2 z-10 rounded-full bg-white/15 p-1.5 transition hover:bg-white/30">
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="relative flex items-start gap-3 pr-7">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-yellow-200 shadow-sm ring-1 ring-white/20">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-extrabold leading-tight">🚨 {cur.title}</p>
              {cur.blood_group && (
                <span className="rounded-md bg-yellow-300 px-2 py-0.5 text-[11px] font-extrabold text-red-900 shadow-sm">{cur.blood_group}</span>
              )}
            </div>
            <p className="mt-1 break-words text-sm font-medium opacity-95">{cur.message}</p>
            {cur.hospital && <p className="mt-0.5 text-xs opacity-90">🏥 {cur.hospital}</p>}
            {cur.phone && (
              <div className="mt-2">
                <p className="text-[11px] uppercase tracking-wide opacity-80">যোগাযোগ</p>
                <a href={`tel:${cur.phone}`} className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-yellow-300 px-4 py-1.5 text-xs font-extrabold text-red-900 shadow-sm transition active:scale-95">
                  <Phone className="h-3.5 w-3.5" /> {cur.phone}
                </a>
              </div>
            )}
            {shown.length > 1 && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] opacity-80">{idx + 1}/{shown.length}</span>
                <div className="ml-auto flex gap-1">
                  <button onClick={() => setIdx((i) => (i - 1 + shown.length) % shown.length)} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30" aria-label="পূর্ববর্তী"><ChevronLeft className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setIdx((i) => (i + 1) % shown.length)} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30" aria-label="পরবর্তী"><ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
