import { useState, useRef } from "react";
import {
  Image as ImageIcon,
  Upload,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Globe,
  Sparkles,
  ExternalLink,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useRolePermissions } from "@/lib/permissions";
import {
  useBranding,
  uploadBrandingFile,
  DEFAULT_BRANDING,
  type SiteBranding,
} from "@/lib/branding";

export function WebsiteBrandingManager() {
  const { isMainAdmin } = useAuth();
  const { hasPermission } = useRolePermissions();
  const { branding, saveBranding, resetBranding, saving } = useBranding();

  const canUploadBranding = isMainAdmin || hasPermission("upload_branding");

  // Local drafts for previews before saving
  const [drafts, setDrafts] = useState<SiteBranding>(branding);
  const [uploadingAsset, setUploadingAsset] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // File input refs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const pwa192InputRef = useRef<HTMLInputElement>(null);
  const pwa512InputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    assetType: "logo" | "favicon" | "pwa192" | "pwa512"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!canUploadBranding) {
      toast.error("আপনার ওয়েবসাইট ব্র্যান্ডিং পরিবর্তনের অনুমতি নেই।");
      return;
    }

    setUploadingAsset(assetType);
    try {
      const res = await uploadBrandingFile(file, assetType);
      setDrafts((prev) => {
        if (assetType === "logo") return { ...prev, logoUrl: res.url };
        if (assetType === "favicon") return { ...prev, faviconUrl: res.url };
        if (assetType === "pwa192") return { ...prev, pwaIcon192: res.url };
        if (assetType === "pwa512") return { ...prev, pwaIcon512: res.url };
        return prev;
      });
      setDirty(true);
      toast.success(
        `${file.name} সফলভাবে আপলোড ও প্রিভিউতে যুক্ত হয়েছে (${res.width}x${res.height}px)`
      );
    } catch (err) {
      toast.error((err as Error).message || "ফাইল আপলোড ব্যর্থ হয়েছে");
    } finally {
      setUploadingAsset(null);
      if (e.target) e.target.value = "";
    }
  };

  const handleSaveBranding = async () => {
    if (!canUploadBranding) {
      toast.error("শুধুমাত্র অনুমোদিত এডমিন ব্র্যান্ডিং সংরক্ষণ করতে পারেন।");
      return;
    }

    try {
      await saveBranding(drafts);
      setDirty(false);
      toast.success("ওয়েবসাইট ব্র্যান্ডিং ও আইকনসমূহ ফায়ারবেসে সফলভাবে সংরক্ষিত হয়েছে!");
    } catch (err) {
      toast.error((err as Error).message || "সংরক্ষণ করা যায়নি");
    }
  };

  const handleResetToDefaults = async () => {
    if (!canUploadBranding) return;
    try {
      await resetBranding();
      setDrafts(DEFAULT_BRANDING);
      setDirty(false);
      toast.success("ডিফল্ট ব্র্যান্ডিং সম্পদে রিসেট সম্পন্ন হয়েছে");
    } catch (err) {
      toast.error((err as Error).message || "রিসেট ব্যর্থ হয়েছে");
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Info */}
      <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ImageIcon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold text-foreground">
                ওয়েবসাইট ব্র্যান্ডিং ও লোগো ব্যবস্থাপনা
              </h2>
              <p className="text-xs text-muted-foreground">
                হেডার লোগো, ব্রাউজার ফ্যাভিকন ও মোবাইল অ্যাপ (PWA) আইকন লাইভ আপডেট করুন
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToDefaults}
              disabled={saving || !canUploadBranding}
              className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> ডিফল্ট
            </button>
            <button
              type="button"
              onClick={handleSaveBranding}
              disabled={saving || !dirty || !canUploadBranding}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "সংরক্ষণ হচ্ছে..." : dirty ? "পরিবর্তন সংরক্ষণ করুন" : "সংরক্ষিত"}
            </button>
          </div>
        </div>

        {dirty && (
          <div className="mt-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 flex items-center justify-between">
            <span>আপনার কাছে অসংরক্ষিত ব্র্যান্ডিং প্রিভিউ আছে। সেভ করতে উপরের বাটনে ক্লিক করুন।</span>
          </div>
        )}
      </div>

      {/* Grid of Branding Assets */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 1. Header Logo */}
        <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" /> ১. ওয়েবসাইট মূল লোগো (Header Logo)
              </h3>
              <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                হেডার ও নেভবার
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              প্রস্তাবিত মাপ: ১২০x১২০ থেকে ২৫৬x২৫৬ পিক্সেল (স্বচ্ছ ব্যাকগ্রাউন্ড PNG/SVG উপযুক্ত)
            </p>

            {/* Live Header Preview Mockup */}
            <div className="mt-4 rounded-2xl border border-border bg-gradient-hero p-3 text-primary-foreground">
              <span className="text-[10px] font-mono opacity-70 block mb-1.5">লাইভ হেডার প্রিভিউ:</span>
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 shrink-0 rounded-xl bg-white/10 p-1 flex items-center justify-center border border-white/20">
                  <img
                    src={drafts.logoUrl || DEFAULT_BRANDING.logoUrl}
                    alt="Logo Preview"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div>
                  <p className="font-brand text-sm font-black text-brand-shimmer">Smart Noakhali</p>
                  <p className="text-[10px] font-bold text-amber-300">স্মার্ট নোয়াখালী</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => handleFileUpload(e, "logo")}
            />
            <button
              type="button"
              disabled={uploadingAsset === "logo" || !canUploadBranding}
              onClick={() => logoInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploadingAsset === "logo" ? "আপলোড হচ্ছে..." : "নতুন লোগো আপলোড"}
            </button>
            <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[180px]">
              {drafts.logoUrl ? "কাস্টম ফাইল লোড করা" : "ডিফল্ট লোগো"}
            </span>
          </div>
        </div>

        {/* 2. Browser Favicon */}
        <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" /> ২. ব্রাউজার ফ্যাভিকন (Favicon)
              </h3>
              <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                ট্যাব আইকন
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              প্রস্তাবিত মাপ: ৩২x৩২, ৪৮x৪৮ বা ৬৪x৬৪ পিক্সেল (.ico বা .png ফরম্যাট)
            </p>

            {/* Live Browser Tab Mockup */}
            <div className="mt-4 rounded-2xl border border-border bg-muted/50 p-3">
              <span className="text-[10px] font-mono text-muted-foreground block mb-1.5">
                ব্রাউজার ট্যাব প্রিভিউ:
              </span>
              <div className="flex items-center gap-2 rounded-t-xl bg-card border-x border-t border-border px-3 py-1.5 w-fit shadow-xs">
                <img
                  src={drafts.faviconUrl || DEFAULT_BRANDING.faviconUrl}
                  alt="Favicon Preview"
                  className="h-4 w-4 object-contain shrink-0"
                />
                <span className="text-xs font-semibold text-foreground truncate max-w-[140px]">
                  Smart Noakhali — স্মার্ট নোয়াখালী
                </span>
              </div>
              <div className="h-2 rounded-b-xl bg-card border border-border" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
            <input
              ref={faviconInputRef}
              type="file"
              accept="image/x-icon,image/vnd.microsoft.icon,image/png,image/svg+xml"
              className="hidden"
              onChange={(e) => handleFileUpload(e, "favicon")}
            />
            <button
              type="button"
              disabled={uploadingAsset === "favicon" || !canUploadBranding}
              onClick={() => faviconInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploadingAsset === "favicon" ? "আপলোড হচ্ছে..." : "ফ্যাভিকন আপলোড"}
            </button>
            <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[180px]">
              {drafts.faviconUrl ? "কাস্টম ফ্যাভিকন" : "ডিফল্ট ফ্যাভিকন"}
            </span>
          </div>
        </div>

        {/* 3. PWA App Icon 192x192 */}
        <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" /> ৩. পিডব্লিউএ মোবাইল আইকন (192x192)
              </h3>
              <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                হোম স্ক্রিন আইকন
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              প্রস্তাবিত মাপ: ১৯২x১৯২ পিক্সেল স্কয়ার PNG (মোবাইল হোম স্ক্রিন ও অ্যাপ শর্টকাট)
            </p>

            {/* Mobile Icon Preview Mockup */}
            <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-3 flex items-center gap-3">
              <div className="h-16 w-16 shrink-0 rounded-2xl bg-card border border-border p-2 shadow-card flex items-center justify-center">
                <img
                  src={drafts.pwaIcon192 || DEFAULT_BRANDING.pwaIcon192}
                  alt="PWA 192 Preview"
                  className="h-full w-full object-contain rounded-xl"
                />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">নোয়াখালী অ্যাপ</p>
                <p className="text-[11px] text-muted-foreground">অ্যান্ড্রয়েড ও আইওএস হোম স্ক্রিন</p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
            <input
              ref={pwa192InputRef}
              type="file"
              accept="image/png,image/webp"
              className="hidden"
              onChange={(e) => handleFileUpload(e, "pwa192")}
            />
            <button
              type="button"
              disabled={uploadingAsset === "pwa192" || !canUploadBranding}
              onClick={() => pwa192InputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploadingAsset === "pwa192" ? "আপলোড হচ্ছে..." : "192px আইকন আপলোড"}
            </button>
            <span className="text-[11px] font-mono text-muted-foreground">192x192 PNG</span>
          </div>
        </div>

        {/* 4. PWA App Icon 512x512 */}
        <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" /> ৪. পিডব্লিউএ স্প্ল্যাশ আইকন (512x512)
              </h3>
              <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                স্প্ল্যাশ ও হাই-রেজ
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              প্রস্তাবিত মাপ: ৫১২x৫১২ পিক্সেল স্কয়ার PNG (অ্যাপ ইনস্টল স্প্ল্যাশ স্ক্রিন)
            </p>

            {/* Splash Mockup */}
            <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-3 flex items-center gap-3">
              <div className="h-16 w-16 shrink-0 rounded-2xl bg-card border border-border p-2 shadow-card flex items-center justify-center">
                <img
                  src={drafts.pwaIcon512 || DEFAULT_BRANDING.pwaIcon512}
                  alt="PWA 512 Preview"
                  className="h-full w-full object-contain rounded-xl"
                />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">অ্যাপ স্টার্ট ও স্প্ল্যাশ</p>
                <p className="text-[11px] text-muted-foreground">হাই রেজোলিউশন ডিভাইস সমর্থন</p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
            <input
              ref={pwa512InputRef}
              type="file"
              accept="image/png,image/webp"
              className="hidden"
              onChange={(e) => handleFileUpload(e, "pwa512")}
            />
            <button
              type="button"
              disabled={uploadingAsset === "pwa512" || !canUploadBranding}
              onClick={() => pwa512InputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploadingAsset === "pwa512" ? "আপলোড হচ্ছে..." : "512px আইকন আপলোড"}
            </button>
            <span className="text-[11px] font-mono text-muted-foreground">512x512 PNG</span>
          </div>
        </div>
      </div>
    </div>
  );
}
