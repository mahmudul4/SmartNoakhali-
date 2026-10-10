import { useEffect, useState, useCallback } from "react";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
  auth,
  db,
  SUPER_ADMIN_EMAIL,
  REGULAR_ADMIN_EMAIL,
  isSuperAdminEmail,
  sanitizeString,
} from "@/lib/firebase";

export type StaffRoleType = "super_admin" | "admin" | "editor" | "moderator" | "staff";

export type AuditActionType =
  | "delete"
  | "approve"
  | "reject"
  | "edit"
  | "create"
  | "reply"
  | "profile"
  | "user"
  | "settings";

export type AuditModuleType =
  | "info"
  | "donors"
  | "events"
  | "emergency"
  | "banners"
  | "chat"
  | "donation"
  | "categories"
  | "users"
  | "access"
  | "profile"
  | "settings";

export interface StaffActivityLogEntry {
  id: string;
  actor_id: string;
  actor_email: string;
  actor_name: string;
  actor_role: StaffRoleType;
  actor_role_bn: string;
  actor_photo?: string;
  action_type: AuditActionType;
  action_label: string;
  module: AuditModuleType;
  module_label: string;
  target_id: string;
  target_title: string;
  target_detail?: string;
  deleted_snapshot?: Record<string, unknown> | null;
  collection_name?:
    | "submissions"
    | "blood_donors"
    | "donation_events"
    | "emergency_blood_requests"
    | "emergency_banners"
    | "donations"
    | "category_requests"
    | "payment_requests";
  restored?: boolean;
  created_at: string;
}

const LOCAL_AUDIT_LOGS_KEY = "sn_staff_audit_logs_v1";
const STAFF_PROFILES_SETTING_ID = "staff_profiles_config";
const LOCAL_STAFF_PROFILES_KEY = "sn_staff_profiles_v1";
const LOCAL_USER_SESSION_KEY = "sn_verified_user_session_v1";
const SUPER_ADMIN_SESSION_KEY = "sn_super_admin_session_v1";
const MAX_AUDIT_LOGS = 250;

function readLocalStaffProfiles(): Record<
  string,
  {
    uid?: string;
    email?: string;
    full_name?: string;
    role_label?: string;
    photo_url?: string;
    designation?: string;
  }
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

export function resolveCurrentStaffActor(): {
  actor_id: string;
  actor_email: string;
  actor_name: string;
  actor_role: StaffRoleType;
  actor_role_bn: string;
  actor_photo: string;
} {
  const staffProfiles = readLocalStaffProfiles();

  // 1. Check if Super Admin session is active
  let isSuperSession = false;
  try {
    isSuperSession = sessionStorage.getItem(SUPER_ADMIN_SESSION_KEY) === "true";
  } catch {
    // ignore
  }

  if (
    isSuperSession ||
    (auth.currentUser?.email && isSuperAdminEmail(auth.currentUser.email))
  ) {
    const sp =
      staffProfiles.super_admin_mahmudul ||
      staffProfiles[SUPER_ADMIN_EMAIL.toLowerCase()];
    return {
      actor_id: auth.currentUser?.uid || "super_admin_mahmudul",
      actor_email: SUPER_ADMIN_EMAIL,
      actor_name: sp?.full_name || "Mahmudul Hasan (সুপার এডমিন)",
      actor_role: "super_admin",
      actor_role_bn: "সুপার এডমিন",
      actor_photo: sp?.photo_url || "",
    };
  }

  // 2. Check verified user / staff session in localStorage
  try {
    const raw = localStorage.getItem(LOCAL_USER_SESSION_KEY);
    if (raw) {
      const sess = JSON.parse(raw) as {
        uid?: string;
        email?: string;
        full_name?: string;
        username?: string;
        roles?: string[];
      };
      if (sess && (sess.uid || sess.email)) {
        const uid = sess.uid || sess.email || "staff";
        const email = (sess.email || "").toLowerCase();
        const roles = Array.isArray(sess.roles) ? sess.roles : [];
        const sp = staffProfiles[uid] || (email ? staffProfiles[email] : undefined);

        let role: StaffRoleType = "staff";
        let roleBn = "স্টাফ";
        if (isSuperAdminEmail(email)) {
          role = "super_admin";
          roleBn = "সুপার এডমিন";
        } else if (roles.includes("admin") || email === REGULAR_ADMIN_EMAIL.toLowerCase()) {
          role = "admin";
          roleBn = "এডমিন";
        } else if (roles.includes("editor")) {
          role = "editor";
          roleBn = "এডিটর";
        } else if (roles.includes("moderator")) {
          role = "moderator";
          roleBn = "মোডারেটর";
        }

        return {
          actor_id: uid,
          actor_email: email || uid,
          actor_name:
            sp?.full_name ||
            sess.full_name ||
            sess.username ||
            (email ? email.split("@")[0] : roleBn),
          actor_role: role,
          actor_role_bn: roleBn,
          actor_photo: sp?.photo_url || "",
        };
      }
    }
  } catch {
    // ignore
  }

  // 3. Check Firebase Auth currentUser
  if (auth.currentUser) {
    const u = auth.currentUser;
    const email = (u.email || "").toLowerCase();
    const sp = staffProfiles[u.uid] || (email ? staffProfiles[email] : undefined);
    const isRegAdmin = email === REGULAR_ADMIN_EMAIL.toLowerCase();
    return {
      actor_id: u.uid,
      actor_email: email || u.uid,
      actor_name:
        sp?.full_name || u.displayName || (email ? email.split("@")[0] : "স্টাফ"),
      actor_role: isRegAdmin ? "admin" : "staff",
      actor_role_bn: sp?.role_label || (isRegAdmin ? "এডমিন" : "স্টাফ"),
      actor_photo: sp?.photo_url || u.photoURL || "",
    };
  }

  return {
    actor_id: "staff_member",
    actor_email: "staff@smartnoakhali.app",
    actor_name: "স্টাফ সদস্য",
    actor_role: "staff",
    actor_role_bn: "স্টাফ",
    actor_photo: "",
  };
}

export function readLocalAuditLogs(): StaffActivityLogEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_AUDIT_LOGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function writeLocalAuditLogs(logs: StaffActivityLogEntry[]) {
  try {
    const sorted = [...logs]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, MAX_AUDIT_LOGS);
    localStorage.setItem(LOCAL_AUDIT_LOGS_KEY, JSON.stringify(sorted));
  } catch {
    // ignore
  }
}

export function mergeAuditLogs(
  incoming: StaffActivityLogEntry[]
): StaffActivityLogEntry[] {
  const local = readLocalAuditLogs();
  const map = new Map<string, StaffActivityLogEntry>();
  for (const item of local) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  for (const item of incoming) {
    if (item && item.id) {
      const prev = map.get(item.id);
      map.set(item.id, {
        ...prev,
        ...item,
        restored: Boolean(prev?.restored || item.restored),
      });
    }
  }
  const merged = Array.from(map.values())
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, MAX_AUDIT_LOGS);
  writeLocalAuditLogs(merged);
  return merged;
}

async function persistAuditLogsToFirestore(logs: StaffActivityLogEntry[]) {
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
    // Keep compact snapshot in Firestore settings to stay well under 300KB limit
    const compactLogs = logs.slice(0, 120).map((l) => ({
      ...l,
      actor_photo:
        l.actor_photo && l.actor_photo.length > 500 ? "" : l.actor_photo,
      deleted_snapshot: l.deleted_snapshot
        ? Object.fromEntries(
            Object.entries(l.deleted_snapshot).map(([k, v]) => [
              k,
              typeof v === "string" && v.length > 500 ? `${v.slice(0, 500)}...` : v,
            ])
          )
        : null,
    }));
    obj._staffAuditLogs = compactLogs;
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
    // Non-fatal
  }
}

export async function syncStaffAuditLogs(): Promise<StaffActivityLogEntry[]> {
  let current = readLocalAuditLogs();

  // 1. Fetch from Express / Netlify Server Store
  try {
    const resp = await fetch("/api/audit/logs");
    if (
      resp.ok &&
      (resp.headers.get("content-type") || "").includes("application/json")
    ) {
      const data = await resp.json();
      if (Array.isArray(data.logs)) {
        current = mergeAuditLogs(data.logs);
      }
    }
  } catch {
    // ignore
  }

  // 2. Fetch from Firestore settings document
  try {
    const snap = await getDoc(doc(db, "settings", STAFF_PROFILES_SETTING_ID));
    if (snap.exists()) {
      const raw = snap.data().logo_url;
      if (typeof raw === "string" && raw.trim()) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed._staffAuditLogs)) {
          current = mergeAuditLogs(parsed._staffAuditLogs);
        }
      }
    }
  } catch {
    // ignore
  }

  return current;
}

export async function recordStaffActivity(params: {
  action_type: AuditActionType;
  action_label: string;
  module: AuditModuleType;
  module_label: string;
  target_id: string;
  target_title: string;
  target_detail?: string;
  deleted_snapshot?: Record<string, unknown> | null;
  collection_name?: StaffActivityLogEntry["collection_name"];
}): Promise<StaffActivityLogEntry> {
  const actor = resolveCurrentStaffActor();
  const cleanSnapshot = params.deleted_snapshot
    ? Object.fromEntries(
        Object.entries(params.deleted_snapshot).filter(
          ([k, v]) =>
            k !== "image_url" &&
            k !== "photo_url" &&
            k !== "form_image_url" &&
            k !== "attachment_url" &&
            typeof v !== "function"
        )
      )
    : null;

  const entry: StaffActivityLogEntry = {
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    actor_id: actor.actor_id,
    actor_email: actor.actor_email,
    actor_name: actor.actor_name,
    actor_role: actor.actor_role,
    actor_role_bn: actor.actor_role_bn,
    actor_photo: actor.actor_photo,
    action_type: params.action_type,
    action_label: params.action_label,
    module: params.module,
    module_label: params.module_label,
    target_id: String(params.target_id || ""),
    target_title: String(params.target_title || "আইটেম"),
    target_detail: params.target_detail ? String(params.target_detail) : "",
    deleted_snapshot: cleanSnapshot,
    collection_name: params.collection_name,
    restored: false,
    created_at: new Date().toISOString(),
  };

  const merged = mergeAuditLogs([entry]);

  // Broadcast custom event for instant UI reactivity
  try {
    window.dispatchEvent(new CustomEvent("sn-staff-audit-updated"));
  } catch {
    // ignore
  }

  // Persist to Express/Netlify backend
  void fetch("/api/audit/record", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entry }),
  }).catch(() => {});

  // Persist to Firestore settings
  void persistAuditLogsToFirestore(merged);

  return entry;
}

export async function restoreDeletedAuditItem(
  entry: StaffActivityLogEntry
): Promise<{ ok: boolean; error?: string }> {
  if (!entry.deleted_snapshot || !entry.collection_name) {
    return { ok: false, error: "পুনরুদ্ধারযোগ্য তথ্য পাওয়া যায়নি" };
  }
  try {
    const snap = entry.deleted_snapshot;
    const col = entry.collection_name;
    const id = entry.target_id || `restored_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const restoredMirrorDoc: Record<string, unknown> = {
      ...snap,
      id,
      status:
        snap.status === "approved" || snap.status === "rejected"
          ? snap.status
          : "approved",
      updated_at: nowIso,
      created_at: String(snap.created_at || nowIso),
    };

    try {
      const { upsertCloudMirrorDoc } = await import("@/lib/cloud");
      upsertCloudMirrorDoc(col, id, restoredMirrorDoc);
    } catch {
      // ignore
    }

    if (auth.currentUser?.emailVerified) {
      const uid = auth.currentUser.uid;
      if (col === "submissions") {
        await setDoc(doc(db, "submissions", id), {
          author_id: uid,
          category_slug: sanitizeString(String(snap.category_slug || "general"), 80, "general"),
          title: sanitizeString(String(snap.title || entry.target_title), 200, "শিরোনাম"),
          body: sanitizeString(String(snap.body || ""), 2000, ""),
          contact: sanitizeString(String(snap.contact || ""), 100, ""),
          image_url: sanitizeString(String(snap.image_url || ""), 200000, ""),
          address: sanitizeString(String(snap.address || ""), 300, ""),
          designation: sanitizeString(String(snap.designation || ""), 150, ""),
          status:
            snap.status === "approved" || snap.status === "rejected"
              ? snap.status
              : "approved",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      } else if (col === "blood_donors") {
        await setDoc(doc(db, "blood_donors", id), {
          author_id: uid,
          full_name: sanitizeString(String(snap.full_name || entry.target_title), 120, "রক্তদাতা"),
          phone: sanitizeString(String(snap.phone || "01700000000"), 30, "01700000000"),
          blood_group: String(snap.blood_group || "O+"),
          address: sanitizeString(String(snap.address || ""), 300, ""),
          age: Math.min(Math.max(Number(snap.age ?? 25) || 0, 0), 120),
          last_donation_date: sanitizeString(String(snap.last_donation_date || ""), 40, ""),
          photo_url: sanitizeString(String(snap.photo_url || ""), 200000, ""),
          total_donations: Math.min(Math.max(Number(snap.total_donations ?? 0) || 0, 0), 500),
          status:
            snap.status === "approved" || snap.status === "rejected"
              ? snap.status
              : "approved",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      } else if (col === "emergency_blood_requests") {
        await setDoc(doc(db, "emergency_blood_requests", id), {
          author_id: uid,
          patient_name: sanitizeString(String(snap.patient_name || entry.target_title), 120, "রোগী"),
          phone: sanitizeString(String(snap.phone || "01700000000"), 30, "01700000000"),
          blood_group: String(snap.blood_group || "O+"),
          hospital: sanitizeString(String(snap.hospital || ""), 200, ""),
          message: sanitizeString(String(snap.message || ""), 1000, ""),
          status:
            snap.status === "approved" || snap.status === "rejected"
              ? snap.status
              : "approved",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      } else if (col === "emergency_banners") {
        await setDoc(doc(db, "emergency_banners", id), {
          author_id: uid,
          title: sanitizeString(String(snap.title || "জরুরী রক্তের প্রয়োজন"), 150, "জরুরী রক্তের প্রয়োজন"),
          message: sanitizeString(String(snap.message || entry.target_title), 1000, "বার্তা"),
          blood_group: sanitizeString(String(snap.blood_group || ""), 10, ""),
          hospital: sanitizeString(String(snap.hospital || ""), 200, ""),
          phone: sanitizeString(String(snap.phone || ""), 30, ""),
          visible: Boolean(snap.visible ?? true),
          sort_order: Number(snap.sort_order ?? 0) || 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      } else if (col === "donations") {
        await setDoc(doc(db, "donations", id), {
          author_id: uid,
          sender_name: sanitizeString(String(snap.sender_name || entry.target_title), 120, "দাতা"),
          sender_phone: sanitizeString(String(snap.sender_phone || ""), 30, ""),
          method: snap.method === "nagad" ? "nagad" : "bkash",
          trx_id: sanitizeString(String(snap.trx_id || "TRX00"), 64, "TRX00"),
          amount: Math.min(Math.max(Number(snap.amount) || 1, 1), 10000000),
          note: sanitizeString(String(snap.note || ""), 500, ""),
          status:
            snap.status === "approved" || snap.status === "rejected"
              ? snap.status
              : "approved",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      } else if (col === "donation_events") {
        await setDoc(doc(db, "donation_events", id), {
          author_id: uid,
          donor_id: sanitizeString(String(snap.donor_id || ""), 128, ""),
          event_date: sanitizeString(String(snap.event_date || ""), 40, new Date().toISOString().slice(0, 10)),
          place: sanitizeString(String(snap.place || ""), 200, ""),
          form_image_url: "",
          photo_url: "",
          note: sanitizeString(String(snap.note || ""), 500, ""),
          status: "approved",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    }

    // Mark as restored
    const updatedLogs = readLocalAuditLogs().map((l) =>
      l.id === entry.id ? { ...l, restored: true } : l
    );
    writeLocalAuditLogs(updatedLogs);
    void fetch("/api/audit/mark-restored", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id }),
    }).catch(() => {});
    void persistAuditLogsToFirestore(updatedLogs);

    await recordStaffActivity({
      action_type: "create",
      action_label: "ডিলিট করা তথ্য পুনরুদ্ধার (Restore) করেছে",
      module: entry.module,
      module_label: entry.module_label,
      target_id: id,
      target_title: entry.target_title,
      target_detail: `পূর্বে ${entry.actor_name} (${entry.actor_role_bn}) এটি ডিলিট করেছিলেন`,
    });

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "পুনরুদ্ধার ব্যর্থ হয়েছে",
    };
  }
}

export function useStaffAuditLogs() {
  const [logs, setLogs] = useState<StaffActivityLogEntry[]>(() =>
    readLocalAuditLogs()
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const synced = await syncStaffAuditLogs();
      setLogs(synced);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 3500);
    const onLocalUpdate = () => setLogs(readLocalAuditLogs());
    window.addEventListener("sn-staff-audit-updated", onLocalUpdate);
    return () => {
      clearInterval(timer);
      window.removeEventListener("sn-staff-audit-updated", onLocalUpdate);
    };
  }, [refresh]);

  return { logs, loading, refresh };
}
