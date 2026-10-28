/**
 * Authoritative role mapping and normalization for Live Chat and Staff interfaces.
 * Adheres strictly to the required Bangla display labels:
 * - Super Admin: "সুপার অ্যাডমিন"
 * - Admin: "অ্যাডমিন"
 * - Editor: "এডিটর"
 * - Moderator: "মডারেটর"
 * - Customer: "গ্রাহক"
 */

export type StaffRoleType = "super_admin" | "admin" | "editor" | "moderator";

export function getChatRoleDisplayLabel(
  roleOrLabel?: string | null,
  isSuperAdmin = false
): string {
  if (isSuperAdmin) return "সুপার অ্যাডমিন";
  const clean = (roleOrLabel || "").trim().toLowerCase();
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
    clean.includes("এডমিন") ||
    clean.includes("অ্যাডমিন")
  ) {
    return "অ্যাডমিন";
  }
  if (clean === "editor" || clean === "এডিটর" || clean.includes("এডিটর")) {
    return "এডিটর";
  }
  if (
    clean === "moderator" ||
    clean === "মোডারেটর" ||
    clean === "মডারেটর" ||
    clean.includes("মোডারেটর") ||
    clean.includes("মডারেটর")
  ) {
    return "মডারেটর";
  }
  return "অ্যাডমিন";
}

export function resolveStaffMessageRole(m: {
  sender_role?: string;
  sender_role_label?: string;
  sender_id?: string;
  sender_name?: string;
}): string {
  if (m.sender_role !== "staff") return "";
  const idLow = (m.sender_id || "").toLowerCase();
  const labelLow = (m.sender_role_label || "").toLowerCase();
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

  // Admin detection (prevent Admin from being shown as Editor)
  if (
    labelLow.includes("অ্যাডমিন") ||
    labelLow.includes("এডমিন") ||
    labelLow === "admin" ||
    nameLow.includes("admin") ||
    nameLow.includes("অ্যাডমিন") ||
    nameLow.includes("এডমিন")
  ) {
    return "অ্যাডমিন";
  }

  // Editor detection
  if (labelLow.includes("এডিটর") || labelLow === "editor" || nameLow.includes("এডিটর")) {
    return "এডিটর";
  }

  // Moderator detection
  if (
    labelLow.includes("মডারেটর") ||
    labelLow.includes("মোডারেটর") ||
    labelLow === "moderator" ||
    nameLow.includes("মডারেটর") ||
    nameLow.includes("মোডারেটর")
  ) {
    return "মডারেটর";
  }

  return "অ্যাডমিন";
}
