# Security Specification — Smart Noakhali (`kalasharda-connect`)

## 1. Data Invariants

1. **Global Default Deny**: Any path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **Verified Identity for All Mutations**: Every document creation, update, or deletion requires an authenticated user with `request.auth.token.email_verified == true`.
3. **Path Variable Hardening**: Every single-document operation (`get`, `create`, `update`, `delete`) validates all path ID variables against `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, length `1..128`).
4. **PII Isolation (`/users/{userId}`)**: User profiles contain PII (`email`, `phone`, `full_name`) and are strictly readable only by `isOwner(userId)` or `isAdmin()`. Self-registration enforces `roles == ['user']` and `suspended == false` to prevent privilege escalation.
5. **Relational Sync & Master Gate (`/chat_threads/{threadId}/messages/{messageId}` & `/users/{userId}/security_events/{eventId}`)**: Subcollections verify parent existence and parent ownership via `get()` on `/chat_threads/$(threadId)` or `/users/$(userId)`.
6. **Global Consistency Invariant (`/donation_events/{eventId}`)**: Creating a blood donation event requires `exists(/databases/$(database)/documents/blood_donors/$(incoming().donor_id))` so orphaned donation logs cannot be created.
7. **Terminal State Locking**: Once a moderated document (`donations`, `submissions`, `blood_donors`, `donation_events`, `emergency_blood_requests`) transitions out of `'pending'` into `'approved'` or `'rejected'`, non-admin users cannot modify it; only `isAdmin()` can update or override terminal states.
8. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps must equal `request.time`, and `createdAt` / `author_id` / `uid` are immutable on update.
9. **Cost-Optimized Secure List Queries**: Every `allow list` rule evaluates `resource.data` (`existing()`) or `isBootstrappedAdmin()` without executing `get()` or `exists()` per document.

## 2. The "Dirty Dozen" Payloads

1. **Shadow Field Injection (`submissions`)**:
   ```json
   {
     "author_id": "user_1",
     "category_slug": "doctors",
     "title": "Dr. A",
     "body": "",
     "contact": "01700000000",
     "image_url": "",
     "address": "Maijdee",
     "designation": "MBBS",
     "status": "pending",
     "isVerified": true
   }
   ```
   *Rejected by*: `data.keys().hasOnly(...)` in `isValidSubmission`.

2. **Self-Assigned Admin Role (`users`)**:
   ```json
   {
     "uid": "user_1",
     "email": "user1@example.com",
     "full_name": "Attacker",
     "username": "attacker",
     "phone": "",
     "roles": ["admin"],
     "suspended": false,
     "must_change_password": false
   }
   ```
   *Rejected by*: `incoming().roles == ['user']` check on non-admin user creation.

3. **Identity Spoofing on Submission (`submissions`)**:
   ```json
   {
     "author_id": "victim_uid",
     "category_slug": "hospitals",
     "title": "Fake Entry",
     "body": "",
     "contact": "",
     "image_url": "",
     "address": "",
     "designation": "",
     "status": "pending"
   }
   ```
   *Rejected by*: `incoming().author_id == request.auth.uid`.

4. **Pre-Approved Submission Bypass (`submissions`)**:
   ```json
   {
     "author_id": "user_1",
     "category_slug": "hospitals",
     "title": "Auto Approved",
     "body": "",
     "contact": "",
     "image_url": "",
     "address": "",
     "designation": "",
     "status": "approved"
   }
   ```
   *Rejected by*: `incoming().status == 'pending'` requirement for non-admin creation.

5. **Unverified Admin Email Spoof (`admins` / `donations`)**:
   Auth token with `email: "mr.bear444plus@gmail.com"` and `email_verified: false`.
   *Rejected by*: `request.auth.token.email_verified == true` in `isBootstrappedAdmin()` and `isVerifiedUser()`.

6. **PII Lateral Read (`users/{otherUserId}`)**:
   Authenticated `user_1` attempting `get(/users/user_2)`.
   *Rejected by*: `isOwner(userId) || isAdmin()`.

7. **Orphaned Donation Event (`donation_events`)**:
   ```json
   {
     "author_id": "user_1",
     "donor_id": "non_existent_donor_999",
     "event_date": "2026-10-09",
     "place": "Noakhali",
     "form_image_url": "",
     "photo_url": "",
     "note": "",
     "status": "pending"
   }
   ```
   *Rejected by*: `exists(/databases/$(database)/documents/blood_donors/$(incoming().donor_id))`.

8. **Terminal State Mutation by Author (`donations`)**:
   Author attempting to update `amount` on a donation whose `existing().status == 'approved'`.
   *Rejected by*: `existing().status == 'pending'` terminal lock gate.

9. **Immortal Field Tampering (`blood_donors`)**:
   Update payload modifying `createdAt` or `author_id`.
   *Rejected by*: `incoming().createdAt == existing().createdAt && incoming().author_id == existing().author_id`.

10. **Client Timestamp Forgery (`emergency_blood_requests`)**:
    Create payload with past/future `createdAt != request.time`.
    *Rejected by*: `incoming().createdAt == request.time`.

11. **Cross-Thread Message Injection (`chat_threads/{threadId}/messages/{messageId}`)**:
    `user_2` attempting to post a message in `user_1`'s thread.
    *Rejected by*: Master Gate `get(/databases/$(database)/documents/chat_threads/$(threadId)).data.user_id == request.auth.uid`.

12. **Denial-of-Wallet Oversized String / ID Poisoning**:
    Document ID containing spaces/slashes or string field exceeding `maxLength`.
    *Rejected by*: `isValidId()` regex + strict `.size() <= maxLength` checks on every string property.
