import { useMemo, useState } from "react";
import {
  Search,
  CheckCircle2,
  Image as ImageIcon,
  RotateCcw,
  Trash2,
  X,
  Sparkles,
  Layers,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  BUILTIN_CATEGORY_ICON_ITEMS,
  getBuiltInCategoryIconUrl,
} from "@/data/categoryIcons";
import { CATEGORY_ICONS } from "@/data/categories";
import type { CategoryConfigItem } from "@/lib/store";
import { UniversalImageUploader } from "@/components/UniversalImageUploader";

type IconLibraryTab = "all" | "active_png" | "custom_upload" | "vector_only";

export interface CategoryIconLibraryPanelProps {
  rawItems: CategoryConfigItem[];
  onAssignIcon: (
    slug: string,
    customIconUrl: string,
    iconCleared?: boolean
  ) => Promise<void>;
}

export function CategoryIconLibraryPanel({
  rawItems,
  onAssignIcon,
}: CategoryIconLibraryPanelProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<IconLibraryTab>("all");
  const [targetSlug, setTargetSlug] = useState<string>(
    rawItems[0]?.slug || ""
  );
  const [busySlug, setBusySlug] = useState<string | null>(null);

  const categoryBySlug = useMemo(() => {
    const map = new Map<string, CategoryConfigItem>();
    for (const c of rawItems) {
      map.set(c.slug, c);
    }
    return map;
  }, [rawItems]);

  const effectiveTargetSlug = useMemo(() => {
    if (targetSlug && categoryBySlug.has(targetSlug)) return targetSlug;
    return rawItems[0]?.slug || "";
  }, [targetSlug, categoryBySlug, rawItems]);

  const selectedTargetCat = categoryBySlug.get(effectiveTargetSlug);

  const stats = useMemo(() => {
    let usingBuiltInPng = 0;
    let usingCustomIcon = 0;
    let usingVector = 0;

    for (const c of rawItems) {
      const builtIn = getBuiltInCategoryIconUrl(c.slug);
      const url = c.customIconUrl?.trim() || "";
      if (c.iconCleared || !url) {
        usingVector++;
      } else if (builtIn && url === builtIn) {
        usingBuiltInPng++;
      } else {
        usingCustomIcon++;
      }
    }

    return {
      totalBuiltIn: BUILTIN_CATEGORY_ICON_ITEMS.length,
      usingBuiltInPng,
      usingCustomIcon,
      usingVector,
    };
  }, [rawItems]);

  const filteredBuiltInIcons = useMemo(() => {
    const q = search.trim().toLowerCase();
    return BUILTIN_CATEGORY_ICON_ITEMS.filter((item) => {
      const matchedCat = categoryBySlug.get(item.slug);
      if (activeTab === "active_png") {
        if (
          !matchedCat ||
          matchedCat.iconCleared ||
          matchedCat.customIconUrl?.trim() !== item.url
        ) {
          return false;
        }
      }
      if (!q) return true;
      return (
        item.slug.toLowerCase().includes(q) ||
        item.filename.toLowerCase().includes(q) ||
        (matchedCat?.bn || "").toLowerCase().includes(q) ||
        (matchedCat?.en || "").toLowerCase().includes(q)
      );
    });
  }, [search, activeTab, categoryBySlug]);

  const filteredCustomOrVectorCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rawItems.filter((c) => {
      const builtIn = getBuiltInCategoryIconUrl(c.slug);
      const url = c.customIconUrl?.trim() || "";
      const isVector = Boolean(c.iconCleared || !url);
      const isCustom = Boolean(!c.iconCleared && url && url !== builtIn);

      if (activeTab === "custom_upload" && !isCustom) return false;
      if (activeTab === "vector_only" && !isVector) return false;

      if (!q) return true;
      return (
        (c.slug || "").toLowerCase().includes(q) ||
        (c.bn || "").toLowerCase().includes(q) ||
        (c.en || "").toLowerCase().includes(q)
      );
    });
  }, [rawItems, search, activeTab]);

  async function handleAssign(
    slug: string,
    url: string,
    iconCleared = false,
    successText?: string
  ) {
    if (!slug) return;
    setBusySlug(slug);
    try {
      await onAssignIcon(slug, url, iconCleared);
      toast.success(
        successText || "আইকন সফলভাবে ক্যাটাগরিতে সংরক্ষণ করা হয়েছে!"
      );
    } catch (err: any) {
      toast.error(err?.message || "আইকন সংরক্ষণ করা যায়নি");
    } finally {
      setBusySlug(null);
    }
  }

  return (
    <div className="space-y-4 rounded-3xl border border-[#E6E1D6] bg-card p-4 sm:p-5 shadow-card">
      {/* Header & Metrics */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-primary-deep">
            <Layers className="h-4 w-4 text-primary" />
            ক্যাটাগরি আইকন ম্যানেজমেন্ট ও লাইব্রেরি ({stats.totalBuiltIn}টি বিল্ট-ইন PNG)
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ৫১২×৫১২ ফ্ল্যাট PNG, কাস্টম PNG/SVG/JPG/WebP আপলোড, ১-ক্লিক রিসেট ও তাৎক্ষণিক অ্যাসাইনমেন্ট।
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
          <span className="rounded-xl bg-emerald-500/12 px-2.5 py-1 text-emerald-800 dark:text-emerald-300">
            বিল্ট-ইন PNG সক্রিয়: {stats.usingBuiltInPng}টি
          </span>
          <span className="rounded-xl bg-blue-500/12 px-2.5 py-1 text-blue-800 dark:text-blue-300">
            কাস্টম আপলোড: {stats.usingCustomIcon}টি
          </span>
          <span className="rounded-xl bg-amber-500/12 px-2.5 py-1 text-amber-800 dark:text-amber-300">
            ভেক্টর ডিফল্ট: {stats.usingVector}টি
          </span>
        </div>
      </div>

      {/* Quick Target Category Assignment & Custom Upload Bar */}
      <div className="rounded-2xl border border-primary/20 bg-[#FAF7F2] dark:bg-muted/20 p-3.5">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <label className="text-[11px] font-bold text-muted-foreground">
              টার্গেট ক্যাটাগরি নির্বাচন করুন (আইকন অ্যাসাইন বা আপলোডের জন্য)
            </label>
            <select
              value={effectiveTargetSlug}
              onChange={(e) => setTargetSlug(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
            >
              {rawItems.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.bn} ({c.slug})
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-5">
            <label className="text-[11px] font-bold text-muted-foreground">
              কাস্টম আইকন আপলোড (PNG, SVG, JPG, WebP)
            </label>
            {selectedTargetCat && (
              <div className="mt-1">
                <UniversalImageUploader
                  variant="inline"
                  category="category"
                  entityId={selectedTargetCat.slug}
                  value={
                    selectedTargetCat.iconCleared
                      ? null
                      : selectedTargetCat.customIconUrl || null
                  }
                  autoDeleteOld={false}
                  hint="৫১২×৫১২ পিক্সেল স্বচ্ছ ব্যাকগ্রাউন্ড সাপোর্টেড"
                  onChange={(url) => {
                    if (url) {
                      void handleAssign(
                        selectedTargetCat.slug,
                        url,
                        false,
                        `"${selectedTargetCat.bn}"-এ নতুন আইকন সেট হয়েছে`
                      );
                    } else {
                      void handleAssign(
                        selectedTargetCat.slug,
                        "",
                        true,
                        `"${selectedTargetCat.bn}" আইকন মুছে ভেক্টরে নেওয়া হয়েছে`
                      );
                    }
                  }}
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 lg:col-span-2 lg:justify-end">
            {selectedTargetCat &&
              getBuiltInCategoryIconUrl(selectedTargetCat.slug) && (
                <button
                  type="button"
                  disabled={busySlug === selectedTargetCat.slug}
                  onClick={() => {
                    const url = getBuiltInCategoryIconUrl(
                      selectedTargetCat.slug
                    );
                    if (url) {
                      void handleAssign(
                        selectedTargetCat.slug,
                        url,
                        false,
                        `"${selectedTargetCat.bn}"-এ ডিফল্ট PNG পুনঃস্থাপন হয়েছে`
                      );
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-emerald-600/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" /> ডিফল্ট PNG
                </button>
              )}
            {selectedTargetCat && (
              <button
                type="button"
                disabled={busySlug === selectedTargetCat.slug}
                onClick={() =>
                  void handleAssign(
                    selectedTargetCat.slug,
                    "",
                    true,
                    `"${selectedTargetCat.bn}"-এ ভেক্টর আইকন সক্রিয় করা হয়েছে`
                  )
                }
                className="inline-flex items-center gap-1 rounded-xl border border-rose-500/25 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-500/20 disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" /> ভেক্টর রাখুন
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {[
            {
              id: "all" as const,
              label: `সকল বিল্ট-ইন PNG (${stats.totalBuiltIn})`,
            },
            {
              id: "active_png" as const,
              label: `নিযুক্ত PNG (${stats.usingBuiltInPng})`,
            },
            {
              id: "custom_upload" as const,
              label: `কাস্টম আপলোড (${stats.usingCustomIcon})`,
            },
            {
              id: "vector_only" as const,
              label: `ভেক্টর / আইকন-ছাড়া (${stats.usingVector})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                activeTab === tab.id
                  ? "bg-[#0F4D3A] text-white shadow-xs"
                  : "border border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ফাইলনাম, স্লাগ বা বাংলা নাম খুঁজুন..."
            className="w-full rounded-xl border border-border bg-background py-1.5 pl-8 pr-3 text-xs"
          />
        </div>
      </div>

      {/* Grid View: Built-in PNGs vs Custom/Vector Categories */}
      {activeTab === "all" || activeTab === "active_png" ? (
        filteredBuiltInIcons.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            আপনার খোঁজা শর্ত অনুযায়ী কোনো বিল্ট-ইন PNG আইকন পাওয়া যায়নি।
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filteredBuiltInIcons.map((item) => {
              const matchedCat = categoryBySlug.get(item.slug);
              const isMatchedUsingIt = Boolean(
                matchedCat &&
                  !matchedCat.iconCleared &&
                  matchedCat.customIconUrl?.trim() === item.url
              );
              const isTargetUsingIt = Boolean(
                selectedTargetCat &&
                  !selectedTargetCat.iconCleared &&
                  selectedTargetCat.customIconUrl?.trim() === item.url
              );

              return (
                <div
                  key={item.slug}
                  className={`flex flex-col justify-between rounded-2xl border p-2.5 transition ${
                    isMatchedUsingIt
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-[#E6E1D6] bg-background"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1">
                      <div className="aspect-square h-12 w-12 shrink-0 overflow-hidden rounded-[12px] border border-[#E6E1D6] bg-[#FAF7F2] p-1.5">
                        <img
                          src={item.url}
                          alt={item.filename}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-contain select-none"
                        />
                      </div>
                      {isMatchedUsingIt ? (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                          <CheckCircle2 className="h-2.5 w-2.5" /> সংযুক্ত
                        </span>
                      ) : matchedCat ? (
                        <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                          ওভাররাইড
                        </span>
                      ) : (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                          মুক্ত
                        </span>
                      )}
                    </div>

                    <p
                      className="mt-2 truncate font-mono text-[10px] font-semibold text-muted-foreground"
                      title={item.filename}
                    >
                      {item.filename}
                    </p>
                    <p
                      className="mt-0.5 truncate text-xs font-bold text-foreground"
                      title={matchedCat?.bn || item.slug}
                    >
                      {matchedCat?.bn || "অতিরিক্ত আইকন"}
                    </p>
                  </div>

                  <div className="mt-2.5 flex flex-col gap-1">
                    {matchedCat && !isMatchedUsingIt && (
                      <button
                        type="button"
                        disabled={busySlug === matchedCat.slug}
                        onClick={() =>
                          void handleAssign(
                            matchedCat.slug,
                            item.url,
                            false,
                            `"${matchedCat.bn}"-এ ${item.filename} সেট হয়েছে`
                          )
                        }
                        className="w-full rounded-lg bg-[#0F4D3A] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#0B3B2C] disabled:opacity-50"
                      >
                        নিজ ক্যাটাগরিতে দিন
                      </button>
                    )}

                    {selectedTargetCat &&
                      selectedTargetCat.slug !== matchedCat?.slug && (
                        <button
                          type="button"
                          disabled={
                            busySlug === selectedTargetCat.slug ||
                            isTargetUsingIt
                          }
                          onClick={() =>
                            void handleAssign(
                              selectedTargetCat.slug,
                              item.url,
                              false,
                              `"${selectedTargetCat.bn}"-এ ${item.filename} সেট হয়েছে`
                            )
                          }
                          className="w-full truncate rounded-lg border border-primary/30 bg-primary/8 px-2 py-1 text-[10px] font-bold text-primary-deep hover:bg-primary/15 disabled:opacity-50"
                          title={`${selectedTargetCat.bn}-এ সেট করুন`}
                        >
                          {isTargetUsingIt
                            ? "টার্গেটে সক্রিয়"
                            : `→ ${selectedTargetCat.bn}`}
                        </button>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : filteredCustomOrVectorCategories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          এই ফিল্টারে কোনো ক্যাটাগরি পাওয়া যায়নি।
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCustomOrVectorCategories.map((c) => {
            const IconComp =
              CATEGORY_ICONS[c.iconName] || CATEGORY_ICONS.Users;
            const builtInUrl = getBuiltInCategoryIconUrl(c.slug);
            const showImg = Boolean(!c.iconCleared && c.customIconUrl?.trim());
            return (
              <div
                key={c.slug}
                className="flex items-center justify-between gap-2.5 rounded-2xl border border-[#E6E1D6] bg-background p-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="aspect-square flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[11px] border border-[#E6E1D6] bg-[#FAF7F2] p-1.5">
                    {showImg ? (
                      <img
                        src={c.customIconUrl}
                        alt={c.bn}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <IconComp className="h-5 w-5 text-[#0F4D3A]" strokeWidth={1.6} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-foreground">
                      {c.bn}
                    </p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {c.slug}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {builtInUrl && (
                    <button
                      type="button"
                      disabled={busySlug === c.slug}
                      onClick={() =>
                        void handleAssign(
                          c.slug,
                          builtInUrl,
                          false,
                          `"${c.bn}"-এ বিল্ট-ইন PNG পুনঃস্থাপন হয়েছে`
                        )
                      }
                      title="ডিফল্ট PNG পুনঃস্থাপন"
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/12 px-2 py-1 text-[10px] font-bold text-emerald-800 hover:bg-emerald-500/20"
                    >
                      <RotateCcw className="h-3 w-3" /> PNG
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setTargetSlug(c.slug);
                      toast.info(
                        `"${c.bn}" টার্গেট হিসেবে নির্বাচিত হয়েছে — উপরের আপলোড বক্স বা যেকোনো PNG বেছে নিন।`
                      );
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary-deep hover:bg-primary/20"
                  >
                    <Upload className="h-3 w-3" /> নির্বাচন
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

export interface BuiltInIconPickerModalProps {
  open: boolean;
  onClose: () => void;
  currentSlug?: string;
  currentValue?: string;
  onSelect: (url: string) => void;
}

export function BuiltInIconPickerModal({
  open,
  onClose,
  currentSlug,
  currentValue,
  onSelect,
}: BuiltInIconPickerModalProps) {
  const [search, setSearch] = useState("");

  const matchingItem = useMemo(() => {
    if (!currentSlug) return undefined;
    const norm = currentSlug.trim().toLowerCase();
    return BUILTIN_CATEGORY_ICON_ITEMS.find((i) => i.slug === norm);
  }, [currentSlug]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return BUILTIN_CATEGORY_ICON_ITEMS;
    return BUILTIN_CATEGORY_ICON_ITEMS.filter(
      (i) =>
        i.slug.toLowerCase().includes(q) ||
        i.filename.toLowerCase().includes(q)
    );
  }, [search]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-3xl bg-card p-4 sm:p-5 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-primary-deep">
              <ImageIcon className="h-4 w-4 text-primary" />
              ১৮২টি বিল্ট-ইন ক্যাটাগরি PNG আইকন লাইব্রেরি
            </h3>
            <p className="text-xs text-muted-foreground">
              যেকোনো একটি ৫১২×৫১২ ফ্ল্যাট PNG আইকনে ক্লিক করে নির্বাচন করুন
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-muted p-2 text-muted-foreground hover:text-foreground"
            aria-label="বন্ধ করুন"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ফাইলনাম বা স্লাগ লিখুন (যেমন: hospital, ambulance, biryani)..."
              className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs"
            />
          </div>
          {matchingItem && (
            <button
              type="button"
              onClick={() => {
                onSelect(matchingItem.url);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
            >
              <Sparkles className="h-3.5 w-3.5" />
              ম্যাচিং আইকন ({matchingItem.filename}) ব্যবহার করুন
            </button>
          )}
        </div>

        <div className="mt-3 flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
            {filtered.map((item) => {
              const isSelected = currentValue?.trim() === item.url;
              return (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => {
                    onSelect(item.url);
                    onClose();
                  }}
                  className={`flex flex-col items-center rounded-2xl border p-2.5 text-center transition hover:border-primary ${
                    isSelected
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-[#E6E1D6] bg-background"
                  }`}
                >
                  <div className="aspect-square h-12 w-12 overflow-hidden rounded-[12px] border border-[#E6E1D6] bg-[#FAF7F2] p-1.5">
                    <img
                      src={item.url}
                      alt={item.filename}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <span className="mt-1.5 w-full truncate font-mono text-[10px] font-semibold text-foreground">
                    {item.slug}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
