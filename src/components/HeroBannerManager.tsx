import React, { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  UploadCloud,
  Trash2,
  RotateCcw,
  Save,
  X,
  Eye,
  Monitor,
  Smartphone,
  Image as ImageIcon,
  Palette,
  Type,
  Link2,
  ShieldCheck,
  Loader2,
  Droplet,
  Phone,
  Send,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  useHeroBannerConfig,
  DEFAULT_HERO_BANNER_CONFIG,
  type HeroBannerConfig,
  type HeroImageFocalPosition,
} from "@/lib/store";
import {
  uploadImageToFirebaseStorage,
  deleteStorageImageByUrl,
} from "@/lib/imageUpload";
import { validateImageFile } from "@/lib/imageProcessor";

const FOCAL_POSITIONS: Array<{ value: HeroImageFocalPosition; label: string }> = [
  { value: "center center", label: "মাঝখান (Center)" },
  { value: "center top", label: "উপরে (Top)" },
  { value: "center bottom", label: "নিচে (Bottom)" },
  { value: "left center", label: "বামে (Left)" },
  { value: "right center", label: "ডানে (Right)" },
];

const RADIUS_OPTIONS: Array<{
  value: HeroBannerConfig["borderRadius"];
  label: string;
}> = [
  { value: "rounded-2xl", label: "মাঝারি (16px)" },
  { value: "rounded-[26px]", label: "স্ট্যান্ডার্ড প্রিমিয়াম (26px)" },
  { value: "rounded-3xl", label: "গোল কোণা (24px)" },
  { value: "rounded-[32px]", label: "এক্সট্রা রাউন্ডেড (32px)" },
];

const COLOR_THEMES = [
  {
    name: "ক্লাসিক স্মার্ট নোয়াখালী",
    gradientFrom: "#073622",
    gradientVia: "#0d4d31",
    gradientTo: "#146842",
    solidColor: "#093f28",
    overlayColor: "#042316",
    textColor: "#ffffff",
    subtextColor: "#ecfdf5",
  },
  {
    name: "রয়্যাল টিল ও এমারেল্ড",
    gradientFrom: "#052e2b",
    gradientVia: "#0f524c",
    gradientTo: "#177268",
    solidColor: "#0b3f3b",
    overlayColor: "#042623",
    textColor: "#ffffff",
    subtextColor: "#f0fdfa",
  },
  {
    name: "মিডনাইট গোল্ডেন ফরেস্ট",
    gradientFrom: "#08281c",
    gradientVia: "#11422e",
    gradientTo: "#1a5c3f",
    solidColor: "#0e3827",
    overlayColor: "#051b12",
    textColor: "#ffffff",
    subtextColor: "#fefce8",
  },
  {
    name: "নীল-সবুজ আধুনিক ব্যানার",
    gradientFrom: "#072b36",
    gradientVia: "#0d4a58",
    gradientTo: "#136b73",
    solidColor: "#0a3c48",
    overlayColor: "#041e26",
    textColor: "#ffffff",
    subtextColor: "#ecfeff",
  },
];

export function HeroBannerManager() {
  const { isMainAdmin } = useAuth();
  const { banner, saveHeroBannerConfig, resetHeroBannerConfig } = useHeroBannerConfig();

  const [draft, setDraft] = useState<HeroBannerConfig>(banner);
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">("mobile");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [desktopProgress, setDesktopProgress] = useState(0);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [mobileProgress, setMobileProgress] = useState(0);

  const desktopInputRef = useRef<HTMLInputElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(banner);
  }, [banner]);

  if (!isMainAdmin) {
    return (
      <div className="rounded-3xl border border-amber-500/40 bg-amber-50/70 p-6 text-center">
        <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-amber-700" />
        <h3 className="font-display text-sm font-bold text-amber-950">
          প্রধান এডমিন সংরক্ষিত বিভাগ
        </h3>
        <p className="mt-1 text-xs text-amber-800">
          হোমপেজ ও হিরো ব্যানার পরিচালনা করার অনুমতি শুধুমাত্র প্রধান এডমিনের জন্য সংরক্ষিত।
        </p>
      </div>
    );
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(banner);

  async function handleImageUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    target: "desktop" | "mobile"
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.ok) {
      toast.error(validation.error || "অবৈধ ইমেজ ফাইল");
      return;
    }

    const setBusy = target === "desktop" ? setUploadingDesktop : setUploadingMobile;
    const setProgress = target === "desktop" ? setDesktopProgress : setMobileProgress;

    setBusy(true);
    setProgress(5);
    try {
      const result = await uploadImageToFirebaseStorage(file, {
        category: "banner",
        entityId: "hero_banner",
        onProgress: (p) => setProgress(p),
      });

      setDraft((prev) => ({
        ...prev,
        backgroundMode: "image",
        ...(target === "desktop"
          ? { desktopImageUrl: result.downloadUrl }
          : { mobileImageUrl: result.downloadUrl }),
      }));

      toast.success(
        target === "desktop"
          ? "ডেস্কটপ/প্রধান হিরো ছবি আপলোড হয়েছে! পরিবর্তন স্থায়ী করতে নিচে 'সংরক্ষণ করুন' চাপুন।"
          : "মোবাইল হিরো ছবি আপলোড হয়েছে! পরিবর্তন স্থায়ী করতে নিচে 'সংরক্ষণ করুন' চাপুন।"
      );
    } catch (err: any) {
      toast.error(err?.message || "হিরো ব্যানার ছবি আপলোড ব্যর্থ হয়েছে");
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(0), 600);
    }
  }

  async function handleRemoveImage(target: "desktop" | "mobile") {
    const targetUrl =
      target === "desktop" ? draft.desktopImageUrl : draft.mobileImageUrl;
    if (targetUrl && targetUrl !== (target === "desktop" ? banner.desktopImageUrl : banner.mobileImageUrl)) {
      // Newly uploaded unsaved image can be cleaned from Storage immediately
      void deleteStorageImageByUrl(targetUrl);
    }
    setDraft((prev) => {
      const nextDesktop = target === "desktop" ? "" : prev.desktopImageUrl;
      const nextMobile = target === "mobile" ? "" : prev.mobileImageUrl;
      return {
        ...prev,
        desktopImageUrl: nextDesktop,
        mobileImageUrl: nextMobile,
        backgroundMode:
          !nextDesktop && !nextMobile && prev.backgroundMode === "image"
            ? "gradient"
            : prev.backgroundMode,
      };
    });
    toast.info("ছবিটি ড্রাফট থেকে সরানো হয়েছে — চূড়ান্ত করতে সংরক্ষণ করুন।");
  }

  async function handleSave() {
    if (!draft.headingLine1.trim() && !draft.headingLine2.trim()) {
      toast.error("হিরো ব্যানারের শিরোনাম সম্পূর্ণ ফাঁকা রাখা যাবে না।");
      return;
    }
    setSaving(true);
    try {
      // Clean up old replaced Storage image if different
      if (banner.desktopImageUrl && banner.desktopImageUrl !== draft.desktopImageUrl) {
        void deleteStorageImageByUrl(banner.desktopImageUrl);
      }
      if (banner.mobileImageUrl && banner.mobileImageUrl !== draft.mobileImageUrl) {
        void deleteStorageImageByUrl(banner.mobileImageUrl);
      }
      await saveHeroBannerConfig(draft);
      toast.success("হোমপেজ হিরো ব্যানার সফলভাবে সংরক্ষণ ও লাইভ আপডেট হয়েছে!");
    } catch (err: any) {
      toast.error(err?.message || "হিরো ব্যানার সংরক্ষণ করা যায়নি।");
    } finally {
      setSaving(false);
    }
  }

  function handleCancelChanges() {
    setDraft(banner);
    toast.info("অসংরক্ষিত পরিবর্তন বাতিল করা হয়েছে।");
  }

  async function handleRestoreDefaults() {
    if (
      !window.confirm(
        "আপনি কি নিশ্চিত যে হোমপেজের হিরো ব্যানার ডিফল্ট স্মার্ট নোয়াখালী ডিজাইনে ফিরিয়ে নেবেন?"
      )
    ) {
      return;
    }
    setResetting(true);
    try {
      if (banner.desktopImageUrl) void deleteStorageImageByUrl(banner.desktopImageUrl);
      if (banner.mobileImageUrl) void deleteStorageImageByUrl(banner.mobileImageUrl);
      const resetVal = await resetHeroBannerConfig();
      setDraft(resetVal);
      toast.success("হিরো ব্যানার ডিফল্ট অবস্থায় ফিরিয়ে আনা হয়েছে!");
    } catch (err: any) {
      toast.error(err?.message || "রিসেট করতে সমস্যা হয়েছে");
    } finally {
      setResetting(false);
    }
  }

  const activePreviewImg =
    previewDevice === "mobile"
      ? draft.mobileImageUrl || draft.desktopImageUrl
      : draft.desktopImageUrl || draft.mobileImageUrl;
  const activeFocal =
    previewDevice === "mobile"
      ? draft.imagePositionMobile
      : draft.imagePositionDesktop;
  const hasPreviewImage = draft.backgroundMode === "image" && Boolean(activePreviewImg);

  return (
    <div className="space-y-5">
      {/* Header & Action Bar */}
      <div className="rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-emerald-500/5 p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-sm">
                <Sparkles className="h-4.5 w-4.5" />
              </span>
              <div>
                <h2 className="font-display text-base font-extrabold text-primary-deep">
                  হোমপেজ ও হিরো ব্যানার ম্যানেজমেন্ট (Main Admin Only)
                </h2>
                <p className="text-xs text-muted-foreground">
                  ব্যানারের ছবি, রঙ, লেখা, বাটন ও লিংক সরাসরি এখান থেকে লাইভ নিয়ন্ত্রণ করুন।
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold shadow-xs">
              <input
                type="checkbox"
                checked={draft.visible}
                onChange={(e) => setDraft({ ...draft, visible: e.target.checked })}
                className="accent-emerald-700"
              />
              <span>হিরো ব্যানার দৃশ্যমান</span>
            </label>

            {isDirty && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                অসংরক্ষিত পরিবর্তন রয়েছে
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 1. Live Preview Card */}
      <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-bold text-foreground">
              লাইভ রেসপনসিভ প্রিভিউ (Live Preview)
            </h3>
          </div>
          <div className="inline-flex rounded-full border border-border bg-muted/60 p-0.5">
            <button
              type="button"
              onClick={() => setPreviewDevice("mobile")}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold transition ${
                previewDevice === "mobile"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Smartphone className="h-3 w-3" /> মোবাইল
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice("desktop")}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold transition ${
                previewDevice === "desktop"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Monitor className="h-3 w-3" /> ডেস্কটপ
            </button>
          </div>
        </div>

        <div className="flex justify-center rounded-2xl bg-muted/40 p-3 sm:p-4">
          {!draft.visible ? (
            <div className="w-full rounded-2xl border border-dashed border-border py-10 text-center text-xs text-muted-foreground">
              হিরো ব্যানার বর্তমানে লুকানো (Hidden) অবস্থায় আছে। দৃশ্যমান করতে উপরের চেকবক্স চালু করুন।
            </div>
          ) : (
            <div
              className={`w-full transition-all duration-300 ${
                previewDevice === "mobile" ? "max-w-[380px]" : "max-w-full"
              }`}
            >
              <section
                className={`relative overflow-hidden border border-emerald-300/20 p-5 shadow-[0_18px_40px_-14px_rgba(7,54,34,0.45)] sm:p-7 ${draft.borderRadius}`}
                style={{
                  background:
                    draft.backgroundMode === "solid"
                      ? draft.solidColor
                      : `linear-gradient(135deg, ${draft.gradientFrom} 0%, ${draft.gradientVia} 50%, ${draft.gradientTo} 100%)`,
                  color: draft.textColor,
                }}
              >
                {hasPreviewImage && (
                  <>
                    <img
                      src={activePreviewImg}
                      alt="Hero Banner Preview"
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                      style={{ objectPosition: activeFocal }}
                    />
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        backgroundColor: draft.overlayColor || "#042316",
                        opacity: (draft.overlayOpacity ?? 55) / 100,
                      }}
                    />
                  </>
                )}

                {draft.showDecorativeGlow && (
                  <>
                    <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-amber-300/20 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-14 -left-10 h-44 w-44 rounded-full bg-emerald-300/20 blur-3xl" />
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                  </>
                )}

                <div className="relative">
                  {draft.badgeText.trim() && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/15 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-50 backdrop-blur-sm">
                      <Droplet className="h-3 w-3 text-amber-300" /> {draft.badgeText}
                    </span>
                  )}

                  <h1
                    className={`mt-3.5 font-bangla font-extrabold leading-[1.24] tracking-tight drop-shadow-xs ${
                      previewDevice === "mobile"
                        ? "text-[22px]"
                        : "text-[28px] sm:text-[32px]"
                    }`}
                    style={{ color: draft.textColor }}
                  >
                    {draft.headingLine1}
                    {draft.headingLine2 && (
                      <>
                        <br />
                        {draft.headingLine2}
                      </>
                    )}
                  </h1>

                  {draft.description.trim() && (
                    <p
                      className="mt-2.5 max-w-xl text-[12.5px] leading-relaxed sm:text-sm"
                      style={{ color: draft.subtextColor, opacity: 0.92 }}
                    >
                      {draft.description}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-2.5">
                    {draft.primaryButtonText.trim() && (
                      <span className="inline-flex min-h-[38px] items-center gap-2 rounded-full bg-gradient-gold px-4.5 py-2 text-xs font-extrabold text-primary-deep shadow-gold">
                        <Phone className="h-3.5 w-3.5" /> {draft.primaryButtonText}
                      </span>
                    )}
                    {draft.secondaryButtonText.trim() && (
                      <span className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur-sm">
                        <Send className="h-3.5 w-3.5" /> {draft.secondaryButtonText}
                      </span>
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {/* 2. Background & Media Management */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-bold text-foreground">
              ব্যানার ব্যাকগ্রাউন্ড ও ছবি (Image / Gradient / Solid)
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "gradient", label: "গ্র্যাডিয়েন্ট ব্যাকগ্রাউন্ড" },
                { id: "solid", label: "একক রঙ (Solid)" },
                { id: "image", label: "ছবি / ফটো ব্যানার" },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setDraft({ ...draft, backgroundMode: mode.id })}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                  draft.backgroundMode === mode.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "border border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Image Upload Grid (Desktop & Mobile) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Desktop / Main Image Card */}
          <div className="rounded-2xl border border-border/80 bg-background/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Monitor className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  প্রধান / ডেস্কটপ হিরো ছবি
                </span>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                JPG, PNG, WebP
              </span>
            </div>

            {draft.desktopImageUrl ? (
              <div className="space-y-2.5">
                <div className="relative h-32 overflow-hidden rounded-xl border border-border bg-muted">
                  <img
                    src={draft.desktopImageUrl}
                    alt="Desktop Hero"
                    className="h-full w-full object-cover"
                    style={{ objectPosition: draft.imagePositionDesktop }}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={uploadingDesktop}
                    onClick={() => desktopInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/15"
                  >
                    <UploadCloud className="h-3.5 w-3.5" /> ছবি পরিবর্তন করুন
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRemoveImage("desktop")}
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-500/15"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> সরিয়ে ফেলুন
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={uploadingDesktop}
                onClick={() => desktopInputRef.current?.click()}
                className="flex h-32 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.03] px-4 text-center transition hover:border-primary/60 hover:bg-primary/[0.06]"
              >
                {uploadingDesktop ? (
                  <>
                    <Loader2 className="mb-1.5 h-6 w-6 animate-spin text-primary" />
                    <span className="text-xs font-bold text-primary">
                      আপলোড হচ্ছে... {desktopProgress}%
                    </span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="mb-1.5 h-6 w-6 text-primary" />
                    <span className="text-xs font-bold text-foreground">
                      ডেস্কটপ / প্রধান ব্যানার ছবি আপলোড করুন
                    </span>
                    <span className="mt-0.5 text-[10px] text-muted-foreground">
                      প্রস্তাবিত অনুপাত ১৬:৯ (স্বয়ংক্রিয় অপ্টিমাইজড)
                    </span>
                  </>
                )}
              </button>
            )}

            <input
              ref={desktopInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={(e) => void handleImageUpload(e, "desktop")}
              className="hidden"
            />

            {uploadingDesktop && desktopProgress > 0 && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${desktopProgress}%` }}
                />
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">
                ডেস্কটপ ফোকাল পজিশন
              </label>
              <select
                value={draft.imagePositionDesktop}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    imagePositionDesktop: e.target.value as HeroImageFocalPosition,
                  })
                }
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium"
              >
                {FOCAL_POSITIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mobile Image Card */}
          <div className="rounded-2xl border border-border/80 bg-background/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Smartphone className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  মোবাইল ব্যানার ছবি (ঐচ্ছিক)
                </span>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                না দিলে প্রধান ছবি দেখাবে
              </span>
            </div>

            {draft.mobileImageUrl ? (
              <div className="space-y-2.5">
                <div className="relative h-32 overflow-hidden rounded-xl border border-border bg-muted">
                  <img
                    src={draft.mobileImageUrl}
                    alt="Mobile Hero"
                    className="h-full w-full object-cover"
                    style={{ objectPosition: draft.imagePositionMobile }}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={uploadingMobile}
                    onClick={() => mobileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/15"
                  >
                    <UploadCloud className="h-3.5 w-3.5" /> পরিবর্তন করুন
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRemoveImage("mobile")}
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-500/15"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> সরান
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={uploadingMobile}
                onClick={() => mobileInputRef.current?.click()}
                className="flex h-32 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 text-center transition hover:border-primary/50 hover:bg-primary/[0.04]"
              >
                {uploadingMobile ? (
                  <>
                    <Loader2 className="mb-1.5 h-6 w-6 animate-spin text-primary" />
                    <span className="text-xs font-bold text-primary">
                      আপলোড হচ্ছে... {mobileProgress}%
                    </span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="mb-1.5 h-6 w-6 text-muted-foreground" />
                    <span className="text-xs font-bold text-foreground">
                      আলাদা মোবাইল ছবি আপলোড (ঐচ্ছিক)
                    </span>
                    <span className="mt-0.5 text-[10px] text-muted-foreground">
                      ফাঁকা রাখলে স্বয়ংক্রিয়ভাবে প্রধান ছবি ব্যবহার হবে
                    </span>
                  </>
                )}
              </button>
            )}

            <input
              ref={mobileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={(e) => void handleImageUpload(e, "mobile")}
              className="hidden"
            />

            {uploadingMobile && mobileProgress > 0 && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${mobileProgress}%` }}
                />
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">
                মোবাইল ফোকাল পজিশন
              </label>
              <select
                value={draft.imagePositionMobile}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    imagePositionMobile: e.target.value as HeroImageFocalPosition,
                  })
                }
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium"
              >
                {FOCAL_POSITIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Contrast Overlay Slider & Quick Color Themes */}
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border/70 bg-muted/30 p-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-foreground">
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" /> ওভারলে স্ক্রিম গাঢ়ত্ব (Contrast Overlay)
              </span>
              <span className="font-mono text-primary">{draft.overlayOpacity}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={90}
              step={5}
              value={draft.overlayOpacity}
              onChange={(e) =>
                setDraft({ ...draft, overlayOpacity: Number(e.target.value) })
              }
              className="w-full accent-emerald-700"
            />
            <p className="text-[10.5px] text-muted-foreground">
              ছবির ওপর বাংলা লেখা যেন সহজে পড়া যায় সেজন্য ৫০%-৭০% ওভারলে আদর্শ।
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">
                ওভারলে রঙ
              </label>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-1.5">
                <input
                  type="color"
                  value={draft.overlayColor}
                  onChange={(e) => setDraft({ ...draft, overlayColor: e.target.value })}
                  className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <span className="font-mono text-[11px]">{draft.overlayColor}</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">
                কর্নার রাউন্ডনেস
              </label>
              <select
                value={draft.borderRadius}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    borderRadius: e.target.value as HeroBannerConfig["borderRadius"],
                  })
                }
                className="mt-1 w-full rounded-xl border border-border bg-background px-2.5 py-2 text-xs font-medium"
              >
                {RADIUS_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Color Presets & Gradient Customization */}
        <div className="space-y-3 rounded-2xl border border-border/70 bg-background/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Palette className="h-3.5 w-3.5 text-primary" /> থিম কালার ও গ্র্যাডিয়েন্ট কাস্টমাইজেশন
            </span>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold">
              <input
                type="checkbox"
                checked={draft.showDecorativeGlow}
                onChange={(e) =>
                  setDraft({ ...draft, showDecorativeGlow: e.target.checked })
                }
                className="accent-emerald-700"
              />
              <span>ডেকোরেটিভ গ্লো লাইটিং</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {COLOR_THEMES.map((theme) => (
              <button
                key={theme.name}
                type="button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    gradientFrom: theme.gradientFrom,
                    gradientVia: theme.gradientVia,
                    gradientTo: theme.gradientTo,
                    solidColor: theme.solidColor,
                    overlayColor: theme.overlayColor,
                    textColor: theme.textColor,
                    subtextColor: theme.subtextColor,
                  })
                }
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold transition hover:border-primary/50"
              >
                <span
                  className="h-3.5 w-3.5 rounded-full border border-white/40"
                  style={{
                    background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
                  }}
                />
                {theme.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">গ্র্যাডিয়েন্ট শুরু</label>
              <div className="mt-1 flex items-center gap-1.5 rounded-xl border border-border bg-background px-2 py-1">
                <input
                  type="color"
                  value={draft.gradientFrom}
                  onChange={(e) => setDraft({ ...draft, gradientFrom: e.target.value })}
                  className="h-5 w-6 cursor-pointer bg-transparent"
                />
                <span className="font-mono text-[10px]">{draft.gradientFrom}</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">গ্র্যাডিয়েন্ট মাঝ</label>
              <div className="mt-1 flex items-center gap-1.5 rounded-xl border border-border bg-background px-2 py-1">
                <input
                  type="color"
                  value={draft.gradientVia}
                  onChange={(e) => setDraft({ ...draft, gradientVia: e.target.value })}
                  className="h-5 w-6 cursor-pointer bg-transparent"
                />
                <span className="font-mono text-[10px]">{draft.gradientVia}</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">গ্র্যাডিয়েন্ট শেষ</label>
              <div className="mt-1 flex items-center gap-1.5 rounded-xl border border-border bg-background px-2 py-1">
                <input
                  type="color"
                  value={draft.gradientTo}
                  onChange={(e) => setDraft({ ...draft, gradientTo: e.target.value })}
                  className="h-5 w-6 cursor-pointer bg-transparent"
                />
                <span className="font-mono text-[10px]">{draft.gradientTo}</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">সলিড রঙ</label>
              <div className="mt-1 flex items-center gap-1.5 rounded-xl border border-border bg-background px-2 py-1">
                <input
                  type="color"
                  value={draft.solidColor}
                  onChange={(e) => setDraft({ ...draft, solidColor: e.target.value })}
                  className="h-5 w-6 cursor-pointer bg-transparent"
                />
                <span className="font-mono text-[10px]">{draft.solidColor}</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">শিরোনাম রঙ</label>
              <div className="mt-1 flex items-center gap-1.5 rounded-xl border border-border bg-background px-2 py-1">
                <input
                  type="color"
                  value={draft.textColor}
                  onChange={(e) => setDraft({ ...draft, textColor: e.target.value })}
                  className="h-5 w-6 cursor-pointer bg-transparent"
                />
                <span className="font-mono text-[10px]">{draft.textColor}</span>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground">বিবরণ রঙ</label>
              <div className="mt-1 flex items-center gap-1.5 rounded-xl border border-border bg-background px-2 py-1">
                <input
                  type="color"
                  value={draft.subtextColor}
                  onChange={(e) => setDraft({ ...draft, subtextColor: e.target.value })}
                  className="h-5 w-6 cursor-pointer bg-transparent"
                />
                <span className="font-mono text-[10px]">{draft.subtextColor}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Typography, Bengali Copy & CTA Controls */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <Type className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-bold text-foreground">
            শিরোনাম, বিবরণ ও অ্যাকশন বাটন সম্পাদনা
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold text-muted-foreground">
              টপ ব্যাজ টেক্সট (Badge Text)
            </label>
            <input
              type="text"
              value={draft.badgeText}
              onChange={(e) => setDraft({ ...draft, badgeText: e.target.value })}
              placeholder={DEFAULT_HERO_BANNER_CONFIG.badgeText}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">
              মূল শিরোনাম (১ম লাইন) *
            </label>
            <input
              type="text"
              value={draft.headingLine1}
              onChange={(e) => setDraft({ ...draft, headingLine1: e.target.value })}
              placeholder={DEFAULT_HERO_BANNER_CONFIG.headingLine1}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">
              মূল শিরোনাম (২য় লাইন)
            </label>
            <input
              type="text"
              value={draft.headingLine2}
              onChange={(e) => setDraft({ ...draft, headingLine2: e.target.value })}
              placeholder={DEFAULT_HERO_BANNER_CONFIG.headingLine2}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold focus:border-primary focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold text-muted-foreground">
              ব্যানারের বিবরণ / সাবটাইটেল
            </label>
            <textarea
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder={DEFAULT_HERO_BANNER_CONFIG.description}
              className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs leading-relaxed focus:border-primary focus:outline-none"
            />
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/25 p-3.5 space-y-2.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-primary-deep">
              <Link2 className="h-3.5 w-3.5 text-amber-600" /> প্রাইমারি বাটন (Gold CTA)
            </p>
            <div>
              <label className="text-[10.5px] font-semibold text-muted-foreground">বাটনের লেখা</label>
              <input
                type="text"
                value={draft.primaryButtonText}
                onChange={(e) => setDraft({ ...draft, primaryButtonText: e.target.value })}
                placeholder="জরুরী 999"
                className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-semibold text-muted-foreground">লিংক / URL / tel:</label>
              <input
                type="text"
                value={draft.primaryButtonLink}
                onChange={(e) => setDraft({ ...draft, primaryButtonLink: e.target.value })}
                placeholder="tel:999"
                className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-1.5 font-mono text-xs"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/25 p-3.5 space-y-2.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-primary-deep">
              <Link2 className="h-3.5 w-3.5 text-primary" /> সেকেন্ডারি বাটন (Outline CTA)
            </p>
            <div>
              <label className="text-[10.5px] font-semibold text-muted-foreground">বাটনের লেখা</label>
              <input
                type="text"
                value={draft.secondaryButtonText}
                onChange={(e) => setDraft({ ...draft, secondaryButtonText: e.target.value })}
                placeholder="নতুন তথ্য দিন"
                className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-semibold text-muted-foreground">লিংক / রুট (/submit-info বা URL)</label>
              <input
                type="text"
                value={draft.secondaryButtonLink}
                onChange={(e) => setDraft({ ...draft, secondaryButtonLink: e.target.value })}
                placeholder="/submit-info"
                className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-1.5 font-mono text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Save / Cancel / Restore Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-primary/25 bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving || resetting}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-hero px-5 py-2.5 text-xs font-extrabold text-primary-foreground shadow-elevated transition hover:brightness-105 active:scale-95 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>{saving ? "সংরক্ষণ হচ্ছে..." : "পরিবর্তন সংরক্ষণ করুন"}</span>
          </button>

          {isDirty && (
            <button
              type="button"
              disabled={saving || resetting}
              onClick={handleCancelChanges}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2.5 text-xs font-bold text-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" /> বাতিল করুন
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {banner.updatedAt && (
            <span className="hidden items-center gap-1 text-[10.5px] text-muted-foreground sm:inline-flex">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              সর্বশেষ আপডেট: {new Date(banner.updatedAt).toLocaleDateString("bn-BD")}
            </span>
          )}
          <button
            type="button"
            disabled={saving || resetting}
            onClick={() => void handleRestoreDefaults()}
            className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-bold text-destructive transition hover:bg-destructive/15 disabled:opacity-60"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{resetting ? "রিসেট হচ্ছে..." : "ডিফল্ট পুনরুদ্ধার"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
