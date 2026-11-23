import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  Calendar,
  Check,
  Clock,
  Copy,
  Droplet,
  ExternalLink,
  Info,
  MapPin,
  Phone,
  Plus,
  Share2,
  ShieldCheck,
  User,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  getEmergencyUrgencyMeta,
  isEmergencyRequestPubliclyActive,
  sortEmergencyRequestsPublic,
  useEmergencyRequests,
  type EmergencyReqRow,
} from "@/lib/cloud";

function formatShortDateBn(dateStr?: string | null): string {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const [y, m, d] = trimmed.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return trimmed;
  const today = new Date();
  const isToday =
    dt.getFullYear() === today.getFullYear() &&
    dt.getMonth() === today.getMonth() &&
    dt.getDate() === today.getDate();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const isTomorrow =
    dt.getFullYear() === tomorrow.getFullYear() &&
    dt.getMonth() === tomorrow.getMonth() &&
    dt.getDate() === tomorrow.getDate();
  try {
    const formatted = dt.toLocaleDateString("bn-BD", {
      day: "numeric",
      month: "short",
    });
    if (isToday) return `আজ (${formatted})`;
    if (isTomorrow) return `আগামীকাল (${formatted})`;
    return formatted;
  } catch {
    return trimmed;
  }
}

function formatTimeBn(timeStr?: string | null): string {
  if (!timeStr) return "";
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{2}):(\d{2})/);
  if (!match) return trimmed;
  const h24 = Number(match[1]);
  const m = Number(match[2]);
  if (Number.isNaN(h24) || Number.isNaN(m)) return trimmed;
  const dt = new Date();
  dt.setHours(h24, m, 0, 0);
  try {
    return dt.toLocaleTimeString("bn-BD", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return trimmed;
  }
}

function formatRelativePublished(iso?: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const diffMin = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (diffMin < 1) return "এইমাত্র অনুমোদিত";
  if (diffMin < 60) return `${diffMin.toLocaleString("bn-BD")} মিনিট আগে`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr.toLocaleString("bn-BD")} ঘণ্টা আগে`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay.toLocaleString("bn-BD")} দিন আগে`;
}

function formatLocationSummary(req: EmergencyReqRow): string {
  const parts = [req.upazila, req.district].filter((p) => Boolean(p && p.trim()));
  if (parts.length > 0) return parts.join(", ");
  if (req.address && req.address.trim()) return req.address.trim();
  return "নোয়াখালী";
}

function formatGenderBn(g?: string): string {
  if (g === "male") return "পুরুষ";
  if (g === "female") return "নারী";
  if (g === "other") return "অন্যান্য";
  return "";
}

export function EmergencyBloodSection() {
  const { items, loading } = useEmergencyRequests();
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");
  const [activeDetail, setActiveDetail] = useState<EmergencyReqRow | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeRequests = useMemo(() => {
    const filtered = items.filter((r) => isEmergencyRequestPubliclyActive(r));
    return sortEmergencyRequestsPublic(filtered);
  }, [items]);

  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    activeRequests.forEach((r) => {
      if (r.blood_group) set.add(r.blood_group);
    });
    return Array.from(set);
  }, [activeRequests]);

  const displayedRequests = useMemo(() => {
    if (selectedGroup === "ALL") return activeRequests;
    return activeRequests.filter((r) => r.blood_group === selectedGroup);
  }, [activeRequests, selectedGroup]);

  if (loading && activeRequests.length === 0) {
    return null;
  }

  if (activeRequests.length === 0) {
    return null;
  }

  async function copyPhone(phone: string, key: string) {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedId(key);
      toast.success("নম্বর কপি হয়েছে");
      setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      toast.error("কপি করা যায়নি");
    }
  }

  async function shareRequest(req: EmergencyReqRow) {
    const loc = formatLocationSummary(req);
    const bags = Number(req.bags_needed || 1);
    const text = [
      `জরুরি ${req.blood_group} রক্ত প্রয়োজন (${bags} ব্যাগ)`,
      req.patient_name ? `রোগী: ${req.patient_name}` : "",
      req.hospital ? `হাসপাতাল: ${req.hospital}` : "",
      `এলাকা: ${loc}`,
      req.needed_date ? `তারিখ: ${formatShortDateBn(req.needed_date)}${req.needed_time ? ` · ${formatTimeBn(req.needed_time)}` : ""}` : "",
      req.consent_public !== false && req.phone ? `যোগাযোগ: ${req.phone}` : "",
      `— স্মার্ট নোয়াখালী (smartnoakhali.com)`,
    ]
      .filter(Boolean)
      .join("\n");

    if (navigator.share) {
      try {
        await navigator.share({
          title: `জরুরি ${req.blood_group} রক্ত প্রয়োজন`,
          text,
        });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("জরুরি রক্তের তথ্য কপি হয়েছে, এখন শেয়ার করুন");
    } catch {
      toast.error("শেয়ার করা যায়নি");
    }
  }

  return (
    <section aria-labelledby="emergency-blood-heading" className="mt-5">
      <div className="rounded-[12px] border border-[#E6E1D6] bg-white p-4 sm:p-5">
        {/* Section Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6E1D6] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#C62828]/10 text-[#C62828]">
              <Droplet className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="emergency-blood-heading"
                  className="font-display text-base font-bold text-[#1C1C1C] sm:text-lg"
                >
                  জরুরি রক্তের অনুরোধ
                </h2>
                <span className="rounded-[6px] bg-[#C62828]/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#C62828]">
                  {activeRequests.length.toLocaleString("bn-BD")}টি সক্রিয়
                </span>
              </div>
              <p className="text-xs text-[#5F5F5A]">
                যাচাইকৃত ও এডমিন অনুমোদিত জরুরি রক্তের চাহিদা
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/blood-donor"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] px-3 py-1.5 text-xs font-semibold text-[#1C1C1C] transition hover:border-[#0F4D3A] hover:text-[#0F4D3A]"
            >
              <Users className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>রক্তদাতা খুঁজুন</span>
            </Link>
            <Link
              to="/emergency-request"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] bg-[#C62828] px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#B71C1C]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              <span>রক্তের অনুরোধ</span>
            </Link>
          </div>
        </div>

        {/* Blood group quick filter chips when multiple groups exist */}
        {availableGroups.length > 1 && (
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedGroup("ALL")}
              className={`min-h-[36px] shrink-0 rounded-[8px] px-3 text-xs font-semibold transition ${
                selectedGroup === "ALL"
                  ? "bg-[#1C1C1C] text-white"
                  : "border border-[#E6E1D6] bg-[#FAF7F2] text-[#5F5F5A] hover:text-[#1C1C1C]"
              }`}
            >
              সব ({activeRequests.length.toLocaleString("bn-BD")})
            </button>
            {availableGroups.map((bg) => (
              <button
                key={bg}
                type="button"
                onClick={() => setSelectedGroup(bg)}
                className={`min-h-[36px] shrink-0 rounded-[8px] px-3 text-xs font-bold transition ${
                  selectedGroup === bg
                    ? "bg-[#C62828] text-white"
                    : "border border-[#E6E1D6] bg-[#FAF7F2] text-[#C62828] hover:border-[#C62828]/40"
                }`}
              >
                {bg}
              </button>
            ))}
          </div>
        )}

        {/* Cards Grid */}
        <div className="mt-3.5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {displayedRequests.map((req) => {
            const urgencyMeta = getEmergencyUrgencyMeta(req.urgency);
            const bags = Math.max(1, Number(req.bags_needed ?? 1));
            const locationText = formatLocationSummary(req);
            const dateText = formatShortDateBn(req.needed_date);
            const timeText = formatTimeBn(req.needed_time);
            const scheduleText =
              dateText || timeText
                ? [dateText, timeText].filter(Boolean).join(" · ")
                : "যত দ্রুত সম্ভব";
            const canShowPhone = req.consent_public !== false && Boolean(req.phone);
            const publishedAgo = formatRelativePublished(
              req.approved_at || req.approvedAt || req.updated_at || req.created_at
            );

            return (
              <article
                key={req.id}
                className="flex flex-col justify-between rounded-[12px] border border-[#E6E1D6] bg-[#FAF7F2]/55 p-3.5 transition-colors hover:border-[#C62828]/40"
              >
                <div>
                  {/* Top row: Blood Group + Bags + Urgency */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[10px] bg-[#C62828] text-white">
                        <span className="font-display text-base font-extrabold leading-none tracking-tight">
                          {req.blood_group}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-[6px] border border-[#E6E1D6] bg-white px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#1C1C1C]">
                            {bags.toLocaleString("bn-BD")} ব্যাগ
                          </span>
                          <span
                            className={`rounded-[6px] px-2 py-0.5 text-[11px] font-bold ${urgencyMeta.badgeClass}`}
                          >
                            {urgencyMeta.label}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs font-semibold text-[#1C1C1C]">
                          রোগী: {req.patient_name}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Metadata Rows */}
                  <dl className="mt-3 space-y-1.5 text-xs text-[#5F5F5A]">
                    <div className="flex items-start gap-2">
                      <Building2
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0F4D3A]"
                        strokeWidth={1.6}
                      />
                      <dd className="line-clamp-1 font-medium text-[#1C1C1C]">
                        {req.hospital?.trim() || "হাসপাতাল উল্লেখ নেই"}
                      </dd>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5F5F5A]"
                        strokeWidth={1.6}
                      />
                      <dd className="line-clamp-1">{locationText}</dd>
                    </div>
                    <div className="flex items-start gap-2">
                      <Calendar
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C62828]"
                        strokeWidth={1.6}
                      />
                      <dd className="line-clamp-1 font-medium text-[#1C1C1C] tabular-nums">
                        {scheduleText}
                      </dd>
                    </div>
                  </dl>

                  {req.message && (
                    <p className="mt-2.5 line-clamp-2 rounded-[8px] border border-[#E6E1D6] bg-white px-2.5 py-1.5 text-[11.5px] leading-relaxed text-[#5F5F5A]">
                      {req.message}
                    </p>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="mt-3 pt-2.5 border-t border-[#E6E1D6]">
                  {publishedAgo && (
                    <p className="mb-2 flex items-center gap-1 text-[10.5px] text-[#5F5F5A]">
                      <ShieldCheck className="h-3 w-3 text-[#0F4D3A]" strokeWidth={1.6} />
                      <span>যাচাইকৃত · {publishedAgo}</span>
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    {canShowPhone && (
                      <a
                        href={`tel:${req.phone}`}
                        className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#C62828] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#B71C1C]"
                      >
                        <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                        <span className="truncate">কল করুন</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveDetail(req)}
                      className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[10px] border border-[#E6E1D6] bg-white px-3.5 py-2 text-xs font-semibold text-[#1C1C1C] transition hover:border-[#0F4D3A] hover:text-[#0F4D3A] ${
                        canShowPhone ? "" : "flex-1"
                      }`}
                    >
                      <Info className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
                      <span>বিস্তারিত</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Details Modal */}
      {activeDetail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="emergency-detail-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => setActiveDetail(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-[16px] border border-[#E6E1D6] bg-white p-5 sm:rounded-[14px]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[#E6E1D6] pb-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-[#C62828] font-display text-lg font-extrabold text-white">
                  {activeDetail.blood_group}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3
                      id="emergency-detail-title"
                      className="font-display text-base font-bold text-[#1C1C1C]"
                    >
                      জরুরি রক্তের বিস্তারিত তথ্য
                    </h3>
                    <span
                      className={`rounded-[6px] px-2 py-0.5 text-[10.5px] font-bold ${
                        getEmergencyUrgencyMeta(activeDetail.urgency).badgeClass
                      }`}
                    >
                      {getEmergencyUrgencyMeta(activeDetail.urgency).label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#5F5F5A] tabular-nums">
                    {activeDetail.request_code
                      ? `অনুরোধ নং: ${activeDetail.request_code}`
                      : "যাচাইকৃত জরুরি অনুরোধ"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveDetail(null)}
                aria-label="বন্ধ করুন"
                className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[#E6E1D6] bg-[#FAF7F2] text-[#5F5F5A] hover:text-[#1C1C1C]"
              >
                <X className="h-4 w-4" strokeWidth={1.6} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="mt-4 space-y-3 text-xs">
              {/* Patient & Blood Summary */}
              <div className="grid grid-cols-2 gap-2.5 rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] p-3">
                <div>
                  <p className="text-[11px] text-[#5F5F5A]">রোগীর নাম</p>
                  <p className="mt-0.5 font-semibold text-[#1C1C1C]">
                    {activeDetail.patient_name}
                  </p>
                  {(activeDetail.patient_age !== null &&
                    activeDetail.patient_age !== undefined) ||
                  formatGenderBn(activeDetail.patient_gender) ? (
                    <p className="mt-0.5 text-[11px] text-[#5F5F5A]">
                      {[
                        activeDetail.patient_age !== null &&
                        activeDetail.patient_age !== undefined
                          ? `বয়স: ${Number(activeDetail.patient_age).toLocaleString("bn-BD")} বছর`
                          : "",
                        formatGenderBn(activeDetail.patient_gender),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="text-[11px] text-[#5F5F5A]">প্রয়োজনীয় পরিমাণ ও সময়</p>
                  <p className="mt-0.5 font-bold text-[#C62828] tabular-nums">
                    {activeDetail.blood_group} ·{" "}
                    {Math.max(1, Number(activeDetail.bags_needed ?? 1)).toLocaleString("bn-BD")} ব্যাগ
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#1C1C1C] tabular-nums">
                    {activeDetail.needed_date || activeDetail.needed_time
                      ? [
                          formatShortDateBn(activeDetail.needed_date),
                          formatTimeBn(activeDetail.needed_time),
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : "যত দ্রুত সম্ভব"}
                  </p>
                </div>
              </div>

              {/* Hospital & Location */}
              <div className="space-y-2 rounded-[10px] border border-[#E6E1D6] bg-white p-3">
                <div className="flex items-start gap-2">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0F4D3A]" strokeWidth={1.6} />
                  <div>
                    <p className="text-[11px] text-[#5F5F5A]">হাসপাতাল / ক্লিনিক</p>
                    <p className="font-semibold text-[#1C1C1C]">
                      {activeDetail.hospital?.trim() || "উল্লেখ করা হয়নি"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#5F5F5A]" strokeWidth={1.6} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-[#5F5F5A]">জেলা ও উপজেলা / ঠিকানা</p>
                    <p className="font-medium text-[#1C1C1C]">
                      {formatLocationSummary(activeDetail)}
                    </p>
                    {activeDetail.address && (
                      <p className="mt-0.5 text-[11px] text-[#5F5F5A]">{activeDetail.address}</p>
                    )}
                    {activeDetail.map_link && (
                      <a
                        href={activeDetail.map_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 rounded-[8px] border border-[#E6E1D6] bg-[#FAF7F2] px-2.5 py-1 text-[11px] font-semibold text-[#0F4D3A] hover:border-[#0F4D3A]"
                      >
                        <ExternalLink className="h-3 w-3" strokeWidth={1.6} />
                        Google Maps-এ দেখুন
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Medical message & special instructions */}
              {(activeDetail.message || activeDetail.instructions) && (
                <div className="space-y-2 rounded-[10px] border border-[#E6E1D6] bg-white p-3">
                  {activeDetail.message && (
                    <div>
                      <p className="text-[11px] font-semibold text-[#5F5F5A]">বিস্তারিত বিবরণ</p>
                      <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-[#1C1C1C]">
                        {activeDetail.message}
                      </p>
                    </div>
                  )}
                  {activeDetail.instructions && (
                    <div className={activeDetail.message ? "border-t border-[#E6E1D6] pt-2" : ""}>
                      <p className="text-[11px] font-semibold text-[#5F5F5A]">বিশেষ নির্দেশনা</p>
                      <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-[#1C1C1C]">
                        {activeDetail.instructions}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Requester & Contact */}
              <div className="rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] p-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 shrink-0 text-[#0F4D3A]" strokeWidth={1.6} />
                  <p className="font-semibold text-[#1C1C1C]">
                    আবেদনকারী:{" "}
                    {activeDetail.requester_name?.trim() || "অভিভাবক / আত্মীয়"}
                    {activeDetail.relation ? ` (${activeDetail.relation})` : ""}
                  </p>
                </div>

                {activeDetail.consent_public !== false && activeDetail.phone ? (
                  <div className="mt-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${activeDetail.phone}`}
                        className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#C62828] px-3 py-2 text-xs font-bold text-white hover:bg-[#B71C1C]"
                      >
                        <Phone className="h-3.5 w-3.5" strokeWidth={1.75} />
                        কল করুন: {activeDetail.phone}
                      </a>
                      <button
                        type="button"
                        onClick={() => void copyPhone(activeDetail.phone, "primary")}
                        aria-label="ফোন নম্বর কপি করুন"
                        className="inline-flex min-h-[44px] items-center gap-1 rounded-[10px] border border-[#E6E1D6] bg-white px-3 text-xs font-semibold text-[#1C1C1C] hover:border-[#0F4D3A]"
                      >
                        {copiedId === "primary" ? (
                          <Check className="h-3.5 w-3.5 text-[#0F4D3A]" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        কপি
                      </button>
                    </div>
                    {activeDetail.alt_phone && (
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${activeDetail.alt_phone}`}
                          className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-[#E6E1D6] bg-white px-3 py-1.5 text-xs font-semibold text-[#1C1C1C] hover:border-[#0F4D3A]"
                        >
                          <Phone className="h-3.5 w-3.5 text-[#0F4D3A]" strokeWidth={1.6} />
                          বিকল্প নম্বর: {activeDetail.alt_phone}
                        </a>
                        <button
                          type="button"
                          onClick={() => void copyPhone(activeDetail.alt_phone || "", "alt")}
                          aria-label="বিকল্প নম্বর কপি করুন"
                          className="inline-flex min-h-[40px] items-center gap-1 rounded-[10px] border border-[#E6E1D6] bg-white px-3 text-xs font-semibold text-[#1C1C1C] hover:border-[#0F4D3A]"
                        >
                          {copiedId === "alt" ? (
                            <Check className="h-3.5 w-3.5 text-[#0F4D3A]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          কপি
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-[#5F5F5A]">
                    গোপনীয়তার কারণে যোগাযোগ নম্বর প্রদর্শিত হচ্ছে না।
                  </p>
                )}
              </div>

              {/* Modal Bottom Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void shareRequest(activeDetail)}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-[#E6E1D6] bg-white px-3 text-xs font-semibold text-[#1C1C1C] hover:border-[#0F4D3A]"
                >
                  <Share2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                  তথ্য শেয়ার করুন
                </button>
                <Link
                  to="/blood-donor"
                  onClick={() => setActiveDetail(null)}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#0F4D3A] px-3 text-xs font-semibold text-white hover:bg-[#0B3C2D]"
                >
                  <Clock className="h-3.5 w-3.5" strokeWidth={1.6} />
                  রক্তদাতা খুঁজুন
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


