import {
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import {
  auth,
  db,
  OperationType,
  handleFirestoreError,
  sanitizeString,
  ensureCurrentUserProfileDoc,
} from "@/lib/firebase";

export const ua = () => (typeof navigator !== "undefined" ? navigator.userAgent : "");

const PIN_STORAGE_PREFIX = "sn_admin_pin_v1_";
const LOCK_STATE_KEY = "sn_admin_panel_locked_v1";
const LOGIN_ATTEMPTS_KEY = "sn_admin_login_attempts_v1";
const BACKUP_CODES_PREFIX = "sn_admin_backup_codes_v1_";

export function passwordProblem(p: string): string | null {
  if (p.length < 8) return "পাসওয়ার্ড কমপক্ষে ৮ অক্ষর হতে হবে।";
  if (!/[a-z]/.test(p) || !/[A-Z]/.test(p)) return "বড় ও ছোট হাতের অক্ষর দুটোই লাগবে।";
  if (!/[0-9]/.test(p)) return "অন্তত একটি সংখ্যা লাগবে।";
  if (!/[^A-Za-z0-9]/.test(p)) return "অন্তত একটি চিহ্ন (যেমন @ # !) লাগবে।";
  return null;
}

export async function verifyPassword(password: string): Promise<void> {
  const u = auth.currentUser;
  if (!u || !u.email) throw new Error("এই কাজটি করতে পুনরায় লগইন/যাচাই করতে হবে।");
  const cred = EmailAuthProvider.credential(u.email, password);
  try {
    await reauthenticateWithCredential(u, cred);
  } catch {
    throw new Error("বর্তমান পাসওয়ার্ড ভুল।");
  }
}

// ============================================================================
// Brute-Force Rate Limiter for Admin Login
// ============================================================================
interface LoginAttemptState {
  count: number;
  lockedUntil: number;
}

export function getLoginLockoutRemainingSeconds(): number {
  try {
    const raw = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
    if (!raw) return 0;
    const state = JSON.parse(raw) as LoginAttemptState;
    if (state.lockedUntil && state.lockedUntil > Date.now()) {
      return Math.ceil((state.lockedUntil - Date.now()) / 1000);
    }
  } catch {
    // ignore
  }
  return 0;
}

export function recordFailedAdminLogin(): { lockedSeconds: number; attemptsLeft: number } {
  try {
    const raw = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
    const prev: LoginAttemptState = raw ? JSON.parse(raw) : { count: 0, lockedUntil: 0 };
    const nextCount = prev.count + 1;
    const maxAttempts = 5;
    if (nextCount >= maxAttempts) {
      const lockedUntil = Date.now() + 60 * 1000; // 60 seconds lockout
      localStorage.setItem(
        LOGIN_ATTEMPTS_KEY,
        JSON.stringify({ count: 0, lockedUntil })
      );
      return { lockedSeconds: 60, attemptsLeft: 0 };
    }
    localStorage.setItem(
      LOGIN_ATTEMPTS_KEY,
      JSON.stringify({ count: nextCount, lockedUntil: 0 })
    );
    return { lockedSeconds: 0, attemptsLeft: Math.max(0, maxAttempts - nextCount) };
  } catch {
    return { lockedSeconds: 0, attemptsLeft: 5 };
  }
}

export function clearFailedAdminLogins() {
  try {
    localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
  } catch {
    // ignore
  }
}

// ============================================================================
// Admin Panel Security PIN & Screen Lock
// ============================================================================
export function getAdminSecurityPin(userId: string): string {
  try {
    return localStorage.getItem(`${PIN_STORAGE_PREFIX}${userId}`) || "";
  } catch {
    return "";
  }
}

export function setAdminSecurityPin(userId: string, pin: string) {
  try {
    if (!pin) {
      localStorage.removeItem(`${PIN_STORAGE_PREFIX}${userId}`);
    } else {
      localStorage.setItem(`${PIN_STORAGE_PREFIX}${userId}`, pin.trim());
    }
  } catch {
    // ignore
  }
}

export function isAdminPanelLocked(): boolean {
  try {
    return sessionStorage.getItem(LOCK_STATE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setAdminPanelLocked(locked: boolean) {
  try {
    if (locked) sessionStorage.setItem(LOCK_STATE_KEY, "true");
    else sessionStorage.removeItem(LOCK_STATE_KEY);
  } catch {
    // ignore
  }
}

export function getSavedBackupCodes(userId: string): string[] {
  try {
    const raw = localStorage.getItem(`${BACKUP_CODES_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

export function saveBackupCodes(userId: string, codes: string[]) {
  try {
    localStorage.setItem(`${BACKUP_CODES_PREFIX}${userId}`, JSON.stringify(codes));
  } catch {
    // ignore
  }
}

export async function rateLimit(_key: string, _max: number, _windowSecs: number): Promise<boolean> {
  return getLoginLockoutRemainingSeconds() === 0;
}

const LOCAL_SECURITY_EVENTS_PREFIX = "sn_sec_events_v1_";

export async function logEvent(event: string, detail?: string) {
  const u = auth.currentUser;
  const uid = u?.uid || "super_admin_mahmudul";
  const nowIso = new Date().toISOString();

  // Always save to local audit log so events are immediately visible
  try {
    const key = `${LOCAL_SECURITY_EVENTS_PREFIX}${uid}`;
    const prevRaw = localStorage.getItem(key);
    const prev = prevRaw ? JSON.parse(prevRaw) : [];
    const next = [
      {
        id: crypto.randomUUID(),
        event: sanitizeString(event, 80, "security_event"),
        detail: sanitizeString(detail ?? "", 500, ""),
        created_at: nowIso,
        user_agent: sanitizeString(ua(), 300, ""),
      },
      ...prev,
    ].slice(0, 40);
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore
  }

  if (!u || !u.emailVerified) return;
  const eventId = crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, "");
  const path = `users/${u.uid}/security_events/${eventId}`;
  try {
    await ensureCurrentUserProfileDoc(u);
    await setDoc(doc(db, "users", u.uid, "security_events", eventId), {
      user_id: u.uid,
      event: sanitizeString(event, 80, "security_event"),
      detail: sanitizeString(detail ?? "", 500, ""),
      user_agent: sanitizeString(ua(), 300, ""),
      createdAt: serverTimestamp(),
    }).catch((e) => handleFirestoreError(e, OperationType.CREATE, path));
  } catch {
    // Non-fatal audit logging
  }
}

export async function logAnon(_identifier: string, _event: "login_failed" | "password_reset_requested") {
  // Handled by Firebase Auth
}

export async function listMySecurityEvents() {
  const u = auth.currentUser;
  const uid = u?.uid || "super_admin_mahmudul";
  let localList: { id: string; event: string; detail?: string; created_at: string; user_agent: string | null }[] = [];
  try {
    const raw = localStorage.getItem(`${LOCAL_SECURITY_EVENTS_PREFIX}${uid}`);
    if (raw) localList = JSON.parse(raw);
  } catch {
    // ignore
  }

  if (!u || !u.emailVerified) return localList;
  const path = `users/${u.uid}/security_events`;
  try {
    const snap = await getDocs(
      query(collection(db, "users", u.uid, "security_events"), where("user_id", "==", u.uid))
    ).catch((e) => handleFirestoreError(e, OperationType.LIST, path));
    const list = snap.docs.map((d) => {
      const data = d.data();
      const createdAt =
        data.createdAt && typeof data.createdAt.toDate === "function"
          ? data.createdAt.toDate().toISOString()
          : new Date().toISOString();
      return {
        id: d.id,
        event: String(data.event ?? ""),
        detail: data.detail ? String(data.detail) : "",
        created_at: createdAt,
        user_agent: data.user_agent ? String(data.user_agent) : null,
      };
    });
    const combined = [...list, ...localList];
    const unique = combined.filter(
      (item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx
    );
    unique.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return unique.slice(0, 30);
  } catch {
    return localList;
  }
}

export function genBackupCodes(n = 8): string[] {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: n }, () => {
    const b = crypto.getRandomValues(new Uint8Array(10));
    const s = Array.from(b, (x) => chars[x % chars.length]).join("");
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
}

export async function getTotpFactor() {
  return null;
}

export async function verifyTotp(_code: string) {
  throw new Error("2FA এই একাউন্টে চালু নেই।");
}

export async function useBackupCode(_code: string) {
  throw new Error("ব্যাকআপ কোড যাচাই করা যায়নি।");
}

export function normalizeBdPhone(p: string) {
  const d = p.replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("880")) return `+${d}`;
  if (d.startsWith("0")) return `+88${d}`;
  return `+880${d}`;
}

export const EVENT_LABELS: Record<string, string> = {
  login_success: "সফল লগইন",
  login_failed: "ব্যর্থ লগইন চেষ্টা",
  password_changed: "পাসওয়ার্ড পরিবর্তন",
  pin_enabled: "সিকিউরিটি পিন (PIN) সেট করা হয়েছে",
  pin_removed: "সিকিউরিটি পিন সরানো হয়েছে",
  panel_locked: "এডমিন প্যানেল লক করা হয়েছে",
  panel_unlocked: "এডমিন প্যানেল আনলক করা হয়েছে",
  profile_photo_updated: "প্রোফাইল ফটো আপডেট",
  email_change_requested: "ইমেইল পরিবর্তনের অনুরোধ",
  email_changed: "ইমেইল পরিবর্তন",
  phone_change_requested: "ফোন পরিবর্তনের অনুরোধ",
  phone_changed: "ফোন পরিবর্তন",
  mfa_enabled: "2FA চালু",
  mfa_disabled: "2FA বন্ধ",
  backup_codes_regenerated: "ব্যাকআপ রিকভারি কোড তৈরি",
  backup_code_used: "ব্যাকআপ কোড ব্যবহার",
  password_reset_requested: "পাসওয়ার্ড রিসেট অনুরোধ",
  password_reset_completed: "পাসওয়ার্ড রিসেট সম্পন্ন",
  session_logout: "একটি সেশন লগআউট",
  logout_others: "অন্য সব ডিভাইস লগআউট",
};
