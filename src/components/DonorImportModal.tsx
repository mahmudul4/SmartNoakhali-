import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Search,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { auth, isSuperAdminEmail } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import type { DonorRow, ModerationStatus } from "@/lib/cloud";
import { recordStaffActivity, recordSuperAdminAudit } from "@/lib/staff-audit";
import {
  analyzeBloodDonorImportText,
  DEFAULT_DONOR_SOURCE_URL,
  executeBloodDonorBatchImport,
  type BloodDonorReconciliationReport,
  type DonorImportBucket,
  type ParsedDonorSourceRecord,
} from "@/lib/donor-import";

interface DonorImportModalProps {
  open: boolean;
  onClose: () => void;
  existingDonors: DonorRow[];
}

interface RowOverride {
  full_name?: string;
  last_donation_date?: string;
  include?: boolean;
}

const BUCKET_META: Record<
  DonorImportBucket,
  { label: string; badgeClass: string; desc: string }
> = {
  ready: {
    label: "প্রস্তুত নতুন",
    badgeClass: "bg-emerald-500/15 text-emerald-700",
    desc: "সকল আবশ্যক ফিল্ড যাচাইকৃত এবং ডুপ্লিকেটমুক্ত।",
  },
  already_existing: {
    label: "বিদ্যমান",
    badgeClass: "bg-blue-500/15 text-blue-700",
    desc: "ফোন নম্বর আগে থেকেই ডাটাবেজে সংরক্ষিত আছে — স্বয়ংক্রিয়ভাবে বাদ দেওয়া হবে।",
  },
  potential_duplicate: {
    label: "সম্ভাব্য ডুপ্লিকেট",
    badgeClass: "bg-amber-500/15 text-amber-800",
    desc: "নাম ও রক্তের গ্রুপ অথবা উৎস ফাইলের ফোন মিলেছে — নিশ্চিত হলে আলাদাভাবে যুক্ত করা যাবে।",
  },
  manual_review: {
    label: "ম্যানুয়াল রিভিউ",
    badgeClass: "bg-rose-500/15 text-rose-700",
    desc: "নাম অনুপস্থিত বা তারিখ অসম্পূর্ণ — সংশোধন ছাড়া ইম্পোর্ট করা হবে না।",
  },
};

export function DonorImportModal({
  open,
  onClose,
  existingDonors,
}: DonorImportModalProps) {
  const { isMainAdmin, user } = useAuth();
  const isAuthorizedSuperAdmin = Boolean(
    isMainAdmin &&
      isSuperAdminEmail(user?.email) &&
      (!auth.currentUser?.email || isSuperAdminEmail(auth.currentUser.email))
  );

  const [rawText, setRawText] = useState<string>("");
  const [sourceLabel, setSourceLabel] = useState<string>("Pasted text(2).txt");
  const [loadingSource, setLoadingSource] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<DonorImportBucket>("ready");
  const [searchQuery, setSearchQuery] = useState("");
  const [readyVisibleLimit, setReadyVisibleLimit] = useState(50);

  const [targetStatus, setTargetStatus] = useState<ModerationStatus>("approved");
  const [overrides, setOverrides] = useState<Record<number, RowOverride>>({});
  const [excludeReadyRows, setExcludeReadyRows] = useState<Record<number, boolean>>({});

  const [importing, setImporting] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [report, setReport] = useState<BloodDonorReconciliationReport | null>(null);

  async function loadDefaultSource() {
    if (!isAuthorizedSuperAdmin) return;
    setLoadingSource(true);
    setSourceError(null);
    try {
      const res = await fetch(DEFAULT_DONOR_SOURCE_URL, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`উৎস ফাইল লোড ব্যর্থ (HTTP ${res.status})`);
      }
      const txt = await res.text();
      setRawText(txt);
      setSourceLabel("Pasted text(2).txt (ডিফল্ট সংযুক্ত ফাইল)");
      setReport(null);
      setOverrides({});
      setExcludeReadyRows({});
    } catch (err: unknown) {
      setSourceError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingSource(false);
    }
  }

  useEffect(() => {
    if (open && isAuthorizedSuperAdmin && !rawText && !loadingSource) {
      void loadDefaultSource();
    }
  }, [open, isAuthorizedSuperAdmin]);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const txt = typeof reader.result === "string" ? reader.result : "";
      if (!txt.trim()) {
        toast.error("নির্বাচিত ফাইলটি খালি");
        return;
      }
      setRawText(txt);
      setSourceLabel(file.name);
      setSourceError(null);
      setReport(null);
      setOverrides({});
      setExcludeReadyRows({});
      toast.success(`${file.name} সফলভাবে লোড হয়েছে`);
    };
    reader.onerror = () => {
      toast.error("ফাইল পড়তে সমস্যা হয়েছে");
    };
    reader.readAsText(file, "utf-8");
  }

  const analysis = useMemo(() => {
    if (!rawText) return null;
    return analyzeBloodDonorImportText(rawText, existingDonors);
  }, [rawText, existingDonors]);

  // Compute the exact set of records selected for batch import
  const selectedRecordsToWrite = useMemo(() => {
    if (!analysis) return [];
    const list: ParsedDonorSourceRecord[] = [];

    for (const r of analysis.readyRecords) {
      if (!excludeReadyRows[r.rowNumber]) {
        list.push(r);
      }
    }

    for (const r of analysis.potentialDuplicateRecords) {
      if (overrides[r.rowNumber]?.include) {
        list.push(r);
      }
    }

    for (const r of analysis.manualReviewRecords) {
      const ov = overrides[r.rowNumber];
      if (!ov?.include) continue;
      const editedName = (ov.full_name ?? r.full_name).trim();
      const editedDate = (ov.last_donation_date ?? r.last_donation_date ?? "").trim();
      if (!editedName || editedName === "-" || editedName === "—") continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(editedDate)) continue;
      list.push({
        ...r,
        full_name: editedName,
        last_donation_date: editedDate,
        missingName: false,
        missingOrInvalidDate: false,
      });
    }

    return list;
  }, [analysis, excludeReadyRows, overrides]);

  const activeBucketRecords = useMemo(() => {
    if (!analysis) return [];
    const base =
      activeTab === "ready"
        ? analysis.readyRecords
        : activeTab === "already_existing"
          ? analysis.alreadyExistingRecords
          : activeTab === "potential_duplicate"
            ? analysis.potentialDuplicateRecords
            : analysis.manualReviewRecords;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((r) =>
      `${r.rowNumber} ${r.full_name} ${r.phone} ${r.blood_group} ${r.address} ${r.conflictReason ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [analysis, activeTab, searchQuery]);

  async function runImport(recordsSubset?: ParsedDonorSourceRecord[]) {
    if (!analysis || importing) return;
    if (!isAuthorizedSuperAdmin || !auth.currentUser || !isSuperAdminEmail(auth.currentUser.email)) {
      toast.error("রক্তদাতা বাল্ক ইম্পোর্ট শুধুমাত্র প্রধান সুপার অ্যাডমিনের জন্য সংরক্ষিত।");
      return;
    }
    const targetList = recordsSubset ?? selectedRecordsToWrite;
    if (targetList.length === 0) {
      toast.error("ইম্পোর্ট করার জন্য কোনো বৈধ রেকর্ড নির্বাচিত নেই");
      return;
    }

    setImporting(true);
    setProgressPct(2);
    setProgressMsg("ইম্পোর্ট শুরু হচ্ছে...");
    try {
      const res = await executeBloodDonorBatchImport({
        analysis,
        recordsToWrite: targetList,
        targetStatus,
        batchSize: 25,
        onProgress: (msg, pct) => {
          setProgressMsg(msg);
          setProgressPct(pct);
        },
      });
      setReport(res);

      void recordSuperAdminAudit({
        action: "create",
        module: "blood_donors",
        target_id: "bulk_import_pasted_text_2",
        target_label: `রক্তদাতা বাল্ক ইম্পোর্ট (${res.importedNewCount} জন)`,
        summary: `মোট ${res.totalSourceRecords} উৎসের মধ্যে ${res.importedNewCount} নতুন, ${res.alreadyExistingCount} বিদ্যমান, ${res.potentialDuplicatesCount} সম্ভাব্য ডুপ্লিকেট, ${res.manualReviewCount} ম্যানুয়াল রিভিউ, ${res.failedCount} ব্যর্থ।`,
        metadata: {
          totalSourceRecords: res.totalSourceRecords,
          importedNewCount: res.importedNewCount,
          alreadyExistingCount: res.alreadyExistingCount,
          potentialDuplicatesCount: res.potentialDuplicatesCount,
          manualReviewCount: res.manualReviewCount,
          failedCount: res.failedCount,
          targetStatus,
          verifiedFirestoreTotalAfterImport: res.verifiedFirestoreTotalAfterImport,
        },
      });

      void recordStaffActivity({
        action_type: "create",
        action_label: `বাল্ক ইম্পোর্ট: ${res.importedNewCount} জন রক্তদাতা যুক্ত করেছে`,
        module: "donors",
        module_label: "রক্তদাতা",
        target_id: "bulk_import_pasted_text_2",
        target_title: `${res.importedNewCount} জন রক্তদাতা (${sourceLabel})`,
        target_detail: `নতুন: ${res.importedNewCount}, স্কিপ: ${res.alreadyExistingCount}, ব্যর্থ: ${res.failedCount}`,
      });

      if (res.failedCount > 0) {
        toast.warning(
          `${res.importedNewCount} জন সংরক্ষিত হয়েছে, ${res.failedCount}টি রেকর্ড ব্যর্থ হয়েছে — নিচে পুনরায় চেষ্টা করুন।`
        );
      } else {
        toast.success(`${res.importedNewCount} জন রক্তদাতা সফলভাবে Firestore-এ সংরক্ষিত হয়েছে!`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "বাল্ক ইম্পোর্ট ব্যর্থ হয়েছে");
    } finally {
      setImporting(false);
    }
  }

  async function retryFailedBatches() {
    if (!analysis || !report || report.failedRecords.length === 0) return;
    const failedRowSet = new Set(report.failedRecords.map((f) => f.rowNumber));
    const retryRecords = selectedRecordsToWrite.filter((r) => failedRowSet.has(r.rowNumber));
    if (retryRecords.length === 0) {
      toast.error("পুনরায় চেষ্টার জন্য ব্যর্থ রেকর্ড পাওয়া যায়নি");
      return;
    }
    await runImport(retryRecords);
  }

  function downloadReportJson() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `blood-donor-reconciliation-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!open || !isAuthorizedSuperAdmin) return null;

  const isFirebaseSignedIn = Boolean(
    auth.currentUser?.uid && isSuperAdminEmail(auth.currentUser.email)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4"
      onClick={() => !importing && onClose()}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-card shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border bg-gradient-card px-4 py-3.5 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate font-display text-base font-bold text-primary-deep sm:text-lg">
              রক্তদাতা বাল্ক ইম্পোর্ট ও রিকনসিলিয়েশন
            </h2>
            <p className="truncate text-xs text-muted-foreground">
              উৎস: {sourceLabel} • ছবি খালি রাখা হয়েছে (পরে আপলোডের জন্য)
            </p>
          </div>
          <button
            type="button"
            disabled={importing}
            onClick={onClose}
            className="rounded-full bg-muted p-2 text-muted-foreground hover:bg-muted/80 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {/* Source Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={loadingSource || importing}
                onClick={() => void loadDefaultSource()}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary-deep hover:bg-primary/20 disabled:opacity-50"
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${loadingSource ? "animate-spin" : ""}`} />
                সংযুক্ত ফাইল লোড
              </button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted/50">
                <Upload className="h-3.5 w-3.5" />
                অন্য .txt ফাইল নির্বাচন
                <input
                  type="file"
                  accept=".txt,.csv,text/plain"
                  className="hidden"
                  disabled={importing}
                  onChange={handleFileUpload}
                />
              </label>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">ইম্পোর্ট স্ট্যাটাস:</span>
              <select
                value={targetStatus}
                disabled={importing}
                onChange={(e) => setTargetStatus(e.target.value as ModerationStatus)}
                className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-bold text-primary-deep"
              >
                <option value="approved">সরাসরি অনুমোদিত (Approved)</option>
                <option value="pending">অপেক্ষমাণ (Pending)</option>
              </select>
            </div>
          </div>

          {!isFirebaseSignedIn && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-bold">সক্রিয় সুপার অ্যাডমিন Firebase সেশন পাওয়া যায়নি</p>
                <p>
                  প্রিভিউ ও যাচাই চলছে, তবে Firestore-এ সংরক্ষণ করতে প্রধান সুপার অ্যাডমিন অ্যাকাউন্টে পাসওয়ার্ড দিয়ে সাইন-ইন থাকা প্রয়োজন।
                </p>
              </div>
            </div>
          )}

          {sourceError && (
            <div className="flex items-center gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {sourceError}
            </div>
          )}

          {loadingSource && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              উৎস ফাইল বিশ্লেষণ করা হচ্ছে...
            </div>
          )}

          {analysis && (
            <>
              {/* Reconciliation Summary Strip */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                <div className="rounded-2xl border border-border bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">মোট রেকর্ড</p>
                  <p className="font-display text-lg font-bold text-foreground">
                    {analysis.totalSourceRecords}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <p className="text-[11px] text-emerald-700">প্রস্তুত নতুন</p>
                  <p className="font-display text-lg font-bold text-emerald-700">
                    {analysis.readyRecords.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3">
                  <p className="text-[11px] text-blue-700">বিদ্যমান (স্কিপ)</p>
                  <p className="font-display text-lg font-bold text-blue-700">
                    {analysis.alreadyExistingRecords.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-[11px] text-amber-800">সম্ভাব্য ডুপ্লিকেট</p>
                  <p className="font-display text-lg font-bold text-amber-800">
                    {analysis.potentialDuplicateRecords.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3">
                  <p className="text-[11px] text-rose-700">ম্যানুয়াল রিভিউ</p>
                  <p className="font-display text-lg font-bold text-rose-700">
                    {analysis.manualReviewRecords.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/40 p-3">
                  <p className="text-[11px] text-muted-foreground">নির্বাচিত রাইট</p>
                  <p className="font-display text-lg font-bold text-primary-deep">
                    {selectedRecordsToWrite.length}
                  </p>
                </div>
              </div>

              {/* Post-Import Reconciliation Report */}
              {report && (
                <div className="space-y-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <h3 className="font-display text-sm font-bold text-emerald-800">
                        ইম্পোর্ট রিকনসিলিয়েশন রিপোর্ট ({report.reconciled ? "১০০% মিলিত" : "আংশিক"})
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={downloadReportJson}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-bold hover:bg-muted"
                    >
                      <Download className="h-3.5 w-3.5" /> JSON রিপোর্ট
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div className="rounded-xl bg-background p-2.5">
                      <span className="text-muted-foreground">নতুন ইম্পোর্ট:</span>{" "}
                      <strong className="text-emerald-700">{report.importedNewCount}</strong>
                    </div>
                    <div className="rounded-xl bg-background p-2.5">
                      <span className="text-muted-foreground">বিদ্যমান স্কিপ:</span>{" "}
                      <strong className="text-blue-700">{report.alreadyExistingCount}</strong>
                    </div>
                    <div className="rounded-xl bg-background p-2.5">
                      <span className="text-muted-foreground">সম্ভাব্য ডুপ্লিকেট:</span>{" "}
                      <strong className="text-amber-800">{report.potentialDuplicatesCount}</strong>
                    </div>
                    <div className="rounded-xl bg-background p-2.5">
                      <span className="text-muted-foreground">ম্যানুয়াল/ব্যর্থ:</span>{" "}
                      <strong className="text-rose-700">
                        {report.manualReviewCount} / {report.failedCount}
                      </strong>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    ছবি খালি নিশ্চিত: {report.photosLeftEmptyConfirmed ? "হ্যাঁ" : "না"} • যাচাইকৃত Firestore মোট রক্তদাতা:{" "}
                    <strong>{report.verifiedFirestoreTotalAfterImport ?? "—"}</strong>
                  </p>

                  {report.failedRecords.length > 0 && (
                    <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold text-destructive">
                          {report.failedRecords.length}টি রেকর্ড সংরক্ষণে ব্যর্থ হয়েছে:
                        </p>
                        <button
                          type="button"
                          disabled={importing}
                          onClick={() => void retryFailedBatches()}
                          className="inline-flex items-center gap-1 rounded-full bg-destructive px-3 py-1 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3 w-3" /> ব্যর্থ ব্যাচ পুনরায় চেষ্টা
                        </button>
                      </div>
                      <ul className="max-h-28 space-y-1 overflow-y-auto text-[11px] text-destructive">
                        {report.failedRecords.slice(0, 20).map((f) => (
                          <li key={f.rowNumber}>
                            সারি #{f.rowNumber} ({f.full_name} — {f.phone}): {f.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Progress Bar */}
              {importing && (
                <div className="space-y-1.5 rounded-2xl border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-primary-deep">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {progressMsg}
                    </span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Bucket Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {(["ready", "already_existing", "potential_duplicate", "manual_review"] as DonorImportBucket[]).map(
                    (b) => {
                      const count =
                        b === "ready"
                          ? analysis.readyRecords.length
                          : b === "already_existing"
                            ? analysis.alreadyExistingRecords.length
                            : b === "potential_duplicate"
                              ? analysis.potentialDuplicateRecords.length
                              : analysis.manualReviewRecords.length;
                      const active = activeTab === b;
                      return (
                        <button
                          key={b}
                          type="button"
                          onClick={() => {
                            setActiveTab(b);
                            setReadyVisibleLimit(50);
                          }}
                          className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                            active
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {BUCKET_META[b].label} ({count})
                        </button>
                      );
                    }
                  )}
                </div>

                <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="সারি, নাম, ফোন বা ঠিকানা..."
                    className="w-full rounded-xl border border-border bg-background py-1.5 pl-8 pr-3 text-xs"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {BUCKET_META[activeTab].desc}
              </p>

              {/* Records List */}
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-border bg-background/60 p-2.5">
                {activeBucketRecords.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    এই বিভাগে কোনো রেকর্ড নেই।
                  </div>
                ) : (
                  activeBucketRecords
                    .slice(0, activeTab === "ready" ? readyVisibleLimit : 200)
                    .map((rec) => {
                      const ov = overrides[rec.rowNumber] ?? {};
                      const readyIncluded = !excludeReadyRows[rec.rowNumber];
                      return (
                        <div
                          key={rec.rowNumber}
                          className="rounded-xl border border-border bg-card p-3 text-xs shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold">
                                  সারি #{rec.rowNumber}
                                </span>
                                <span className="font-bold text-foreground">
                                  {ov.full_name ?? rec.full_name}
                                </span>
                                <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-bold text-rose-600">
                                  {rec.blood_group || "—"}
                                </span>
                                <span className="font-mono text-muted-foreground">{rec.phone}</span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                বয়স: {rec.age ?? "—"} • ঠিকানা: {rec.address || "—"}
                                {rec.upazila ? ` (উপজেলা: ${rec.upazila})` : ""} • মোট দান:{" "}
                                {rec.total_donations ?? "—"} • শেষ রক্তদান:{" "}
                                {ov.last_donation_date ?? rec.last_donation_date ?? "অবৈধ/খালি"}
                                {rec.lastDonationNote ? ` ${rec.lastDonationNote}` : ""}
                              </p>
                              {rec.conflictReason && (
                                <p className="text-[11px] font-semibold text-amber-800">
                                  {rec.conflictReason}
                                </p>
                              )}
                              {rec.matchedExistingDonor && (
                                <p className="text-[11px] text-blue-700">
                                  ডাটাবেজ ম্যাচ: {rec.matchedExistingDonor.full_name} ({rec.matchedExistingDonor.phone}) •{" "}
                                  {rec.matchedExistingDonor.blood_group} • শেষ দান:{" "}
                                  {rec.matchedExistingDonor.last_donation_date || "—"}
                                </p>
                              )}
                            </div>

                            {activeTab === "ready" && (
                              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                                <input
                                  type="checkbox"
                                  checked={readyIncluded}
                                  disabled={importing}
                                  onChange={(e) =>
                                    setExcludeReadyRows((prev) => ({
                                      ...prev,
                                      [rec.rowNumber]: !e.target.checked,
                                    }))
                                  }
                                />
                                ইম্পোর্ট
                              </label>
                            )}

                            {activeTab === "potential_duplicate" && (
                              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-900">
                                <input
                                  type="checkbox"
                                  checked={Boolean(ov.include)}
                                  disabled={importing}
                                  onChange={(e) =>
                                    setOverrides((prev) => ({
                                      ...prev,
                                      [rec.rowNumber]: { ...prev[rec.rowNumber], include: e.target.checked },
                                    }))
                                  }
                                />
                                ভিন্ন ব্যক্তি হিসেবে যুক্ত করুন
                              </label>
                            )}
                          </div>

                          {/* Inline editor for non-duplicate manual review records (e.g. missing name "-") */}
                          {activeTab === "manual_review" && !rec.duplicateOfRow && (
                            <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
                              <input
                                value={ov.full_name ?? (rec.missingName ? "" : rec.full_name)}
                                onChange={(e) =>
                                  setOverrides((prev) => ({
                                    ...prev,
                                    [rec.rowNumber]: {
                                      ...prev[rec.rowNumber],
                                      full_name: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="সঠিক নাম লিখুন..."
                                disabled={importing}
                                className="min-w-[160px] flex-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs"
                              />
                              <input
                                type="date"
                                value={ov.last_donation_date ?? rec.last_donation_date ?? ""}
                                onChange={(e) =>
                                  setOverrides((prev) => ({
                                    ...prev,
                                    [rec.rowNumber]: {
                                      ...prev[rec.rowNumber],
                                      last_donation_date: e.target.value,
                                    },
                                  }))
                                }
                                disabled={importing}
                                className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs"
                              />
                              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary-deep">
                                <input
                                  type="checkbox"
                                  checked={Boolean(ov.include)}
                                  disabled={importing}
                                  onChange={(e) =>
                                    setOverrides((prev) => ({
                                      ...prev,
                                      [rec.rowNumber]: { ...prev[rec.rowNumber], include: e.target.checked },
                                    }))
                                  }
                                />
                                সংশোধনসহ যুক্ত করুন
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })
                )}

                {activeTab === "ready" && activeBucketRecords.length > readyVisibleLimit && (
                  <button
                    type="button"
                    onClick={() => setReadyVisibleLimit((n) => n + 100)}
                    className="w-full rounded-xl border border-border bg-card py-2 text-xs font-bold text-primary-deep hover:bg-muted"
                  >
                    আরও দেখুন ({activeBucketRecords.length - readyVisibleLimit}টি বাকি)
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-3 sm:px-6">
          <p className="text-xs text-muted-foreground">
            ইম্পোর্ট আইডেমপোটেন্সি কী: <code className="rounded bg-muted px-1">imp_bd_&lt;phone&gt;</code> • ব্যাচ সাইজ: ২৫
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={importing}
              onClick={onClose}
              className="rounded-full bg-muted px-4 py-2 text-xs font-semibold hover:bg-muted/80 disabled:opacity-50"
            >
              বন্ধ করুন
            </button>
            <button
              type="button"
              disabled={importing || !analysis || selectedRecordsToWrite.length === 0 || !isFirebaseSignedIn}
              onClick={() => void runImport()}
              className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
            >
              {importing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {importing
                ? "ইম্পোর্ট হচ্ছে..."
                : `Firestore-এ ইম্পোর্ট করুন (${selectedRecordsToWrite.length} জন)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
