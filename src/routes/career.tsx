import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Briefcase,
  GraduationCap,
  Building2,
  Calendar,
  MapPin,
  Clock,
  Search,
  Filter,
  CheckCircle,
  Bookmark,
  Share2,
  ExternalLink,
  Award,
  BookOpen,
  DollarSign,
  AlertCircle,
  Sparkles,
  Layers,
  ChevronRight,
  PlusCircle,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import {
  useJobCirculars,
  NOAKHALI_UPAZILAS,
  useUserFavorites,
  type JobCircular,
  type JobType,
} from "@/lib/district-platform";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/career")({
  head: () => ({
    meta: [
      { title: "শিক্ষা ও ক্যারিয়ার পোর্টাল — স্মার্ট নোয়াখালী" },
      {
        name: "description",
        content:
          "নোয়াখালীর সকল সরকারি, বেসরকারি ও স্থানীয় চাকরির বিজ্ঞপ্তি, ভর্তি তথ্য এবং শিক্ষা প্রতিষ্ঠানের ডিরেক্টরি।",
      },
    ],
  }),
  component: CareerPage,
});

const JOB_TYPE_LABELS: Record<JobType, { label: string; tone: string }> = {
  govt: { label: "সরকারি চাকরি", tone: "bg-emerald-500/15 text-emerald-800 border-emerald-500/30" },
  private: { label: "বেসরকারি চাকরি", tone: "bg-blue-500/15 text-blue-800 border-blue-500/30" },
  local_noakhali: { label: "স্থানীয় নোয়াখালী", tone: "bg-amber-500/15 text-amber-800 border-amber-500/30" },
  internship: { label: "ইন্টার্নশিপ ও প্রশিক্ষণ", tone: "bg-purple-500/15 text-purple-800 border-purple-500/30" },
  scholarship: { label: "স্কলারশিপ ও বৃত্তি", tone: "bg-teal-500/15 text-teal-800 border-teal-500/30" },
};

function CareerPage() {
  const { user } = useAuth();
  const { approvedJobs, createJobCircular } = useJobCirculars();
  const { favorites, toggleFavorite, isFavorite } = useUserFavorites(user?.uid);

  const [activeTab, setActiveTab] = useState<"jobs" | "education">("jobs");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedUpazila, setSelectedUpazila] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [activeJob, setActiveJob] = useState<JobCircular | null>(null);
  const [showAddJob, setShowAddJob] = useState(false);
  const [showExpired, setShowExpired] = useState(false);

  // New Job State
  const [newJob, setNewJob] = useState({
    title: "",
    organization: "",
    job_type: "local_noakhali" as JobType,
    location: "নোয়াখালী সদর (মাইজদী)",
    upazila: "নোয়াখালী সদর (মাইজদী)",
    qualification: "",
    salary: "",
    deadline: "",
    application_link: "",
    description: "",
    how_to_apply: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Filter Jobs
  const filteredJobs = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return approvedJobs.filter((job) => {
      const matchType = selectedType === "all" || job.job_type === selectedType;
      const matchUpazila = selectedUpazila === "all" || job.upazila === selectedUpazila;
      const isExpired = job.deadline ? job.deadline < today : false;
      const matchExpired = showExpired || !isExpired;

      const q = search.trim().toLowerCase();
      const matchQuery =
        !q ||
        `${job.title} ${job.organization} ${job.description} ${job.qualification} ${job.location}`
          .toLowerCase()
          .includes(q);

      return matchType && matchUpazila && matchExpired && matchQuery;
    });
  }, [approvedJobs, selectedType, selectedUpazila, showExpired, search]);

  const handleToggleFavorite = async (job: JobCircular) => {
    if (!user) {
      toast.info("বিজ্ঞপ্তি প্রিয় তালিকায় সংরক্ষণ করতে লগইন করুন।");
      return;
    }
    try {
      await toggleFavorite({
        target_id: job.id,
        target_type: "job",
        title: job.title,
        subtitle: job.organization,
        link: `/career?id=${job.id}`,
      });
      toast.success(
        isFavorite(job.id) ? "বিজ্ঞপ্তি প্রিয় তালিকা থেকে সরানো হয়েছে" : "বিজ্ঞপ্তি প্রিয় তালিকায় সংরক্ষিত হয়েছে!"
      );
    } catch {
      toast.error("বুকমার্ক সংরক্ষণ করা যায়নি");
    }
  };

  const handleShare = (job: JobCircular) => {
    if (navigator.share) {
      navigator.share({
        title: `${job.title} — ${job.organization}`,
        text: `স্মার্ট নোয়াখালী ক্যারিয়ার পোর্টাল: ${job.title} (${job.organization})। আবেদনের শেষ তারিখ: ${job.deadline}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${job.title} • ${job.organization} • শেষ তারিখ: ${job.deadline} • https://smartnoakhali.com/career`);
      toast.success("বিজ্ঞপ্তির বিবরণ লিঙ্ক কপি করা হয়েছে!");
    }
  };

  const handleAddJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJob.title.trim() || !newJob.organization.trim() || !newJob.deadline.trim()) {
      return toast.error("পদ, প্রতিষ্ঠান ও আবেদনের শেষ তারিখ প্রদান করুন।");
    }

    setSubmitting(true);
    try {
      await createJobCircular({
        ...newJob,
        verified: false,
        status: "pending",
      });
      toast.success("চাকরির বিজ্ঞপ্তিটি জমা হয়েছে! পর্যালোচনার পর প্রকাশিত হবে।");
      setShowAddJob(false);
      setNewJob({
        title: "",
        organization: "",
        job_type: "local_noakhali",
        location: "নোয়াখালী সদর (মাইজদী)",
        upazila: "নোয়াখালী সদর (মাইজদী)",
        qualification: "",
        salary: "",
        deadline: "",
        application_link: "",
        description: "",
        how_to_apply: "",
      });
    } catch {
      toast.error("বিজ্ঞপ্তি জমা দিতে সমস্যা হয়েছে।");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl overflow-x-hidden px-3.5 pb-24 pt-4 sm:px-4">
      {/* Hero Header */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-hero p-5 text-primary-foreground shadow-elevated">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur">
              <Briefcase className="h-3 w-3 text-gold" /> নোয়াখালী ক্যারিয়ার হাব
            </span>
            <h1 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">
              শিক্ষা ও ক্যারিয়ার পোর্টাল
            </h1>
            <p className="mt-1 text-xs opacity-90 sm:text-sm">
              নোয়াখালীর চাকরিপ্রার্থী ও শিক্ষার্থীদের জন্য সার্বিক চাকরির বিজ্ঞপ্তি, ভর্তি তথ্য ও সুযোগ।
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddJob(true)}
            className="flex items-center gap-2 self-start rounded-full bg-gradient-gold px-4 py-2 text-xs font-bold text-primary-deep shadow-gold active:scale-95 transition"
          >
            <PlusCircle className="h-4 w-4" /> বিজ্ঞপ্তি প্রকাশ করুন
          </button>
        </div>

        {/* Tab switch */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("jobs")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "jobs"
                ? "bg-white text-primary shadow-sm"
                : "bg-white/15 text-white hover:bg-white/20"
            }`}
          >
            <Briefcase className="h-4 w-4" /> চাকরির বিজ্ঞপ্তি ({approvedJobs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("education")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "education"
                ? "bg-white text-primary shadow-sm"
                : "bg-white/15 text-white hover:bg-white/20"
            }`}
          >
            <GraduationCap className="h-4 w-4" /> শিক্ষা প্রতিষ্ঠান ও ভর্তি
          </button>
        </div>
      </section>

      {/* JOBS TAB */}
      {activeTab === "jobs" && (
        <div className="mt-4 space-y-4">
          {/* Filters Bar */}
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="চাকরির পদ, প্রতিষ্ঠান বা যোগ্যতা দিয়ে খুঁজুন..."
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-10 text-xs sm:text-sm outline-none focus:border-primary"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
              >
                <option value="all">সকল ধরন</option>
                <option value="govt">সরকারি চাকরি</option>
                <option value="private">বেসরকারি চাকরি</option>
                <option value="local_noakhali">স্থানীয় নোয়াখালী</option>
                <option value="internship">ইন্টার্নশিপ ও প্রশিক্ষণ</option>
                <option value="scholarship">স্কলারশিপ ও বৃত্তি</option>
              </select>

              <select
                value={selectedUpazila}
                onChange={(e) => setSelectedUpazila(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
              >
                <option value="all">সকল উপজেলা</option>
                {NOAKHALI_UPAZILAS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>

              <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold select-none">
                <input
                  type="checkbox"
                  checked={showExpired}
                  onChange={(e) => setShowExpired(e.target.checked)}
                  className="rounded text-primary focus:ring-0"
                />
                <span>মেয়াদোত্তীর্ণ দেখুন</span>
              </label>

              <span className="ml-auto text-xs font-bold text-primary">
                {filteredJobs.length} টি বিজ্ঞপ্তি
              </span>
            </div>
          </div>

          {/* Job Circulars List */}
          {filteredJobs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-12 text-center">
              <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <h3 className="mt-3 font-display text-base font-bold text-foreground">
                কোনো চাকরির বিজ্ঞপ্তি পাওয়া যায়নি
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                ফিল্টার পরিবর্তন করুন অথবা নতুন বিজ্ঞপ্তি জমা দিন।
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredJobs.map((job) => {
                const typeMeta = JOB_TYPE_LABELS[job.job_type] || JOB_TYPE_LABELS.private;
                const isSaved = isFavorite(job.id);
                const today = new Date().toISOString().slice(0, 10);
                const isExpired = job.deadline ? job.deadline < today : false;

                return (
                  <div
                    key={job.id}
                    onClick={() => setActiveJob(job)}
                    className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-4 shadow-card hover:border-primary/40 hover:shadow-elevated transition cursor-pointer"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${typeMeta.tone}`}
                          >
                            {typeMeta.label}
                          </span>
                          {isExpired ? (
                            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                              মেয়াদ শেষ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-full">
                              <Clock className="h-3 w-3" /> শেষ তারিখ: {job.deadline}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(job);
                            }}
                            className={`rounded-full p-1.5 transition ${
                              isSaved
                                ? "text-primary bg-primary/10"
                                : "text-muted-foreground hover:bg-muted"
                            }`}
                            aria-label="Bookmark"
                          >
                            <Bookmark className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShare(job);
                            }}
                            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                            aria-label="Share"
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <h3 className="mt-2 font-display text-base font-bold text-foreground group-hover:text-primary transition">
                        {job.title}
                      </h3>
                      <p className="mt-0.5 text-xs font-semibold text-primary-deep">
                        {job.organization}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {job.description}
                      </p>
                    </div>

                    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-border/60 text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-primary" /> {job.location}
                        </span>
                        {job.salary && (
                          <span className="flex items-center gap-1 font-semibold text-foreground">
                            <DollarSign className="h-3 w-3 text-emerald-600" /> {job.salary}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveJob(job);
                        }}
                        className="inline-flex items-center gap-1 font-bold text-primary group-hover:underline"
                      >
                        বিস্তারিত দেখুন <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* EDUCATION TAB */}
      {activeTab === "education" && (
        <div className="mt-4 space-y-4">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-primary-deep">
              <GraduationCap className="h-5 w-5 text-primary" /> নোয়াখালী জেলার প্রধান শিক্ষা প্রতিষ্ঠানসমূহ
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              বিশ্ববিদ্যালয়, কলেজ, পলিটেকনিক ও মাদ্রাসার তালিকা ও ভর্তি বিষয়ক তথ্য।
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                {
                  name: "নোয়াখালী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয় (NSTU)",
                  type: "পাবলিক বিশ্ববিদ্যালয়",
                  address: "সোনাপুর, নোয়াখালী",
                  phone: "02334496522",
                  website: "https://nstu.edu.bd",
                  admission: "জিএসটি গুচ্ছ পদ্ধতিতে স্নাতক ভর্তি কার্যক্রম চলমান।",
                },
                {
                  name: "নোয়াখালী সরকারি কলেজ",
                  type: "সরকারি কলেজ",
                  address: "মাইজদী কোর্ট, নোয়াখালী",
                  phone: "02334431234",
                  website: "http://ngc.gov.bd",
                  admission: "এইচএসসি ও জাতীয় বিশ্ববিদ্যালয়ের অধীন অনার্স-মাস্টার্স।",
                },
                {
                  name: "চৌমুহনী সরকারি এস. এ. কলেজ",
                  type: "সরকারি কলেজ",
                  address: "কলেজ রোড, চৌমুহনী, বেগমগঞ্জ",
                  phone: "02334432111",
                  website: "http://cgcollege.gov.bd",
                  admission: "ডিগ্রি ও অনার্স ভর্তি বিজ্ঞপ্তি নোটিশ বোর্ডে দেখুন।",
                },
                {
                  name: "নোয়াখালী পলিটেকনিক ইনস্টিটিউট",
                  type: "সরকারি কারিগরি ইনস্টিটিউট",
                  address: "কবিরহাট রোড, মাইজদী",
                  phone: "02334431876",
                  website: "http://npi.gov.bd",
                  admission: "বাংলাদেশ কারিগরি শিক্ষা বোর্ডের অধীনে ৪ বছর মেয়াদি ডিপ্লোমা ইঞ্জিনিয়ারিং।",
                },
                {
                  name: "মাইজদী সরকারি বালিকা উচ্চ বিদ্যালয়",
                  type: "সরকারি মাধ্যমিক বিদ্যালয়",
                  address: "মাইজদী কোর্ট",
                  phone: "02334431500",
                  admission: "লটারির মাধ্যমে ৬ষ্ঠ শ্রেণিতে ভর্তি।",
                },
                {
                  name: "নোয়াখালী জিলা স্কুল",
                  type: "ঐতিহ্যবাহী সরকারি বালক বিদ্যালয়",
                  address: "মাইজদী কোর্ট",
                  phone: "02334431505",
                  admission: "৩য় ও ৬ষ্ঠ শ্রেণিতে কেন্দ্রীয় ভর্তি লটারি।",
                },
              ].map((edu, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-border/80 bg-background p-4 shadow-xs hover:border-primary/40 transition"
                >
                  <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {edu.type}
                  </span>
                  <h4 className="mt-1.5 font-display text-sm font-bold text-foreground">
                    {edu.name}
                  </h4>
                  <p className="mt-1 text-[11.5px] text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-primary shrink-0" /> {edu.address}
                  </p>
                  <p className="mt-2 text-xs text-foreground/80 bg-muted/40 p-2 rounded-xl">
                    <strong>ভর্তি তথ্য:</strong> {edu.admission}
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
                    <a href={`tel:${edu.phone}`} className="text-primary font-bold flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {edu.phone}
                    </a>
                    {edu.website && (
                      <a
                        href={edu.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary flex items-center gap-1 text-[11px]"
                      >
                        ওয়েবসাইট <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Job Details Modal */}
      {activeJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <button
              type="button"
              onClick={() => setActiveJob(null)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            >
              ✕
            </button>

            <span
              className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold border ${
                JOB_TYPE_LABELS[activeJob.job_type]?.tone || ""
              }`}
            >
              {JOB_TYPE_LABELS[activeJob.job_type]?.label || "চাকরির বিজ্ঞপ্তি"}
            </span>

            <h2 className="mt-2 font-display text-lg sm:text-xl font-bold text-foreground">
              {activeJob.title}
            </h2>
            <p className="text-xs font-semibold text-primary">{activeJob.organization}</p>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-muted/40 p-3 rounded-2xl">
              <div>
                <span className="text-muted-foreground">কর্মস্থল:</span>
                <p className="font-semibold text-foreground">{activeJob.location}</p>
              </div>
              <div>
                <span className="text-muted-foreground">আবেদনের শেষ তারিখ:</span>
                <p className="font-bold text-destructive">{activeJob.deadline}</p>
              </div>
              {activeJob.salary && (
                <div>
                  <span className="text-muted-foreground">বেতন / সম্মানী:</span>
                  <p className="font-semibold text-foreground">{activeJob.salary}</p>
                </div>
              )}
              {activeJob.qualification && (
                <div>
                  <span className="text-muted-foreground">যোগ্যতা:</span>
                  <p className="font-semibold text-foreground">{activeJob.qualification}</p>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed">
              <h4 className="font-bold text-foreground">কাজের বিবরণ:</h4>
              <p>{activeJob.description}</p>
              {activeJob.how_to_apply && (
                <div className="mt-3">
                  <h4 className="font-bold text-foreground">আবেদন প্রক্রিয়া:</h4>
                  <p>{activeJob.how_to_apply}</p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="mt-5 flex flex-wrap gap-2">
              {activeJob.application_link && (
                <a
                  href={activeJob.application_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                >
                  অনলাইনে আবেদন করুন <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                type="button"
                onClick={() => handleToggleFavorite(activeJob)}
                className="rounded-full border border-border px-4 py-2.5 text-xs font-bold text-foreground hover:bg-muted"
              >
                {isFavorite(activeJob.id) ? "বুকমার্ক সরানো" : "বুকমার্ক সংরক্ষণ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Job Modal */}
      {showAddJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowAddJob(false)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            >
              ✕
            </button>

            <h2 className="font-display text-lg font-bold text-foreground">
              চাকরির বিজ্ঞপ্তি প্রকাশ করুন
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              নোয়াখালীর কোনো প্রতিষ্ঠান, দোকান বা কার্যালয়ে কর্মী প্রয়োজন হলে বিনামূল্যে বিজ্ঞপ্তি দিন।
            </p>

            <form onSubmit={handleAddJobSubmit} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-foreground">পদের নাম *</label>
                <input
                  required
                  value={newJob.title}
                  onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                  placeholder="যেমন: সেলস এক্সিকিউটিভ / কম্পিউটার অপারেটর"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground">প্রতিষ্ঠান / অফিসের নাম *</label>
                <input
                  required
                  value={newJob.organization}
                  onChange={(e) => setNewJob({ ...newJob, organization: e.target.value })}
                  placeholder="যেমন: আল-মদিনা ফার্মেসি, চৌমুহনী"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-foreground">চাকরির ধরন *</label>
                  <select
                    value={newJob.job_type}
                    onChange={(e) => setNewJob({ ...newJob, job_type: e.target.value as JobType })}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
                  >
                    <option value="local_noakhali">স্থানীয় নোয়াখালী</option>
                    <option value="private">বেসরকারি চাকরি</option>
                    <option value="govt">সরকারি চাকরি</option>
                    <option value="internship">ইন্টার্নশিপ ও প্রশিক্ষণ</option>
                    <option value="scholarship">স্কলারশিপ</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground">উপজেলা *</label>
                  <select
                    value={newJob.upazila}
                    onChange={(e) => setNewJob({ ...newJob, upazila: e.target.value, location: e.target.value })}
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-foreground">বেতন / ভাতা</label>
                  <input
                    value={newJob.salary}
                    onChange={(e) => setNewJob({ ...newJob, salary: e.target.value })}
                    placeholder="যেমন: ১৫,০০০ - ২০,০০০ টাকা"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-foreground">আবেদনের শেষ তারিখ *</label>
                  <input
                    required
                    type="date"
                    value={newJob.deadline}
                    onChange={(e) => setNewJob({ ...newJob, deadline: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground">যোগ্যতা ও অভিজ্ঞতা</label>
                <input
                  value={newJob.qualification}
                  onChange={(e) => setNewJob({ ...newJob, qualification: e.target.value })}
                  placeholder="যেমন: এইচএসসি পাস, কম্পিউটার পরিচালনায় অভিজ্ঞ"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground">কাজের বিবরণ ও আবেদন পদ্ধতি</label>
                <textarea
                  rows={3}
                  value={newJob.description}
                  onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                  placeholder="কাজের বিস্তারিত ও যোগাযোগ নম্বর..."
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddJob(false)}
                  className="rounded-full bg-muted px-4 py-2 text-xs font-semibold text-foreground"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-full bg-primary px-5 py-2 text-xs font-bold text-primary-foreground"
                >
                  {submitting ? "জমা হচ্ছে..." : "বিজ্ঞপ্তি জমা দিন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
