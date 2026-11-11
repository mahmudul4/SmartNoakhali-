import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  FileText,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  Copy,
  Check,
  Send,
  Shield,
  ArrowRight,
  Info,
  Calendar,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  useComplaints,
  lookupComplaintByTrackingNumber,
  COMPLAINT_STATUS_MAP,
  NOAKHALI_UPAZILAS,
  type ComplaintTrackingItem,
  type ComplaintStatus,
} from "@/lib/district-platform";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/complaint-tracking")({
  head: () => ({
    meta: [
      { title: "অভিযোগ ও পরামর্শ ট্র্যাকিং — স্মার্ট নোয়াখালী" },
      {
        name: "description",
        content:
          "নোয়াখালী জেলার নাগরিক সেবা, সড়ক, স্বাস্থ্য, বিদ্যুৎ বা স্থানীয় সমস্যা সংক্রান্ত অভিযোগ দাখিল ও ট্র্যাকিং নম্বর দিয়ে অগ্রগতি যাচাই করুন।",
      },
    ],
  }),
  component: ComplaintTrackingPage,
});

const COMPLAINT_DEPARTMENTS = [
  "রাস্তাঘাট ও যোগাযোগ ব্যবস্থা",
  "বিদ্যুৎ ও জ্বালানি সেবা",
  "হাসপাতাল ও চিকিৎসাসেবা",
  "পৌরসভা ও বর্জ্য ব্যবস্থাপনা",
  "আইনশৃঙ্খলা ও নিরাপত্তা",
  "শিক্ষা প্রতিষ্ঠান ও শিক্ষার্থী সেবা",
  "পরিবেশ ও নদী দূষণ",
  "সরকারি দপ্তর ও নাগরিক সেবা",
  "অন্যান্য সাধারণ নাগরিক সমস্যা",
];

function ComplaintTrackingPage() {
  const { user } = useAuth();
  const { createComplaint } = useComplaints();

  const [activeTab, setActiveTab] = useState<"track" | "submit">("track");
  const [trackingNumberInput, setTrackingNumberInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundComplaint, setFoundComplaint] = useState<ComplaintTrackingItem | null>(null);
  const [searched, setSearched] = useState(false);

  // New Complaint Form
  const [newComplaint, setNewComplaint] = useState({
    category: COMPLAINT_DEPARTMENTS[0],
    subject: "",
    description: "",
    upazila: "নোয়াখালী সদর (মাইজদী)",
    location: "",
    contact_phone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [generatedTracking, setGeneratedTracking] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = trackingNumberInput.trim().toUpperCase();
    if (!clean) return toast.error("ট্র্যাকিং নম্বর প্রদান করুন।");

    setSearching(true);
    setSearched(true);
    try {
      const result = await lookupComplaintByTrackingNumber(clean);
      setFoundComplaint(result);
      if (!result) {
        toast.error("প্রদত্ত ট্র্যাকিং নম্বরে কোনো অভিযোগ খুঁজে পাওয়া যায়নি।");
      }
    } catch {
      toast.error("তথ্য অনুসন্ধানে সমস্যা হয়েছে।");
      setFoundComplaint(null);
    } finally {
      setSearching(false);
    }
  };

  const handleNewComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComplaint.subject.trim() || !newComplaint.description.trim()) {
      return toast.error("অভিযোগের বিষয় ও বিবরণ প্রদান করুন।");
    }

    setSubmitting(true);
    try {
      const trackingNo = await createComplaint({
        category: newComplaint.category,
        subject: newComplaint.subject.trim(),
        description: newComplaint.description.trim(),
        upazila: newComplaint.upazila,
        location: newComplaint.location.trim(),
        contact_phone: newComplaint.contact_phone.trim(),
        user_id: user?.uid,
        user_name: user?.displayName || user?.email || "নাগরিক",
      });

      setGeneratedTracking(trackingNo);
      toast.success("অভিযোগ সফলভাবে দাখিল হয়েছে!");
      setNewComplaint({
        category: COMPLAINT_DEPARTMENTS[0],
        subject: "",
        description: "",
        upazila: "নোয়াখালী সদর (মাইজদী)",
        location: "",
        contact_phone: "",
      });
    } catch {
      toast.error("অভিযোগ জমা দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyTracking = () => {
    if (!generatedTracking) return;
    navigator.clipboard.writeText(generatedTracking);
    setCopied(true);
    toast.success("ট্র্যাকিং নম্বর কপি করা হয়েছে!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto w-full max-w-3xl overflow-x-hidden px-3.5 pb-24 pt-4 sm:px-4">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-elevated">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur">
          <Shield className="h-3 w-3 text-gold" /> নোয়াখালী সিটিজেন ফিডব্যাক ও কমপ্লেইন পোর্টাল
        </span>
        <h1 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">
          অভিযোগ ও পরামর্শ ট্র্যাকিং
        </h1>
        <p className="mt-1 text-xs opacity-90 sm:text-sm">
          নাগরিক সেবা বা স্থানীয় সমস্যার অভিযোগ দাখিল করুন এবং ট্র্যাকিং নম্বর দিয়ে অগ্রগতি পর্যবেক্ষণ করুন।
        </p>

        {/* Tab switch */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("track")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "track"
                ? "bg-white text-primary shadow-sm"
                : "bg-white/15 text-white hover:bg-white/20"
            }`}
          >
            <Search className="h-4 w-4" /> অভিযোগ ট্র্যাক করুন
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("submit")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "submit"
                ? "bg-white text-primary shadow-sm"
                : "bg-white/15 text-white hover:bg-white/20"
            }`}
          >
            <FileText className="h-4 w-4" /> নতুন অভিযোগ দাখিল
          </button>
        </div>
      </section>

      {/* TRACK TAB */}
      {activeTab === "track" && (
        <div className="mt-4 space-y-4">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-display text-base font-bold text-foreground">
              আপনার ট্র্যাকিং নম্বর লিখুন
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              অভিযোগ দাখিলের সময় প্রদত্ত ট্র্যাকিং নম্বর (যেমন: SNK-2611-ABCD) প্রদান করুন।
            </p>

            <form onSubmit={handleTrackSubmit} className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  required
                  type="text"
                  value={trackingNumberInput}
                  onChange={(e) => setTrackingNumberInput(e.target.value.toUpperCase())}
                  placeholder="যেমন: SNK-2611-A1B2"
                  className="w-full rounded-2xl border border-border bg-background py-3 pl-10 pr-3 font-mono text-sm font-bold uppercase tracking-wider outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="flex items-center gap-1.5 rounded-2xl bg-primary px-5 py-3 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition disabled:opacity-50"
              >
                {searching ? "খোঁজা হচ্ছে..." : "ট্র্যাক করুন"}
              </button>
            </form>
          </div>

          {/* Result Card */}
          {searched && foundComplaint && (
            <div className="rounded-3xl border border-border bg-card p-5 shadow-elevated animate-in fade-in">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-md">
                    {foundComplaint.tracking_number}
                  </span>
                  <h3 className="mt-2 font-display text-base sm:text-lg font-bold text-foreground">
                    {foundComplaint.subject}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-medium">{foundComplaint.category}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-primary" /> {foundComplaint.upazila}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {new Date(foundComplaint.created_at).toLocaleDateString("bn-BD")}
                    </span>
                  </div>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold border ${
                    COMPLAINT_STATUS_MAP[foundComplaint.status]?.badgeClass || "bg-muted text-muted-foreground"
                  }`}
                >
                  {COMPLAINT_STATUS_MAP[foundComplaint.status]?.label || foundComplaint.status}
                </span>
              </div>

              {/* Status Stepper Timeline */}
              <div className="mt-6 border-t border-border pt-4">
                <h4 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  অগ্রগতি ও সময়রেখা (Progress Timeline)
                </h4>

                <div className="mt-4 space-y-4">
                  {foundComplaint.status_history && foundComplaint.status_history.length > 0 ? (
                    foundComplaint.status_history.map((hist, idx) => (
                      <div key={idx} className="relative flex items-start gap-3 pl-2">
                        {idx !== foundComplaint.status_history!.length - 1 && (
                          <div className="absolute left-[15px] top-6 bottom-0 w-0.5 bg-border" />
                        )}
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary border border-primary/30">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1 rounded-xl bg-muted/40 p-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-foreground">
                              {COMPLAINT_STATUS_MAP[hist.status]?.label || hist.status}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {new Date(hist.updated_at).toLocaleString("bn-BD", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {hist.note && (
                            <p className="mt-1 text-xs text-foreground/80 leading-relaxed">
                              {hist.note}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">
                        অভিযোগ সফলভাবে দাখিল হয়েছে।
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Resolution / Admin note if present */}
              {foundComplaint.resolution_details && (
                <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <h5 className="font-display text-xs font-bold text-emerald-800">
                    কর্তৃপক্ষের নিষ্পত্তিসূচক মন্তব্য:
                  </h5>
                  <p className="mt-1 text-xs text-emerald-950 leading-relaxed">
                    {foundComplaint.resolution_details}
                  </p>
                </div>
              )}
            </div>
          )}

          {searched && !foundComplaint && !searching && (
            <div className="rounded-3xl border border-dashed border-border p-8 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-destructive/60" />
              <p className="mt-2 text-xs font-bold text-foreground">কোনো তথ্য পাওয়া যায়নি</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                দয়া করে সঠিক ট্র্যাকিং নম্বর দিয়ে পুনরায় চেষ্টা করুন।
              </p>
            </div>
          )}
        </div>
      )}

      {/* SUBMIT TAB */}
      {activeTab === "submit" && (
        <div className="mt-4 space-y-4">
          {generatedTracking ? (
            <div className="rounded-3xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-center animate-in fade-in">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg">
                <Check className="h-8 w-8" />
              </div>
              <h2 className="mt-3 font-display text-lg sm:text-xl font-bold text-emerald-900">
                অভিযোগ সফলভাবে জমা হয়েছে!
              </h2>
              <p className="mt-1 text-xs text-emerald-800">
                ভবিষ্যতে আপনার অভিযোগের অগ্রগতি দেখতে নিচের ট্র্যাকিং নম্বরটি সংরক্ষণ করে রাখুন:
              </p>

              <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-card px-4 py-2.5 shadow-sm">
                <span className="font-mono text-base sm:text-lg font-extrabold text-primary">
                  {generatedTracking}
                </span>
                <button
                  type="button"
                  onClick={handleCopyTracking}
                  className="rounded-full bg-primary/10 p-1.5 text-primary hover:bg-primary/20 transition"
                  aria-label="Copy"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              <div className="mt-5 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTrackingNumberInput(generatedTracking);
                    setActiveTab("track");
                    setGeneratedTracking(null);
                  }}
                  className="rounded-full bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  স্ট্যাটাস দেখুন
                </button>
                <button
                  type="button"
                  onClick={() => setGeneratedTracking(null)}
                  className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  আরেকটি অভিযোগ দিন
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleNewComplaintSubmit} className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-sm">
              <h3 className="font-display text-base font-bold text-foreground">
                নতুন নাগরিক অভিযোগ বা পরামর্শ ফরম
              </h3>
              <p className="text-xs text-muted-foreground">
                সঠিক তথ্য দিয়ে পূরণ করুন। অভিযোগ দাখিলের পর আপনি একটি অনন্য ট্র্যাকিং নম্বর পাবেন।
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-foreground">বিভাগ / খাত *</label>
                  <select
                    value={newComplaint.category}
                    onChange={(e) => setNewComplaint({ ...newComplaint, category: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                  >
                    {COMPLAINT_DEPARTMENTS.map((dept, idx) => (
                      <option key={idx} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground">উপজেলা *</label>
                  <select
                    value={newComplaint.upazila}
                    onChange={(e) => setNewComplaint({ ...newComplaint, upazila: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                  >
                    {NOAKHALI_UPAZILAS.map((upz) => (
                      <option key={upz} value={upz}>
                        {upz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground">অভিযোগের বিষয় / শিরোনাম *</label>
                <input
                  required
                  value={newComplaint.subject}
                  onChange={(e) => setNewComplaint({ ...newComplaint, subject: e.target.value })}
                  placeholder="যেমন: চৌমুহনী কলেজ রোডে জলাবদ্ধতা ও ভাঙা ড্রেন সমস্যা"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground">সুনির্দিষ্ট স্থান / এলাকা</label>
                <input
                  value={newComplaint.location}
                  onChange={(e) => setNewComplaint({ ...newComplaint, location: e.target.value })}
                  placeholder="যেমন: ৩ নং ওয়ার্ড, সোনাপুর বাজার সংলগ্ন"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground">বিস্তারিত বিবরণ *</label>
                <textarea
                  required
                  rows={4}
                  value={newComplaint.description}
                  onChange={(e) => setNewComplaint({ ...newComplaint, description: e.target.value })}
                  placeholder="ঘটনা বা সমস্যার বিস্তারিত বিবরণ দিন..."
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground">যোগাযোগের মোবাইল নম্বর (গোপন রাখা হবে)</label>
                <input
                  value={newComplaint.contact_phone}
                  onChange={(e) => setNewComplaint({ ...newComplaint, contact_phone: e.target.value })}
                  placeholder="01700000000"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{submitting ? "জমা হচ্ছে..." : "অভিযোগ দাখিল করুন"}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
