import React, { useEffect, useState } from "react";
import {
  Layout,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Megaphone,
  HelpCircle,
  Palette,
  Globe,
  Share2,
  CheckCircle2,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  useHomepageConfig,
  useWebsiteContentConfig,
  DEFAULT_HOMEPAGE_CONFIG,
  DEFAULT_WEBSITE_CONTENT_CONFIG,
  type HomepageConfig,
  type WebsiteContentConfig,
  type ThemeAccentPreset,
} from "@/lib/store";
import { recordSuperAdminAudit } from "@/lib/staff-audit";

const ICON_CHOICES = [
  "ShieldAlert",
  "Droplet",
  "HandCoins",
  "MapPin",
  "Building2",
  "Briefcase",
  "AlertTriangle",
  "Phone",
  "HeartPulse",
  "Hospital",
  "GraduationCap",
  "Newspaper",
  "Users",
  "Bell",
  "Sparkles",
];

const THEME_PRESETS: Array<{
  id: ThemeAccentPreset;
  name: string;
  desc: string;
  swatch: string;
}> = [
  {
    id: "emerald",
    name: "এমারেল্ড প্রিস্টিজ (ডিফল্ট)",
    desc: "স্মার্ট নোয়াখালী ক্লাসিক সবুজ থিম",
    swatch: "from-emerald-800 via-emerald-700 to-emerald-500",
  },
  {
    id: "teal",
    name: "রয়্যাল টিল ও সি-গ্রিন",
    desc: "আধুনিক উপকূলীয় টিল অ্যাকসেন্ট",
    swatch: "from-teal-900 via-teal-700 to-cyan-600",
  },
  {
    id: "blue",
    name: "ডিজিটাল নেভি ও স্লেট ব্লু",
    desc: "সরকারি ও নাগরিক পোর্টাল ব্লু",
    swatch: "from-slate-900 via-blue-800 to-sky-600",
  },
  {
    id: "gold",
    name: "ফরেস্ট গোল্ড হেরিটেজ",
    desc: "সোনালী ও গাঢ় সবুজ প্রিমিয়াম",
    swatch: "from-emerald-950 via-emerald-800 to-amber-500",
  },
];

export function HomepageContentManager() {
  const { isMainAdmin } = useAuth();
  const { homepageConfig, saveHomepageConfig, resetHomepageConfig } = useHomepageConfig();
  const { contentConfig, saveWebsiteContentConfig, resetWebsiteContentConfig } =
    useWebsiteContentConfig();

  const [subTab, setSubTab] = useState<"sections" | "content" | "seo_theme">("sections");
  const [hpDraft, setHpDraft] = useState<HomepageConfig>(homepageConfig);
  const [wcDraft, setWcDraft] = useState<WebsiteContentConfig>(contentConfig);
  const [saving, setSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    setHpDraft(homepageConfig);
  }, [homepageConfig]);

  useEffect(() => {
    setWcDraft(contentConfig);
  }, [contentConfig]);

  if (!isMainAdmin) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-center text-xs text-amber-900">
        <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-amber-700" />
        হোমপেজ ও ওয়েবসাইট কন্টেন্ট নিয়ন্ত্রণ শুধুমাত্র প্রধান সুপার এডমিনের জন্য সংরক্ষিত।
      </div>
    );
  }

  async function handleSaveAll() {
    setSaving(true);
    try {
      await saveHomepageConfig(hpDraft);
      await saveWebsiteContentConfig(wcDraft);
      void recordSuperAdminAudit({
        action: "settings_change",
        module: "homepage_content",
        target_id: "homepage_and_website_content",
        target_label: "হোমপেজ, কন্টেন্ট, FAQ, SEO ও থিম",
        summary: "সুপার এডমিন হোমপেজ সেকশন, কন্টেন্ট, SEO এবং থিম সেটিংস আপডেট করেছেন",
        metadata: { themeAccent: wcDraft.themeAccent },
      });
      toast.success("হোমপেজ সেকশন, কন্টেন্ট, SEO ও থিম সফলভাবে লাইভ সেভ হয়েছে!");
    } catch (err: any) {
      toast.error(err?.message || "সংরক্ষণ ব্যর্থ হয়েছে");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmReset() {
    setSaving(true);
    try {
      const defHp = await resetHomepageConfig();
      const defWc = await resetWebsiteContentConfig();
      setHpDraft(defHp);
      setWcDraft(defWc);
      setShowResetConfirm(false);
      void recordSuperAdminAudit({
        action: "settings_change",
        module: "homepage_content",
        target_id: "reset_defaults",
        target_label: "ডিফল্ট কনফিগারেশন রিসেট",
        summary: "হোমপেজ ও ওয়েবসাইট কন্টেন্ট ডিফল্ট অবস্থায় ফিরিয়ে আনা হয়েছে",
      });
      toast.success("ডিফল্ট কনফিগারেশনে রিসেট হয়েছে!");
    } catch (err: any) {
      toast.error(err?.message || "রিসেট ব্যর্থ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-primary/20 bg-card p-4 sm:p-5 shadow-card">
        <div>
          <h3 className="flex items-center gap-2 font-display text-sm font-bold text-primary-deep">
            <Layout className="h-4 w-4 text-primary" /> সম্পূর্ণ হোমপেজ, কন্টেন্ট, FAQ, ফুটার ও থিম কন্ট্রোল
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            হোমপেজের প্রতিটি সেকশন চালু/বন্ধ, শর্টকাট, ঘোষণা, FAQ, সোশ্যাল লিংক ও কালার থিম এখান থেকে নিয়ন্ত্রণ করুন।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> ডিফল্ট রিসেট
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveAll()}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-hero px-4 py-2 text-xs font-bold text-primary-foreground shadow-card disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            সব পরিবর্তন সংরক্ষণ করুন
          </button>
        </div>
      </div>

      {/* Sub-navigation Pills */}
      <div className="flex flex-wrap gap-1.5 rounded-2xl bg-muted p-1.5">
        <button
          type="button"
          onClick={() => setSubTab("sections")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
            subTab === "sections"
              ? "bg-card text-primary-deep shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          হোমপেজ সেকশন, কুইক বাটন ও ঘোষণা
        </button>
        <button
          type="button"
          onClick={() => setSubTab("content")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
            subTab === "content"
              ? "bg-card text-primary-deep shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          আমাদের লক্ষ্য, FAQ, নোটিশ ও ফুটার
        </button>
        <button
          type="button"
          onClick={() => setSubTab("seo_theme")}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
            subTab === "seo_theme"
              ? "bg-card text-primary-deep shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          SEO মেটাডাটা ও থিম কালার
        </button>
      </div>

      {/* SUBTAB 1: Homepage Section Visibility, Announcement, Quick Actions, Shortcuts */}
      {subTab === "sections" && (
        <div className="space-y-4">
          {/* Visibility Switches */}
          <div className="rounded-2xl bg-card p-4 shadow-card space-y-3">
            <p className="text-xs font-bold text-primary-deep">হোমপেজ সেকশন দৃশ্যমানতা (Show / Hide)</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                { key: "showHero", label: "হিরো ব্যানার সেকশন" },
                { key: "showQuickActions", label: "৩টি কুইক অ্যাকশন বাটন" },
                { key: "showFeaturedShortcuts", label: "৪টি ফিচার্ড জেলা শর্টকাট" },
                { key: "showEmergencyBanner", label: "জরুরি অ্যালার্ট ব্যানার" },
                { key: "showDivisions", label: "২২টি প্রধান বিভাগ ও ক্যাটাগরি গ্রিড" },
                { key: "showFooterAppCallout", label: "ফুটার ও অ্যাপ ডাউনলোড কলআউট" },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs font-semibold"
                >
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    checked={(hpDraft as any)[item.key] !== false}
                    onChange={(e) =>
                      setHpDraft({ ...hpDraft, [item.key]: e.target.checked })
                    }
                    className="h-4 w-4 accent-emerald-700"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Top Announcement Banner */}
          <div className="rounded-2xl bg-card p-4 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-bold text-primary-deep">
                <Megaphone className="h-4 w-4 text-primary" /> হোমপেজ বিশেষ ঘোষণা (Announcement Strip)
              </p>
              <label className="flex items-center gap-1.5 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={hpDraft.announcement.visible}
                  onChange={(e) =>
                    setHpDraft({
                      ...hpDraft,
                      announcement: { ...hpDraft.announcement, visible: e.target.checked },
                    })
                  }
                />
                সক্রিয়
              </label>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                value={hpDraft.announcement.title}
                onChange={(e) =>
                  setHpDraft({
                    ...hpDraft,
                    announcement: { ...hpDraft.announcement, title: e.target.value },
                  })
                }
                placeholder="ঘোষণার শিরোনাম"
                className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
              />
              <select
                value={hpDraft.announcement.tone}
                onChange={(e) =>
                  setHpDraft({
                    ...hpDraft,
                    announcement: { ...hpDraft.announcement, tone: e.target.value as any },
                  })
                }
                className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
              >
                <option value="amber">হলুদ সতর্কতা (Amber)</option>
                <option value="emerald">সবুজ তথ্য (Emerald)</option>
                <option value="blue">নীল নোটিশ (Blue)</option>
                <option value="rose">লাল জরুরি (Red)</option>
              </select>
              <input
                value={hpDraft.announcement.text}
                onChange={(e) =>
                  setHpDraft({
                    ...hpDraft,
                    announcement: { ...hpDraft.announcement, text: e.target.value },
                  })
                }
                placeholder="ঘোষণার বিস্তারিত বার্তা..."
                className="rounded-xl border border-border bg-background px-3 py-2 text-xs sm:col-span-2"
              />
              <input
                value={hpDraft.announcement.link}
                onChange={(e) =>
                  setHpDraft({
                    ...hpDraft,
                    announcement: { ...hpDraft.announcement, link: e.target.value },
                  })
                }
                placeholder="ক্লিক করলে কোথায় যাবে? (যেমন: /blood-donor বা https://...)"
                className="rounded-xl border border-border bg-background px-3 py-2 text-xs sm:col-span-2"
              />
            </div>
          </div>

          {/* Quick Actions Editor */}
          <div className="rounded-2xl bg-card p-4 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-primary-deep">কুইক অ্যাকশন বাটনসমূহ</p>
              <button
                type="button"
                onClick={() =>
                  setHpDraft({
                    ...hpDraft,
                    quickActions: [
                      ...hpDraft.quickActions,
                      {
                        id: `qa_${Date.now()}`,
                        label: "নতুন শর্টকাট",
                        to: "/directory",
                        tone: "emerald",
                        iconName: "Sparkles",
                        visible: true,
                      },
                    ],
                  })
                }
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary-deep"
              >
                <Plus className="h-3 w-3" /> যোগ করুন
              </button>
            </div>
            <div className="space-y-2">
              {hpDraft.quickActions.map((qa, idx) => (
                <div
                  key={qa.id}
                  className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-muted/20 p-2.5 sm:grid-cols-5"
                >
                  <input
                    value={qa.label}
                    onChange={(e) => {
                      const next = [...hpDraft.quickActions];
                      next[idx] = { ...qa, label: e.target.value };
                      setHpDraft({ ...hpDraft, quickActions: next });
                    }}
                    placeholder="লেবেল"
                    className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                  />
                  <input
                    value={qa.to}
                    onChange={(e) => {
                      const next = [...hpDraft.quickActions];
                      next[idx] = { ...qa, to: e.target.value };
                      setHpDraft({ ...hpDraft, quickActions: next });
                    }}
                    placeholder="রুট (/blood-donor)"
                    className="rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-xs"
                  />
                  <select
                    value={qa.iconName}
                    onChange={(e) => {
                      const next = [...hpDraft.quickActions];
                      next[idx] = { ...qa, iconName: e.target.value };
                      setHpDraft({ ...hpDraft, quickActions: next });
                    }}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                  >
                    {ICON_CHOICES.map((ic) => (
                      <option key={ic} value={ic}>
                        {ic}
                      </option>
                    ))}
                  </select>
                  <select
                    value={qa.tone}
                    onChange={(e) => {
                      const next = [...hpDraft.quickActions];
                      next[idx] = { ...qa, tone: e.target.value as any };
                      setHpDraft({ ...hpDraft, quickActions: next });
                    }}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                  >
                    <option value="red">Red</option>
                    <option value="rose">Rose</option>
                    <option value="emerald">Emerald</option>
                    <option value="blue">Blue</option>
                    <option value="amber">Amber</option>
                  </select>
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-1 text-[11px] font-semibold">
                      <input
                        type="checkbox"
                        checked={qa.visible !== false}
                        onChange={(e) => {
                          const next = [...hpDraft.quickActions];
                          next[idx] = { ...qa, visible: e.target.checked };
                          setHpDraft({ ...hpDraft, quickActions: next });
                        }}
                      />
                      দৃশ্যমান
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setHpDraft({
                          ...hpDraft,
                          quickActions: hpDraft.quickActions.filter((_, i) => i !== idx),
                        })
                      }
                      className="rounded-full bg-rose-500/10 p-1 text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Featured Shortcuts Editor */}
          <div className="rounded-2xl bg-card p-4 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-primary-deep">ফিচার্ড জেলা শর্টকাট কার্ডসমূহ</p>
              <button
                type="button"
                onClick={() =>
                  setHpDraft({
                    ...hpDraft,
                    featuredShortcuts: [
                      ...hpDraft.featuredShortcuts,
                      {
                        id: `fs_${Date.now()}`,
                        title: "নতুন শর্টকাট",
                        subtitle: "বিবরণ",
                        to: "/directory",
                        iconName: "MapPin",
                        tone: "primary",
                        visible: true,
                      },
                    ],
                  })
                }
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary-deep"
              >
                <Plus className="h-3 w-3" /> যোগ করুন
              </button>
            </div>
            <div className="space-y-2">
              {hpDraft.featuredShortcuts.map((fs, idx) => (
                <div
                  key={fs.id}
                  className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-muted/20 p-2.5 sm:grid-cols-6"
                >
                  <input
                    value={fs.title}
                    onChange={(e) => {
                      const next = [...hpDraft.featuredShortcuts];
                      next[idx] = { ...fs, title: e.target.value };
                      setHpDraft({ ...hpDraft, featuredShortcuts: next });
                    }}
                    placeholder="শিরোনাম"
                    className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                  />
                  <input
                    value={fs.subtitle}
                    onChange={(e) => {
                      const next = [...hpDraft.featuredShortcuts];
                      next[idx] = { ...fs, subtitle: e.target.value };
                      setHpDraft({ ...hpDraft, featuredShortcuts: next });
                    }}
                    placeholder="উপ-শিরোনাম"
                    className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                  />
                  <input
                    value={fs.to}
                    onChange={(e) => {
                      const next = [...hpDraft.featuredShortcuts];
                      next[idx] = { ...fs, to: e.target.value };
                      setHpDraft({ ...hpDraft, featuredShortcuts: next });
                    }}
                    placeholder="রুট (/map)"
                    className="rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-xs"
                  />
                  <select
                    value={fs.iconName}
                    onChange={(e) => {
                      const next = [...hpDraft.featuredShortcuts];
                      next[idx] = { ...fs, iconName: e.target.value };
                      setHpDraft({ ...hpDraft, featuredShortcuts: next });
                    }}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                  >
                    {ICON_CHOICES.map((ic) => (
                      <option key={ic} value={ic}>
                        {ic}
                      </option>
                    ))}
                  </select>
                  <select
                    value={fs.tone}
                    onChange={(e) => {
                      const next = [...hpDraft.featuredShortcuts];
                      next[idx] = { ...fs, tone: e.target.value as any };
                      setHpDraft({ ...hpDraft, featuredShortcuts: next });
                    }}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                  >
                    <option value="primary">Primary</option>
                    <option value="blue">Blue</option>
                    <option value="emerald">Emerald</option>
                    <option value="amber">Amber</option>
                    <option value="rose">Rose</option>
                  </select>
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-1 text-[11px] font-semibold">
                      <input
                        type="checkbox"
                        checked={fs.visible !== false}
                        onChange={(e) => {
                          const next = [...hpDraft.featuredShortcuts];
                          next[idx] = { ...fs, visible: e.target.checked };
                          setHpDraft({ ...hpDraft, featuredShortcuts: next });
                        }}
                      />
                      দৃশ্যমান
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setHpDraft({
                          ...hpDraft,
                          featuredShortcuts: hpDraft.featuredShortcuts.filter((_, i) => i !== idx),
                        })
                      }
                      className="rounded-full bg-rose-500/10 p-1 text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: About Goals, FAQ, Public Notices, Footer & Social */}
      {subTab === "content" && (
        <div className="space-y-4">
          {/* About Mission Goals */}
          <div className="rounded-2xl bg-card p-4 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-bold text-primary-deep">
                <CheckCircle2 className="h-4 w-4 text-primary" /> আমাদের লক্ষ্য ও উদ্দেশ্য (/about পেজ)
              </p>
              <button
                type="button"
                onClick={() =>
                  setWcDraft({
                    ...wcDraft,
                    aboutMissionGoals: [...wcDraft.aboutMissionGoals, ""],
                  })
                }
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary-deep"
              >
                <Plus className="h-3 w-3" /> লক্ষ্য যোগ
              </button>
            </div>
            <div className="space-y-2">
              {wcDraft.aboutMissionGoals.map((goal, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    value={goal}
                    onChange={(e) => {
                      const next = [...wcDraft.aboutMissionGoals];
                      next[idx] = e.target.value;
                      setWcDraft({ ...wcDraft, aboutMissionGoals: next });
                    }}
                    placeholder={`লক্ষ্য #${idx + 1}`}
                    className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setWcDraft({
                        ...wcDraft,
                        aboutMissionGoals: wcDraft.aboutMissionGoals.filter((_, i) => i !== idx),
                      })
                    }
                    className="rounded-full bg-rose-500/10 p-1.5 text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ Editor */}
          <div className="rounded-2xl bg-card p-4 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-bold text-primary-deep">
                <HelpCircle className="h-4 w-4 text-primary" /> সাধারণ জিজ্ঞাসা (FAQ)
              </p>
              <button
                type="button"
                onClick={() =>
                  setWcDraft({
                    ...wcDraft,
                    faqItems: [
                      ...wcDraft.faqItems,
                      { id: `faq_${Date.now()}`, question: "", answer: "", visible: true },
                    ],
                  })
                }
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary-deep"
              >
                <Plus className="h-3 w-3" /> FAQ যোগ
              </button>
            </div>
            <div className="space-y-2.5">
              {wcDraft.faqItems.map((faq, idx) => (
                <div key={faq.id} className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      value={faq.question}
                      onChange={(e) => {
                        const next = [...wcDraft.faqItems];
                        next[idx] = { ...faq, question: e.target.value };
                        setWcDraft({ ...wcDraft, faqItems: next });
                      }}
                      placeholder="প্রশ্ন লিখুন..."
                      className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold"
                    />
                    <label className="flex items-center gap-1 text-[11px]">
                      <input
                        type="checkbox"
                        checked={faq.visible !== false}
                        onChange={(e) => {
                          const next = [...wcDraft.faqItems];
                          next[idx] = { ...faq, visible: e.target.checked };
                          setWcDraft({ ...wcDraft, faqItems: next });
                        }}
                      />
                      দৃশ্যমান
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setWcDraft({
                          ...wcDraft,
                          faqItems: wcDraft.faqItems.filter((_, i) => i !== idx),
                        })
                      }
                      className="rounded-full bg-rose-500/10 p-1 text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={faq.answer}
                    onChange={(e) => {
                      const next = [...wcDraft.faqItems];
                      next[idx] = { ...faq, answer: e.target.value };
                      setWcDraft({ ...wcDraft, faqItems: next });
                    }}
                    placeholder="উত্তর লিখুন..."
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Public Notices Editor */}
          <div className="rounded-2xl bg-card p-4 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-bold text-primary-deep">
                <Megaphone className="h-4 w-4 text-primary" /> জনস্বার্থ নোটিশ বোর্ড (Public Notices)
              </p>
              <button
                type="button"
                onClick={() =>
                  setWcDraft({
                    ...wcDraft,
                    publicNotices: [
                      {
                        id: `notice_${Date.now()}`,
                        title: "",
                        body: "",
                        date: new Date().toISOString().slice(0, 10),
                        visible: true,
                      },
                      ...wcDraft.publicNotices,
                    ],
                  })
                }
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary-deep"
              >
                <Plus className="h-3 w-3" /> নতুন নোটিশ
              </button>
            </div>
            {wcDraft.publicNotices.length === 0 ? (
              <p className="text-xs text-muted-foreground">কোনো পাবলিক নোটিশ যোগ করা হয়নি।</p>
            ) : (
              <div className="space-y-2">
                {wcDraft.publicNotices.map((n, idx) => (
                  <div key={n.id} className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={n.title}
                        onChange={(e) => {
                          const next = [...wcDraft.publicNotices];
                          next[idx] = { ...n, title: e.target.value };
                          setWcDraft({ ...wcDraft, publicNotices: next });
                        }}
                        placeholder="নোটিশ শিরোনাম"
                        className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold"
                      />
                      <input
                        type="date"
                        value={n.date}
                        onChange={(e) => {
                          const next = [...wcDraft.publicNotices];
                          next[idx] = { ...n, date: e.target.value };
                          setWcDraft({ ...wcDraft, publicNotices: next });
                        }}
                        className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                      />
                      <label className="flex items-center gap-1 text-[11px]">
                        <input
                          type="checkbox"
                          checked={n.visible !== false}
                          onChange={(e) => {
                            const next = [...wcDraft.publicNotices];
                            next[idx] = { ...n, visible: e.target.checked };
                            setWcDraft({ ...wcDraft, publicNotices: next });
                          }}
                        />
                        দৃশ্যমান
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setWcDraft({
                            ...wcDraft,
                            publicNotices: wcDraft.publicNotices.filter((_, i) => i !== idx),
                          })
                        }
                        className="rounded-full bg-rose-500/10 p-1 text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={n.body}
                      onChange={(e) => {
                        const next = [...wcDraft.publicNotices];
                        next[idx] = { ...n, body: e.target.value };
                        setWcDraft({ ...wcDraft, publicNotices: next });
                      }}
                      placeholder="নোটিশের বিস্তারিত বিবরণ..."
                      className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer & Social Links */}
          <div className="rounded-2xl bg-card p-4 shadow-card space-y-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-primary-deep">
              <Share2 className="h-4 w-4 text-primary" /> ফুটার কপিরাইট ও সোশ্যাল মিডিয়া লিংক
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                value={wcDraft.footerTagline}
                onChange={(e) => setWcDraft({ ...wcDraft, footerTagline: e.target.value })}
                placeholder="অ্যাপ কলআউট লেখা"
                className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
              />
              <input
                value={wcDraft.footerCopyright}
                onChange={(e) => setWcDraft({ ...wcDraft, footerCopyright: e.target.value })}
                placeholder="কপিরাইট টেক্সট"
                className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
              />
              <input
                value={wcDraft.socialLinks.facebook}
                onChange={(e) =>
                  setWcDraft({
                    ...wcDraft,
                    socialLinks: { ...wcDraft.socialLinks, facebook: e.target.value },
                  })
                }
                placeholder="Facebook Page URL"
                className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
              />
              <input
                value={wcDraft.socialLinks.youtube}
                onChange={(e) =>
                  setWcDraft({
                    ...wcDraft,
                    socialLinks: { ...wcDraft.socialLinks, youtube: e.target.value },
                  })
                }
                placeholder="YouTube Channel URL"
                className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
              />
              <input
                value={wcDraft.socialLinks.whatsapp}
                onChange={(e) =>
                  setWcDraft({
                    ...wcDraft,
                    socialLinks: { ...wcDraft.socialLinks, whatsapp: e.target.value },
                  })
                }
                placeholder="WhatsApp Group / Contact URL"
                className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
              />
              <input
                value={wcDraft.socialLinks.website}
                onChange={(e) =>
                  setWcDraft({
                    ...wcDraft,
                    socialLinks: { ...wcDraft.socialLinks, website: e.target.value },
                  })
                }
                placeholder="Official Website URL"
                className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: SEO & Global Color Theme Accent */}
      {subTab === "seo_theme" && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-card p-4 shadow-card space-y-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-primary-deep">
              <Globe className="h-4 w-4 text-primary" /> গ্লোবাল SEO টাইটেল ও মেটা ডেসক্রিপশন
            </p>
            <div className="space-y-2">
              <input
                value={wcDraft.seoTitle}
                onChange={(e) => setWcDraft({ ...wcDraft, seoTitle: e.target.value })}
                placeholder="ওয়েবসাইটের শিরোনাম (Document Title)"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
              />
              <textarea
                rows={2}
                value={wcDraft.seoDescription}
                onChange={(e) => setWcDraft({ ...wcDraft, seoDescription: e.target.value })}
                placeholder="সার্চ ইঞ্জিন মেটা ডেসক্রিপশন"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-card p-4 shadow-card space-y-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-primary-deep">
              <Palette className="h-4 w-4 text-primary" /> গ্লোবাল ওয়েবসাইট কালার থিম (Theme Accent)
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {THEME_PRESETS.map((preset) => {
                const selected = wcDraft.themeAccent === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setWcDraft({ ...wcDraft, themeAccent: preset.id })}
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                      selected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                        : "border-border bg-background hover:border-primary/40"
                    }`}
                  >
                    <div
                      className={`h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br ${preset.swatch} shadow-sm`}
                    />
                    <div>
                      <p className="text-xs font-bold text-foreground">{preset.name}</p>
                      <p className="text-[11px] text-muted-foreground">{preset.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirm Modal */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowResetConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-card p-5 shadow-elevated space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="font-display text-sm font-bold text-rose-700">
              ডিফল্ট হোমপেজ ও কন্টেন্টে ফিরে যাবেন?
            </h4>
            <p className="text-xs text-muted-foreground">
              এটি সকল কাস্টম শর্টকাট, ঘোষণা, FAQ এবং থিম প্রিসেটকে ডিফল্ট স্মার্ট নোয়াখালী সেটিংসে ফিরিয়ে আনবে।
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="rounded-full bg-muted px-4 py-1.5 text-xs font-semibold"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleConfirmReset()}
                className="rounded-full bg-rose-600 px-4 py-1.5 text-xs font-bold text-white"
              >
                হ্যাঁ, রিসেট করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
