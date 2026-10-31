import {
  collection,
  doc,
  getDocs,
  getDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { categories as masterCategories, DIVISIONS as masterDivisions, type Category } from "@/data/categories";
import { upsertSettingDoc, CATEGORIES_CONFIG_ID, DIVISIONS_CONFIG_ID, LOCAL_CATEGORIES_KEY, LOCAL_DIVISIONS_KEY } from "@/lib/store";

export interface CategoryMigrationResult {
  totalMaster: number;
  addedCount: number;
  updatedCount: number;
  alreadyCorrectCount: number;
  failedCount: number;
  mismatchCount: number;
  logs: Array<{
    slug: string;
    action: "added" | "updated" | "exists" | "mismatch_fixed" | "error";
    detail: string;
  }>;
  divisionCounts: Record<string, { expected: number; actual: number; name: string }>;
  verifiedInFirestoreCount: number;
  status: "success" | "partial" | "failed";
}

export interface CategoryAuditReport {
  totalExpected: number;
  totalFirestore: number;
  divisionSummary: Array<{
    divisionId: string;
    divisionName: string;
    expectedCount: number;
    actualCount: number;
    categories: Array<{ slug: string; bn: string; existsInFirestore: boolean; formType?: string }>;
  }>;
  missingFromFirestore: string[];
  orphanInFirestore: string[];
}

/**
 * Idempotent batch-synchronization of all 181 categories and 22 divisions into Firebase Firestore.
 * Does not overwrite existing custom descriptions or logos; preserves references.
 */
export async function syncCategoriesToFirestore(
  onProgress?: (msg: string, percent: number) => void
): Promise<CategoryMigrationResult> {
  const result: CategoryMigrationResult = {
    totalMaster: masterCategories.length,
    addedCount: 0,
    updatedCount: 0,
    alreadyCorrectCount: 0,
    failedCount: 0,
    mismatchCount: 0,
    logs: [],
    divisionCounts: {},
    verifiedInFirestoreCount: 0,
    status: "success",
  };

  try {
    onProgress?.("বর্তমান Firestore ক্যাটাগরি রেকর্ড নিরীক্ষণ করা হচ্ছে...", 10);

    // 1. Fetch current categories from Firestore /categories collection
    const categoriesColRef = collection(db, "categories");
    const existingSnap = await getDocs(categoriesColRef);
    const existingDocsMap = new Map<string, Record<string, any>>();
    existingSnap.forEach((docSnap) => {
      existingDocsMap.set(docSnap.id, docSnap.data());
    });

    onProgress?.(`Firestore-এ প্রাপ্ত ${existingDocsMap.size}টি ক্যাটাগরি। মাস্টার তালিকার সঙ্গে তুলনা হচ্ছে...`, 25);

    // 2. Prepare batches (Firestore allows up to 500 ops per batch)
    const BATCH_SIZE = 350;
    let currentBatch = writeBatch(db);
    let opCount = 0;

    for (let i = 0; i < masterCategories.length; i++) {
      const c = masterCategories[i];
      const existing = existingDocsMap.get(c.slug);

      const targetDocRef = doc(db, "categories", c.slug);

      if (!existing) {
        // Document does not exist: create it
        currentBatch.set(targetDocRef, {
          slug: c.slug,
          divisionId: c.divisionId,
          bn: c.bn,
          en: c.en,
          iconName: c.iconName || "Users",
          tint: c.tint,
          description: c.description,
          formType: c.formType || "general",
          visible: true,
          sort_order: c.sort_order || i + 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        opCount++;
        result.addedCount++;
        result.logs.push({
          slug: c.slug,
          action: "added",
          detail: `নতুন ক্যাটাগরি তৈরি হয়েছে: ${c.bn} (${c.divisionId})`,
        });
      } else {
        // Check for department mismatch or missing fields
        const needsDivisionFix = existing.divisionId !== c.divisionId;
        const needsFormTypeFix = !existing.formType || existing.formType !== c.formType;
        const needsBnFix = !existing.bn || (existing.bn !== c.bn && existing.bn === c.slug);

        if (needsDivisionFix || needsFormTypeFix || needsBnFix) {
          const patch: Record<string, any> = {
            updatedAt: serverTimestamp(),
          };
          if (needsDivisionFix) {
            patch.divisionId = c.divisionId;
            result.mismatchCount++;
          }
          if (needsFormTypeFix) {
            patch.formType = c.formType || "general";
          }
          if (needsBnFix) {
            patch.bn = c.bn;
          }
          // Preserve customIconUrl, custom description if already present
          if (!existing.iconName) patch.iconName = c.iconName || "Users";
          if (!existing.tint) patch.tint = c.tint;

          currentBatch.update(targetDocRef, patch);
          opCount++;
          result.updatedCount++;
          result.logs.push({
            slug: c.slug,
            action: needsDivisionFix ? "mismatch_fixed" : "updated",
            detail: `আপডেট সম্পন্ন: ${c.bn} (বিভাগ: ${c.divisionId})`,
          });
        } else {
          result.alreadyCorrectCount++;
          result.logs.push({
            slug: c.slug,
            action: "exists",
            detail: `সঠিকভাবে বিদ্যমান: ${c.bn}`,
          });
        }
      }

      // Commit batch when threshold reached
      if (opCount >= BATCH_SIZE) {
        onProgress?.(`Firestore ব্যাচ রাইট সম্পন্ন হচ্ছে (${result.addedCount + result.updatedCount} টি কার্যক্রম)...`, 50);
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        opCount = 0;
      }
    }

    // Commit any remaining writes
    if (opCount > 0) {
      onProgress?.("অবশিষ্ট ক্যাটাগরি ব্যাচ রাইট সম্পন্ন হচ্ছে...", 70);
      await currentBatch.commit();
    }

    // 3. Sync full categories to Firestore settings/categories_config & Server content store
    onProgress?.("ক্যাটাগরি কনফিগ রেজিস্ট্রি ক্লাউডে সিঙ্ক হচ্ছে...", 85);
    const categoryRegistry = masterCategories.map((c, idx) => ({
      slug: c.slug,
      divisionId: c.divisionId,
      bn: c.bn,
      en: c.en,
      iconName: c.iconName || "Users",
      tint: c.tint,
      description: c.description,
      formType: c.formType || "general",
      visible: true,
      sort_order: c.sort_order || idx + 1,
    }));

    const divisionsRegistry = masterDivisions.map((d, idx) => ({
      id: d.id,
      bn: d.bn,
      en: d.en,
      iconName: d.iconName,
      tint: d.tint,
      description: d.description,
      visible: true,
      sort_order: d.sort_order || idx + 1,
    }));

    const serializedCategories = JSON.stringify(categoryRegistry);
    const serializedDivisions = JSON.stringify(divisionsRegistry);

    // Save to Firestore settings documents
    await upsertSettingDoc(CATEGORIES_CONFIG_ID, serializedCategories);
    await upsertSettingDoc(DIVISIONS_CONFIG_ID, serializedDivisions);

    // Update localStorage
    try {
      localStorage.setItem(LOCAL_CATEGORIES_KEY, serializedCategories);
      localStorage.setItem(LOCAL_DIVISIONS_KEY, serializedDivisions);
    } catch {}

    // 4. Verification Read-back from Firestore to confirm authoritative numbers
    onProgress?.("Firestore থেকে রিড-ব্যাক ভেরিফিকেশন চলছে...", 95);
    const verifySnap = await getDocs(categoriesColRef);
    result.verifiedInFirestoreCount = verifySnap.size;

    // Calculate per-division actual counts
    for (const d of masterDivisions) {
      const expected = masterCategories.filter((c) => c.divisionId === d.id).length;
      result.divisionCounts[d.id] = {
        name: d.bn,
        expected,
        actual: 0,
      };
    }
    verifySnap.forEach((docSnap) => {
      const data = docSnap.data();
      const divId = data.divisionId;
      if (result.divisionCounts[divId]) {
        result.divisionCounts[divId].actual++;
      }
    });

    onProgress?.(`সিঙ্ক সম্পন্ন! Firestore-এ মোট ${result.verifiedInFirestoreCount}টি ক্যাটাগরি নিশ্চিত হয়েছে।`, 100);
    result.status = result.failedCount > 0 ? "partial" : "success";
    return result;
  } catch (err: any) {
    result.status = "failed";
    result.failedCount++;
    result.logs.push({
      slug: "system",
      action: "error",
      detail: `সিঙ্ক ব্যর্থ: ${err?.message || String(err)}`,
    });
    return result;
  }
}

/**
 * Audit categories in Firestore vs the 181 Master Specification.
 */
export async function auditCategoriesFromFirestore(): Promise<CategoryAuditReport> {
  const categoriesColRef = collection(db, "categories");
  const snap = await getDocs(categoriesColRef);
  const firestoreMap = new Map<string, Record<string, any>>();
  snap.forEach((docSnap) => {
    firestoreMap.set(docSnap.id, docSnap.data());
  });

  const missingFromFirestore: string[] = [];
  const orphanInFirestore: string[] = [];

  for (const c of masterCategories) {
    if (!firestoreMap.has(c.slug)) {
      missingFromFirestore.push(c.slug);
    }
  }

  for (const [id] of firestoreMap) {
    if (!masterCategories.some((c) => c.slug === id)) {
      orphanInFirestore.push(id);
    }
  }

  const divisionSummary = masterDivisions.map((d) => {
    const expectedCats = masterCategories.filter((c) => c.divisionId === d.id);
    const catList = expectedCats.map((c) => ({
      slug: c.slug,
      bn: c.bn,
      existsInFirestore: firestoreMap.has(c.slug),
      formType: c.formType,
    }));
    const actualCount = catList.filter((x) => x.existsInFirestore).length;

    return {
      divisionId: d.id,
      divisionName: d.bn,
      expectedCount: expectedCats.length,
      actualCount,
      categories: catList,
    };
  });

  return {
    totalExpected: masterCategories.length,
    totalFirestore: firestoreMap.size,
    divisionSummary,
    missingFromFirestore,
    orphanInFirestore,
  };
}
