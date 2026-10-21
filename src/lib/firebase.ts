import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type User } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  enableNetwork,
  disableNetwork,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  getDocFromServer,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
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

const isNamedCustomDb =
  Boolean(envConfig.firestoreDatabaseId) &&
  envConfig.firestoreDatabaseId !== "(default)" &&
  !envConfig.firestoreDatabaseId.startsWith("ai-studio-abc-");

const app = initializeApp(envConfig);

function initFirestoreInstance() {
  const customDbId = isNamedCustomDb ? envConfig.firestoreDatabaseId : undefined;
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      customDbId
    );
  } catch (err) {
    console.warn("Falling back to standard Firestore instance:", err);
    return customDbId ? getFirestore(app, customDbId) : getFirestore(app);
  }
}

export const db = initFirestoreInstance();
export { enableNetwork, disableNetwork };
export const auth = getAuth(app);
export const storage = getStorage(app);
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
 * Ordinary admins receive only Editor permissions.
 */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

/**
 * Returns true if the email belongs to a recognized staff/editor account.
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

export function isFirestoreQuotaError(error: unknown): boolean {
  if (!error) return false;
  const code = (error as { code?: string })?.code;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    code === "resource-exhausted" ||
    msg.toLowerCase().includes("quota") ||
    msg.toLowerCase().includes("resource-exhausted")
  );
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errStr = error instanceof Error ? error.message : String(error);
  const isQuota = isFirestoreQuotaError(error);
  const errInfo: FirestoreErrorInfo = {
    error: errStr,
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
  if (isQuota) {
    console.warn(`[Firestore Quota] Quota exceeded on ${operationType} ${path || ""}: ${errStr}`);
  } else {
    console.error("Firestore Error: ", JSON.stringify(errInfo));
  }
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    // Browser is offline; persistentLocalCache provides offline access without error
    return;
  }
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (isFirestoreQuotaError(error)) {
      console.warn("Firestore daily quota limit reached; running in cached mode.");
      return;
    }
    if (
      error instanceof Error &&
      error.message.includes("the client is offline")
    ) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return;
      }
      // Allow browser WebChannel connection to complete handshake and retry once
      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await getDocFromServer(doc(db, "test", "connection"));
      } catch (retryError) {
        if (
          retryError instanceof Error &&
          retryError.message.includes("the client is offline")
        ) {
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            return;
          }
          console.error("Please check your Firebase configuration.");
        }
      }
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
  if (!u || !u.uid) return;

  const existingInFlight = ensuringUserByUid.get(u.uid);
  if (existingInFlight) {
    await existingInFlight;
    return;
  }

  const work = (async () => {
    try {
      const userRef = doc(db, "users", u.uid);
      const snap = await getDoc(userRef);
      const isSuper = isSuperAdminEmail(u.email);
      const isRegAdmin =
        u.email?.trim().toLowerCase() === REGULAR_ADMIN_EMAIL.toLowerCase();

      if (!snap.exists()) {
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
          ? ["editor", "user"]
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
      } else {
        // If user exists and is authorized super admin, ensure admin roles are present
        if (isSuper) {
          const data = snap.data();
          const currentRoles: string[] = Array.isArray(data?.roles) ? data.roles : [];
          const requiredRoles = ["admin", "moderator", "editor", "user"];
          const needsUpdate = requiredRoles.some((r) => !currentRoles.includes(r));
          if (needsUpdate) {
            await setDoc(
              userRef,
              {
                roles: Array.from(new Set([...currentRoles, ...requiredRoles])),
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          }
          const adminRef = doc(db, "admins", u.uid);
          const adminSnap = await getDoc(adminRef);
          if (!adminSnap.exists()) {
            await setDoc(adminRef, {
              uid: u.uid,
              email: sanitizeString(u.email || "admin@example.com", 254),
              createdAt: serverTimestamp(),
            });
          }
        }
      }
    } catch (err) {
      if (isFirestoreQuotaError(err)) {
        console.warn("[Auth] Firestore daily quota reached during profile sync; skipping background write.");
      } else {
        console.warn("[Auth] Profile sync error:", err);
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

