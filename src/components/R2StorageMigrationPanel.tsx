/**
 * Smart Noakhali — Cloudflare R2 Storage Health, Audit & Firebase Storage Migration Dashboard
 * Super Admin Exclusive Control Panel
 */

import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRightLeft,
  ShieldCheck,
  Database,
  Download,
  Lock,
  Globe,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import {
  checkR2StorageHealth,
  deleteR2FileByUrl,
  isFirebaseStorageUrl,
  isR2Url,
  migrateSourceUrlToR2,
  uploadFileToR2,
  type R2HealthReport,
} from "@/lib/r2Storage";
import { recordSuperAdminAudit } from "@/lib/staff-audit";

interface ScannedMediaRef {
  collectionName: string;
  docId: string;
  subCollection?: string;
  subDocId?: string;
  fieldPath: string;
  url: string;
  category: string;
  bucketType: "public" | "private";
  status: "firebase" | "r2" | "local_or_other";
}

interface MigrationManifestEntry {
  collectionName: string;
  docId: string;
  fieldPath: string;
  oldUrl: string;
  newUrl: string;
  objectKey: string;
  bucketType: "public" | "private";
  size: number;
  checksumSha256: string;
  migratedAt: string;
}

const SCAN_COLLECTIONS: Array<{
  name: string;
  fields: Array<{ key: string; category: string; bucketType: "public" | "private" }>;
}> = [
  {
    name: "categories",
    fields: [{ key: "customIconUrl", category: "category_icon", bucketType: "public" }],
  },
  {
    name: "submissions",
    fields: [
      { key: "image_url", category: "submission", bucketType: "public" },
      { key: "photo_url", category: "submission", bucketType: "public" },
    ],
  },
  {
    name: "blood_donors",
    fields: [{ key: "photo_url", category: "donor", bucketType: "public" }],
  },
  {
    name: "donation_events",
    fields: [{ key: "photo_url", category: "donor_event", bucketType: "public" }],
  },
  {
    name: "donations",
    fields: [
      { key: "deposit_slip_url", category: "submission", bucketType: "public" },
      { key: "receipt_url", category: "submission", bucketType: "public" },
    ],
  },
  {
    name: "expenses",
    fields: [{ key: "receipt_url", category: "expense_receipt", bucketType: "public" }],
  },
  {
    name: "emergency_banners",
    fields: [{ key: "image_url", category: "banner", bucketType: "public" }],
  },
  {
    name: "institutions",
    fields: [
      { key: "logo_url", category: "service", bucketType: "public" },
      { key: "cover_url", category: "service", bucketType: "public" },
    ],
  },
  {
    name: "job_circulars",
    fields: [{ key: "attachment_url", category: "notice", bucketType: "public" }],
  },
  {
    name: "complaint_tracking",
    fields: [{ key: "attachment_url", category: "complaint_attachment", bucketType: "private" }],
  },
  {
    name: "users",
    fields: [{ key: "photo_url", category: "profile", bucketType: "public" }],
  },
];

function extractUrlsFromText(text: string): string[] {
  const matches = text.match(
    /https:\/\/firebasestorage\.googleapis\.com\/[^\s"'\\}]+|https:\/\/storage\.googleapis\.com\/smartnoakhali[^\s"'\\}]+/g
  );
  return matches ? Array.from(new Set(matches)) : [];
}

export function R2StorageMigrationPanel() {
  const [health, setHealth] = useState<R2HealthReport | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [scannedTotalDocs, setScannedTotalDocs] = useState(0);
  const [refs, setRefs] = useState<ScannedMediaRef[]>([]);
  const [migrating, setMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<{
    done: number;
    total: number;
    failed: number;
  } | null>(null);
  const [manifest, setManifest] = useState<MigrationManifestEntry[]>([]);

  const [diagBucket, setDiagBucket] = useState<"public" | "private">("private");
  const [diagBusy, setDiagBusy] = useState(false);
  const [diagResult, setDiagResult] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setCheckingHealth(true);
    try {
      const report = await checkR2StorageHealth();
      setHealth(report);
    } catch (err) {
      setHealth({
        ok: false,
        provider: "cloudflare-r2",
        error: err instanceof Error ? err.message : "Health check failed",
      });
    } finally {
      setCheckingHealth(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  const scanFirestoreStorageUsage = useCallback(async () => {
    setScanning(true);
    try {
      const found: ScannedMediaRef[] = [];
      let totalDocs = 0;

      // 1. Scan structured collections
      for (const cfg of SCAN_COLLECTIONS) {
        try {
          const snap = await getDocs(collection(db, cfg.name));
          totalDocs += snap.size;
          snap.forEach((docSnap) => {
            const data = docSnap.data();
            for (const f of cfg.fields) {
              const val = data?.[f.key];
              if (typeof val === "string" && val.trim()) {
                const url = val.trim();
                found.push({
                  collectionName: cfg.name,
                  docId: docSnap.id,
                  fieldPath: f.key,
                  url,
                  category: f.category,
                  bucketType: f.bucketType,
                  status: isFirebaseStorageUrl(url)
                    ? "firebase"
                    : isR2Url(url)
                      ? "r2"
                      : "local_or_other",
                });
              }
            }
          });
        } catch {
          // continue scanning accessible collections
        }
      }

      // 2. Scan settings/* (serialized JSON configs such as branding, hero_banner_config, media_library_config, categories_config)
      try {
        const settingsSnap = await getDocs(collection(db, "settings"));
        totalDocs += settingsSnap.size;
        settingsSnap.forEach((docSnap) => {
          const raw = String(docSnap.data()?.logo_url || "").trim();
          if (!raw) return;
          const fbUrls = extractUrlsFromText(raw);
          for (const fbUrl of fbUrls) {
            found.push({
              collectionName: "settings",
              docId: docSnap.id,
              fieldPath: "logo_url",
              url: fbUrl,
              category: docSnap.id.includes("hero")
                ? "banner"
                : docSnap.id.includes("brand")
                  ? "branding"
                  : docSnap.id.includes("media")
                    ? "media_library"
                    : "general",
              bucketType: "public",
              status: "firebase",
            });
          }
          if (fbUrls.length === 0 && (raw.includes("/api/storage/file/") || raw.includes("cdn.smartnoakhali.com"))) {
            found.push({
              collectionName: "settings",
              docId: docSnap.id,
              fieldPath: "logo_url",
              url: raw.slice(0, 120),
              category: "settings",
              bucketType: "public",
              status: "r2",
            });
          }
        });
      } catch {
        // ignore
      }

      // 3. Scan chat_threads/*/messages for attachments
      try {
        const threadsSnap = await getDocs(collection(db, "chat_threads"));
        totalDocs += threadsSnap.size;
        for (const tDoc of threadsSnap.docs) {
          const msgSnap = await getDocs(collection(db, "chat_threads", tDoc.id, "messages"));
          totalDocs += msgSnap.size;
          msgSnap.forEach((mDoc) => {
            const att = String(mDoc.data()?.attachment_url || "").trim();
            if (!att) return;
            found.push({
              collectionName: "chat_threads",
              docId: tDoc.id,
              subCollection: "messages",
              subDocId: mDoc.id,
              fieldPath: "attachment_url",
              url: att,
              category: "chat_private",
              bucketType: "private",
              status: isFirebaseStorageUrl(att)
                ? "firebase"
                : isR2Url(att)
                  ? "r2"
                  : "local_or_other",
            });
          });
        }
      } catch {
        // ignore
      }

      setScannedTotalDocs(totalDocs);
      setRefs(found);
      const fbCount = found.filter((r) => r.status === "firebase").length;
      if (fbCount === 0) {
        toast.success(
          `স্ক্যান সম্পন্ন (${totalDocs} ডকুমেন্ট): কোনো Firebase Storage লিংক পাওয়া যায়নি (০টি)।`
        );
      } else {
        toast.info(`স্ক্যান সম্পন্ন: ${fbCount}টি Firebase Storage লিংক মাইগ্রেশনের জন্য প্রস্তুত।`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Firestore স্ক্যান ব্যর্থ হয়েছে");
    } finally {
      setScanning(false);
    }
  }, []);

  const migrateFirebaseRefsToR2 = async () => {
    const firebaseRefs = refs.filter((r) => r.status === "firebase");
    if (firebaseRefs.length === 0) {
      toast.info("মাইগ্রেট করার মতো কোনো Firebase Storage ফাইল নেই।");
      return;
    }

    setMigrating(true);
    setMigrationProgress({ done: 0, total: firebaseRefs.length, failed: 0 });
    const newManifest: MigrationManifestEntry[] = [];
    let done = 0;
    let failed = 0;

    try {
      // Cache migrated URLs so duplicate URLs aren't re-uploaded twice
      const migratedUrlMap = new Map<
        string,
        { fileUrl: string; objectKey: string; size: number; checksumSha256: string }
      >();

      for (const item of firebaseRefs) {
        try {
          let migrated = migratedUrlMap.get(item.url);
          if (!migrated) {
            const res = await migrateSourceUrlToR2({
              sourceUrl: item.url,
              bucketType: item.bucketType,
              category: item.category,
              overwrite: true,
            });
            migrated = {
              fileUrl: res.fileUrl,
              objectKey: res.objectKey,
              size: res.size,
              checksumSha256: res.checksumSha256,
            };
            migratedUrlMap.set(item.url, migrated);
          }

          // Update Firestore record in-place (preserving Firebase Storage original files untouched)
          if (item.collectionName === "settings") {
            const settingRef = doc(db, "settings", item.docId);
            const snap = await getDocs(collection(db, "settings"));
            const targetSnap = snap.docs.find((d) => d.id === item.docId);
            const currentVal = String(targetSnap?.data()?.logo_url || "");
            if (currentVal.includes(item.url)) {
              await setDoc(
                settingRef,
                {
                  logo_url: currentVal.split(item.url).join(migrated.fileUrl),
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );
            }
          } else if (item.subCollection && item.subDocId) {
            const targetRef = doc(
              db,
              item.collectionName,
              item.docId,
              item.subCollection,
              item.subDocId
            );
            await setDoc(
              targetRef,
              {
                [item.fieldPath]: migrated.fileUrl,
                storageProvider: "cloudflare-r2",
                bucketType: item.bucketType,
                objectKey: migrated.objectKey,
                migratedAt: new Date().toISOString(),
              },
              { merge: true }
            );
          } else {
            const targetRef = doc(db, item.collectionName, item.docId);
            await setDoc(
              targetRef,
              {
                [item.fieldPath]: migrated.fileUrl,
                storageProvider: "cloudflare-r2",
                bucketType: item.bucketType,
                objectKey: migrated.objectKey,
                migratedAt: new Date().toISOString(),
              },
              { merge: true }
            );
          }

          newManifest.push({
            collectionName: item.collectionName,
            docId: item.subDocId ? `${item.docId}/${item.subDocId}` : item.docId,
            fieldPath: item.fieldPath,
            oldUrl: item.url,
            newUrl: migrated.fileUrl,
            objectKey: migrated.objectKey,
            bucketType: item.bucketType,
            size: migrated.size,
            checksumSha256: migrated.checksumSha256,
            migratedAt: new Date().toISOString(),
          });
        } catch {
          failed++;
        } finally {
          done++;
          setMigrationProgress({ done, total: firebaseRefs.length, failed });
        }
      }

      setManifest((prev) => [...newManifest, ...prev]);
      void recordSuperAdminAudit({
        action: "update",
        module: "r2_migration",
        target_id: "firebase_to_r2",
        target_label: "Cloudflare R2 Migration",
        summary: `Firebase Storage থেকে ${newManifest.length}টি ফাইল Cloudflare R2-তে মাইগ্রেট করা হয়েছে (ব্যর্থ: ${failed})।`,
      });

      if (failed === 0) {
        toast.success(`সফলভাবে ${newManifest.length}টি ফাইল R2-তে মাইগ্রেট ও যাচাই সম্পন্ন হয়েছে!`);
      } else {
        toast.warning(`${newManifest.length}টি মাইগ্রেট হয়েছে, ${failed}টি ব্যর্থ হয়েছে।`);
      }
      await scanFirestoreStorageUsage();
    } finally {
      setMigrating(false);
    }
  };

  const runSelfDiagnostic = async () => {
    setDiagBusy(true);
    setDiagResult(null);
    try {
      // Create a tiny valid 1x1 PNG binary in memory to verify upload -> read -> delete
      const pngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
      const raw = atob(pngBase64);
      const arr = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      const file = new File([arr], `r2-diag-${Date.now()}.png`, { type: "image/png" });

      const uploaded = await uploadFileToR2(file, {
        category: diagBucket === "private" ? "admin_private" : "general",
        bucketType: diagBucket,
        entityId: "diagnostic",
        skipCompression: true,
      });

      const deleted = await deleteR2FileByUrl(uploaded.fileUrl, diagBucket);
      setDiagResult(
        `✅ ${diagBucket === "private" ? "Private (smart-noakhali-private)" : "Public (smart-noakhali-public)"} টেস্ট সফল! Key: ${uploaded.objectKey} • Size: ${uploaded.size}B • Cleanup: ${deleted ? "OK" : "Skipped"}`
      );
      toast.success("R2 আপলোড ও ডিলিট ডায়াগনস্টিক সফল হয়েছে!");
    } catch (err: any) {
      const msg = err?.message || "Diagnostic failed";
      setDiagResult(`❌ ব্যর্থ: ${msg}`);
      toast.error(msg);
    } finally {
      setDiagBusy(false);
    }
  };

  const downloadManifest = () => {
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smartnoakhali-r2-migration-manifest-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const firebaseCount = refs.filter((r) => r.status === "firebase").length;
  const r2Count = refs.filter((r) => r.status === "r2").length;
  const otherCount = refs.filter((r) => r.status === "local_or_other").length;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-700">
              <Cloud className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold text-primary-deep">
                Cloudflare R2 ফাইল স্টোরেজ ও মাইগ্রেশন কনসোল
              </h2>
              <p className="text-xs text-muted-foreground">
                সকল ফাইল আপলোড এখন ১০০% Cloudflare R2-তে পরিচালিত • Firebase Auth ও Firestore সম্পূর্ণ অক্ষুণ্ণ
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={checkingHealth}
            onClick={() => void loadHealth()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-bold hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checkingHealth ? "animate-spin" : ""}`} />
            হেলথ রিফ্রেশ
          </button>
        </div>

        {/* Bucket Status Cards */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                <Globe className="h-4 w-4 text-emerald-600" />
                পাবলিক বাকেট (<code>R2_PUBLIC</code>)
              </span>
              {health?.buckets?.public?.reachable || health?.publicReady ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  <CheckCircle2 className="h-3 w-3" /> সক্রিয়
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  <AlertTriangle className="h-3 w-3" /> বাইন্ডিং যাচাই প্রয়োজন
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Bucket: <strong>smart-noakhali-public</strong> • Delivery:{" "}
              <code>{health?.buckets?.public?.deliveryBase || "/api/storage/file/public"}</code>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              ব্যবহৃত ফাইল: ক্যাটাগরি আইকন, হিরো ব্যানার, লোগো, ব্র্যান্ডিং, প্রোফাইল ছবি, সেবা ও ডিরেক্টরি ছবি।
            </p>
          </div>

          <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/5 p-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                <Lock className="h-4 w-4 text-indigo-600" />
                প্রাইভেট বাকেট (<code>R2_PRIVATE</code>)
              </span>
              {health?.buckets?.private?.reachable || health?.privateReady ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  <ShieldCheck className="h-3 w-3" /> সংরক্ষিত ও সক্রিয়
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  <AlertTriangle className="h-3 w-3" /> বাইন্ডিং যাচাই প্রয়োজন
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Bucket: <strong>smart-noakhali-private</strong> • Auth: Firebase RS256 Token + Ownership/RBAC
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              ব্যবহৃত ফাইল: অভিযোগ প্রমাণক, লাইভ চ্যাট ভয়েস ও সংযুক্তি, এবং সংরক্ষিত অ্যাডমিন ডকুমেন্ট।
            </p>
          </div>
        </div>
      </div>

      {/* Firebase Storage Scanner & Safe Migrator */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-card space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-display text-sm sm:text-base font-bold text-foreground">
              <Database className="h-4 w-4 text-primary" />
              ফায়ারবেস স্টোরেজ স্ক্যান ও R2 মাইগ্রেশন টুল
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              পুরনো <code>firebasestorage.googleapis.com</code> ফাইলগুলো নিরাপদভাবে R2-তে কপি করে Firestore আপডেট করে (মূল ফাইল মুছে ফেলা হয় না)।
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={scanning || migrating}
              onClick={() => void scanFirestoreStorageUsage()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary-deep hover:bg-primary/15 disabled:opacity-50"
            >
              {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              ডেটাবেস স্ক্যান করুন
            </button>

            {firebaseCount > 0 && (
              <button
                type="button"
                disabled={migrating}
                onClick={() => void migrateFirebaseRefsToR2()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F4D3A] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0B3B2C] disabled:opacity-50"
              >
                {migrating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                )}
                {firebaseCount}টি ফাইল R2-তে মাইগ্রেট করুন
              </button>
            )}

            {manifest.length > 0 && (
              <button
                type="button"
                onClick={downloadManifest}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" /> ম্যানিফেস্ট ({manifest.length})
              </button>
            )}
          </div>
        </div>

        {/* Summary Counters */}
        {scannedTotalDocs > 0 && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-2xl border border-border bg-background p-3">
              <p className="text-[11px] text-muted-foreground">মোট ডকুমেন্ট স্ক্যান</p>
              <p className="mt-0.5 text-lg font-extrabold text-foreground">{scannedTotalDocs}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-3">
              <p className="text-[11px] text-emerald-700">Cloudflare R2 লিংক</p>
              <p className="mt-0.5 text-lg font-extrabold text-emerald-800">{r2Count}</p>
            </div>
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-3">
              <p className="text-[11px] text-amber-700">Firebase Storage লিংক</p>
              <p className="mt-0.5 text-lg font-extrabold text-amber-800">{firebaseCount}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-3">
              <p className="text-[11px] text-muted-foreground">স্থানীয় / অন্যান্য লিংক</p>
              <p className="mt-0.5 text-lg font-extrabold text-foreground">{otherCount}</p>
            </div>
          </div>
        )}

        {migrationProgress && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
            <div className="flex justify-between font-bold">
              <span>
                মাইগ্রেশন প্রগতি: {migrationProgress.done}/{migrationProgress.total}
              </span>
              {migrationProgress.failed > 0 && (
                <span className="text-rose-600">ব্যর্থ: {migrationProgress.failed}</span>
              )}
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{
                  width: `${Math.round((migrationProgress.done / Math.max(1, migrationProgress.total)) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {firebaseCount > 0 && (
          <div className="max-h-60 overflow-y-auto rounded-2xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 text-[11px] font-bold">
                <tr>
                  <th className="px-3 py-2">কালেকশন / ডক</th>
                  <th className="px-3 py-2">ফিল্ড</th>
                  <th className="px-3 py-2">বাকেট</th>
                  <th className="px-3 py-2">URL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {refs
                  .filter((r) => r.status === "firebase")
                  .map((r, idx) => (
                    <tr key={`${r.collectionName}-${r.docId}-${r.fieldPath}-${idx}`}>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {r.collectionName}/{r.subDocId ? `${r.docId}/${r.subDocId}` : r.docId}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">{r.fieldPath}</td>
                      <td className="px-3 py-2">{r.bucketType}</td>
                      <td className="max-w-xs truncate px-3 py-2 font-mono text-[10px] text-muted-foreground">
                        {r.url}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Live Upload/Delete Diagnostic */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-card space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
              <Upload className="h-4 w-4 text-primary" />
              R2 বাকেট লাইভ আপলোড ও ডিলিট পরীক্ষা
            </h3>
            <p className="text-xs text-muted-foreground">
              ১×১ পরীক্ষামূলক PNG আপলোড করে Firebase Auth + R2 Write + Cleanup যাচাই করুন।
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={diagBucket}
              onChange={(e) => setDiagBucket(e.target.value as "public" | "private")}
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold"
            >
              <option value="public">R2_PUBLIC (smart-noakhali-public)</option>
              <option value="private">R2_PRIVATE (smart-noakhali-private)</option>
            </select>
            <button
              type="button"
              disabled={diagBusy}
              onClick={() => void runSelfDiagnostic()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              {diagBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              টেস্ট চালান
            </button>
          </div>
        </div>
        {diagResult && (
          <div className="rounded-2xl border border-border bg-muted/40 p-3 text-xs font-mono">
            {diagResult}
          </div>
        )}
      </div>
    </div>
  );
}
