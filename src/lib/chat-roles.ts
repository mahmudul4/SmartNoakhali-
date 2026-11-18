/**
 * Authoritative role mapping and normalization for Live Chat and Admin/Operator interfaces.
 * Adheres strictly to required display labels:
 * - Super Admin: "সুপার অ্যাডমিন"
 * - Admin: "অ্যাডমিন"
 * - Editor: "এডিটর"
 * - Moderator: "মোডারেটর"
 * - Custom Role: exact custom role name (e.g., "লাইভ চ্যাট অপারেটর")
 * - Customer: "গ্রাহক"
 * Never displays generic "Staff Member" / "স্টাফ মেম্বার".
 */

export type StaffRoleType = "super_admin" | "admin" | "editor" | "moderator" | "custom";

export function getChatRoleDisplayLabel(
  roleOrLabel?: string | null,
  isSuperAdmin = false
): string {
  if (isSuperAdmin) return "সুপার অ্যাডমিন";
  const raw = (roleOrLabel || "").trim();
  const clean = raw.toLowerCase();
  if (
    clean === "super_admin" ||
    clean === "superadmin" ||
    clean === "সুপার এডমিন" ||
    clean === "সুপার অ্যাডমিন" ||
    clean.includes("সুপার")
  ) {
    return "সুপার অ্যাডমিন";
  }
  if (
    clean === "admin" ||
    clean === "এডমিন" ||
    clean === "অ্যাডমিন" ||
    clean === "শুধু এডমিন" ||
    clean === "জেনারেল অ্যাডমিন"
  ) {
    return "অ্যাডমিন";
  }
  if (clean === "editor" || clean === "এডিটর") {
    return "এডিটর";
  }
  if (clean === "moderator" || clean === "মোডারেটর" || clean === "মডারেটর") {
    return "মোডারেটর";
  }
  // Never emit generic "Staff" / "Staff Member" / "স্টাফ"
  if (
    !raw ||
    clean === "staff" ||
    clean === "staff member" ||
    clean === "staff_member" ||
    clean === "স্টাফ" ||
    clean === "স্টাফ সদস্য" ||
    clean === "স্টাফ মেম্বার"
  ) {
    return "সাপোর্ট অ্যাডমিন";
  }
  // Preserve custom role names verbatim (e.g., "লাইভ চ্যাট অপারেটর")
  return raw;
}

export function resolveStaffMessageRole(m: {
  sender_role?: string;
  sender_role_label?: string;
  sender_id?: string;
  sender_name?: string;
}): string {
  if (m.sender_role !== "staff") return "";
  const idLow = (m.sender_id || "").toLowerCase();
  const rawLabel = (m.sender_role_label || "").trim();
  const labelLow = rawLabel.toLowerCase();
  const nameLow = (m.sender_name || "").toLowerCase();

  // Super Admin detection
  if (
    idLow === "super_admin_mahmudul" ||
    idLow.includes("mahmudul") ||
    labelLow.includes("সুপার") ||
    nameLow.includes("সুপার")
  ) {
    return "সুপার অ্যাডমিন";
  }

  // Exact system role labels
  if (
    labelLow === "admin" ||
    labelLow === "অ্যাডমিন" ||
    labelLow === "এডমিন" ||
    labelLow.includes("অ্যাডমিন") ||
    labelLow.includes("এডমিন")
  ) {
    return "অ্যাডমিন";
  }

  if (labelLow === "editor" || labelLow === "এডিটর" || labelLow.includes("এডিটর")) {
    return "এডিটর";
  }

  if (
    labelLow === "moderator" ||
    labelLow === "মোডারেটর" ||
    labelLow === "মডারেটর" ||
    labelLow.includes("মোডারেটর") ||
    labelLow.includes("মডারেটর")
  ) {
    return "মোডারেটর";
  }

  // Custom role label (if provided and not generic "staff"/"স্টাফ")
  if (
    rawLabel &&
    labelLow !== "staff" &&
    labelLow !== "staff member" &&
    labelLow !== "স্টাফ" &&
    labelLow !== "স্টাফ সদস্য" &&
    labelLow !== "স্টাফ মেম্বার"
  ) {
    return rawLabel;
  }

  if (nameLow.includes("এডিটর")) return "এডিটর";
  if (nameLow.includes("মডারেটর") || nameLow.includes("মোডারেটর")) return "মোডারেটর";

  return "অ্যাডমিন";
}
