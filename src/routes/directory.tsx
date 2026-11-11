import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Building2,
  Store,
  Utensils,
  Hospital,
  Activity,
  GraduationCap,
  BookOpen,
  Truck,
  MapPin,
  Phone,
  Search,
  Filter,
  CheckCircle,
  PlusCircle,
  Navigation,
  Globe,
  Mail,
  Clock,
  Sparkles,
  ExternalLink,
  AlertTriangle,
  Send,
  X,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useInstitutions,
  INSTITUTION_CATEGORIES,
  NOAKHALI_UPAZILAS,
  type Institution,
  type InstitutionCategory,
} from "@/lib/district-platform";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/directory")({
  head: () => ({
    meta: [
      { title: "ব্যবসা ও প্রতিষ্ঠান ডিরেক্টরি — স্মার্ট নোয়াখালী" },
      {
        name: "description",
        content:
          "নোয়াখালীর দোকান, ব্যবসা প্রতিষ্ঠান, রেস্টুরেন্ট, হাসপাতাল, শিক্ষা প্রতিষ্ঠান ও সরকারি অফিসের পূর্ণাঙ্গ ডিরেক্টরি ও যোগাযোগ।",
      },
    ],
  }),
  component: DirectoryPage,
});

function DirectoryPage() {
  const { user } = useAuth();
  const { approvedInstitutions, createInstitution } = useInstitutions();
  const searchParams = useSearch({ strict: false }) as { id?: string; category?: string; upazila?: string };

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>(searchParams.category || "all");
  const [selectedUpazila, setSelectedUpazila] = useState<string>(searchParams.upazila || "all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [activeInstitution, setActiveInstitution] = useState<Institution | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportNote, setReportNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // New Institution Form State
  const [newInst, setNewInst] = useState({
    name: "",
    en_name: "",
    category: "shop_business" as InstitutionCategory,
    type: "",
    description: "",
    address: "",
    upazila: "নোয়াখালী সদর (মাইজদী)",
    union: "",
    phone: "",
    email: "",
    website: "",
    google_maps_url: "",
    opening_hours: "সকাল ৯:০০ - রাত ৮:০০",
  });

  // Filtered List
  const filtered = useMemo(() => {
    return approvedInstitutions.filter((item) => {
      const matchCategory = selectedCategory === "all" || item.category === selectedCategory;
      const matchUpazila = selectedUpazila === "all" || item.upazila === selectedUpazila;
      const matchVerified = !verifiedOnly || item.verified;

      const q = search.trim().toLowerCase();
      const matchQuery =
        !q ||
        `${item.name} ${item.en_name || ""} ${item.description} ${item.address} ${item.type || ""} ${item.phone}`
          .toLowerCase()
          .includes(q);

      return matchCategory && matchUpazila && matchVerified && matchQuery;
    });
  }, [approvedInstitutions, selectedCategory, selectedUpazila, verifiedOnly, search]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInst.name.trim() || !newInst.phone.trim() || !newInst.address.trim()) {
      return toast.error("অনুগ্রহ করে প্রতিষ্ঠানের নাম, ঠিকানা ও ফোন নম্বর প্রদান করুন।");
    }

    setSubmitting(true);
    try {
      await createInstitution({
        ...newInst,
        verified: false,
        featured: false,
        status: "pending",
        submitted_by_uid: user?.uid,
        submitted_by_name: user?.displayName || user?.email || "নাগরিক",
      });
      toast.success("আপনার প্রতিষ্ঠানের তথ্য জমা হয়েছে! অ্যাডমিন পর্যালোচনার পর এটি ডিরেক্টরিতে প্রকাশিত হবে।");
      setShowAddModal(false);
      setNewInst({
        name: "",
        en_name: "",
        category: "shop_business",
        type: "",
        description: "",
        address: "",
        upazila: "নোয়াখালী সদর (মাইজদী)",
        union: "",
        phone: "",
        email: "",
        website: "",
        google_maps_url: "",
        opening_hours: "সকাল ৯:০০ - রাত ৮:০০",
      });
    } catch {
      toast.error("তথ্য জমা দিতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportNote.trim()) return toast.error("রিপোর্টের বিবরণ লিখুন।");
    toast.success("আপনার রিপোর্ট জমা নেওয়া হয়েছে। দ্রুত তথ্যটি যাচাই করা হবে। ধন্যবাদ!");
    setShowReportModal(false);
    setReportNote("");
  };

  const handleShare = (inst: Institution) => {
    if (navigator.share) {
      navigator.share({
        title: `${inst.name} — স্মার্ট নোয়াখালী ডিরেক্টরি`,
        text: `${inst.name} • ${inst.address} • ফোন: ${inst.phone}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${inst.name} • ${inst.phone} • https://smartnoakhali.com/directory`);
      toast.success("প্রতিষ্ঠানের তথ্য কপি করা হয়েছে!");
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl overflow-x-hidden px-3.5 pb-24 pt-4 sm:px-4">
      {/* Header Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-elevated">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur">
              <Building2 className="h-3 w-3 text-gold" /> নোয়াখালী জেলা ডিরেক্টরি
            </span>
            <h1 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">
              ব্যবসা ও প্রতিষ্ঠান ডিরেক্টরি
            </h1>
            <p className="mt-1 text-xs opacity-90 sm:text-sm">
              দোকান, হোটেল, রেস্টুরেন্ট, ক্লিনিক ও প্রতিষ্ঠানের ঠিকানা এবং জরুরি যোগাযোগ।
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 self-start rounded-full bg-gradient-gold px-4 py-2 text-xs font-bold text-primary-deep shadow-gold active:scale-95 transition"
          >
            <PlusCircle className="h-4 w-4" /> প্রতিষ্ঠান যোগ করুন
          </button>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <div className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        {/* Search Input */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="প্রতিষ্ঠানের নাম, ধরণ, ঠিকানা বা ফোন নম্বর দিয়ে খুঁজুন..."
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-10 text-xs sm:text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          )}
        </div>

        {/* Dropdowns & Checkbox */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
          >
            <option value="all">সকল ক্যাটাগরি</option>
            {INSTITUTION_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.bn}
              </option>
            ))}
          </select>

          {/* Upazila Dropdown */}
          <select
            value={selectedUpazila}
            onChange={(e) => setSelectedUpazila(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
          >
            <option value="all">সকল উপজেলা (নোয়াখালী)</option>
            {NOAKHALI_UPAZILAS.map((upz) => (
              <option key={upz} value={upz}>
                {upz}
              </option>
            ))}
          </select>

          {/* Verified Only Checkbox */}
          <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold select-none">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="rounded text-primary focus:ring-0"
            />
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> ভেরিফায়েড শুধু
            </span>
          </label>

          <span className="ml-auto text-xs font-bold text-primary">
            {filtered.length} টি প্রতিষ্ঠান প্রাপ্ত
          </span>
        </div>
      </div>

      {/* Directory Grid */}
      {filtered.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-border p-12 text-center">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-3 font-display text-base font-bold text-foreground">
            কোনো প্রতিষ্ঠান পাওয়া যায়নি
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            আপনার অনুসন্ধান ফিল্টার পরিবর্তন করুন অথবা আপনার প্রতিষ্ঠানটি যুক্ত করুন।
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setSelectedCategory("all");
              setSelectedUpazila("all");
              setVerifiedOnly(false);
            }}
            className="mt-4 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
          >
            ফিল্টার রিসেট করুন
          </button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((inst) => (
            <div
              key={inst.id}
              onClick={() => setActiveInstitution(inst)}
              className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-4 shadow-card hover:border-primary/40 hover:shadow-elevated transition cursor-pointer"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
                      {inst.logo_url ? (
                        <img src={inst.logo_url} alt={inst.name} className="h-full w-full object-cover rounded-xl" />
                      ) : (
                        <Building2 className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {inst.type || "প্রতিষ্ঠান"}
                      </span>
                      {inst.verified && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700">
                          <CheckCircle className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-bold text-primary truncate max-w-[110px]">
                    {inst.upazila.split(" ")[0]}
                  </span>
                </div>

                <h3 className="mt-2.5 font-display text-sm font-bold text-foreground group-hover:text-primary transition line-clamp-1">
                  {inst.name}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {inst.description}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-border/60">
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground line-clamp-1">
                  <MapPin className="h-3 w-3 shrink-0 text-primary" /> {inst.address}
                </p>

                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <a
                    href={`tel:${inst.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary/10 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 active:scale-95 transition"
                  >
                    <Phone className="h-3.5 w-3.5" /> কল করুন
                  </a>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveInstitution(inst);
                    }}
                    className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted active:scale-95 transition"
                  >
                    বিস্তারিত
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Institution Detail Modal */}
      {activeInstitution && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <button
              type="button"
              onClick={() => setActiveInstitution(null)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                {activeInstitution.type || "প্রতিষ্ঠান"}
              </span>
              {activeInstitution.verified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-500/20">
                  <CheckCircle className="h-3 w-3" /> ভেরিফায়েড প্রতিষ্ঠান
                </span>
              )}
            </div>

            <h2 className="mt-2 font-display text-lg sm:text-xl font-bold text-foreground">
              {activeInstitution.name}
            </h2>
            {activeInstitution.en_name && (
              <p className="text-xs text-muted-foreground">{activeInstitution.en_name}</p>
            )}

            <p className="mt-3 text-xs sm:text-sm text-foreground/90 leading-relaxed">
              {activeInstitution.description}
            </p>

            <div className="mt-4 space-y-2 rounded-2xl bg-muted/40 p-3 text-xs">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <span>
                  <strong>ঠিকানা:</strong> {activeInstitution.address}, {activeInstitution.upazila}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-primary" />
                <span>
                  <strong>ফোন:</strong> <a href={`tel:${activeInstitution.phone}`} className="text-primary font-mono underline">{activeInstitution.phone}</a>
                </span>
              </div>
              {activeInstitution.opening_hours && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <strong>সময়সূচি:</strong> {activeInstitution.opening_hours}
                  </span>
                </div>
              )}
              {activeInstitution.website && (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 shrink-0 text-primary" />
                  <a
                    href={activeInstitution.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline flex items-center gap-1"
                  >
                    ওয়েবসাইট পরিদর্শন করুন <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a
                href={`tel:${activeInstitution.phone}`}
                className="flex items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
              >
                <Phone className="h-4 w-4" /> সরাসরি কল করুন
              </a>

              {activeInstitution.google_maps_url ? (
                <a
                  href={activeInstitution.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-full border border-border bg-card py-2.5 text-xs font-bold text-foreground hover:bg-muted transition"
                >
                  <Navigation className="h-4 w-4 text-primary" /> ম্যাপে দেখুন
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => handleShare(activeInstitution)}
                  className="flex items-center justify-center gap-2 rounded-full border border-border bg-card py-2.5 text-xs font-bold text-foreground hover:bg-muted transition"
                >
                  <Share2 className="h-4 w-4" /> শেয়ার করুন
                </button>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
              <span>তথ্যটি সঠিক মনে না হলে রিপোর্ট করুন:</span>
              <button
                type="button"
                onClick={() => {
                  setShowReportModal(true);
                }}
                className="flex items-center gap-1 text-destructive hover:underline font-semibold"
              >
                <AlertTriangle className="h-3 w-3" /> ভুল তথ্য রিপোর্ট
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Institution Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="font-display text-lg font-bold text-foreground">
              আপনার প্রতিষ্ঠান যুক্ত করুন
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              নোয়াখালীর যেকোনো ব্যবসা, দোকান, হাসপাতাল বা সেবামূলক প্রতিষ্ঠানের তথ্য বিনামূল্যে যুক্ত করুন।
            </p>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-foreground">প্রতিষ্ঠানের নাম *</label>
                <input
                  required
                  value={newInst.name}
                  onChange={(e) => setNewInst({ ...newInst, name: e.target.value })}
                  placeholder="যেমন: নোয়াখালী সেন্ট্রাল ফার্মেসি"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-foreground">ক্যাটাগরি *</label>
                  <select
                    value={newInst.category}
                    onChange={(e) => setNewInst({ ...newInst, category: e.target.value as InstitutionCategory })}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
                  >
                    {INSTITUTION_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.bn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground">উপজেলা *</label>
                  <select
                    value={newInst.upazila}
                    onChange={(e) => setNewInst({ ...newInst, upazila: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
                  >
                    {NOAKHALI_UPAZILAS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground">ঠিকানা ও স্থান *</label>
                <input
                  required
                  value={newInst.address}
                  onChange={(e) => setNewInst({ ...newInst, address: e.target.value })}
                  placeholder="যেমন: টাউন হল মোড়, মাইজদী কোর্ট"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-foreground">ফোন নম্বর *</label>
                  <input
                    required
                    value={newInst.phone}
                    onChange={(e) => setNewInst({ ...newInst, phone: e.target.value })}
                    placeholder="01700000000"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground">সময়সূচি</label>
                  <input
                    value={newInst.opening_hours}
                    onChange={(e) => setNewInst({ ...newInst, opening_hours: e.target.value })}
                    placeholder="সকাল ৯:০০ - রাত ৮:০০"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground">প্রতিষ্ঠানের বিবরণ</label>
                <textarea
                  rows={3}
                  value={newInst.description}
                  onChange={(e) => setNewInst({ ...newInst, description: e.target.value })}
                  placeholder="সেবা, পণ্য বা অন্যান্য বিস্তারিত তথ্য..."
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-full bg-muted px-4 py-2 text-xs font-semibold text-foreground"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-primary px-5 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                >
                  {submitting ? "জমা হচ্ছে..." : "জমা দিন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <h3 className="font-display text-base font-bold text-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-destructive" /> ভুল তথ্য রিপোর্ট
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              কোন তথ্যটি ভুল (যেমন: ফোন নম্বর বন্ধ, দোকান স্থানান্তরিত)? বিস্তারিত লিখুন।
            </p>
            <form onSubmit={handleReportSubmit} className="mt-3">
              <textarea
                required
                rows={3}
                value={reportNote}
                onChange={(e) => setReportNote(e.target.value)}
                placeholder="সঠিক তথ্য বা ভুলের বিবরণ লিখুন..."
                className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none focus:border-primary"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-destructive px-4 py-1.5 text-xs font-bold text-destructive-foreground"
                >
                  রিপোর্ট পাঠান
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
