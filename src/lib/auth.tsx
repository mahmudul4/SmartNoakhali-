import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import {
  auth,
  db,
  SUPER_ADMIN_EMAIL,
  REGULAR_ADMIN_EMAIL,
  isSuperAdminEmail,
  isBootstrappedAdminEmail,
  OperationType,
  handleFirestoreError,
  isFirestoreQuotaError,
  sanitizeString,
  ensureCurrentUserProfileDoc,
} from "@/lib/firebase";
import { recordUserCredential, syncVaultFromCloud } from "@/lib/admin-client";
import { logEvent } from "@/lib/security";

export type Role = "admin" | "moderator" | "editor" | "user";

export interface AppUser {
  id: string;
  uid: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  verifiedVia?: "email" | "phone" | "google";
}

interface VerifiedSessionData {
  user: AppUser;
  roles: Role[];
  username: string | null;
}

interface AuthCtx {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  session: { user: AppUser } | null;
  roles: Role[];
  loading: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  isEditor: boolean;
  isStaff: boolean;
  isMainAdmin: boolean;
  username: string | null;
  isAuthed: boolean;
  isFirebaseVerifiedAdmin: boolean;
  isFirebaseVerifiedSuperAdmin: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: (
    loginHintEmail?: string,
    options?: { requireStaff?: boolean; requireSuperAdmin?: boolean }
  ) => Promise<AppUser>;
  signInSuperAdmin: (emailOrUsername: string, password: string) => Promise<boolean>;
  signInUserOrStaff: (
    identifier: string,
    password: string
  ) => Promise<{ user: AppUser; roles: Role[]; isStaff: boolean }>;
  completeVerifiedSignup: (params: {
    fullName: string;
    username: string;
    email: string;
    phone: string;
    password: string;
    verifiedVia: "email" | "phone";
  }) => Promise<AppUser>;
  startRealEmailVerification: (params: {
    fullName: string;
    username: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<{ email: string; alreadyVerified: boolean }>;
  checkAndCompleteRealEmailVerification: (params: {
    fullName: string;
    username: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<{ verified: boolean; user?: AppUser }>;
  resendRealEmailVerification: () => Promise<void>;
  updateProfileInfo: (params: {
    displayName?: string;
    photoURL?: string;
    phone?: string;
    username?: string;
  }) => Promise<AppUser>;
  syncGoogleProfileDetails: () => Promise<{
    displayName: string | null;
    photoURL: string | null;
    email: string | null;
  }>;
}

const Ctx = createContext<AuthCtx | null>(null);
const SUPER_ADMIN_SESSION_KEY = "sn_super_admin_session_v1";
const VERIFIED_USER_SESSION_KEY = "sn_verified_user_session_v1";

function toEnglishDigits(str: string): string {
  const map: Record<string, string> = {
    "০": "0",
    "১": "1",
    "২": "2",
    "৩": "3",
    "৪": "4",
    "৫": "5",
    "৬": "6",
    "৭": "7",
    "৮": "8",
    "৯": "9",
  };
  return (str || "").replace(/[০-৯]/g, (d) => map[d] || d);
}

function toAppUser(u: FirebaseUser): AppUser {
  return {
    id: u.uid,
    uid: u.uid,
    email: u.email,
    phone: u.phoneNumber,
    displayName: u.displayName,
    photoURL: u.photoURL,
    emailVerified: u.emailVerified,
  };
}

const FALLBACK_SUPER_ADMIN_USER: AppUser = {
  id: "super_admin_mahmudul",
  uid: "super_admin_mahmudul",
  email: SUPER_ADMIN_EMAIL,
  phone: "01850999178",
  displayName: "Super Admin (Mahmudul)",
  photoURL: null,
  emailVerified: true,
};

function readVerifiedSession(): VerifiedSessionData | null {
  try {
    let raw = sessionStorage.getItem(VERIFIED_USER_SESSION_KEY);
    if (!raw) {
      raw = localStorage.getItem(VERIFIED_USER_SESSION_KEY);
    }
    if (raw) {
      const parsed = JSON.parse(raw) as VerifiedSessionData;
      if (parsed && parsed.user && parsed.user.uid) return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function writeVerifiedSession(data: VerifiedSessionData | null) {
  try {
    if (!data) {
      sessionStorage.removeItem(VERIFIED_USER_SESSION_KEY);
      localStorage.removeItem(VERIFIED_USER_SESSION_KEY);
    } else {
      const str = JSON.stringify(data);
      sessionStorage.setItem(VERIFIED_USER_SESSION_KEY, str);
      localStorage.setItem(VERIFIED_USER_SESSION_KEY, str);
    }
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [localSuperAdmin, setLocalSuperAdmin] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SUPER_ADMIN_SESSION_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [verifiedSession, setVerifiedSession] = useState<VerifiedSessionData | null>(() =>
    readVerifiedSession()
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (!fbUser) {
        // If Firebase Auth is restoring or session was stored, keep verified session active
        const currentVerified = readVerifiedSession();
        if (currentVerified && currentVerified.user) {
          setUser(currentVerified.user);
          setRoles(currentVerified.roles || []);
          setUsername(currentVerified.username || null);
          setLoading(false);
          return;
        }

        setFirebaseUser(null);
        setUser(null);
        setRoles([]);
        setUsername(null);
        setLoading(false);
        return;
      }

      if (!isSuperAdminEmail(fbUser.email)) {
        try {
          sessionStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
          localStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
        } catch {
          // ignore
        }
        setLocalSuperAdmin(false);
      }

      const isSuper = isSuperAdminEmail(fbUser.email);
      const isRegularBootstrappedAdmin =
        fbUser.email?.trim().toLowerCase() === REGULAR_ADMIN_EMAIL.toLowerCase();

      // Check if this user has roles assigned by Super Admin in the Vault or cached verified session
      const vault = await syncVaultFromCloud();
      const emailLower = (fbUser.email || "").trim().toLowerCase();
      const vaultEntry = vault[fbUser.uid] || (emailLower ? vault[emailLower] : undefined);
      const vaultRoles: Role[] = Array.isArray(vaultEntry?.roles)
        ? (vaultEntry.roles as Role[])
        : [];

      const currentVerified = readVerifiedSession();
      const sessionRoles: Role[] = Array.isArray(currentVerified?.roles)
        ? (currentVerified.roles as Role[])
        : [];

      const appU = toAppUser(fbUser);
      setFirebaseUser(fbUser);
      setUser(appU);

      // Listen to /users/{uid} document in Firestore for live roles & profile data
      const userPath = `users/${fbUser.uid}`;
      const userRef = doc(db, "users", fbUser.uid);

      try {
        await ensureCurrentUserProfileDoc(fbUser, {
          full_name: vaultEntry?.full_name,
          username: vaultEntry?.username,
          phone: vaultEntry?.phone,
        });
      } catch (err) {
        console.warn("Profile init check:", err);
      }

      unsubProfile = onSnapshot(
        userRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const docRoles: Role[] = Array.isArray(data.roles)
              ? (data.roles as Role[])
              : ["user"];
            const effectiveRoles: Role[] = isSuper
              ? (Array.from(new Set([...docRoles, "admin", "moderator", "editor", "user"])) as Role[])
              : isRegularBootstrappedAdmin
              ? (Array.from(new Set([...docRoles, ...vaultRoles, ...sessionRoles, "editor"])) as Role[])
              : (Array.from(new Set([...docRoles, ...vaultRoles, ...sessionRoles])) as Role[]);
            setRoles(effectiveRoles);
            const resolvedUsername =
              typeof data.username === "string"
                ? data.username
                : vaultEntry?.username || currentVerified?.username || null;
            setUsername(resolvedUsername);

            writeVerifiedSession({
              user: appU,
              roles: effectiveRoles,
              username: resolvedUsername,
            });
          } else {
            const effectiveRoles: Role[] = isSuper
              ? ["admin", "moderator", "editor", "user"]
              : isRegularBootstrappedAdmin
              ? (Array.from(new Set([...vaultRoles, ...sessionRoles, "editor", "user"])) as Role[])
              : vaultRoles.length > 0 || sessionRoles.length > 0
              ? (Array.from(new Set([...vaultRoles, ...sessionRoles, "user"])) as Role[])
              : ["user"];
            setRoles(effectiveRoles);
            const resolvedUsername =
              isSuper
                ? "mahmudul"
                : vaultEntry?.username ?? currentVerified?.username ?? fbUser.displayName ?? null;
            setUsername(resolvedUsername);

            writeVerifiedSession({
              user: appU,
              roles: effectiveRoles,
              username: resolvedUsername,
            });
          }
          setLoading(false);
        },
        (error) => {
          if (!isFirestoreQuotaError(error)) {
            try {
              handleFirestoreError(error, OperationType.GET, userPath);
            } catch {
              // ignore
            }
          } else {
            console.warn("[Auth] Firestore quota exceeded while listening to user profile; using cached roles.");
          }
          const effectiveRoles: Role[] = isSuper
            ? ["admin", "moderator", "editor", "user"]
            : isRegularBootstrappedAdmin
            ? (Array.from(new Set([...vaultRoles, ...sessionRoles, "editor", "user"])) as Role[])
            : vaultRoles.length > 0 || sessionRoles.length > 0
            ? (Array.from(new Set([...vaultRoles, ...sessionRoles, "user"])) as Role[])
            : ["user"];
          setRoles(effectiveRoles);
          setLoading(false);
        }
      );
    });

    return () => {
      if (unsubProfile) unsubProfile();
      unsubAuth();
    };
  }, []);

  async function signInWithGoogle(
    loginHintEmail?: string,
    options?: { requireStaff?: boolean; requireSuperAdmin?: boolean }
  ): Promise<AppUser> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: "select_account",
      ...(loginHintEmail ? { login_hint: loginHintEmail } : {}),
    });

    try {
      const result = await signInWithPopup(auth, provider);
      const fbUser = result.user;
      const email = fbUser.email || "";

      if (options?.requireSuperAdmin && !isSuperAdminEmail(email)) {
        await firebaseSignOut(auth);
        throw new Error("অননুমোদিত অ্যাকাউন্ট। শুধুমাত্র প্রধান সুপার এডমিনের প্রবেশাধিকার রয়েছে।");
      }

      // Check if this Google user has roles pre-assigned by Super Admin in Vault
      const vault = await syncVaultFromCloud();
      const emailLower = email.trim().toLowerCase();
      const vaultEntry = vault[fbUser.uid] || (emailLower ? vault[emailLower] : undefined);
      const isSuper = isSuperAdminEmail(email);
      const isRegAdmin = emailLower === REGULAR_ADMIN_EMAIL.toLowerCase();

      // STRICT SECURITY RULE: Regular Google Sign-In defaults strictly to ["user"].
      // Google Sign-In CANNOT grant or escalate to admin/moderator/editor unless explicitly in vault
      const resolvedRoles: Role[] = isSuper
        ? ["admin", "moderator", "editor", "user"]
        : isRegAdmin
        ? ["editor", "user"]
        : vaultEntry?.roles?.length
        ? (Array.from(new Set([...vaultEntry.roles, "user"])) as Role[])
        : ["user"];

      if (options?.requireStaff && !isSuper && !isRegAdmin && !resolvedRoles.includes("editor") && !resolvedRoles.includes("moderator")) {
        await firebaseSignOut(auth);
        throw new Error("শুধুমাত্র অনুমোদিত স্টাফ মেম্বারদের জন্য প্রবেশাধিকার রয়েছে।");
      }

      const cleanDisplayName = fbUser.displayName || email.split("@")[0] || "User";
      const cleanUsername = sanitizeString(
        vaultEntry?.username || email.split("@")[0] || "user",
        60,
        "user"
      );

      // Ensure profile doc exists in Firestore (/users/{uid})
      try {
        await ensureCurrentUserProfileDoc(fbUser, {
          full_name: cleanDisplayName,
          username: cleanUsername,
          phone: fbUser.phoneNumber || undefined,
        });
      } catch (err) {
        console.warn("Google user profile doc notice:", err);
      }

      // Record credentials in vault and session
      await recordUserCredential({
        uid: fbUser.uid,
        email,
        full_name: cleanDisplayName,
        username: cleanUsername,
        phone: fbUser.phoneNumber || undefined,
        photo_url: fbUser.photoURL || undefined,
        roles: resolvedRoles,
        verified_via: "google",
      }).catch(() => {});

      const appU: AppUser = {
        id: fbUser.uid,
        uid: fbUser.uid,
        email: fbUser.email,
        phone: fbUser.phoneNumber || null,
        displayName: cleanDisplayName,
        photoURL: fbUser.photoURL || null,
        emailVerified: true,
        verifiedVia: "google",
      };

      const sess: VerifiedSessionData = {
        user: appU,
        roles: resolvedRoles,
        username: cleanUsername,
      };
      writeVerifiedSession(sess);
      setVerifiedSession(sess);
      setFirebaseUser(fbUser);
      setUser(appU);
      setRoles(resolvedRoles);
      setUsername(cleanUsername);

      await logEvent("google_login_success", email).catch(() => {});
      return appU;
    } catch (err: any) {
      const code = String(err?.code || "");
      console.warn("Google sign-in notice:", err);

      if (code === "auth/popup-closed-by-user") {
        throw new Error("Google সাইন-ইন উইন্ডো বন্ধ করা হয়েছে। আবার চেষ্টা করুন।");
      }
      if (code === "auth/popup-blocked") {
        throw new Error("আপনার ব্রাউজারে পপআপ ব্লক করা হয়েছে। অনুগ্রহ করে পপআপ অনুমোদন করুন।");
      }
      if (code === "auth/unauthorized-domain") {
        throw new Error("Firebase কনসোলে এই ডোমেইনটি অনুমোদিত নয়। অনুগ্রহ করে Authorized Domains চেক করুন।");
      }
      if (code === "auth/account-exists-with-different-credential") {
        throw new Error("এই ইমেইলটি দিয়ে পূর্বে অন্য পদ্ধতিতে অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে পাসওয়ার্ড দিয়ে লগইন করুন।");
      }
      if (code === "auth/network-request-failed") {
        throw new Error("নেটওয়ার্ক সমস্যার কারণে Google লগইন সম্ভব হয়নি। আপনার ইন্টারনেট সংযোগ পরীক্ষা করুন।");
      }

      throw new Error(err?.message || "Google দিয়ে লগইন ব্যর্থ হয়েছে।");
    }
  }

  async function signInSuperAdmin(emailOrUsername: string, password: string): Promise<boolean> {
    const cleanInput = emailOrUsername.trim().toLowerCase();
    const isSuperIdentity =
      cleanInput === SUPER_ADMIN_EMAIL.toLowerCase() ||
      cleanInput === "mahmudul" ||
      cleanInput === "mahmud" ||
      cleanInput === "mdmahmudulhashan0";

    if (!isSuperIdentity) {
      throw new Error(
        "এই লগইন রুটটি শুধুমাত্র মেইন এডমিনের জন্য সংরক্ষিত। সঠিক মেইন এডমিন ইমেইল ব্যবহার করুন।"
      );
    }

    if (!password || password.trim().length === 0) {
      throw new Error("অনুগ্রহ করে আপনার মেইন এডমিন পাসওয়ার্ড লিখুন।");
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, SUPER_ADMIN_EMAIL, password);
      if (!isSuperAdminEmail(cred.user.email)) {
        await firebaseSignOut(auth);
        throw new Error("অননুমোদিত অ্যাকাউন্ট। শুধুমাত্র প্রধান সুপার এডমিনের প্রবেশাধিকার রয়েছে।");
      }

      writeVerifiedSession(null);
      setVerifiedSession(null);

      try {
        sessionStorage.setItem(SUPER_ADMIN_SESSION_KEY, "true");
      } catch {
        // ignore
      }
      setLocalSuperAdmin(true);

      try {
        await ensureCurrentUserProfileDoc(cred.user, {
          full_name: "মেইন সুপার এডমিন",
          username: "mahmudul",
        });
      } catch {
        // ignore
      }

      await logEvent("admin_login_success", SUPER_ADMIN_EMAIL).catch(() => {});
      return true;
    } catch (err: any) {
      const code = String(err?.code || "");
      if (
        code === "auth/user-not-found" ||
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password"
      ) {
        throw new Error(
          "ভুল ইমেইল বা পাসওয়ার্ড। Firebase Authentication এ মেইন এডমিন পাসওয়ার্ড সঠিক কিনা নিশ্চিত করুন।"
        );
      }
      if (code === "auth/user-disabled") {
        throw new Error("মেইন এডমিন অ্যাকাউন্টটি Firebase এ নিষ্ক্রিয় (Disabled) করা হয়েছে।");
      }
      if (code === "auth/too-many-requests") {
        throw new Error("অনেকবার ভুল চেষ্টা করা হয়েছে। কিছুক্ষণ পর পুনরায় চেষ্টা করুন।");
      }
      throw new Error(err?.message || "মেইন এডমিন লগইন ব্যর্থ হয়েছে।");
    }
  }

  async function signInUserOrStaff(
    identifier: string,
    password: string
  ): Promise<{ user: AppUser; roles: Role[]; isStaff: boolean }> {
    const cleanId = identifier.trim();
    const lowerId = cleanId.toLowerCase();

    // Super Admin MUST NOT log in via regular user login (/auth)
    if (
      lowerId === SUPER_ADMIN_EMAIL.toLowerCase() ||
      lowerId === "mahmudul" ||
      lowerId === "mahmud" ||
      lowerId === "mdmahmudulhashan0"
    ) {
      throw new Error(
        "সুপার এডমিন সাধারণ ইউজার লগইন দিয়ে প্রবেশ করতে পারবেন না। শুধুমাত্র এডমিন প্যানেল (/mdmahmudulhashan) দিয়ে লগইন করুন।"
      );
    }

    // Clear any super admin flag
    try {
      sessionStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
    } catch {
      // ignore
    }
    setLocalSuperAdmin(false);

    // 1. Check server / vault lookup (supports Email OR Phone Number OR Username + Staff accounts)
    let lookupUser: {
      uid: string;
      email: string;
      phone: string;
      full_name: string;
      username: string;
      roles: Role[];
      photo_url?: string;
    } | null = null;
    let passwordMatchedOnServer = false;

    try {
      const resp = await fetch("/api/auth/login-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: cleanId, password }),
      });
      const data = await resp.json();
      if (!resp.ok && data?.error) {
        throw new Error(data.error);
      }
      if (data?.found && data?.user) {
        lookupUser = data.user;
        passwordMatchedOnServer = Boolean(data.passwordMatches);
      }
    } catch (err: any) {
      if (err?.message?.includes("স্থগিত")) throw err;
    }

    // Also check local/cloud vault if not found on server yet
    if (!lookupUser) {
      const vault = await syncVaultFromCloud();
      const digits = toEnglishDigits(cleanId).replace(/\D/g, "");
      const normPhone =
        digits.startsWith("8801") && digits.length === 13 ? digits.slice(2) : digits;

      const vMatch = Object.values(vault).find(
        (v) =>
          (v.email && v.email.toLowerCase() === lowerId) ||
          (normPhone &&
            normPhone.length >= 10 &&
            (v.phone || "").replace(/\D/g, "").endsWith(normPhone)) ||
          (v.username && v.username.toLowerCase() === lowerId)
      );

      if (vMatch) {
        const isRegAdmin = vMatch.email.toLowerCase() === REGULAR_ADMIN_EMAIL.toLowerCase();
        lookupUser = {
          uid: vMatch.uid || vMatch.email,
          email: vMatch.email,
          phone: vMatch.phone || "",
          full_name: vMatch.full_name || vMatch.email.split("@")[0],
          username: vMatch.username || vMatch.email.split("@")[0],
          roles: (vMatch.roles as Role[]) || (isRegAdmin ? ["admin", "user"] : ["user"]),
          photo_url: vMatch.photo_url,
        };
        if (vMatch.password && vMatch.password === password) {
          passwordMatchedOnServer = true;
        }
      }
    }

    const targetEmail =
      lookupUser?.email ||
      (cleanId.includes("@")
        ? cleanId
        : `${cleanId.replace(/\D/g, "")}@phone.smartnoakhali.app`);

    if (isSuperAdminEmail(targetEmail)) {
      throw new Error(
        "সুপার এডমিন সাধারণ ইউজার লগইন দিয়ে প্রবেশ করতে পারবেন না। শুধুমাত্র এডমিন প্যানেল (/mdmahmudulhashan) দিয়ে লগইন করুন।"
      );
    }

    // 2. Try Firebase Email/Password sign-in if available
    try {
      const cred = await signInWithEmailAndPassword(auth, targetEmail, password);
      const isRegAdmin = targetEmail.toLowerCase() === REGULAR_ADMIN_EMAIL.toLowerCase();
      const resolvedRoles: Role[] = isRegAdmin
        ? ["editor", "user"]
        : lookupUser?.roles?.length
        ? (Array.from(new Set([...lookupUser.roles, "user"])) as Role[])
        : ["user"];

      const appU: AppUser = {
        id: cred.user.uid,
        uid: cred.user.uid,
        email: cred.user.email || targetEmail,
        phone: lookupUser?.phone || cred.user.phoneNumber || null,
        displayName: lookupUser?.full_name || cred.user.displayName || targetEmail.split("@")[0],
        photoURL: lookupUser?.photo_url || cred.user.photoURL || null,
        emailVerified: true,
      };

      const sess: VerifiedSessionData = {
        user: appU,
        roles: resolvedRoles,
        username: lookupUser?.username || targetEmail.split("@")[0],
      };
      writeVerifiedSession(sess);
      setVerifiedSession(sess);

      await recordUserCredential({
        uid: appU.uid,
        email: targetEmail,
        password,
        full_name: appU.displayName || undefined,
        phone: appU.phone || undefined,
        roles: resolvedRoles,
      });

      const staffFlag =
        resolvedRoles.includes("admin") ||
        resolvedRoles.includes("editor") ||
        resolvedRoles.includes("moderator");

      return { user: appU, roles: resolvedRoles, isStaff: staffFlag };
    } catch (fbErr: any) {
      // If password matched in our verified store / Super Admin vault, authenticate session seamlessly
      if (lookupUser && passwordMatchedOnServer) {
        const isRegAdmin = lookupUser.email.toLowerCase() === REGULAR_ADMIN_EMAIL.toLowerCase();
        const resolvedRoles: Role[] = isRegAdmin
          ? ["admin", "user"]
          : lookupUser.roles?.length
          ? (Array.from(new Set([...lookupUser.roles, "user"])) as Role[])
          : ["user"];

        const appU: AppUser = {
          id: lookupUser.uid,
          uid: lookupUser.uid,
          email: lookupUser.email,
          phone: lookupUser.phone || null,
          displayName: lookupUser.full_name || lookupUser.email.split("@")[0],
          photoURL: lookupUser.photo_url || null,
          emailVerified: true,
        };

        const sess: VerifiedSessionData = {
          user: appU,
          roles: resolvedRoles,
          username: lookupUser.username || lookupUser.email.split("@")[0],
        };
        writeVerifiedSession(sess);
        setVerifiedSession(sess);

        const staffFlag =
          resolvedRoles.includes("admin") ||
          resolvedRoles.includes("editor") ||
          resolvedRoles.includes("moderator");

        return { user: appU, roles: resolvedRoles, isStaff: staffFlag };
      }

      throw fbErr;
    }
  }

  async function completeVerifiedSignup(params: {
    fullName: string;
    username: string;
    email: string;
    phone: string;
    password: string;
    verifiedVia: "email" | "phone";
  }): Promise<AppUser> {
    const cleanEmail = params.email.trim().toLowerCase();
    const digits = toEnglishDigits(params.phone).replace(/\D/g, "");
    const cleanPhone =
      digits.startsWith("8801") && digits.length === 13 ? digits.slice(2) : digits;

    const effectiveEmail =
      cleanEmail || `${cleanPhone}@phone.smartnoakhali.app`;

    if (isSuperAdminEmail(effectiveEmail)) {
      throw new Error("এই ইমেইলটি সংরক্ষিত।");
    }

    const cleanUname = sanitizeString(
      params.username || cleanEmail.split("@")[0] || cleanPhone || "user",
      60,
      "user"
    );
    const cleanFullName = sanitizeString(params.fullName || cleanUname, 120, cleanUname);

    let uid = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Attempt Firebase Auth creation (or sign-in if already created) so client is authenticated for Firestore sync
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        effectiveEmail,
        params.password
      );
      uid = cred.user.uid;
      await updateProfile(cred.user, { displayName: cleanFullName }).catch(() => {});
    } catch (createErr: any) {
      const errCode = String(createErr?.code || createErr?.message || "");
      if (errCode.includes("auth/email-already-in-use")) {
        try {
          const existingCred = await signInWithEmailAndPassword(
            auth,
            effectiveEmail,
            params.password
          );
          uid = existingCred.user.uid;
        } catch {
          // Keep generated uid for verified session
        }
      }
    }

    await recordUserCredential({
      uid,
      email: effectiveEmail,
      password: params.password,
      full_name: cleanFullName,
      username: cleanUname,
      phone: cleanPhone,
      roles: ["user"],
      verified_via: params.verifiedVia,
    });

    const appU: AppUser = {
      id: uid,
      uid,
      email: effectiveEmail,
      phone: cleanPhone || null,
      displayName: cleanFullName,
      photoURL: null,
      emailVerified: true,
      verifiedVia: params.verifiedVia,
    };

    const sess: VerifiedSessionData = {
      user: appU,
      roles: ["user"],
      username: cleanUname,
    };
    writeVerifiedSession(sess);
    setVerifiedSession(sess);

    return appU;
  }

  async function startRealEmailVerification(params: {
    fullName: string;
    username: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<{ email: string; alreadyVerified: boolean }> {
    const cleanEmail = params.email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error("ভেরিফিকেশনের জন্য সঠিক ইমেইল ঠিকানা দিন");
    }
    if (isSuperAdminEmail(cleanEmail)) {
      throw new Error("এই ইমেইলটি সংরক্ষিত।");
    }

    const cleanFullName = sanitizeString(
      params.fullName || cleanEmail.split("@")[0],
      120,
      "user"
    );

    let fbUser: FirebaseUser;
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
      fbUser = cred.user;
      await updateProfile(fbUser, { displayName: cleanFullName }).catch(() => {});
    } catch (err: any) {
      const code = String(err?.code || err?.message || "");
      if (code.includes("auth/email-already-in-use")) {
        try {
          const existingCred = await signInWithEmailAndPassword(
            auth,
            cleanEmail,
            params.password
          );
          fbUser = existingCred.user;
          await fbUser.reload().catch(() => {});
          if (fbUser.emailVerified) {
            return { email: cleanEmail, alreadyVerified: true };
          }
          await updateProfile(fbUser, { displayName: cleanFullName }).catch(() => {});
        } catch {
          throw new Error(
            "এই ইমেইলটি দিয়ে ইতিমধ্যেই অ্যাকাউন্ট খোলা হয়েছে। অনুগ্রহ করে লগইন করুন অথবা পাসওয়ার্ড রিসেট করুন।"
          );
        }
      } else {
        throw err;
      }
    }

    await sendEmailVerification(fbUser);
    return { email: cleanEmail, alreadyVerified: false };
  }

  async function resendRealEmailVerification(): Promise<void> {
    const current = auth.currentUser;
    if (!current) {
      throw new Error("ভেরিফিকেশন সেশন পাওয়া যায়নি। আবার চেষ্টা করুন।");
    }
    await current.reload().catch(() => {});
    if (current.emailVerified) return;
    await sendEmailVerification(current);
  }

  async function checkAndCompleteRealEmailVerification(params: {
    fullName: string;
    username: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<{ verified: boolean; user?: AppUser }> {
    const cleanEmail = params.email.trim().toLowerCase();
    let current = auth.currentUser;
    if (!current || (current.email || "").toLowerCase() !== cleanEmail) {
      try {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, params.password);
        current = cred.user;
      } catch {
        return { verified: false };
      }
    }

    await current.reload();
    if (!current.emailVerified) {
      return { verified: false };
    }

    // Refresh token so Firestore security rules immediately see request.auth.token.email_verified == true
    await current.getIdToken(true).catch(() => {});

    const digits = toEnglishDigits(params.phone).replace(/\D/g, "");
    const cleanPhone =
      digits.startsWith("8801") && digits.length === 13 ? digits.slice(2) : digits;
    const cleanUname = sanitizeString(
      params.username || cleanEmail.split("@")[0] || "user",
      60,
      "user"
    );
    const cleanFullName = sanitizeString(params.fullName || cleanUname, 120, cleanUname);

    await ensureCurrentUserProfileDoc(current, {
      full_name: cleanFullName,
      username: cleanUname,
      phone: cleanPhone,
    }).catch(() => {});

    await recordUserCredential({
      uid: current.uid,
      email: cleanEmail,
      password: params.password,
      full_name: cleanFullName,
      username: cleanUname,
      phone: cleanPhone,
      roles: ["user"],
      verified_via: "email",
    });

    const appU: AppUser = {
      id: current.uid,
      uid: current.uid,
      email: cleanEmail,
      phone: cleanPhone || null,
      displayName: cleanFullName,
      photoURL: current.photoURL || null,
      emailVerified: true,
      verifiedVia: "email",
    };

    const sess: VerifiedSessionData = {
      user: appU,
      roles: ["user"],
      username: cleanUname,
    };
    writeVerifiedSession(sess);
    setVerifiedSession(sess);
    setFirebaseUser(current);
    setUser(appU);
    setRoles(["user"]);
    setUsername(cleanUname);

    return { verified: true, user: appU };
  }

  async function updateProfileInfo(params: {
    displayName?: string;
    photoURL?: string;
    phone?: string;
    username?: string;
  }): Promise<AppUser> {
    const current = auth.currentUser;
    const targetUid = current?.uid || user?.uid || "user";
    const cleanDisplayName =
      params.displayName !== undefined
        ? sanitizeString(params.displayName, 120, "")
        : (user?.displayName || "");
    const cleanPhotoUrl =
      params.photoURL !== undefined
        ? sanitizeString(params.photoURL, 500, "")
        : (user?.photoURL || "");
    const cleanPhone =
      params.phone !== undefined
        ? sanitizeString(params.phone, 30, "")
        : (user?.phone || "");
    const cleanUsername =
      params.username !== undefined
        ? sanitizeString(params.username, 60, "")
        : (username || "");

    if (current) {
      await updateProfile(current, {
        displayName: cleanDisplayName || undefined,
        photoURL: cleanPhotoUrl || undefined,
      }).catch(() => {});
    }

    if (current?.uid) {
      try {
        await ensureCurrentUserProfileDoc(current);
        const userRef = doc(db, "users", current.uid);
        await setDoc(
          userRef,
          {
            full_name: cleanDisplayName,
            username: cleanUsername,
            phone: cleanPhone,
            photo_url: cleanPhotoUrl,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn("Firestore user profile update:", err);
      }
    }

    await recordUserCredential({
      uid: targetUid,
      email: current?.email || user?.email || "",
      full_name: cleanDisplayName,
      username: cleanUsername,
      phone: cleanPhone,
      photo_url: cleanPhotoUrl,
    }).catch(() => {});

    const updatedAppUser: AppUser = {
      ...(user || {
        id: targetUid,
        uid: targetUid,
        email: current?.email || null,
        phone: cleanPhone || null,
        displayName: cleanDisplayName,
        photoURL: cleanPhotoUrl || null,
        emailVerified: Boolean(current?.emailVerified),
      }),
      displayName: cleanDisplayName,
      photoURL: cleanPhotoUrl || null,
      phone: cleanPhone || null,
    };

    setUser(updatedAppUser);
    if (cleanUsername) setUsername(cleanUsername);

    if (verifiedSession) {
      const nextSess: VerifiedSessionData = {
        ...verifiedSession,
        user: updatedAppUser,
        username: cleanUsername || verifiedSession.username,
      };
      writeVerifiedSession(nextSess);
      setVerifiedSession(nextSess);
    }

    await logEvent("profile_updated", `Name: ${cleanDisplayName}`);

    return updatedAppUser;
  }

  async function syncGoogleProfileDetails(): Promise<{
    displayName: string | null;
    photoURL: string | null;
    email: string | null;
  }> {
    throw new Error("Google সিঙ্ক ফিচারটি নিষ্ক্রিয় করা হয়েছে।");
  }

  // Strictly enforce that ONLY mdmahmudulhashan0@gmail.com can ever be isMainAdmin (Super Admin)
  const isSignedInAsNonSuper = Boolean(
    (firebaseUser && !isSuperAdminEmail(firebaseUser.email)) ||
      (verifiedSession && !isSuperAdminEmail(verifiedSession.user.email))
  );
  const isBootstrappedMain =
    !isSignedInAsNonSuper && (isSuperAdminEmail(firebaseUser?.email) || localSuperAdmin);

  const isFirebaseVerifiedSuperAdmin = Boolean(
    firebaseUser?.emailVerified && isSuperAdminEmail(firebaseUser?.email)
  );
  const isFirebaseVerifiedAdmin = Boolean(
    firebaseUser?.emailVerified && isBootstrappedAdminEmail(firebaseUser?.email)
  );

  const effectiveUser =
    user ??
    verifiedSession?.user ??
    (isBootstrappedMain ? FALLBACK_SUPER_ADMIN_USER : null);

  const baseRoles: Role[] =
    roles.length > 0 ? roles : verifiedSession?.roles ?? [];

  const effectiveRoles: Role[] = isBootstrappedMain
    ? (Array.from(new Set([...baseRoles, "admin", "moderator", "editor", "user"])) as Role[])
    : baseRoles;

  const isMainAdmin = isBootstrappedMain;
  const isAdmin = isBootstrappedMain || effectiveRoles.includes("admin");
  const isEditor =
    isBootstrappedMain ||
    effectiveRoles.includes("editor") ||
    effectiveRoles.includes("admin");
  const isModerator = isBootstrappedMain || effectiveRoles.includes("moderator");
  const isStaff = isBootstrappedMain || isAdmin || isEditor || isModerator;

  const value: AuthCtx = {
    user: effectiveUser,
    firebaseUser,
    session: effectiveUser ? { user: effectiveUser } : null,
    roles: effectiveRoles,
    loading,
    isAdmin,
    isModerator,
    isEditor,
    isStaff,
    isMainAdmin,
    username:
      username ??
      verifiedSession?.username ??
      (isBootstrappedMain ? "mahmudul" : null),
    isAuthed: !!effectiveUser,
    isFirebaseVerifiedAdmin,
    isFirebaseVerifiedSuperAdmin,
    signOut: async () => {
      try {
        sessionStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
        localStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
      } catch {
        // ignore
      }
      writeVerifiedSession(null);
      setVerifiedSession(null);
      setLocalSuperAdmin(false);
      setFirebaseUser(null);
      setUser(null);
      setRoles([]);
      setUsername(null);
      try {
        await firebaseSignOut(auth);
      } catch {
        // ignore
      }
    },
    signInWithGoogle,
    signInSuperAdmin,
    signInUserOrStaff,
    completeVerifiedSignup,
    startRealEmailVerification,
    checkAndCompleteRealEmailVerification,
    resendRealEmailVerification,
    updateProfileInfo,
    syncGoogleProfileDetails,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}