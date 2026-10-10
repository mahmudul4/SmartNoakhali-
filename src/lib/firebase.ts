import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type User } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  getDocFromServer,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const envConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  firestoreDatabaseId:
    import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId,
};

const app = initializeApp(envConfig);
export const db = envConfig.firestoreDatabaseId
  ? getFirestore(app, envConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const SUPER_ADMIN_EMAIL = "mdmahmudulhashan0@gmail.com";
export const SUPER_ADMIN_PASSWORD = "MahMuduL0@#";
export const REGULAR_ADMIN_EMAIL = "mr.bear444plus@gmail.com";
export const BOOTSTRAPPED_ADMIN_EMAIL = REGULAR_ADMIN_EMAIL;

export const BOOTSTRAPPED_ADMIN_EMAILS = [
  SUPER_ADMIN_EMAIL.toLowerCase(),
  REGULAR_ADMIN_EMAIL.toLowerCase(),
];

/**
 * Returns true ONLY for the immutable Main Super Admin (mdmahmudulhashan0@gmail.com).
 * mr.bear444plus@gmail.com is a regular Admin, NOT Super Admin.
 */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

/**
 * Returns true if the email belongs to a bootstrapped admin/staff account
 * (either Super Admin mdmahmudulhashan0@gmail.com or Regular Admin mr.bear444plus@gmail.com)
 * for Firestore query compatibility.
 */
export function isBootstrappedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return BOOTSTRAPPED_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("the client is offline")
    ) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
void testConnection();

// Defensive payload helpers synced with firebase-blueprint.json
export function sanitizeString(val: unknown, maxLength: number, fallback = ""): string {
  if (typeof val !== "string") return fallback;
  return val.trim().slice(0, maxLength);
}

export function isValidIdFormat(id: string): boolean {
  return (
    typeof id === "string" &&
    id.length >= 1 &&
    id.length <= 128 &&
    /^[a-zA-Z0-9_-]+$/.test(id)
  );
}

const ensuringUserByUid = new Map<string, Promise<void>>();

/**
 * Ensures the parent `/users/{uid}` document exists in Firestore before
 * any subcollection write (such as `/users/{uid}/security_events/{eventId}`)
 * is executed, satisfying the Master Gate rule in `firestore.rules`.
 */
export async function ensureCurrentUserProfileDoc(
  u: User | null | undefined = auth.currentUser,
  extraMeta?: {
    full_name?: string;
    username?: string;
    phone?: string;
  }
): Promise<void> {
  if (!u || !u.uid || !u.emailVerified) return;

  const existingInFlight = ensuringUserByUid.get(u.uid);
  if (existingInFlight) {
    await existingInFlight;
    return;
  }

  const work = (async () => {
    const userRef = doc(db, "users", u.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const isSuper = isSuperAdminEmail(u.email);
      const isRegAdmin =
        u.email?.trim().toLowerCase() === REGULAR_ADMIN_EMAIL.toLowerCase();
      const emailStr = sanitizeString(
        u.email || "user@example.com",
        254,
        "user@example.com"
      );
      const defaultUsername = sanitizeString(
        (
          extraMeta?.username ||
          u.email?.split("@")[0] ||
          u.displayName ||
          "user"
        ).replace(/[^a-zA-Z0-9_-]/g, "_"),
        60,
        "user"
      );
      const defaultFullName = sanitizeString(
        extraMeta?.full_name || u.displayName || defaultUsername,
        120,
        defaultUsername
      );
      const initialRoles = isSuper
        ? ["admin", "moderator", "editor", "user"]
        : isRegAdmin
        ? ["admin", "user"]
        : ["user"];

      await setDoc(userRef, {
        uid: u.uid,
        email: emailStr,
        full_name: defaultFullName,
        username: isSuper ? "mahmudul" : defaultUsername,
        phone: sanitizeString(extraMeta?.phone || u.phoneNumber || "", 30, ""),
        roles: initialRoles,
        suspended: false,
        must_change_password: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (isSuper) {
        const adminRef = doc(db, "admins", u.uid);
        const adminSnap = await getDoc(adminRef);
        if (!adminSnap.exists()) {
          await setDoc(adminRef, {
            uid: u.uid,
            email: emailStr,
            createdAt: serverTimestamp(),
          });
        }
      }
    }
  })();

  ensuringUserByUid.set(u.uid, work);
  try {
    await work;
  } finally {
    ensuringUserByUid.delete(u.uid);
  }
}

