import { AlertTriangle, Phone, ChevronLeft, ChevronRight, X, Building2 } from "lucide-react";
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
    <div className="mt-4">
      <div className="relative overflow-hidden rounded-[12px] border border-[#C62828] bg-[#C62828] p-4 text-white">
        <button
          type="button"
          onClick={dismiss}
          aria-label="বন্ধ করুন"
          className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-[8px] bg-white/15 transition hover:bg-white/25"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <div className="flex items-start gap-3 pr-8">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-white/25 bg-white/10 text-white">
            <AlertTriangle className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-sm font-bold leading-tight">{cur.title}</p>
              {cur.blood_group && (
                <span className="rounded-[6px] bg-white px-2 py-0.5 text-[11px] font-bold text-[#C62828]">
                  {cur.blood_group}
                </span>
              )}
            </div>
            <p className="mt-1 break-words text-sm leading-relaxed text-white/95">{cur.message}</p>
            {cur.hospital && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-white/90">
                <Building2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                <span>{cur.hospital}</span>
              </p>
            )}
            {cur.phone && (
              <div className="mt-2.5">
                <a
                  href={`tel:${cur.phone}`}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] bg-white px-4 py-1.5 text-xs font-bold text-[#C62828] transition hover:bg-[#FAF7F2]"
                >
                  <Phone className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span>{cur.phone}</span>
                </a>
              </div>
            )}
            {shown.length > 1 && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[11px] text-white/85">{idx + 1}/{shown.length}</span>
                <div className="ml-auto flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIdx((i) => (i - 1 + shown.length) % shown.length)}
                    className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white/15 text-white hover:bg-white/25"
                    aria-label="পূর্ববর্তী"
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIdx((i) => (i + 1) % shown.length)}
                    className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white/15 text-white hover:bg-white/25"
                    aria-label="পরবর্তী"
                  >
                    <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
