/**
 * Firestore Security Rules Test Specification (Dirty Dozen Verification)
 * Verifies that all 12 adversarial payloads are rejected with PERMISSION_DENIED.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  operation: "get" | "list" | "create" | "update" | "delete";
  expected: "PERMISSION_DENIED";
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  { id: 1, name: "Shadow field injection on submissions", collection: "submissions", operation: "create", expected: "PERMISSION_DENIED" },
  { id: 2, name: "Self-assigned admin role on user profile creation", collection: "users", operation: "create", expected: "PERMISSION_DENIED" },
  { id: 3, name: "Identity spoofing author_id on submission", collection: "submissions", operation: "create", expected: "PERMISSION_DENIED" },
  { id: 4, name: "Pre-approved status bypass by non-admin", collection: "submissions", operation: "create", expected: "PERMISSION_DENIED" },
  { id: 5, name: "Unverified admin email spoof attack", collection: "donations", operation: "update", expected: "PERMISSION_DENIED" },
  { id: 6, name: "PII lateral read of another user profile", collection: "users", operation: "get", expected: "PERMISSION_DENIED" },
  { id: 7, name: "Orphaned donation event referencing missing donor", collection: "donation_events", operation: "create", expected: "PERMISSION_DENIED" },
  { id: 8, name: "Terminal state mutation on approved donation", collection: "donations", operation: "update", expected: "PERMISSION_DENIED" },
  { id: 9, name: "Immortal field tampering on blood_donors", collection: "blood_donors", operation: "update", expected: "PERMISSION_DENIED" },
  { id: 10, name: "Client timestamp forgery on emergency_blood_requests", collection: "emergency_blood_requests", operation: "create", expected: "PERMISSION_DENIED" },
  { id: 11, name: "Cross-thread message injection in chat_threads subcollection", collection: "chat_threads/t1/messages", operation: "create", expected: "PERMISSION_DENIED" },
  { id: 12, name: "Oversized string / ID poisoning attack", collection: "blood_donors", operation: "create", expected: "PERMISSION_DENIED" },
];
