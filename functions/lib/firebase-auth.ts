/**
 * Cloudflare Workers-Compatible Firebase Authentication & Firestore RBAC Verifier
 *
 * Uses pure Web Standards (Web Crypto API + fetch) to cryptographically verify
 * RS256 Firebase ID tokens against Google's official JWKS endpoint and resolve
 * authoritative user roles/suspension status directly from Firestore REST API.
 *
 * Never trusts client-supplied role flags or custom headers.
 */

import type { StorageEnv } from "./r2-types";

const DEFAULT_PROJECT_ID = "smartnoakhali-f38e9";
const SUPER_ADMIN_EMAIL = "mdmahmudulhashan0@gmail.com";
const ORDINARY_ADMIN_EMAIL = "mr.bear444plus@gmail.com";
const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

interface JwkEntry {
  kid: string;
  kty: string;
  alg?: string;
  use?: string;
  n: string;
  e: string;
}

interface FirebaseJwtPayload {
  iss?: string;
  aud?: string;
  auth_time?: number;
  user_id?: string;
  sub?: string;
  iat?: number;
  exp?: number;
  email?: string;
  email_verified?: boolean;
  firebase?: {
    sign_in_provider?: string;
    identities?: Record<string, unknown>;
  };
}

export interface VerifiedFirebaseActor {
  uid: string;
  email: string;
  emailVerified: boolean;
  signInProvider: string;
  isAnonymous: boolean;
  isMainAdmin: boolean;
  isStaff: boolean;
  isSuspended: boolean;
  roles: string[];
  rawToken: string;
}

let cachedJwks: { keys: Map<string, JsonWebKey>; expiresAt: number } | null = null;

function base64UrlToUint8Array(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (input.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeBase64UrlJson<T>(segment: string): T {
  const bytes = base64UrlToUint8Array(segment);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as T;
}

async function fetchFirebaseJwks(): Promise<Map<string, JsonWebKey>> {
  const now = Date.now();
  if (cachedJwks && cachedJwks.expiresAt > now) {
    return cachedJwks.keys;
  }

  const res = await fetch(FIREBASE_JWKS_URL, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Firebase JWKS (HTTP ${res.status})`);
  }

  const cacheControl = res.headers.get("Cache-Control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Math.min(Number(maxAgeMatch[1]), 21600) : 3600;

  const data = (await res.json()) as { keys?: JwkEntry[] };
  const map = new Map<string, JsonWebKey>();
  for (const jwk of data.keys || []) {
    if (jwk.kid && jwk.kty === "RSA") {
      map.set(jwk.kid, jwk as unknown as JsonWebKey);
    }
  }
  cachedJwks = {
    keys: map,
    expiresAt: now + Math.max(300, maxAgeSec) * 1000,
  };
  return map;
}

export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

export function getFirebaseProjectId(env?: StorageEnv): string {
  return (
    env?.FIREBASE_PROJECT_ID ||
    env?.VITE_FIREBASE_PROJECT_ID ||
    DEFAULT_PROJECT_ID
  ).trim();
}

export async function verifyFirebaseIdToken(
  token: string,
  env?: StorageEnv
): Promise<FirebaseJwtPayload & { uid: string }> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid Firebase ID token format");
  }

  const [headerSeg, payloadSeg, sigSeg] = parts;
  const header = decodeBase64UrlJson<{ alg?: string; kid?: string; typ?: string }>(headerSeg);
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Unsupported Firebase token algorithm or missing kid");
  }

  let keys = await fetchFirebaseJwks();
  let jwk = keys.get(header.kid);
  if (!jwk) {
    // Force refresh once in case Google rotated keys
    cachedJwks = null;
    keys = await fetchFirebaseJwks();
    jwk = keys.get(header.kid);
  }
  if (!jwk) {
    throw new Error("Matching Firebase signing key not found");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signingInput = new TextEncoder().encode(`${headerSeg}.${payloadSeg}`);
  const signatureBytes = base64UrlToUint8Array(sigSeg);
  const sigBuf = signatureBytes.buffer.slice(
    signatureBytes.byteOffset,
    signatureBytes.byteOffset + signatureBytes.byteLength
  ) as ArrayBuffer;
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    sigBuf,
    signingInput
  );
  if (!valid) {
    throw new Error("Invalid Firebase ID token signature");
  }

  const payload = decodeBase64UrlJson<FirebaseJwtPayload>(payloadSeg);
  const projectId = getFirebaseProjectId(env);
  const nowSec = Math.floor(Date.now() / 1000);

  if (payload.aud !== projectId) {
    throw new Error("Firebase token audience mismatch");
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error("Firebase token issuer mismatch");
  }
  if (!payload.sub || typeof payload.sub !== "string" || payload.sub.length > 128) {
    throw new Error("Invalid Firebase token subject");
  }
  if (typeof payload.exp !== "number" || payload.exp <= nowSec) {
    throw new Error("Firebase ID token expired");
  }
  if (typeof payload.iat !== "number" || payload.iat > nowSec + 300) {
    throw new Error("Firebase ID token issued in the future");
  }
  if (typeof payload.auth_time === "number" && payload.auth_time > nowSec + 300) {
    throw new Error("Firebase token auth_time invalid");
  }

  return { ...payload, uid: payload.sub };
}

interface FirestoreFieldValue {
  stringValue?: string;
  booleanValue?: boolean;
  arrayValue?: { values?: FirestoreFieldValue[] };
}

interface FirestoreRestDoc {
  name?: string;
  fields?: Record<string, FirestoreFieldValue>;
}

async function fetchFirestoreDocAsCaller(
  projectId: string,
  collectionPath: string,
  docId: string,
  idToken: string
): Promise<FirestoreRestDoc | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents/${collectionPath}/${encodeURIComponent(docId)}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        Accept: "application/json",
      },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as FirestoreRestDoc;
  } catch {
    return null;
  }
}

export async function verifyAuthenticatedActor(
  request: Request,
  env?: StorageEnv
): Promise<VerifiedFirebaseActor> {
  const rawToken = extractBearerToken(request);
  if (!rawToken) {
    throw new Error("AUTH_REQUIRED");
  }

  const tokenPayload = await verifyFirebaseIdToken(rawToken, env);
  const projectId = getFirebaseProjectId(env);
  const email = String(tokenPayload.email || "").trim().toLowerCase();
  const emailVerified = Boolean(tokenPayload.email_verified);
  const signInProvider = String(tokenPayload.firebase?.sign_in_provider || "unknown");
  const isAnonymous = signInProvider === "anonymous";
  const trustedEmailOrPassword = emailVerified || signInProvider === "password";

  const isMainAdmin =
    email === SUPER_ADMIN_EMAIL.toLowerCase() && trustedEmailOrPassword;
  const isBootstrappedOrdinaryAdmin =
    email === ORDINARY_ADMIN_EMAIL.toLowerCase() && trustedEmailOrPassword;

  let isSuspended = false;
  let roles: string[] = [];
  let hasStaffRoleInUserDoc = false;
  let hasAdminDoc = false;

  if (!isAnonymous) {
    const [userDoc, adminDoc] = await Promise.all([
      fetchFirestoreDocAsCaller(projectId, "users", tokenPayload.uid, rawToken),
      fetchFirestoreDocAsCaller(projectId, "admins", tokenPayload.uid, rawToken),
    ]);

    if (userDoc?.fields) {
      isSuspended = userDoc.fields.suspended?.booleanValue === true;
      const roleValues = userDoc.fields.roles?.arrayValue?.values || [];
      roles = roleValues
        .map((v) => String(v.stringValue || "").trim().toLowerCase())
        .filter(Boolean);
      const customRoleId = String(userDoc.fields.custom_role_id?.stringValue || "").trim();
      hasStaffRoleInUserDoc =
        !isSuspended &&
        (roles.includes("admin") ||
          roles.includes("editor") ||
          roles.includes("moderator") ||
          customRoleId.length > 0);
    }

    hasAdminDoc = Boolean(adminDoc?.name) && !isSuspended;
  }

  const isStaff =
    isMainAdmin ||
    isBootstrappedOrdinaryAdmin ||
    (!isAnonymous && trustedEmailOrPassword && !isSuspended && (hasStaffRoleInUserDoc || hasAdminDoc));

  return {
    uid: tokenPayload.uid,
    email,
    emailVerified,
    signInProvider,
    isAnonymous,
    isMainAdmin,
    isStaff,
    isSuspended,
    roles,
    rawToken,
  };
}

/**
 * Verifies whether a user is a participant (customer or staff) of a Firestore chat thread.
 */
export async function verifyChatThreadParticipant(
  threadId: string,
  uid: string,
  idToken: string,
  env?: StorageEnv
): Promise<boolean> {
  if (!threadId || !uid) return false;
  if (threadId === uid) return true;
  const projectId = getFirebaseProjectId(env);
  const doc = await fetchFirestoreDocAsCaller(projectId, "chat_threads", threadId, idToken);
  if (!doc?.fields) return false;

  const userId = doc.fields.user_id?.stringValue || "";
  const customerUid = doc.fields.customer_uid?.stringValue || "";
  const assignedToUid = doc.fields.assigned_to_uid?.stringValue || "";
  const staffUids = (doc.fields.staff_uids?.arrayValue?.values || [])
    .map((v) => v.stringValue || "")
    .filter(Boolean);

  return (
    userId === uid ||
    customerUid === uid ||
    assignedToUid === uid ||
    staffUids.includes(uid)
  );
}
