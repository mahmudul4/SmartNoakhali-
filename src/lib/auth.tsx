import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
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
  googleProvider,
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD,
  REGULAR_ADMIN_EMAIL,
  isSuperAdminEmail,
  isBootstrappedAdminEmail,
  OperationType,
  handleFirestoreError,
  sanitizeString,
  ensureCurrentUserProfileDoc,
} from "@/lib/firebase";
import { recordUserCredential, syncVaultFromCloud } from "@/lib/admin-client";

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
    options?: { disallowSuperAdmin?: boolean; requireSuperAdmin?: boolean }
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
    const raw = sessionStorage.getItem(VERIFIED_USER_SESSION_KEY);
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
    } else {
      sessionStorage.setItem(VERIFIED_USER_SESSION_KEY, JSON.stringify(data));
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
        } catch {
          // ignore
        }
        setLocalSuperAdmin(false);
      }

      const isSuper = isSuperAdminEmail(fbUser.email);
      const isRegularBootstrappedAdmin =
        fbUser.email?.trim().toLowerCase() === REGULAR_ADMIN_EMAIL.toLowerCase();

      // Check if this user has roles assigned by Super Admin in the Vault
      const vault = await syncVaultFromCloud();
      const emailLower = (fbUser.email || "").trim().toLowerCase();
      const vaultEntry = vault[fbUser.uid] || (emailLower ? vault[emailLower] : undefined);
      const vaultRoles: Role[] = Array.isArray(vaultEntry?.roles)
        ? (vaultEntry.roles as Role[])
        : [];

      const appU = toAppUser(fbUser);
      setFirebaseUser(fbUser);
      setUser(appU);

      // Only query/write Firestore /users/{uid} when Firebase token has email_verified == true
      if (!fbUser.emailVerified) {
        setRoles(
          isSuper
            ? ["admin", "moderator", "editor", "user"]
            : isRegularBootstrappedAdmin
            ? ["admin", "user"]
            : vaultRoles.length > 0
            ? (Array.from(new Set([...vaultRoles, "user"])) as Role[])
            : ["user"]
        );
        setUsername(isSuper ? "mahmudul" : vaultEntry?.username ?? fbUser.displayName ?? null);
        setLoading(false);
        return;
      }

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
              ? (Array.from(new Set([...docRoles, ...vaultRoles, "admin"])) as Role[])
              : (Array.from(new Set([...docRoles, ...vaultRoles])) as Role[]);
            setRoles(effectiveRoles);
            setUsername(typeof data.username === "string" ? data.username : vaultEntry?.username || null);
          } else {
            setRoles(
              isSuper
                ? ["admin", "moderator", "editor", "user"]
                : isRegularBootstrappedAdmin
                ? ["admin", "user"]
                : vaultRoles.length > 0
                ? (Array.from(new Set([...vaultRoles, "user"])) as Role[])
                : ["user"]
            );
            setUsername(isSuper ? "mahmudul" : vaultEntry?.username ?? fbUser.displayName ?? null);
          }
          setLoading(false);
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.GET, userPath);
          } catch {
            setRoles(
              isSuper
                ? ["admin", "moderator", "editor", "user"]
                : isRegularBootstrappedAdmin
                ? ["admin", "user"]
                : vaultRoles.length > 0
                ? (Array.from(new Set([...vaultRoles, "user"])) as Role[])
                : ["user"]
            );
            setLoading(false);
          }
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
    options?: { disallowSuperAdmin?: boolean; requireSuperAdmin?: boolean }
  ): Promise<AppUser> {
    if (loginHintEmail) {
      googleProvider.setCustomParameters({ login_hint: loginHintEmail });
    } else {
      googleProvider.setCustomParameters({ prompt: "select_account" });
    }
    const cred = await signInWithPopup(auth, googleProvider);
    const isSuper = isSuperAdminEmail(cred.user.email);

    if (options?.disallowSuperAdmin && isSuper) {
      await firebaseSignOut(auth);
      throw new Error(
        "সুপার এডমিন সাধারণ ইউজার লগইন দিয়ে প্রবেশ করতে পারবেন না। শুধুমাত্র এডমিন প্যানেল (/mdmahmudulhashan) দিয়ে লগইন করুন।"
      );
    }

    if (options?.requireSuperAdmin && !isSuper) {
      await firebaseSignOut(auth);
      throw new Error(
        "এডমিন প্যানেল দিয়ে শুধুমাত্র সুপার এডমিন লগইন করতে পারবেন! সাধারণ এডমিন, এডিটর ও মোডারেটরগণ সাধারণ ইউজার লগইন (/auth) দিয়ে প্রবেশ করুন।"
      );
    }

    if (isSuper) {
      try {
        sessionStorage.setItem(SUPER_ADMIN_SESSION_KEY, "true");
      } catch {
        // ignore
      }
      setLocalSuperAdmin(true);
    } else {
      try {
        sessionStorage.removeItem(SUPER_ADMIN_SESSION_KEY);
      } catch {
        // ignore
      }
      setLocalSuperAdmin(false);
    }
    try {
      await ensureCurrentUserProfileDoc(cred.user);
    } catch {
      // ignore
    }
    return toAppUser(cred.user);
  }

  async function signInSuperAdmin(emailOrUsername: string, password: string): Promise<boolean> {
    const cleanInput = emailOrUsername.trim().toLowerCase();
    const isSuperIdentity =
      cleanInput === SUPER_ADMIN_EMAIL.toLowerCase() ||
      cleanInput === "mahmudul" ||
      cleanInput === "mahmud" ||
      cleanInput === "mdmahmudulhashan0";

    if (!isSuperIdentity) {
      return false;
    }

    let isPasswordValid = password === SUPER_ADMIN_PASSWORD;
    if (!isPasswordValid) {
      try {
        const resp = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: SUPER_ADMIN_EMAIL, password }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data?.ok) isPasswordValid = true;
        }
      } catch {
        // ignore
      }
    }

    if (!isPasswordValid) {
      return false;
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
      await signInWithEmailAndPassword(auth, SUPER_ADMIN_EMAIL, password);
    } catch (err: any) {
      let signedInFb = false;
      for (const fallbackPwd of [SUPER_ADMIN_PASSWORD, "MahMuduL0@#", "MahMuduL0"]) {
        if (fallbackPwd === password) continue;
        try {
          await signInWithEmailAndPassword(auth, SUPER_ADMIN_EMAIL, fallbackPwd);
          signedInFb = true;
          break;
        } catch {
          // continue
        }
      }
      const code = String(err?.code || err?.message || "");
      if (
        !signedInFb &&
        (code.includes("auth/user-not-found") || code.includes("auth/invalid-credential"))
      ) {
        try {
          const cred = await createUserWithEmailAndPassword(
            auth,
            SUPER_ADMIN_EMAIL,
            SUPER_ADMIN_PASSWORD
          );
          if (!cred.user.emailVerified) {
            await sendEmailVerification(cred.user).catch(() => {});
          }
        } catch {
          // localSuperAdmin remains active
        }
      }
    }

    return true;
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
        ? ["admin", "user"]
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

    // Attempt Firebase Auth creation if Email/Password provider is enabled
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        effectiveEmail,
        params.password
      );
      uid = cred.user.uid;
      await updateProfile(cred.user, { displayName: cleanFullName }).catch(() => {});
    } catch {
      // Fallback to verified session if Firebase Email/Password provider is disabled
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

  const isAdmin = isBootstrappedMain || effectiveRoles.includes("admin");
  const isModerator = isAdmin || effectiveRoles.includes("moderator");
  const isEditor = isAdmin || effectiveRoles.includes("editor");
  const isStaff = isBootstrappedMain || isAdmin || isEditor || isModerator;
  const isMainAdmin = isBootstrappedMain;

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
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}