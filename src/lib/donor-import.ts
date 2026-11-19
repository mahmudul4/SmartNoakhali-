import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { auth, db, sanitizeString } from "@/lib/firebase";
import type { BloodGroupType, DonorRow, ModerationStatus } from "@/lib/cloud";

export const DEFAULT_DONOR_SOURCE_URL = "/assets/aistudio/Pasted_text_2__9f1f02cb.txt";
export const VALID_BLOOD_GROUPS: readonly BloodGroupType[] = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
];

export const NOAKHALI_UPAZILAS = [
  "সদর",
  "বেগমগঞ্জ",
  "সেনবাগ",
  "সোনাইমুড়ী",
  "চাটখিল",
  "কোম্পানীগঞ্জ",
  "কবিরহাট",
  "হাতিয়া",
  "সুবর্ণচর",
] as const;

export type DonorImportBucket =
  | "ready"
  | "already_existing"
  | "potential_duplicate"
  | "manual_review";

export interface ParsedDonorSourceRecord {
  rowNumber: number;
  rawLine: string;
  idempotencyId: string;
  full_name: string;
  phone: string;
  normalizedPhone: string;
  blood_group: BloodGroupType | string;
  age: number | null;
  ageRaw: string;
  address: string;
  upazila: string;
  district: string;
  total_donations: number | null;
  totalDonationsRaw: string;
  last_donation_date: string | null;
  lastDonationRaw: string;
  lastDonationNote: string;
  photo_url: string;
  bucket: DonorImportBucket;
  issues: string[];
  missingName: boolean;
  missingOrInvalidDate: boolean;
  missingOptionalFields: string[];
  matchedExistingDonor?: {
    id: string;
    full_name: string;
    phone: string;
    blood_group: string;
    address: string | null;
    last_donation_date: string | null;
    status: string;
  } | null;
  duplicateOfRow?: number | null;
  conflictReason?: string | null;
}

export interface DonorImportAnalysis {
  totalSourceRecords: number;
  readyRecords: ParsedDonorSourceRecord[];
  alreadyExistingRecords: ParsedDonorSourceRecord[];
  potentialDuplicateRecords: ParsedDonorSourceRecord[];
  manualReviewRecords: ParsedDonorSourceRecord[];
  allRecords: ParsedDonorSourceRecord[];
  missingNameCount: number;
  invalidOrMissingDateCount: number;
  missingOptionalCount: number;
  parsedAt: string;
}

export interface BatchImportFailure {
  batchIndex: number;
  rowNumbers: number[];
  error: string;
}

export interface BloodDonorReconciliationReport {
  totalSourceRecords: number;
  importedNewCount: number;
  alreadyExistingCount: number;
  potentialDuplicatesCount: number;
  manualReviewCount: number;
  failedCount: number;
  missingNameCount: number;
  invalidOrMissingDateCount: number;
  missingOptionalCount: number;
  photosLeftEmptyConfirmed: boolean;
  reconciled: boolean;
  verifiedFirestoreTotalAfterImport: number | null;
  importedIds: string[];
  failedRecords: Array<{ rowNumber: number; phone: string; full_name: string; error: string }>;
  batchFailures: BatchImportFailure[];
  completedAt: string;
}

/**
 * Normalizes a Bangladeshi mobile number strictly for duplicate matching.
 * Never used to alter the stored donor.phone string (leading zero is preserved).
 */
export function normalizeBdPhoneKey(rawPhone: string): string {
  let digits = String(rawPhone || "").replace(/\D/g, "");
  if (digits.startsWith("8801") && digits.length === 13) {
    digits = digits.slice(2);
  } else if (digits.startsWith("88") && digits.length === 13 && digits[2] === "0") {
    digits = digits.slice(2);
  }
  return digits;
}

/**
 * Parses DD-MM-YYYY (with optional explanatory suffix like "(91 দিন আগে)" or "(আসল ডেট)")
 * into ISO YYYY-MM-DD without modifying or recalculating the supplied calendar date.
 */
export function parseSourceDonationDate(raw: string): {
  isoDate: string | null;
  isValid: boolean;
  noteText: string;
} {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return { isoDate: null, isValid: false, noteText: "" };
  }
  const match = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s*(\(.*\)))?$/);
  if (!match) {
    return { isoDate: null, isValid: false, noteText: trimmed };
  }
  const dd = Number(match[1]);
  const mm = Number(match[2]);
  const yyyy = Number(match[3]);
  const dt = new Date(Date.UTC(yyyy, mm - 1, dd));
  const validCalendarDate =
    dt.getUTCFullYear() === yyyy &&
    dt.getUTCMonth() === mm - 1 &&
    dt.getUTCDate() === dd &&
    yyyy >= 1990 &&
    yyyy <= 2100;

  if (!validCalendarDate) {
    return { isoDate: null, isValid: false, noteText: match[4] || "" };
  }
  const isoDate = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  return { isoDate, isValid: true, noteText: (match[4] || "").trim() };
}

/**
 * Extracts Noakhali upazila & district from full address while preserving complete original address.
 */
export function parseNoakhaliAddress(rawAddress: string): {
  address: string;
  upazila: string;
  district: string;
} {
  const clean = String(rawAddress || "").trim();
  const parts = clean.split(",").map((p) => p.trim()).filter(Boolean);
  let upazila = parts[0] || "";
  for (const known of NOAKHALI_UPAZILAS) {
    if (clean.includes(known)) {
      upazila = known;
      break;
    }
  }
  const district = parts[1] || (clean.includes("নোয়াখালী") || clean.includes("নোয়াখালী") ? "নোয়াখালী" : "");
  return {
    address: clean,
    upazila,
    district,
  };
}

function normalizeNameForComparison(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[.\-()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildDonorIdempotencyId(normalizedPhone: string, rowNumber: number): string {
  const safeDigits = normalizedPhone.replace(/[^a-zA-Z0-9_-]/g, "");
  if (safeDigits.length >= 6) {
    return `imp_bd_${safeDigits}`;
  }
  return `imp_bd_row_${rowNumber}`;
}

/**
 * Parses and reconciles every record from the source text against existing database donors.
 */
export function analyzeBloodDonorImportText(
  rawText: string,
  existingDonors: DonorRow[]
): DonorImportAnalysis {
  const cleanText = String(rawText || "").replace(/^\uFEFF/, "");
  const lines = cleanText.split(/\r?\n/);

  // Identify header row vs data rows
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    if (l.startsWith("নাম") && l.includes("|") && l.includes("ফোন")) {
      startIdx = i + 1;
    } else {
      startIdx = i;
    }
    break;
  }

  const existingByPhone = new Map<string, DonorRow>();
  const existingByNameAndGroup = new Map<string, DonorRow>();
  for (const ex of existingDonors) {
    const np = normalizeBdPhoneKey(ex.phone);
    if (np && !existingByPhone.has(np)) {
      existingByPhone.set(np, ex);
    }
    const nn = normalizeNameForComparison(ex.full_name);
    if (nn && nn !== "-" && ex.blood_group) {
      const ngKey = `${nn}|${ex.blood_group}`;
      if (!existingByNameAndGroup.has(ngKey)) {
        existingByNameAndGroup.set(ngKey, ex);
      }
    }
  }

  const validGroupSet = new Set<string>(VALID_BLOOD_GROUPS);
  const rawParsed: Array<{
    rowNumber: number;
    rawLine: string;
    full_name: string;
    phone: string;
    normalizedPhone: string;
    blood_group: string;
    age: number | null;
    ageRaw: string;
    address: string;
    upazila: string;
    district: string;
    total_donations: number | null;
    totalDonationsRaw: string;
    last_donation_date: string | null;
    lastDonationRaw: string;
    lastDonationNote: string;
    issues: string[];
    missingName: boolean;
    missingOrInvalidDate: boolean;
    missingOptionalFields: string[];
    isStructurallyValid: boolean;
  }> = [];

  for (let i = startIdx; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine || !rawLine.trim()) continue;

    const rowNumber = i + 1;
    const cols = rawLine.split("|").map((c) => c.trim());
    const nameRaw = cols[0] ?? "";
    const phoneRaw = cols[1] ?? "";
    const bgRaw = cols[2] ?? "";
    const ageRaw = cols[3] ?? "";
    const addrRaw = cols[4] ?? "";
    const totalRaw = cols[5] ?? "";
    const lastRaw = cols[6] ?? "";

    const issues: string[] = [];
    const missingOptionalFields: string[] = [];

    if (cols.length !== 7) {
      issues.push(`কলাম সংখ্যা অসামঞ্জস্যপূর্ণ (${cols.length}/7)`);
    }

    const missingName = !nameRaw || nameRaw === "-" || nameRaw === "—";
    if (missingName) {
      issues.push("নাম অনুপস্থিত বা '-' দেওয়া আছে");
    }

    const normalizedPhone = normalizeBdPhoneKey(phoneRaw);
    const phoneValid = /^01\d{9}$/.test(normalizedPhone);
    if (!phoneValid) {
      issues.push(`ফোন নম্বর যাচাইযোগ্য নয় (${phoneRaw || "খালি"})`);
    }

    const bgValid = validGroupSet.has(bgRaw);
    if (!bgValid) {
      issues.push(`অসমর্থিত রক্তের গ্রুপ (${bgRaw || "খালি"})`);
    }

    let parsedAge: number | null = null;
    if (!ageRaw) {
      missingOptionalFields.push("বয়স");
    } else if (/^\d+$/.test(ageRaw)) {
      const n = Number(ageRaw);
      if (n >= 16 && n <= 100) {
        parsedAge = n;
      } else {
        issues.push(`অস্বাভাবিক বয়স (${ageRaw})`);
      }
    } else {
      issues.push(`বয়স সংখ্যা নয় (${ageRaw})`);
    }

    const addrParsed = parseNoakhaliAddress(addrRaw);
    if (!addrParsed.address) {
      issues.push("ঠিকানা খালি");
    }

    let parsedTotal: number | null = null;
    if (!totalRaw) {
      issues.push("মোট রক্তদান সংখ্যা খালি");
    } else if (/^\d+$/.test(totalRaw)) {
      const t = Number(totalRaw);
      if (t >= 0 && t <= 500) {
        parsedTotal = t;
      } else {
        issues.push(`অস্বাভাবিক মোট রক্তদান (${totalRaw})`);
      }
    } else {
      issues.push(`মোট রক্তদান সংখ্যা নয় (${totalRaw})`);
    }

    const dateRes = parseSourceDonationDate(lastRaw);
    const missingOrInvalidDate = !dateRes.isValid;
    if (!dateRes.isValid) {
      issues.push(`শেষ রক্তদানের তারিখ অসম্পূর্ণ বা অবৈধ (${lastRaw || "খালি"})`);
    }

    // Photo is intentionally empty across this dataset
    missingOptionalFields.push("ছবি (পরে যুক্ত হবে)");

    rawParsed.push({
      rowNumber,
      rawLine,
      full_name: nameRaw,
      phone: phoneRaw,
      normalizedPhone,
      blood_group: bgRaw,
      age: parsedAge,
      ageRaw,
      address: addrParsed.address,
      upazila: addrParsed.upazila,
      district: addrParsed.district,
      total_donations: parsedTotal,
      totalDonationsRaw: totalRaw,
      last_donation_date: dateRes.isoDate,
      lastDonationRaw: lastRaw,
      lastDonationNote: dateRes.noteText,
      issues,
      missingName,
      missingOrInvalidDate,
      missingOptionalFields,
      isStructurallyValid: issues.length === 0,
    });
  }

  // Group source rows by normalized phone so we prefer a complete valid row over a truncated/invalid duplicate row
  const bestRowByPhone = new Map<string, number>();
  for (const r of rawParsed) {
    if (!r.normalizedPhone) continue;
    const prevRowNum = bestRowByPhone.get(r.normalizedPhone);
    if (prevRowNum === undefined) {
      bestRowByPhone.set(r.normalizedPhone, r.rowNumber);
    } else {
      const prevRec = rawParsed.find((x) => x.rowNumber === prevRowNum);
      if (prevRec && !prevRec.isStructurallyValid && r.isStructurallyValid) {
        bestRowByPhone.set(r.normalizedPhone, r.rowNumber);
      }
    }
  }

  const readyRecords: ParsedDonorSourceRecord[] = [];
  const alreadyExistingRecords: ParsedDonorSourceRecord[] = [];
  const potentialDuplicateRecords: ParsedDonorSourceRecord[] = [];
  const manualReviewRecords: ParsedDonorSourceRecord[] = [];
  const allRecords: ParsedDonorSourceRecord[] = [];

  for (const r of rawParsed) {
    const idempotencyId = buildDonorIdempotencyId(r.normalizedPhone, r.rowNumber);
    const existingByPhoneMatch = r.normalizedPhone ? existingByPhone.get(r.normalizedPhone) : undefined;
    const preferredRowForPhone = r.normalizedPhone ? bestRowByPhone.get(r.normalizedPhone) : r.rowNumber;
    const isSecondarySourcePhoneDup =
      Boolean(r.normalizedPhone) && preferredRowForPhone !== undefined && preferredRowForPhone !== r.rowNumber;

    const nn = normalizeNameForComparison(r.full_name);
    const nameGroupMatch =
      !existingByPhoneMatch && nn && nn !== "-" && r.blood_group
        ? existingByNameAndGroup.get(`${nn}|${r.blood_group}`)
        : undefined;

    let bucket: DonorImportBucket = "ready";
    let conflictReason: string | null = null;
    let duplicateOfRow: number | null = null;
    let matchedExistingDonor: ParsedDonorSourceRecord["matchedExistingDonor"] = null;

    if (existingByPhoneMatch) {
      bucket = "already_existing";
      matchedExistingDonor = {
        id: existingByPhoneMatch.id,
        full_name: existingByPhoneMatch.full_name,
        phone: existingByPhoneMatch.phone,
        blood_group: existingByPhoneMatch.blood_group,
        address: existingByPhoneMatch.address,
        last_donation_date: existingByPhoneMatch.last_donation_date,
        status: existingByPhoneMatch.status,
      };
      conflictReason = `ফোন নম্বর (${r.phone}) ডাটাবেজে আগে থেকেই বিদ্যমান (নাম: ${existingByPhoneMatch.full_name})`;
    } else if (!r.isStructurallyValid) {
      bucket = "manual_review";
      if (isSecondarySourcePhoneDup) {
        duplicateOfRow = preferredRowForPhone ?? null;
        conflictReason = `সারি #${preferredRowForPhone}-এর অসম্পূর্ণ ডুপ্লিকেট এবং তারিখ/তথ্যে ত্রুটি রয়েছে`;
      } else {
        conflictReason = r.issues.join(" • ");
      }
    } else if (isSecondarySourcePhoneDup) {
      bucket = "potential_duplicate";
      duplicateOfRow = preferredRowForPhone ?? null;
      conflictReason = `উৎস ফাইলের সারি #${preferredRowForPhone}-এর সাথে একই ফোন নম্বর (${r.phone})`;
    } else if (nameGroupMatch) {
      bucket = "potential_duplicate";
      matchedExistingDonor = {
        id: nameGroupMatch.id,
        full_name: nameGroupMatch.full_name,
        phone: nameGroupMatch.phone,
        blood_group: nameGroupMatch.blood_group,
        address: nameGroupMatch.address,
        last_donation_date: nameGroupMatch.last_donation_date,
        status: nameGroupMatch.status,
      };
      conflictReason = `ডাটাবেজের "${nameGroupMatch.full_name}" (${nameGroupMatch.blood_group}, ফোন: ${nameGroupMatch.phone})-এর সাথে নাম ও রক্তের গ্রুপ মিলে যায়`;
    }

    const record: ParsedDonorSourceRecord = {
      rowNumber: r.rowNumber,
      rawLine: r.rawLine,
      idempotencyId,
      full_name: r.full_name,
      phone: r.phone,
      normalizedPhone: r.normalizedPhone,
      blood_group: r.blood_group,
      age: r.age,
      ageRaw: r.ageRaw,
      address: r.address,
      upazila: r.upazila,
      district: r.district,
      total_donations: r.total_donations,
      totalDonationsRaw: r.totalDonationsRaw,
      last_donation_date: r.last_donation_date,
      lastDonationRaw: r.lastDonationRaw,
      lastDonationNote: r.lastDonationNote,
      photo_url: "",
      bucket,
      issues: r.issues,
      missingName: r.missingName,
      missingOrInvalidDate: r.missingOrInvalidDate,
      missingOptionalFields: r.missingOptionalFields,
      matchedExistingDonor,
      duplicateOfRow,
      conflictReason,
    };

    allRecords.push(record);
    if (bucket === "ready") readyRecords.push(record);
    else if (bucket === "already_existing") alreadyExistingRecords.push(record);
    else if (bucket === "potential_duplicate") potentialDuplicateRecords.push(record);
    else manualReviewRecords.push(record);
  }

  return {
    totalSourceRecords: allRecords.length,
    readyRecords,
    alreadyExistingRecords,
    potentialDuplicateRecords,
    manualReviewRecords,
    allRecords,
    missingNameCount: allRecords.filter((r) => r.missingName).length,
    invalidOrMissingDateCount: allRecords.filter((r) => r.missingOrInvalidDate).length,
    missingOptionalCount: allRecords.filter((r) => r.missingOptionalFields.length > 0).length,
    parsedAt: new Date().toISOString(),
  };
}

export interface ExecuteDonorImportOptions {
  analysis: DonorImportAnalysis;
  recordsToWrite: ParsedDonorSourceRecord[];
  targetStatus: ModerationStatus;
  batchSize?: number;
  onProgress?: (msg: string, percent: number) => void;
}

/**
 * Safely executes idempotent controlled batch writes to Firebase Firestore `blood_donors`.
 * Requires an active authenticated Staff / Super Admin Firebase session.
 */
export async function executeBloodDonorBatchImport(
  opts: ExecuteDonorImportOptions
): Promise<BloodDonorReconciliationReport> {
  const {
    analysis,
    recordsToWrite,
    targetStatus,
    batchSize = 25,
    onProgress,
  } = opts;

  const u = auth.currentUser;
  if (!u || !u.uid) {
    throw new Error(
      "Firestore-এ রক্তদাতা ইম্পোর্ট করতে অনুগ্রহ করে প্রথমে সুপার অ্যাডমিন/অ্যাডমিন Google বা পাসওয়ার্ড অ্যাকাউন্ট দিয়ে সাইন-ইন করুন।"
    );
  }

  onProgress?.("ডুপ্লিকেট সুরক্ষার জন্য Firestore-এর বর্তমান রক্তদাতা তালিকা যাচাই করা হচ্ছে...", 5);

  // Re-fetch live Firestore collection for strict idempotency before writing
  const liveSnap = await getDocs(collection(db, "blood_donors"));
  const liveIds = new Set<string>();
  const livePhones = new Set<string>();
  liveSnap.forEach((d) => {
    liveIds.add(d.id);
    const ph = normalizeBdPhoneKey(String(d.data()?.phone || ""));
    if (ph) liveIds.add(buildDonorIdempotencyId(ph, 0));
    if (ph) livePhones.add(ph);
  });

  const pendingWrites: ParsedDonorSourceRecord[] = [];
  let runtimeSkippedExisting = 0;

  for (const rec of recordsToWrite) {
    if (liveIds.has(rec.idempotencyId) || (rec.normalizedPhone && livePhones.has(rec.normalizedPhone))) {
      runtimeSkippedExisting += 1;
      continue;
    }
    pendingWrites.push(rec);
  }

  const importedIds: string[] = [];
  const failedRecords: Array<{ rowNumber: number; phone: string; full_name: string; error: string }> = [];
  const batchFailures: BatchImportFailure[] = [];

  const totalBatches = Math.max(1, Math.ceil(pendingWrites.length / batchSize));

  for (let b = 0; b < pendingWrites.length; b += batchSize) {
    const batchIdx = Math.floor(b / batchSize) + 1;
    const chunk = pendingWrites.slice(b, b + batchSize);
    const pct = Math.min(92, Math.round(10 + ((batchIdx - 1) / totalBatches) * 80));
    onProgress?.(
      `ব্যাচ ${batchIdx}/${totalBatches} সংরক্ষণ হচ্ছে (${chunk.length}টি রেকর্ড)...`,
      pct
    );

    try {
      const batch = writeBatch(db);
      for (const rec of chunk) {
        const docRef = doc(db, "blood_donors", rec.idempotencyId);
        const bg: BloodGroupType = (VALID_BLOOD_GROUPS as readonly string[]).includes(rec.blood_group)
          ? (rec.blood_group as BloodGroupType)
          : "O+";

        const payload: Record<string, unknown> = {
          author_id: sanitizeString(u.uid, 128, "admin"),
          full_name: sanitizeString(rec.full_name || "-", 120, "-"),
          phone: sanitizeString(rec.phone, 30, ""),
          blood_group: bg,
          address: sanitizeString(rec.address, 300, ""),
          upazila: sanitizeString(rec.upazila, 80, ""),
          district: sanitizeString(rec.district, 80, "নোয়াখালী"),
          age: Math.min(Math.max(Number(rec.age ?? 25) || 0, 0), 120),
          last_donation_date: sanitizeString(rec.last_donation_date ?? "", 40, ""),
          photo_url: "", // Photos intentionally left empty for future upload
          total_donations: Math.min(Math.max(Number(rec.total_donations ?? 0) || 0, 0), 500),
          status: targetStatus,
          import_source: "pasted_text_2",
          source_row: rec.rowNumber,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        batch.set(docRef, payload, { merge: false });
      }
      await batch.commit();
      for (const rec of chunk) {
        importedIds.push(rec.idempotencyId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      batchFailures.push({
        batchIndex: batchIdx,
        rowNumbers: chunk.map((c) => c.rowNumber),
        error: msg,
      });
      for (const rec of chunk) {
        failedRecords.push({
          rowNumber: rec.rowNumber,
          phone: rec.phone,
          full_name: rec.full_name,
          error: msg,
        });
      }
    }

    // Brief yield between batches to avoid Firestore write-stream burst throttling
    if (b + batchSize < pendingWrites.length) {
      await new Promise((res) => setTimeout(res, 150));
    }
  }

  onProgress?.("সংরক্ষিত Firestore রেকর্ড যাচাই ও রিকনসিলিয়েশন রিপোর্ট তৈরি হচ্ছে...", 95);

  let verifiedFirestoreTotalAfterImport: number | null = null;
  try {
    const verifySnap = await getDocs(collection(db, "blood_donors"));
    verifiedFirestoreTotalAfterImport = verifySnap.size;
  } catch {
    verifiedFirestoreTotalAfterImport = null;
  }

  const writeAttemptSet = new Set(recordsToWrite.map((r) => r.rowNumber));
  const alreadyExistingCount = analysis.alreadyExistingRecords.length + runtimeSkippedExisting;
  const potentialDuplicatesCount = analysis.potentialDuplicateRecords.filter(
    (r) => !writeAttemptSet.has(r.rowNumber)
  ).length;
  const manualReviewCount = analysis.manualReviewRecords.filter(
    (r) => !writeAttemptSet.has(r.rowNumber)
  ).length;
  const importedNewCount = importedIds.length;
  const failedCount = failedRecords.length;

  const accountSum =
    importedNewCount +
    alreadyExistingCount +
    potentialDuplicatesCount +
    manualReviewCount +
    failedCount;

  onProgress?.("ইম্পোর্ট প্রক্রিয়া সম্পন্ন হয়েছে!", 100);

  return {
    totalSourceRecords: analysis.totalSourceRecords,
    importedNewCount,
    alreadyExistingCount,
    potentialDuplicatesCount,
    manualReviewCount,
    failedCount,
    missingNameCount: analysis.missingNameCount,
    invalidOrMissingDateCount: analysis.invalidOrMissingDateCount,
    missingOptionalCount: analysis.missingOptionalCount,
    photosLeftEmptyConfirmed: true,
    reconciled: accountSum === analysis.totalSourceRecords,
    verifiedFirestoreTotalAfterImport,
    importedIds,
    failedRecords,
    batchFailures,
    completedAt: new Date().toISOString(),
  };
}
