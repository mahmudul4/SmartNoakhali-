import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { signInWithPopup } from "firebase/auth";
import {
  auth,
  db,
  googleProvider,
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD,
  REGULAR_ADMIN_EMAIL,
  isSuperAdminEmail,
  isBootstrappedAdminEmail,
  OperationType,
  handleFirestoreError,
  sanitizeString,
} from "@/lib/firebase";
import {
  type ChatThreadRow,
  isChatThreadDeleted,
  mergeServerChatDeletions,
  syncChatDeletionsFromFirestore,
} from "@/lib/cloud";
import { recordStaffActivity } from "@/lib/staff-audit";

export interface AdminUserRecord {
  id: string;
  email: string;
  password?: string;
  photo_url?: string | null;
  designation?: string | null;
  verified_via?: "email" | "phone" | "google" | string;
  created_at: string;
  last_sign_in_at?: string | null;
  banned_until: string | null;
  roles: string[];
  profile: {
    full_name: string | null;
    username: string | null;
    phone: string | null;
    suspended: boolean;
    must_change_password: boolean;
    photo_url?: string | null;
    designation?: string | null;
  } | null;
}

export interface VaultUserMeta {
  uid: string;
  email: string;
  password?: string;
  full_name?: string;
  username?: string;
  phone?: string;
  photo_url?: string;
  designation?: string;
  roles?: string[];
  suspended?: boolean;
  must_change_password?: boolean;
  verified_via?: "email" | "phone" | "google" | string;
  created_at?: string;
  updated_at: string;
}

const VAULT_SETTING_ID = "super_admin_user_vault";
const USER_REGISTRY_MIRROR_ID = "user_registry_mirror";
const LOCAL_VAULT_KEY = "sn_super_admin_vault_v1";
const LOCAL_STAFF_PROFILES_KEY = "sn_staff_profiles_v1";
const LOCAL_DELETED_USERS_KEY = "sn_deleted_users_v1";

function readLocalDeletedUsers(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_DELETED_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).toLowerCase());
    }
  } catch {
    // ignore
  }
  return [];
}

function writeLocalDeletedUsers(list: string[]) {
  try {
    const unique = Array.from(new Set(list.filter(Boolean).map((x) => x.toLowerCase())));
    localStorage.setItem(LOCAL_DELETED_USERS_KEY, JSON.stringify(unique));
  } catch {
    // ignore
  }
}

function readLocalVault(): Record<string, VaultUserMeta> {
  try {
    const raw = localStorage.getItem(LOCAL_VAULT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

function writeLocalVault(vault: Record<string, VaultUserMeta>) {
  try {
    localStorage.setItem(LOCAL_VAULT_KEY, JSON.stringify(vault));
  } catch {
    // ignore
  }
}

function readLocalStaffProfiles(): Record<
  string,
  { photo_url?: string; full_name?: string; designation?: string; phone?: string }
> {
  try {
    const raw = localStorage.getItem(LOCAL_STAFF_PROFILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

let lastVaultSyncAt = 0;
let cachedVaultResult: Record<string, VaultUserMeta> = {};

export async function syncVaultFromCloud(force = false): Promise<Record<string, VaultUserMeta>> {
  const now = Date.now();
  if (!force && now - lastVaultSyncAt < 30000 && Object.keys(cachedVaultResult).length > 0) {
    return cachedVaultResult;
  }
  lastVaultSyncAt = now;

  const local = readLocalVault();
  let merged: Record<string, VaultUserMeta> = { ...local };
  const deletedSet = new Set<string>(readLocalDeletedUsers());

  const upsertMeta = (u: Partial<VaultUserMeta> & { uid?: string; email?: string }) => {
    const cleanEmail = String(u.email || "").trim().toLowerCase();
    const cleanUid = String(u.uid || cleanEmail || "").trim();
    if (!cleanUid && !cleanEmail) return;
    const effectiveEmail =
      cleanEmail ||
      (u.phone ? `${String(u.phone).replace(/\D/g, "")}@phone.smartnoakhali.app` : `${cleanUid}@user.smartnoakhali.app`);
    const existing = merged[cleanUid] || merged[effectiveEmail];
    const meta: VaultUserMeta = {
      uid: cleanUid || existing?.uid || effectiveEmail,
      email: effectiveEmail,
      password: u.password || existing?.password,
      full_name: u.full_name || existing?.full_name,
      username: u.username || existing?.username,
      phone: u.phone || existing?.phone,
      photo_url: u.photo_url || existing?.photo_url,
      designation: u.designation || existing?.designation,
      roles: Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : existing?.roles || ["user"],
      suspended: u.suspended !== undefined ? Boolean(u.suspended) : existing?.suspended ?? false,
      must_change_password:
        u.must_change_password !== undefined
          ? Boolean(u.must_change_password)
          : existing?.must_change_password ?? false,
      verified_via: u.verified_via || existing?.verified_via || "email",
      created_at: u.created_at || existing?.created_at || u.updated_at || new Date().toISOString(),
      updated_at: u.updated_at || existing?.updated_at || new Date().toISOString(),
    };
    merged[meta.uid] = { ...merged[meta.uid], ...meta };
    merged[meta.email] = { ...merged[meta.email], ...meta };
  };

  // 1. Sync from Server Verified Users Store (/api/auth/users)
  try {
    const resp = await fetch("/api/auth/users");
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data.deletedIds)) {
        for (const dId of data.deletedIds) {
          const dIdLow = String(dId).toLowerCase();
          const existing =
            merged[dIdLow] ||
            Object.values(merged).find(
              (x) =>
                x.uid?.toLowerCase() === dIdLow || x.email?.toLowerCase() === dIdLow
            );
          if (!existing) {
            deletedSet.add(dIdLow);
          }
        }
        writeLocalDeletedUsers(Array.from(deletedSet));
      }
      if (Array.isArray(data.users)) {
        for (const u of data.users) {
          if (u && (u.email || u.uid)) {
            if (u.uid) deletedSet.delete(u.uid.toLowerCase());
            if (u.email) deletedSet.delete(u.email.toLowerCase());
            upsertMeta(u);
          }
        }
      }
    }
  } catch {
    // ignore network error
  }

  // 1.5 Sync from Hosting Content Store (/api/content) & Chat Threads (/api/chat/threads)
  try {
    const contentResp = await fetch("/api/content");
    if (contentResp.ok) {
      const contentData = await contentResp.json();
      for (const mirrorKey of [USER_REGISTRY_MIRROR_ID, VAULT_SETTING_ID]) {
        const raw = contentData?.[mirrorKey];
        if (typeof raw === "string" && raw.trim()) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.deletedIds)) {
              for (const dId of parsed.deletedIds) {
                if (dId) deletedSet.add(String(dId).toLowerCase());
              }
            }
            const usersObj =
              parsed?.users && typeof parsed.users === "object" ? parsed.users : parsed;
            if (usersObj && typeof usersObj === "object") {
              for (const v of Object.values(usersObj) as VaultUserMeta[]) {
                if (v && typeof v === "object" && (v.email || v.uid)) {
                  upsertMeta(v);
                }
              }
            }
          } catch {
            // ignore
          }
        }
      }

      // Also discover users who submitted listings/donors/donations in cloud_mirror
      const collections = contentData?.cloud_mirror?.collections;
      if (collections && typeof collections === "object") {
        for (const d of Object.values(collections.blood_donors || {}) as Array<Record<string, any>>) {
          if (d && (d.author_id || d.phone)) {
            const ph = String(d.phone || "").trim();
            const uid = String(d.author_id || `donor_${ph || d.id}`).trim();
            if (!merged[uid]) {
              upsertMeta({
                uid,
                email: ph ? `${ph.replace(/\D/g, "")}@phone.smartnoakhali.app` : `${uid}@user.smartnoakhali.app`,
                full_name: d.full_name || "রক্তদাতা",
                phone: ph,
                designation: `রক্তদাতা (${d.blood_group || ""})`,
                photo_url: d.photo_url || undefined,
                roles: ["user"],
                verified_via: "phone",
                created_at: d.created_at,
                updated_at: d.updated_at || d.created_at || new Date().toISOString(),
              });
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // 2. Sync from Firestore (/settings/user_registry_mirror — readable across all sessions)
  try {
    const regSnap = await getDoc(doc(db, "settings", USER_REGISTRY_MIRROR_ID));
    if (regSnap.exists()) {
      const raw = regSnap.data().logo_url;
      if (typeof raw === "string" && raw.trim()) {
        const parsed = JSON.parse(raw) as {
          users?: Record<string, VaultUserMeta>;
          deletedIds?: string[];
        };
        if (Array.isArray(parsed.deletedIds)) {
          for (const dId of parsed.deletedIds) {
            if (dId) deletedSet.add(String(dId).toLowerCase());
          }
          writeLocalDeletedUsers(Array.from(deletedSet));
        }
        const mirrorUsers =
          parsed.users && typeof parsed.users === "object"
            ? parsed.users
            : (parsed as unknown as Record<string, VaultUserMeta>);
        for (const v of Object.values(mirrorUsers)) {
          if (v && typeof v === "object" && (v.email || v.uid)) {
            upsertMeta(v);
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // 3. Sync from Firestore (/settings/super_admin_user_vault)
  try {
    const snap = await getDoc(doc(db, "settings", VAULT_SETTING_ID));
    if (snap.exists()) {
      const raw = snap.data().logo_url;
      if (typeof raw === "string" && raw.trim()) {
        const cloudVault = JSON.parse(raw) as Record<string, VaultUserMeta>;
        for (const v of Object.values(cloudVault)) {
          if (v && typeof v === "object" && (v.email || v.uid)) {
            upsertMeta(v);
          }
        }
      }
    }
  } catch {
    // Ignore if not signed in as staff yet
  }

  // Purge only genuinely deleted users from merged vault (never active staff or newly created/stored users)
  for (const [k, v] of Object.entries(merged)) {
    const kLow = k.toLowerCase();
    const uidLow = (v?.uid || "").toLowerCase();
    const emailLow = (v?.email || "").toLowerCase();
    if (
      emailLow === SUPER_ADMIN_EMAIL.toLowerCase() ||
      emailLow === REGULAR_ADMIN_EMAIL.toLowerCase() ||
      kLow === "super_admin_mahmudul" ||
      kLow === "admin_mr_bear"
    ) {
      continue;
    }
    // Only delete if explicitly marked deleted and user lacks active verified credentials
    if (
      (deletedSet.has(kLow) || (uidLow && deletedSet.has(uidLow)) || (emailLow && deletedSet.has(emailLow))) &&
      !v?.password &&
      !v?.verified_via
    ) {
      delete merged[k];
    }
  }

  writeLocalVault(merged);
  cachedVaultResult = merged;
  return merged;
}

export async function recordUserCredential(entry: {
  uid?: string;
  email: string;
  password?: string;
  full_name?: string;
  username?: string;
  phone?: string;
  photo_url?: string;
  designation?: string;
  roles?: string[];
  suspended?: boolean;
  must_change_password?: boolean;
  verified_via?: "email" | "phone" | "google";
}) {
  const cleanEmail = entry.email.trim().toLowerCase();
  const cleanPhone = (entry.phone || "").replace(/\D/g, "");
  const effectiveEmail =
    cleanEmail || (cleanPhone ? `${cleanPhone}@phone.smartnoakhali.app` : "");
  if (!effectiveEmail) return;

  const vault = readLocalVault();
  const key = entry.uid || effectiveEmail;
  if (entry.password || entry.verified_via) {
    const prevDel = readLocalDeletedUsers().filter(
      (x) => x !== key.toLowerCase() && x !== effectiveEmail.toLowerCase()
    );
    writeLocalDeletedUsers(prevDel);
  }
  const existing = vault[key] || vault[effectiveEmail] || {
    uid: key,
    email: effectiveEmail,
    updated_at: new Date().toISOString(),
  };

  const updated: VaultUserMeta = {
    ...existing,
    uid: entry.uid || existing.uid || effectiveEmail,
    email: effectiveEmail,
    password: entry.password !== undefined ? entry.password : existing.password,
    full_name: entry.full_name !== undefined ? entry.full_name : existing.full_name,
    username: entry.username !== undefined ? entry.username : existing.username,
    phone: entry.phone !== undefined ? entry.phone : existing.phone,
    photo_url: entry.photo_url !== undefined ? entry.photo_url : existing.photo_url,
    designation: entry.designation !== undefined ? entry.designation : existing.designation,
    roles: entry.roles !== undefined ? entry.roles : existing.roles,
    suspended: entry.suspended !== undefined ? entry.suspended : existing.suspended,
    must_change_password:
      entry.must_change_password !== undefined
        ? entry.must_change_password
        : existing.must_change_password,
    verified_via: entry.verified_via !== undefined ? entry.verified_via : existing.verified_via,
    created_at: existing.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  vault[key] = updated;
  vault[effectiveEmail] = updated;
  writeLocalVault(vault);

  // Sync with Express server store so phone/email/staff logins and Super Admin user list always work
  try {
    await fetch("/api/auth/sync-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: updated.uid,
        email: updated.email,
        phone: updated.phone || "",
        password: updated.password,
        full_name: updated.full_name || updated.email.split("@")[0],
        username: updated.username || updated.email.split("@")[0],
        roles: updated.roles || ["user"],
        photo_url: updated.photo_url,
        designation: updated.designation,
        suspended: Boolean(updated.suspended),
        verified_via: updated.verified_via || "email",
        is_verified: true,
      }),
    });
  } catch {
    // Non-fatal
  }

  // Also sync user_registry_mirror to /api/content/sync so all devices and sessions see updated user info
  const regPayload = sanitizeString(
    JSON.stringify({ users: vault, deletedIds: readLocalDeletedUsers() }),
    295000,
    "{}"
  );
  try {
    await fetch("/api/content/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [USER_REGISTRY_MIRROR_ID]: regPayload,
      }),
    });
  } catch {
    // Non-fatal
  }

  // Persist to Firestore /settings/user_registry_mirror whenever signed in
  if (auth.currentUser) {
    try {
      const regRef = doc(db, "settings", USER_REGISTRY_MIRROR_ID);
      const regSnap = await getDoc(regRef).catch(() => null);
      if (!regSnap || !regSnap.exists()) {
        await setDoc(regRef, {
          key: USER_REGISTRY_MIRROR_ID,
          logo_url: regPayload,
          visible: true,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      } else {
        await updateDoc(regRef, {
          logo_url: regPayload,
          visible: true,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    } catch {
      // Non-fatal
    }
  }

  // If current user is verified Super Admin, also persist to Firestore /settings/super_admin_user_vault (visible: false)
  if (auth.currentUser?.emailVerified && isSuperAdminEmail(auth.currentUser.email)) {
    try {
      const ref = doc(db, "settings", VAULT_SETTING_ID);
      const serialized = sanitizeString(JSON.stringify(vault), 295000, "{}");
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          key: VAULT_SETTING_ID,
          logo_url: serialized,
          visible: false,
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(ref, {
          logo_url: serialized,
          visible: false,
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Non-fatal
    }
  }
}

export function isProtectedMainSuperAdmin(userOrEmail?: {
  id?: string | null;
  email?: string | null;
  username?: string | null;
}): boolean {
  if (!userOrEmail) return false;
  const email = (userOrEmail.email ?? "").trim().toLowerCase();
  const uname = (userOrEmail.username ?? "").trim().toLowerCase();
  const id = (userOrEmail.id ?? "").trim().toLowerCase();
  return (
    email === SUPER_ADMIN_EMAIL.toLowerCase() ||
    uname === "mahmudul" ||
    id === "super_admin_mahmudul"
  );
}

function tsToIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === "string") return val;
  if (
    typeof val === "object" &&
    val !== null &&
    "toDate" in val &&
    typeof (val as { toDate: () => Date }).toDate === "function"
  ) {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function isVerifiedFirebaseSuperAdmin(): boolean {
  const u = auth.currentUser;
  return Boolean(u && (isSuperAdminEmail(u.email) || isBootstrappedAdminEmail(u.email)));
}

function isVerifiedFirebaseBootstrappedStaff(): boolean {
  const u = auth.currentUser;
  return Boolean(u && isBootstrappedAdminEmail(u.email));
}

function hasActiveSuperAdminSession(): boolean {
  if (isVerifiedFirebaseSuperAdmin()) return true;
  if (auth.currentUser && isBootstrappedAdminEmail(auth.currentUser.email)) return true;
  try {
    if (sessionStorage.getItem("sn_super_admin_session_v1") === "true") return true;
    const raw = sessionStorage.getItem("sn_verified_user_session_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        isBootstrappedAdminEmail(parsed?.user?.email) ||
        (Array.isArray(parsed?.roles) && parsed.roles.includes("admin"))
      ) {
        return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

async function ensureSuperAdminSignedIn() {
  if (hasActiveSuperAdminSession()) {
    return auth.currentUser;
  }
  if (auth.currentUser) return auth.currentUser;
  googleProvider.setCustomParameters({ login_hint: SUPER_ADMIN_EMAIL });
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

async function assertNotProtectedSuperAdmin(userId: string) {
  if (userId === "super_admin_mahmudul") {
    throw new Error("মেইন সুপার এডমিন (mdmahmudulhashan0@gmail.com) রিমোভ বা পরিবর্তন করা যাবে না।");
  }
  const snap = await getDoc(doc(db, "users", userId)).catch(() => null);
  if (snap && snap.exists()) {
    const data = snap.data();
    if (
      isProtectedMainSuperAdmin({
        id: userId,
        email: String(data.email ?? ""),
        username: String(data.username ?? ""),
      })
    ) {
      throw new Error("মেইন সুপার এডমিন (mdmahmudulhashan0@gmail.com) রিমোভ বা পরিবর্তন করা যাবে না।");
    }
  }
}

export async function listUsers(): Promise<AdminUserRecord[]> {
  const vault = await syncVaultFromCloud();
  const staffProfiles = readLocalStaffProfiles();

  const defaultSuperAdminRow: AdminUserRecord = {
    id:
      auth.currentUser?.uid && isSuperAdminEmail(auth.currentUser.email)
        ? auth.currentUser.uid
        : "super_admin_mahmudul",
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
    photo_url:
      staffProfiles.super_admin_mahmudul?.photo_url ||
      staffProfiles[SUPER_ADMIN_EMAIL.toLowerCase()]?.photo_url ||
      vault[SUPER_ADMIN_EMAIL.toLowerCase()]?.photo_url ||
      null,
    designation:
      staffProfiles.super_admin_mahmudul?.designation ||
      "মেইন সুপার এডমিন • স্মার্ট নোয়াখালী",
    created_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    banned_until: null,
    roles: ["admin", "moderator", "editor", "user"],
    profile: {
      full_name:
        staffProfiles.super_admin_mahmudul?.full_name ||
        "Mahmudul Hasan (Super Admin)",
      username: "mahmudul",
      phone: "01850999178",
      suspended: false,
      must_change_password: false,
      photo_url:
        staffProfiles.super_admin_mahmudul?.photo_url ||
        staffProfiles[SUPER_ADMIN_EMAIL.toLowerCase()]?.photo_url ||
        null,
      designation: "মেইন সুপার এডমিন",
    },
  };

  const defaultRegularAdminVault = vault[REGULAR_ADMIN_EMAIL.toLowerCase()];
  const defaultRegularAdminProfile = staffProfiles[REGULAR_ADMIN_EMAIL.toLowerCase()];
  const defaultRegularAdminRow: AdminUserRecord = {
    id: defaultRegularAdminVault?.uid || "admin_mr_bear",
    email: REGULAR_ADMIN_EMAIL,
    password: defaultRegularAdminVault?.password || "Google-Auth / Admin#2026",
    photo_url:
      defaultRegularAdminProfile?.photo_url ||
      defaultRegularAdminVault?.photo_url ||
      null,
    designation:
      defaultRegularAdminProfile?.designation ||
      defaultRegularAdminVault?.designation ||
      "এডিটর (সাধারণ এডমিন)",
    created_at: defaultRegularAdminVault?.updated_at || new Date().toISOString(),
    last_sign_in_at: defaultRegularAdminVault?.updated_at || new Date().toISOString(),
    banned_until: defaultRegularAdminVault?.suspended ? "suspended" : null,
    roles: defaultRegularAdminVault?.roles || ["editor", "user"],
    profile: {
      full_name:
        defaultRegularAdminProfile?.full_name ||
        defaultRegularAdminVault?.full_name ||
        "Admin (mr.bear444plus)",
      username: defaultRegularAdminVault?.username || "mr_bear_admin",
      phone:
        defaultRegularAdminProfile?.phone ||
        defaultRegularAdminVault?.phone ||
        "",
      suspended: Boolean(defaultRegularAdminVault?.suspended),
      must_change_password: Boolean(defaultRegularAdminVault?.must_change_password),
      photo_url:
        defaultRegularAdminProfile?.photo_url ||
        defaultRegularAdminVault?.photo_url ||
        null,
      designation: defaultRegularAdminVault?.designation || "শুধু এডমিন",
    },
  };

  const buildExtraVaultUsers = (existingEmails: Set<string>, existingIds: Set<string>) =>
    Object.values(vault)
      .filter(
        (v) =>
          (v.email || v.uid) &&
          !existingEmails.has((v.email || "").toLowerCase()) &&
          !existingIds.has((v.uid || "").toLowerCase()) &&
          (v.email || "").toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase() &&
          (v.email || "").toLowerCase() !== REGULAR_ADMIN_EMAIL.toLowerCase()
      )
      .reduce<AdminUserRecord[]>((acc, v) => {
        const emailLower = (v.email || "").toLowerCase();
        const uidLower = (v.uid || v.email || "").toLowerCase();
        if (
          acc.some(
            (x) =>
              (emailLower && x.email.toLowerCase() === emailLower) ||
              (uidLower && x.id.toLowerCase() === uidLower)
          )
        ) {
          return acc;
        }
        const roles = Array.isArray(v.roles) && v.roles.length > 0 ? v.roles : ["user"];
        const resolvedRoleDesignation =
          v.designation ||
          staffProfiles[emailLower]?.designation ||
          (roles.includes("admin")
            ? "শুধু এডমিন"
            : roles.includes("editor")
              ? "এডিটর"
              : roles.includes("moderator")
                ? "মডারেটর"
                : "সাধারণ ইউজার");
        const isSuspended = Boolean(v.suspended);
        acc.push({
          id: v.uid || v.email,
          email: v.email,
          password:
            v.password ||
            (v.verified_via === "google" ? "Google OAuth (সরাসরি গুগল লগইন)" : "ইউজার সেটকৃত পাসওয়ার্ড"),
          photo_url: v.photo_url || staffProfiles[emailLower]?.photo_url || null,
          designation: resolvedRoleDesignation,
          verified_via: v.verified_via || "email",
          created_at: v.created_at || v.updated_at,
          last_sign_in_at: v.updated_at,
          banned_until: isSuspended ? "suspended" : null,
          roles,
          profile: {
            full_name:
              v.full_name ||
              staffProfiles[emailLower]?.full_name ||
              v.email.split("@")[0],
            username: v.username || v.email.split("@")[0],
            phone: v.phone || staffProfiles[emailLower]?.phone || null,
            suspended: isSuspended,
            must_change_password: Boolean(v.must_change_password),
            photo_url: v.photo_url || staffProfiles[emailLower]?.photo_url || null,
            designation: resolvedRoleDesignation,
          },
        });
        return acc;
      }, []);

  const deletedSet = new Set(readLocalDeletedUsers());
  const isUserDeleted = (id?: string | null, email?: string | null) => {
    const idLow = (id || "").toLowerCase();
    const emLow = (email || "").toLowerCase();
    if (
      emLow === SUPER_ADMIN_EMAIL.toLowerCase() ||
      emLow === REGULAR_ADMIN_EMAIL.toLowerCase() ||
      idLow === "super_admin_mahmudul" ||
      idLow === "admin_mr_bear"
    ) {
      return false;
    }
    // If active in vault, definitely NOT deleted
    if ((idLow && vault[idLow]) || (emLow && vault[emLow])) {
      return false;
    }
    return (idLow && deletedSet.has(idLow)) || (emLow && deletedSet.has(emLow));
  };

  let snapDocs: Array<{ id: string; data: () => Record<string, any> }> = [];
  if (auth.currentUser) {
    try {
      const snap = await getDocs(collection(db, "users"));
      snapDocs = snap.docs;
      // Backfill any Firestore /users docs into vault so they are always available even if Super Admin logs in via Email/Password later
      for (const d of snap.docs) {
        const uData = d.data();
        if (uData && uData.email) {
          const emLow = String(uData.email).toLowerCase();
          if (!vault[d.id] && !vault[emLow]) {
            void recordUserCredential({
              uid: d.id,
              email: String(uData.email),
              full_name: uData.full_name || undefined,
              username: uData.username || undefined,
              phone: uData.phone || undefined,
              roles: Array.isArray(uData.roles) ? uData.roles : ["user"],
              suspended: Boolean(uData.suspended),
            });
          }
        }
      }
    } catch {
      // Fall back to vault + mirror if Firestore /users read is restricted
    }
  }

  const rows: AdminUserRecord[] = snapDocs.map((d) => {
    const data = d.data();
    const created_at = tsToIso(data.createdAt);
    const updated_at = tsToIso(data.updatedAt);
    const email = String(data.email ?? "");
    const emailLower = email.toLowerCase();
    const username = data.username ?? null;
    const isSuper = isProtectedMainSuperAdmin({ id: d.id, email, username });
    const isRegularBootstrapped = emailLower === REGULAR_ADMIN_EMAIL.toLowerCase();
    const vMeta = vault[d.id] || vault[emailLower];
    const sProf = staffProfiles[d.id] || staffProfiles[emailLower];

    const rawRoles =
      Array.isArray(vMeta?.roles) && vMeta.roles.length > 0
        ? vMeta.roles
        : Array.isArray(data.roles)
          ? (data.roles as string[])
          : ["user"];
    const roles = isSuper
      ? Array.from(new Set([...rawRoles, "admin", "moderator", "editor", "user"]))
      : isRegularBootstrapped && !rawRoles.includes("editor")
      ? Array.from(new Set([...rawRoles, "editor"]))
      : rawRoles;
    const suspended = isSuper ? false : Boolean(vMeta?.suspended ?? data.suspended);

    const resolvedPassword = isSuper
      ? SUPER_ADMIN_PASSWORD
      : vMeta?.password ||
        (vMeta?.verified_via === "google"
          ? "Google OAuth (সরাসরি গুগল লগইন)"
          : isRegularBootstrapped
          ? "Google-Auth / Admin#2026"
          : "Google OAuth / নিবন্ধিত পাসওয়ার্ড");

    const resolvedPhoto = sProf?.photo_url || vMeta?.photo_url || null;
    const resolvedDesignation =
      sProf?.designation ||
      vMeta?.designation ||
      (isSuper
        ? "মেইন সুপার এডমিন"
        : roles.includes("admin")
        ? "শুধু এডমিন"
        : roles.includes("editor")
        ? "এডিটর"
        : roles.includes("moderator")
        ? "মডারেটর"
        : "সাধারণ ইউজার");

    return {
      id: d.id,
      email,
      password: resolvedPassword,
      photo_url: resolvedPhoto,
      designation: resolvedDesignation,
      verified_via: vMeta?.verified_via || "google",
      created_at,
      last_sign_in_at: updated_at,
      banned_until: suspended ? "suspended" : null,
      roles,
      profile: {
        full_name:
          sProf?.full_name ||
          vMeta?.full_name ||
          data.full_name ||
          (isSuper ? "Mahmudul Hasan (Super Admin)" : null),
        username: isSuper ? "mahmudul" : vMeta?.username || username,
        phone: sProf?.phone || vMeta?.phone || data.phone || null,
        suspended,
        must_change_password: Boolean(vMeta?.must_change_password ?? data.must_change_password),
        photo_url: resolvedPhoto,
        designation: resolvedDesignation,
      },
    };
  });

  if (
    !rows.some((r) =>
      isProtectedMainSuperAdmin({ id: r.id, email: r.email, username: r.profile?.username })
    )
  ) {
    rows.unshift(defaultSuperAdminRow);
  }

  if (
    !isUserDeleted(defaultRegularAdminRow.id, defaultRegularAdminRow.email) &&
    !rows.some((r) => r.email.toLowerCase() === REGULAR_ADMIN_EMAIL.toLowerCase())
  ) {
    rows.splice(1, 0, defaultRegularAdminRow);
  }

  const activeRows = rows.filter((r) => !isUserDeleted(r.id, r.email));
  const seenEmails = new Set(activeRows.map((r) => (r.email || "").toLowerCase()).filter(Boolean));
  const seenIds = new Set(activeRows.map((r) => (r.id || "").toLowerCase()).filter(Boolean));
  const extraVaultRows = buildExtraVaultUsers(seenEmails, seenIds).filter(
    (u) => !isUserDeleted(u.id, u.email)
  );

  const combined = [...activeRows, ...extraVaultRows];
  const uniqueMap = new Map<string, AdminUserRecord>();
  for (const item of combined) {
    if (!item) continue;
    const emKey = (item.email || "").trim().toLowerCase();
    const idKey = (item.id || "").trim().toLowerCase();
    const primaryKey = emKey || idKey;
    if (!primaryKey) continue;
    if (!uniqueMap.has(primaryKey)) {
      uniqueMap.set(primaryKey, item);
    }
  }
  return Array.from(uniqueMap.values());
}

export async function createUser(opts?: {
  data?: {
    email: string;
    password: string;
    full_name?: string;
    phone?: string;
    designation?: string;
    photo_url?: string;
    role?: "admin" | "moderator" | "editor" | "user";
  };
}): Promise<{ id: string }> {
  await ensureSuperAdminSignedIn();
  const payload = opts?.data;
  if (!payload?.email) throw new Error("ইমেইল আবশ্যক");
  const id = `usr_${crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24)}`;
  const role = payload.role ?? "user";
  const roles = role === "user" ? ["user"] : ["user", role];
  const username = sanitizeString(payload.email.split("@")[0] || "user", 60, "user");
  const path = `users/${id}`;
  const cleanEmail = payload.email.trim().toLowerCase();

  // 1. Immediately remove from local and session deleted users so user is instantly visible
  const prevDel = readLocalDeletedUsers().filter(
    (x) => x !== id.toLowerCase() && x !== cleanEmail
  );
  writeLocalDeletedUsers(prevDel);

  // Permanently un-delete on server store so server never flags them as deleted
  try {
    await fetch("/api/auth/undelete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: id, email: cleanEmail }),
    });
  } catch {
    // Non-fatal
  }

  // 2. Always attempt to write to Firestore if any authenticated Firebase user exists
  if (auth.currentUser) {
    try {
      await setDoc(doc(db, "users", id), {
        uid: id,
        email: sanitizeString(payload.email, 254, "user@example.com"),
        full_name: sanitizeString(payload.full_name || username, 120, username),
        username,
        phone: sanitizeString(payload.phone ?? "", 30, ""),
        roles,
        suspended: false,
        must_change_password: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (role === "admin") {
        await setDoc(doc(db, "admins", id), {
          uid: id,
          email: sanitizeString(payload.email, 254, "user@example.com"),
          createdAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.warn("Firestore user creation write note:", e);
    }
  }

  // 3. Immediately record user credentials locally and in Express server store
  await recordUserCredential({
    uid: id,
    email: payload.email,
    password: payload.password,
    full_name: payload.full_name || username,
    username,
    phone: payload.phone || "",
    photo_url: payload.photo_url || "",
    designation: payload.designation || "",
    roles,
    suspended: false,
  });

  void recordStaffActivity({
    action_type: "create",
    action_label: `নতুন ইউজার তৈরি করেছে (${role})`,
    module: "users",
    module_label: "ইউজার ম্যানেজমেন্ট",
    target_id: id,
    target_title: `${payload.full_name || username} (${payload.email})`,
    target_detail: `রোল: ${roles.join(", ")} • ফোন: ${payload.phone || "—"}`,
  });

  return { id };
}

export async function setUserRole(opts?: {
  data?: {
    user_id: string;
    role: "admin" | "moderator" | "editor" | "user";
    enable: boolean;
  };
}): Promise<{ ok: boolean }> {
  await ensureSuperAdminSignedIn();
  const d = opts?.data;
  if (!d) throw new Error("Missing data");
  await assertNotProtectedSuperAdmin(d.user_id);

  const vault = readLocalVault();
  const vMeta =
    vault[d.user_id] ||
    Object.values(vault).find(
      (x) =>
        x.uid === d.user_id ||
        x.email?.toLowerCase() === d.user_id.toLowerCase()
    );
  const existingVaultRoles = Array.isArray(vMeta?.roles) ? vMeta.roles : ["user"];
  const nextSet = new Set(existingVaultRoles);
  if (d.enable) nextSet.add(d.role);
  else nextSet.delete(d.role);
  if (nextSet.size === 0) nextSet.add("user");
  const nextRoles = Array.from(nextSet).slice(0, 4);

  if (isVerifiedFirebaseSuperAdmin()) {
    const userPath = `users/${d.user_id}`;
    const ref = doc(db, "users", d.user_id);
    const snap = await getDoc(ref).catch(() => null);
    if (snap && snap.exists()) {
      const docRoles = Array.isArray(snap.data().roles) ? (snap.data().roles as string[]) : ["user"];
      const docSet = new Set(docRoles);
      if (d.enable) docSet.add(d.role);
      else docSet.delete(d.role);
      if (docSet.size === 0) docSet.add("user");
      const finalDocRoles = Array.from(docSet).slice(0, 4);

      await updateDoc(ref, {
        roles: finalDocRoles,
        updatedAt: serverTimestamp(),
      }).catch((e) => handleFirestoreError(e, OperationType.UPDATE, userPath));

      await recordUserCredential({
        uid: d.user_id,
        email: String(snap.data().email || vMeta?.email || d.user_id),
        roles: finalDocRoles,
      });

      if (d.role === "admin") {
        const adminRef = doc(db, "admins", d.user_id);
        if (d.enable) {
          await setDoc(adminRef, {
            uid: d.user_id,
            email: sanitizeString(snap.data().email || "admin@example.com", 254, "admin@example.com"),
            createdAt: serverTimestamp(),
          }).catch(() => {});
        } else {
          await deleteDoc(adminRef).catch(() => {});
        }
      }
      return { ok: true };
    }
  }

  await recordUserCredential({
    uid: d.user_id,
    email: vMeta?.email || (d.user_id === "admin_mr_bear" ? REGULAR_ADMIN_EMAIL : d.user_id),
    roles: nextRoles,
  });

  void recordStaffActivity({
    action_type: "user",
    action_label: `ইউজারের রোল ${d.enable ? "যুক্ত" : "বাতিল"} করেছে (${d.role})`,
    module: "users",
    module_label: "ইউজার ম্যানেজমেন্ট",
    target_id: d.user_id,
    target_title: vMeta?.email || d.user_id,
    target_detail: `বর্তমান রোলসমূহ: ${nextRoles.join(", ")}`,
  });

  return { ok: true };
}

export async function deleteUser(opts?: {
  data?: { user_id: string; email?: string };
}): Promise<{ ok: boolean }> {
  await ensureSuperAdminSignedIn();
  const uid = opts?.data?.user_id?.trim() || "";
  const rawEmail = opts?.data?.email?.trim() || "";
  if (!uid && !rawEmail) throw new Error("Missing user_id");

  const vault = readLocalVault();
  const resolvedEmail = (
    rawEmail ||
    vault[uid]?.email ||
    (uid === "admin_mr_bear" ? REGULAR_ADMIN_EMAIL : "")
  )
    .trim()
    .toLowerCase();

  if (
    isProtectedMainSuperAdmin({
      id: uid,
      email: resolvedEmail,
    })
  ) {
    throw new Error("মেইন সুপার এডমিন (mdmahmudulhashan0@gmail.com) রিমোভ বা পরিবর্তন করা যাবে না।");
  }
  if (uid) {
    await assertNotProtectedSuperAdmin(uid);
  }

  // 1. Track in local deleted users list so user never resurrects
  const toTrack = [uid.toLowerCase(), resolvedEmail].filter(Boolean);
  writeLocalDeletedUsers([...readLocalDeletedUsers(), ...toTrack]);

  // 2. Remove from local vault & staff profiles
  for (const [k, v] of Object.entries(vault)) {
    const kLow = k.toLowerCase();
    const vUidLow = (v?.uid || "").toLowerCase();
    const vEmailLow = (v?.email || "").toLowerCase();
    if (
      (uid && (k === uid || kLow === uid.toLowerCase() || vUidLow === uid.toLowerCase())) ||
      (resolvedEmail && (kLow === resolvedEmail || vEmailLow === resolvedEmail))
    ) {
      delete vault[k];
    }
  }
  writeLocalVault(vault);

  try {
    const sp = readLocalStaffProfiles();
    if (uid) delete sp[uid];
    if (resolvedEmail) delete sp[resolvedEmail];
    localStorage.setItem(LOCAL_STAFF_PROFILES_KEY, JSON.stringify(sp));
  } catch {
    // ignore
  }

  // 3. Delete from Express Server Store (/api/auth/delete-user)
  try {
    await fetch("/api/auth/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: uid, email: resolvedEmail }),
    });
  } catch {
    // Non-fatal
  }

  // 3.5 Sync updated user_registry_mirror to /api/content/sync
  const regPayload = sanitizeString(
    JSON.stringify({ users: vault, deletedIds: readLocalDeletedUsers() }),
    295000,
    "{}"
  );
  try {
    await fetch("/api/content/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [USER_REGISTRY_MIRROR_ID]: regPayload }),
    });
  } catch {
    // ignore
  }

  // 4. Sync updated user_registry_mirror & vault, and delete Firestore documents
  if (auth.currentUser) {
    try {
      const regRef = doc(db, "settings", USER_REGISTRY_MIRROR_ID);
      await setDoc(
        regRef,
        {
          key: USER_REGISTRY_MIRROR_ID,
          logo_url: regPayload,
          visible: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => {});
    } catch {
      // ignore
    }
  }

  if (isVerifiedFirebaseSuperAdmin()) {
    try {
      const vaultRef = doc(db, "settings", VAULT_SETTING_ID);
      const serialized = sanitizeString(JSON.stringify(vault), 295000, "{}");
      const vSnap = await getDoc(vaultRef).catch(() => null);
      if (vSnap && vSnap.exists()) {
        await updateDoc(vaultRef, {
          logo_url: serialized,
          visible: false,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    } catch {
      // ignore
    }

    if (uid) {
      await deleteDoc(doc(db, "users", uid)).catch(() => {});
      await deleteDoc(doc(db, "admins", uid)).catch(() => {});
    }

    if (resolvedEmail) {
      try {
        const allSnap = await getDocs(collection(db, "users")).catch(() => null);
        if (allSnap) {
          for (const d of allSnap.docs) {
            const dEmail = String(d.data().email || "").toLowerCase();
            if (dEmail === resolvedEmail && dEmail !== SUPER_ADMIN_EMAIL.toLowerCase()) {
              await deleteDoc(doc(db, "users", d.id)).catch(() => {});
              await deleteDoc(doc(db, "admins", d.id)).catch(() => {});
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }

  void recordStaffActivity({
    action_type: "delete",
    action_label: "ইউজার একাউন্ট ডিলিট করেছে",
    module: "users",
    module_label: "ইউজার ম্যানেজমেন্ট",
    target_id: uid || resolvedEmail,
    target_title: resolvedEmail || uid,
    target_detail: `ইউজার আইডি: ${uid || "—"} • ইমেইল: ${resolvedEmail || "—"}`,
    deleted_snapshot: { user_id: uid, email: resolvedEmail },
  });

  return { ok: true };
}

export async function suspendUser(opts?: {
  data?: { user_id: string; suspend: boolean };
}): Promise<{ ok: boolean }> {
  await ensureSuperAdminSignedIn();
  const d = opts?.data;
  if (!d) throw new Error("Missing data");
  await assertNotProtectedSuperAdmin(d.user_id);

  const vault = readLocalVault();
  const vMeta =
    vault[d.user_id] ||
    Object.values(vault).find(
      (x) =>
        x.uid === d.user_id ||
        x.email?.toLowerCase() === d.user_id.toLowerCase()
    );

  if (isVerifiedFirebaseSuperAdmin()) {
    const path = `users/${d.user_id}`;
    const snap = await getDoc(doc(db, "users", d.user_id)).catch(() => null);
    if (snap && snap.exists()) {
      await updateDoc(doc(db, "users", d.user_id), {
        suspended: Boolean(d.suspend),
        updatedAt: serverTimestamp(),
      }).catch((e) => handleFirestoreError(e, OperationType.UPDATE, path));
    }
  }

  await recordUserCredential({
    uid: d.user_id,
    email: vMeta?.email || (d.user_id === "admin_mr_bear" ? REGULAR_ADMIN_EMAIL : d.user_id),
    suspended: Boolean(d.suspend),
  });

  void recordStaffActivity({
    action_type: "user",
    action_label: d.suspend ? "ইউজার একাউন্ট স্থগিত (Suspend) করেছে" : "ইউজার একাউন্ট সক্রিয় করেছে",
    module: "users",
    module_label: "ইউজার ম্যানেজমেন্ট",
    target_id: d.user_id,
    target_title: vMeta?.email || d.user_id,
    target_detail: `স্ট্যাটাস: ${d.suspend ? "স্থগিত" : "সক্রিয়"}`,
  });

  return { ok: true };
}

export async function resetUserPassword(opts?: {
  data?: { user_id: string; email?: string; new_password?: string; force_change?: boolean };
}): Promise<{ password: string }> {
  await ensureSuperAdminSignedIn();
  const d = opts?.data;
  if (!d) throw new Error("Missing data");
  await assertNotProtectedSuperAdmin(d.user_id);
  const assignedPassword =
    d.new_password?.trim() ||
    `SN#${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.floor(10 + Math.random() * 89)}@`;

  if (isVerifiedFirebaseSuperAdmin()) {
    const path = `users/${d.user_id}`;
    const snap = await getDoc(doc(db, "users", d.user_id)).catch(() => null);
    if (snap && snap.exists()) {
      await updateDoc(doc(db, "users", d.user_id), {
        must_change_password: Boolean(d.force_change ?? false),
        updatedAt: serverTimestamp(),
      }).catch((e) => handleFirestoreError(e, OperationType.UPDATE, path));
    }
  }

  await recordUserCredential({
    uid: d.user_id,
    email: d.email || d.user_id,
    password: assignedPassword,
    must_change_password: Boolean(d.force_change ?? false),
  });

  return { password: assignedPassword };
}

export async function updateUserProfile(opts?: {
  data?: {
    user_id: string;
    email?: string;
    full_name?: string;
    username?: string;
    phone?: string;
    password?: string;
    photo_url?: string;
    designation?: string;
  };
}): Promise<{ ok: boolean }> {
  const d = opts?.data;
  if (!d) throw new Error("Missing data");
  const isSelf = auth.currentUser?.uid === d.user_id;
  if (!isSelf) {
    await ensureSuperAdminSignedIn();
  }
  if (isVerifiedFirebaseSuperAdmin() || isSelf) {
    const path = `users/${d.user_id}`;
    const snap = await getDoc(doc(db, "users", d.user_id)).catch(() => null);
    if (snap && snap.exists()) {
      await updateDoc(doc(db, "users", d.user_id), {
        full_name: sanitizeString(d.full_name ?? snap.data().full_name ?? "User", 120, "User"),
        username: sanitizeString(d.username ?? snap.data().username ?? "user", 60, "user"),
        phone: sanitizeString(d.phone ?? snap.data().phone ?? "", 30, ""),
        updatedAt: serverTimestamp(),
      }).catch((e) => handleFirestoreError(e, OperationType.UPDATE, path));
    }
  }

  await recordUserCredential({
    uid: d.user_id,
    email: d.email || d.user_id,
    full_name: d.full_name,
    username: d.username,
    phone: d.phone,
    password: d.password,
    photo_url: d.photo_url,
    designation: d.designation,
  });

  void recordStaffActivity({
    action_type: "profile",
    action_label: "প্রোফাইল তথ্য আপডেট করেছে",
    module: "profile",
    module_label: "প্রোফাইল",
    target_id: d.user_id,
    target_title: d.full_name || d.email || d.user_id,
    target_detail: `ইমেইল: ${d.email || "—"} • ফোন: ${d.phone || "—"} • পদবি: ${d.designation || "—"}`,
  });

  return { ok: true };
}

export async function listThreadsWithUsers() {
  const vault = await syncVaultFromCloud();
  await syncChatDeletionsFromFirestore();

  const mergedMap = new Map<
    string,
    ChatThreadRow & {
      profile: { full_name: string | null; username: string | null; phone: string | null } | null;
      email: string;
    }
  >();

  // 1. Load from Server Live Chat Hub (/api/chat/threads) — accessible by all staff
  try {
    const resp = await fetch("/api/chat/threads");
    if (resp.ok) {
      const data = await resp.json();
      if (data.deletedThreads || data.deletedAllBefore || data.deletedMessages) {
        mergeServerChatDeletions({
          deletedThreads: data.deletedThreads,
          deletedAllBefore: data.deletedAllBefore,
          deletedMessages: data.deletedMessages,
        });
      }
      if (Array.isArray(data.threads)) {
        for (const t of data.threads) {
          const tid = String(t.id);
          const lastAt = String(t.last_message_at || new Date().toISOString());
          if (isChatThreadDeleted(tid, lastAt)) continue;
          const vUser = vault[t.user_id] || (t.user_email ? vault[String(t.user_email).toLowerCase()] : undefined);
          mergedMap.set(tid, {
            id: tid,
            user_id: String(t.user_id || tid),
            last_message_at: lastAt,
            last_message_preview: t.last_message_preview ?? null,
            user_unread: Number(t.user_unread ?? 0),
            staff_unread: Number(t.staff_unread ?? 0),
            created_at: String(t.created_at || new Date().toISOString()),
            email: String(t.user_email || vUser?.email || ""),
            profile: {
              full_name: t.user_name || vUser?.full_name || null,
              username: vUser?.username || null,
              phone: t.user_phone || vUser?.phone || null,
            },
          });
        }
      }
    }
  } catch {
    // ignore
  }

  // 2. Also merge Firestore chat_threads if signed in with Firebase Staff account
  if (isVerifiedFirebaseBootstrappedStaff()) {
    try {
      const threadsSnap = await getDocs(collection(db, "chat_threads"));
      const usersSnap = isVerifiedFirebaseSuperAdmin()
        ? await getDocs(collection(db, "users")).catch(() => null)
        : null;

      const userMap = new Map<
        string,
        { email: string; full_name: string | null; username: string | null; phone: string | null }
      >();
      usersSnap?.docs.forEach((uDoc) => {
        const u = uDoc.data();
        userMap.set(uDoc.id, {
          email: String(u.email ?? ""),
          full_name: u.full_name ?? null,
          username: u.username ?? null,
          phone: u.phone ?? null,
        });
      });

      for (const tDoc of threadsSnap.docs) {
        const t = tDoc.data();
        const fsLastAt = String(t.last_message_at || tsToIso(t.updatedAt));
        const hasNoMessages = !t.last_message_preview && Number(t.staff_unread ?? 0) === 0 && Number(t.user_unread ?? 0) === 0;

        if (isChatThreadDeleted(tDoc.id, fsLastAt)) {
          // Clean up tombstoned thread from Firestore in the background
          getDocs(collection(db, "chat_threads", tDoc.id, "messages"))
            .then((mSnap) => Promise.all(mSnap.docs.map((m) => deleteDoc(m.ref).catch(() => {}))))
            .then(() => deleteDoc(doc(db, "chat_threads", tDoc.id)).catch(() => {}))
            .catch(() => {});
          continue;
        }

        if (hasNoMessages && !mergedMap.has(tDoc.id)) {
          continue;
        }

        const uInfo = userMap.get(String(t.user_id));
        const vUser = vault[String(t.user_id)];
        const existing = mergedMap.get(tDoc.id);

        if (!existing || fsLastAt > existing.last_message_at) {
          mergedMap.set(tDoc.id, {
            id: tDoc.id,
            user_id: String(t.user_id),
            last_message_at: fsLastAt,
            last_message_preview: t.last_message_preview ?? existing?.last_message_preview ?? null,
            user_unread: Number(t.user_unread ?? existing?.user_unread ?? 0),
            staff_unread: Number(t.staff_unread ?? existing?.staff_unread ?? 0),
            created_at: tsToIso(t.createdAt),
            email: uInfo?.email || existing?.email || vUser?.email || "",
            profile: {
              full_name:
                uInfo?.full_name ||
                existing?.profile?.full_name ||
                vUser?.full_name ||
                null,
              username:
                uInfo?.username ||
                existing?.profile?.username ||
                vUser?.username ||
                null,
              phone:
                uInfo?.phone ||
                existing?.profile?.phone ||
                vUser?.phone ||
                null,
            },
          });
        }
      }
    } catch {
      // ignore
    }
  }

  const result = Array.from(mergedMap.values());
  result.sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
  return result;
}
