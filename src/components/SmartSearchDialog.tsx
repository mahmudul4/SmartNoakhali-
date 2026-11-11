import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search,
  X,
  MapPin,
  Phone,
  Briefcase,
  Building2,
  Layers,
  GraduationCap,
  Clock,
  Sparkles,
  ChevronRight,
  Filter,
  CheckCircle,
} from "lucide-react";
import { useCategories, useDivisions } from "@/lib/store";
import { useCloudSubmissions } from "@/lib/cloud";
import {
  useInstitutions,
  useJobCirculars,
  NOAKHALI_UPAZILAS,
  type Institution,
  type JobCircular,
} from "@/lib/district-platform";

const POPULAR_SEARCH_TAGS = [
  "২৫০ শয্যা হাসপাতাল",
  "নোবিপ্রবি (NSTU)",
  "চৌমুহনী বাজার",
  "সরকারি চাকরি",
  "মাইজদী কোর্ট",
  "অ্যাম্বুলেন্স",
  "পুলিশ সুপার",
  "ফায়ার সার্ভিস",
  "গান্ধী আশ্রম",
  "নিঝুম দ্বীপ",
];

const RECENT_SEARCHES_KEY = "sn_recent_searches_v2";

export interface SearchResultItem {
  id: string;
  type: "category" | "institution" | "job" | "service";
  title: string;
  subtitle?: string;
  category: string;
  location?: string;
  contact?: string;
  link: string;
  badge?: string;
  iconType: "category" | "institution" | "job" | "service";
}

interface SmartSearchProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialQuery?: string;
}

export function SmartSearchModal({ isOpen, onClose, initialQuery = "" }: SmartSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedUpazila, setSelectedUpazila] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const { categories } = useCategories();
  const { items: submissions } = useCloudSubmissions();
  const { approvedInstitutions } = useInstitutions();
  const { approvedJobs } = useJobCirculars();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleAddRecent = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleClearRecent = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {}
  };

  // Unified Search Index
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && selectedUpazila === "all" && selectedType === "all") {
      return [];
    }

    const items: SearchResultItem[] = [];

    // 1. Search in Categories (exclude chat and protected if raw)
    if (selectedType === "all" || selectedType === "category") {
      for (const cat of categories) {
        if (cat.slug === "chat" || cat.slug === "app-download") continue;
        const target = `${cat.bn} ${cat.en} ${cat.description || ""}`.toLowerCase();
        if (!q || target.includes(q)) {
          items.push({
            id: `cat-${cat.slug}`,
            type: "category",
            title: cat.bn,
            subtitle: cat.description || cat.en,
            category: "সেবা ক্যাটাগরি",
            link:
              cat.slug === "submit-info"
                ? "/submit-info"
                : cat.slug === "about"
                ? "/about"
                : `/category/${cat.slug}`,
            iconType: "category",
          });
        }
      }
    }

    // 2. Search in Institutions & Businesses
    if (selectedType === "all" || selectedType === "institution") {
      for (const inst of approvedInstitutions) {
        const matchesUpazila = selectedUpazila === "all" || inst.upazila === selectedUpazila;
        if (!matchesUpazila) continue;

        const target = `${inst.name} ${inst.en_name || ""} ${inst.description} ${inst.address} ${inst.upazila} ${inst.type || ""}`.toLowerCase();
        if (!q || target.includes(q)) {
          items.push({
            id: `inst-${inst.id}`,
            type: "institution",
            title: inst.name,
            subtitle: inst.description,
            category: inst.type || "প্রতিষ্ঠান",
            location: `${inst.upazila} ${inst.union ? `• ${inst.union}` : ""}`,
            contact: inst.phone,
            link: `/directory?id=${inst.id}`,
            badge: inst.verified ? "ভেরিফায়েড" : undefined,
            iconType: "institution",
          });
        }
      }
    }

    // 3. Search in Job Circulars & Education
    if (selectedType === "all" || selectedType === "job") {
      for (const job of approvedJobs) {
        const matchesUpazila = selectedUpazila === "all" || job.upazila === selectedUpazila;
        if (!matchesUpazila) continue;

        const target = `${job.title} ${job.organization} ${job.description} ${job.qualification} ${job.location}`.toLowerCase();
        if (!q || target.includes(q)) {
          items.push({
            id: `job-${job.id}`,
            type: "job",
            title: job.title,
            subtitle: `${job.organization} — পদ: ${job.qualification}`,
            category: "চাকরির বিজ্ঞপ্তি",
            location: job.location,
            link: `/career?id=${job.id}`,
            badge: `মেয়াদ: ${job.deadline}`,
            iconType: "job",
          });
        }
      }
    }

    // 4. Search in Approved Citizen Submissions
    if (selectedType === "all" || selectedType === "service") {
      const approvedSubs = (submissions || []).filter((s: { status?: string }) => s.status === "approved");
      for (const sub of approvedSubs) {
        const target = `${sub.title} ${sub.body} ${sub.address} ${sub.contact} ${sub.category_slug}`.toLowerCase();
        if (!q || target.includes(q)) {
          items.push({
            id: `sub-${sub.id}`,
            type: "service",
            title: sub.title,
            subtitle: sub.body || undefined,
            category: "নাগরিক সেবা",
            location: sub.address || undefined,
            contact: sub.contact || undefined,
            link: `/category/${sub.category_slug}`,
            iconType: "service",
          });
        }
      }
    }

    return items.slice(0, 50);
  }, [query, selectedUpazila, selectedType, categories, approvedInstitutions, approvedJobs, submissions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-3 pt-12 sm:p-6 sm:pt-20 backdrop-blur-sm animate-in fade-in">
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-primary/20 bg-background shadow-2xl">
        {/* Search Header Bar */}
        <div className="border-b border-border/80 bg-muted/30 p-3.5 sm:p-4">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3.5 h-5 w-5 text-primary" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  handleAddRecent(query);
                }
              }}
              placeholder="নোয়াখালীর যে-কোনো সেবা, হাসপাতাল, প্রতিষ্ঠান বা চাকরি খুঁজুন..."
              className="w-full rounded-2xl border border-border bg-background py-3 pl-11 pr-10 text-sm font-medium text-foreground outline-none transition ring-primary focus:border-primary focus:ring-2 sm:text-base"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filters Bar: Location & Category Type */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              <span className="text-[11px] font-semibold">ফিল্টার:</span>
            </div>

            {/* Type selector */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground outline-none"
            >
              <option value="all">সকল ধরন</option>
              <option value="category">সেবা ও ক্যাটাগরি</option>
              <option value="institution">প্রতিষ্ঠান ও ব্যবসা</option>
              <option value="job">চাকরি ও ক্যারিয়ার</option>
              <option value="service">নাগরিক সেবা</option>
            </select>

            {/* Upazila selector */}
            <select
              value={selectedUpazila}
              onChange={(e) => setSelectedUpazila(e.target.value)}
              className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground outline-none"
            >
              <option value="all">সকল উপজেলা (নোয়াখালী জেলা)</option>
              {NOAKHALI_UPAZILAS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>

            {query && (
              <span className="ml-auto text-[11px] font-bold text-primary">
                {results.length} টি ফলাফল
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          {/* Recent & Popular Searches (Shown when query is empty) */}
          {!query.trim() && (
            <div className="space-y-4">
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between pb-1.5">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> সাম্প্রতিক অনুসন্ধান
                    </span>
                    <button
                      type="button"
                      onClick={handleClearRecent}
                      className="text-[11px] font-medium text-muted-foreground hover:text-destructive"
                    >
                      মুছে ফেলুন
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setQuery(item);
                          handleAddRecent(item);
                        }}
                        className="rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground transition hover:border-primary/40 hover:bg-muted"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <span className="flex items-center gap-1.5 pb-2 text-xs font-bold text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-gold" /> জনপ্রিয় ও গুরুত্বপূর্ণ অনুসন্ধান
                </span>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_SEARCH_TAGS.map((tag, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setQuery(tag);
                        handleAddRecent(tag);
                      }}
                      className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Results List */}
          {query.trim() && results.length === 0 && (
            <div className="py-12 text-center">
              <Search className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-semibold text-foreground">
                "{query}" এর সাথে মিল রেখে কোনো সেবা বা প্রতিষ্ঠান পাওয়া যায়নি
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                বানান পরীক্ষা করুন অথবা অন্য কোনো কাছাকাছি শব্দ লিখে চেষ্টা করুন।
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((item) => (
                <Link
                  key={item.id}
                  to={item.link}
                  onClick={() => {
                    handleAddRecent(query || item.title);
                    onClose?.();
                  }}
                  className="group flex items-start justify-between gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-xs transition hover:border-primary/50 hover:bg-muted/40 hover:shadow-sm"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${
                        item.iconType === "institution"
                          ? "bg-emerald-600"
                          : item.iconType === "job"
                          ? "bg-blue-600"
                          : item.iconType === "service"
                          ? "bg-amber-600"
                          : "bg-teal-600"
                      }`}
                    >
                      {item.iconType === "institution" && <Building2 className="h-4 w-4" />}
                      {item.iconType === "job" && <Briefcase className="h-4 w-4" />}
                      {item.iconType === "service" && <Layers className="h-4 w-4" />}
                      {item.iconType === "category" && <Sparkles className="h-4 w-4" />}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-display text-xs sm:text-sm font-bold text-foreground group-hover:text-primary">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-2 py-0.2 text-[10px] font-bold text-emerald-700 border border-emerald-500/20">
                            <CheckCircle className="h-2.5 w-2.5" /> {item.badge}
                          </span>
                        )}
                      </div>

                      {item.subtitle && (
                        <p className="mt-0.5 line-clamp-1 text-[11px] sm:text-xs text-muted-foreground">
                          {item.subtitle}
                        </p>
                      )}

                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground">
                        <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium">
                          {item.category}
                        </span>
                        {item.location && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin className="h-3 w-3 text-primary" /> {item.location}
                          </span>
                        )}
                        {item.contact && (
                          <span className="inline-flex items-center gap-0.5 text-primary font-mono font-medium">
                            <Phone className="h-3 w-3" /> {item.contact}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border/80 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
          <span className="text-[11px]">স্মার্ট নোয়াখালী ডিজিটাল জেলা সার্চ ইঞ্জিন</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-muted px-3 py-1 text-xs font-semibold hover:bg-muted/80 text-foreground"
          >
            বন্ধ করুন (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}
