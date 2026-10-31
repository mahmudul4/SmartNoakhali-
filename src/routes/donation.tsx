import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  ArrowLeft,
  Copy,
  HandCoins,
  CheckCircle2,
  Send,
  Edit3,
  Save,
  Building2,
  CreditCard,
  AlertCircle,
  TrendingDown,
  Wallet,
  Calendar,
  Layers,
  HeartHandshake,
  ShieldCheck,
  EyeOff,
  UploadCloud,
  FileText,
  Search,
  Filter,
  Users,
  Target,
  Sparkles,
  ExternalLink,
  PhoneCall,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCloudDonations,
  useCloudExpenses,
  useCloudCampaigns,
  DONATION_CATEGORY_LABELS,
  EXPENSE_CATEGORY_LABELS,
  type DonationCategory,
  type DonationMethod,
  type DonationCampaignRow,
} from "@/lib/cloud";
import { useDonationConfig, type DonationConfig, type DonationNumberItem } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { FinancialReports } from "@/components/FinancialReports";

export const Route = createFileRoute("/donation")({
  head: () => ({
    meta: [
      { title: "অনুদান ও মানবিক হিসাব — স্মার্ট নোয়াখালী" },
      {
        name: "description",
        content:
          "বিকাশ, নগদ, রকেট, ব্যাংক ও কার্ডের মাধ্যমে সাধারণ, চিকিৎসা, শিক্ষা, যাকাত ও মানবিক তহবিলে অনুদান দিন। শতভাগ স্বচ্ছ ও জবাবদিহিমূলক আর্থিক প্রতিবেদন।",
      },
    ],
  }),
  component: DonationPage,
});

// All 10 Donation Receiving Categories (4 Main Campaigns + 6 Humanitarian)
const DONATION_CATEGORIES_CONFIG: Array<{
  key: DonationCategory;
  label: string;
  desc: string;
  group: "main" | "humanitarian";
  suggestedGoal?: number;
  icon?: string;
}> = [
  // 4 Main Campaigns
  {
    key: "general",
    label: "সাধারণ অনুদান",
    desc: "নোয়াখালীর সার্বিক মানবিক কল্যাণ ও জরুরি দুর্যোগ মোকাবিলায়",
    group: "main",
    suggestedGoal: 500000,
  },
  {
    key: "treatment",
    label: "চিকিৎসা অনুদান",
    desc: "অসহায় ও দরিদ্র রোগীদের জীবন রক্ষাকারী অপারেশন ও ওষুধ সহায়তা",
    group: "main",
    suggestedGoal: 300000,
  },
  {
    key: "education",
    label: "শিক্ষা অনুদান",
    desc: "মেধাবী ও সুবিধাবঞ্চিত ছাত্র-ছাত্রীদের বই, ফি ও বৃত্তি সহায়তা",
    group: "main",
    suggestedGoal: 200000,
  },
  {
    key: "zakat",
    label: "যাকাত ও সদকা",
    desc: "ইসলামিক শরীয়াহ সম্মত উপযুক্ত হকদারদের পুনর্বাসন ও আত্মনির্ভরতা",
    group: "main",
    suggestedGoal: 400000,
  },
  // 6 Humanitarian Aid Categories
  {
    key: "orphans_helpless",
    label: "এতিম ও অসহায়দের সহায়তা",
    desc: "পিতৃহীন এতিম শিশু ও নিরাশ্রয় বৃদ্ধদের লালন-পালন ও আশ্রয়",
    group: "humanitarian",
    suggestedGoal: 250000,
  },
  {
    key: "emergency_relief",
    label: "জরুরি ত্রাণ তহবিল",
    desc: "বন্যা, ঘূর্ণিঝড়, অগ্নিকাণ্ড ও আকস্মিক দুর্যোগে তাৎক্ষণিক খাদ্য ও আশ্রয়",
    group: "humanitarian",
    suggestedGoal: 350000,
  },
  {
    key: "food_clothing",
    label: "খাদ্য ও বস্ত্র বিতরণ",
    desc: "ঈদ, শীতকাল ও অভাবকালীন সময়ে ছিন্নমূল মানুষের খাদ্য ও শীতবস্ত্র",
    group: "humanitarian",
    suggestedGoal: 200000,
  },
  {
    key: "individual_family",
    label: "ব্যক্তি ও পরিবারভিত্তিক অনুদান",
    desc: "সংকটাপন্ন পরিবারের গোপন সম্মান রক্ষা করে জরুরি এককালীন সহায়তা",
    group: "humanitarian",
    suggestedGoal: 150000,
  },
  {
    key: "religious_institution",
    label: "ধর্মীয় প্রতিষ্ঠানে অনুদান",
    desc: "স্থানীয় মসজিদ, মাদ্রাসা, এতিমখানা ও ধর্মীয় প্রতিষ্ঠানের সংস্কার",
    group: "humanitarian",
    suggestedGoal: 200000,
  },
  {
    key: "social_project",
    label: "সামাজিক প্রকল্প",
    desc: "বিশুদ্ধ খাবার পানির নলকূপ স্থাপন, স্যানিটেশন ও বৃক্ষরোপণ কর্মসূচি",
    group: "humanitarian",
    suggestedGoal: 300000,
  },
];

function DonationPage() {
  const { items: donationItems, add: addDonation } = useCloudDonations();
  const { items: expenseItems } = useCloudExpenses();
  const { items: cloudCampaigns } = useCloudCampaigns();
  const { config, activeNumbers, saveDonationConfig } = useDonationConfig();
  const { isMainAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<
    "campaigns" | "donate" | "donors" | "expenses" | "reports"
  >("campaigns");

  const [editingNumbers, setEditingNumbers] = useState(false);
  const [draftConfig, setDraftConfig] = useState<DonationConfig>(config);
  const [savingConfig, setSavingConfig] = useState(false);

  // Form State
  const [form, setForm] = useState({
    sender_name: "",
    sender_phone: "",
    is_anonymous: false,
    method: "bkash" as DonationMethod,
    category: "general" as DonationCategory,
    trx_id: "",
    amount: "",
    note: "",
    deposit_slip_url: "",
  });

  const [slipFileName, setSlipFileName] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Donors search / filter
  const [donorSearch, setDonorSearch] = useState("");
  const [donorCategoryFilter, setDonorCategoryFilter] = useState<string>("all");

  useEffect(() => {
    setDraftConfig(config);
  }, [config]);

  // Approved donations calculation
  const approvedDonations = useMemo(
    () => donationItems.filter((i) => i.status === "approved"),
    [donationItems]
  );
  const totalDonations = useMemo(
    () => approvedDonations.reduce((s, i) => s + Number(i.amount || 0), 0),
    [approvedDonations]
  );

  // Approved expenses calculation
  const approvedExpenses = useMemo(
    () => expenseItems.filter((e) => e.status !== "rejected"),
    [expenseItems]
  );
  const totalExpenses = useMemo(
    () => approvedExpenses.reduce((s, e) => s + Number(e.amount || 0), 0),
    [approvedExpenses]
  );

  const netBalance = totalDonations - totalExpenses;

  // Compute category totals dynamically from verified donations
  const categoryStats = useMemo(() => {
    const stats: Record<string, { collected: number; donorCount: number }> = {};
    for (const d of approvedDonations) {
      const cat = d.category || "general";
      if (!stats[cat]) stats[cat] = { collected: 0, donorCount: 0 };
      stats[cat].collected += Number(d.amount || 0);
      stats[cat].donorCount += 1;
    }
    return stats;
  }, [approvedDonations]);

  function copy(num: string, label: string) {
    navigator.clipboard.writeText(num).then(() => toast.success(`${label} নম্বর কপি হয়েছে`));
  }

  // Handle Bank Slip file selection (base64 data URL preview)
  function handleSlipFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("ফাইলের সাইজ সর্বোচ্চ ২ মেগাবাইট হতে পারবে");
      return;
    }
    setSlipFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, deposit_slip_url: reader.result as string }));
      toast.success("জমা স্লিপের ছবি যুক্ত হয়েছে");
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveNumbers() {
    setSavingConfig(true);
    try {
      await saveDonationConfig(draftConfig);
      setEditingNumbers(false);
      toast.success("অনুদানের নাম্বার ও মেথড সফলভাবে আপডেট হয়েছে");
    } catch (e) {
      toast.error((e as Error).message || "আপডেট ব্যর্থ");
    } finally {
      setSavingConfig(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!form.sender_name.trim() || !form.sender_phone.trim() || !form.trx_id.trim() || !amt) {
      toast.error("সব আবশ্যিক তথ্য পূরণ করুন (নাম, ফোন, TrxID ও পরিমাণ)");
      return;
    }
    if (amt <= 0) return toast.error("সঠিক টাকার পরিমাণ দিন");

    setSubmitting(true);
    const res = await addDonation({
      sender_name: form.sender_name.trim(),
      sender_phone: form.sender_phone.trim(),
      is_anonymous: Boolean(form.is_anonymous),
      method: form.method,
      category: form.category,
      category_label: DONATION_CATEGORY_LABELS[form.category] || form.category,
      trx_id: form.trx_id.trim().toUpperCase(),
      amount: amt,
      note: form.note.trim() || undefined,
      deposit_slip_url: form.deposit_slip_url || undefined,
      receipt_url: form.deposit_slip_url || undefined,
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error(res.error ?? "জমা দেওয়া যায়নি");
      return;
    }

    setSubmitted(true);
    toast.success("অনুদান সফলভাবে জমা হয়েছে — এডমিন যাচাইয়ের পর অনুমোদিত হবে");
  }

  function handleSelectCampaignToDonate(catKey: DonationCategory) {
    setForm((prev) => ({ ...prev, category: catKey }));
    setActiveTab("donate");
    window.scrollTo({ top: 300, behavior: "smooth" });
  }

  // Filter verified donors
  const filteredDonors = useMemo(() => {
    return approvedDonations.filter((d) => {
      if (donorCategoryFilter !== "all" && d.category !== donorCategoryFilter) return false;
      if (donorSearch.trim()) {
        const q = donorSearch.trim().toLowerCase();
        const nameToSearch = d.is_anonymous ? "গোপন দাতা anonymous" : (d.sender_name || "");
        const hay = `${nameToSearch} ${d.method || ""} ${d.trx_id || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [approvedDonations, donorCategoryFilter, donorSearch]);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-4">
      {/* Top Breadcrumb & Admin Quick Action */}
      <div className="mb-3 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" /> হোম
        </Link>
        {isMainAdmin && (
          <button
            type="button"
            onClick={() => setEditingNumbers((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-xs font-bold text-primary-deep ring-1 ring-gold/40 hover:bg-gold/25 transition active:scale-95"
          >
            <Edit3 className="h-3.5 w-3.5 text-primary" /> পেমেন্ট মেথড ও একাউন্ট সেটিং
          </button>
        )}
      </div>

      {/* Hero Header */}
      <div className="mb-5 relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-primary-deep to-slate-900 p-6 text-white shadow-xl">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 opacity-10">
          <HandCoins className="h-64 w-64 text-white" />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 backdrop-blur mb-2.5">
            <Sparkles className="h-3.5 w-3.5" /> ১ নম্বর প্রধান বিভাগ — অনুদান ও মানবিক সহায়তা
          </div>
          <h1 className="font-display text-xl font-bold sm:text-2xl text-white">
            স্মার্ট নোয়াখালী ওয়েলফেয়ার ও মানবিক তহবিল
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-emerald-100/80 max-w-2xl">
            {config.subtitle || "নোয়াখালীর যেকোনো মানবিক ও সামাজিক উন্নয়নে আপনার ক্ষুদ্র দান বাঁচাতে পারে একটি অসহায় প্রাণ।"}
          </p>

          {/* Quick Stats Grid */}
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur border border-white/10">
              <span className="text-[11px] text-emerald-200 block">মোট সংগৃহীত অনুদান</span>
              <span className="font-display text-lg font-bold text-amber-300 sm:text-xl">
                ৳{totalDonations.toLocaleString("bn-BD")}
              </span>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur border border-white/10">
              <span className="text-[11px] text-rose-200 block">মোট মানবিক ব্যয়</span>
              <span className="font-display text-lg font-bold text-rose-300 sm:text-xl">
                ৳{totalExpenses.toLocaleString("bn-BD")}
              </span>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur border border-white/10">
              <span className="text-[11px] text-blue-200 block">অবশিষ্ট স্বচ্ছ ব্যালেন্স</span>
              <span className="font-display text-lg font-bold text-white sm:text-xl">
                ৳{netBalance.toLocaleString("bn-BD")}
              </span>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur border border-white/10">
              <span className="text-[11px] text-emerald-200 block">অনুমোদিত দাতা</span>
              <span className="font-display text-lg font-bold text-emerald-300 sm:text-xl">
                {approvedDonations.length.toLocaleString("bn-BD")} জন
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Fast Config Drawer */}
      {isMainAdmin && editingNumbers && (
        <div className="mb-6 space-y-4 rounded-3xl border border-primary/30 bg-card p-5 shadow-elevated">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <p className="font-display text-sm font-bold text-primary-deep">
                সুপার এডমিন: পেমেন্ট মেথড ও একাউন্ট নম্বর পরিচালনা
              </p>
              <p className="text-xs text-muted-foreground">
                ১১টি পেমেন্ট মেথড (বিকাশ, নগদ, রকেট, উপায়, ব্যাংক ও কার্ড) রিয়েলটাইম সিঙ্ক
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingNumbers(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              বন্ধ করুন
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              অনুদান পৃষ্ঠার সাবটাইটেল
            </label>
            <input
              value={draftConfig.subtitle}
              onChange={(e) => setDraftConfig({ ...draftConfig, subtitle: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {draftConfig.numbers.map((item, idx) => (
              <div
                key={item.id}
                className="rounded-2xl border border-border bg-muted/20 p-3.5 space-y-2 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">লেবেল</label>
                    <input
                      value={item.label}
                      onChange={(e) => {
                        const next = [...draftConfig.numbers];
                        next[idx] = { ...item, label: e.target.value };
                        setDraftConfig({ ...draftConfig, numbers: next });
                      }}
                      className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">একাউন্ট / ফোন নম্বর</label>
                    <input
                      value={item.number}
                      onChange={(e) => {
                        const next = [...draftConfig.numbers];
                        next[idx] = { ...item, number: e.target.value };
                        setDraftConfig({ ...draftConfig, numbers: next });
                      }}
                      className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">ধরন</label>
                    <select
                      value={item.type}
                      onChange={(e) => {
                        const next = [...draftConfig.numbers];
                        next[idx] = {
                          ...item,
                          type: e.target.value as DonationNumberItem["type"],
                        };
                        setDraftConfig({ ...draftConfig, numbers: next });
                      }}
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5"
                    >
                      <option value="personal">পার্সোনাল (Personal)</option>
                      <option value="merchant">মার্চেন্ট (Merchant)</option>
                      <option value="bank">ব্যাংক একাউন্ট (Bank)</option>
                      <option value="gateway">কার্ড / গেটওয়ে (Gateway)</option>
                    </select>
                  </div>
                </div>

                {item.type === "bank" && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                    <input
                      value={item.bankName ?? ""}
                      onChange={(e) => {
                        const next = [...draftConfig.numbers];
                        next[idx] = { ...item, bankName: e.target.value };
                        setDraftConfig({ ...draftConfig, numbers: next });
                      }}
                      placeholder="ব্যাংক (যেমন: Islami Bank PLC)"
                      className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs"
                    />
                    <input
                      value={item.accountName ?? ""}
                      onChange={(e) => {
                        const next = [...draftConfig.numbers];
                        next[idx] = { ...item, accountName: e.target.value };
                        setDraftConfig({ ...draftConfig, numbers: next });
                      }}
                      placeholder="একাউন্ট টাইটেল (যেমন: Smart Noakhali Welfare)"
                      className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs"
                    />
                    <input
                      value={item.branchName ?? ""}
                      onChange={(e) => {
                        const next = [...draftConfig.numbers];
                        next[idx] = { ...item, branchName: e.target.value };
                        setDraftConfig({ ...draftConfig, numbers: next });
                      }}
                      placeholder="শাখা (যেমন: Maijdee Court Branch)"
                      className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs"
                    />
                    <input
                      value={item.routingNumber ?? ""}
                      onChange={(e) => {
                        const next = [...draftConfig.numbers];
                        next[idx] = { ...item, routingNumber: e.target.value };
                        setDraftConfig({ ...draftConfig, numbers: next });
                      }}
                      placeholder="রাউটিং (যেমন: 125551234)"
                      className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-mono"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.active}
                      onChange={(e) => {
                        const next = [...draftConfig.numbers];
                        next[idx] = { ...item, active: e.target.checked };
                        setDraftConfig({ ...draftConfig, numbers: next });
                      }}
                    />
                    সক্রিয় প্রদর্শন
                  </label>
                  {item.type === "gateway" && (
                    <span className="text-[10px] text-amber-600 font-semibold">
                      লাইভ ক্রেডেনশিয়াল না থাকলে &quot;সেটআপ প্রয়োজন&quot; দেখাবে
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={savingConfig}
              onClick={handleSaveNumbers}
              className="flex items-center gap-1.5 rounded-full bg-gradient-hero px-4 py-2 text-xs font-bold text-primary-foreground shadow-card"
            >
              <Save className="h-3.5 w-3.5" /> {savingConfig ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
            </button>
            <button
              type="button"
              onClick={() => setEditingNumbers(false)}
              className="rounded-full bg-muted px-4 py-2 text-xs font-semibold"
            >
              বাতিল
            </button>
          </div>
        </div>
      )}

      {/* Main 5 Navigation Tabs */}
      <div className="mb-6 flex overflow-x-auto no-scrollbar gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("campaigns")}
          className={`flex items-center gap-1.5 shrink-0 rounded-2xl px-4 py-2 text-xs font-bold transition active:scale-95 ${
            activeTab === "campaigns"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <Target className="h-3.5 w-3.5" /> চলমান মানবিক ক্যাম্পেইন
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("donate")}
          className={`flex items-center gap-1.5 shrink-0 rounded-2xl px-4 py-2 text-xs font-bold transition active:scale-95 ${
            activeTab === "donate"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <HandCoins className="h-3.5 w-3.5" /> অনুদান প্রদান করুন
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("donors")}
          className={`flex items-center gap-1.5 shrink-0 rounded-2xl px-4 py-2 text-xs font-bold transition active:scale-95 ${
            activeTab === "donors"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <Users className="h-3.5 w-3.5" /> যাচাইকৃত অনুদানকারী ({approvedDonations.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("expenses")}
          className={`flex items-center gap-1.5 shrink-0 rounded-2xl px-4 py-2 text-xs font-bold transition active:scale-95 ${
            activeTab === "expenses"
              ? "bg-rose-600 text-white shadow-sm"
              : "bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <TrendingDown className="h-3.5 w-3.5" /> মানবিক ব্যয়ের হিসাব ({approvedExpenses.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={`flex items-center gap-1.5 shrink-0 rounded-2xl px-4 py-2 text-xs font-bold transition active:scale-95 ${
            activeTab === "reports"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <Wallet className="h-3.5 w-3.5" /> আর্থিক হিসাব ও রিপোর্ট
        </button>
      </div>

      {/* =========================================================================
          TAB 1: CAMPAIGNS & HUMANITARIAN CAUSES (4 Major + 6 Relief)
          ========================================================================= */}
      {activeTab === "campaigns" && (
        <div className="space-y-6">
          {/* Section: 4 Major Receiving Campaigns */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-foreground">
                  প্রধান ৪টি অনুদান ক্যাম্পেইন
                </h2>
                <p className="text-xs text-muted-foreground">
                  লক্ষ্যমাত্রা, সংগ্রহ ও অগ্রগতি রিয়েলটাইম ফায়ারবেস ট্র্যাকিং
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {DONATION_CATEGORIES_CONFIG.filter((c) => c.group === "main").map((cat) => {
                const stat = categoryStats[cat.key] || { collected: 0, donorCount: 0 };
                const goal = cat.suggestedGoal || 300000;
                const percentage = Math.min(100, Math.round((stat.collected / goal) * 100));

                return (
                  <div
                    key={cat.key}
                    className="flex flex-col justify-between rounded-3xl border border-border bg-card p-5 shadow-card hover:border-emerald-500/40 transition group"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600">
                          {cat.label}
                        </span>
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {stat.donorCount} জন অনুদানকারী
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                        {cat.desc}
                      </p>

                      {/* Progress bar */}
                      <div className="mt-4 space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-bold text-emerald-600">
                            সংগৃহীত: ৳{stat.collected.toLocaleString("bn-BD")}
                          </span>
                          <span className="text-muted-foreground">
                            লক্ষ্য: ৳{goal.toLocaleString("bn-BD")}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(5, percentage)}%` }}
                          />
                        </div>
                        <div className="text-right text-[10px] text-muted-foreground">
                          {percentage}% পূর্ণ হয়েছে
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectCampaignToDonate(cat.key)}
                      className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs group-hover:bg-emerald-700 transition active:scale-95"
                    >
                      <HandCoins className="h-3.5 w-3.5" /> এখনই অনুদান দিন
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: 6 Humanitarian Relief Projects */}
          <div>
            <div className="mb-3">
              <h2 className="font-display text-base font-bold text-foreground">
                মানবিক ও সামাজিক কল্যাণমূলক ৬টি শাখা
              </h2>
              <p className="text-xs text-muted-foreground">
                এতিম, অসহায় ও ক্ষতিগ্রস্ত পরিবারের পুনর্বাসনে নির্দিষ্ট প্রকল্প
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DONATION_CATEGORIES_CONFIG.filter((c) => c.group === "humanitarian").map((cat) => {
                const stat = categoryStats[cat.key] || { collected: 0, donorCount: 0 };
                return (
                  <div
                    key={cat.key}
                    className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-card hover:border-primary/40 transition"
                  >
                    <div>
                      <h3 className="font-display text-xs font-bold text-foreground">
                        {cat.label}
                      </h3>
                      <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                        {cat.desc}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-xs font-semibold">
                        <span className="text-muted-foreground text-[10.5px]">তহবিল স্থিতি:</span>
                        <span className="text-emerald-600">৳{stat.collected.toLocaleString("bn-BD")}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectCampaignToDonate(cat.key)}
                      className="mt-3 inline-flex items-center justify-center gap-1 rounded-xl bg-primary/10 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition active:scale-95"
                    >
                      সহায়তা করুন
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: DONATE FORM & MULTI-CHANNEL CHECKOUT
          ========================================================================= */}
      {activeTab === "donate" && (
        <div className="space-y-6">
          {/* Payment Accounts Card Display */}
          <div className="space-y-3">
            <h2 className="font-display text-sm font-bold text-foreground">
              টাকা পাঠানোর অনুমোদিত মাধ্যমসমূহ (ক্লিক করে কপি করুন):
            </h2>

            <div className="grid gap-3 sm:grid-cols-2">
              {activeNumbers.map((numItem) => {
                // If Bank Account
                if (numItem.type === "bank") {
                  return (
                    <div
                      key={numItem.id}
                      className="rounded-3xl border border-emerald-500/30 bg-card p-4 shadow-card sm:col-span-2"
                    >
                      <div className="flex items-center justify-between mb-3 border-b border-border/60 pb-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="font-display text-xs font-bold text-foreground block">
                              {numItem.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              সরাসরি ব্যাংক ডিপোজিট বা অনলাইন ফান্ড ট্রান্সফার
                            </span>
                          </div>
                        </div>
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600">
                          ব্যাংক একাউন্ট
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="rounded-xl bg-muted/30 p-2.5">
                          <span className="text-muted-foreground text-[10.5px] block">ব্যাংকের নাম:</span>
                          <p className="font-semibold text-foreground text-xs mt-0.5">
                            {numItem.bankName || "Islami Bank Bangladesh PLC (IBBL)"}
                          </p>
                        </div>
                        <div className="rounded-xl bg-muted/30 p-2.5">
                          <span className="text-muted-foreground text-[10.5px] block">হিসাবের নাম:</span>
                          <p className="font-semibold text-foreground text-xs mt-0.5">
                            {numItem.accountName || "Smart Noakhali Welfare Trust"}
                          </p>
                        </div>
                        <div className="rounded-xl bg-emerald-500/5 p-2.5 border border-emerald-500/20">
                          <span className="text-muted-foreground text-[10.5px] block">হিসাব নম্বর (A/C No):</span>
                          <div className="flex items-center justify-between mt-0.5">
                            <p className="font-mono font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                              {numItem.number}
                            </p>
                            <button
                              type="button"
                              onClick={() => copy(numItem.number, "ব্যাংক হিসাব")}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-600/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-600/20 active:scale-95"
                            >
                              <Copy className="h-3 w-3" /> কপি
                            </button>
                          </div>
                        </div>
                        <div className="rounded-xl bg-muted/30 p-2.5">
                          <span className="text-muted-foreground text-[10.5px] block">শাখা ও রাউটিং নম্বর:</span>
                          <p className="font-semibold text-foreground text-xs mt-0.5">
                            {numItem.branchName || "মাইজদী প্রধান শাখা"} {numItem.routingNumber ? `• রাউটিং: ${numItem.routingNumber}` : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }

                // If Online Gateway / Card
                if (numItem.type === "gateway") {
                  return (
                    <div
                      key={numItem.id}
                      className="flex items-center justify-between rounded-3xl border border-blue-500/30 bg-card p-4 shadow-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
                          <CreditCard className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-display text-xs font-bold text-foreground">{numItem.label}</p>
                          <p className="text-[10.5px] text-muted-foreground">ভিসা, মাস্টারকার্ড ও অ্যামেক্স কার্ড</p>
                        </div>
                      </div>
                      {numItem.isGatewayConfigured ? (
                        <button
                          type="button"
                          onClick={() => toast.info("অনলাইন গেটওয়ে লোড হচ্ছে...")}
                          className="rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs active:scale-95"
                        >
                          পে করুন
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          <AlertCircle className="h-3 w-3" /> সেটআপ প্রয়োজন
                        </span>
                      )}
                    </div>
                  );
                }

                // Mobile Banking (Personal & Merchant)
                return (
                  <div
                    key={numItem.id}
                    className={`flex items-center justify-between rounded-3xl bg-gradient-to-br ${numItem.tone} p-4 text-white shadow-card`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium opacity-90">{numItem.label}</p>
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold uppercase backdrop-blur">
                          {numItem.type === "merchant" ? "মার্চেন্ট (পেমেন্ট)" : "পার্সোনাল (সেন্ড মানি)"}
                        </span>
                      </div>
                      <p className="font-display text-base font-bold sm:text-lg mt-0.5">{numItem.number}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copy(numItem.number, numItem.label)}
                      className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold backdrop-blur active:scale-95 transition hover:bg-white/30"
                    >
                      <Copy className="h-3.5 w-3.5" /> কপি
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Submission Form */}
          {submitted ? (
            <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground">
                জাযাকাল্লাহু খাইরান! আপনার অনুদানের তথ্য সফলভাবে জমা হয়েছে।
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                আমাদের এডমিন প্যানেল থেকে আপনার ট্রানজেকশন আইডি (TrxID) বা ব্যাংক স্লিপ যাচাই করার পর আপনার অনুদানটি অনুমোদিত হবে এবং স্বচ্ছতার তালিকায় দৃশ্যমান হবে।
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setForm({
                    sender_name: "",
                    sender_phone: "",
                    is_anonymous: false,
                    method: "bkash",
                    category: "general",
                    trx_id: "",
                    amount: "",
                    note: "",
                    deposit_slip_url: "",
                  });
                  setSlipFileName("");
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-sm active:scale-95"
              >
                আরেকটি অনুদান জমা দিন
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-card space-y-4">
              <div className="border-b border-border pb-3">
                <h3 className="font-display text-base font-bold text-foreground">
                  অনুদানের তথ্য সাবমিট করুন (টাকা পাঠানোর পর)
                </h3>
                <p className="text-xs text-muted-foreground">
                  সঠিক TrxID ও তথ্য প্রদান করলে স্বয়ংক্রিয়ভাবে ভেরিফিকেশন দ্রুত সম্পন্ন হবে।
                </p>
              </div>

              {/* Category Selector */}
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">
                  অনুদান ক্যাটাগরি বেছে নিন *
                </label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {DONATION_CATEGORIES_CONFIG.map((cat) => {
                    const isSelected = form.category === cat.key;
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setForm({ ...form, category: cat.key })}
                        className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition active:scale-95 ${
                          isSelected
                            ? "border-emerald-600 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-600"
                            : "border-border bg-background text-foreground hover:bg-muted/50"
                        }`}
                      >
                        <span className="font-display text-xs font-bold">{cat.label}</span>
                        <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                          {cat.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="text-xs font-semibold text-foreground mb-1.5 block">
                  টাকা পাঠানোর মাধ্যম নির্বাচন করুন *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(
                    [
                      { id: "bkash", label: "bKash বিকাশ" },
                      { id: "nagad", label: "Nagad নগদ" },
                      { id: "rocket", label: "Rocket রকেট" },
                      { id: "upay", label: "Upay উপায়" },
                      { id: "bank", label: "Bank Transfer ব্যাংক" },
                    ] as Array<{ id: DonationMethod; label: string }>
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setForm({ ...form, method: m.id })}
                      className={`rounded-xl border py-2 text-xs font-bold transition ${
                        form.method === m.id
                          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Donor Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    আপনার পূর্ণ নাম *
                  </label>
                  <input
                    value={form.sender_name}
                    onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
                    placeholder="যেমন: মোঃ নোমান মাহমুদ"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    মোবাইল নম্বর *
                  </label>
                  <input
                    type="tel"
                    value={form.sender_phone}
                    onChange={(e) => setForm({ ...form, sender_phone: e.target.value })}
                    placeholder="01XXXXXXXXX"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Anonymous Donation Toggle */}
              <div className="rounded-2xl border border-border bg-muted/20 p-3 flex items-start gap-3">
                <input
                  id="anonymous-check"
                  type="checkbox"
                  checked={form.is_anonymous}
                  onChange={(e) => setForm({ ...form, is_anonymous: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                />
                <label htmlFor="anonymous-check" className="cursor-pointer">
                  <span className="font-display text-xs font-bold text-foreground flex items-center gap-1.5">
                    <EyeOff className="h-3.5 w-3.5 text-primary" /> গোপন অনুদান (Anonymous) রাখতে চাই
                  </span>
                  <span className="text-[11px] text-muted-foreground block mt-0.5">
                    চিহ্নিত করলে ওয়েবসাইটের পাবলিক দাতা তালিকায় আপনার নাম ও ফোন নম্বর গোপন রাখা হবে (শুধুমাত্র মহানুভব শুভাকাঙ্ক্ষী হিসেবে প্রদর্শিত হবে)।
                  </span>
                </label>
              </div>

              {/* TrxID & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    লেনদেন আইডি (TrxID) / ব্যাংক রেফারেন্স *
                  </label>
                  <input
                    value={form.trx_id}
                    onChange={(e) => setForm({ ...form, trx_id: e.target.value })}
                    placeholder="যেমন: 9J382AF49B..."
                    className="w-full font-mono uppercase rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary font-bold"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5 block">
                    একই TrxID একাধিকবার ব্যবহার করা যাবে না
                  </span>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    টাকার পরিমাণ (৳) *
                  </label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="যেমন: 1000"
                    className="w-full font-bold rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Bank Deposit Slip Attachment (Optional / Recommended for Bank) */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  ব্যাংক ডিপোজিট স্লিপ / রসিদের ছবি (ঐচ্ছিক)
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-background px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer transition">
                    <UploadCloud className="h-4 w-4 text-primary" />
                    <span>{slipFileName ? slipFileName : "ছবি নির্বাচন করুন (সর্বোচ্চ ২ MB)"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSlipFileChange}
                      className="hidden"
                    />
                  </label>
                  {form.deposit_slip_url && (
                    <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> যুক্ত হয়েছে
                    </span>
                  )}
                </div>
              </div>

              {/* Note / Prayer */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  মন্তব্য বা বিশেষ দোয়া (ঐচ্ছিক)
                </label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="আপনার মনের কথা বা বিশেষ কোনো দিকনির্দেশনা থাকলে এখানে লিখুন..."
                  rows={2}
                  className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-hero py-3 text-sm font-bold text-primary-foreground shadow-elevated disabled:opacity-60 active:scale-95 transition"
              >
                <Send className="h-4 w-4" /> {submitting ? "যাচাই ও সংরক্ষণ হচ্ছে..." : "অনুদান তথ্য জমা দিন"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: VERIFIED DONORS TRANSPARENCY LIST (Anonymous Protected)
          ========================================================================= */}
      {activeTab === "donors" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-4 border border-border">
            <div>
              <h2 className="font-display text-sm font-bold text-foreground">
                যাচাইকৃত অনুদানকারীগণের তালিকা ({approvedDonations.length} জন)
              </h2>
              <p className="text-xs text-muted-foreground">
                এডমিন কর্তৃক লেনদেন আইডি ভেরিফিকেশনের পর অনুমোদিত অনুদান
              </p>
            </div>

            {/* Filter & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={donorCategoryFilter}
                onChange={(e) => setDonorCategoryFilter(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground"
              >
                <option value="all">সকল ক্যাটাগরি</option>
                {DONATION_CATEGORIES_CONFIG.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={donorSearch}
                  onChange={(e) => setDonorSearch(e.target.value)}
                  placeholder="খুঁজুন..."
                  className="rounded-xl border border-border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground"
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-4 shadow-card">
            {filteredDonors.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                কোনো অনুমোদিত অনুদান পাওয়া যায়নি।
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filteredDonors.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        {d.is_anonymous ? (
                          <span className="flex items-center gap-1 font-semibold text-primary text-sm">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" /> মহানুভব শুভাকাঙ্ক্ষী (গোপন অনুদান)
                          </span>
                        ) : (
                          <span className="font-semibold text-foreground text-sm">
                            {d.sender_name}
                          </span>
                        )}
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.2 text-[10px] font-bold text-emerald-600">
                          ভেরিফাইড
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="rounded-md bg-muted px-1.5 py-0.5">
                          {d.category ? (DONATION_CATEGORY_LABELS[d.category] || d.category) : "সাধারণ অনুদান"}
                        </span>
                        <span>• মাধ্যম: {d.method?.toUpperCase()}</span>
                        {d.created_at && (
                          <span>• {new Date(d.created_at).toLocaleDateString("bn-BD")}</span>
                        )}
                        {d.note && <span className="italic block sm:inline">« {d.note} »</span>}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-display text-base font-bold text-emerald-600 sm:text-lg">
                        ৳{Number(d.amount).toLocaleString("bn-BD")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: HUMANITARIAN EXPENSES & RELIEF SPENDING
          ========================================================================= */}
      {activeTab === "expenses" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-card p-4 border border-border">
            <div>
              <h2 className="font-display text-sm font-bold text-foreground">
                মানবিক ব্যয়ের হিসাব ও ভাউচার ({approvedExpenses.length} টি)
              </h2>
              <p className="text-xs text-muted-foreground">
                ত্রাণ, ওষুধ, খাদ্য ও পুনর্বাসনে খরচকৃত অর্থের সম্পূর্ণ বিবরণ
              </p>
            </div>
            <span className="text-xs font-bold text-rose-600">
              মোট ব্যয়: ৳{totalExpenses.toLocaleString("bn-BD")}
            </span>
          </div>

          <div className="rounded-3xl border border-border bg-card p-4 shadow-card">
            {approvedExpenses.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                এখনো কোনো মানবিক ব্যয়ের হিসাব লিপিবদ্ধ করা হয়নি।
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {approvedExpenses.map((e) => (
                  <li key={e.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">{e.title}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="rounded-md bg-rose-500/10 px-2 py-0.5 font-bold text-rose-600">
                          {e.category_label || EXPENSE_CATEGORY_LABELS[e.category] || "ব্যয়"}
                        </span>
                        {e.location && <span>• এলাকা: {e.location}</span>}
                        {e.expense_date && <span>• তারিখ: {e.expense_date}</span>}
                        {e.responsible_person && <span>• দায়িত্বে: {e.responsible_person}</span>}
                      </div>
                      {e.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                          {e.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      {e.receipt_url && (
                        <a
                          href={e.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" /> ভাউচার দেখুন
                        </a>
                      )}
                      <span className="font-display text-sm font-bold text-rose-600 sm:text-base">
                        -৳{Number(e.amount).toLocaleString("bn-BD")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: CENTRAL FINANCIAL REPORTS DASHBOARD (Category 11)
          ========================================================================= */}
      {activeTab === "reports" && (
        <FinancialReports
          donations={donationItems}
          expenses={expenseItems}
        />
      )}
    </div>
  );
}
