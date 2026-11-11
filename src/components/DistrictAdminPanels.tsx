import { useState } from "react";
import {
  Building2,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ShieldCheck,
  Search,
  ExternalLink,
  Clock,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useInstitutions,
  updateInstitution,
  deleteInstitution,
  useJobCirculars,
  updateJobCircular,
  deleteJobCircular,
  useComplaints,
  updateComplaintStatus,
  NOAKHALI_UPAZILAS,
  type Institution,
  type JobCircular,
  type ComplaintTrackingItem,
  type ComplaintStatus,
} from "@/lib/district-platform";

// =========================================================================
// 1. INSTITUTIONS & BUSINESSES ADMIN PANEL
// =========================================================================
export function InstitutionsAdminPanel() {
  const { institutions, loading } = useInstitutions();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterUpazila, setFilterUpazila] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filtered = institutions.filter((inst) => {
    const matchesStatus = filterStatus === "all" || inst.status === filterStatus;
    const matchesUpazila = filterUpazila === "all" || inst.upazila === filterUpazila;
    const target = `${inst.name} ${inst.en_name || ""} ${inst.category} ${inst.upazila} ${inst.phone || ""}`.toLowerCase();
    const matchesSearch = !search.trim() || target.includes(search.toLowerCase());
    return matchesStatus && matchesUpazila && matchesSearch;
  });

  const handleApprove = async (inst: Institution) => {
    setProcessingId(inst.id);
    try {
      await updateInstitution(inst.id, { status: "approved" });
      toast.success(`${inst.name} অনুমোদিত হয়েছে`);
    } catch (err: any) {
      toast.error(err?.message || "অনুমোদনে সমস্যা হয়েছে");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (inst: Institution) => {
    setProcessingId(inst.id);
    try {
      await updateInstitution(inst.id, { status: "rejected" });
      toast.success(`${inst.name} বাতিল করা হয়েছে`);
    } catch (err: any) {
      toast.error(err?.message || "বাতিল করতে সমস্যা হয়েছে");
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleVerified = async (inst: Institution) => {
    setProcessingId(inst.id);
    try {
      await updateInstitution(inst.id, { verified: !inst.verified });
      toast.success(inst.verified ? "ভেরিফিকেশন সরানো হয়েছে" : "প্রতিষ্ঠান ভেরিফাইড করা হয়েছে");
    } catch (err: any) {
      toast.error(err?.message || "হালনাগাদ করতে সমস্যা হয়েছে");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (inst: Institution) => {
    if (!window.confirm(`আপনি কি নিশ্চিত যে "${inst.name}" স্থায়ীভাবে মুছে ফেলতে চান?`)) return;
    setProcessingId(inst.id);
    try {
      await deleteInstitution(inst.id);
      toast.success("প্রতিষ্ঠান মুছে ফেলা হয়েছে");
    } catch (err: any) {
      toast.error(err?.message || "মুছে ফেলতে সমস্যা হয়েছে");
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = institutions.filter((i) => i.status === "pending").length;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-base font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            প্রতিষ্ঠান ও ব্যবসা পরিচালনা ({institutions.length} টি)
          </h2>
          <p className="text-xs text-muted-foreground">
            নাগরিকদের জমাকৃত ও নিবন্ধিত প্রতিষ্ঠানের তালিকা যাচাই, অনুমোদন এবং ভেরিফাই করুন।
          </p>
        </div>

        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-700">
            <Clock className="h-3.5 w-3.5" /> {pendingCount} টি যাচাইয়ের অপেক্ষায়
          </span>
        )}
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="নাম বা ক্যাটাগরি দিয়ে খুঁজুন..."
            className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-xs outline-none focus:border-primary"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          aria-label="Filter institutions by status"
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none focus:border-primary"
        >
          <option value="all">সকল স্ট্যাটাস</option>
          <option value="pending">পেন্ডিং (যাচাই প্রয়োজন)</option>
          <option value="approved">অনুমোদিত</option>
          <option value="rejected">বাতিলকৃত</option>
        </select>

        <select
          value={filterUpazila}
          onChange={(e) => setFilterUpazila(e.target.value)}
          aria-label="Filter institutions by upazila"
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none focus:border-primary"
        >
          <option value="all">সকল উপজেলা</option>
          {NOAKHALI_UPAZILAS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          কোনো প্রতিষ্ঠান পাওয়া যায়নি।
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inst) => {
            const isProcessing = processingId === inst.id;
            return (
              <div
                key={inst.id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm transition hover:border-primary/40 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        inst.status === "approved"
                          ? "bg-emerald-500/15 text-emerald-700"
                          : inst.status === "rejected"
                          ? "bg-red-500/15 text-red-700"
                          : "bg-amber-500/15 text-amber-700"
                      }`}
                    >
                      {inst.status === "approved" ? "অনুমোদিত" : inst.status === "rejected" ? "বাতিল" : "পেন্ডিং"}
                    </span>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                      {inst.category}
                    </span>
                    <span className="text-[11px] font-medium text-primary">
                      📍 {inst.upazila}
                    </span>
                    {inst.verified && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.2 text-[10px] font-bold text-emerald-700 border border-emerald-500/30">
                        <CheckCircle2 className="h-2.5 w-2.5" /> ভেরিফাইড
                      </span>
                    )}
                  </div>

                  <h3 className="mt-1 font-display text-sm font-bold text-foreground">
                    {inst.name}
                  </h3>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {inst.address}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    {inst.phone && (
                      <span className="font-mono text-primary font-medium">📞 {inst.phone}</span>
                    )}
                    {inst.website && (
                      <a
                        href={inst.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-primary hover:underline"
                      >
                        ওয়েবসাইট <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
                  {inst.status !== "approved" && (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => void handleApprove(inst)}
                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> অনুমোদন
                    </button>
                  )}

                  {inst.status !== "rejected" && (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => void handleReject(inst)}
                      className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted active:scale-95 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> বাতিল
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => void handleToggleVerified(inst)}
                    className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition active:scale-95 disabled:opacity-50 ${
                      inst.verified
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
                        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                    }`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {inst.verified ? "আনভেরিফাই" : "ভেরিফাই"}
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => void handleDelete(inst)}
                    className="inline-flex items-center justify-center rounded-xl p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:opacity-50"
                    title="মুছে ফেলুন"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 2. EDUCATION & CAREER ADMIN PANEL
// =========================================================================
export function JobsAdminPanel() {
  const { jobCirculars, loading } = useJobCirculars();
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filtered = jobCirculars.filter((c: JobCircular) => {
    const matchesType = filterType === "all" || c.job_type === filterType;
    const matchesStatus = filterStatus === "all" || c.status === filterStatus;
    const target = `${c.title} ${c.organization} ${c.job_type} ${c.upazila || ""}`.toLowerCase();
    const matchesSearch = !search.trim() || target.includes(search.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });

  const handleApprove = async (circ: JobCircular) => {
    setProcessingId(circ.id);
    try {
      await updateJobCircular(circ.id, { status: "approved" });
      toast.success(`${circ.title} অনুমোদিত হয়েছে`);
    } catch (err: any) {
      toast.error(err?.message || "অনুমোদনে সমস্যা হয়েছে");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (circ: JobCircular) => {
    setProcessingId(circ.id);
    try {
      await updateJobCircular(circ.id, { status: "rejected" });
      toast.success(`${circ.title} বাতিল করা হয়েছে`);
    } catch (err: any) {
      toast.error(err?.message || "বাতিল করতে সমস্যা হয়েছে");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (circ: JobCircular) => {
    if (!window.confirm(`আপনি কি "${circ.title}" বিজ্ঞপ্তিটি মুছে ফেলতে চান?`)) return;
    setProcessingId(circ.id);
    try {
      await deleteJobCircular(circ.id);
      toast.success("বিজ্ঞপ্তি মুছে ফেলা হয়েছে");
    } catch (err: any) {
      toast.error(err?.message || "মুছে ফেলতে সমস্যা হয়েছে");
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = jobCirculars.filter((c: JobCircular) => c.status === "pending").length;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-base font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            শিক্ষা ও ক্যারিয়ার বিজ্ঞপ্তি পরিচালনা ({jobCirculars.length} টি)
          </h2>
          <p className="text-xs text-muted-foreground">
            চাকরি ও শিক্ষা সংক্রান্ত বিজ্ঞপ্তি প্রকাশ, অনুমোদন ও পরিচালনা করুন।
          </p>
        </div>

        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-700">
            <Clock className="h-3.5 w-3.5" /> {pendingCount} টি পেন্ডিং
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="পদবী বা প্রতিষ্ঠান দিয়ে খুঁজুন..."
            className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-xs outline-none focus:border-primary"
          />
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          aria-label="Filter circulars by type"
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none focus:border-primary"
        >
          <option value="all">সকল ধরন</option>
          <option value="govt">সরকারি চাকরি</option>
          <option value="private">বেসরকারি চাকরি</option>
          <option value="local_noakhali">নোয়াখালী স্থানীয় চাকরি</option>
          <option value="scholarship">বৃত্তি ও ফেলোশিপ</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          aria-label="Filter circulars by status"
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none focus:border-primary"
        >
          <option value="all">সকল স্ট্যাটাস</option>
          <option value="pending">পেন্ডিং</option>
          <option value="approved">অনুমোদিত</option>
          <option value="rejected">বাতিলকৃত</option>
        </select>
      </div>

      {/* Circulars List */}
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          কোনো বিজ্ঞপ্তি পাওয়া যায়নি।
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((circ: JobCircular) => {
            const isProcessing = processingId === circ.id;
            return (
              <div
                key={circ.id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-primary/15 text-primary">
                      {circ.job_type}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        circ.status === "approved"
                          ? "bg-emerald-500/15 text-emerald-700"
                          : circ.status === "rejected"
                          ? "bg-red-500/15 text-red-700"
                          : "bg-amber-500/15 text-amber-700"
                      }`}
                    >
                      {circ.status === "approved" ? "অনুমোদিত" : circ.status === "rejected" ? "বাতিল" : "পেন্ডিং"}
                    </span>
                  </div>

                  <h3 className="mt-1 font-display text-sm font-bold text-foreground">
                    {circ.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    🏢 {circ.organization}
                    {circ.upazila && ` • 📍 ${circ.upazila}`}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                    {circ.deadline && (
                      <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                        শেষ সময়: {circ.deadline}
                      </span>
                    )}
                    {circ.application_link && (
                      <a
                        href={circ.application_link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-primary hover:underline"
                      >
                        আবেদন লিঙ্ক <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1.5 sm:justify-end">
                  {circ.status !== "approved" && (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => void handleApprove(circ)}
                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> অনুমোদন
                    </button>
                  )}

                  {circ.status !== "rejected" && (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => void handleReject(circ)}
                      className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted active:scale-95 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> বাতিল
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => void handleDelete(circ)}
                    className="inline-flex items-center justify-center rounded-xl p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:opacity-50"
                    title="মুছে ফেলুন"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 3. CITIZEN COMPLAINT TRACKING ADMIN PANEL
// =========================================================================
export function ComplaintsAdminPanel() {
  const { complaints, loading } = useComplaints();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintTrackingItem | null>(null);
  const [newStatus, setNewStatus] = useState<ComplaintStatus>("under_review");
  const [adminNote, setAdminNote] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const filtered = complaints.filter((comp) => {
    const matchesStatus = filterStatus === "all" || comp.status === filterStatus;
    const target = `${comp.tracking_number} ${comp.user_name || ""} ${comp.subject} ${comp.category} ${comp.upazila} ${comp.contact_phone || ""}`.toLowerCase();
    const matchesSearch = !search.trim() || target.includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleOpenStatusModal = (comp: ComplaintTrackingItem) => {
    setSelectedComplaint(comp);
    setNewStatus(comp.status);
    setAdminNote(comp.admin_remarks || "");
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    setSavingStatus(true);
    try {
      await updateComplaintStatus(
        selectedComplaint.id,
        newStatus,
        adminNote.trim() || undefined,
        "এডমিন টিম"
      );
      toast.success(`অভিযোগ #${selectedComplaint.tracking_number}-এর স্ট্যাটাস সফলভাবে আপডেট হয়েছে!`);
      setSelectedComplaint(null);
    } catch (err: any) {
      toast.error(err?.message || "স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে");
    } finally {
      setSavingStatus(false);
    }
  };

  const pendingTotal = complaints.filter(
    (c) => c.status === "submitted" || c.status === "under_review"
  ).length;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-base font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            নাগরিক অভিযোগ ও ট্র্যাকিং পরিচালনা ({complaints.length} টি)
          </h2>
          <p className="text-xs text-muted-foreground">
            নাগরিকদের অভিযোগ পর্যবেক্ষণ, তদন্ত প্রক্রিয়ার অগ্রগতি হালনাগাদ ও সমাধান প্রদান করুন।
          </p>
        </div>

        {pendingTotal > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-700">
            <Clock className="h-3.5 w-3.5" /> {pendingTotal} টি প্রক্রিয়াধীন
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ট্র্যাকিং নং, অভিযোগকারীর নাম বা বিষয় দিয়ে খুঁজুন..."
            className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-xs outline-none focus:border-primary"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          aria-label="Filter complaints by status"
          className="rounded-xl border border-border bg-card px-3 py-2 text-xs outline-none focus:border-primary"
        >
          <option value="all">সকল অভিযোগ</option>
          <option value="submitted">নতুন জমা (Submitted)</option>
          <option value="under_review">পর্যালোচনা চলছে (Under Review)</option>
          <option value="in_progress">কার্যক্রম চলমান (In Progress)</option>
          <option value="resolved">সমাধান সম্পন্ন (Resolved)</option>
          <option value="rejected">বাতিলকৃত (Rejected)</option>
        </select>
      </div>

      {/* Complaints List */}
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          কোনো নাগরিক অভিযোগ পাওয়া যায়নি।
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((comp) => {
            return (
              <div
                key={comp.id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm hover:border-primary/40 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                      #{comp.tracking_number}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        comp.status === "resolved"
                          ? "bg-emerald-500/15 text-emerald-700"
                          : comp.status === "rejected"
                          ? "bg-red-500/15 text-red-700"
                          : comp.status === "in_progress"
                          ? "bg-blue-500/15 text-blue-700"
                          : "bg-amber-500/15 text-amber-700"
                      }`}
                    >
                      {comp.status === "resolved"
                        ? "সমাধান সম্পন্ন"
                        : comp.status === "rejected"
                        ? "বাতিল"
                        : comp.status === "in_progress"
                        ? "কার্যক্রম চলমান"
                        : comp.status === "under_review"
                        ? "পর্যালোচনা চলছে"
                        : "নতুন জমা"}
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {comp.category}
                    </span>
                    <span className="text-[11px] font-medium text-primary">
                      📍 {comp.upazila}
                    </span>
                  </div>

                  <h3 className="mt-1 font-display text-sm font-bold text-foreground">
                    {comp.subject}
                  </h3>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {comp.description}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    {comp.user_name && <span>নাগরিক: <strong>{comp.user_name}</strong></span>}
                    {comp.contact_phone && <span className="font-mono">📞 {comp.contact_phone}</span>}
                    {comp.location && <span>স্থান: {comp.location}</span>}
                  </div>

                  {comp.admin_remarks && (
                    <div className="mt-2 rounded-xl bg-muted/60 p-2.5 text-xs text-muted-foreground border border-border/60">
                      <span className="font-bold text-foreground">এডমিন নোট:</span> {comp.admin_remarks}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => handleOpenStatusModal(comp)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-hero px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm active:scale-95"
                  >
                    <Clock className="h-3.5 w-3.5" /> স্ট্যাটাস পরিবর্তন
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Status Update Modal */}
      {selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-display text-sm font-bold text-foreground">
                  অভিযোগ স্ট্যাটাস ও সমাধান আপডেট
                </h3>
                <p className="font-mono text-xs text-primary font-bold">
                  #{selectedComplaint.tracking_number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedComplaint(null)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStatus} className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  বর্তমান স্ট্যাটাস নির্বাচন করুন *
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as ComplaintStatus)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                >
                  <option value="submitted">নতুন জমা (Submitted)</option>
                  <option value="under_review">পর্যালোচনা চলছে (Under Review)</option>
                  <option value="in_progress">কার্যক্রম চলমান (In Progress)</option>
                  <option value="resolved">সমাধান সম্পন্ন (Resolved)</option>
                  <option value="rejected">বাতিল (Rejected)</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">
                  সমাধান নোট বা নাগরিকের জন্য বার্তা
                </label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="যেমন: সংশ্লিষ্ট উপজেলা নির্বাহী কর্মকর্তার কার্যালয়ে প্রেরণ করা হয়েছে এবং সমাধান করা হয়েছে..."
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background p-3 text-xs outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedComplaint(null)}
                  className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={savingStatus}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-hero px-5 py-2 text-xs font-bold text-primary-foreground shadow-sm disabled:opacity-60"
                >
                  {savingStatus ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> সংরক্ষণ হচ্ছে...
                    </>
                  ) : (
                    "হালনাগাদ করুন"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
