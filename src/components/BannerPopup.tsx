import { useEffect, useState } from "react";
import { X, Phone, ChevronLeft, ChevronRight } from "lucide-react";
import { useEmergencyBanners } from "@/lib/cloud";

export function BannerPopup() {
  const { items } = useEmergencyBanners();
  const activeEmergencies = items.filter((b) => b.visible).slice(0, 10);
  const [ebDismissed, setEbDismissed] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(sessionStorage.getItem("eb-dismissed") || "[]"); } catch { return []; }
  });
  const ebShown = activeEmergencies.filter((b) => !ebDismissed.includes(`${b.id}:${b.updated_at}`));
  const [ebIdx, setEbIdx] = useState(0);
  useEffect(() => { if (ebIdx >= ebShown.length) setEbIdx(0); }, [ebShown.length, ebIdx]);

  if (ebShown.length > 0) {
    const cur = ebShown[Math.min(ebIdx, ebShown.length - 1)];
    const dismissEb = () => {
      const next = [...ebDismissed, `${cur.id}:${cur.updated_at}`];
      setEbDismissed(next);
      try { sessionStorage.setItem("eb-dismissed", JSON.stringify(next)); } catch { /* noop */ }
    };
    return (
      <div className="fixed inset-x-0 bottom-4 z-50 mx-auto max-w-md px-4 animate-float-in">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-green-800 to-emerald-900 p-5 text-white shadow-elevated ring-1 ring-emerald-300/20">
          <button onClick={dismissEb} aria-label="বন্ধ" className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25">
            <X className="h-4 w-4 text-white" />
          </button>
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative pr-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xl">📢</span>
              <p className="font-display text-lg font-extrabold leading-tight tracking-tight">{cur.title}</p>
                {cur.blood_group && (
                <span className="rounded-md bg-yellow-300 px-2 py-0.5 text-[11px] font-extrabold text-emerald-900 shadow-sm">{cur.blood_group}</span>
                )}
            </div>
            <p className="mt-2 break-words text-[15px] font-medium leading-relaxed text-white/95">{cur.message}</p>
            {cur.hospital && <p className="mt-1 text-xs text-white/85">🏥 {cur.hospital}</p>}
            {cur.phone && (
              <a href={`tel:${cur.phone}`} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-yellow-400 px-5 py-2.5 text-sm font-extrabold text-emerald-950 shadow-md transition hover:bg-yellow-300 active:scale-95">
                <Phone className="h-4 w-4" /> {cur.phone}
              </a>
            )}
            {ebShown.length > 1 && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] text-white/80">{ebIdx + 1}/{ebShown.length}</span>
                <div className="ml-auto flex gap-1">
                  <button onClick={() => setEbIdx((i) => (i - 1 + ebShown.length) % ebShown.length)} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 hover:bg-white/25" aria-label="পূর্ববর্তী"><ChevronLeft className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setEbIdx((i) => (i + 1) % ebShown.length)} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 hover:bg-white/25" aria-label="পরবর্তী"><ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}