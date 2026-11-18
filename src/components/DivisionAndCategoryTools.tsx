import React, { useMemo, useState } from "react";
import {
  Layers,
  Plus,
  Edit3,
  Trash2,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Save,
  X,
  AlertTriangle,
  CopyCheck,
  Download,
  CheckCircle2,
  Image as ImageIcon,
  ShieldAlert,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_ICONS, CATEGORY_TINTS } from "@/data/categories";
import {
  useCategories,
  useDivisions,
  type DivisionConfigItem,
} from "@/lib/store";
import { recordSuperAdminAudit } from "@/lib/staff-audit";
import { MediaPickerModal } from "@/components/MediaLibraryManager";

export function DivisionAndCategoryTools({
  selectedBulkSlugs,
  onClearBulkSelection,
  onJumpToCategory,
}: {
  selectedBulkSlugs?: string[];
  onClearBulkSelection?: () => void;
  onJumpToCategory?: (slug: string) => void;
}) {
  const {
    rawDivisions,
    trashedDivisions,
    addDivision,
    updateDivision,
    deleteDivision,
    restoreDivision,
    reorderDivisions,
  } = useDivisions();

  const {
    rawItems,
    trashedCategories,
    duplicateDiagnostics,
    updateCategory,
    restoreCategory,
    permanentlyDeleteCategory,
    bulkDeleteCategories,
    cleanupDuplicateCategories,
    exportCategoriesBackupJson,
  } = useCategories();

  const [activeToolTab, setActiveToolTab] = useState<
    "divisions" | "duplicates" | "trash"
  >("divisions");

  // Division Add / Edit / Delete states
  const [showDivPanel, setShowDivPanel] = useState(false);
  const [showAddDiv, setShowAddDiv] = useState(false);
  const [newDiv, setNewDiv] = useState({
    id: "",
    bn: "",
    en: "",
    iconName: "Layers",
    tint: CATEGORY_TINTS[0].value,
    description: "",
    customIconUrl: "",
  });
  const [editingDivId, setEditingDivId] = useState<string | null>(null);
  const [divDraft, setDivDraft] = useState<Partial<DivisionConfigItem>>({});
  const [divToDelete, setDivToDelete] = useState<DivisionConfigItem | null>(null);
  const [divBusy, setDivBusy] = useState(false);

  // Media Picker target
  const [mediaPickerTarget, setMediaPickerTarget] = useState<
    "new_div" | "edit_div" | null
  >(null);

  // Duplicate cleanup / Category Trash / Bulk Delete states
  const [cleaningAliases, setCleaningAliases] = useState(false);
  const [permDeleteSlug, setPermDeleteSlug] = useState<string | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkConfirmChecked, setBulkConfirmChecked] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const categoryCountByDivision = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of rawItems) {
      const divKey = c.divisionId || c.departmentId || "emergency_essentials";
      map.set(divKey, (map.get(divKey) || 0) + 1);
    }
    return map;
  }, [rawItems]);

  const sortedDivisions = useMemo(
    () => [...rawDivisions].sort((a, b) => a.sort_order - b.sort_order),
    [rawDivisions]
  );

  const totalIssuesCount =
    duplicateDiagnostics.aliasDocIds.length +
    duplicateDiagnostics.sameDivisionDuplicates.length +
    duplicateDiagnostics.unassignedOrInvalidDivision.length;

  async function handleAddDivision(e: React.FormEvent) {
    e.preventDefault();
    if (!newDiv.id.trim() || !newDiv.bn.trim()) {
      return toast.error("বিভাগের ইংরেজি ID ও বাংলা নাম আবশ্যক");
    }
    setDivBusy(true);
    try {
      const created = await addDivision({
        id: newDiv.id.trim(),
        bn: newDiv.bn.trim(),
        en: newDiv.en.trim() || newDiv.id.trim(),
        iconName: newDiv.iconName,
        tint: newDiv.tint,
        description: newDiv.description.trim(),
        visible: true,
        customIconUrl: newDiv.customIconUrl.trim() || undefined,
      });
      void recordSuperAdminAudit({
        action: "create",
        module: "divisions",
        target_id: created.id,
        target_label: created.bn,
        summary: `নতুন প্রধান বিভাগ তৈরি করা হয়েছে: ${created.bn}`,
      });
      toast.success(`"${created.bn}" বিভাগ সফলভাবে যুক্ত হয়েছে!`);
      setNewDiv({
        id: "",
        bn: "",
        en: "",
        iconName: "Layers",
        tint: CATEGORY_TINTS[0].value,
        description: "",
        customIconUrl: "",
      });
      setShowAddDiv(false);
    } catch (err: any) {
      toast.error(err?.message || "বিভাগ যোগ করা যায়নি");
    } finally {
      setDivBusy(false);
    }
  }

  async function handleSaveDivisionEdit(id: string) {
    setDivBusy(true);
    try {
      await updateDivision(id, divDraft);
      void recordSuperAdminAudit({
        action: "update",
        module: "divisions",
        target_id: id,
        target_label: divDraft.bn || id,
        summary: `বিভাগ আপডেট করা হয়েছে (${id})`,
      });
      setEditingDivId(null);
      toast.success("বিভাগ সফলভাবে আপডেট হয়েছে!");
    } catch (err: any) {
      toast.error(err?.message || "আপডেট ব্যর্থ");
    } finally {
      setDivBusy(false);
    }
  }

  async function handleConfirmDeleteDivision(hardDelete: boolean) {
    if (!divToDelete) return;
    setDivBusy(true);
    try {
      await deleteDivision(divToDelete.id, {
        softDeleteOnly: !hardDelete,
        hardDelete,
      });
      void recordSuperAdminAudit({
        action: hardDelete ? "delete" : "trash",
        module: "divisions",
        target_id: divToDelete.id,
        target_label: divToDelete.bn,
        summary: hardDelete
          ? `বিভাগ স্থায়ীভাবে মুছে ফেলা হয়েছে: ${divToDelete.bn}`
          : `বিভাগ ট্র্যাশে পাঠানো হয়েছে: ${divToDelete.bn}`,
      });
      toast.success(
        hardDelete
          ? `"${divToDelete.bn}" স্থায়ীভাবে মুছে ফেলা হয়েছে`
          : `"${divToDelete.bn}" ট্র্যাশে স্থানান্তর করা হয়েছে`
      );
      setDivToDelete(null);
    } catch (err: any) {
      toast.error(err?.message || "বিভাগ মোছা যায়নি");
    } finally {
      setDivBusy(false);
    }
  }

  async function handleCleanupAliases() {
    if (duplicateDiagnostics.aliasDocIds.length === 0) return;
    setCleaningAliases(true);
    try {
      const ids = duplicateDiagnostics.aliasDocIds.map((a) => a.docId);
      const res = await cleanupDuplicateCategories(ids);
      void recordSuperAdminAudit({
        action: "cleanup",
        module: "categories",
        target_id: "duplicate_aliases",
        target_label: `${res.removed} alias docs`,
        summary: `${res.removed}টি অপ্রয়োজনীয় ডুপ্লিকেট ক্যাটাগরি ডকুমেন্ট পরিষ্কার করা হয়েছে`,
      });
      toast.success(`${res.removed}টি ডুপ্লিকেট এলিয়াস ডকুমেন্ট পরিষ্কার করা হয়েছে!`);
    } catch (err: any) {
      toast.error(err?.message || "ক্লিনআপ ব্যর্থ হয়েছে");
    } finally {
      setCleaningAliases(false);
    }
  }

  async function handleBulkDelete(softDeleteOnly: boolean) {
    if (!selectedBulkSlugs?.length || !bulkConfirmChecked) return;
    setBulkBusy(true);
    try {
      const res = await bulkDeleteCategories(selectedBulkSlugs, {
        softDeleteOnly,
        force: !softDeleteOnly,
      });
      void recordSuperAdminAudit({
        action: softDeleteOnly ? "trash" : "delete",
        module: "categories",
        target_id: `bulk_${res.deleted}`,
        target_label: `${res.deleted}টি ক্যাটাগরি`,
        summary: `${res.deleted}টি নির্বাচিত ক্যাটাগরি একসাথে ডিলিট/আর্কাইভ করা হয়েছে`,
      });
      toast.success(`${res.deleted}টি ক্যাটাগরি সফলভাবে সরানো হয়েছে`);
      onClearBulkSelection?.();
      setShowBulkDeleteModal(false);
      setBulkConfirmChecked(false);
    } catch (err: any) {
      toast.error(err?.message || "বাল্ক ডিলিট ব্যর্থ");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Top Action / Summary Strip */}
      <div className="rounded-3xl border border-primary/20 bg-card p-4 shadow-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 font-display text-sm font-bold text-primary-deep">
              <Layers className="h-4 w-4 text-primary" /> প্রধান বিভাগ ({sortedDivisions.length}টি), ডুপ্লিকেট ক্লিনআপ ও ট্র্যাশ
            </h3>
            <p className="text-[11px] text-muted-foreground">
              বিভাগ যোগ/রিমুভ/অর্ডার, ডুপ্লিকেট ডকুমেন্ট যাচাই ও ব্যাকআপ ডাউনলোড
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedBulkSlugs && selectedBulkSlugs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setBulkConfirmChecked(false);
                  setShowBulkDeleteModal(true);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow"
              >
                <Trash2 className="h-3.5 w-3.5" /> নির্বাচিত মুছুন ({selectedBulkSlugs.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                exportCategoriesBackupJson();
                toast.success("ক্যাটাগরি JSON ব্যাকআপ ডাউনলোড হয়েছে");
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5" /> JSON ব্যাকআপ
            </button>
            <button
              type="button"
              onClick={() => setShowDivPanel((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary-deep hover:bg-primary/20"
            >
              {showDivPanel ? "প্যানেল লুকান" : "পরিচালনা খুলুন"}
            </button>
          </div>
        </div>

        {/* Status pills row */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => {
              setActiveToolTab("divisions");
              setShowDivPanel(true);
            }}
            className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
              activeToolTab === "divisions" && showDivPanel
                ? "bg-gradient-hero text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            প্রধান বিভাগ ({sortedDivisions.length}টি)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveToolTab("duplicates");
              setShowDivPanel(true);
            }}
            className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
              activeToolTab === "duplicates" && showDivPanel
                ? "bg-amber-600 text-white"
                : totalIssuesCount > 0
                  ? "bg-amber-500/15 text-amber-800"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            ডুপ্লিকেট অডিট {totalIssuesCount > 0 ? `(${totalIssuesCount})` : "✓"}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveToolTab("trash");
              setShowDivPanel(true);
            }}
            className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
              activeToolTab === "trash" && showDivPanel
                ? "bg-rose-600 text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            ক্যাটাগরি ট্র্যাশ ({trashedCategories.length})
          </button>
        </div>

        {showDivPanel && (
          <div className="pt-2 border-t border-border/60">
            {/* TAB 1: Main Divisions CRUD */}
            {activeToolTab === "divisions" && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-primary-deep">
                    সবগুলো প্রধান সেকশন (Main Divisions) পরিচালনা করুন
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddDiv((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-full bg-gradient-hero px-3 py-1 text-xs font-bold text-primary-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" /> নতুন বিভাগ
                  </button>
                </div>

                {showAddDiv && (
                  <form
                    onSubmit={handleAddDivision}
                    className="space-y-2.5 rounded-2xl border border-primary/30 bg-primary/5 p-3.5"
                  >
                    <p className="text-xs font-bold text-primary-deep">নতুন প্রধান বিভাগ যোগ করুন</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        value={newDiv.id}
                        onChange={(e) => setNewDiv({ ...newDiv, id: e.target.value })}
                        placeholder="বিভাগ ID * (ইংরেজি, যেমন: tourism_parks)"
                        className="rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs"
                      />
                      <input
                        value={newDiv.bn}
                        onChange={(e) => setNewDiv({ ...newDiv, bn: e.target.value })}
                        placeholder="বাংলা নাম * (যেমন: পর্যটন ও বিনোদন)"
                        className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
                      />
                      <input
                        value={newDiv.en}
                        onChange={(e) => setNewDiv({ ...newDiv, en: e.target.value })}
                        placeholder="ইংরেজি নাম (Tourism & Parks)"
                        className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
                      />
                      <input
                        value={newDiv.description}
                        onChange={(e) => setNewDiv({ ...newDiv, description: e.target.value })}
                        placeholder="সংক্ষিপ্ত বিবরণ"
                        className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
                      />
                      <select
                        value={newDiv.iconName}
                        onChange={(e) => setNewDiv({ ...newDiv, iconName: e.target.value })}
                        className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
                      >
                        {Object.keys(CATEGORY_ICONS).map((k) => (
                          <option key={k} value={k}>
                            আইকন: {k}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-1.5">
                        <input
                          value={newDiv.customIconUrl}
                          onChange={(e) =>
                            setNewDiv({ ...newDiv, customIconUrl: e.target.value })
                          }
                          placeholder="কাস্টম আইকন URL (ঐচ্ছিক)"
                          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setMediaPickerTarget("new_div")}
                          className="rounded-xl border border-border bg-card px-2.5 text-xs font-semibold hover:bg-muted"
                          title="মিডিয়া লাইব্রেরি থেকে নিন"
                        >
                          <ImageIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={divBusy}
                        className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
                      >
                        <Save className="h-3.5 w-3.5" /> বিভাগ যোগ করুন
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddDiv(false)}
                        className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold"
                      >
                        বাতিল
                      </button>
                    </div>
                  </form>
                )}

                <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
                  {sortedDivisions.map((d, idx) => {
                    const count = categoryCountByDivision.get(d.id) || 0;
                    const IconComp = CATEGORY_ICONS[d.iconName] || Layers;
                    const isEditing = editingDivId === d.id;

                    if (isEditing) {
                      return (
                        <div
                          key={d.id}
                          className="space-y-2 rounded-2xl border border-primary/40 bg-muted/30 p-3"
                        >
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <input
                              value={divDraft.bn ?? ""}
                              onChange={(e) => setDivDraft({ ...divDraft, bn: e.target.value })}
                              placeholder="বাংলা নাম"
                              className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-semibold"
                            />
                            <input
                              value={divDraft.en ?? ""}
                              onChange={(e) => setDivDraft({ ...divDraft, en: e.target.value })}
                              placeholder="ইংরেজি নাম"
                              className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs"
                            />
                            <input
                              value={divDraft.description ?? ""}
                              onChange={(e) =>
                                setDivDraft({ ...divDraft, description: e.target.value })
                              }
                              placeholder="বিবরণ"
                              className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs"
                            />
                            <div className="flex gap-1.5">
                              <input
                                value={divDraft.customIconUrl ?? ""}
                                onChange={(e) =>
                                  setDivDraft({ ...divDraft, customIconUrl: e.target.value })
                                }
                                placeholder="কাস্টম আইকন URL"
                                className="flex-1 rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => setMediaPickerTarget("edit_div")}
                                className="rounded-xl border border-border bg-card px-2 text-xs"
                              >
                                <ImageIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={divBusy}
                              onClick={() => void handleSaveDivisionEdit(d.id)}
                              className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground"
                            >
                              সংরক্ষণ
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingDivId(null)}
                              className="rounded-full bg-muted px-3 py-1 text-xs"
                            >
                              বাতিল
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={d.id}
                        className={`flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-background p-2.5 ${
                          d.visible === false ? "opacity-55" : ""
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            {d.customIconUrl ? (
                              <img
                                src={d.customIconUrl}
                                alt={d.bn}
                                className="h-full w-full rounded-lg object-cover"
                              />
                            ) : (
                              <IconComp className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-foreground">
                              {idx + 1}. {d.bn}{" "}
                              <span className="font-mono text-[10px] font-normal text-muted-foreground">
                                ({d.id})
                              </span>
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              অন্তর্ভুক্ত ক্যাটাগরি: {count}টি
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => void reorderDivisions(d.id, "up")}
                            className="rounded-full bg-muted p-1 text-muted-foreground disabled:opacity-30"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === sortedDivisions.length - 1}
                            onClick={() => void reorderDivisions(d.id, "down")}
                            className="rounded-full bg-muted p-1 text-muted-foreground disabled:opacity-30"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void updateDivision(d.id, { visible: d.visible === false })}
                            className="rounded-full bg-muted p-1 text-muted-foreground"
                          >
                            {d.visible === false ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDivId(d.id);
                              setDivDraft({ ...d });
                            }}
                            className="rounded-full bg-primary/10 p-1 text-primary-deep"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDivToDelete(d)}
                            className="rounded-full bg-rose-500/10 p-1 text-rose-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {trashedDivisions.length > 0 && (
                  <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-3 space-y-2">
                    <p className="text-xs font-bold text-rose-800">
                      ট্র্যাশকৃত বিভাগ ({trashedDivisions.length})
                    </p>
                    <div className="space-y-1.5">
                      {trashedDivisions.map((td) => (
                        <div
                          key={td.id}
                          className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-1.5 text-xs"
                        >
                          <span className="font-semibold">{td.bn} ({td.id})</span>
                          <button
                            type="button"
                            onClick={() =>
                              void restoreDivision(td.id).then(() =>
                                toast.success(`"${td.bn}" পুনরুদ্ধার করা হয়েছে`)
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white"
                          >
                            <RotateCcw className="h-3 w-3" /> পুনরুদ্ধার
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Duplicate Category Inspector & Alias Cleanup */}
            {activeToolTab === "duplicates" && (
              <div className="space-y-3 text-xs">
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                  <p className="flex items-center gap-1.5 font-bold text-emerald-900">
                    <CheckCircle2 className="h-4 w-4" /> ডুপ্লিকেট প্রতিরোধ ব্যবস্থা সক্রিয়
                  </p>
                  <p className="mt-1 text-[11px] text-emerald-800 leading-relaxed">
                    সিস্টেম এখন ক্যানোনিকাল slug অনুযায়ী সব ক্যাটাগরি ডি-ডুপ্লিকেট করে। তবে বিভিন্ন বিভাগে থাকা একই নামের বৈধ সেবা (যেমন: <strong>বেকারি</strong>, <strong>মিষ্টি</strong>, <strong>কৃষিপণ্য</strong>, <strong>মাদ্রাসা</strong>, <strong>ডিজিটাল মার্কেটিং</strong>) আলাদা স্লাগে সুরক্ষিত আছে এবং কখনোই স্বয়ংক্রিয়ভাবে মার্জ করা হয় না।
                  </p>
                </div>

                {/* 1. Alias Doc IDs */}
                <div className="rounded-2xl border border-border p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-foreground">
                      ১. ডুপ্লিকেট এলিয়াস ডকুমেন্ট ({duplicateDiagnostics.aliasDocIds.length})
                    </p>
                    {duplicateDiagnostics.aliasDocIds.length > 0 && (
                      <button
                        type="button"
                        disabled={cleaningAliases}
                        onClick={() => void handleCleanupAliases()}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-600 px-3 py-1 text-[11px] font-bold text-white"
                      >
                        {cleaningAliases ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CopyCheck className="h-3 w-3" />
                        )}
                        নিরাপদে পরিষ্কার করুন
                      </button>
                    )}
                  </div>
                  {duplicateDiagnostics.aliasDocIds.length === 0 ? (
                    <p className="text-[11px] text-emerald-700">
                      ✓ Firestore categories কালেকশনে কোনো অতিরিক্ত এলিয়াস ডকুমেন্ট নেই।
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {duplicateDiagnostics.aliasDocIds.map((a) => (
                        <div
                          key={a.docId}
                          className="flex items-center justify-between rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px]"
                        >
                          <span className="font-mono">{a.docId}</span>
                          <span className="text-muted-foreground">→ canonical: {a.canonicalSlug}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Same Division Duplicates */}
                <div className="rounded-2xl border border-border p-3 space-y-2">
                  <p className="font-bold text-foreground">
                    ২. একই বিভাগের ভেতরে ডুপ্লিকেট নাম ({duplicateDiagnostics.sameDivisionDuplicates.length})
                  </p>
                  {duplicateDiagnostics.sameDivisionDuplicates.length === 0 ? (
                    <p className="text-[11px] text-emerald-700">
                      ✓ কোনো বিভাগের ভেতরে একই নামের ডুপ্লিকেট ক্যাটাগরি নেই।
                    </p>
                  ) : (
                    duplicateDiagnostics.sameDivisionDuplicates.map((d, i) => (
                      <div
                        key={i}
                        className="rounded-lg bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-900"
                      >
                        <strong>{d.bn}</strong> ({d.divisionId}) — slugs:{" "}
                        {d.slugs.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => onJumpToCategory?.(s)}
                            className="mr-1.5 underline font-mono"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>

                {/* 3. Unassigned / Invalid Division */}
                {duplicateDiagnostics.unassignedOrInvalidDivision.length > 0 && (
                  <div className="rounded-2xl border border-amber-500/35 bg-amber-500/5 p-3 space-y-2">
                    <p className="font-bold text-amber-900">
                      ৩. অনির্ধারিত বা ভুল বিভাগের ক্যাটাগরি ({duplicateDiagnostics.unassignedOrInvalidDivision.length})
                    </p>
                    {duplicateDiagnostics.unassignedOrInvalidDivision.map((u) => (
                      <div
                        key={u.slug}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[11px]"
                      >
                        <span>
                          <strong>{u.bn}</strong> ({u.slug}) — বর্তমান: {u.divisionId}
                        </span>
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              void updateCategory(u.slug, { divisionId: e.target.value }).then(() =>
                                toast.success(`${u.bn} বিভাগে স্থানান্তরিত হয়েছে`)
                              );
                            }
                          }}
                          className="rounded border border-border px-2 py-0.5 text-[11px]"
                        >
                          <option value="">বিভাগে নিন...</option>
                          {sortedDivisions.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.bn}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                {/* 4. Cross-division shared Bengali names (Info only, NEVER auto-merged) */}
                <div className="rounded-2xl border border-border bg-muted/30 p-3 space-y-1.5">
                  <p className="font-bold text-foreground">
                    ৪. ভিন্ন বিভাগে একই বাংলা নামের বৈধ সেবা ({duplicateDiagnostics.crossDivisionSharedNames.length})
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    এগুলো আলাদা বিভাগের নিজস্ব সেবা হওয়ায় ইচ্ছাকৃতভাবে সংরক্ষিত রাখা হয়েছে (অটো-মার্জ করা হবে না):
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {duplicateDiagnostics.crossDivisionSharedNames.map((g, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[10px] font-semibold"
                      >
                        {g.bn} ({g.entries.length} বিভাগ)
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Category Trash Bin */}
            {activeToolTab === "trash" && (
              <div className="space-y-2.5 text-xs">
                <p className="font-bold text-foreground">
                  মুছে ফেলা ক্যাটাগরি (Soft-Deleted Trash)
                </p>
                {trashedCategories.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border p-4 text-center text-muted-foreground">
                    ট্র্যাশে কোনো মুছে ফেলা ক্যাটাগরি নেই।
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {trashedCategories.map((tc) => (
                      <div
                        key={tc.slug}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-500/25 bg-rose-500/5 px-3 py-2"
                      >
                        <div>
                          <p className="font-bold text-foreground">
                            {tc.bn}{" "}
                            <span className="font-mono text-[10px] text-muted-foreground">
                              ({tc.slug})
                            </span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            বিভাগ: {tc.divisionId} {tc.deletedAt ? `• মুছে ফেলা: ${new Date(tc.deletedAt).toLocaleDateString("bn-BD")}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              void restoreCategory(tc.slug)
                                .then(() => {
                                  void recordSuperAdminAudit({
                                    action: "restore",
                                    module: "categories",
                                    target_id: tc.slug,
                                    target_label: tc.bn,
                                    summary: `ট্র্যাশ থেকে ক্যাটাগরি পুনরুদ্ধার করা হয়েছে: ${tc.bn}`,
                                  });
                                  toast.success(`"${tc.bn}" পুনরুদ্ধার করা হয়েছে!`);
                                })
                                .catch((err) => toast.error(err?.message))
                            }
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white"
                          >
                            <RotateCcw className="h-3 w-3" /> পুনরুদ্ধার
                          </button>
                          <button
                            type="button"
                            onClick={() => setPermDeleteSlug(tc.slug)}
                            className="rounded-full bg-rose-600 px-3 py-1 text-[11px] font-bold text-white"
                          >
                            স্থায়ী ডিলিট
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Division Confirmation Modal */}
      {divToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDivToDelete(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-card p-5 shadow-elevated space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="h-5 w-5" />
              <h4 className="font-display text-sm font-bold">
                বিভাগ সরানো বা ডিলিট নিশ্চিতকরণ
              </h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              বিভাগ: <strong className="text-foreground">{divToDelete.bn}</strong> ({divToDelete.id})।
              এই বিভাগে বর্তমানে <strong>{categoryCountByDivision.get(divToDelete.id) || 0}টি ক্যাটাগরি</strong> রয়েছে।
            </p>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDivToDelete(null)}
                className="rounded-full bg-muted px-3.5 py-1.5 text-xs font-semibold"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={divBusy}
                onClick={() => void handleConfirmDeleteDivision(false)}
                className="rounded-full bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white"
              >
                ট্র্যাশে পাঠান (নিরাপদ)
              </button>
              <button
                type="button"
                disabled={divBusy}
                onClick={() => void handleConfirmDeleteDivision(true)}
                className="rounded-full bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white"
              >
                স্থায়ী ডিলিট
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Category Delete Confirmation Modal */}
      {permDeleteSlug && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPermDeleteSlug(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-card p-5 shadow-elevated space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="font-display text-sm font-bold text-rose-700">
              ক্যাটাগরি স্থায়ীভাবে মুছে ফেলবেন?
            </h4>
            <p className="text-xs text-muted-foreground">
              "{permDeleteSlug}" ট্র্যাশ থেকেও স্থায়ীভাবে মুছে যাবে।
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPermDeleteSlug(null)}
                className="rounded-full bg-muted px-4 py-1.5 text-xs font-semibold"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => {
                  const s = permDeleteSlug;
                  setPermDeleteSlug(null);
                  void permanentlyDeleteCategory(s).then(() => {
                    void recordSuperAdminAudit({
                      action: "delete",
                      module: "categories",
                      target_id: s,
                      target_label: s,
                      summary: `ক্যাটাগরি স্থায়ীভাবে মুছে ফেলা হয়েছে: ${s}`,
                    });
                    toast.success("স্থায়ীভাবে মুছে ফেলা হয়েছে");
                  });
                }}
                className="rounded-full bg-rose-600 px-4 py-1.5 text-xs font-bold text-white"
              >
                স্থায়ীভাবে মুছুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Safety Confirmation Modal */}
      {showBulkDeleteModal && selectedBulkSlugs && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setShowBulkDeleteModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-card p-5 shadow-elevated space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-rose-700">
              <ShieldAlert className="h-5 w-5" />
              <h4 className="font-display text-sm font-bold">
                একাধিক ক্যাটাগরি মুছতে অতিরিক্ত নিশ্চিতকরণ
              </h4>
            </div>
            <p className="text-xs text-muted-foreground">
              আপনি মোট <strong>{selectedBulkSlugs.length}টি ক্যাটাগরি</strong> নির্বাচন করেছেন। যেসব ক্যাটাগরিতে সক্রিয় তথ্য/ডোনেশন আছে সেগুলো সাধারণ ডিলিটে সুরক্ষিত থাকবে।
            </p>
            <label className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-xs font-semibold text-rose-900">
              <input
                type="checkbox"
                checked={bulkConfirmChecked}
                onChange={(e) => setBulkConfirmChecked(e.target.checked)}
              />
              <span>
                আমি নিশ্চিত যে নির্বাচিত {selectedBulkSlugs.length}টি ক্যাটাগরি আর্কাইভ/মুছতে চাই
              </span>
            </label>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                className="rounded-full bg-muted px-4 py-1.5 text-xs font-semibold"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={!bulkConfirmChecked || bulkBusy}
                onClick={() => void handleBulkDelete(true)}
                className="rounded-full bg-amber-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40"
              >
                ট্র্যাশে পাঠান
              </button>
            </div>
          </div>
        </div>
      )}

      <MediaPickerModal
        open={Boolean(mediaPickerTarget)}
        onClose={() => setMediaPickerTarget(null)}
        onSelect={(url) => {
          if (mediaPickerTarget === "new_div") {
            setNewDiv((prev) => ({ ...prev, customIconUrl: url }));
          } else if (mediaPickerTarget === "edit_div") {
            setDivDraft((prev) => ({ ...prev, customIconUrl: url }));
          }
        }}
      />
    </div>
  );
}
