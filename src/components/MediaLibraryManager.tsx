import React, { useMemo, useRef, useState } from "react";
import {
  Image as ImageIcon,
  UploadCloud,
  Trash2,
  RotateCcw,
  Copy,
  Check,
  Lock,
  Sparkles,
  Search,
  RefreshCw,
  Link2,
  X,
  ShieldCheck,
  Loader2,
  FileCode2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useMediaLibrary,
  sanitizeSvgMarkup,
  type MediaAssetRecord,
  type MediaAssetType,
} from "@/lib/media-library";
import { useAuth } from "@/lib/auth";

const TYPE_LABELS: Record<MediaAssetType, string> = {
  logo: "লোগো",
  banner: "ব্যানার",
  icon: "আইকন",
  photo: "ছবি",
  svg: "ভেক্টর SVG",
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "সিস্টেম";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function MediaLibraryManager({
  onSelectAsset,
  compact = false,
}: {
  onSelectAsset?: (asset: MediaAssetRecord) => void;
  compact?: boolean;
}) {
  const { isMainAdmin } = useAuth();
  const {
    assets,
    trashedAssets,
    loading,
    uploading,
    uploadMediaAsset,
    registerExternalAsset,
    trashMediaAsset,
    restoreMediaAsset,
    permanentlyDeleteMediaAsset,
  } = useMediaLibrary();

  const [viewTab, setViewTab] = useState<"active" | "trash">("active");
  const [typeFilter, setTypeFilter] = useState<"all" | MediaAssetType>("all");
  const [search, setSearch] = useState("");
  const [uploadName, setUploadName] = useState("");
  const [uploadType, setUploadType] = useState<MediaAssetType>("icon");
  const [svgPreviewInfo, setSvgPreviewInfo] = useState<{
    name: string;
    sanitized: string;
  } | null>(null);
  const [pendingSvgFile, setPendingSvgFile] = useState<File | null>(null);

  const [extUrl, setExtUrl] = useState("");
  const [extName, setExtName] = useState("");
  const [extType, setExtType] = useState<MediaAssetType>("photo");
  const [showExtForm, setShowExtForm] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmPermDelete, setConfirmPermDelete] = useState<MediaAssetRecord | null>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const listSource = viewTab === "active" ? assets : trashedAssets;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listSource.filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (!q) return true;
      return `${item.name} ${item.type} ${item.mimeType}`.toLowerCase().includes(q);
    });
  }, [listSource, search, typeFilter]);

  if (!isMainAdmin) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-center text-xs text-amber-900">
        <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-amber-700" />
        মিডিয়া ও আইকন লাইব্রেরি শুধুমাত্র প্রধান সুপার এডমিনের জন্য সংরক্ষিত।
      </div>
    );
  }

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
    if (isSvg) {
      const raw = await file.text();
      const check = sanitizeSvgMarkup(raw);
      if (!check.ok || !check.sanitized) {
        toast.error(check.error || "SVG ফাইলটি নিরাপদ নয়");
        return;
      }
      setPendingSvgFile(file);
      setSvgPreviewInfo({
        name: uploadName.trim() || file.name.replace(/\.svg$/i, ""),
        sanitized: check.sanitized,
      });
      return;
    }

    try {
      const rec = await uploadMediaAsset(file, {
        name: uploadName.trim() || undefined,
        type: uploadType,
      });
      setUploadName("");
      toast.success(`"${rec.name}" মিডিয়া লাইব্রেরিতে সংরক্ষিত হয়েছে!`);
      if (onSelectAsset) onSelectAsset(rec);
    } catch (err: any) {
      toast.error(err?.message || "মিডিয়া আপলোড ব্যর্থ হয়েছে");
    }
  }

  async function handleConfirmSvgUpload() {
    if (!pendingSvgFile) return;
    try {
      const rec = await uploadMediaAsset(pendingSvgFile, {
        name: svgPreviewInfo?.name || uploadName.trim() || undefined,
        type: "svg",
      });
      setPendingSvgFile(null);
      setSvgPreviewInfo(null);
      setUploadName("");
      toast.success("নিরাপদ SVG স্যানিটাইজ ও সংরক্ষিত হয়েছে!");
      if (onSelectAsset) onSelectAsset(rec);
    } catch (err: any) {
      toast.error(err?.message || "SVG আপলোড ব্যর্থ হয়েছে");
    }
  }

  async function handleReplaceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !replaceTargetId) return;
    const target = assets.find((a) => a.id === replaceTargetId);
    try {
      await uploadMediaAsset(file, {
        name: target?.name,
        type: target?.type || "photo",
        replaceId: replaceTargetId,
      });
      toast.success("অ্যাসেটটি সফলভাবে প্রতিস্থাপন (Replace) করা হয়েছে!");
    } catch (err: any) {
      toast.error(err?.message || "রিপ্লেস ব্যর্থ হয়েছে");
    } finally {
      setReplaceTargetId(null);
    }
  }

  async function handleAddExternal(e: React.FormEvent) {
    e.preventDefault();
    if (!extUrl.trim()) return toast.error("বৈধ ইমেজ URL দিন");
    try {
      const rec = await registerExternalAsset({
        name: extName.trim() || "বাহ্যিক ছবি",
        url: extUrl.trim(),
        type: extType,
      });
      setExtUrl("");
      setExtName("");
      setShowExtForm(false);
      toast.success("বাহ্যিক মিডিয়া লিংক সংরক্ষিত হয়েছে!");
      if (onSelectAsset) onSelectAsset(rec);
    } catch (err: any) {
      toast.error(err?.message || "লিংক যোগ করা যায়নি");
    }
  }

  function handleCopyUrl(asset: MediaAssetRecord) {
    navigator.clipboard?.writeText(asset.url);
    setCopiedId(asset.id);
    toast.success("মিডিয়া URL কপি হয়েছে");
    setTimeout(() => setCopiedId((prev) => (prev === asset.id ? null : prev)), 1800);
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
        onChange={handleFilePicked}
        className="hidden"
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
        onChange={handleReplaceFile}
        className="hidden"
      />

      {/* Upload & External URL Bar */}
      <div className="rounded-3xl border border-primary/20 bg-card p-4 sm:p-5 shadow-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 font-display text-sm font-bold text-primary-deep">
              <ImageIcon className="h-4 w-4 text-primary" /> সেন্ট্রাল মিডিয়া, আইকন ও SVG লাইব্রেরি
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              PNG, JPG, WebP এবং স্যানিটাইজড SVG আপলোড, প্রতিস্থাপন ও পুনর্ব্যবহার করুন।
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowExtForm((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted"
            >
              <Link2 className="h-3.5 w-3.5" /> URL যোগ
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-hero px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-card disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UploadCloud className="h-3.5 w-3.5" />
              )}
              ফাইল আপলোড
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
            placeholder="নতুন ফাইলের নাম (ঐচ্ছিক, যেমন: হসপিটাল আইকন)"
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
          />
          <select
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value as MediaAssetType)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
          >
            <option value="icon">ক্যাটাগরি / বিভাগ আইকন (Icon)</option>
            <option value="logo">ওয়েবসাইট লোগো / ব্র্যান্ডিং (Logo)</option>
            <option value="banner">ব্যানার ছবি (Banner)</option>
            <option value="photo">সাধারণ ছবি (Photo)</option>
            <option value="svg">ভেক্টর SVG (Auto-Sanitized)</option>
          </select>
        </div>

        {showExtForm && (
          <form
            onSubmit={handleAddExternal}
            className="grid grid-cols-1 gap-2 rounded-2xl border border-primary/25 bg-primary/5 p-3 sm:grid-cols-3"
          >
            <input
              value={extName}
              onChange={(e) => setExtName(e.target.value)}
              placeholder="অ্যাসেটের নাম"
              className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
            />
            <input
              value={extUrl}
              onChange={(e) => setExtUrl(e.target.value)}
              placeholder="https://... ইমেজ URL"
              className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
            />
            <div className="flex items-center gap-1.5">
              <select
                value={extType}
                onChange={(e) => setExtType(e.target.value as MediaAssetType)}
                className="flex-1 rounded-xl border border-border bg-background px-2 py-2 text-xs"
              >
                <option value="icon">আইকন</option>
                <option value="photo">ছবি</option>
                <option value="banner">ব্যানার</option>
                <option value="logo">লোগো</option>
              </select>
              <button
                type="submit"
                className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
              >
                সংরক্ষণ
              </button>
            </div>
          </form>
        )}

        {/* SVG Sanitization Preview Modal / Box */}
        {svgPreviewInfo && (
          <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                <FileCode2 className="h-4 w-4" /> SVG নিরাপত্তা যাচাই ও প্রিভিউ ({svgPreviewInfo.name})
              </p>
              <button
                type="button"
                onClick={() => {
                  setSvgPreviewInfo(null);
                  setPendingSvgFile(null);
                }}
                className="rounded-full p-1 hover:bg-black/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/30 bg-white p-2"
                dangerouslySetInnerHTML={{ __html: svgPreviewInfo.sanitized }}
              />
              <div className="space-y-1 text-[11px] text-emerald-950">
                <p className="font-semibold">
                  ✓ ক্ষতিকর &lt;script&gt;, event handlers এবং unsafe লিংক স্বয়ংক্রিয়ভাবে অপসারণ করা হয়েছে।
                </p>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => void handleConfirmSvgUpload()}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-3.5 py-1 text-xs font-bold text-white"
                >
                  <Sparkles className="h-3 w-3" /> লাইব্রেরিতে যুক্ত করুন
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters & Active / Trash Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-card p-3 shadow-card">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewTab("active")}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              viewTab === "active"
                ? "bg-gradient-hero text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            সক্রিয় ({assets.length})
          </button>
          <button
            type="button"
            onClick={() => setViewTab("trash")}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${
              viewTab === "trash"
                ? "bg-rose-600 text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            ট্র্যাশ ({trashedAssets.length})
          </button>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold"
          >
            <option value="all">সকল ধরন</option>
            <option value="icon">আইকন</option>
            <option value="svg">SVG</option>
            <option value="logo">লোগো</option>
            <option value="banner">ব্যানার</option>
            <option value="photo">ছবি</option>
          </select>
        </div>

        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="মিডিয়া খুঁজুন..."
            className="w-full rounded-xl border border-border bg-background py-1.5 pl-8 pr-2.5 text-xs"
          />
        </div>
      </div>

      {/* Asset Grid */}
      {loading && assets.length === 0 ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center text-xs text-muted-foreground">
          {viewTab === "trash" ? "ট্র্যাশে কোনো মুছে ফেলা মিডিয়া নেই।" : "কোনো মিডিয়া অ্যাসেট পাওয়া যায়নি।"}
        </div>
      ) : (
        <div
          className={`grid gap-2.5 ${
            compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
          }`}
        >
          {filtered.map((asset) => (
            <div
              key={asset.id}
              className="group flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-2.5 shadow-xs transition hover:border-primary/40"
            >
              <div>
                <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-xl bg-muted/50 p-2">
                  <img
                    src={asset.url}
                    alt={asset.name}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain"
                  />
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {TYPE_LABELS[asset.type] || asset.type}
                  </span>
                  {asset.isSystemProtected && (
                    <span
                      title="সিস্টেম সুরক্ষিত অ্যাসেট"
                      className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white shadow"
                    >
                      <Lock className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>

                <p className="mt-2 truncate text-xs font-bold text-foreground">{asset.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatBytes(asset.sizeBytes)}
                  {asset.width && asset.height ? ` • ${asset.width}×${asset.height}` : ""}
                </p>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1 pt-1.5 border-t border-border/50">
                {onSelectAsset && viewTab === "active" && (
                  <button
                    type="button"
                    onClick={() => onSelectAsset(asset)}
                    className="flex-1 rounded-lg bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground hover:opacity-95"
                  >
                    ব্যবহার করুন
                  </button>
                )}

                {viewTab === "active" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(asset)}
                      title="URL কপি করুন"
                      className="rounded-lg bg-muted p-1.5 text-muted-foreground hover:text-foreground"
                    >
                      {copiedId === asset.id ? (
                        <Check className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReplaceTargetId(asset.id);
                        replaceInputRef.current?.click();
                      }}
                      title="প্রতিস্থাপন (Replace)"
                      className="rounded-lg bg-muted p-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                    {!asset.isSystemProtected && (
                      <button
                        type="button"
                        onClick={() =>
                          void trashMediaAsset(asset.id)
                            .then(() => toast.success("মিডিয়া ট্র্যাশে পাঠানো হয়েছে"))
                            .catch((err) => toast.error(err?.message))
                        }
                        title="ট্র্যাশে সরান"
                        className="rounded-lg bg-rose-500/10 p-1.5 text-rose-600 hover:bg-rose-500/20"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        void restoreMediaAsset(asset.id)
                          .then(() => toast.success("মিডিয়া পুনরুদ্ধার হয়েছে"))
                          .catch((err) => toast.error(err?.message))
                      }
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-800"
                    >
                      <RotateCcw className="h-3 w-3" /> পুনরুদ্ধার
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmPermDelete(asset)}
                      className="rounded-lg bg-rose-600 px-2 py-1 text-[10px] font-bold text-white"
                    >
                      স্থায়ী ডিলিট
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Permanent Delete Modal */}
      {confirmPermDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setConfirmPermDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-card p-5 shadow-elevated space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="font-display text-sm font-bold text-rose-700">
              স্থায়ীভাবে মিডিয়া মুছে ফেলবেন?
            </h4>
            <p className="text-xs text-muted-foreground">
              "{confirmPermDelete.name}" স্থায়ীভাবে মুছে ফেলা হলে পূর্বের কোনো ক্যাটাগরি বা ব্যানারে এই লিংক ব্যবহার থাকলে তা দেখা যাবে না।
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmPermDelete(null)}
                className="rounded-full bg-muted px-4 py-1.5 text-xs font-semibold"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = confirmPermDelete.id;
                  setConfirmPermDelete(null);
                  void permanentlyDeleteMediaAsset(id)
                    .then(() => toast.success("মিডিয়া স্থায়ীভাবে মুছে ফেলা হয়েছে"))
                    .catch((err) => toast.error(err?.message));
                }}
                className="rounded-full bg-rose-600 px-4 py-1.5 text-xs font-bold text-white"
              >
                স্থায়ীভাবে মুছুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MediaPickerModal({
  open,
  onClose,
  onSelect,
  title = "মিডিয়া লাইব্রেরি থেকে নির্বাচন বা আপলোড করুন",
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, asset: MediaAssetRecord) => void;
  title?: string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-3xl bg-background p-4 sm:p-5 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-display text-sm font-bold text-primary-deep">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-muted p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pr-1">
          <MediaLibraryManager
            compact
            onSelectAsset={(asset) => {
              onSelect(asset.url, asset);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
