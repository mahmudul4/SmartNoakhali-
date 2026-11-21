import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, isSuperAdminEmail } from "@/lib/firebase";
import { upsertSettingDoc } from "@/lib/store";
import { useAuth, type Role } from "@/lib/auth";

export type PermissionKey =
  | "view_homepage"
  | "edit_homepage"
  | "manage_hero_banners"
  | "upload_banner_images"
  | "edit_banner_colors"
  | "publish_banners"
  | "view_dashboard"
  | "manage_categories"
  | "create_edit_content"
  | "publish_content"
  | "moderate_submissions"
  | "review_approve_submissions"
  | "view_users"
  | "manage_users"
  | "suspend_users"
  | "manage_approved_admins"
  | "view_notifications"
  | "send_notifications"
  | "delete_notifications"
  | "chat_view_assigned"
  | "chat_view_all"
  | "chat_reply"
  | "chat_assign"
  | "chat_transfer"
  | "chat_close_reopen"
  | "chat_view_history"
  | "chat_manage_availability"
  | "view_ai_settings"
  | "edit_ai_config"
  | "manage_ai_knowledge"
  | "view_reports"
  | "manage_settings"
  | "upload_branding"
  | "manage_roles_permissions";

export type PermissionCategory =
  | "homepage"
  | "dashboard"
  | "content"
  | "moderation"
  | "users"
  | "notifications"
  | "chat"
  | "ai"
  | "settings"
  | "security";

export interface PermissionDefinition {
  key: PermissionKey;
  labelBn: string;
  labelEn: string;
  description: string;
  category: PermissionCategory;
  defaultRoles: ("admin" | "editor" | "moderator")[];
  mainAdminOnly?: boolean;
}

export interface CustomRoleDefinition {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  color: string;
  permissions: PermissionKey[];
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RolePermissionsStoragePayload {
  admin: PermissionKey[];
  editor: PermissionKey[];
  moderator: PermissionKey[];
  user: PermissionKey[];
  customRoles: CustomRoleDefinition[];
  updatedAt?: string;
}

export const MAIN_ADMIN_ONLY_PERMISSIONS: PermissionKey[] = [
  "manage_roles_permissions",
  "manage_users",
  "suspend_users",
  "manage_approved_admins",
  "manage_settings",
  "upload_branding",
];

const MAIN_ADMIN_ONLY_SET = new Set<PermissionKey>(MAIN_ADMIN_ONLY_PERMISSIONS);

export const PERMISSION_CATEGORY_LABELS: Record<PermissionCategory, string> = {
  homepage: "হোমপেজ ও হিরো ব্যানার",
  dashboard: "ড্যাশবোর্ড অ্যাক্সেস",
  content: "ক্যাটাগরি ও কন্টেন্ট",
  moderation: "মডারেশন ও অনুমোদন",
  users: "ইউজার ও অ্যাডমিন অ্যাকাউন্ট",
  notifications: "নোটিফিকেশন ও অ্যালার্ট",
  chat: "লাইভ চ্যাট ও অপারেটর ইনবক্স",
  ai: "এআই চ্যাট ও নলেজ বেস",
  settings: "সাইট সেটিংস ও ব্র্যান্ডিং",
  security: "রিপোর্ট, অডিট ও নিরাপত্তা",
};

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  {
    key: "view_dashboard",
    labelBn: "ড্যাশবোর্ড দর্শন",
    labelEn: "View Dashboard",
    description: "এডমিন প্যানেলে প্রবেশ এবং সাধারণ পরিসংখ্যান ও নোটিশ দেখা।",
    category: "dashboard",
    defaultRoles: ["admin", "editor", "moderator"],
  },
  {
    key: "view_homepage",
    labelBn: "হোমপেজ ম্যানেজার দর্শন",
    labelEn: "View Homepage Controls",
    description: "হোমপেজ সেকশন, কুইক অ্যাকশন ও শর্টকাট কনফিগারেশন দেখা।",
    category: "homepage",
    defaultRoles: ["admin", "editor"],
  },
  {
    key: "edit_homepage",
    labelBn: "হোমপেজ কন্টেন্ট সম্পাদনা",
    labelEn: "Edit Homepage Content",
    description: "হোমপেজ কুইক অ্যাকশন, ঘোষণা ও ওয়েবসাইট কন্টেন্ট পরিবর্তন।",
    category: "homepage",
    defaultRoles: ["admin"],
  },
  {
    key: "manage_hero_banners",
    labelBn: "হিরো ব্যানার ম্যানেজার",
    labelEn: "Manage Hero Banners",
    description: "হোমপেজের হিরো ব্যানার তৈরি, এডিট, ডুপ্লিকেট ও বিন্যাস নিয়ন্ত্রণ।",
    category: "homepage",
    defaultRoles: ["admin"],
  },
  {
    key: "upload_banner_images",
    labelBn: "ব্যানার ছবি আপলোড",
    labelEn: "Upload Banner Images",
    description: "ডেক্সটপ ও মোবাইল ব্যানারের ব্যাকগ্রাউন্ড ছবি Firebase Storage-এ আপলোড।",
    category: "homepage",
    defaultRoles: ["admin"],
  },
  {
    key: "edit_banner_colors",
    labelBn: "ব্যানার ও বাটন রঙ নিয়ন্ত্রণ",
    labelEn: "Edit Banner Colors",
    description: "শিরোনাম, বিবরণ, ব্যাজ ও বাটনের কাস্টম কালার পরিবর্তন।",
    category: "homepage",
    defaultRoles: ["admin"],
  },
  {
    key: "publish_banners",
    labelBn: "ব্যানার প্রকাশ ও সময়সূচি",
    labelEn: "Publish & Schedule Banners",
    description: "ব্যানার লাইভ প্রকাশ, ড্রাফট ও সিডিউল সময় নির্ধারণ।",
    category: "homepage",
    defaultRoles: ["admin"],
  },
  {
    key: "manage_categories",
    labelBn: "ক্যাটাগরি পরিচালনা",
    labelEn: "Manage Categories",
    description: "ওয়েবসাইটের সকল ক্যাটাগরি তৈরি, সম্পাদনা, পুনর্বিন্যাস ও দৃশ্যমানতা নিয়ন্ত্রণ।",
    category: "content",
    defaultRoles: ["admin", "editor"],
  },
  {
    key: "create_edit_content",
    labelBn: "কন্টেন্ট তৈরি ও সম্পাদনা",
    labelEn: "Create & Edit Content",
    description: "ডিরেক্টরি তথ্য, রক্তদাতা, হাসপাতাল ও অন্যান্য সেবা তালিকা তৈরি ও এডিট করা।",
    category: "content",
    defaultRoles: ["admin", "editor"],
  },
  {
    key: "publish_content",
    labelBn: "কন্টেন্ট প্রকাশ ও অপ্রকাশ",
    labelEn: "Publish or Unpublish Content",
    description: "পাবলিক ওয়েবসাইটে কন্টেন্ট লাইভ প্রকাশ বা সাময়িকভাবে হাইড করা।",
    category: "content",
    defaultRoles: ["admin", "editor"],
  },
  {
    key: "moderate_submissions",
    labelBn: "সাবমিশন মডারেশন",
    labelEn: "Moderate User Submissions",
    description: "নাগরিকদের পাঠানো নতুন তথ্য ও জরুরি রক্তের আবেদন যাচাই-বাছাই করা।",
    category: "moderation",
    defaultRoles: ["admin", "editor", "moderator"],
  },
  {
    key: "review_approve_submissions",
    labelBn: "সাবমিশন অনুমোদন ও বাতিল",
    labelEn: "Review & Approve Submissions",
    description: "পেন্ডিং সাবমিশন অনুমোদন বা বাতিল করে মূল ওয়েবসাইটে যুক্ত করা।",
    category: "moderation",
    defaultRoles: ["admin", "editor", "moderator"],
  },
  {
    key: "view_users",
    labelBn: "ইউজার তালিকা দর্শন",
    labelEn: "View Users List",
    description: "নিবন্ধিত ইউজার ও অপারেটরদের সাধারণ তালিকা দেখা।",
    category: "users",
    defaultRoles: ["admin"],
  },
  {
    key: "manage_users",
    labelBn: "ইউজার অ্যাকাউন্ট তৈরি ও পরিচালনা",
    labelEn: "Manage User Accounts",
    description: "নতুন ইউজার তৈরি, পাসওয়ার্ড রিসেট ও মুছে ফেলা (শুধুমাত্র সুপার অ্যাডমিন)।",
    category: "users",
    defaultRoles: [],
    mainAdminOnly: true,
  },
  {
    key: "suspend_users",
    labelBn: "ইউজার স্থগিত ও সক্রিয়",
    labelEn: "Suspend or Activate Users",
    description: "অ্যাকাউন্ট সাময়িক স্থগিত বা সক্রিয় করা (শুধুমাত্র সুপার অ্যাডমিন)।",
    category: "users",
    defaultRoles: [],
    mainAdminOnly: true,
  },
  {
    key: "manage_approved_admins",
    labelBn: "অনুমোদিত অ্যাডমিন নিয়োগ",
    labelEn: "Assign Admin Privileges",
    description: "অ্যাডমিন/কাস্টম রোল প্রদান ও প্রত্যাহার (শুধুমাত্র সুপার অ্যাডমিন)।",
    category: "users",
    defaultRoles: [],
    mainAdminOnly: true,
  },
  {
    key: "view_notifications",
    labelBn: "নোটিফিকেশন তালিকা দর্শন",
    labelEn: "View Admin Notifications",
    description: "পাঠানো নোটিফিকেশন ও ডেলিভারি স্ট্যাটাস দেখা।",
    category: "notifications",
    defaultRoles: ["admin", "editor", "moderator"],
  },
  {
    key: "send_notifications",
    labelBn: "নোটিফিকেশন ও অ্যালার্ট পাঠানো",
    labelEn: "Send Notifications & Alerts",
    description: "ব্যবহারকারী ও নাগরিকদের জন্য নোটিফিকেশন পাঠানো।",
    category: "notifications",
    defaultRoles: ["admin"],
  },
  {
    key: "delete_notifications",
    labelBn: "নোটিফিকেশন মুছে ফেলা",
    labelEn: "Delete Notifications",
    description: "পুরনো নোটিফিকেশন রেকর্ড মুছে ফেলা।",
    category: "notifications",
    defaultRoles: [],
  },
  {
    key: "chat_view_assigned",
    labelBn: "নির্ধারিত লাইভ চ্যাট দেখা",
    labelEn: "View Assigned Live Chats",
    description: "নিজের নির্ধারিত অথবা আনঅ্যাসাইনড গ্রাহক চ্যাট থ্রেড দেখা।",
    category: "chat",
    defaultRoles: ["admin", "editor", "moderator"],
  },
  {
    key: "chat_view_all",
    labelBn: "সকল লাইভ চ্যাট দেখা",
    labelEn: "View All Live Chats",
    description: "সিস্টেমের সকল গ্রাহক লাইভ চ্যাট ইনবক্স দেখা ও অনুসন্ধান।",
    category: "chat",
    defaultRoles: ["admin", "editor", "moderator"],
  },
  {
    key: "chat_reply",
    labelBn: "লাইভ চ্যাটে উত্তর দেওয়া",
    labelEn: "Reply in Live Chat",
    description: "গ্রাহকদের মেসেজ ও ফাইলের সরাসরি উত্তর পাঠানো।",
    category: "chat",
    defaultRoles: ["admin", "editor", "moderator"],
  },
  {
    key: "chat_assign",
    labelBn: "চ্যাট অপারেটর অ্যাসাইন",
    labelEn: "Assign Chat Operators",
    description: "চ্যাট থ্রেড নির্দিষ্ট অ্যাডমিন বা অপারেটরের নামে অ্যাসাইন করা।",
    category: "chat",
    defaultRoles: ["admin"],
  },
  {
    key: "chat_transfer",
    labelBn: "চ্যাট ট্রান্সফার করা",
    labelEn: "Transfer Live Chat",
    description: "এক অপারেটর থেকে অন্য অপারেটরে চ্যাট হস্তান্তর করা।",
    category: "chat",
    defaultRoles: ["admin"],
  },
  {
    key: "chat_close_reopen",
    labelBn: "চ্যাট সমাধান / বন্ধ / পুনরায় খোলা",
    labelEn: "Close / Resolve / Reopen Chats",
    description: "চ্যাট স্ট্যাটাস Resolved, Closed বা Reopened হিসেবে পরিবর্তন।",
    category: "chat",
    defaultRoles: ["admin", "moderator"],
  },
  {
    key: "chat_view_history",
    labelBn: "চ্যাট হিস্ট্রি ও AI হ্যান্ডঅফ দেখা",
    labelEn: "View Chat History & AI Handoff",
    description: "পূর্ববর্তী কথোপকথন ও AI চ্যাট থেকে আসা সারাংশ দেখা।",
    category: "chat",
    defaultRoles: ["admin", "editor", "moderator"],
  },
  {
    key: "chat_manage_availability",
    labelBn: "লাইভ চ্যাট সক্রিয়তা নিয়ন্ত্রণ",
    labelEn: "Manage Chat Availability",
    description: "লাইভ চ্যাট অনলাইন/অফলাইন অবস্থা ও অটো-স্বাগত বার্তা পরিচালনা।",
    category: "chat",
    defaultRoles: ["admin"],
  },
  {
    key: "view_ai_settings",
    labelBn: "এআই চ্যাট সেটিংস দর্শন",
    labelEn: "View AI Chat Settings",
    description: "এআই অ্যাসিস্ট্যান্ট কনফিগারেশন ও নলেজ বেস দেখা।",
    category: "ai",
    defaultRoles: ["admin"],
  },
  {
    key: "edit_ai_config",
    labelBn: "এআই আচরণ ও প্রম্পট সম্পাদনা",
    labelEn: "Edit AI Assistant Config",
    description: "এআই স্বাগত বার্তা, টোন ও হ্যান্ডঅফ আচরণ পরিবর্তন।",
    category: "ai",
    defaultRoles: [],
  },
  {
    key: "manage_ai_knowledge",
    labelBn: "এআই FAQ ও নলেজ বেস পরিচালনা",
    labelEn: "Manage AI Knowledge Base",
    description: "এআই চ্যাটের জন্য নোয়াখালীভিত্তিক FAQ ও কুইক-প্রম্পট যোগ ও সম্পাদনা।",
    category: "ai",
    defaultRoles: ["admin"],
  },
  {
    key: "view_reports",
    labelBn: "রিপোর্ট ও অডিট লগ দর্শন",
    labelEn: "View Reports & Audit Logs",
    description: "কার্যক্রম হিস্ট্রি ও আর্থিক/অডিট রিপোর্ট দেখা।",
    category: "security",
    defaultRoles: ["admin", "editor", "moderator"],
  },
  {
    key: "manage_settings",
    labelBn: "সাইট সেটিংস পরিচালনা",
    labelEn: "Manage Website Settings",
    description: "সিস্টেম কনফিগারেশন ও ডোমেইন সেটিংস পরিবর্তন (শুধুমাত্র সুপার অ্যাডমিন)।",
    category: "settings",
    defaultRoles: [],
    mainAdminOnly: true,
  },
  {
    key: "upload_branding",
    labelBn: "ওয়েবসাইট ব্র্যান্ডিং ও লোগো",
    labelEn: "Upload Website Branding Assets",
    description: "লোগো, ফ্যাভিকন ও মিডিয়া লাইব্রেরি পরিচালনা (শুধুমাত্র সুপার অ্যাডমিন)।",
    category: "settings",
    defaultRoles: [],
    mainAdminOnly: true,
  },
  {
    key: "manage_roles_permissions",
    labelBn: "রোল ও পারমিশন কন্ট্রোল",
    labelEn: "Manage Admin Roles & Permissions",
    description: "কাস্টম রোল তৈরি ও পারমিশন পরিবর্তন (শুধুমাত্র সুপার অ্যাডমিন)।",
    category: "security",
    defaultRoles: [],
    mainAdminOnly: true,
  },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  admin: [
    "view_dashboard",
    "view_homepage",
    "edit_homepage",
    "manage_hero_banners",
    "upload_banner_images",
    "edit_banner_colors",
    "publish_banners",
    "manage_categories",
    "create_edit_content",
    "publish_content",
    "moderate_submissions",
    "review_approve_submissions",
    "view_users",
    "view_notifications",
    "send_notifications",
    "chat_view_assigned",
    "chat_view_all",
    "chat_reply",
    "chat_assign",
    "chat_transfer",
    "chat_close_reopen",
    "chat_view_history",
    "chat_manage_availability",
    "view_ai_settings",
    "manage_ai_knowledge",
    "view_reports",
  ],
  editor: [
    "view_dashboard",
    "view_homepage",
    "manage_categories",
    "create_edit_content",
    "publish_content",
    "moderate_submissions",
    "review_approve_submissions",
    "view_notifications",
    "chat_view_assigned",
    "chat_view_all",
    "chat_reply",
    "chat_view_history",
    "view_reports",
  ],
  moderator: [
    "view_dashboard",
    "moderate_submissions",
    "review_approve_submissions",
    "view_notifications",
    "chat_view_assigned",
    "chat_view_all",
    "chat_reply",
    "chat_close_reopen",
    "chat_view_history",
    "view_reports",
  ],
  user: [],
};

export const DEFAULT_CUSTOM_ROLES: CustomRoleDefinition[] = [
  {
    id: "custom_live_chat_operator",
    name: "লাইভ চ্যাট অপারেটর",
    nameEn: "Live Chat Operator",
    description: "গ্রাহকদের লাইভ চ্যাট দেখা, উত্তর দেওয়া ও স্ট্যাটাস সমাধান করা।",
    color: "#059669",
    active: true,
    permissions: [
      "view_dashboard",
      "chat_view_assigned",
      "chat_view_all",
      "chat_reply",
      "chat_close_reopen",
      "chat_view_history",
    ],
  },
  {
    id: "custom_content_banner_manager",
    name: "ব্যানার ও কন্টেন্ট ম্যানেজার",
    nameEn: "Banner & Content Manager",
    description: "হিরো ব্যানার, কন্টেন্ট ও ক্যাটাগরি হালনাগাদ।",
    color: "#0284c7",
    active: true,
    permissions: [
      "view_dashboard",
      "view_homepage",
      "edit_homepage",
      "manage_hero_banners",
      "upload_banner_images",
      "edit_banner_colors",
      "publish_banners",
      "manage_categories",
      "create_edit_content",
      "publish_content",
    ],
  },
];

const ROLE_PERMISSIONS_CONFIG_ID = "role_permissions";
const LOCAL_ROLE_PERMISSIONS_KEY = "sn_role_permissions_v1";

function sanitizeCustomRoleList(rawList: unknown): CustomRoleDefinition[] {
  if (!Array.isArray(rawList)) return DEFAULT_CUSTOM_ROLES;
  const result: CustomRoleDefinition[] = [];
  const seenIds = new Set<string>();
  for (const item of rawList) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Partial<CustomRoleDefinition>;
    const id = String(obj.id || "").trim();
    const name = String(obj.name || "").trim();
    if (!id || !name || seenIds.has(id)) continue;
    seenIds.add(id);
    const perms = Array.isArray(obj.permissions)
      ? obj.permissions.filter((p): p is PermissionKey => !MAIN_ADMIN_ONLY_SET.has(p as PermissionKey))
      : [];
    result.push({
      id,
      name,
      nameEn: obj.nameEn ? String(obj.nameEn).trim() : "",
      description: obj.description ? String(obj.description).trim() : "",
      color: obj.color ? String(obj.color).trim() : "#059669",
      permissions: Array.from(new Set(perms)),
      active: obj.active !== false,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt,
    });
  }
  return result;
}

export function parseRolePermissionsPayload(raw: string | null | undefined): RolePermissionsStoragePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return {
        admin: Array.isArray(parsed.admin)
          ? (parsed.admin as PermissionKey[]).filter((p) => !MAIN_ADMIN_ONLY_SET.has(p))
          : DEFAULT_ROLE_PERMISSIONS.admin,
        editor: Array.isArray(parsed.editor)
          ? (parsed.editor as PermissionKey[]).filter((p) => !MAIN_ADMIN_ONLY_SET.has(p))
          : DEFAULT_ROLE_PERMISSIONS.editor,
        moderator: Array.isArray(parsed.moderator)
          ? (parsed.moderator as PermissionKey[]).filter((p) => !MAIN_ADMIN_ONLY_SET.has(p))
          : DEFAULT_ROLE_PERMISSIONS.moderator,
        user: [],
        customRoles:
          parsed.customRoles !== undefined
            ? sanitizeCustomRoleList(parsed.customRoles)
            : DEFAULT_CUSTOM_ROLES,
        updatedAt: parsed.updatedAt,
      };
    }
  } catch {
    // ignore malformed json
  }
  return null;
}

export function readStoredRolePermissionsPayload(): RolePermissionsStoragePayload {
  try {
    const cached = localStorage.getItem(LOCAL_ROLE_PERMISSIONS_KEY);
    const parsed = parseRolePermissionsPayload(cached);
    if (parsed) return parsed;
  } catch {
    // ignore
  }
  return {
    ...DEFAULT_ROLE_PERMISSIONS,
    customRoles: DEFAULT_CUSTOM_ROLES,
  };
}

/**
 * Resolves exact display label for any user/admin account.
 * NEVER returns generic "Staff Member" or "স্টাফ মেম্বার" for admin/operator accounts.
 */
export function resolveUserRoleDisplay(params: {
  email?: string | null;
  roles?: string[] | null;
  isMainAdmin?: boolean;
  customRoleId?: string | null;
  customRoleName?: string | null;
  customRoles?: CustomRoleDefinition[];
  designation?: string | null;
}): {
  labelBn: string;
  labelEn: string;
  tier: "super_admin" | "custom" | "admin" | "editor" | "moderator" | "user";
  badgeColor: string;
} {
  const isSuper = Boolean(params.isMainAdmin || isSuperAdminEmail(params.email));
  if (isSuper) {
    return {
      labelBn: "সুপার অ্যাডমিন",
      labelEn: "Super Admin",
      tier: "super_admin",
      badgeColor: "#d97706",
    };
  }

  const customList = params.customRoles || readStoredRolePermissionsPayload().customRoles;
  if (params.customRoleId) {
    const matched = customList.find((r) => r.id === params.customRoleId);
    if (matched) {
      return {
        labelBn: matched.name,
        labelEn: matched.nameEn || matched.name,
        tier: "custom",
        badgeColor: matched.color || "#059669",
      };
    }
  }
  if (params.customRoleName && params.customRoleName.trim()) {
    return {
      labelBn: params.customRoleName.trim(),
      labelEn: params.customRoleName.trim(),
      tier: "custom",
      badgeColor: "#059669",
    };
  }

  const roles = Array.isArray(params.roles) ? params.roles : [];
  // Also allow custom role IDs stored inside roles[]
  const customInRoles = customList.find((c) => roles.includes(c.id));
  if (customInRoles) {
    return {
      labelBn: customInRoles.name,
      labelEn: customInRoles.nameEn || customInRoles.name,
      tier: "custom",
      badgeColor: customInRoles.color || "#059669",
    };
  }

  if (roles.includes("admin")) {
    return {
      labelBn: "অ্যাডমিন",
      labelEn: "Admin",
      tier: "admin",
      badgeColor: "#b45309",
    };
  }
  if (roles.includes("editor")) {
    return {
      labelBn: "এডিটর",
      labelEn: "Editor",
      tier: "editor",
      badgeColor: "#7e22ce",
    };
  }
  if (roles.includes("moderator")) {
    return {
      labelBn: "মোডারেটর",
      labelEn: "Moderator",
      tier: "moderator",
      badgeColor: "#1d4ed8",
    };
  }

  const desigLow = (params.designation || "").trim().toLowerCase();
  if (desigLow && !desigLow.includes("staff member") && !desigLow.includes("স্টাফ মেম্বার")) {
    if (desigLow.includes("অ্যাডমিন") || desigLow.includes("এডমিন") || desigLow === "admin") {
      return { labelBn: "অ্যাডমিন", labelEn: "Admin", tier: "admin", badgeColor: "#b45309" };
    }
    if (desigLow.includes("এডিটর") || desigLow === "editor") {
      return { labelBn: "এডিটর", labelEn: "Editor", tier: "editor", badgeColor: "#7e22ce" };
    }
    if (desigLow.includes("মোডারেটর") || desigLow.includes("মডারেটর") || desigLow === "moderator") {
      return { labelBn: "মোডারেটর", labelEn: "Moderator", tier: "moderator", badgeColor: "#1d4ed8" };
    }
  }

  return {
    labelBn: "সাধারণ ব্যবহারকারী",
    labelEn: "Standard User",
    tier: "user",
    badgeColor: "#64748b",
  };
}

export function getEffectivePermissions(params: {
  email?: string | null;
  roles?: string[] | null;
  isMainAdmin?: boolean;
  customRoleId?: string | null;
  payload?: RolePermissionsStoragePayload;
}): PermissionKey[] {
  if (params.isMainAdmin || isSuperAdminEmail(params.email)) {
    return ALL_PERMISSIONS.map((p) => p.key);
  }
  const payload = params.payload || readStoredRolePermissionsPayload();
  const roles = Array.isArray(params.roles) ? params.roles : [];
  const result = new Set<PermissionKey>();

  for (const r of roles) {
    if (r === "admin" || r === "editor" || r === "moderator") {
      (payload[r] || []).forEach((p) => {
        if (!MAIN_ADMIN_ONLY_SET.has(p)) result.add(p);
      });
    }
    const matchingCustom = payload.customRoles.find((c) => c.id === r && c.active);
    if (matchingCustom) {
      matchingCustom.permissions.forEach((p) => {
        if (!MAIN_ADMIN_ONLY_SET.has(p)) result.add(p);
      });
    }
  }

  if (params.customRoleId) {
    const custom = payload.customRoles.find((c) => c.id === params.customRoleId && c.active);
    if (custom) {
      custom.permissions.forEach((p) => {
        if (!MAIN_ADMIN_ONLY_SET.has(p)) result.add(p);
      });
    }
  }

  return Array.from(result);
}

export function useRolePermissions() {
  const { user, isMainAdmin, roles, customRoleId } = useAuth();
  const [payload, setPayload] = useState<RolePermissionsStoragePayload>(() =>
    readStoredRolePermissionsPayload()
  );
  const [saving, setSaving] = useState(false);

  const rolePermissions: Record<Role, PermissionKey[]> = useMemo(
    () => ({
      admin: payload.admin,
      editor: payload.editor,
      moderator: payload.moderator,
      user: [],
    }),
    [payload.admin, payload.editor, payload.moderator]
  );

  // Sync from Server Content API & Firestore
  useEffect(() => {
    let active = true;
    fetch(`/api/content?collection=settings&id=${ROLE_PERMISSIONS_CONFIG_ID}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active) return;
        if (d?.item?.logo_url) {
          const parsed = parseRolePermissionsPayload(d.item.logo_url);
          if (parsed) {
            setPayload(parsed);
            try {
              localStorage.setItem(LOCAL_ROLE_PERMISSIONS_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      })
      .catch(() => {});

    const q = query(collection(db, "settings"), where("visible", "==", true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!active) return;
        const docSnap = snap.docs.find((d) => d.id === ROLE_PERMISSIONS_CONFIG_ID);
        if (docSnap) {
          const raw = docSnap.data().logo_url;
          const parsed = parseRolePermissionsPayload(typeof raw === "string" ? raw : undefined);
          if (parsed) {
            setPayload(parsed);
            try {
              localStorage.setItem(LOCAL_ROLE_PERMISSIONS_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      },
      () => {}
    );

    return () => {
      active = false;
      unsub();
    };
  }, []);

  const persistPayload = useCallback(
    async (next: RolePermissionsStoragePayload) => {
      if (!isMainAdmin && !isSuperAdminEmail(user?.email)) {
        throw new Error("অনুমতি নেই: শুধুমাত্র প্রধান সুপার অ্যাডমিন রোল ও পারমিশন পরিবর্তন করতে পারেন।");
      }
      setSaving(true);
      try {
        const sanitized: RolePermissionsStoragePayload = {
          admin: (next.admin || []).filter((p) => !MAIN_ADMIN_ONLY_SET.has(p)),
          editor: (next.editor || []).filter((p) => !MAIN_ADMIN_ONLY_SET.has(p)),
          moderator: (next.moderator || []).filter((p) => !MAIN_ADMIN_ONLY_SET.has(p)),
          user: [],
          customRoles: sanitizeCustomRoleList(next.customRoles),
          updatedAt: new Date().toISOString(),
        };
        const serialized = JSON.stringify(sanitized);
        try {
          localStorage.setItem(LOCAL_ROLE_PERMISSIONS_KEY, serialized);
        } catch {}
        setPayload(sanitized);
        await upsertSettingDoc(ROLE_PERMISSIONS_CONFIG_ID, serialized);
        void import("@/lib/admin-client")
          .then((m) => m.syncChatOperatorUidsSetting())
          .catch(() => {});
        return sanitized;
      } finally {
        setSaving(false);
      }
    },
    [isMainAdmin, user?.email]
  );

  const hasPermission = useCallback(
    (perm: PermissionKey): boolean => {
      if (isMainAdmin || isSuperAdminEmail(user?.email)) {
        return true;
      }
      if (MAIN_ADMIN_ONLY_SET.has(perm)) {
        return false;
      }
      const effective = getEffectivePermissions({
        email: user?.email,
        roles,
        isMainAdmin,
        customRoleId: customRoleId || user?.customRoleId,
        payload,
      });
      return effective.includes(perm);
    },
    [isMainAdmin, user?.email, user?.customRoleId, customRoleId, roles, payload]
  );

  const saveRolePermissions = useCallback(
    async (nextConfig: Record<Role, PermissionKey[]>, nextCustomRoles?: CustomRoleDefinition[]) => {
      await persistPayload({
        ...nextConfig,
        user: [],
        customRoles: nextCustomRoles ?? payload.customRoles,
      });
    },
    [persistPayload, payload.customRoles]
  );

  const createCustomRole = useCallback(
    async (input: {
      name: string;
      nameEn?: string;
      description?: string;
      color?: string;
      permissions: PermissionKey[];
      active?: boolean;
    }): Promise<CustomRoleDefinition> => {
      const cleanName = input.name.trim();
      if (!cleanName) throw new Error("কাস্টম রোলের নাম দিন");
      const duplicateName = payload.customRoles.some(
        (r) => r.name.trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicateName) {
        throw new Error("এই নামে ইতোমধ্যে একটি রোল বিদ্যমান রয়েছে।");
      }
      const now = new Date().toISOString();
      const newRole: CustomRoleDefinition = {
        id: `custom_${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "role"}_${Date.now().toString(36)}`,
        name: cleanName,
        nameEn: input.nameEn?.trim() || "",
        description: input.description?.trim() || "",
        color: input.color || "#059669",
        permissions: input.permissions.filter((p) => !MAIN_ADMIN_ONLY_SET.has(p)),
        active: input.active !== false,
        createdAt: now,
        updatedAt: now,
      };
      await persistPayload({
        ...payload,
        customRoles: [...payload.customRoles, newRole],
      });
      return newRole;
    },
    [payload, persistPayload]
  );

  const updateCustomRole = useCallback(
    async (roleId: string, patch: Partial<Omit<CustomRoleDefinition, "id">>) => {
      const idx = payload.customRoles.findIndex((r) => r.id === roleId);
      if (idx === -1) throw new Error("রোল খুঁজে পাওয়া যায়নি");
      const current = payload.customRoles[idx];
      const nextName = patch.name !== undefined ? patch.name.trim() : current.name;
      if (!nextName) throw new Error("রোলের নাম খালি রাখা যাবে না");
      const conflict = payload.customRoles.some(
        (r) => r.id !== roleId && r.name.trim().toLowerCase() === nextName.toLowerCase()
      );
      if (conflict) throw new Error("এই নামে অন্য একটি রোল রয়েছে");
      const nextCustomRoles = [...payload.customRoles];
      nextCustomRoles[idx] = {
        ...current,
        ...patch,
        name: nextName,
        permissions: (patch.permissions ?? current.permissions).filter(
          (p) => !MAIN_ADMIN_ONLY_SET.has(p)
        ),
        updatedAt: new Date().toISOString(),
      };
      await persistPayload({
        ...payload,
        customRoles: nextCustomRoles,
      });
    },
    [payload, persistPayload]
  );

  const duplicateCustomRole = useCallback(
    async (roleId: string) => {
      const src = payload.customRoles.find((r) => r.id === roleId);
      if (!src) throw new Error("রোল খুঁজে পাওয়া যায়নি");
      return createCustomRole({
        name: `${src.name} (কপি)`,
        nameEn: src.nameEn ? `${src.nameEn} Copy` : "",
        description: src.description,
        color: src.color,
        permissions: [...src.permissions],
        active: src.active,
      });
    },
    [payload.customRoles, createCustomRole]
  );

  const deleteCustomRole = useCallback(
    async (roleId: string, assignedUserCount = 0) => {
      if (assignedUserCount > 0) {
        throw new Error(
          `এই রোলটি বর্তমানে ${assignedUserCount} জন ইউজার/অ্যাডমিনের সাথে যুক্ত। আগে তাদের রোল পরিবর্তন করে তারপর মুছুন।`
        );
      }
      const nextCustomRoles = payload.customRoles.filter((r) => r.id !== roleId);
      await persistPayload({
        ...payload,
        customRoles: nextCustomRoles,
      });
    },
    [payload, persistPayload]
  );

  const resetToDefaults = useCallback(async () => {
    await persistPayload({
      ...DEFAULT_ROLE_PERMISSIONS,
      customRoles: DEFAULT_CUSTOM_ROLES,
    });
  }, [persistPayload]);

  const effectivePermissionsForUser = useMemo(
    () =>
      getEffectivePermissions({
        email: user?.email,
        roles,
        isMainAdmin,
        customRoleId: customRoleId || user?.customRoleId,
        payload,
      }),
    [isMainAdmin, user?.email, user?.customRoleId, customRoleId, roles, payload]
  );

  return {
    rolePermissions,
    customRoles: payload.customRoles,
    hasPermission,
    saveRolePermissions,
    createCustomRole,
    updateCustomRole,
    duplicateCustomRole,
    deleteCustomRole,
    resetToDefaults,
    effectivePermissionsForUser,
    saving,
    allPermissionDefs: ALL_PERMISSIONS,
  };
}

export interface ChatPermissionSubject {
  email?: string | null;
  roles?: string[] | null;
  isMainAdmin?: boolean;
  customRoleId?: string | null;
  customRoleName?: string | null;
  payload?: RolePermissionsStoragePayload;
}

export function hasChatAccess(subject: ChatPermissionSubject): boolean {
  if (subject.isMainAdmin || isSuperAdminEmail(subject.email)) return true;
  const perms = getEffectivePermissions(subject);
  return (
    perms.includes("chat_view_all") ||
    perms.includes("chat_view_assigned") ||
    perms.includes("chat_reply") ||
    perms.includes("chat_assign") ||
    perms.includes("chat_close_reopen")
  );
}

export function canViewAllChats(subject: ChatPermissionSubject): boolean {
  if (subject.isMainAdmin || isSuperAdminEmail(subject.email)) return true;
  return getEffectivePermissions(subject).includes("chat_view_all");
}

export function canReplyChat(subject: ChatPermissionSubject): boolean {
  if (subject.isMainAdmin || isSuperAdminEmail(subject.email)) return true;
  return getEffectivePermissions(subject).includes("chat_reply");
}

export function canAssignChat(subject: ChatPermissionSubject): boolean {
  if (subject.isMainAdmin || isSuperAdminEmail(subject.email)) return true;
  const perms = getEffectivePermissions(subject);
  return perms.includes("chat_assign") || perms.includes("chat_transfer");
}

export function canManageChatStatus(subject: ChatPermissionSubject): boolean {
  if (subject.isMainAdmin || isSuperAdminEmail(subject.email)) return true;
  return getEffectivePermissions(subject).includes("chat_close_reopen");
}

export function getStaffDisplayRoleLabel(subject: ChatPermissionSubject & { designation?: string | null }): string {
  return resolveUserRoleDisplay({
    email: subject.email,
    roles: subject.roles,
    isMainAdmin: subject.isMainAdmin,
    customRoleId: subject.customRoleId,
    customRoleName: subject.customRoleName,
    customRoles: subject.payload?.customRoles,
    designation: subject.designation,
  }).labelBn;
}

