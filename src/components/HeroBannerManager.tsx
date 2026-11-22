import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  UploadCloud,
  Trash2,
  RotateCcw,
  Save,
  X,
  Eye,
  EyeOff,
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
  Plus,
  Copy,
  ArrowUp,
  ArrowDown,
  CalendarClock,
  SlidersHorizontal,
  AlertTriangle,
  AlignLeft,
  AlignCenter,
  AlignRight,
  RefreshCw,
  LayoutTemplate,
  Maximize2,
  Tablet,
  Move,
  Crosshair,
  Magnet,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { auth, isSuperAdminEmail } from "@/lib/firebase";
import {
  useHeroBannerConfig,
  deleteHeroImageAsset,
  DEFAULT_HERO_BANNER_ITEM,
  DEFAULT_HERO_CAROUSEL_SETTINGS,
  isBannerWithinSchedule,
  type HeroBannerConfig,
  type HeroBannerItem,
  type HeroCarouselSettings,
  type HeroImageFocalPosition,
  type HeroLayoutMode,
  type HeroImageFit,
  type HeroTransitionStyle,
} from "@/lib/store";
import {
  HERO_ELEMENT_IDS,
  HERO_ELEMENT_LABELS_BN,
  clampElementPosition,
  clampNumber,
  createDefaultBreakpointLayout,
  getElementCanvasStyle,
  resolveBreakpointLayout,
  roundStep,
  type HeroBreakpointLayout,
  type HeroDeviceBreakpoint,
  type HeroEditableElementId,
  type HeroElementPosition,
} from "@/lib/heroPositioning";
import { useRolePermissions } from "@/lib/permissions";
import {
  uploadImageToR2,
  deleteR2FileByUrl,
} from "@/lib/r2Storage";
import { validateImageFile, formatFileSizeBn } from "@/lib/imageProcessor";
import { recordSuperAdminAudit } from "@/lib/staff-audit";

const FOCAL_POSITIONS: Array<{ value: HeroImageFocalPosition; label: string }> = [
  { value: "center center", label: "মাঝখান (Center)" },
  { value: "center top", label: "উপরে (Top)" },
  { value: "center 20%", label: "উপরে-মাঝে (Top 20%)" },
  { value: "center 35%", label: "হালকা উপরে (35%)" },
  { value: "center 70%", label: "হালকা নিচে (70%)" },
  { value: "center bottom", label: "নিচে (Bottom)" },
  { value: "left center", label: "বামে (Left)" },
  { value: "right center", label: "ডানে (Right)" },
  { value: "25% 25%", label: "বাম-উপরে (25% 25%)" },
  { value: "75% 25%", label: "ডান-উপরে (75% 25%)" },
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
    headingColor: "#ffffff",
    descriptionColor: "#ecfdf5",
    primaryButtonColor: "#ffffff",
    primaryButtonBgColor: "#dc2626",
    secondaryButtonColor: "#064e3b",
    secondaryButtonBgColor: "#ffffff",
  },
  {
    name: "রয়্যাল টিল ও এমারেল্ড",
    gradientFrom: "#052e2b",
    gradientVia: "#0f524c",
    gradientTo: "#177268",
    solidColor: "#0b3f3b",
    overlayColor: "#042623",
    headingColor: "#ffffff",
    descriptionColor: "#f0fdfa",
    primaryButtonColor: "#042f2e",
    primaryButtonBgColor: "#fbbf24",
    secondaryButtonColor: "#ffffff",
    secondaryButtonBgColor: "rgba(255,255,255,0.14)",
  },
  {
    name: "মিডনাইট গোল্ডেন ফরেস্ট",
    gradientFrom: "#08281c",
    gradientVia: "#11422e",
    gradientTo: "#1a5c3f",
    solidColor: "#0e3827",
    overlayColor: "#051b12",
    headingColor: "#fef9c3",
    descriptionColor: "#fefce8",
    primaryButtonColor: "#451a03",
    primaryButtonBgColor: "#f59e0b",
    secondaryButtonColor: "#064e3b",
    secondaryButtonBgColor: "#ffffff",
  },
  {
    name: "নীল-সবুজ আধুনিক ব্যানার",
    gradientFrom: "#072b36",
    gradientVia: "#0d4a58",
    gradientTo: "#136b73",
    solidColor: "#0a3c48",
    overlayColor: "#041e26",
    headingColor: "#ffffff",
    descriptionColor: "#ecfeff",
    primaryButtonColor: "#ffffff",
    primaryButtonBgColor: "#0284c7",
    secondaryButtonColor: "#083344",
    secondaryButtonBgColor: "#ffffff",
  },
];

// Simple hex parser & WCAG contrast helper (ignores non-hex rgba gracefully)
function parseHexColor(color: string): [number, number, number] | null {
  const clean = (color || "").trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(clean);
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  const intVal = parseInt(hex, 16);
  return [(intVal >> 16) & 255, (intVal >> 8) & 255, intVal & 255];
}

function getRelativeLuminance([r, g, b]: [number, number, number]): number {
  const srgb = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function getContrastRatio(fgHex: string, bgHex: string): number | null {
  const fg = parseHexColor(fgHex);
  const bg = parseHexColor(bgHex);
  if (!fg || !bg) return null;
  const l1 = getRelativeLuminance(fg);
  const l2 = getRelativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function ColorInputField({
  label,
  value,
  defaultValue,
  contrastAgainst,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  defaultValue: string;
  contrastAgainst?: string;
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  const pickerVal = parseHexColor(value) ? value : "#ffffff";
  const ratio = contrastAgainst ? getContrastRatio(value, contrastAgainst) : null;
  const lowContrast = ratio !== null && ratio < 4.5;

  return (
    <div className="rounded-2xl border border-border/80 bg-background/80 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-1">
        <label className="text-[10.5px] font-bold text-foreground truncate">{label}</label>
        {value !== defaultValue && !disabled && (
          <button
            type="button"
            onClick={() => onChange(defaultValue)}
            title="ডিফল্ট রঙ ফেরান"
            className="text-[10px] font-semibold text-muted-foreground hover:text-primary"
          >
            রিসেট
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          disabled={disabled}
          value={pickerVal}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-8 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0 disabled:opacity-50"
        />
        <input
          type="text"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#ffffff"
          className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2 py-1 font-mono text-[11px] outline-none focus:border-primary disabled:opacity-50"
        />
      </div>
      {lowContrast && (
        <p className="flex items-center gap-1 text-[10px] font-semibold text-amber-700">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          কনট্রাস্ট কম ({ratio?.toFixed(1)}:1) — লেখা পড়তে কষ্ট হতে পারে
        </p>
      )}
    </div>
  );
}

type UploadStage = "validating" | "compressing" | "uploading" | "saving" | null;
type UploadedImageMeta = { width: number; height: number; sizeBytes: number; format: string };

const STAGE_LABEL_BN: Record<Exclude<UploadStage, null>, string> = {
  validating: "ফাইল যাচাই হচ্ছে...",
  compressing: "WebP অপ্টিমাইজ হচ্ছে...",
  uploading: "ছবি আপলোড হচ্ছে...",
  saving: "ব্যানারে যুক্ত হচ্ছে...",
};

export function HeroBannerManager() {
  const { isMainAdmin, firebaseUser } = useAuth();
  const { hasPermission } = useRolePermissions();
  const {
    banners,
    carousel,
    saveBanner,
    addBanner,
    duplicateBanner,
    deleteBanner,
    reorderBanners,
    saveCarouselSettings,
    resetHeroBannerConfig,
  } = useHeroBannerConfig();

  const canManageBanners = isMainAdmin || hasPermission("manage_hero_banners");
  const canUploadImages = isMainAdmin || hasPermission("upload_banner_images");
  const canEditColors = isMainAdmin || hasPermission("edit_banner_colors");
  const canPublish = isMainAdmin || hasPermission("publish_banners");

  const activeFirebaseEmail = (firebaseUser || auth.currentUser)?.email;
  const hasFirestoreSuperAdminSession = Boolean(
    (firebaseUser || auth.currentUser) && isSuperAdminEmail(activeFirebaseEmail)
  );

  const sortedBanners = useMemo(
    () => [...banners].sort((a, b) => a.order - b.order),
    [banners]
  );

  const [selectedId, setSelectedId] = useState<string>(
    () => sortedBanners[0]?.id || DEFAULT_HERO_BANNER_ITEM.id
  );
  const selectedSaved = useMemo(
    () => sortedBanners.find((b) => b.id === selectedId) || sortedBanners[0] || DEFAULT_HERO_BANNER_ITEM,
    [sortedBanners, selectedId]
  );

  const [draft, setDraft] = useState<HeroBannerItem>(selectedSaved);
  const [carouselDraft, setCarouselDraft] = useState<HeroCarouselSettings>(carousel);
  const [previewDevice, setPreviewDevice] = useState<HeroDeviceBreakpoint>("desktop");
  const [selectedElement, setSelectedElement] = useState<HeroEditableElementId>("heading");
  const [showGuides, setShowGuides] = useState(true);
  const [snapToCenter, setSnapToCenter] = useState(true);
  const [previewOnly, setPreviewOnly] = useState(false);
  const [snapGuideState, setSnapGuideState] = useState<{ xCenter: boolean; yCenter: boolean }>({
    xCenter: false,
    yCenter: false,
  });
  const [draggingElement, setDraggingElement] = useState<HeroEditableElementId | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingTarget, setSavingTarget] = useState<"draft" | "published" | null>(null);
  const [savingCarousel, setSavingCarousel] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmDeleteBanner, setConfirmDeleteBanner] = useState<HeroBannerItem | null>(null);
  const [confirmRestoreModal, setConfirmRestoreModal] = useState(false);

  const [uploadingDesktop, setUploadingDesktop] = useState(false);
  const [desktopProgress, setDesktopProgress] = useState(0);
  const [desktopStage, setDesktopStage] = useState<UploadStage>(null);
  const [desktopError, setDesktopError] = useState<string | null>(null);
  const [lastDesktopFile, setLastDesktopFile] = useState<File | null>(null);
  const [desktopMeta, setDesktopMeta] = useState<UploadedImageMeta | null>(null);

  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [mobileProgress, setMobileProgress] = useState(0);
  const [mobileStage, setMobileStage] = useState<UploadStage>(null);
  const [mobileError, setMobileError] = useState<string | null>(null);
  const [lastMobileFile, setLastMobileFile] = useState<File | null>(null);
  const [mobileMeta, setMobileMeta] = useState<UploadedImageMeta | null>(null);

  const desktopInputRef = useRef<HTMLInputElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);
  const previewCanvasRef = useRef<HTMLDivElement | null>(null);
  const dragSessionRef = useRef<{
    elementId: HeroEditableElementId;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    origWidth: number;
    mode: "move" | "resize";
  } | null>(null);

  useEffect(() => {
    setDraft(selectedSaved);
    setDesktopError(null);
    setMobileError(null);
    setDesktopMeta(null);
    setMobileMeta(null);
  }, [selectedSaved]);

  useEffect(() => {
    setCarouselDraft(carousel);
  }, [carousel]);

  if (!canManageBanners) {
    return (
      <div className="rounded-3xl border border-amber-500/40 bg-amber-50/70 p-6 text-center">
        <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-amber-700" />
        <h3 className="font-display text-sm font-bold text-amber-950">
          অনুমতি প্রয়োজন
        </h3>
        <p className="mt-1 text-xs text-amber-800">
          হোমপেজ ও হিরো ব্যানার পরিচালনা করার জন্য “হিরো ব্যানার ম্যানেজার” অনুমতি প্রয়োজন।
        </p>
      </div>
    );
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(selectedSaved);
  const isCarouselDirty = JSON.stringify(carouselDraft) !== JSON.stringify(carousel);

  async function handleCreateNewBanner() {
    if (saving || resetting) return;
    setSaving(true);
    try {
      const created = await addBanner({
        name: `প্রমোশনাল ব্যানার #${sortedBanners.length + 1}`,
        status: "draft",
        visible: true,
      });
      setSelectedId(created.id);
      void recordSuperAdminAudit({
        action: "create",
        module: "hero_banners",
        target_id: created.id,
        target_label: created.name,
        summary: `নতুন হিরো ব্যানার ড্রাফট তৈরি: ${created.name}`,
      });
      toast.success(`"${created.name}" ড্রাফট হিসেবে তৈরি হয়েছে — কাস্টমাইজ করে প্রকাশ করুন।`);
    } catch (err: any) {
      toast.error(err?.message || "নতুন ব্যানার তৈরি করা যায়নি");
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicate(b: HeroBannerItem) {
    if (saving || resetting) return;
    setSaving(true);
    try {
      const copyItem = await duplicateBanner(b.id);
      if (copyItem) {
        setSelectedId(copyItem.id);
        toast.success(`"${copyItem.name}" ড্রাফট হিসেবে ডুপ্লিকেট হয়েছে।`);
      }
    } catch (err: any) {
      toast.error(err?.message || "ডুপ্লিকেট ব্যর্থ");
    } finally {
      setSaving(false);
    }
  }

  async function executeDeleteBanner(b: HeroBannerItem) {
    if (saving || resetting) return;
    setSaving(true);
    try {
      await deleteBanner(b.id);
      if (b.desktopImageUrl) void deleteR2FileByUrl(b.desktopImageUrl);
      if (b.mobileImageUrl) void deleteR2FileByUrl(b.mobileImageUrl);
      setConfirmDeleteBanner(null);
      const remaining = sortedBanners.filter((x) => x.id !== b.id);
      if (remaining[0]) setSelectedId(remaining[0].id);
      void recordSuperAdminAudit({
        action: "delete",
        module: "hero_banners",
        target_id: b.id,
        target_label: b.name,
        summary: `হিরো ব্যানার মুছে ফেলা হয়েছে: ${b.name}`,
      });
      toast.success(`"${b.name}" স্থায়ীভাবে মুছে ফেলা হয়েছে।`);
    } catch (err: any) {
      toast.error(err?.message || "ব্যানার মুছে ফেলা যায়নি");
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickPublishToggle(b: HeroBannerItem) {
    if (!canPublish) {
      return toast.error("ব্যানার প্রকাশ/ড্রাফট পরিবর্তনের অনুমতি নেই");
    }
    if (saving || resetting) return;
    const nextStatus = b.status === "published" ? "draft" : "published";
    setSaving(true);
    try {
      await saveBanner({
        ...b,
        status: nextStatus,
        visible: nextStatus === "published" ? true : b.visible,
      });
      toast.success(
        nextStatus === "published" ? `"${b.name}" লাইভ প্রকাশিত হয়েছে` : `"${b.name}" ড্রাফট করা হয়েছে`
      );
    } catch (err: any) {
      toast.error(err?.message || "স্ট্যাটাস পরিবর্তন ব্যর্থ");
    } finally {
      setSaving(false);
    }
  }

  async function processBannerImageUpload(file: File, target: "desktop" | "mobile") {
    const setBusy = target === "desktop" ? setUploadingDesktop : setUploadingMobile;
    const setProgress = target === "desktop" ? setDesktopProgress : setMobileProgress;
    const setStage = target === "desktop" ? setDesktopStage : setMobileStage;
    const setError = target === "desktop" ? setDesktopError : setMobileError;
    const setLastFile = target === "desktop" ? setLastDesktopFile : setLastMobileFile;
    const setMeta = target === "desktop" ? setDesktopMeta : setMobileMeta;

    setLastFile(file);
    setError(null);

    const validation = validateImageFile(file);
    if (!validation.ok) {
      const msg = validation.error || "অবৈধ ইমেজ ফাইল";
      setError(msg);
      toast.error(msg);
      return;
    }

    setBusy(true);
    setStage("validating");
    setProgress(5);
    try {
      const result = await uploadImageToR2(file, {
        category: "banner",
        entityId: draft.id || "hero_banner",
        onStageChange: (stage) => setStage(stage),
        onProgress: (p) => setProgress(p),
      });

      try {
        URL.revokeObjectURL(result.processed.previewUrl);
      } catch {
        // ignore
      }

      setDraft((prev) => ({
        ...prev,
        backgroundMode: "image",
        ...(target === "desktop"
          ? { desktopImageUrl: result.downloadUrl }
          : { mobileImageUrl: result.downloadUrl }),
      }));
      setMeta({
        width: result.processed.width,
        height: result.processed.height,
        sizeBytes: result.processed.compressedSizeBytes,
        format: result.processed.format,
      });
      setLastFile(null);

      toast.success(
        target === "desktop"
          ? `ডেস্কটপ ছবি অপ্টিমাইজ ও আপলোড হয়েছে (${formatFileSizeBn(result.processed.compressedSizeBytes)})! স্থায়ী করতে সেভ বাটন চাপুন।`
          : `মোবাইল ছবি অপ্টিমাইজ ও আপলোড হয়েছে (${formatFileSizeBn(result.processed.compressedSizeBytes)})! স্থায়ী করতে সেভ বাটন চাপুন।`
      );
    } catch (err: any) {
      const msg = err?.message || "হিরো ব্যানার ছবি আপলোড ব্যর্থ হয়েছে";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      setStage(null);
      setTimeout(() => setProgress(0), 500);
    }
  }

  async function handleImageUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    target: "desktop" | "mobile"
  ) {
    if (!canUploadImages) {
      toast.error("ব্যানার ছবি আপলোড করার অনুমতি নেই");
      return;
    }
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await processBannerImageUpload(file, target);
  }

  async function handleRemoveImage(target: "desktop" | "mobile") {
    const targetUrl =
      target === "desktop" ? draft.desktopImageUrl : draft.mobileImageUrl;
    if (
      targetUrl &&
      targetUrl !== (target === "desktop" ? selectedSaved.desktopImageUrl : selectedSaved.mobileImageUrl)
    ) {
      void deleteR2FileByUrl(targetUrl);
    }
    if (target === "desktop") {
      setDesktopError(null);
      setLastDesktopFile(null);
      setDesktopMeta(null);
    } else {
      setMobileError(null);
      setLastMobileFile(null);
      setMobileMeta(null);
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
    toast.info("ছবিটি ড্রাফট থেকে সরানো হয়েছে — স্থায়ী করতে সেভ বাটনে ক্লিক করুন।");
  }

  async function handleSave(targetStatus?: "draft" | "published") {
    if (saving || resetting) return;
    if (uploadingDesktop || uploadingMobile) {
      toast.error("ছবি আপলোড সম্পন্ন হওয়া পর্যন্ত অনুগ্রহ করে অপেক্ষা করুন।");
      return;
    }
    if (!draft.headingLine1.trim() && !draft.headingLine2.trim()) {
      toast.error("হিরো ব্যানারের শিরোনাম সম্পূর্ণ ফাঁকা রাখা যাবে না।");
      return;
    }

    const nextStatus = targetStatus ?? draft.status;
    if (nextStatus === "published" && !canPublish) {
      toast.error("ব্যানার প্রকাশ করার অনুমতি নেই।");
      return;
    }

    const bgHex =
      draft.backgroundMode === "solid"
        ? draft.solidColor
        : draft.backgroundMode === "image"
        ? draft.overlayColor
        : draft.gradientFrom;
    const contrastChecks: Array<{ label: string; ratio: number | null }> = [
      { label: "শিরোনাম ও ব্যাকগ্রাউন্ড", ratio: getContrastRatio(draft.headingColor || draft.textColor, bgHex) },
      { label: "প্রাইমারি বাটন", ratio: getContrastRatio(draft.primaryButtonColor, draft.primaryButtonBgColor) },
      { label: "সেকেন্ডারি বাটন", ratio: getContrastRatio(draft.secondaryButtonColor, draft.secondaryButtonBgColor) },
    ];
    const blockingContrast = contrastChecks.find((c) => c.ratio !== null && c.ratio < 2.2);
    if (blockingContrast) {
      toast.error(
        `"${blockingContrast.label}" এর লেখা ও ব্যাকগ্রাউন্ডের রঙ প্রায় এক হওয়ায় পড়া যাচ্ছে না (${blockingContrast.ratio?.toFixed(1)}:1)। অনুগ্রহ করে ভিন্ন রঙ বেছে নিন।`
      );
      return;
    }

    setSaving(true);
    setSavingTarget(nextStatus);
    try {
      const nextToSave: HeroBannerItem = {
        ...draft,
        status: nextStatus,
        visible: targetStatus === "published" ? true : draft.visible,
        textColor: draft.headingColor || draft.textColor,
        subtextColor: draft.descriptionColor || draft.subtextColor,
      };

      // Confirm Firestore save BEFORE deleting previously replaced image assets
      await saveBanner(nextToSave);

      if (selectedSaved.desktopImageUrl && selectedSaved.desktopImageUrl !== draft.desktopImageUrl) {
        void deleteR2FileByUrl(selectedSaved.desktopImageUrl);
        if (!draft.desktopImageUrl || !draft.desktopImageUrl.startsWith("data:")) {
          void deleteHeroImageAsset(draft.id, "desktop");
        }
      }
      if (selectedSaved.mobileImageUrl && selectedSaved.mobileImageUrl !== draft.mobileImageUrl) {
        void deleteR2FileByUrl(selectedSaved.mobileImageUrl);
        if (!draft.mobileImageUrl || !draft.mobileImageUrl.startsWith("data:")) {
          void deleteHeroImageAsset(draft.id, "mobile");
        }
      }

      void recordSuperAdminAudit({
        action: "update",
        module: "hero_banners",
        target_id: draft.id,
        target_label: draft.name,
        summary: `হিরো ব্যানার ${nextStatus === "published" ? "প্রকাশ ও সেভ" : "ড্রাফট সেভ"}: ${draft.name}`,
      });

      toast.success(
        nextStatus === "published"
          ? `"${draft.name}" সফলভাবে সেভ ও লাইভ প্রকাশিত হয়েছে!`
          : `"${draft.name}" ড্রাফট হিসেবে সফলভাবে সংরক্ষিত হয়েছে!`
      );
    } catch (err: any) {
      toast.error(err?.message || "হিরো ব্যানার সংরক্ষণ করা যায়নি।");
    } finally {
      setSaving(false);
      setSavingTarget(null);
    }
  }

  async function handleSaveCarousel() {
    if (savingCarousel || saving) return;
    setSavingCarousel(true);
    try {
      await saveCarouselSettings(carouselDraft);
      toast.success("হিরো ক্যারোসেল স্লাইডার সেটিংস সেভ হয়েছে!");
    } catch (err: any) {
      toast.error(err?.message || "ক্যারোসেল সেটিংস সেভ ব্যর্থ");
    } finally {
      setSavingCarousel(false);
    }
  }

  async function executeRestoreDefaults() {
    if (resetting || saving) return;
    setConfirmRestoreModal(false);
    setResetting(true);
    try {
      const resetPayload = await resetHeroBannerConfig();
      const first = resetPayload.banners[0] || DEFAULT_HERO_BANNER_ITEM;
      setSelectedId(first.id);
      setDraft(first);
      toast.success("হিরো ব্যানার ডিফল্ট স্মার্ট নোয়াখালী ডিজাইনে ফিরিয়ে আনা হয়েছে!");
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
      : previewDevice === "tablet"
        ? draft.imagePositionTablet || draft.imagePositionDesktop
        : draft.imagePositionDesktop;
  const hasPreviewImage = draft.backgroundMode === "image" && Boolean(activePreviewImg);

  const previewBgForContrast =
    draft.backgroundMode === "solid" ? draft.solidColor : draft.gradientFrom;

  const livePublishedCount = sortedBanners.filter((b) => isBannerWithinSchedule(b)).length;

  const activeDeviceLayout = resolveBreakpointLayout(
    draft.responsiveLayouts,
    previewDevice,
    draft.textAlign
  );
  const selectedElPos = activeDeviceLayout.elements[selectedElement];
  const isCustomPositionMode = activeDeviceLayout.mode === "custom";

  function updateDeviceLayout(
    device: HeroDeviceBreakpoint,
    updater: (current: HeroBreakpointLayout) => HeroBreakpointLayout
  ) {
    setDraft((prev) => {
      const current = resolveBreakpointLayout(prev.responsiveLayouts, device, prev.textAlign);
      const updated = updater(current);
      return {
        ...prev,
        responsiveLayouts: {
          ...(prev.responsiveLayouts || {}),
          [device]: updated,
        },
      };
    });
  }

  function updateElementPosition(
    elementId: HeroEditableElementId,
    patch: Partial<HeroElementPosition>,
    autoEnableCustom = true
  ) {
    updateDeviceLayout(previewDevice, (current) => {
      const prevEl = current.elements[elementId];
      const nextEl = clampElementPosition({ ...prevEl, ...patch }, prevEl);
      return {
        ...current,
        mode: autoEnableCustom ? "custom" : current.mode,
        elements: {
          ...current.elements,
          [elementId]: nextEl,
        },
      };
    });
  }

  function handleResetDevicePosition(scope: "current" | "all") {
    if (scope === "all") {
      setDraft((prev) => ({
        ...prev,
        responsiveLayouts: {
          desktop: createDefaultBreakpointLayout("desktop", prev.textAlign),
          tablet: createDefaultBreakpointLayout("tablet", prev.textAlign),
          mobile: createDefaultBreakpointLayout("mobile", prev.textAlign),
        },
      }));
      toast.info("সকল ডিভাইসের (Desktop, Tablet, Mobile) অবস্থান রিসেট করা হয়েছে।");
    } else {
      updateDeviceLayout(previewDevice, () =>
        createDefaultBreakpointLayout(previewDevice, draft.textAlign)
      );
      toast.info(`${previewDevice.toUpperCase()} ডিভাইসের অবস্থান ডিফল্টে রিসেট হয়েছে।`);
    }
  }

  function startElementDrag(
    e: React.PointerEvent<HTMLElement>,
    elementId: HeroEditableElementId,
    mode: "move" | "resize" = "move"
  ) {
    if (previewOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedElement(elementId);
    setDraggingElement(elementId);
    const pos = activeDeviceLayout.elements[elementId];
    dragSessionRef.current = {
      elementId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: pos.xPercent,
      origY: pos.yPercent,
      origWidth: pos.widthPercent,
      mode,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore if unsupported
    }
  }

  function handleElementPointerMove(e: React.PointerEvent<HTMLElement>) {
    const session = dragSessionRef.current;
    const canvas = previewCanvasRef.current;
    if (!session || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dxPct = ((e.clientX - session.startClientX) / rect.width) * 100;
    const dyPct = ((e.clientY - session.startClientY) / rect.height) * 100;

    if (session.mode === "resize") {
      const nextW = roundStep(clampNumber(session.origWidth + dxPct, 16, 96), 1);
      updateElementPosition(session.elementId, { widthPercent: nextW }, true);
      return;
    }

    let nextX = roundStep(session.origX + dxPct, 1);
    let nextY = roundStep(session.origY + dyPct, 1);
    const boxCenterX = nextX + session.origWidth / 2;

    let snappedXCenter = false;
    let snappedYCenter = false;
    if (snapToCenter) {
      if (Math.abs(boxCenterX - 50) <= 2.2) {
        nextX = roundStep(50 - session.origWidth / 2, 1);
        snappedXCenter = true;
      }
      if (Math.abs(nextY - 50) <= 2.2) {
        nextY = 50;
        snappedYCenter = true;
      }
    }
    setSnapGuideState({ xCenter: snappedXCenter, yCenter: snappedYCenter });
    updateElementPosition(session.elementId, { xPercent: nextX, yPercent: nextY }, true);
  }

  function endElementDrag(e: React.PointerEvent<HTMLElement>) {
    if (!dragSessionRef.current) return;
    dragSessionRef.current = null;
    setDraggingElement(null);
    setSnapGuideState({ xCenter: false, yCenter: false });
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-5">
      {/* Header & Multi-Banner Overview */}
      <div className="rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-emerald-500/5 p-5 shadow-card space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-sm">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-base font-extrabold text-primary-deep">
                অ্যাডভান্সড হিরো ব্যানার ও ক্যারোসেল ম্যানেজার
              </h2>
              <p className="text-xs text-muted-foreground">
                ১০+ ব্যানার তৈরি, শিডিউল, কাস্টম কালার, বাটন ও ক্যারোসেল স্লাইডার পরিচালনা করুন ({sortedBanners.length} টি ব্যানার • {livePublishedCount} টি লাইভ)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving || resetting}
              onClick={() => void handleCreateNewBanner()}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-hero px-4 py-2 text-xs font-bold text-primary-foreground shadow-card transition hover:brightness-105 active:scale-95 disabled:opacity-60"
            >
              {saving && !savingTarget ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>নতুন ব্যানার যোগ করুন</span>
            </button>
          </div>
        </div>

        {!hasFirestoreSuperAdminSession && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1 leading-relaxed">
              <p className="font-bold">ডাটাবেজ সংযোগ সতর্কতা (Super Admin Firebase Auth প্রয়োজন)</p>
              <p className="mt-0.5 text-[11px] text-amber-900">
                Firestore নিরাপত্তা নীতিমালা অনুযায়ী হিরো ব্যানার তৈরি, সেভ ও প্রকাশ করতে মূল সুপার অ্যাডমিন অ্যাকাউন্টে (Firebase Auth) সক্রিয় লগইন থাকা প্রয়োজন।
              </p>
            </div>
          </div>
        )}

        {/* Carousel Global Controls */}
        <div className="rounded-2xl border border-border/80 bg-card/90 p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-primary-deep">
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary" /> ক্যারোসেল স্লাইডার সেটিংস (মাল্টি-ব্যানার)
            </span>
            {isCarouselDirty && (
              <button
                type="button"
                disabled={savingCarousel}
                onClick={() => void handleSaveCarousel()}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground shadow-xs"
              >
                <Save className="h-3 w-3" /> {savingCarousel ? "সেভ হচ্ছে..." : "স্লাইডার সেটিংস সেভ করুন"}
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="inline-flex cursor-pointer items-center gap-1.5 font-semibold">
              <input
                type="checkbox"
                checked={carouselDraft.autoRotate}
                onChange={(e) => setCarouselDraft({ ...carouselDraft, autoRotate: e.target.checked })}
                className="accent-emerald-700"
              />
              অটো-রোটেট সক্রিয়
            </label>
            <label className="inline-flex items-center gap-1.5 font-semibold">
              সময় (সেকেন্ড):
              <input
                type="number"
                min={2}
                max={20}
                value={carouselDraft.intervalSeconds}
                onChange={(e) =>
                  setCarouselDraft({
                    ...carouselDraft,
                    intervalSeconds: Math.min(20, Math.max(2, Number(e.target.value) || 5)),
                  })
                }
                className="w-14 rounded-lg border border-border bg-background px-2 py-0.5 text-center font-mono text-xs"
              />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 font-semibold">
              <input
                type="checkbox"
                checked={carouselDraft.showArrows}
                onChange={(e) => setCarouselDraft({ ...carouselDraft, showArrows: e.target.checked })}
                className="accent-emerald-700"
              />
              তীর (Arrows)
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 font-semibold">
              <input
                type="checkbox"
                checked={carouselDraft.showDots}
                onChange={(e) => setCarouselDraft({ ...carouselDraft, showDots: e.target.checked })}
                className="accent-emerald-700"
              />
              ডটস (Indicators)
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 font-semibold">
              <input
                type="checkbox"
                checked={carouselDraft.pauseOnHover}
                onChange={(e) => setCarouselDraft({ ...carouselDraft, pauseOnHover: e.target.checked })}
                className="accent-emerald-700"
              />
              হোভারে থামবে
            </label>
            <label className="inline-flex items-center gap-1.5 font-semibold">
              ট্রানজিশন:
              <select
                value={carouselDraft.transitionStyle || "slide"}
                onChange={(e) =>
                  setCarouselDraft({
                    ...carouselDraft,
                    transitionStyle: e.target.value as HeroTransitionStyle,
                  })
                }
                className="rounded-lg border border-border bg-background px-2 py-0.5 text-xs font-semibold"
              >
                <option value="slide">স্লাইড (Slide)</option>
                <option value="fade">ফেড (Crossfade)</option>
                <option value="none">তাৎক্ষণিক (Instant)</option>
              </select>
            </label>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-3 border-t border-border/60 pt-2.5 text-xs">
            <label className="inline-flex cursor-pointer items-center gap-1.5 font-bold text-primary-deep">
              <input
                type="checkbox"
                checked={carouselDraft.lockUniformDimensions !== false}
                onChange={(e) =>
                  setCarouselDraft({
                    ...carouselDraft,
                    lockUniformDimensions: e.target.checked,
                  })
                }
                className="accent-emerald-700"
              />
              সব ব্যানারের উচ্চতা অভিন্ন রাখুন (Uniform Height Lock)
            </label>
            {carouselDraft.lockUniformDimensions !== false && (
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <label className="inline-flex items-center gap-1 font-semibold">
                  ডেস্কটপ (px):
                  <input
                    type="number"
                    min={240}
                    max={560}
                    step={4}
                    value={carouselDraft.uniformDesktopHeightPx ?? 336}
                    onChange={(e) =>
                      setCarouselDraft({
                        ...carouselDraft,
                        uniformDesktopHeightPx: Math.min(560, Math.max(240, Number(e.target.value) || 336)),
                      })
                    }
                    className="w-16 rounded-lg border border-border bg-background px-2 py-0.5 text-center font-mono text-xs"
                  />
                </label>
                <label className="inline-flex items-center gap-1 font-semibold">
                  ট্যাবলেট (px):
                  <input
                    type="number"
                    min={240}
                    max={520}
                    step={4}
                    value={carouselDraft.uniformTabletHeightPx ?? 324}
                    onChange={(e) =>
                      setCarouselDraft({
                        ...carouselDraft,
                        uniformTabletHeightPx: Math.min(520, Math.max(240, Number(e.target.value) || 324)),
                      })
                    }
                    className="w-16 rounded-lg border border-border bg-background px-2 py-0.5 text-center font-mono text-xs"
                  />
                </label>
                <label className="inline-flex items-center gap-1 font-semibold">
                  মোবাইল (px):
                  <input
                    type="number"
                    min={240}
                    max={480}
                    step={4}
                    value={carouselDraft.uniformMobileHeightPx ?? 308}
                    onChange={(e) =>
                      setCarouselDraft({
                        ...carouselDraft,
                        uniformMobileHeightPx: Math.min(480, Math.max(240, Number(e.target.value) || 308)),
                      })
                    }
                    className="w-16 rounded-lg border border-border bg-background px-2 py-0.5 text-center font-mono text-xs"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Multi-Banner Selector List */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-muted-foreground">
            সকল ব্যানার তালিকা ({sortedBanners.length} টি — যেকোনো একটি নির্বাচন করে এডিট করুন):
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {sortedBanners.map((b, idx) => {
              const activeCard = b.id === draft.id;
              const liveNow = isBannerWithinSchedule(b);
              return (
                <div
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-2xl border p-3 transition ${
                    activeCard
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20 shadow-sm"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                        #{idx + 1}
                      </span>
                      <p className="truncate font-display text-xs font-bold text-foreground">
                        {b.name || b.headingLine1}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9.5px] font-extrabold ${
                          liveNow
                            ? "bg-emerald-500/15 text-emerald-700"
                            : b.status === "draft"
                              ? "bg-amber-500/15 text-amber-800"
                              : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {liveNow ? "লাইভ" : b.status === "draft" ? "ড্রাফট" : "নিষ্ক্রিয়/সময়সীমা"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
                      {b.headingLine1} {b.headingLine2}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => void reorderBanners(b.id, "up")}
                      title="উপরে তুলুন"
                      className="rounded-lg p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === sortedBanners.length - 1}
                      onClick={() => void reorderBanners(b.id, "down")}
                      title="নিচে নামান"
                      className="rounded-lg p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    {canPublish && (
                      <button
                        type="button"
                        onClick={() => void handleQuickPublishToggle(b)}
                        title={b.status === "published" ? "ড্রাফটে নিন" : "প্রকাশ করুন"}
                        className="rounded-lg p-1 text-primary hover:bg-primary/10"
                      >
                        {b.status === "published" ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDuplicate(b)}
                      title="ডুপ্লিকেট করুন"
                      className="rounded-lg p-1 text-blue-600 hover:bg-blue-500/10"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    {sortedBanners.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteBanner(b)}
                        title="মুছে ফেলুন"
                        className="rounded-lg p-1 text-rose-600 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Banner Identity, Scheduling & Visibility Strip */}
      <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-bold text-foreground">
              ব্যানারের নাম, প্রকাশ অবস্থা ও সময়সূচি ({draft.name})
            </h3>
          </div>
          {isDirty && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-800">
              অসংরক্ষিত পরিবর্তন রয়েছে
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">ব্যানারের অভ্যন্তরীণ নাম</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">স্ট্যাটাস (Status)</label>
            <select
              disabled={!canPublish}
              value={draft.status}
              onChange={(e) =>
                setDraft({ ...draft, status: e.target.value as "published" | "draft" })
              }
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold disabled:opacity-60"
            >
              <option value="published">প্রকাশিত (Published)</option>
              <option value="draft">ড্রাফট (Draft)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">শুরু সময় (ঐচ্ছিক)</label>
            <input
              disabled={!canPublish}
              type="datetime-local"
              value={draft.startDate || ""}
              onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs disabled:opacity-60"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">শেষ সময় (ঐচ্ছিক)</label>
            <input
              disabled={!canPublish}
              type="datetime-local"
              value={draft.endDate || ""}
              onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs disabled:opacity-60"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-bold">
            <input
              type="checkbox"
              disabled={!canPublish}
              checked={draft.visible}
              onChange={(e) => setDraft({ ...draft, visible: e.target.checked })}
              className="accent-emerald-700"
            />
            <span>হোমপেজে দৃশ্যমান (Visible)</span>
          </label>

          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 p-0.5">
            {(
              [
                { id: "left", icon: AlignLeft, label: "বাম" },
                { id: "center", icon: AlignCenter, label: "মাঝ" },
                { id: "right", icon: AlignRight, label: "ডান" },
              ] as const
            ).map((al) => {
              const Icon = al.icon;
              return (
                <button
                  key={al.id}
                  type="button"
                  onClick={() => setDraft({ ...draft, textAlign: al.id })}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                    draft.textAlign === al.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3 w-3" /> {al.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Layout Mode, Image Fit & Height Controls */}
        <div className="grid grid-cols-1 gap-3 border-t border-border/60 pt-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
              <LayoutTemplate className="h-3.5 w-3.5 text-primary" /> লেআউট মোড (Layout)
            </label>
            <select
              value={draft.layoutMode || "centered"}
              onChange={(e) =>
                setDraft({ ...draft, layoutMode: e.target.value as HeroLayoutMode })
              }
              className="mt-1 w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-semibold"
            >
              <option value="centered">ক্লাসিক সেন্টার্ড / ব্যাকগ্রাউন্ড</option>
              <option value="full_width">ফুল-উইডথ ব্যানার</option>
              <option value="split_left">স্প্লিট: বামে লেখা + ডানে ছবি</option>
              <option value="split_right">স্প্লিট: বামে ছবি + ডানে লেখা</option>
            </select>
          </div>

          <div>
            <label className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
              <Maximize2 className="h-3.5 w-3.5 text-primary" /> ছবির ফিট (Object Fit)
            </label>
            <select
              value={draft.imageFit || "cover"}
              onChange={(e) =>
                setDraft({ ...draft, imageFit: e.target.value as HeroImageFit })
              }
              className="mt-1 w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-semibold"
            >
              <option value="cover">কভার (ফ্রেম জুড়ে পূর্ণ)</option>
              <option value="contain">কনটেইন (সম্পূর্ণ ছবি প্রদর্শন)</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>ডেস্কটপ উচ্চতা</span>
              <span className="font-mono font-bold text-primary tabular-nums">
                {draft.desktopHeightPx ?? 336}px
              </span>
            </div>
            <input
              type="range"
              min={240}
              max={540}
              step={8}
              value={draft.desktopHeightPx ?? 336}
              onChange={(e) =>
                setDraft({ ...draft, desktopHeightPx: Number(e.target.value) })
              }
              className="mt-2.5 w-full accent-emerald-700"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>ট্যাবলেট উচ্চতা</span>
              <span className="font-mono font-bold text-primary tabular-nums">
                {draft.tabletHeightPx ?? 324}px
              </span>
            </div>
            <input
              type="range"
              min={240}
              max={500}
              step={8}
              value={draft.tabletHeightPx ?? 324}
              onChange={(e) =>
                setDraft({ ...draft, tabletHeightPx: Number(e.target.value) })
              }
              className="mt-2.5 w-full accent-emerald-700"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>মোবাইল উচ্চতা</span>
              <span className="font-mono font-bold text-primary tabular-nums">
                {draft.mobileHeightPx ?? 308}px
              </span>
            </div>
            <input
              type="range"
              min={240}
              max={460}
              step={8}
              value={draft.mobileHeightPx ?? 308}
              onChange={(e) =>
                setDraft({ ...draft, mobileHeightPx: Number(e.target.value) })
              }
              className="mt-2.5 w-full accent-emerald-700"
            />
          </div>
        </div>
      </div>

      {/* 1. Interactive Visual Hero Position Editor & Live Preview */}
      <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-5 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Move className="h-4 w-4 text-primary" />
            <div>
              <h3 className="font-display text-sm font-bold text-foreground">
                ভিজ্যুয়াল হিরো পজিশন এডিটর ও লাইভ প্রিভিউ
              </h3>
              <p className="text-[11px] text-muted-foreground">
                যেকোনো লেখা বা বাটন সরাসরি টেনে (Drag &amp; Drop) অথবা নিচের সংখ্যাসূচক প্যানেল থেকে পজিশন ঠিক করুন।
              </p>
            </div>
          </div>

          {/* Breakpoint Switcher: Desktop / Tablet / Mobile */}
          <div className="inline-flex rounded-xl border border-border bg-muted/60 p-0.5">
            {(
              [
                { id: "desktop", label: "ডেস্কটপ", icon: Monitor },
                { id: "tablet", label: "ট্যাবলেট", icon: Tablet },
                { id: "mobile", label: "মোবাইল", icon: Smartphone },
              ] as const
            ).map((dev) => {
              const Icon = dev.icon;
              const devMode = resolveBreakpointLayout(
                draft.responsiveLayouts,
                dev.id,
                draft.textAlign
              ).mode;
              return (
                <button
                  key={dev.id}
                  type="button"
                  onClick={() => setPreviewDevice(dev.id)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                    previewDevice === dev.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{dev.label}</span>
                  {devMode === "custom" && (
                    <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-amber-300" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Editor Toolbar: Custom Layout Mode, Guides, Snap, Preview Before Publish, Reset Position */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-muted/35 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                updateDeviceLayout(previewDevice, (cur) => ({
                  ...cur,
                  mode: cur.mode === "custom" ? "flow" : "custom",
                }))
              }
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                isCustomPositionMode
                  ? "border-emerald-600 bg-emerald-700 text-white shadow-xs"
                  : "border-border bg-background text-foreground hover:border-primary/50"
              }`}
            >
              <Move className="h-3 w-3" />
              <span>
                {isCustomPositionMode
                  ? `${previewDevice === "desktop" ? "ডেস্কটপ" : previewDevice === "tablet" ? "ট্যাবলেট" : "মোবাইল"}: কাস্টম পজিশন চালু`
                  : "ফ্রি-ড্র্যাগ পজিশন চালু করুন"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowGuides((v) => !v)}
              disabled={previewOnly}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-40 ${
                showGuides && !previewOnly
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              <Crosshair className="h-3 w-3" /> গাইড লাইন
            </button>

            <button
              type="button"
              onClick={() => setSnapToCenter((v) => !v)}
              disabled={previewOnly}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-40 ${
                snapToCenter && !previewOnly
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              <Magnet className="h-3 w-3" /> সেন্টার স্ন্যাপ
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPreviewOnly((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                previewOnly
                  ? "border-amber-500 bg-amber-500 text-white shadow-xs"
                  : "border-border bg-background text-foreground hover:bg-muted"
              }`}
            >
              {previewOnly ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              <span>{previewOnly ? "এডিটরে ফিরুন" : "চূড়ান্ত প্রিভিউ (গাইড লুকান)"}</span>
            </button>

            <button
              type="button"
              onClick={() => handleResetDevicePosition("current")}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-500/15"
              title="শুধু এই ডিভাইসের অবস্থান রিসেট করুন"
            >
              <RotateCcw className="h-3 w-3" /> অবস্থান রিসেট
            </button>

            <button
              type="button"
              onClick={() => handleResetDevicePosition("all")}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[10.5px] font-semibold text-muted-foreground hover:text-foreground"
              title="সব ডিভাইসের (Desktop/Tablet/Mobile) অবস্থান ডিফল্টে নিন"
            >
              সব ডিভাইস রিসেট
            </button>
          </div>
        </div>

        {(!draft.visible || draft.status === "draft") && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-amber-500/35 bg-amber-50/90 px-3.5 py-2 text-[11.5px] text-amber-900">
            <span>
              এই ব্যানারটি বর্তমানে <strong>{draft.status === "draft" ? "ড্রাফট" : "লুকানো"}</strong> অবস্থায় আছে — নিচে লাইভ প্রিভিউ দেখা যাচ্ছে, প্রকাশ করতে “সেভ ও প্রকাশ করুন” চাপুন।
            </span>
          </div>
        )}

        {/* Interactive Stage Canvas */}
        <div className="flex justify-center overflow-x-auto rounded-2xl bg-muted/45 p-3 sm:p-4">
          <div
            className={`w-full transition-all duration-300 ${
              previewDevice === "mobile"
                ? "max-w-[380px]"
                : previewDevice === "tablet"
                  ? "max-w-[768px]"
                  : "max-w-full"
            }`}
          >
            <section
              ref={previewCanvasRef}
              className={`relative flex flex-col justify-center overflow-hidden border border-emerald-300/20 shadow-[0_18px_40px_-14px_rgba(7,54,34,0.45)] ${
                isCustomPositionMode ? "p-0" : "p-5 sm:p-7"
              } ${draft.borderRadius} ${
                draft.textAlign === "left"
                  ? "text-left"
                  : draft.textAlign === "right"
                    ? "text-right"
                    : "text-center"
              }`}
              style={{
                height: `${
                  previewDevice === "mobile"
                    ? carouselDraft.lockUniformDimensions !== false
                      ? carouselDraft.uniformMobileHeightPx ?? 308
                      : draft.mobileHeightPx ?? 308
                    : previewDevice === "tablet"
                      ? carouselDraft.lockUniformDimensions !== false
                        ? carouselDraft.uniformTabletHeightPx ?? 324
                        : draft.tabletHeightPx ?? 324
                      : carouselDraft.lockUniformDimensions !== false
                        ? carouselDraft.uniformDesktopHeightPx ?? 336
                        : draft.desktopHeightPx ?? 336
                }px`,
                background:
                  draft.backgroundMode === "solid"
                    ? draft.solidColor
                    : `linear-gradient(135deg, ${draft.gradientFrom} 0%, ${draft.gradientVia} 50%, ${draft.gradientTo} 100%)`,
                color: draft.headingColor,
              }}
            >
              {hasPreviewImage &&
                !(
                  !isCustomPositionMode &&
                  previewDevice !== "mobile" &&
                  (draft.layoutMode === "split_left" || draft.layoutMode === "split_right")
                ) && (
                  <>
                    <img
                      src={activePreviewImg}
                      alt="Hero Banner Preview"
                      className={`pointer-events-none absolute inset-0 h-full w-full ${
                        draft.imageFit === "contain" ? "object-contain" : "object-cover"
                      }`}
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

              {/* Editor-only visual guides (NEVER rendered in previewOnly or public site) */}
              {!previewOnly && showGuides && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-15">
                  {/* Safe content area inset (4%) */}
                  <div className="absolute inset-[4%] rounded-xl border border-dashed border-white/25" />
                  {/* Vertical & horizontal center lines */}
                  <div
                    className={`absolute inset-y-0 left-1/2 -translate-x-1/2 border-l border-dashed transition-colors ${
                      snapGuideState.xCenter ? "border-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]" : "border-cyan-200/35"
                    }`}
                  />
                  <div
                    className={`absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed transition-colors ${
                      snapGuideState.yCenter ? "border-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]" : "border-cyan-200/35"
                    }`}
                  />
                  {/* Subtle rule-of-thirds guides */}
                  <div className="absolute inset-y-0 left-[25%] border-l border-dotted border-white/15" />
                  <div className="absolute inset-y-0 left-[75%] border-l border-dotted border-white/15" />
                </div>
              )}

              {/* Elements Render Layer */}
              {isCustomPositionMode ? (
                <div className="relative z-20 h-full w-full select-none">
                  {HERO_ELEMENT_IDS.map((elId) => {
                    const pos = activeDeviceLayout.elements[elId];
                    const isSelected = !previewOnly && selectedElement === elId;
                    const isDragging = draggingElement === elId;

                    const hasContent =
                      elId === "badge"
                        ? Boolean(draft.badgeText.trim())
                        : elId === "heading"
                          ? Boolean(draft.headingLine1.trim() || draft.headingLine2.trim())
                          : elId === "description"
                            ? Boolean(draft.description.trim())
                            : elId === "primaryButton"
                              ? Boolean(draft.primaryButtonText.trim())
                              : elId === "secondaryButton"
                                ? Boolean(draft.secondaryButtonText.trim())
                                : elId === "optionalButton"
                                  ? Boolean(draft.optionalButtonText?.trim())
                                  : Boolean(draft.optionalText?.trim());

                    if (!hasContent) return null;

                    const alignFlex =
                      pos.textAlign === "center"
                        ? "justify-center"
                        : pos.textAlign === "right"
                          ? "justify-end"
                          : "justify-start";

                    const baseHeadingPx =
                      previewDevice === "mobile" ? 23 : previewDevice === "tablet" ? 31 : 36;
                    const baseDescPx = previewDevice === "mobile" ? 12.5 : 14.5;
                    const baseBtnPx = previewDevice === "mobile" ? 12 : 13;

                    return (
                      <div
                        key={elId}
                        onPointerDown={(e) => startElementDrag(e, elId, "move")}
                        onPointerMove={handleElementPointerMove}
                        onPointerUp={endElementDrag}
                        onPointerCancel={endElementDrag}
                        style={getElementCanvasStyle(pos, isSelected ? 35 : 22)}
                        className={`group touch-none rounded-lg transition-shadow ${
                          previewOnly
                            ? ""
                            : isSelected
                              ? "cursor-grab active:cursor-grabbing ring-2 ring-amber-300 bg-black/15"
                              : "cursor-grab hover:ring-1 hover:ring-white/55"
                        } ${isDragging ? "ring-amber-400 shadow-lg" : ""}`}
                      >
                        {!previewOnly && isSelected && (
                          <div className="pointer-events-none -top-5 left-0 absolute z-40 inline-flex items-center gap-1 rounded bg-amber-400 px-1.5 py-0.5 text-[9.5px] font-extrabold text-emerald-950 shadow">
                            <GripVertical className="h-2.5 w-2.5" />
                            <span>{HERO_ELEMENT_LABELS_BN[elId]}</span>
                            <span className="font-mono opacity-80">
                              ({pos.xPercent}%, {pos.yPercent}%)
                            </span>
                          </div>
                        )}

                        {elId === "badge" && (
                          <span
                            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 font-semibold tracking-wide backdrop-blur-sm"
                            style={{
                              color: draft.badgeColor,
                              backgroundColor: draft.badgeBgColor,
                              fontSize: `${Math.round(11 * pos.fontScale * 10) / 10}px`,
                            }}
                          >
                            <Droplet className="h-3 w-3 shrink-0" />
                            <span className="truncate">{draft.badgeText}</span>
                          </span>
                        )}

                        {elId === "heading" && (
                          <h1
                            className="font-bangla font-extrabold leading-[1.2] tracking-tight drop-shadow-xs"
                            style={{
                              color: draft.headingColor,
                              fontSize: `${Math.round(baseHeadingPx * pos.fontScale)}px`,
                            }}
                          >
                            {draft.headingLine1}
                            {draft.headingLine2 && (
                              <>
                                <br />
                                {draft.headingLine2}
                              </>
                            )}
                          </h1>
                        )}

                        {elId === "description" && (
                          <p
                            className="leading-relaxed"
                            style={{
                              color: draft.descriptionColor,
                              opacity: 0.94,
                              fontSize: `${Math.round(baseDescPx * pos.fontScale * 10) / 10}px`,
                            }}
                          >
                            {draft.description}
                          </p>
                        )}

                        {elId === "primaryButton" && (
                          <div className={`flex ${alignFlex}`}>
                            <span
                              className="inline-flex min-h-[38px] items-center gap-2 rounded-full px-4 py-2 font-extrabold shadow-sm"
                              style={{
                                color: draft.primaryButtonColor,
                                backgroundColor: draft.primaryButtonBgColor,
                                fontSize: `${Math.round(baseBtnPx * pos.fontScale * 10) / 10}px`,
                              }}
                            >
                              <Phone className="h-3.5 w-3.5 shrink-0" /> {draft.primaryButtonText}
                            </span>
                          </div>
                        )}

                        {elId === "secondaryButton" && (
                          <div className={`flex ${alignFlex}`}>
                            <span
                              className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-white/30 px-4 py-2 font-bold backdrop-blur-sm"
                              style={{
                                color: draft.secondaryButtonColor,
                                backgroundColor: draft.secondaryButtonBgColor,
                                fontSize: `${Math.round(baseBtnPx * pos.fontScale * 10) / 10}px`,
                              }}
                            >
                              <Send className="h-3.5 w-3.5 shrink-0" /> {draft.secondaryButtonText}
                            </span>
                          </div>
                        )}

                        {elId === "optionalButton" && (
                          <div className={`flex ${alignFlex}`}>
                            <span
                              className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-white/25 px-4 py-2 font-bold backdrop-blur-sm"
                              style={{
                                color: draft.optionalButtonColor,
                                backgroundColor: draft.optionalButtonBgColor,
                                fontSize: `${Math.round(baseBtnPx * pos.fontScale * 10) / 10}px`,
                              }}
                            >
                              {draft.optionalButtonText}
                            </span>
                          </div>
                        )}

                        {elId === "optionalText" && (
                          <p
                            className="font-semibold tracking-wide"
                            style={{
                              color: draft.optionalTextColor || "#fde68a",
                              fontSize: `${Math.round((previewDevice === "mobile" ? 11.5 : 13) * pos.fontScale * 10) / 10}px`,
                            }}
                          >
                            {draft.optionalText}
                          </p>
                        )}

                        {/* Right-edge resize handle when selected */}
                        {!previewOnly && isSelected && (
                          <div
                            onPointerDown={(e) => startElementDrag(e, elId, "resize")}
                            onPointerMove={handleElementPointerMove}
                            onPointerUp={endElementDrag}
                            onPointerCancel={endElementDrag}
                            title="প্রস্থ বাড়াতে বা কমাতে টানুন"
                            className="absolute right-0 top-1/2 h-6 w-2.5 -translate-y-1/2 translate-x-1/2 cursor-ew-resize rounded-full bg-amber-300 shadow ring-1 ring-emerald-950"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  className={`relative z-20 ${
                    previewDevice !== "mobile" &&
                    hasPreviewImage &&
                    (draft.layoutMode === "split_left" || draft.layoutMode === "split_right")
                      ? "grid grid-cols-12 items-center gap-6"
                      : ""
                  }`}
                >
                  {previewDevice !== "mobile" &&
                    hasPreviewImage &&
                    draft.layoutMode === "split_right" && (
                      <div className="col-span-5 h-56 overflow-hidden rounded-2xl border border-white/15 bg-black/15">
                        <img
                          src={activePreviewImg}
                          alt="Hero Split Preview"
                          className={`h-full w-full ${
                            draft.imageFit === "contain" ? "object-contain" : "object-cover"
                          }`}
                          style={{ objectPosition: activeFocal }}
                        />
                      </div>
                    )}

                  <div
                    className={
                      previewDevice !== "mobile" &&
                      hasPreviewImage &&
                      (draft.layoutMode === "split_left" || draft.layoutMode === "split_right")
                        ? "col-span-7"
                        : ""
                    }
                  >
                    {draft.badgeText.trim() && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold tracking-wide backdrop-blur-sm"
                        style={{
                          color: draft.badgeColor,
                          backgroundColor: draft.badgeBgColor,
                        }}
                      >
                        <Droplet className="h-3 w-3" /> {draft.badgeText}
                      </span>
                    )}

                    <h1
                      className={`mt-3.5 font-bangla font-extrabold leading-[1.24] tracking-tight drop-shadow-xs ${
                        previewDevice === "mobile"
                          ? "text-[22px]"
                          : previewDevice === "tablet"
                            ? "text-[28px]"
                            : "text-[32px]"
                      }`}
                      style={{ color: draft.headingColor }}
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
                        className={`mt-2.5 max-w-xl text-[12.5px] leading-relaxed sm:text-sm ${
                          draft.textAlign === "center"
                            ? "mx-auto"
                            : draft.textAlign === "right"
                              ? "ml-auto"
                              : ""
                        }`}
                        style={{ color: draft.descriptionColor, opacity: 0.94 }}
                      >
                        {draft.description}
                      </p>
                    )}

                    <div
                      className={`mt-5 flex flex-wrap items-center gap-2.5 ${
                        draft.textAlign === "left"
                          ? "justify-start"
                          : draft.textAlign === "right"
                            ? "justify-end"
                            : "justify-center"
                      }`}
                    >
                      {draft.primaryButtonText.trim() && (
                        <span
                          className="inline-flex min-h-[38px] items-center gap-2 rounded-full px-4 py-2 text-xs font-extrabold shadow-sm"
                          style={{
                            color: draft.primaryButtonColor,
                            backgroundColor: draft.primaryButtonBgColor,
                          }}
                        >
                          <Phone className="h-3.5 w-3.5" /> {draft.primaryButtonText}
                        </span>
                      )}
                      {draft.secondaryButtonText.trim() && (
                        <span
                          className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-xs font-bold backdrop-blur-sm"
                          style={{
                            color: draft.secondaryButtonColor,
                            backgroundColor: draft.secondaryButtonBgColor,
                          }}
                        >
                          <Send className="h-3.5 w-3.5" /> {draft.secondaryButtonText}
                        </span>
                      )}
                      {draft.optionalButtonText?.trim() && (
                        <span
                          className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-xs font-bold backdrop-blur-sm"
                          style={{
                            color: draft.optionalButtonColor,
                            backgroundColor: draft.optionalButtonBgColor,
                          }}
                        >
                          {draft.optionalButtonText}
                        </span>
                      )}
                    </div>

                    {draft.optionalText?.trim() && (
                      <p
                        className="mt-2 text-xs font-semibold tracking-wide"
                        style={{ color: draft.optionalTextColor || "#fde68a" }}
                      >
                        {draft.optionalText}
                      </p>
                    )}
                  </div>

                  {previewDevice !== "mobile" &&
                    hasPreviewImage &&
                    draft.layoutMode === "split_left" && (
                      <div className="col-span-5 h-56 overflow-hidden rounded-2xl border border-white/15 bg-black/15">
                        <img
                          src={activePreviewImg}
                          alt="Hero Split Preview"
                          className={`h-full w-full ${
                            draft.imageFit === "contain" ? "object-contain" : "object-cover"
                          }`}
                          style={{ objectPosition: activeFocal }}
                        />
                      </div>
                    )}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Numerical & Fine-Tuning Inspector Panel for Active Device */}
        <div className="rounded-2xl border border-border/80 bg-background/80 p-3.5 sm:p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
            <span className="text-xs font-bold text-foreground">
              সুনির্দিষ্ট অবস্থান নিয়ন্ত্রণ ({previewDevice === "desktop" ? "ডেস্কটপ" : previewDevice === "tablet" ? "ট্যাবলেট" : "মোবাইল"} ব্র্যাকপয়েন্ট)
            </span>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
              <span>সার্বিক গ্যাপ:</span>
              <input
                type="number"
                min={0}
                max={48}
                value={activeDeviceLayout.elementSpacingPx}
                onChange={(e) =>
                  updateDeviceLayout(previewDevice, (cur) => ({
                    ...cur,
                    mode: "custom",
                    elementSpacingPx: Math.round(clampNumber(Number(e.target.value) || 0, 0, 48)),
                  }))
                }
                className="w-14 rounded-lg border border-border bg-card px-2 py-0.5 text-center font-mono text-xs text-foreground"
              />
              <span>px</span>
            </div>
          </div>

          {/* Element selector tabs */}
          <div className="flex flex-wrap gap-1.5">
            {HERO_ELEMENT_IDS.map((elId) => (
              <button
                key={elId}
                type="button"
                onClick={() => setSelectedElement(elId)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                  selectedElement === elId
                    ? "border-primary bg-primary text-primary-foreground shadow-xs"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {HERO_ELEMENT_LABELS_BN[elId]}
              </button>
            ))}
          </div>

          {/* Selected Element Controls */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <label className="flex items-center justify-between text-[10.5px] font-bold text-muted-foreground">
                <span>বাম থেকে (X %)</span>
                <span className="font-mono text-primary">{selectedElPos.xPercent}%</span>
              </label>
              <input
                type="number"
                min={2}
                max={88}
                step={0.5}
                value={selectedElPos.xPercent}
                onChange={(e) =>
                  updateElementPosition(selectedElement, { xPercent: Number(e.target.value) || 2 })
                }
                className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1 font-mono text-xs font-semibold"
              />
            </div>

            <div>
              <label className="flex items-center justify-between text-[10.5px] font-bold text-muted-foreground">
                <span>উপর থেকে (Y %)</span>
                <span className="font-mono text-primary">{selectedElPos.yPercent}%</span>
              </label>
              <input
                type="number"
                min={2}
                max={88}
                step={0.5}
                value={selectedElPos.yPercent}
                onChange={(e) =>
                  updateElementPosition(selectedElement, { yPercent: Number(e.target.value) || 2 })
                }
                className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1 font-mono text-xs font-semibold"
              />
            </div>

            <div>
              <label className="flex items-center justify-between text-[10.5px] font-bold text-muted-foreground">
                <span>বক্স প্রস্থ (%)</span>
                <span className="font-mono text-primary">{selectedElPos.widthPercent}%</span>
              </label>
              <input
                type="number"
                min={14}
                max={96}
                step={1}
                value={selectedElPos.widthPercent}
                onChange={(e) =>
                  updateElementPosition(selectedElement, {
                    widthPercent: Number(e.target.value) || 20,
                  })
                }
                className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1 font-mono text-xs font-semibold"
              />
            </div>

            <div>
              <label className="flex items-center justify-between text-[10.5px] font-bold text-muted-foreground">
                <span>সর্বোচ্চ প্রস্থ (px)</span>
                <span className="font-mono text-primary">{selectedElPos.maxWidthPx}</span>
              </label>
              <input
                type="number"
                min={120}
                max={1100}
                step={10}
                value={selectedElPos.maxWidthPx}
                onChange={(e) =>
                  updateElementPosition(selectedElement, {
                    maxWidthPx: Number(e.target.value) || 240,
                  })
                }
                className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1 font-mono text-xs font-semibold"
              />
            </div>

            <div>
              <label className="flex items-center justify-between text-[10.5px] font-bold text-muted-foreground">
                <span>টেক্সট স্কেল</span>
                <span className="font-mono text-primary">{selectedElPos.fontScale.toFixed(2)}x</span>
              </label>
              <input
                type="range"
                min={0.7}
                max={1.6}
                step={0.05}
                value={selectedElPos.fontScale}
                onChange={(e) =>
                  updateElementPosition(selectedElement, { fontScale: Number(e.target.value) })
                }
                className="mt-2.5 w-full accent-emerald-700"
              />
            </div>

            <div>
              <label className="text-[10.5px] font-bold text-muted-foreground">এলাইনমেন্ট</label>
              <div className="mt-1 grid grid-cols-3 gap-1 rounded-lg border border-border bg-card p-0.5">
                {(["left", "center", "right"] as const).map((al) => (
                  <button
                    key={al}
                    type="button"
                    onClick={() => updateElementPosition(selectedElement, { textAlign: al })}
                    className={`rounded py-1 text-[10.5px] font-bold transition ${
                      selectedElPos.textAlign === al
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {al === "left" ? "বাম" : al === "center" ? "মাঝ" : "ডান"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between text-[10.5px] font-bold text-muted-foreground">
                <span>এলিমেন্ট প্যাডিং / স্পেসিং</span>
                <span className="font-mono text-primary">{selectedElPos.paddingPx}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={28}
                step={2}
                value={selectedElPos.paddingPx}
                onChange={(e) =>
                  updateElementPosition(selectedElement, { paddingPx: Number(e.target.value) })
                }
                className="mt-1.5 w-full accent-emerald-700"
              />
            </div>
            <div className="flex items-end justify-end">
              <p className="text-[11px] text-muted-foreground">
                টিপস: প্রিভিউতে এলিমেন্ট টেনে আনুন বা ডান পাশের সোনালি হ্যান্ডেল টেনে প্রস্থ পরিবর্তন করুন।
              </p>
            </div>
          </div>
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
          {/* Desktop Image Card */}
          <div className="rounded-2xl border border-border/80 bg-background/70 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Monitor className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-foreground">প্রধান / ডেস্কটপ হিরো ছবি</span>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                JPG, PNG, WebP • সর্বোচ্চ ২৫ MB
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
                  {uploadingDesktop && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 px-3 text-center text-white backdrop-blur-xs">
                      <Loader2 className="mb-1 h-5 w-5 animate-spin" />
                      <span className="text-[11px] font-bold">
                        {desktopStage ? STAGE_LABEL_BN[desktopStage] : "আপলোড হচ্ছে..."} {desktopProgress}%
                      </span>
                    </div>
                  )}
                </div>
                {desktopMeta && (
                  <p className="text-[10.5px] font-semibold text-emerald-700">
                    অপ্টিমাইজড: {desktopMeta.width}×{desktopMeta.height} • {desktopMeta.format.toUpperCase()} • {formatFileSizeBn(desktopMeta.sizeBytes)}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={uploadingDesktop || !canUploadImages}
                    onClick={() => desktopInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/15 disabled:opacity-50"
                  >
                    {uploadingDesktop ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                    <span>{uploadingDesktop ? "আপলোড হচ্ছে..." : "ছবি পরিবর্তন করুন"}</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canUploadImages || uploadingDesktop}
                    onClick={() => void handleRemoveImage("desktop")}
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-500/15 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> সরিয়ে ফেলুন
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={uploadingDesktop || !canUploadImages}
                onClick={() => desktopInputRef.current?.click()}
                className="flex h-32 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.03] px-4 text-center transition hover:border-primary/60 hover:bg-primary/[0.06] disabled:opacity-50"
              >
                {uploadingDesktop ? (
                  <>
                    <Loader2 className="mb-1.5 h-6 w-6 animate-spin text-primary" />
                    <span className="text-xs font-bold text-primary">
                      {desktopStage ? STAGE_LABEL_BN[desktopStage] : "আপলোড হচ্ছে..."} {desktopProgress}%
                    </span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="mb-1.5 h-6 w-6 text-primary" />
                    <span className="text-xs font-bold text-foreground">ডেস্কটপ / প্রধান ব্যানার ছবি আপলোড করুন</span>
                    <span className="mt-0.5 text-[10px] text-muted-foreground">প্রস্তাবিত অনুপাত ১৬:৯ (স্বয়ংক্রিয় WebP)</span>
                  </>
                )}
              </button>
            )}

            <input
              ref={desktopInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/avif,image/gif"
              onChange={(e) => void handleImageUpload(e, "desktop")}
              className="hidden"
            />

            {uploadingDesktop && desktopProgress > 0 && (
              <div className="space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${desktopProgress}%` }} />
                </div>
              </div>
            )}

            {desktopError && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-800">
                <span className="min-w-0 flex-1 font-medium">{desktopError}</span>
                {lastDesktopFile && !uploadingDesktop && (
                  <button
                    type="button"
                    onClick={() => void processBannerImageUpload(lastDesktopFile, "desktop")}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-[10.5px] font-bold text-white hover:bg-rose-700"
                  >
                    <RefreshCw className="h-3 w-3" /> পুনরায় চেষ্টা
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">ডেস্কটপ ফোকাল পজিশন</label>
                <select
                  value={draft.imagePositionDesktop}
                  onChange={(e) =>
                    setDraft({ ...draft, imagePositionDesktop: e.target.value as HeroImageFocalPosition })
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
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">ট্যাবলেট ফোকাল পজিশন</label>
                <select
                  value={draft.imagePositionTablet || draft.imagePositionDesktop}
                  onChange={(e) =>
                    setDraft({ ...draft, imagePositionTablet: e.target.value as HeroImageFocalPosition })
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

          {/* Mobile Image Card */}
          <div className="rounded-2xl border border-border/80 bg-background/70 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Smartphone className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-foreground">মোবাইল ব্যানার ছবি (ঐচ্ছিক)</span>
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
                  {uploadingMobile && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 px-3 text-center text-white backdrop-blur-xs">
                      <Loader2 className="mb-1 h-5 w-5 animate-spin" />
                      <span className="text-[11px] font-bold">
                        {mobileStage ? STAGE_LABEL_BN[mobileStage] : "আপলোড হচ্ছে..."} {mobileProgress}%
                      </span>
                    </div>
                  )}
                </div>
                {mobileMeta && (
                  <p className="text-[10.5px] font-semibold text-emerald-700">
                    অপ্টিমাইজড: {mobileMeta.width}×{mobileMeta.height} • {mobileMeta.format.toUpperCase()} • {formatFileSizeBn(mobileMeta.sizeBytes)}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={uploadingMobile || !canUploadImages}
                    onClick={() => mobileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/15 disabled:opacity-50"
                  >
                    {uploadingMobile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                    <span>{uploadingMobile ? "আপলোড হচ্ছে..." : "পরিবর্তন করুন"}</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canUploadImages || uploadingMobile}
                    onClick={() => void handleRemoveImage("mobile")}
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-500/15 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> সরান
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={uploadingMobile || !canUploadImages}
                onClick={() => mobileInputRef.current?.click()}
                className="flex h-32 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 px-4 text-center transition hover:border-primary/50 hover:bg-primary/[0.04] disabled:opacity-50"
              >
                {uploadingMobile ? (
                  <>
                    <Loader2 className="mb-1.5 h-6 w-6 animate-spin text-primary" />
                    <span className="text-xs font-bold text-primary">
                      {mobileStage ? STAGE_LABEL_BN[mobileStage] : "আপলোড হচ্ছে..."} {mobileProgress}%
                    </span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="mb-1.5 h-6 w-6 text-muted-foreground" />
                    <span className="text-xs font-bold text-foreground">আলাদা মোবাইল ছবি আপলোড (ঐচ্ছিক)</span>
                    <span className="mt-0.5 text-[10px] text-muted-foreground">ফাঁকা রাখলে প্রধান ছবি ব্যবহার হবে</span>
                  </>
                )}
              </button>
            )}

            <input
              ref={mobileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/avif,image/gif"
              onChange={(e) => void handleImageUpload(e, "mobile")}
              className="hidden"
            />

            {uploadingMobile && mobileProgress > 0 && (
              <div className="space-y-1">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${mobileProgress}%` }} />
                </div>
              </div>
            )}

            {mobileError && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-800">
                <span className="min-w-0 flex-1 font-medium">{mobileError}</span>
                {lastMobileFile && !uploadingMobile && (
                  <button
                    type="button"
                    onClick={() => void processBannerImageUpload(lastMobileFile, "mobile")}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-[10.5px] font-bold text-white hover:bg-rose-700"
                  >
                    <RefreshCw className="h-3 w-3" /> পুনরায় চেষ্টা
                  </button>
                )}
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">মোবাইল ফোকাল পজিশন</label>
              <select
                value={draft.imagePositionMobile}
                onChange={(e) =>
                  setDraft({ ...draft, imagePositionMobile: e.target.value as HeroImageFocalPosition })
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

        {/* Contrast Overlay Slider */}
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
              onChange={(e) => setDraft({ ...draft, overlayOpacity: Number(e.target.value) })}
              className="w-full accent-emerald-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ColorInputField
              label="ওভারলে রঙ"
              value={draft.overlayColor}
              defaultValue={DEFAULT_HERO_BANNER_ITEM.overlayColor}
              disabled={!canEditColors}
              onChange={(v) => setDraft({ ...draft, overlayColor: v })}
            />
            <div className="rounded-2xl border border-border/80 bg-background/80 p-2.5">
              <label className="text-[10.5px] font-bold text-foreground">কর্নার রাউন্ডনেস</label>
              <select
                value={draft.borderRadius}
                onChange={(e) =>
                  setDraft({ ...draft, borderRadius: e.target.value as HeroBannerConfig["borderRadius"] })
                }
                className="mt-1.5 w-full rounded-lg border border-border bg-card px-2 py-1 text-xs font-medium"
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

        {/* Theme Presets & Per-Element Color Matrix */}
        <div className="space-y-3 rounded-2xl border border-border/70 bg-background/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Palette className="h-3.5 w-3.5 text-primary" /> এলিমেন্টভিত্তিক কাস্টম কালার ও থিম প্রিসেট
            </span>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold">
              <input
                type="checkbox"
                checked={draft.showDecorativeGlow}
                onChange={(e) => setDraft({ ...draft, showDecorativeGlow: e.target.checked })}
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
                disabled={!canEditColors}
                onClick={() =>
                  setDraft({
                    ...draft,
                    gradientFrom: theme.gradientFrom,
                    gradientVia: theme.gradientVia,
                    gradientTo: theme.gradientTo,
                    solidColor: theme.solidColor,
                    overlayColor: theme.overlayColor,
                    textColor: theme.headingColor,
                    subtextColor: theme.descriptionColor,
                    headingColor: theme.headingColor,
                    descriptionColor: theme.descriptionColor,
                    primaryButtonColor: theme.primaryButtonColor,
                    primaryButtonBgColor: theme.primaryButtonBgColor,
                    secondaryButtonColor: theme.secondaryButtonColor,
                    secondaryButtonBgColor: theme.secondaryButtonBgColor,
                  })
                }
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold transition hover:border-primary/50 disabled:opacity-50"
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

          {/* Background gradient / solid */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <ColorInputField
              label="গ্র্যাডিয়েন্ট শুরু"
              value={draft.gradientFrom}
              defaultValue={DEFAULT_HERO_BANNER_ITEM.gradientFrom}
              disabled={!canEditColors}
              onChange={(v) => setDraft({ ...draft, gradientFrom: v })}
            />
            <ColorInputField
              label="গ্র্যাডিয়েন্ট মাঝ"
              value={draft.gradientVia}
              defaultValue={DEFAULT_HERO_BANNER_ITEM.gradientVia}
              disabled={!canEditColors}
              onChange={(v) => setDraft({ ...draft, gradientVia: v })}
            />
            <ColorInputField
              label="গ্র্যাডিয়েন্ট শেষ"
              value={draft.gradientTo}
              defaultValue={DEFAULT_HERO_BANNER_ITEM.gradientTo}
              disabled={!canEditColors}
              onChange={(v) => setDraft({ ...draft, gradientTo: v })}
            />
            <ColorInputField
              label="সলিড ব্যাকগ্রাউন্ড"
              value={draft.solidColor}
              defaultValue={DEFAULT_HERO_BANNER_ITEM.solidColor}
              disabled={!canEditColors}
              onChange={(v) => setDraft({ ...draft, solidColor: v })}
            />
          </div>

          {/* Per-element typography & button colors */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-4">
            <ColorInputField
              label="শিরোনাম রঙ"
              value={draft.headingColor}
              defaultValue={DEFAULT_HERO_BANNER_ITEM.headingColor}
              contrastAgainst={previewBgForContrast}
              disabled={!canEditColors}
              onChange={(v) => setDraft({ ...draft, headingColor: v, textColor: v })}
            />
            <ColorInputField
              label="বিবরণ টেক্সট রঙ"
              value={draft.descriptionColor}
              defaultValue={DEFAULT_HERO_BANNER_ITEM.descriptionColor}
              contrastAgainst={previewBgForContrast}
              disabled={!canEditColors}
              onChange={(v) => setDraft({ ...draft, descriptionColor: v, subtextColor: v })}
            />
            <ColorInputField
              label="টপ ব্যাজ লেখা রঙ"
              value={draft.badgeColor}
              defaultValue={DEFAULT_HERO_BANNER_ITEM.badgeColor}
              disabled={!canEditColors}
              onChange={(v) => setDraft({ ...draft, badgeColor: v })}
            />
            <ColorInputField
              label="টপ ব্যাজ ব্যাকগ্রাউন্ড"
              value={draft.badgeBgColor}
              defaultValue={DEFAULT_HERO_BANNER_ITEM.badgeBgColor}
              disabled={!canEditColors}
              onChange={(v) => setDraft({ ...draft, badgeBgColor: v })}
            />
            <ColorInputField
              label="প্রাইমারি বাটন লেখা"
              value={draft.primaryButtonColor}
              defaultValue={DEFAULT_HERO_BANNER_ITEM.primaryButtonColor}
              contrastAgainst={draft.primaryButtonBgColor}
              disabled={!canEditColors}
              onChange={(v) => setDraft({ ...draft, primaryButtonColor: v })}
            />
            <ColorInputField
              label="প্রাইমারি বাটন ব্যাকগ্রাউন্ড"
              value={draft.primaryButtonBgColor}
              defaultValue={DEFAULT_HERO_BANNER_ITEM.primaryButtonBgColor}
              disabled={!canEditColors}
              onChange={(v) => setDraft({ ...draft, primaryButtonBgColor: v })}
            />
            <ColorInputField
              label="সেকেন্ডারি বাটন লেখা"
              value={draft.secondaryButtonColor}
              defaultValue={DEFAULT_HERO_BANNER_ITEM.secondaryButtonColor}
              contrastAgainst={draft.secondaryButtonBgColor}
              disabled={!canEditColors}
              onChange={(v) => setDraft({ ...draft, secondaryButtonColor: v })}
            />
            <ColorInputField
              label="সেকেন্ডারি বাটন ব্যাকগ্রাউন্ড"
              value={draft.secondaryButtonBgColor}
              defaultValue={DEFAULT_HERO_BANNER_ITEM.secondaryButtonBgColor}
              disabled={!canEditColors}
              onChange={(v) => setDraft({ ...draft, secondaryButtonBgColor: v })}
            />
          </div>
        </div>
      </div>

      {/* 3. Typography, Bengali Copy & CTA Controls */}
      <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2 border-b border-border/60 pb-3">
          <Type className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-bold text-foreground">
            শিরোনাম, বিবরণ ও অ্যাকশন বাটন (৩টি পর্যন্ত CTA)
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold text-muted-foreground">টপ ব্যাজ টেক্সট (Badge Text)</label>
            <input
              type="text"
              value={draft.badgeText}
              onChange={(e) => setDraft({ ...draft, badgeText: e.target.value })}
              placeholder={DEFAULT_HERO_BANNER_ITEM.badgeText}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">মূল শিরোনাম (১ম লাইন) *</label>
            <input
              type="text"
              value={draft.headingLine1}
              onChange={(e) => setDraft({ ...draft, headingLine1: e.target.value })}
              placeholder={DEFAULT_HERO_BANNER_ITEM.headingLine1}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">মূল শিরোনাম (২য় লাইন)</label>
            <input
              type="text"
              value={draft.headingLine2}
              onChange={(e) => setDraft({ ...draft, headingLine2: e.target.value })}
              placeholder={DEFAULT_HERO_BANNER_ITEM.headingLine2}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold focus:border-primary focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold text-muted-foreground">ব্যানারের বিবরণ / সাবটাইটেল</label>
            <textarea
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder={DEFAULT_HERO_BANNER_ITEM.description}
              className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs leading-relaxed focus:border-primary focus:outline-none"
            />
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/25 p-3.5 space-y-2.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-primary-deep">
              <Link2 className="h-3.5 w-3.5 text-amber-600" /> প্রাইমারি বাটন (#১)
            </p>
            <input
              type="text"
              value={draft.primaryButtonText}
              onChange={(e) => setDraft({ ...draft, primaryButtonText: e.target.value })}
              placeholder="জরুরি ৯৯৯"
              className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold"
            />
            <input
              type="text"
              value={draft.primaryButtonLink}
              onChange={(e) => setDraft({ ...draft, primaryButtonLink: e.target.value })}
              placeholder="tel:999"
              className="w-full rounded-xl border border-border bg-background px-3 py-1.5 font-mono text-xs"
            />
          </div>

          <div className="rounded-2xl border border-border/70 bg-muted/25 p-3.5 space-y-2.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-primary-deep">
              <Link2 className="h-3.5 w-3.5 text-primary" /> সেকেন্ডারি বাটন (#২)
            </p>
            <input
              type="text"
              value={draft.secondaryButtonText}
              onChange={(e) => setDraft({ ...draft, secondaryButtonText: e.target.value })}
              placeholder="নতুন তথ্য দিন"
              className="w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold"
            />
            <input
              type="text"
              value={draft.secondaryButtonLink}
              onChange={(e) => setDraft({ ...draft, secondaryButtonLink: e.target.value })}
              placeholder="/submit-info"
              className="w-full rounded-xl border border-border bg-background px-3 py-1.5 font-mono text-xs"
            />
          </div>

          {/* Optional 3rd CTA Button & Extra Note Text */}
          <div className="sm:col-span-2 rounded-2xl border border-border/70 bg-muted/20 p-3.5 space-y-2.5">
            <p className="flex items-center gap-1.5 text-xs font-bold text-primary-deep">
              <Link2 className="h-3.5 w-3.5 text-emerald-600" /> অতিরিক্ত ৩য় বাটন ও নোট টেক্সট (ঐচ্ছিক)
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={draft.optionalButtonText || ""}
                onChange={(e) => setDraft({ ...draft, optionalButtonText: e.target.value })}
                placeholder="৩য় বাটনের লেখা (ফাঁকা রাখলে দেখাবে না)"
                className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold"
              />
              <input
                type="text"
                value={draft.optionalButtonLink || ""}
                onChange={(e) => setDraft({ ...draft, optionalButtonLink: e.target.value })}
                placeholder="/blood-donor বা URL"
                className="rounded-xl border border-border bg-background px-3 py-1.5 font-mono text-xs"
              />
              <ColorInputField
                label="৩য় বাটন লেখা রঙ"
                value={draft.optionalButtonColor}
                defaultValue={DEFAULT_HERO_BANNER_ITEM.optionalButtonColor}
                disabled={!canEditColors}
                onChange={(v) => setDraft({ ...draft, optionalButtonColor: v })}
              />
              <ColorInputField
                label="৩য় বাটন ব্যাকগ্রাউন্ড"
                value={draft.optionalButtonBgColor}
                defaultValue={DEFAULT_HERO_BANNER_ITEM.optionalButtonBgColor}
                disabled={!canEditColors}
                onChange={(v) => setDraft({ ...draft, optionalButtonBgColor: v })}
              />
              <input
                type="text"
                value={draft.optionalText || ""}
                onChange={(e) => setDraft({ ...draft, optionalText: e.target.value })}
                placeholder="অতিরিক্ত ছোট টেক্সট / নোট (যেমন: ২৪/৭ জরুরি সেবা চালু)"
                className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold"
              />
              <ColorInputField
                label="অতিরিক্ত টেক্সটের রঙ"
                value={draft.optionalTextColor || "#fde68a"}
                defaultValue={DEFAULT_HERO_BANNER_ITEM.optionalTextColor}
                disabled={!canEditColors}
                onChange={(v) => setDraft({ ...draft, optionalTextColor: v })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Save / Publish / Cancel / Restore Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-primary/25 bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving || resetting || uploadingDesktop || uploadingMobile}
            onClick={() => void handleSave("draft")}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/10 px-4 py-2.5 text-xs font-bold text-primary-deep transition hover:bg-primary/15 active:scale-95 disabled:opacity-60"
          >
            {saving && savingTarget === "draft" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>{saving && savingTarget === "draft" ? "ড্রাফট সেভ হচ্ছে..." : "ড্রাফট সেভ করুন"}</span>
          </button>

          {canPublish && (
            <button
              type="button"
              disabled={saving || resetting || uploadingDesktop || uploadingMobile}
              onClick={() => void handleSave("published")}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-hero px-5 py-2.5 text-xs font-extrabold text-primary-foreground shadow-elevated transition hover:brightness-105 active:scale-95 disabled:opacity-60"
            >
              {saving && savingTarget === "published" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>
                {saving && savingTarget === "published"
                  ? "প্রকাশ হচ্ছে..."
                  : draft.status === "published"
                  ? "আপডেট ও প্রকাশ করুন"
                  : "সেভ ও প্রকাশ করুন"}
              </span>
            </button>
          )}

          {isDirty && (
            <button
              type="button"
              disabled={saving || resetting}
              onClick={() => {
                setDraft(selectedSaved);
                toast.info("অসংরক্ষিত পরিবর্তন বাতিল করা হয়েছে।");
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2.5 text-xs font-bold text-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" /> বাতিল করুন
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedSaved.updatedAt && (
            <span className="hidden items-center gap-1 text-[10.5px] text-muted-foreground sm:inline-flex">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              আপডেট: {new Date(selectedSaved.updatedAt).toLocaleDateString("bn-BD")}
            </span>
          )}
          <button
            type="button"
            disabled={saving || resetting || !isMainAdmin}
            onClick={() => setConfirmRestoreModal(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-bold text-destructive transition hover:bg-destructive/15 disabled:opacity-60"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{resetting ? "রিসেট হচ্ছে..." : "ডিফল্ট পুনরুদ্ধার"}</span>
          </button>
        </div>
      </div>

      {/* In-UI Modal: Delete Banner Confirmation */}
      {confirmDeleteBanner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          onClick={() => !saving && setConfirmDeleteBanner(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-elevated space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-rose-600">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h4 className="font-display text-sm font-bold">ব্যানার স্থায়ীভাবে মুছবেন?</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              আপনি কি নিশ্চিত যে <strong className="text-foreground">“{confirmDeleteBanner.name}”</strong> ব্যানারটি মুছে ফেলতে চান? এই কাজটি আর ফিরিয়ে আনা যাবে না।
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setConfirmDeleteBanner(null)}
                className="rounded-xl border border-border px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted disabled:opacity-50"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void executeDeleteBanner(confirmDeleteBanner)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{saving ? "মুছছে..." : "হ্যাঁ, মুছে ফেলুন"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-UI Modal: Restore Defaults Confirmation */}
      {confirmRestoreModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          onClick={() => setConfirmRestoreModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-elevated space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 text-amber-700">
              <RotateCcw className="h-5 w-5 shrink-0" />
              <h4 className="font-display text-sm font-bold">ডিফল্ট হিরো ব্যানারে ফিরবেন?</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              বর্তমান সকল কাস্টম ব্যানার ও ক্যারোসেল সেটিংস মুছে ডিফল্ট স্মার্ট নোয়াখালী হিরো ব্যানারে ফিরিয়ে আনা হবে।
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRestoreModal(false)}
                className="rounded-xl border border-border px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => void executeRestoreDefaults()}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-amber-700"
              >
                ডিফল্ট রিসেট করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
