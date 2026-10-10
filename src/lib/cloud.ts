import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { signInWithPopup } from "firebase/auth";
import {
  auth,
  db,
  googleProvider,
  SUPER_ADMIN_EMAIL,
  isSuperAdminEmail,
  isBootstrappedAdminEmail,
  OperationType,
  handleFirestoreError,
  sanitizeString,
  ensureCurrentUserProfileDoc,
} from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { recordStaffActivity } from "@/lib/staff-audit";

export type BloodGroupType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
export type ModerationStatus = "pending" | "approved" | "rejected";

export interface DonationRow {
  id: string;
  author_id?: string;
  sender_name: string;
  sender_phone: string | null;
  method: "bkash" | "nagad";
  trx_id: string;
  amount: number;
  note: string | null;
  status: ModerationStatus;
  created_at: string;
}

export interface SubmissionRow {
  id: string;
  author_id?: string;
  category_slug: string;
  title: string;
  body: string | null;
  contact: string | null;
  image_url: string | null;
  address: string | null;
  designation: string | null;
  status: ModerationStatus;
  created_at: string;
  updated_at: string;
}

export interface DonorRow {
  id: string;
  author_id?: string;
  full_name: string;
  phone: string;
  blood_group: BloodGroupType;
  address: string | null;
  age: number | null;
  last_donation_date: string | null;
  photo_url: string | null;
  total_donations: number;
  status: ModerationStatus;
  created_at: string;
  updated_at: string;
}

export interface DonorEventRow {
  id: string;
  author_id?: string;
  donor_id: string;
  event_date: string;
  place: string | null;
  form_image_url: string | null;
  photo_url: string | null;
  note: string | null;
  status: ModerationStatus;
  created_at: string;
}

export interface BannerRow {
  id: string;
  author_id?: string;
  title: string;
  message: string;
  blood_group: string | null;
  hospital: string | null;
  phone: string | null;
  visible: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AppLinkRow {
  id: string;
  platform: string;
  label: string;
  url: string;
  visible: boolean;
  sort_order: number;
  updated_at: string;
}

export interface EmergencyReqRow {
  id: string;
  author_id?: string;
  patient_name: string;
  phone: string;
  blood_group: string;
  hospital: string | null;
  message: string | null;
  status: ModerationStatus;
  created_at: string;
  updated_at: string;
}

export interface CategoryAccessRow {
  id: string;
  user_id: string;
  category_slug: string;
  created_at: string;
}

export interface ChatThreadRow {
  id: string;
  user_id: string;
  last_message_at: string;
  last_message_preview: string | null;
  user_unread: number;
  staff_unread: number;
  created_at: string;
}

export interface PrivateMessageRow {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_role: "user" | "staff";
  sender_name?: string;
  sender_photo?: string;
  sender_role_label?: string;
  body: string | null;
  attachment_url: string | null;
  created_at: string;
}

function tsToIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "toDate" in val && typeof (val as { toDate: () => Date }).toDate === "function") {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function normalizeDoc<T>(id: string, data: DocumentData): T {
  const created_at = tsToIso(data.createdAt ?? data.created_at);
  const updated_at = tsToIso(data.updatedAt ?? data.updated_at ?? created_at);
  return {
    ...data,
    id,
    created_at,
    updated_at,
  } as unknown as T;
}

function genId(): string {
  return crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, "");
}

function getCurrentActorInfo(): { uid: string; isStaff: boolean; isSuper: boolean } {
  if (auth.currentUser?.uid) {
    const email = auth.currentUser.email || "";
    const isSuper = isSuperAdminEmail(email);
    const isBoot = isBootstrappedAdminEmail(email);
    return {
      uid: auth.currentUser.uid,
      isStaff: isSuper || isBoot,
      isSuper,
    };
  }
  try {
    if (sessionStorage.getItem("sn_super_admin_session_v1") === "true") {
      return { uid: "super_admin_mahmudul", isStaff: true, isSuper: true };
    }
    const raw = sessionStorage.getItem("sn_verified_user_session_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      const u = parsed?.user;
      const roles: string[] = Array.isArray(parsed?.roles) ? parsed.roles : [];
      if (u?.uid) {
        const isSuper = isSuperAdminEmail(u.email);
        const isStaff =
          isSuper ||
          roles.includes("admin") ||
          roles.includes("editor") ||
          roles.includes("moderator");
        return {
          uid: String(u.uid).replace(/[^a-zA-Z0-9_-]/g, "_"),
          isStaff,
          isSuper,
        };
      }
    }
  } catch {
    // ignore
  }
  let anonId = "";
  try {
    anonId = localStorage.getItem("sn_visitor_uid_v1") || "";
    if (!anonId) {
      anonId = `user_${genId().slice(0, 16)}`;
      localStorage.setItem("sn_visitor_uid_v1", anonId);
    }
  } catch {
    anonId = `user_${genId().slice(0, 16)}`;
  }
  return { uid: anonId, isStaff: false, isSuper: false };
}

// ============================================================================
// Universal 3-Layer Cloud Mirror & Auto-Sync Engine
// (Native Firestore Collections + Firestore Settings + Hosting /api/content + LocalStorage)
// ============================================================================
export interface CloudMirrorState {
  collections: Record<string, Record<string, Record<string, any>>>;
  deletedIds: Record<string, Record<string, string>>;
  updatedAt: string;
}

const LOCAL_CLOUD_MIRROR_KEY = "sn_cloud_mirror_v1";
const CLOUD_MIRROR_SETTING_ID = "staff_profiles_config";

export function readLocalCloudMirror(): CloudMirrorState {
  try {
    const raw = localStorage.getItem(LOCAL_CLOUD_MIRROR_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          collections: parsed.collections || {},
          deletedIds: parsed.deletedIds || {},
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        };
      }
    }
  } catch {
    // ignore
  }
  return { collections: {}, deletedIds: {}, updatedAt: new Date(0).toISOString() };
}

export function writeLocalCloudMirror(state: CloudMirrorState) {
  try {
    localStorage.setItem(LOCAL_CLOUD_MIRROR_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("sn-cloud-mirror-updated"));
  } catch {
    // ignore
  }
}

export function mergeCloudMirrorState(incoming: Partial<CloudMirrorState> | null | undefined): CloudMirrorState {
  const cur = readLocalCloudMirror();
  if (!incoming || typeof incoming !== "object") return cur;

  const collections: Record<string, Record<string, Record<string, any>>> = {
    ...cur.collections,
  };
  const deletedIds: Record<string, Record<string, string>> = {
    ...cur.deletedIds,
  };

  if (incoming.deletedIds && typeof incoming.deletedIds === "object") {
    for (const [col, delMap] of Object.entries(incoming.deletedIds)) {
      if (!delMap || typeof delMap !== "object") continue;
      deletedIds[col] = { ...(deletedIds[col] || {}) };
      for (const [docId, delAt] of Object.entries(delMap)) {
        const prevDel = deletedIds[col][docId];
        if (!prevDel || String(delAt) > prevDel) {
          deletedIds[col][docId] = String(delAt);
        }
      }
    }
  }

  if (incoming.collections && typeof incoming.collections === "object") {
    for (const [col, docMap] of Object.entries(incoming.collections)) {
      if (!docMap || typeof docMap !== "object") continue;
      collections[col] = { ...(collections[col] || {}) };
      for (const [docId, docVal] of Object.entries(docMap)) {
        if (!docVal || typeof docVal !== "object") continue;
        const prevDoc = collections[col][docId];
        const nextUpdated = String(docVal.updated_at || docVal.created_at || "");
        const prevUpdated = prevDoc ? String(prevDoc.updated_at || prevDoc.created_at || "") : "";
        if (!prevDoc || nextUpdated >= prevUpdated) {
          collections[col][docId] = docVal;
        }
      }
    }
  }

  // Enforce tombstones vs newer restorations
  for (const [col, delMap] of Object.entries(deletedIds)) {
    if (!collections[col]) continue;
    for (const [docId, delAt] of Object.entries(delMap)) {
      const docVal = collections[col][docId];
      if (docVal) {
        const docUpd = String(docVal.updated_at || docVal.created_at || "");
        if (docUpd > delAt) {
          delete deletedIds[col][docId];
        } else {
          delete collections[col][docId];
        }
      }
    }
  }

  const next: CloudMirrorState = {
    collections,
    deletedIds,
    updatedAt: new Date().toISOString(),
  };
  writeLocalCloudMirror(next);
  return next;
}

async function persistCloudMirrorEverywhere(state: CloudMirrorState) {
  // 1. Sync to Hosting API (/api/content/sync)
  try {
    await fetch("/api/content/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cloud_mirror: state }),
    });
  } catch {
    // ignore
  }

  // 2. Sync compact mirror to Firebase Firestore (/settings/staff_profiles_config) when verified
  if (auth.currentUser?.emailVerified) {
    try {
      const ref = doc(db, "settings", CLOUD_MIRROR_SETTING_ID);
      const snap = await getDoc(ref);
      let obj: Record<string, any> = {};
      if (snap.exists()) {
        const raw = snap.data().logo_url;
        if (typeof raw === "string" && raw.trim()) {
          try {
            obj = JSON.parse(raw) || {};
          } catch {
            obj = {};
          }
        }
      }
      // Strip oversized base64 images from the settings backup so it stays compact
      const compactCollections: Record<string, Record<string, any>> = {};
      for (const [col, map] of Object.entries(state.collections)) {
        compactCollections[col] = {};
        for (const [id, item] of Object.entries(map)) {
          const clone = { ...item };
          for (const imgKey of ["image_url", "photo_url", "form_image_url", "url"]) {
            if (typeof clone[imgKey] === "string" && clone[imgKey].length > 15000) {
              clone[imgKey] = "";
            }
          }
          compactCollections[col][id] = clone;
        }
      }
      obj._cloudMirror = {
        collections: compactCollections,
        deletedIds: state.deletedIds,
        updatedAt: state.updatedAt,
      };
      const serialized = sanitizeString(JSON.stringify(obj), 295000, "{}");
      if (!snap.exists()) {
        await setDoc(ref, {
          key: CLOUD_MIRROR_SETTING_ID,
          logo_url: serialized,
          visible: true,
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(ref, {
          logo_url: serialized,
          visible: true,
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // ignore
    }
  }
}

export function upsertCloudMirrorDoc(collectionName: string, id: string, docData: Record<string, any>) {
  const cur = readLocalCloudMirror();
  const nowIso = new Date().toISOString();
  const nextDoc = {
    ...docData,
    id,
    created_at: String(docData.created_at || nowIso),
    updated_at: String(docData.updated_at || nowIso),
  };
  const colMap = { ...(cur.collections[collectionName] || {}), [id]: nextDoc };
  const delMap = { ...(cur.deletedIds[collectionName] || {}) };
  delete delMap[id];

  const next: CloudMirrorState = {
    collections: { ...cur.collections, [collectionName]: colMap },
    deletedIds: { ...cur.deletedIds, [collectionName]: delMap },
    updatedAt: nowIso,
  };
  writeLocalCloudMirror(next);
  void persistCloudMirrorEverywhere(next);
}

export function removeCloudMirrorDoc(collectionName: string, id: string) {
  const cur = readLocalCloudMirror();
  const nowIso = new Date().toISOString();
  const colMap = { ...(cur.collections[collectionName] || {}) };
  delete colMap[id];
  const delMap = { ...(cur.deletedIds[collectionName] || {}), [id]: nowIso };

  const next: CloudMirrorState = {
    collections: { ...cur.collections, [collectionName]: colMap },
    deletedIds: { ...cur.deletedIds, [collectionName]: delMap },
    updatedAt: nowIso,
  };
  writeLocalCloudMirror(next);
  void persistCloudMirrorEverywhere(next);
}

let lastMirrorPullAt = 0;
export async function pullCloudMirrorFromRemote(): Promise<CloudMirrorState> {
  const now = Date.now();
  if (now - lastMirrorPullAt < 1800) {
    return readLocalCloudMirror();
  }
  lastMirrorPullAt = now;

  // 1. Pull from Hosting API (/api/content)
  try {
    const resp = await fetch("/api/content");
    if (resp.ok && (resp.headers.get("content-type") || "").includes("application/json")) {
      const data = await resp.json();
      if (data?.cloud_mirror) {
        mergeCloudMirrorState(data.cloud_mirror);
      }
    }
  } catch {
    // ignore
  }

  // 2. Pull from Firestore settings (/settings/staff_profiles_config)
  try {
    const snap = await getDoc(doc(db, "settings", CLOUD_MIRROR_SETTING_ID));
    if (snap.exists()) {
      const raw = snap.data().logo_url;
      if (typeof raw === "string" && raw.trim()) {
        const parsed = JSON.parse(raw);
        if (parsed?._cloudMirror) {
          mergeCloudMirrorState(parsed._cloudMirror);
        }
      }
    }
  } catch {
    // ignore
  }

  return readLocalCloudMirror();
}

async function syncSingleDocToNativeFirestore(
  collectionName: string,
  id: string,
  item: Record<string, any>
): Promise<boolean> {
  const u = auth.currentUser;
  if (!u || !u.emailVerified) return false;

  try {
    await ensureCurrentUserProfileDoc(u).catch(() => {});
    const ref = doc(db, collectionName, id);
    const snap = await getDoc(ref);
    const exists = snap.exists();
    const authorId = exists
      ? String(snap.data().author_id || u.uid)
      : u.uid;
    const createdAtVal = exists ? snap.data().createdAt : serverTimestamp();

    if (collectionName === "donations") {
      const isSuper = isSuperAdminEmail(u.email);
      const status =
        isSuper && (item.status === "approved" || item.status === "rejected" || item.status === "pending")
          ? item.status
          : exists
          ? String(snap.data().status || "pending")
          : "pending";
      const payload = {
        author_id: authorId,
        sender_name: sanitizeString(item.sender_name, 120, "Anonymous"),
        sender_phone: sanitizeString(item.sender_phone ?? "", 30, ""),
        method: item.method === "nagad" ? "nagad" : "bkash",
        trx_id: sanitizeString(item.trx_id, 64, "TRX00"),
        amount: Math.min(Math.max(Number(item.amount) || 1, 1), 10000000),
        note: sanitizeString(item.note ?? "", 500, ""),
        status,
        createdAt: createdAtVal,
        updatedAt: serverTimestamp(),
      };
      if (!exists) await setDoc(ref, payload);
      else if (isSuper) await updateDoc(ref, payload);
      return true;
    }

    if (collectionName === "submissions") {
      const canMod = isBootstrappedAdminEmail(u.email);
      const status =
        canMod && (item.status === "approved" || item.status === "rejected" || item.status === "pending")
          ? item.status
          : exists
          ? String(snap.data().status || "pending")
          : "pending";
      const payload = {
        author_id: authorId,
        category_slug: sanitizeString(item.category_slug, 80, "general").replace(/[^a-zA-Z0-9_-]/g, "-"),
        title: sanitizeString(item.title, 200, "শিরোনাম"),
        body: sanitizeString(item.body ?? "", 2000, ""),
        contact: sanitizeString(item.contact ?? "", 100, ""),
        image_url: sanitizeString(item.image_url ?? (exists ? snap.data().image_url : ""), 200000, ""),
        address: sanitizeString(item.address ?? "", 300, ""),
        designation: sanitizeString(item.designation ?? "", 150, ""),
        status,
        createdAt: createdAtVal,
        updatedAt: serverTimestamp(),
      };
      if (!exists) await setDoc(ref, payload);
      else await updateDoc(ref, payload);
      return true;
    }

    if (collectionName === "blood_donors") {
      const canMod = isBootstrappedAdminEmail(u.email);
      const status =
        canMod && (item.status === "approved" || item.status === "rejected" || item.status === "pending")
          ? item.status
          : exists
          ? String(snap.data().status || "pending")
          : "pending";
      const validGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
      const bg = validGroups.includes(String(item.blood_group)) ? String(item.blood_group) : "O+";
      const payload = {
        author_id: authorId,
        full_name: sanitizeString(item.full_name, 120, "রক্তদাতা"),
        phone: sanitizeString(item.phone, 30, "01700000000"),
        blood_group: bg,
        address: sanitizeString(item.address ?? "", 300, ""),
        age: Math.min(Math.max(Number(item.age ?? 25) || 0, 0), 120),
        last_donation_date: sanitizeString(item.last_donation_date ?? "", 40, ""),
        photo_url: sanitizeString(item.photo_url ?? (exists ? snap.data().photo_url : ""), 200000, ""),
        total_donations: Math.min(Math.max(Number(item.total_donations ?? 0) || 0, 0), 500),
        status,
        createdAt: createdAtVal,
        updatedAt: serverTimestamp(),
      };
      if (!exists) await setDoc(ref, payload);
      else await updateDoc(ref, payload);
      return true;
    }

    if (collectionName === "donation_events") {
      const canMod = isBootstrappedAdminEmail(u.email);
      const status =
        canMod && (item.status === "approved" || item.status === "rejected" || item.status === "pending")
          ? item.status
          : exists
          ? String(snap.data().status || "pending")
          : "pending";
      const payload = {
        author_id: authorId,
        donor_id: sanitizeString(item.donor_id, 128, ""),
        event_date: sanitizeString(item.event_date, 40, new Date().toISOString().slice(0, 10)),
        place: sanitizeString(item.place ?? "", 200, ""),
        form_image_url: sanitizeString(item.form_image_url ?? (exists ? snap.data().form_image_url : ""), 200000, ""),
        photo_url: sanitizeString(item.photo_url ?? (exists ? snap.data().photo_url : ""), 200000, ""),
        note: sanitizeString(item.note ?? "", 500, ""),
        status,
        createdAt: createdAtVal,
        updatedAt: serverTimestamp(),
      };
      if (!exists) await setDoc(ref, payload);
      else await updateDoc(ref, payload);
      return true;
    }

    if (collectionName === "emergency_banners") {
      const payload = {
        author_id: authorId,
        title: sanitizeString(item.title || "জরুরী রক্তের প্রয়োজন", 150, "জরুরী রক্তের প্রয়োজন"),
        message: sanitizeString(item.message || "জরুরী রক্তের প্রয়োজন", 1000, "জরুরী রক্তের প্রয়োজন"),
        blood_group: sanitizeString(item.blood_group ?? "", 10, ""),
        hospital: sanitizeString(item.hospital ?? "", 200, ""),
        phone: sanitizeString(item.phone ?? "", 30, ""),
        visible: Boolean(item.visible ?? true),
        sort_order: Math.min(Math.max(Number(item.sort_order ?? 0) || 0, 0), 10000),
        createdAt: createdAtVal,
        updatedAt: serverTimestamp(),
      };
      if (!exists) await setDoc(ref, payload);
      else await updateDoc(ref, payload);
      return true;
    }

    if (collectionName === "app_links") {
      if (!isSuperAdminEmail(u.email)) return false;
      const payload = {
        platform: sanitizeString(item.platform || (id.includes("ios") ? "ios" : "android"), 40, "android"),
        label: sanitizeString(item.label || "App", 120, "App"),
        url: sanitizeString(item.url ?? "", 295000, ""),
        visible: Boolean(item.visible ?? true),
        sort_order: Math.min(Math.max(Number(item.sort_order ?? 1) || 0, 0), 1000),
        createdAt: createdAtVal,
        updatedAt: serverTimestamp(),
      };
      if (!exists) await setDoc(ref, payload);
      else await updateDoc(ref, payload);
      return true;
    }

    if (collectionName === "emergency_blood_requests") {
      const canMod = isBootstrappedAdminEmail(u.email);
      const status =
        canMod && (item.status === "approved" || item.status === "rejected" || item.status === "pending")
          ? item.status
          : exists
          ? String(snap.data().status || "pending")
          : "pending";
      const validGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
      const bg = validGroups.includes(String(item.blood_group)) ? String(item.blood_group) : "O+";
      const payload = {
        author_id: authorId,
        patient_name: sanitizeString(item.patient_name, 120, "রোগী"),
        phone: sanitizeString(item.phone, 30, "01700000000"),
        blood_group: bg,
        hospital: sanitizeString(item.hospital ?? "", 200, ""),
        message: sanitizeString(item.message ?? "", 1000, ""),
        status,
        createdAt: createdAtVal,
        updatedAt: serverTimestamp(),
      };
      if (!exists) await setDoc(ref, payload);
      else await updateDoc(ref, payload);
      return true;
    }

    if (collectionName === "category_access") {
      if (!isSuperAdminEmail(u.email)) return false;
      if (!exists) {
        await setDoc(ref, {
          user_id: sanitizeString(item.user_id, 128, ""),
          category_slug: sanitizeString(item.category_slug, 80, "").replace(/[^a-zA-Z0-9_-]/g, "-"),
          createdAt: serverTimestamp(),
        });
      }
      return true;
    }
  } catch {
    // Will retry or stay persisted in mirror
  }
  return false;
}

type FilterMode = "moderated" | "visible" | "user_owned";

function useFirestoreRealtime<
  T extends {
    id: string;
    created_at?: string;
    updated_at?: string;
    sort_order?: number;
    last_message_at?: string;
    status?: string;
    visible?: boolean;
    author_id?: string;
    user_id?: string;
  }
>(
  collectionName: string,
  mode: FilterMode,
  order: { col: "created_at" | "sort_order" | "last_message_at"; asc: boolean } = {
    col: "created_at",
    asc: false,
  }
) {
  const {
    user,
    firebaseUser,
    loading: authLoading,
    isStaff,
    isAdmin,
    isMainAdmin,
    isFirebaseVerifiedAdmin,
    isFirebaseVerifiedSuperAdmin,
  } = useAuth();
  const [fsItems, setFsItems] = useState<T[]>([]);
  const [mirrorState, setMirrorState] = useState<CloudMirrorState>(() => readLocalCloudMirror());
  const [loading, setLoading] = useState(true);

  const superOnlyCollections = ["donations", "category_access", "app_links"];
  const canQueryUnfiltered = superOnlyCollections.includes(collectionName)
    ? isFirebaseVerifiedSuperAdmin
    : isFirebaseVerifiedAdmin;

  const canSeeAllInUI = superOnlyCollections.includes(collectionName)
    ? isMainAdmin
    : isMainAdmin || isAdmin || isStaff;

  // 1. Subscribe to CloudMirrorState (Local + Hosting API + Firestore Settings)
  useEffect(() => {
    let active = true;
    const onMirrorEvent = () => {
      if (active) setMirrorState(readLocalCloudMirror());
    };
    window.addEventListener("sn-cloud-mirror-updated", onMirrorEvent);

    void pullCloudMirrorFromRemote().then((s) => {
      if (active) {
        setMirrorState(s);
        setLoading(false);
      }
    });

    const timer = setInterval(() => {
      void pullCloudMirrorFromRemote().then((s) => {
        if (active) setMirrorState(s);
      });
    }, 3500);

    return () => {
      active = false;
      window.removeEventListener("sn-cloud-mirror-updated", onMirrorEvent);
      clearInterval(timer);
    };
  }, [collectionName]);

  // 2. Subscribe to Native Firebase Firestore Collection
  useEffect(() => {
    if (authLoading) return;

    if (mode === "user_owned" && !firebaseUser && !isMainAdmin) {
      setFsItems([]);
      setLoading(false);
      return;
    }

    const colRef = collection(db, collectionName);
    const q = canQueryUnfiltered
      ? query(colRef)
      : mode === "moderated"
      ? query(colRef, where("status", "==", "approved"))
      : mode === "visible"
      ? query(colRef, where("visible", "==", true))
      : firebaseUser
      ? query(colRef, where("user_id", "==", firebaseUser.uid))
      : null;

    if (!q) {
      setFsItems([]);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => normalizeDoc<T>(d.id, d.data()));
        setFsItems(list);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, [
    collectionName,
    mode,
    order.col,
    order.asc,
    authLoading,
    firebaseUser?.uid,
    canQueryUnfiltered,
    isMainAdmin,
  ]);

  // 3. Background Auto-Sync: Push any unsynced mirror items or deletions to Native Firestore when verified
  useEffect(() => {
    if (collectionName === "chat_threads" || !auth.currentUser?.emailVerified) return;
    const colMirror = mirrorState.collections[collectionName] || {};
    const colDeleted = mirrorState.deletedIds[collectionName] || {};
    const fsMap = new Map<string, T>();
    for (const f of fsItems) fsMap.set(f.id, f);

    // Sync deletions to native Firestore
    if (isBootstrappedAdminEmail(auth.currentUser.email)) {
      for (const [delId, delAt] of Object.entries(colDeleted)) {
        const fsDoc = fsMap.get(delId);
        if (fsDoc) {
          const fsUpd = String(fsDoc.updated_at || fsDoc.created_at || "");
          if (!fsUpd || fsUpd <= delAt) {
            void deleteDoc(doc(db, collectionName, delId)).catch(() => {});
          }
        }
      }
    }

    // Sync creations / updates to native Firestore
    for (const [docId, mDoc] of Object.entries(colMirror)) {
      if (colDeleted[docId]) continue;
      const fsDoc = fsMap.get(docId);
      const mUpd = String(mDoc.updated_at || mDoc.created_at || "");
      const fsUpd = fsDoc ? String(fsDoc.updated_at || fsDoc.created_at || "") : "";
      if (!fsDoc || mUpd > fsUpd) {
        if (isBootstrappedAdminEmail(auth.currentUser.email) || !fsDoc) {
          void syncSingleDocToNativeFirestore(collectionName, docId, mDoc);
        }
      }
    }
  }, [collectionName, fsItems, mirrorState]);

  // 4. Merge Native Firestore + Mirror State + Tombstones + Role Filtering
  const items = (() => {
    const colMirror = mirrorState.collections[collectionName] || {};
    const colDeleted = mirrorState.deletedIds[collectionName] || {};
    const mergedMap = new Map<string, T>();

    for (const f of fsItems) {
      const delAt = colDeleted[f.id];
      const fUpd = String(f.updated_at || f.created_at || "");
      if (delAt && (!fUpd || fUpd <= delAt)) continue;
      mergedMap.set(f.id, f);
    }

    if (collectionName !== "chat_threads") {
      for (const [docId, mRaw] of Object.entries(colMirror)) {
        const m = mRaw as T;
        const delAt = colDeleted[docId];
        const mUpd = String(m.updated_at || m.created_at || "");
        if (delAt && (!mUpd || mUpd <= delAt)) continue;

        const existing = mergedMap.get(docId);
        const exUpd = existing ? String(existing.updated_at || existing.created_at || "") : "";
        if (!existing || mUpd >= exUpd) {
          mergedMap.set(docId, { ...existing, ...m, id: docId });
        }
      }
    }

    const filtered = Array.from(mergedMap.values()).filter((item) => {
      if (canSeeAllInUI) return true;
      if (mode === "moderated") {
        return (
          item.status === "approved" ||
          Boolean(user?.uid && (item.author_id === user.uid || item.user_id === user.uid))
        );
      }
      if (mode === "visible") {
        return item.visible !== false;
      }
      if (mode === "user_owned") {
        return Boolean(user?.uid && (item.user_id === user.uid || item.author_id === user.uid));
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (order.col === "sort_order") {
        const sa = Number(a.sort_order ?? 0);
        const sb = Number(b.sort_order ?? 0);
        return order.asc ? sa - sb : sb - sa;
      }
      const ka = String((a as Record<string, unknown>)[order.col] ?? a.created_at ?? "");
      const kb = String((b as Record<string, unknown>)[order.col] ?? b.created_at ?? "");
      return order.asc ? ka.localeCompare(kb) : kb.localeCompare(ka);
    });

    return filtered;
  })();

  return { items, loading };
}

// ---------- Donations ----------
export function useCloudDonations() {
  const { items, loading } = useFirestoreRealtime<DonationRow>("donations", "moderated");

  const add = async (d: {
    sender_name: string;
    sender_phone?: string;
    method: "bkash" | "nagad";
    trx_id: string;
    amount: number;
    note?: string;
    status?: "pending" | "approved" | "rejected";
  }) => {
    try {
      const actor = getCurrentActorInfo();
      const id = genId();
      const nowIso = new Date().toISOString();
      const nextStatus = actor.isSuper && d.status ? d.status : "pending";
      const row: DonationRow & { updated_at: string } = {
        id,
        author_id: actor.uid,
        sender_name: sanitizeString(d.sender_name, 120, "Anonymous"),
        sender_phone: sanitizeString(d.sender_phone ?? "", 30, ""),
        method: d.method === "nagad" ? "nagad" : "bkash",
        trx_id: sanitizeString(d.trx_id, 64, "TRX00"),
        amount: Math.min(Math.max(Number(d.amount) || 1, 1), 10000000),
        note: sanitizeString(d.note ?? "", 500, ""),
        status: nextStatus,
        created_at: nowIso,
        updated_at: nowIso,
      };
      upsertCloudMirrorDoc("donations", id, row);
      await syncSingleDocToNativeFirestore("donations", id, row);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "ত্রুটি" };
    }
  };

  const setStatus = async (id: string, status: "approved" | "rejected" | "pending") => {
    const existing = items.find((x) => x.id === id);
    try {
      const nowIso = new Date().toISOString();
      const updated = {
        ...(existing || { id }),
        status,
        updated_at: nowIso,
      };
      upsertCloudMirrorDoc("donations", id, updated);
      if (auth.currentUser?.emailVerified) {
        await updateDoc(doc(db, "donations", id), {
          status,
          updatedAt: serverTimestamp(),
        }).catch(() => syncSingleDocToNativeFirestore("donations", id, updated));
      }
      void recordStaffActivity({
        action_type: status === "approved" ? "approve" : "reject",
        action_label: status === "approved" ? "অনুদান অনুমোদন করেছে" : "অনুদান বাতিল করেছে",
        module: "donation",
        module_label: "অনুদান",
        target_id: id,
        target_title: existing ? `${existing.sender_name} (${existing.amount}৳)` : id,
        target_detail: existing
          ? `মাধ্যম: ${existing.method} • ফোন: ${existing.sender_phone || "—"} • TrxID: ${existing.trx_id}`
          : `স্ট্যাটাস: ${status}`,
      });
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  const remove = async (id: string) => {
    const existing = items.find((x) => x.id === id);
    try {
      removeCloudMirrorDoc("donations", id);
      if (auth.currentUser?.emailVerified) {
        await deleteDoc(doc(db, "donations", id)).catch(() => {});
      }
      void recordStaffActivity({
        action_type: "delete",
        action_label: "অনুদান ডিলিট করেছে",
        module: "donation",
        module_label: "অনুদান",
        target_id: id,
        target_title: existing ? `${existing.sender_name} (${existing.amount}৳)` : id,
        target_detail: existing
          ? `মাধ্যম: ${existing.method} • ফোন: ${existing.sender_phone || "—"} • TrxID: ${existing.trx_id}`
          : "অনুদান এন্ট্রি মুছে ফেলা হয়েছে",
        deleted_snapshot: existing ? ({ ...existing } as unknown as Record<string, unknown>) : null,
        collection_name: "donations",
      });
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  const update = async (id: string, patch: Partial<DonationRow>) => {
    const existing = items.find((x) => x.id === id);
    try {
      const nowIso = new Date().toISOString();
      const updated = {
        ...(existing || { id }),
        ...patch,
        updated_at: nowIso,
      };
      upsertCloudMirrorDoc("donations", id, updated);
      if (auth.currentUser?.emailVerified) {
        await updateDoc(doc(db, "donations", id), {
          ...patch,
          updatedAt: serverTimestamp(),
        }).catch(() => syncSingleDocToNativeFirestore("donations", id, updated));
      }
      void recordStaffActivity({
        action_type: "edit",
        action_label: "অনুদান তথ্য এডিট করেছে",
        module: "donation",
        module_label: "অনুদান",
        target_id: id,
        target_title: patch.sender_name || existing?.sender_name || id,
        target_detail: `পরিমাণ: ${patch.amount ?? existing?.amount ?? 0}৳ • TrxID: ${patch.trx_id ?? existing?.trx_id ?? ""}`,
      });
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  return { items, loading, add, setStatus, remove, update };
}

// ---------- Submissions ----------
export function useCloudSubmissions() {
  const { items, loading } = useFirestoreRealtime<SubmissionRow>("submissions", "moderated");

  const add = async (s: {
    category_slug: string;
    title: string;
    body?: string;
    contact?: string;
    image_url?: string;
    address?: string;
    designation?: string;
    status?: "pending" | "approved" | "rejected";
  }) => {
    try {
      const actor = getCurrentActorInfo();
      const id = genId();
      const nowIso = new Date().toISOString();
      const nextStatus = actor.isStaff && s.status ? s.status : "pending";
      const row: SubmissionRow = {
        id,
        author_id: actor.uid,
        category_slug: sanitizeString(s.category_slug, 80, "general").replace(/[^a-zA-Z0-9_-]/g, "-"),
        title: sanitizeString(s.title, 200, "শিরোনাম"),
        body: sanitizeString(s.body ?? "", 2000, ""),
        contact: sanitizeString(s.contact ?? "", 100, ""),
        image_url: sanitizeString(s.image_url ?? "", 200000, ""),
        address: sanitizeString(s.address ?? "", 300, ""),
        designation: sanitizeString(s.designation ?? "", 150, ""),
        status: nextStatus,
        created_at: nowIso,
        updated_at: nowIso,
      };
      upsertCloudMirrorDoc("submissions", id, row);
      await syncSingleDocToNativeFirestore("submissions", id, row);
      if (s.status === "approved" || actor.isStaff) {
        void recordStaffActivity({
          action_type: "create",
          action_label: "নতুন তথ্য সরাসরি যোগ করেছে",
          module: "info",
          module_label: "তথ্য ডিরেক্টরি",
          target_id: id,
          target_title: s.title,
          target_detail: `ক্যাটাগরি: ${s.category_slug} • ফোন: ${s.contact || "—"} • ঠিকানা: ${s.address || "—"}`,
        });
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "ত্রুটি" };
    }
  };

  const setStatus = async (id: string, status: "approved" | "rejected" | "pending") => {
    const existing = items.find((x) => x.id === id);
    try {
      const nowIso = new Date().toISOString();
      const updated = {
        ...(existing || { id }),
        status,
        updated_at: nowIso,
      };
      upsertCloudMirrorDoc("submissions", id, updated);
      if (auth.currentUser?.emailVerified) {
        await updateDoc(doc(db, "submissions", id), {
          status,
          updatedAt: serverTimestamp(),
        }).catch(() => syncSingleDocToNativeFirestore("submissions", id, updated));
      }
      void recordStaffActivity({
        action_type: status === "approved" ? "approve" : "reject",
        action_label: status === "approved" ? "তথ্য অনুমোদন (Approve) করেছে" : "তথ্য বাতিল (Reject) করেছে",
        module: "info",
        module_label: "তথ্য ডিরেক্টরি",
        target_id: id,
        target_title: existing?.title || id,
        target_detail: existing
          ? `ক্যাটাগরি: ${existing.category_slug} • ফোন: ${existing.contact || "—"} • ঠিকানা: ${existing.address || "—"}`
          : `স্ট্যাটাস: ${status}`,
      });
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  const update = async (id: string, patch: Partial<SubmissionRow>) => {
    const existing = items.find((x) => x.id === id);
    try {
      const nowIso = new Date().toISOString();
      const sanitizedPatch: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (patch.category_slug !== undefined) {
        sanitizedPatch.category_slug = sanitizeString(patch.category_slug, 80, "general").replace(/[^a-zA-Z0-9_-]/g, "-");
      }
      if (patch.title !== undefined) sanitizedPatch.title = sanitizeString(patch.title, 200, "শিরোনাম");
      if (patch.body !== undefined) sanitizedPatch.body = sanitizeString(patch.body ?? "", 2000, "");
      if (patch.contact !== undefined) sanitizedPatch.contact = sanitizeString(patch.contact ?? "", 100, "");
      if (patch.image_url !== undefined) sanitizedPatch.image_url = sanitizeString(patch.image_url ?? "", 200000, "");
      if (patch.address !== undefined) sanitizedPatch.address = sanitizeString(patch.address ?? "", 300, "");
      if (patch.designation !== undefined) sanitizedPatch.designation = sanitizeString(patch.designation ?? "", 150, "");
      if (patch.status !== undefined) sanitizedPatch.status = patch.status;

      const updated = {
        ...(existing || { id }),
        ...patch,
        updated_at: nowIso,
      };
      upsertCloudMirrorDoc("submissions", id, updated);
      if (auth.currentUser?.emailVerified) {
        await updateDoc(doc(db, "submissions", id), sanitizedPatch).catch(() =>
          syncSingleDocToNativeFirestore("submissions", id, updated)
        );
      }
      void recordStaffActivity({
        action_type: "edit",
        action_label: "তথ্য সম্পাদনা (Edit) করেছে",
        module: "info",
        module_label: "তথ্য ডিরেক্টরি",
        target_id: id,
        target_title: patch.title || existing?.title || id,
        target_detail: `ক্যাটাগরি: ${patch.category_slug || existing?.category_slug || "—"} • ফোন: ${patch.contact ?? existing?.contact ?? "—"} • ঠিকানা: ${patch.address ?? existing?.address ?? "—"}`,
      });
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  const remove = async (id: string) => {
    const existing = items.find((x) => x.id === id);
    try {
      removeCloudMirrorDoc("submissions", id);
      if (auth.currentUser?.emailVerified) {
        await deleteDoc(doc(db, "submissions", id)).catch(() => {});
      }
      void recordStaffActivity({
        action_type: "delete",
        action_label: "তথ্য ডিলিট করেছে",
        module: "info",
        module_label: "তথ্য ডিরেক্টরি",
        target_id: id,
        target_title: existing?.title || id,
        target_detail: existing
          ? `ক্যাটাগরি: ${existing.category_slug} • ফোন: ${existing.contact || "—"} • পদবি: ${existing.designation || "—"} • ঠিকানা: ${existing.address || "—"}`
          : "ডিরেক্টরি তথ্য মুছে ফেলা হয়েছে",
        deleted_snapshot: existing ? ({ ...existing } as unknown as Record<string, unknown>) : null,
        collection_name: "submissions",
      });
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  return { items, loading, add, setStatus, update, remove };
}

// ---------- Blood donors ----------
export function useCloudDonors() {
  const { items, loading } = useFirestoreRealtime<DonorRow>("blood_donors", "moderated");

  const add = async (d: {
    full_name: string;
    phone: string;
    blood_group: DonorRow["blood_group"];
    address?: string;
    age?: number;
    last_donation_date?: string | null;
    photo_url?: string | null;
    total_donations?: number;
    status?: "pending" | "approved" | "rejected";
  }) => {
    try {
      const actor = getCurrentActorInfo();
      const id = genId();
      const nowIso = new Date().toISOString();
      const nextStatus = actor.isStaff && d.status ? d.status : "pending";
      const row: DonorRow = {
        id,
        author_id: actor.uid,
        full_name: sanitizeString(d.full_name, 120, "রক্তদাতা"),
        phone: sanitizeString(d.phone, 30, "01700000000"),
        blood_group: d.blood_group,
        address: sanitizeString(d.address ?? "", 300, ""),
        age: Math.min(Math.max(Number(d.age ?? 25) || 0, 0), 120),
        last_donation_date: sanitizeString(d.last_donation_date ?? "", 40, ""),
        photo_url: sanitizeString(d.photo_url ?? "", 200000, ""),
        total_donations: Math.min(Math.max(Number(d.total_donations ?? 0) || 0, 0), 500),
        status: nextStatus,
        created_at: nowIso,
        updated_at: nowIso,
      };
      upsertCloudMirrorDoc("blood_donors", id, row);
      await syncSingleDocToNativeFirestore("blood_donors", id, row);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "ত্রুটি" };
    }
  };

  const setStatus = async (id: string, status: "approved" | "rejected" | "pending") => {
    const existing = items.find((x) => x.id === id);
    try {
      const nowIso = new Date().toISOString();
      const updated = {
        ...(existing || { id }),
        status,
        updated_at: nowIso,
      };
      upsertCloudMirrorDoc("blood_donors", id, updated);
      if (auth.currentUser?.emailVerified) {
        await updateDoc(doc(db, "blood_donors", id), {
          status,
          updatedAt: serverTimestamp(),
        }).catch(() => syncSingleDocToNativeFirestore("blood_donors", id, updated));
      }
      void recordStaffActivity({
        action_type: status === "approved" ? "approve" : "reject",
        action_label: status === "approved" ? "রক্তদাতা অনুমোদন করেছে" : "রক্তদাতা বাতিল করেছে",
        module: "donors",
        module_label: "রক্তদাতা",
        target_id: id,
        target_title: existing ? `${existing.full_name} (${existing.blood_group})` : id,
        target_detail: existing
          ? `ফোন: ${existing.phone} • গ্রুপ: ${existing.blood_group} • ঠিকানা: ${existing.address || "—"}`
          : `স্ট্যাটাস: ${status}`,
      });
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  const update = async (id: string, patch: Partial<DonorRow>) => {
    const existing = items.find((x) => x.id === id);
    try {
      const nowIso = new Date().toISOString();
      const sanitizedPatch: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (patch.full_name !== undefined) sanitizedPatch.full_name = sanitizeString(patch.full_name, 120, "রক্তদাতা");
      if (patch.phone !== undefined) sanitizedPatch.phone = sanitizeString(patch.phone, 30, "01700000000");
      if (patch.blood_group !== undefined) sanitizedPatch.blood_group = patch.blood_group;
      if (patch.address !== undefined) sanitizedPatch.address = sanitizeString(patch.address ?? "", 300, "");
      if (patch.age !== undefined) sanitizedPatch.age = Math.min(Math.max(Number(patch.age) || 0, 0), 120);
      if (patch.last_donation_date !== undefined) sanitizedPatch.last_donation_date = sanitizeString(patch.last_donation_date ?? "", 40, "");
      if (patch.photo_url !== undefined) sanitizedPatch.photo_url = sanitizeString(patch.photo_url ?? "", 200000, "");
      if (patch.total_donations !== undefined) sanitizedPatch.total_donations = Math.min(Math.max(Number(patch.total_donations) || 0, 0), 500);
      if (patch.status !== undefined) sanitizedPatch.status = patch.status;

      const updated = {
        ...(existing || { id }),
        ...patch,
        updated_at: nowIso,
      };
      upsertCloudMirrorDoc("blood_donors", id, updated);
      if (auth.currentUser?.emailVerified) {
        await updateDoc(doc(db, "blood_donors", id), sanitizedPatch).catch(() =>
          syncSingleDocToNativeFirestore("blood_donors", id, updated)
        );
      }
      void recordStaffActivity({
        action_type: "edit",
        action_label: "রক্তদাতার তথ্য এডিট করেছে",
        module: "donors",
        module_label: "রক্তদাতা",
        target_id: id,
        target_title: `${patch.full_name || existing?.full_name || id} (${patch.blood_group || existing?.blood_group || ""})`,
        target_detail: `ফোন: ${patch.phone ?? existing?.phone ?? "—"} • মোট দান: ${patch.total_donations ?? existing?.total_donations ?? 0}`,
      });
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  const remove = async (id: string) => {
    const existing = items.find((x) => x.id === id);
    try {
      removeCloudMirrorDoc("blood_donors", id);
      if (auth.currentUser?.emailVerified) {
        await deleteDoc(doc(db, "blood_donors", id)).catch(() => {});
      }
      void recordStaffActivity({
        action_type: "delete",
        action_label: "রক্তদাতা ডিলিট করেছে",
        module: "donors",
        module_label: "রক্তদাতা",
        target_id: id,
        target_title: existing ? `${existing.full_name} (${existing.blood_group})` : id,
        target_detail: existing
          ? `ফোন: ${existing.phone} • রক্তের গ্রুপ: ${existing.blood_group} • ঠিকানা: ${existing.address || "—"} • মোট রক্তদান: ${existing.total_donations}`
          : "রক্তদাতা প্রোফাইল মুছে ফেলা হয়েছে",
        deleted_snapshot: existing ? ({ ...existing } as unknown as Record<string, unknown>) : null,
        collection_name: "blood_donors",
      });
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  return { items, loading, add, setStatus, update, remove };
}

// ---------- Donor donation events ----------
export function useCloudDonorEvents() {
  const { items, loading } = useFirestoreRealtime<DonorEventRow>("donation_events", "moderated");

  const add = async (data: {
    donor_id: string;
    event_date: string;
    place?: string | null;
    form_image_url?: string | null;
    photo_url?: string | null;
    note?: string | null;
  }) => {
    try {
      const actor = getCurrentActorInfo();
      const id = genId();
      const nowIso = new Date().toISOString();
      const row: DonorEventRow & { updated_at: string } = {
        id,
        author_id: actor.uid,
        donor_id: sanitizeString(data.donor_id, 128, ""),
        event_date: sanitizeString(data.event_date, 40, new Date().toISOString().slice(0, 10)),
        place: sanitizeString(data.place ?? "", 200, ""),
        form_image_url: sanitizeString(data.form_image_url ?? "", 200000, ""),
        photo_url: sanitizeString(data.photo_url ?? "", 200000, ""),
        note: sanitizeString(data.note ?? "", 500, ""),
        status: "pending",
        created_at: nowIso,
        updated_at: nowIso,
      };
      upsertCloudMirrorDoc("donation_events", id, row);
      await syncSingleDocToNativeFirestore("donation_events", id, row);
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  const setStatus = async (id: string, status: "approved" | "rejected" | "pending") => {
    const existing = items.find((x) => x.id === id);
    try {
      const nowIso = new Date().toISOString();
      const updated = {
        ...(existing || { id }),
        status,
        updated_at: nowIso,
      };
      upsertCloudMirrorDoc("donation_events", id, updated);

      if (status === "approved" && existing?.donor_id) {
        const curMirror = readLocalCloudMirror();
        const donorDoc = curMirror.collections.blood_donors?.[existing.donor_id];
        if (donorDoc) {
          upsertCloudMirrorDoc("blood_donors", existing.donor_id, {
            ...donorDoc,
            total_donations: Math.min((Number(donorDoc.total_donations) || 0) + 1, 500),
            last_donation_date: sanitizeString(existing.event_date, 40, ""),
            updated_at: nowIso,
          });
        }
      }

      if (auth.currentUser?.emailVerified) {
        const evRef = doc(db, "donation_events", id);
        const evSnap = await getDoc(evRef).catch(() => null);
        await updateDoc(evRef, {
          status,
          updatedAt: serverTimestamp(),
        }).catch(() => syncSingleDocToNativeFirestore("donation_events", id, updated));

        if (status === "approved") {
          const donorId = existing?.donor_id || (evSnap?.exists() ? (evSnap.data().donor_id as string) : undefined);
          if (donorId) {
            const donorRef = doc(db, "blood_donors", donorId);
            const donorSnap = await getDoc(donorRef).catch(() => null);
            if (donorSnap?.exists()) {
              const dData = donorSnap.data();
              const nextTotal = Math.min((Number(dData.total_donations) || 0) + 1, 500);
              await updateDoc(donorRef, {
                total_donations: nextTotal,
                last_donation_date: sanitizeString(existing?.event_date || dData.last_donation_date, 40, ""),
                updatedAt: serverTimestamp(),
              }).catch(() => {});
            }
          }
        }
      }

      void recordStaffActivity({
        action_type: status === "approved" ? "approve" : "reject",
        action_label: status === "approved" ? "রক্তদান লগ অনুমোদন করেছে" : "রক্তদান লগ বাতিল করেছে",
        module: "events",
        module_label: "রক্তদান লগ",
        target_id: id,
        target_title: `রক্তদান তারিখ: ${existing?.event_date || id}`,
        target_detail: existing
          ? `স্থান: ${existing.place || "—"} • নোট: ${existing.note || "—"}`
          : `স্ট্যাটাস: ${status}`,
      });
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  const update = async (id: string, patch: Partial<DonorEventRow>) => {
    const existing = items.find((x) => x.id === id);
    try {
      const nowIso = new Date().toISOString();
      const sanitizedPatch: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (patch.event_date !== undefined) sanitizedPatch.event_date = sanitizeString(patch.event_date, 40, new Date().toISOString().slice(0, 10));
      if (patch.place !== undefined) sanitizedPatch.place = sanitizeString(patch.place ?? "", 200, "");
      if (patch.note !== undefined) sanitizedPatch.note = sanitizeString(patch.note ?? "", 500, "");
      if (patch.status !== undefined) sanitizedPatch.status = patch.status;

      const updated = {
        ...(existing || { id }),
        ...patch,
        updated_at: nowIso,
      };
      upsertCloudMirrorDoc("donation_events", id, updated);
      if (auth.currentUser?.emailVerified) {
        await updateDoc(doc(db, "donation_events", id), sanitizedPatch).catch(() =>
          syncSingleDocToNativeFirestore("donation_events", id, updated)
        );
      }
      void recordStaffActivity({
        action_type: "edit",
        action_label: "রক্তদান লগ এডিট করেছে",
        module: "events",
        module_label: "রক্তদান লগ",
        target_id: id,
        target_title: `তারিখ: ${patch.event_date || existing?.event_date || id}`,
        target_detail: `স্থান: ${patch.place ?? existing?.place ?? "—"} • নোট: ${patch.note ?? existing?.note ?? "—"}`,
      });
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  const remove = async (id: string) => {
    const existing = items.find((x) => x.id === id);
    try {
      removeCloudMirrorDoc("donation_events", id);
      if (auth.currentUser?.emailVerified) {
        await deleteDoc(doc(db, "donation_events", id)).catch(() => {});
      }
      void recordStaffActivity({
        action_type: "delete",
        action_label: "রক্তদান লগ ডিলিট করেছে",
        module: "events",
        module_label: "রক্তদান লগ",
        target_id: id,
        target_title: existing ? `তারিখ: ${existing.event_date} (${existing.place || "স্থান উল্লেখ নেই"})` : id,
        target_detail: existing ? `নোট: ${existing.note || "—"}` : "রক্তদান লগ মুছে ফেলা হয়েছে",
        deleted_snapshot: existing ? ({ ...existing } as unknown as Record<string, unknown>) : null,
        collection_name: "donation_events",
      });
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  return { items, loading, add, setStatus, update, remove };
}

// ---------- Emergency banners ----------
export function useEmergencyBanners() {
  const { items, loading } = useFirestoreRealtime<BannerRow>("emergency_banners", "visible", {
    col: "sort_order",
    asc: true,
  });

  const add = async (b: {
    title?: string;
    message: string;
    blood_group?: string;
    hospital?: string;
    phone?: string;
    visible?: boolean;
    sort_order?: number;
  }) => {
    try {
      const actor = getCurrentActorInfo();
      const id = genId();
      const nowIso = new Date().toISOString();
      const row: BannerRow = {
        id,
        author_id: actor.uid,
        title: sanitizeString(b.title || "জরুরী রক্তের প্রয়োজন", 150, "জরুরী রক্তের প্রয়োজন"),
        message: sanitizeString(b.message, 1000, ""),
        blood_group: sanitizeString(b.blood_group ?? "", 10, ""),
        hospital: sanitizeString(b.hospital ?? "", 200, ""),
        phone: sanitizeString(b.phone ?? "", 30, ""),
        visible: b.visible ?? true,
        sort_order: Math.min(Math.max(Number(b.sort_order ?? 0) || 0, 0), 10000),
        created_at: nowIso,
        updated_at: nowIso,
      };
      upsertCloudMirrorDoc("emergency_banners", id, row);
      await syncSingleDocToNativeFirestore("emergency_banners", id, row);
      void recordStaffActivity({
        action_type: "create",
        action_label: "নতুন জরুরী ব্যানার যোগ করেছে",
        module: "banners",
        module_label: "জরুরী ব্যানার",
        target_id: id,
        target_title: b.title || "জরুরী রক্তের প্রয়োজন",
        target_detail: `${b.message} • গ্রুপ: ${b.blood_group || "—"} • ফোন: ${b.phone || "—"}`,
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "ত্রুটি" };
    }
  };

  const update = async (id: string, patch: Partial<BannerRow>) => {
    const existing = items.find((x) => x.id === id);
    try {
      const nowIso = new Date().toISOString();
      const sanitizedPatch: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (patch.title !== undefined) sanitizedPatch.title = sanitizeString(patch.title, 150, "জরুরী রক্তের প্রয়োজন");
      if (patch.message !== undefined) sanitizedPatch.message = sanitizeString(patch.message, 1000, "");
      if (patch.blood_group !== undefined) sanitizedPatch.blood_group = sanitizeString(patch.blood_group ?? "", 10, "");
      if (patch.hospital !== undefined) sanitizedPatch.hospital = sanitizeString(patch.hospital ?? "", 200, "");
      if (patch.phone !== undefined) sanitizedPatch.phone = sanitizeString(patch.phone ?? "", 30, "");
      if (patch.visible !== undefined) sanitizedPatch.visible = Boolean(patch.visible);
      if (patch.sort_order !== undefined) sanitizedPatch.sort_order = Number(patch.sort_order) || 0;

      const updated = {
        ...(existing || { id }),
        ...patch,
        updated_at: nowIso,
      };
      upsertCloudMirrorDoc("emergency_banners", id, updated);
      if (auth.currentUser?.emailVerified) {
        await updateDoc(doc(db, "emergency_banners", id), sanitizedPatch).catch(() =>
          syncSingleDocToNativeFirestore("emergency_banners", id, updated)
        );
      }
      void recordStaffActivity({
        action_type: "edit",
        action_label:
          patch.visible !== undefined && Object.keys(patch).length === 1
            ? patch.visible
              ? "জরুরী ব্যানার দৃশ্যমান করেছে"
              : "জরুরী ব্যানার লুকিয়েছে"
            : "জরুরী ব্যানার এডিট করেছে",
        module: "banners",
        module_label: "জরুরী ব্যানার",
        target_id: id,
        target_title: patch.title || existing?.title || "জরুরী ব্যানার",
        target_detail: patch.message || existing?.message || "",
      });
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  const remove = async (id: string) => {
    const existing = items.find((x) => x.id === id);
    try {
      removeCloudMirrorDoc("emergency_banners", id);
      if (auth.currentUser?.emailVerified) {
        await deleteDoc(doc(db, "emergency_banners", id)).catch(() => {});
      }
      void recordStaffActivity({
        action_type: "delete",
        action_label: "জরুরী ব্যানার ডিলিট করেছে",
        module: "banners",
        module_label: "জরুরী ব্যানার",
        target_id: id,
        target_title: existing?.title || "জরুরী ব্যানার",
        target_detail: existing
          ? `বার্তা: ${existing.message} • গ্রুপ: ${existing.blood_group || "—"} • হাসপাতাল: ${existing.hospital || "—"} • ফোন: ${existing.phone || "—"}`
          : "ব্যানার মুছে ফেলা হয়েছে",
        deleted_snapshot: existing ? ({ ...existing } as unknown as Record<string, unknown>) : null,
        collection_name: "emergency_banners",
      });
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  return { items, loading, add, update, remove };
}

// ---------- App links ----------
export function useAppLinks() {
  const { items, loading } = useFirestoreRealtime<AppLinkRow>("app_links", "visible", {
    col: "sort_order",
    asc: true,
  });
  const { isMainAdmin } = useAuth();

  useEffect(() => {
    if (!loading && items.length === 0 && isMainAdmin) {
      const nowIso = new Date().toISOString();
      const defaults = [
        { id: "android_app", platform: "android", label: "Android অ্যাপ ডাউনলোড (APK)", url: "", visible: true, sort_order: 1, updated_at: nowIso },
        { id: "ios_app", platform: "ios", label: "iOS অ্যাপ (iPhone)", url: "", visible: true, sort_order: 2, updated_at: nowIso },
      ];
      defaults.forEach((d) => {
        upsertCloudMirrorDoc("app_links", d.id, d);
        void syncSingleDocToNativeFirestore("app_links", d.id, d);
      });
    }
  }, [loading, items.length, isMainAdmin]);

  const update = async (id: string, patch: Partial<AppLinkRow>) => {
    const existing = items.find((x) => x.id === id);
    try {
      const nowIso = new Date().toISOString();
      const updated = {
        ...(existing || { id, platform: id.includes("ios") ? "ios" : "android" }),
        ...patch,
        updated_at: nowIso,
      };
      upsertCloudMirrorDoc("app_links", id, updated);
      if (auth.currentUser?.emailVerified) {
        const sanitizedPatch: Record<string, unknown> = { updatedAt: serverTimestamp() };
        if (patch.label !== undefined) sanitizedPatch.label = sanitizeString(patch.label, 120, "App");
        if (patch.url !== undefined) sanitizedPatch.url = sanitizeString(patch.url ?? "", 295000, "");
        if (patch.visible !== undefined) sanitizedPatch.visible = Boolean(patch.visible);
        if (patch.sort_order !== undefined) sanitizedPatch.sort_order = Number(patch.sort_order) || 0;
        await updateDoc(doc(db, "app_links", id), sanitizedPatch).catch(() =>
          syncSingleDocToNativeFirestore("app_links", id, updated)
        );
      }
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  return { items, loading, update };
}

// ---------- Emergency blood requests ----------
export function useEmergencyRequests() {
  const { items, loading } = useFirestoreRealtime<EmergencyReqRow>("emergency_blood_requests", "moderated");

  const add = async (r: {
    patient_name: string;
    phone: string;
    blood_group: string;
    hospital?: string;
    message?: string;
  }) => {
    try {
      const actor = getCurrentActorInfo();
      const id = genId();
      const nowIso = new Date().toISOString();
      const row: EmergencyReqRow = {
        id,
        author_id: actor.uid,
        patient_name: sanitizeString(r.patient_name, 120, "রোগী"),
        phone: sanitizeString(r.phone, 30, "01700000000"),
        blood_group: r.blood_group,
        hospital: sanitizeString(r.hospital ?? "", 200, ""),
        message: sanitizeString(r.message ?? "", 1000, ""),
        status: "pending",
        created_at: nowIso,
        updated_at: nowIso,
      };
      upsertCloudMirrorDoc("emergency_blood_requests", id, row);
      await syncSingleDocToNativeFirestore("emergency_blood_requests", id, row);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "ত্রুটি" };
    }
  };

  const setStatus = async (id: string, status: "approved" | "rejected" | "pending") => {
    const existing = items.find((x) => x.id === id);
    try {
      const nowIso = new Date().toISOString();
      const updated = {
        ...(existing || { id }),
        status,
        updated_at: nowIso,
      };
      upsertCloudMirrorDoc("emergency_blood_requests", id, updated);
      if (auth.currentUser?.emailVerified) {
        await updateDoc(doc(db, "emergency_blood_requests", id), {
          status,
          updatedAt: serverTimestamp(),
        }).catch(() => syncSingleDocToNativeFirestore("emergency_blood_requests", id, updated));
      }
      void recordStaffActivity({
        action_type: status === "approved" ? "approve" : "reject",
        action_label:
          status === "approved"
            ? "জরুরী রক্তের অনুরোধ অনুমোদন করেছে"
            : "জরুরী রক্তের অনুরোধ বাতিল করেছে",
        module: "emergency",
        module_label: "জরুরী রক্ত অনুরোধ",
        target_id: id,
        target_title: existing ? `${existing.patient_name} (${existing.blood_group})` : id,
        target_detail: existing
          ? `ফোন: ${existing.phone} • হাসপাতাল: ${existing.hospital || "—"}`
          : `স্ট্যাটাস: ${status}`,
      });
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  const update = async (id: string, patch: Partial<EmergencyReqRow>) => {
    const existing = items.find((x) => x.id === id);
    try {
      const nowIso = new Date().toISOString();
      const sanitizedPatch: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (patch.patient_name !== undefined) sanitizedPatch.patient_name = sanitizeString(patch.patient_name, 120, "রোগী");
      if (patch.phone !== undefined) sanitizedPatch.phone = sanitizeString(patch.phone, 30, "01700000000");
      if (patch.blood_group !== undefined) sanitizedPatch.blood_group = patch.blood_group;
      if (patch.hospital !== undefined) sanitizedPatch.hospital = sanitizeString(patch.hospital ?? "", 200, "");
      if (patch.message !== undefined) sanitizedPatch.message = sanitizeString(patch.message ?? "", 1000, "");
      if (patch.status !== undefined) sanitizedPatch.status = patch.status;

      const updated = {
        ...(existing || { id }),
        ...patch,
        updated_at: nowIso,
      };
      upsertCloudMirrorDoc("emergency_blood_requests", id, updated);
      if (auth.currentUser?.emailVerified) {
        await updateDoc(doc(db, "emergency_blood_requests", id), sanitizedPatch).catch(() =>
          syncSingleDocToNativeFirestore("emergency_blood_requests", id, updated)
        );
      }
      void recordStaffActivity({
        action_type: "edit",
        action_label: "জরুরী রক্তের অনুরোধ এডিট করেছে",
        module: "emergency",
        module_label: "জরুরী রক্ত অনুরোধ",
        target_id: id,
        target_title: `${patch.patient_name || existing?.patient_name || id} (${patch.blood_group || existing?.blood_group || ""})`,
        target_detail: `ফোন: ${patch.phone ?? existing?.phone ?? "—"} • হাসপাতাল: ${patch.hospital ?? existing?.hospital ?? "—"}`,
      });
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  const remove = async (id: string) => {
    const existing = items.find((x) => x.id === id);
    try {
      removeCloudMirrorDoc("emergency_blood_requests", id);
      if (auth.currentUser?.emailVerified) {
        await deleteDoc(doc(db, "emergency_blood_requests", id)).catch(() => {});
      }
      void recordStaffActivity({
        action_type: "delete",
        action_label: "জরুরী রক্তের অনুরোধ ডিলিট করেছে",
        module: "emergency",
        module_label: "জরুরী রক্ত অনুরোধ",
        target_id: id,
        target_title: existing ? `${existing.patient_name} (${existing.blood_group})` : id,
        target_detail: existing
          ? `ফোন: ${existing.phone} • রক্তের গ্রুপ: ${existing.blood_group} • হাসপাতাল: ${existing.hospital || "—"} • বার্তা: ${existing.message || "—"}`
          : "জরুরী রক্তের অনুরোধ মুছে ফেলা হয়েছে",
        deleted_snapshot: existing ? ({ ...existing } as unknown as Record<string, unknown>) : null,
        collection_name: "emergency_blood_requests",
      });
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  return { items, loading, add, setStatus, update, remove };
}

// ---------- Category access ----------
export function useCategoryAccess() {
  const { items: rawItems, loading } = useFirestoreRealtime<CategoryAccessRow>("category_access", "user_owned");
  const [approvalItems, setApprovalItems] = useState<CategoryAccessRow[]>([]);

  useEffect(() => {
    let active = true;
    async function loadApprovals() {
      try {
        const resp = await fetch("/api/content?collection=settings&id=category_approvals");
        if (resp.ok && (resp.headers.get("content-type") || "").includes("application/json")) {
          const json = await resp.json();
          const raw = json?.item?.logo_url;
          if (typeof raw === "string" && raw.trim()) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && active) {
              const rows: CategoryAccessRow[] = [];
              for (const [uid, slugs] of Object.entries(parsed)) {
                if (Array.isArray(slugs)) {
                  for (const s of slugs) {
                    if (typeof s === "string" && s.trim()) {
                      rows.push({
                        id: `appr_${uid}_${s}`,
                        user_id: uid,
                        category_slug: s,
                        created_at: new Date().toISOString(),
                      });
                    }
                  }
                }
              }
              setApprovalItems(rows);
            }
          }
        }
      } catch {
        // ignore
      }
    }
    void loadApprovals();
    const timer = setInterval(loadApprovals, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const items = (() => {
    const map = new Map<string, CategoryAccessRow>();
    for (const r of approvalItems) {
      map.set(`${r.user_id}::${r.category_slug}`, r);
    }
    for (const r of rawItems) {
      map.set(`${r.user_id}::${r.category_slug}`, r);
    }
    return Array.from(map.values());
  })();

  const syncCategoryApprovalsMap = async (
    uid: string,
    slug: string,
    mode: "grant" | "revoke"
  ) => {
    try {
      let mapObj: Record<string, string[]> = {};
      try {
        const localRaw = localStorage.getItem("sn_category_approvals_v1");
        if (localRaw) {
          const p = JSON.parse(localRaw);
          if (p && typeof p === "object") mapObj = p;
        }
      } catch {
        // ignore
      }
      try {
        const resp = await fetch("/api/content?collection=settings&id=category_approvals");
        if (resp.ok && (resp.headers.get("content-type") || "").includes("application/json")) {
          const json = await resp.json();
          if (json?.item?.logo_url) {
            const srv = JSON.parse(json.item.logo_url);
            if (srv && typeof srv === "object") {
              for (const [k, v] of Object.entries(srv)) {
                if (Array.isArray(v)) {
                  mapObj[k] = Array.from(new Set([...(mapObj[k] || []), ...(v as string[])]));
                }
              }
            }
          }
        }
      } catch {
        // ignore
      }

      const current = new Set(mapObj[uid] || []);
      if (mode === "grant") current.add(slug);
      else current.delete(slug);
      mapObj[uid] = Array.from(current);

      const serialized = JSON.stringify(mapObj);
      try {
        localStorage.setItem("sn_category_approvals_v1", serialized);
      } catch {
        // ignore
      }
      await fetch("/api/content/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection: "settings",
          id: "category_approvals",
          doc: {
            id: "category_approvals",
            key: "category_approvals",
            logo_url: serialized,
            visible: true,
            updated_at: new Date().toISOString(),
          },
        }),
      }).catch(() => {});
    } catch {
      // ignore
    }
  };

  const grant = async (user_id: string, category_slug: string) => {
    const cleanUid = sanitizeString(user_id, 128, "");
    const cleanSlug = sanitizeString(category_slug, 80, "").replace(/[^a-zA-Z0-9_-]/g, "-");
    const id = `${cleanUid}_${cleanSlug}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    const nowIso = new Date().toISOString();
    try {
      const row = {
        id,
        user_id: cleanUid,
        category_slug: cleanSlug,
        created_at: nowIso,
        updated_at: nowIso,
      };
      upsertCloudMirrorDoc("category_access", id, row);
      await syncCategoryApprovalsMap(cleanUid, cleanSlug, "grant");
      setApprovalItems((prev) => [
        ...prev.filter((x) => !(x.user_id === cleanUid && x.category_slug === cleanSlug)),
        row,
      ]);
      await syncSingleDocToNativeFirestore("category_access", id, row);
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  const revoke = async (id: string) => {
    const target = items.find((x) => x.id === id);
    try {
      removeCloudMirrorDoc("category_access", id);
      if (target) {
        for (const r of rawItems) {
          if (r.user_id === target.user_id && r.category_slug === target.category_slug) {
            removeCloudMirrorDoc("category_access", r.id);
            if (auth.currentUser?.emailVerified) {
              await deleteDoc(doc(db, "category_access", r.id)).catch(() => {});
            }
          }
        }
        await syncCategoryApprovalsMap(target.user_id, target.category_slug, "revoke");
        setApprovalItems((prev) =>
          prev.filter(
            (x) => !(x.user_id === target.user_id && x.category_slug === target.category_slug)
          )
        );
      }
      if (auth.currentUser?.emailVerified) {
        await deleteDoc(doc(db, "category_access", id)).catch(() => {});
      }
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  return { items, loading, grant, revoke };
}

// ---------- Category Access Requests & Payment/Subscription Requests ----------
export interface CategoryRequestEntry {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  categorySlug: string;
  categoryBn?: string;
  reason?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updated_at?: string;
}

export function useCategoryRequests() {
  const [requests, setRequests] = useState<CategoryRequestEntry[]>(() => {
    const mirror = readLocalCloudMirror();
    const map = mirror.collections.category_requests || {};
    return Object.values(map).sort((a: any, b: any) =>
      String(b.createdAt || b.created_at || "").localeCompare(String(a.createdAt || a.created_at || ""))
    ) as CategoryRequestEntry[];
  });

  useEffect(() => {
    const sync = () => {
      const mirror = readLocalCloudMirror();
      const map = mirror.collections.category_requests || {};
      const list = Object.values(map).sort((a: any, b: any) =>
        String(b.createdAt || b.created_at || "").localeCompare(String(a.createdAt || a.created_at || ""))
      ) as CategoryRequestEntry[];
      setRequests(list);
    };
    sync();
    window.addEventListener("sn-cloud-mirror-updated", sync);
    const timer = setInterval(() => {
      void pullCloudMirrorFromRemote().then(sync);
    }, 3500);
    return () => {
      window.removeEventListener("sn-cloud-mirror-updated", sync);
      clearInterval(timer);
    };
  }, []);

  const submitCategoryRequest = async (input: {
    userId: string;
    userName: string;
    userPhone: string;
    categorySlug: string;
    categoryBn?: string;
    reason?: string;
  }) => {
    const id = genId();
    const nowIso = new Date().toISOString();
    const entry: CategoryRequestEntry = {
      id,
      userId: sanitizeString(input.userId, 128, ""),
      userName: sanitizeString(input.userName, 120, "গ্রাহক"),
      userPhone: sanitizeString(input.userPhone, 40, ""),
      categorySlug: sanitizeString(input.categorySlug, 80, ""),
      categoryBn: sanitizeString(input.categoryBn || input.categorySlug, 120, ""),
      reason: sanitizeString(input.reason || "", 400, ""),
      status: "pending",
      createdAt: nowIso,
      updated_at: nowIso,
    };
    upsertCloudMirrorDoc("category_requests", id, entry);
    return { ok: true, id };
  };

  const approveCategoryRequest = async (id: string) => {
    const existing = requests.find((r) => r.id === id);
    if (!existing) return;
    const nowIso = new Date().toISOString();
    const updated: CategoryRequestEntry = {
      ...existing,
      status: "approved",
      updated_at: nowIso,
    };
    upsertCloudMirrorDoc("category_requests", id, updated);
    void recordStaffActivity({
      action_type: "approve",
      action_label: "ক্যাটাগরি অ্যাকসেস রিকোয়েস্ট অনুমোদন করেছে",
      module: "access",
      module_label: "ক্যাটাগরি অ্যাকসেস",
      target_id: id,
      target_title: `${existing.userName} (${existing.categoryBn || existing.categorySlug})`,
      target_detail: `ফোন: ${existing.userPhone} • UID: ${existing.userId}`,
    });
  };

  const rejectCategoryRequest = async (id: string) => {
    const existing = requests.find((r) => r.id === id);
    if (!existing) return;
    const nowIso = new Date().toISOString();
    const updated: CategoryRequestEntry = {
      ...existing,
      status: "rejected",
      updated_at: nowIso,
    };
    upsertCloudMirrorDoc("category_requests", id, updated);
    void recordStaffActivity({
      action_type: "reject",
      action_label: "ক্যাটাগরি অ্যাকসেস রিকোয়েস্ট বাতিল করেছে",
      module: "access",
      module_label: "ক্যাটাগরি অ্যাকসেস",
      target_id: id,
      target_title: `${existing.userName} (${existing.categoryBn || existing.categorySlug})`,
      target_detail: `ফোন: ${existing.userPhone} • UID: ${existing.userId}`,
    });
  };

  const deleteCategoryRequest = async (id: string) => {
    const existing = requests.find((r) => r.id === id);
    removeCloudMirrorDoc("category_requests", id);
    if (existing) {
      void recordStaffActivity({
        action_type: "delete",
        action_label: "ক্যাটাগরি অ্যাকসেস রিকোয়েস্ট ডিলিট করেছে",
        module: "access",
        module_label: "ক্যাটাগরি অ্যাকসেস",
        target_id: id,
        target_title: `${existing.userName} (${existing.categoryBn || existing.categorySlug})`,
        target_detail: `ফোন: ${existing.userPhone} • UID: ${existing.userId}`,
        deleted_snapshot: { ...existing },
        collection_name: "category_requests",
      });
    }
  };

  return {
    requests,
    submitCategoryRequest,
    approveCategoryRequest,
    rejectCategoryRequest,
    deleteCategoryRequest,
  };
}

export interface PaymentRequestEntry {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  senderPhone: string;
  amount: number;
  method: string;
  trxId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updated_at?: string;
}

export function usePaymentRequests() {
  const [requests, setRequests] = useState<PaymentRequestEntry[]>(() => {
    const mirror = readLocalCloudMirror();
    const map = mirror.collections.payment_requests || {};
    return Object.values(map).sort((a: any, b: any) =>
      String(b.createdAt || b.created_at || "").localeCompare(String(a.createdAt || a.created_at || ""))
    ) as PaymentRequestEntry[];
  });

  useEffect(() => {
    const sync = () => {
      const mirror = readLocalCloudMirror();
      const map = mirror.collections.payment_requests || {};
      const list = Object.values(map).sort((a: any, b: any) =>
        String(b.createdAt || b.created_at || "").localeCompare(String(a.createdAt || a.created_at || ""))
      ) as PaymentRequestEntry[];
      setRequests(list);
    };
    sync();
    window.addEventListener("sn-cloud-mirror-updated", sync);
    const timer = setInterval(() => {
      void pullCloudMirrorFromRemote().then(sync);
    }, 3500);
    return () => {
      window.removeEventListener("sn-cloud-mirror-updated", sync);
      clearInterval(timer);
    };
  }, []);

  const submitRequest = async (input: {
    userId: string;
    userName: string;
    userPhone: string;
    senderPhone: string;
    amount: number;
    method: string;
    trxId: string;
  }) => {
    const id = genId();
    const nowIso = new Date().toISOString();
    const entry: PaymentRequestEntry = {
      id,
      userId: sanitizeString(input.userId, 128, ""),
      userName: sanitizeString(input.userName, 120, "গ্রাহক"),
      userPhone: sanitizeString(input.userPhone, 40, ""),
      senderPhone: sanitizeString(input.senderPhone, 40, ""),
      amount: Number(input.amount || 0),
      method: sanitizeString(input.method, 40, "bKash"),
      trxId: sanitizeString(input.trxId, 80, ""),
      status: "pending",
      createdAt: nowIso,
      updated_at: nowIso,
    };
    upsertCloudMirrorDoc("payment_requests", id, entry);
    return { ok: true, id };
  };

  const approveRequest = async (id: string) => {
    const existing = requests.find((r) => r.id === id);
    if (!existing) return;
    const nowIso = new Date().toISOString();
    const updated: PaymentRequestEntry = {
      ...existing,
      status: "approved",
      updated_at: nowIso,
    };
    upsertCloudMirrorDoc("payment_requests", id, updated);
    void recordStaffActivity({
      action_type: "approve",
      action_label: "সাবস্ক্রিপশন পেমেন্ট রিকোয়েস্ট অনুমোদন করেছে",
      module: "access",
      module_label: "সাবস্ক্রিপশন পেমেন্ট",
      target_id: id,
      target_title: `${existing.userName} (${existing.amount}৳ • ${existing.method})`,
      target_detail: `প্রেরক: ${existing.senderPhone} • TrxID: ${existing.trxId}`,
    });
  };

  const rejectRequest = async (id: string) => {
    const existing = requests.find((r) => r.id === id);
    if (!existing) return;
    const nowIso = new Date().toISOString();
    const updated: PaymentRequestEntry = {
      ...existing,
      status: "rejected",
      updated_at: nowIso,
    };
    upsertCloudMirrorDoc("payment_requests", id, updated);
    void recordStaffActivity({
      action_type: "reject",
      action_label: "সাবস্ক্রিপশন পেমেন্ট রিকোয়েস্ট বাতিল করেছে",
      module: "access",
      module_label: "সাবস্ক্রিপশন পেমেন্ট",
      target_id: id,
      target_title: `${existing.userName} (${existing.amount}৳ • ${existing.method})`,
      target_detail: `প্রেরক: ${existing.senderPhone} • TrxID: ${existing.trxId}`,
    });
  };

  const deleteRequest = async (id: string) => {
    const existing = requests.find((r) => r.id === id);
    removeCloudMirrorDoc("payment_requests", id);
    if (existing) {
      void recordStaffActivity({
        action_type: "delete",
        action_label: "সাবস্ক্রিপশন পেমেন্ট রিকোয়েস্ট ডিলিট করেছে",
        module: "access",
        module_label: "সাবস্ক্রিপশন পেমেন্ট",
        target_id: id,
        target_title: `${existing.userName} (${existing.amount}৳ • ${existing.method})`,
        target_detail: `প্রেরক: ${existing.senderPhone} • TrxID: ${existing.trxId}`,
        deleted_snapshot: { ...existing },
        collection_name: "payment_requests",
      });
    }
  };

  return {
    requests,
    submitRequest,
    approveRequest,
    rejectRequest,
    deleteRequest,
  };
}

// ---------- Private chat: Deletion Tombstones & Sync ----------
export interface ChatDeletionState {
  deletedThreads: Record<string, string>;
  deletedAllBefore: string | null;
  deletedMessages: string[];
}

const LOCAL_CHAT_DELETIONS_KEY = "sn_deleted_chats_meta_v2";
const STAFF_PROFILES_SETTING_ID = "staff_profiles_config";

export function readLocalChatDeletions(): ChatDeletionState {
  const defaultState: ChatDeletionState = {
    deletedThreads: {
      vu0ytBbKHhe07s6yZ2G8Ob7nTkg2: "2026-10-10T03:05:00.000Z",
    },
    deletedAllBefore: "2026-10-10T03:05:00.000Z",
    deletedMessages: [],
  };
  try {
    const raw = localStorage.getItem(LOCAL_CHAT_DELETIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return {
          deletedThreads: {
            ...defaultState.deletedThreads,
            ...(parsed.deletedThreads || {}),
          },
          deletedAllBefore:
            parsed.deletedAllBefore &&
            parsed.deletedAllBefore > (defaultState.deletedAllBefore || "")
              ? parsed.deletedAllBefore
              : defaultState.deletedAllBefore,
          deletedMessages: Array.isArray(parsed.deletedMessages) ? parsed.deletedMessages : [],
        };
      }
    }
  } catch {
    // ignore
  }
  return defaultState;
}

export function writeLocalChatDeletions(next: ChatDeletionState) {
  try {
    localStorage.setItem(LOCAL_CHAT_DELETIONS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function mergeServerChatDeletions(partial: Partial<ChatDeletionState>): ChatDeletionState {
  const cur = readLocalChatDeletions();
  const mergedThreads: Record<string, string> = { ...cur.deletedThreads };
  if (partial.deletedThreads && typeof partial.deletedThreads === "object") {
    for (const [k, v] of Object.entries(partial.deletedThreads)) {
      if (typeof v === "string" && (!mergedThreads[k] || v > mergedThreads[k])) {
        mergedThreads[k] = v;
      }
    }
  }
  const mergedAllBefore =
    partial.deletedAllBefore &&
    (!cur.deletedAllBefore || partial.deletedAllBefore > cur.deletedAllBefore)
      ? partial.deletedAllBefore
      : cur.deletedAllBefore;
  const mergedMsgs = Array.from(
    new Set([...cur.deletedMessages, ...(partial.deletedMessages || [])])
  ).slice(-500);

  const next: ChatDeletionState = {
    deletedThreads: mergedThreads,
    deletedAllBefore: mergedAllBefore,
    deletedMessages: mergedMsgs,
  };
  writeLocalChatDeletions(next);
  return next;
}

export async function syncChatDeletionsWithCloud(): Promise<ChatDeletionState> {
  try {
    const snap = await getDoc(doc(db, "settings", STAFF_PROFILES_SETTING_ID));
    if (snap.exists()) {
      const raw = snap.data().logo_url;
      if (typeof raw === "string" && raw.trim()) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed._deletedChats) {
          return mergeServerChatDeletions(parsed._deletedChats);
        }
      }
    }
  } catch {
    // ignore
  }
  return readLocalChatDeletions();
}

export const syncChatDeletionsFromFirestore = syncChatDeletionsWithCloud;

async function persistChatDeletionsToCloud(state: ChatDeletionState) {
  if (!auth.currentUser?.emailVerified) return;
  try {
    const ref = doc(db, "settings", STAFF_PROFILES_SETTING_ID);
    const snap = await getDoc(ref);
    let obj: Record<string, unknown> = {};
    if (snap.exists()) {
      const raw = snap.data().logo_url;
      if (typeof raw === "string" && raw.trim()) {
        try {
          obj = JSON.parse(raw) || {};
        } catch {
          obj = {};
        }
      }
    }
    obj._deletedChats = state;
    const serialized = sanitizeString(JSON.stringify(obj), 295000, "{}");
    if (!snap.exists()) {
      await setDoc(ref, {
        key: STAFF_PROFILES_SETTING_ID,
        logo_url: serialized,
        visible: true,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        logo_url: serialized,
        visible: true,
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    // ignore
  }
}

export function isChatThreadDeleted(
  threadId: string,
  lastMessageAt: string | null | undefined,
  delState: ChatDeletionState = readLocalChatDeletions()
): boolean {
  const ts = String(lastMessageAt || "");
  if (delState.deletedAllBefore && (!ts || ts <= delState.deletedAllBefore)) {
    return true;
  }
  const threadDelAt = delState.deletedThreads[threadId];
  if (threadDelAt && (!ts || ts <= threadDelAt)) {
    return true;
  }
  return false;
}

export function isChatMessageDeleted(
  threadId: string,
  messageId: string,
  createdAt: string | null | undefined,
  delState: ChatDeletionState = readLocalChatDeletions()
): boolean {
  if (delState.deletedMessages.includes(messageId)) {
    return true;
  }
  const ts = String(createdAt || "");
  if (delState.deletedAllBefore && (!ts || ts <= delState.deletedAllBefore)) {
    return true;
  }
  const threadDelAt = delState.deletedThreads[threadId];
  if (threadDelAt && (!ts || ts <= threadDelAt)) {
    return true;
  }
  return false;
}

export async function purgeDeletedFirestoreThread(threadId: string) {
  if (!auth.currentUser?.emailVerified || !isBootstrappedAdminEmail(auth.currentUser.email)) {
    return;
  }
  try {
    const msgsSnap = await getDocs(collection(db, "chat_threads", threadId, "messages"));
    await Promise.all(msgsSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
  } catch {
    // ignore
  }
  try {
    await deleteDoc(doc(db, "chat_threads", threadId));
  } catch {
    // ignore
  }
}

// ---------- Private chat: threads ----------
export function useChatThreads() {
  const { items: fsItems, loading: fsLoading } = useFirestoreRealtime<ChatThreadRow>(
    "chat_threads",
    "user_owned",
    {
      col: "last_message_at",
      asc: false,
    }
  );
  const { user, isStaff } = useAuth();
  const [serverItems, setServerItems] = useState<ChatThreadRow[]>([]);
  const [delState, setDelState] = useState<ChatDeletionState>(() => readLocalChatDeletions());
  const [serverLoading, setServerLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function fetchServerThreads() {
      try {
        await syncChatDeletionsWithCloud();
        const resp = await fetch("/api/chat/threads");
        if (resp.ok && (resp.headers.get("content-type") || "").includes("application/json")) {
          const data = await resp.json();
          const nextDel = mergeServerChatDeletions({
            deletedThreads: data.deletedThreads,
            deletedAllBefore: data.deletedAllBefore,
            deletedMessages: data.deletedMessages,
          });
          if (active) setDelState(nextDel);
          if (active && Array.isArray(data.threads)) {
            const mapped: ChatThreadRow[] = data.threads
              .filter((t: any) => isStaff || (user && t.user_id === user.id))
              .map((t: any) => ({
                id: String(t.id),
                user_id: String(t.user_id || t.id),
                last_message_at: String(t.last_message_at || new Date().toISOString()),
                last_message_preview: t.last_message_preview ?? null,
                user_unread: Number(t.user_unread ?? 0),
                staff_unread: Number(t.staff_unread ?? 0),
                created_at: String(t.created_at || new Date().toISOString()),
              }))
              .filter(
                (t: ChatThreadRow) =>
                  Boolean(t.last_message_preview && t.last_message_preview.trim()) &&
                  !isChatThreadDeleted(t.id, t.last_message_at, nextDel)
              );
            setServerItems(mapped);
          }
        } else if (active) {
          setDelState(readLocalChatDeletions());
        }
      } catch {
        // ignore
      } finally {
        if (active) setServerLoading(false);
      }
    }
    void fetchServerThreads();
    const timer = setInterval(fetchServerThreads, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user?.id, isStaff]);

  // Automatically purge any tombstoned or empty Firestore chat_threads when signed in as verified admin
  useEffect(() => {
    if (!auth.currentUser?.emailVerified || !isBootstrappedAdminEmail(auth.currentUser.email)) {
      return;
    }
    for (const ft of fsItems) {
      const isEmpty = !ft.last_message_preview || !ft.last_message_preview.trim();
      if (isEmpty || isChatThreadDeleted(ft.id, ft.last_message_at, delState)) {
        void purgeDeletedFirestoreThread(ft.id);
      }
    }
  }, [fsItems, delState]);

  const mergedItems = (() => {
    const map = new Map<string, ChatThreadRow>();
    for (const t of serverItems) {
      if (
        t.last_message_preview &&
        t.last_message_preview.trim() &&
        !isChatThreadDeleted(t.id, t.last_message_at, delState)
      ) {
        map.set(t.id, t);
      }
    }
    for (const t of fsItems) {
      if (
        !t.last_message_preview ||
        !t.last_message_preview.trim() ||
        isChatThreadDeleted(t.id, t.last_message_at, delState)
      ) {
        continue;
      }
      const ex = map.get(t.id);
      if (!ex || t.last_message_at > ex.last_message_at) {
        map.set(t.id, t);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      b.last_message_at.localeCompare(a.last_message_at)
    );
  })();

  const remove = async (id: string) => {
    const existing = mergedItems.find((x) => x.id === id);
    try {
      const now = new Date().toISOString();
      const nextDel = mergeServerChatDeletions({
        deletedThreads: { [id]: now },
      });
      setDelState(nextDel);
      void persistChatDeletionsToCloud(nextDel);

      await fetch("/api/chat/delete-thread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: id }),
      }).catch(() => {});

      await purgeDeletedFirestoreThread(id);
      setServerItems((prev) => prev.filter((x) => x.id !== id));

      void recordStaffActivity({
        action_type: "delete",
        action_label: "লাইভ চ্যাট কথোপকথন (Thread) ডিলিট করেছে",
        module: "chat",
        module_label: "লাইভ চ্যাট",
        target_id: id,
        target_title: `চ্যাট থ্রেড (${id.slice(0, 12)})`,
        target_detail: existing?.last_message_preview
          ? `সর্বশেষ মেসেজ: "${existing.last_message_preview}"`
          : "চ্যাট কথোপকথন মুছে ফেলা হয়েছে",
        deleted_snapshot: existing ? ({ ...existing } as unknown as Record<string, unknown>) : { thread_id: id },
      });
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  const removeAll = async () => {
    try {
      const now = new Date().toISOString();
      const allIds: Record<string, string> = {};
      for (const t of mergedItems) {
        allIds[t.id] = now;
      }
      for (const t of fsItems) {
        allIds[t.id] = now;
      }
      const nextDel = mergeServerChatDeletions({
        deletedThreads: allIds,
        deletedAllBefore: now,
      });
      setDelState(nextDel);
      void persistChatDeletionsToCloud(nextDel);

      await fetch("/api/chat/delete-all-threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});

      for (const tid of Object.keys(allIds)) {
        await purgeDeletedFirestoreThread(tid);
      }
      setServerItems([]);

      void recordStaffActivity({
        action_type: "delete",
        action_label: "সকল লাইভ চ্যাট একসাথে ডিলিট করেছে",
        module: "chat",
        module_label: "লাইভ চ্যাট",
        target_id: "all_threads",
        target_title: `মোট ${Object.keys(allIds).length} টি চ্যাট থ্রেড মুছে ফেলা হয়েছে`,
        target_detail: `ডিলিট করা থ্রেড আইডি: ${Object.keys(allIds).join(", ") || "সব"}`,
        deleted_snapshot: { deleted_count: Object.keys(allIds).length, deleted_at: now },
      });
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  return { items: mergedItems, loading: fsLoading && serverLoading, remove, removeAll };
}

export async function ensureMyThread(userId: string): Promise<ChatThreadRow | null> {
  if (!userId) return null;
  const nowIso = new Date().toISOString();
  const fallbackThread: ChatThreadRow = {
    id: userId,
    user_id: userId,
    last_message_at: nowIso,
    last_message_preview: "",
    user_unread: 0,
    staff_unread: 0,
    created_at: nowIso,
  };

  if (!auth.currentUser?.emailVerified) {
    return fallbackThread;
  }

  const threadRef = doc(db, "chat_threads", userId);
  try {
    const snap = await getDoc(threadRef);
    if (snap.exists()) {
      const row = normalizeDoc<ChatThreadRow>(snap.id, snap.data());
      if (!isChatThreadDeleted(row.id, row.last_message_at)) {
        return row;
      }
    }
  } catch {
    // ignore
  }

  // Return virtual thread without writing an empty document to Firestore
  return fallbackThread;
}

export function useThreadMessages(threadId: string | null) {
  const [fsItems, setFsItems] = useState<PrivateMessageRow[]>([]);
  const [serverItems, setServerItems] = useState<PrivateMessageRow[]>([]);
  const [delState, setDelState] = useState<ChatDeletionState>(() => readLocalChatDeletions());
  const [loading, setLoading] = useState(true);
  const { user, firebaseUser, isFirebaseVerifiedAdmin } = useAuth();

  const isBootstrappedAdmin = isFirebaseVerifiedAdmin;

  // Poll server messages for universal reliability (all staff & phone/email verified users)
  useEffect(() => {
    if (!threadId) {
      setServerItems([]);
      setLoading(false);
      return;
    }

    let active = true;
    async function loadServerMsgs() {
      try {
        const resp = await fetch(`/api/chat/messages/${encodeURIComponent(threadId!)}`);
        if (resp.ok && (resp.headers.get("content-type") || "").includes("application/json")) {
          const data = await resp.json();
          const nextDel = mergeServerChatDeletions({
            deletedThreads: data.deletedAt ? { [threadId!]: data.deletedAt } : undefined,
            deletedAllBefore: data.deletedAllBefore,
            deletedMessages: data.deletedMessages,
          });
          if (active) setDelState(nextDel);
          if (active && Array.isArray(data.messages)) {
            setServerItems(
              data.messages.filter(
                (m: PrivateMessageRow) =>
                  !isChatMessageDeleted(threadId!, m.id, m.created_at, nextDel)
              )
            );
          }
        }
      } catch {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadServerMsgs();
    const timer = setInterval(loadServerMsgs, 2200);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [threadId]);

  // Also subscribe to Firestore messages when Firebase user is verified
  useEffect(() => {
    if (!threadId || !firebaseUser?.emailVerified) {
      setFsItems([]);
      return;
    }

    const msgsRef = collection(db, "chat_threads", threadId, "messages");
    const q = isBootstrappedAdmin
      ? query(msgsRef)
      : query(msgsRef, where("thread_id", "==", firebaseUser.uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => normalizeDoc<PrivateMessageRow>(d.id, d.data()));
        list.sort((a, b) => a.created_at.localeCompare(b.created_at));
        setFsItems(list);
        setLoading(false);
      },
      () => {
        // fallback to serverItems
      }
    );

    return () => unsub();
  }, [threadId, firebaseUser?.uid, firebaseUser?.emailVerified, isBootstrappedAdmin]);

  const items = (() => {
    const merged: PrivateMessageRow[] = [
      ...serverItems.filter(
        (sm) => !threadId || !isChatMessageDeleted(threadId, sm.id, sm.created_at, delState)
      ),
    ];
    for (const fm of fsItems) {
      if (threadId && isChatMessageDeleted(threadId, fm.id, fm.created_at, delState)) {
        if (auth.currentUser?.emailVerified && isBootstrappedAdminEmail(auth.currentUser.email)) {
          void deleteDoc(doc(db, "chat_threads", threadId, "messages", fm.id)).catch(() => {});
        }
        continue;
      }
      const duplicate = merged.some(
        (sm) =>
          sm.id === fm.id ||
          (sm.sender_role === fm.sender_role &&
            (sm.body || "") === (fm.body || "") &&
            Math.abs(new Date(sm.created_at).getTime() - new Date(fm.created_at).getTime()) <
              8000)
      );
      if (!duplicate) {
        merged.push(fm);
      }
    }
    merged.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return merged;
  })();

  const send = async (
    sender_id: string,
    sender_role: "user" | "staff",
    body: string,
    attachment_url?: string | null,
    meta?: {
      sender_name?: string;
      sender_photo?: string;
      sender_role_label?: string;
      user_name?: string;
      user_email?: string;
      user_phone?: string;
    }
  ) => {
    if (!threadId) return { error: { message: "No thread selected" } };

    // 1. Send to Unified Server Chat Hub (always works for all staff & verified users)
    try {
      const resp = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: threadId,
          user_id: sender_role === "user" ? sender_id : threadId,
          user_name:
            meta?.user_name ||
            (sender_role === "user" ? user?.displayName || "গ্রাহক" : undefined),
          user_email:
            meta?.user_email || (sender_role === "user" ? user?.email || "" : undefined),
          user_phone:
            meta?.user_phone || (sender_role === "user" ? user?.phone || "" : undefined),
          sender_id,
          sender_role,
          sender_name:
            meta?.sender_name ||
            user?.displayName ||
            (sender_role === "staff" ? "সাপোর্ট টিম" : "গ্রাহক"),
          sender_photo: meta?.sender_photo || user?.photoURL || "",
          sender_role_label:
            meta?.sender_role_label || (sender_role === "staff" ? "এডমিন" : "গ্রাহক"),
          body: body || "",
          attachment_url: attachment_url || "",
        }),
      });
      if (resp.ok && (resp.headers.get("content-type") || "").includes("application/json")) {
        const data = await resp.json();
        if (data.message) {
          setServerItems((prev) => [...prev, data.message]);
        }
      }
    } catch {
      // ignore
    }

    // 2. Also persist to Firestore if signed in with verified Firebase account
    if (auth.currentUser?.emailVerified) {
      const msgId = genId();
      try {
        const nowIso = new Date().toISOString();
        const preview = sanitizeString(body || (attachment_url ? "📎 সংযুক্তি" : ""), 300, "");
        const threadRef = doc(db, "chat_threads", threadId);
        const threadSnap = await getDoc(threadRef);
        if (!threadSnap.exists()) {
          if (sender_role === "user" && auth.currentUser.uid === threadId) {
            await setDoc(threadRef, {
              user_id: threadId,
              last_message_at: nowIso,
              last_message_preview: preview,
              user_unread: 0,
              staff_unread: 1,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } else {
          const tData = threadSnap.data();
          await updateDoc(threadRef, {
            last_message_at: nowIso,
            last_message_preview: preview,
            user_unread:
              sender_role === "staff"
                ? Math.min((Number(tData.user_unread) || 0) + 1, 10000)
                : Number(tData.user_unread) || 0,
            staff_unread:
              sender_role === "user"
                ? Math.min((Number(tData.staff_unread) || 0) + 1, 10000)
                : 0,
            updatedAt: serverTimestamp(),
          });
        }

        await setDoc(doc(db, "chat_threads", threadId, "messages", msgId), {
          thread_id: threadId,
          sender_id: sanitizeString(auth.currentUser.uid, 128, ""),
          sender_role: sender_role === "staff" ? "staff" : "user",
          body: sanitizeString(body || "", 2000, ""),
          attachment_url: sanitizeString(attachment_url ?? "", 300000, ""),
          createdAt: serverTimestamp(),
        });
      } catch {
        // Server chat hub already persisted the message
      }
    }

    if (sender_role === "staff") {
      void recordStaffActivity({
        action_type: "reply",
        action_label: "গ্রাহকের লাইভ চ্যাটে উত্তর দিয়েছে",
        module: "chat",
        module_label: "লাইভ চ্যাট",
        target_id: threadId,
        target_title: meta?.user_name || meta?.user_email || `গ্রাহক (${threadId.slice(0, 10)})`,
        target_detail: body ? `উত্তর: "${body}"` : "📎 সংযুক্তি পাঠিয়েছে",
      });
    }

    return { error: null };
  };

  const remove = async (id: string) => {
    if (!threadId) return { error: null };
    const existingMsg = items.find((m) => m.id === id);
    try {
      const nextDel = mergeServerChatDeletions({
        deletedMessages: [id],
      });
      setDelState(nextDel);
      void persistChatDeletionsToCloud(nextDel);

      await fetch("/api/chat/delete-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, message_id: id }),
      }).catch(() => {});

      if (auth.currentUser?.emailVerified) {
        await deleteDoc(doc(db, "chat_threads", threadId, "messages", id)).catch(() => {});
      }
      setServerItems((prev) => prev.filter((m) => m.id !== id));
      setFsItems((prev) => prev.filter((m) => m.id !== id));

      void recordStaffActivity({
        action_type: "delete",
        action_label: "লাইভ চ্যাটের মেসেজ ডিলিট করেছে",
        module: "chat",
        module_label: "লাইভ চ্যাট",
        target_id: id,
        target_title: existingMsg?.body
          ? `"${existingMsg.body.slice(0, 80)}"`
          : `চ্যাট মেসেজ (${id.slice(0, 10)})`,
        target_detail: `থ্রেড আইডি: ${threadId} • প্রেরক: ${existingMsg?.sender_name || existingMsg?.sender_role || "—"}`,
        deleted_snapshot: existingMsg
          ? ({ ...existingMsg } as unknown as Record<string, unknown>)
          : { thread_id: threadId, message_id: id },
      });
      return { error: null };
    } catch (e) {
      return { error: { message: (e as Error).message } };
    }
  };

  return { items, loading, send, remove };
}

export async function markThreadRead(threadId: string, side: "user" | "staff") {
  if (!threadId) return;
  try {
    await fetch("/api/chat/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_id: threadId, side }),
    }).catch(() => {});
  } catch {
    // ignore
  }

  if (!auth.currentUser?.emailVerified) return;

  try {
    const threadRef = doc(db, "chat_threads", threadId);
    const snap = await getDoc(threadRef);
    if (!snap.exists()) return;
    const tData = snap.data();
    if (isChatThreadDeleted(threadId, tData.last_message_at)) return;
    await updateDoc(threadRef, {
      last_message_at: tData.last_message_at || new Date().toISOString(),
      last_message_preview: tData.last_message_preview || "",
      user_unread: side === "user" ? 0 : Number(tData.user_unread) || 0,
      staff_unread: side === "staff" ? 0 : Number(tData.staff_unread) || 0,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Ignore read receipt error
  }
}

// ---------- Compact Client Image / Audio Serializer ----------
export async function uploadPublicImage(file: File, _folder = "uploads"): Promise<string | null> {
  if (file.type.startsWith("image/")) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 480;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.65);
          resolve(dataUrl.length <= 195000 ? dataUrl : canvas.toDataURL("image/jpeg", 0.4));
        };
        img.onerror = () => resolve(null);
        img.src = String(reader.result);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  // Audio or small file fallback
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || "");
      resolve(res.length <= 295000 ? res : null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

export interface UserFullActivitySummary {
  subCount: { pending: number; approved: number; rejected: number };
  access: string[];
  submissions: Array<{
    id: string;
    title: string;
    category_slug: string;
    contact: string;
    address: string;
    status: string;
    created_at: string;
  }>;
  bloodDonors: Array<{
    id: string;
    full_name: string;
    blood_group: string;
    phone: string;
    address: string;
    status: string;
  }>;
  donations: Array<{
    id: string;
    sender_name: string;
    sender_phone: string;
    amount: number;
    method: string;
    trx_id: string;
    status: string;
    created_at: string;
  }>;
  chatCount: number;
  lastChatPreview: string;
}

export async function getUserSubmissionCounts(
  phone: string,
  userId: string,
  email?: string
): Promise<UserFullActivitySummary> {
  const cleanPhone = (phone || "").trim();
  const cleanEmail = (email || "").trim().toLowerCase();
  const accessSet = new Set<string>();

  const subMap = new Map<
    string,
    {
      id: string;
      title: string;
      category_slug: string;
      contact: string;
      address: string;
      status: string;
      created_at: string;
    }
  >();

  const donorMap = new Map<
    string,
    {
      id: string;
      full_name: string;
      blood_group: string;
      phone: string;
      address: string;
      status: string;
    }
  >();

  const donationMap = new Map<
    string,
    {
      id: string;
      sender_name: string;
      sender_phone: string;
      amount: number;
      method: string;
      trx_id: string;
      status: string;
      created_at: string;
    }
  >();

  let chatCount = 0;
  let lastChatPreview = "";

  const matchesTargetUser = (row: any): boolean => {
    if (!row || typeof row !== "object") return false;
    const rowUid = String(row.user_id || row.author_id || row.uid || "").trim();
    const rowEmail = String(row.email || row.user_email || "").trim().toLowerCase();
    const rowPhone = String(row.contact || row.phone || row.sender_phone || "").trim();
    if (userId && rowUid === userId) return true;
    if (cleanEmail && rowEmail && rowEmail === cleanEmail) return true;
    if (cleanPhone && rowPhone && rowPhone === cleanPhone) return true;
    return false;
  };

  // 1. Check local cloud mirror first
  try {
    const mirror = readLocalCloudMirror();
    for (const s of Object.values(mirror.collections.submissions || {})) {
      if (matchesTargetUser(s)) {
        subMap.set(String(s.id), {
          id: String(s.id),
          title: String(s.title || "তথ্য"),
          category_slug: String(s.category_slug || "general"),
          contact: String(s.contact || ""),
          address: String(s.address || ""),
          status: String(s.status || "pending"),
          created_at: String(s.created_at || new Date().toISOString()),
        });
      }
    }
    for (const acc of Object.values(mirror.collections.category_access || {})) {
      if (matchesTargetUser(acc) && acc.category_slug) {
        accessSet.add(String(acc.category_slug));
      }
    }
    for (const bd of Object.values(mirror.collections.blood_donors || {})) {
      if (matchesTargetUser(bd)) {
        donorMap.set(String(bd.id), {
          id: String(bd.id),
          full_name: String(bd.full_name || ""),
          blood_group: String(bd.blood_group || ""),
          phone: String(bd.phone || ""),
          address: String(bd.address || ""),
          status: String(bd.status || "pending"),
        });
      }
    }
    for (const dn of Object.values(mirror.collections.donations || {})) {
      if (matchesTargetUser(dn)) {
        donationMap.set(String(dn.id), {
          id: String(dn.id),
          sender_name: String(dn.sender_name || ""),
          sender_phone: String(dn.sender_phone || ""),
          amount: Number(dn.amount || 0),
          method: String(dn.method || "bKash"),
          trx_id: String(dn.trx_id || ""),
          status: String(dn.status || "pending"),
          created_at: String(dn.created_at || new Date().toISOString()),
        });
      }
    }
  } catch {
    // ignore
  }

  // 2. Fetch from server /api/content & /api/chat/threads (works for all Super Admin sessions)
  try {
    const [subsResp, accResp, apprResp, donorsResp, donsResp, chatResp] = await Promise.all([
      fetch("/api/content?collection=submissions").catch(() => null),
      fetch("/api/content?collection=category_access").catch(() => null),
      fetch("/api/content?collection=settings&id=category_approvals").catch(() => null),
      fetch("/api/content?collection=blood_donors").catch(() => null),
      fetch("/api/content?collection=donations").catch(() => null),
      fetch("/api/chat/threads").catch(() => null),
    ]);

    if (subsResp && subsResp.ok) {
      const j = await subsResp.json().catch(() => null);
      for (const s of j?.items || []) {
        if (matchesTargetUser(s)) {
          subMap.set(String(s.id), {
            id: String(s.id),
            title: String(s.title || "তথ্য"),
            category_slug: String(s.category_slug || "general"),
            contact: String(s.contact || ""),
            address: String(s.address || ""),
            status: String(s.status || "pending"),
            created_at: String(s.created_at || new Date().toISOString()),
          });
        }
      }
    }

    if (accResp && accResp.ok) {
      const j = await accResp.json().catch(() => null);
      for (const a of j?.items || []) {
        if (matchesTargetUser(a) && a.category_slug) {
          accessSet.add(String(a.category_slug));
        }
      }
    }

    if (apprResp && apprResp.ok) {
      const j = await apprResp.json().catch(() => null);
      const raw = j?.item?.logo_url;
      if (typeof raw === "string" && raw.trim()) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            const byUid = parsed[userId];
            if (Array.isArray(byUid)) {
              byUid.forEach((slug: any) => {
                if (typeof slug === "string" && slug.trim()) accessSet.add(slug.trim());
              });
            }
            if (cleanEmail && Array.isArray(parsed[cleanEmail])) {
              parsed[cleanEmail].forEach((slug: any) => {
                if (typeof slug === "string" && slug.trim()) accessSet.add(slug.trim());
              });
            }
          }
        } catch {
          // ignore
        }
      }
    }

    if (donorsResp && donorsResp.ok) {
      const j = await donorsResp.json().catch(() => null);
      for (const bd of j?.items || []) {
        if (matchesTargetUser(bd)) {
          donorMap.set(String(bd.id), {
            id: String(bd.id),
            full_name: String(bd.full_name || ""),
            blood_group: String(bd.blood_group || ""),
            phone: String(bd.phone || ""),
            address: String(bd.address || ""),
            status: String(bd.status || "pending"),
          });
        }
      }
    }

    if (donsResp && donsResp.ok) {
      const j = await donsResp.json().catch(() => null);
      for (const dn of j?.items || []) {
        if (matchesTargetUser(dn)) {
          donationMap.set(String(dn.id), {
            id: String(dn.id),
            sender_name: String(dn.sender_name || ""),
            sender_phone: String(dn.sender_phone || ""),
            amount: Number(dn.amount || 0),
            method: String(dn.method || "bKash"),
            trx_id: String(dn.trx_id || ""),
            status: String(dn.status || "pending"),
            created_at: String(dn.created_at || new Date().toISOString()),
          });
        }
      }
    }

    if (chatResp && chatResp.ok) {
      const j = await chatResp.json().catch(() => null);
      for (const t of j?.threads || []) {
        if (
          t &&
          (t.id === userId ||
            t.user_id === userId ||
            (cleanEmail && String(t.user_email || "").toLowerCase() === cleanEmail) ||
            (cleanPhone && String(t.user_phone || "") === cleanPhone))
        ) {
          chatCount += 1;
          if (t.last_message_preview) {
            lastChatPreview = String(t.last_message_preview);
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // 3. Also query Firestore if signed in with verified Firebase account
  if (auth.currentUser?.emailVerified) {
    try {
      const [subsSnap, accSnap] = await Promise.all([
        getDocs(query(collection(db, "submissions"))).catch(() => null),
        getDocs(query(collection(db, "category_access"), where("user_id", "==", userId))).catch(
          () => null
        ),
      ]);
      for (const d of subsSnap?.docs || []) {
        const s = d.data();
        if (matchesTargetUser(s)) {
          subMap.set(d.id, {
            id: d.id,
            title: String(s.title || "তথ্য"),
            category_slug: String(s.category_slug || "general"),
            contact: String(s.contact || ""),
            address: String(s.address || ""),
            status: String(s.status || "pending"),
            created_at: String(s.created_at || new Date().toISOString()),
          });
        }
      }
      for (const d of accSnap?.docs || []) {
        const slug = d.data()?.category_slug;
        if (slug) accessSet.add(String(slug));
      }
    } catch {
      // ignore
    }
  }

  const allMatchingSubs = Array.from(subMap.values()).sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );

  return {
    subCount: {
      pending: allMatchingSubs.filter((s) => s.status === "pending").length,
      approved: allMatchingSubs.filter((s) => s.status === "approved").length,
      rejected: allMatchingSubs.filter((s) => s.status === "rejected").length,
    },
    access: Array.from(accessSet),
    submissions: allMatchingSubs,
    bloodDonors: Array.from(donorMap.values()),
    donations: Array.from(donationMap.values()),
    chatCount,
    lastChatPreview,
  };
}
