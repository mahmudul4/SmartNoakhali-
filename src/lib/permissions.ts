import { useState, useEffect, useCallback, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, isSuperAdminEmail, SUPER_ADMIN_EMAIL } from "@/lib/firebase";
import { upsertSettingDoc } from "@/lib/store";
import { useAuth, type Role } from "@/lib/auth";

export type PermissionKey =
  | "view_dashboard"
  | "manage_categories"
  | "create_edit_content"
  | "publish_content"
  | "moderate_submissions"
  | "review_approve_submissions"
  | "manage_users"
  | "view_reports"
  | "manage_settings"
  | "upload_branding"
  | "manage_roles_permissions";

export interface PermissionDefinition {
  key: PermissionKey;
  labelBn: string;
  labelEn: string;
  description: string;
  category: "dashboard" | "content" | "moderation" | "users" | "settings" | "security";
  defaultRoles: ("admin" | "editor" | "moderator")[];
  mainAdminOnly?: boolean;
}

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
    description: "নাগরিকদের পাঠানো নতুন তথ্য ও জরুরী রক্তের আবেদন যাচাই-বাছাই করা।",
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
    key: "manage_users",
    labelBn: "সাধারণ ইউজার পরিচালনা",
    labelEn: "Manage Ordinary User Accounts",
    description: "সাধারণ ব্যবহারকারীদের প্রোফাইল দেখা, পাসওয়ার্ড রিসেট ও একাউন্ট স্থগিত করা।",
    category: "users",
    defaultRoles: ["admin"],
  },
  {
    key: "view_reports",
    labelBn: "রিপোর্ট ও অডিট লগ দর্শন",
    labelEn: "View Reports & Audit Logs",
    description: "স্টাফ অ্যাক্টিভিটি হিস্ট্রি, ডিলিট লগ ও বিস্তারিত ভিজিটর রিপোর্ট দেখা।",
    category: "security",
    defaultRoles: ["admin", "editor", "moderator"],
  },
  {
    key: "manage_settings",
    labelBn: "সাইট সেটিংস পরিচালনা",
    labelEn: "Manage Website Settings",
    description: "অনুদান নাম্বার, জরুরি ব্যানার, নোটিশ ও সাধারণ সাইট সেটিংস পরিবর্তন।",
    category: "settings",
    defaultRoles: ["admin"],
  },
  {
    key: "upload_branding",
    labelBn: "ওয়েবসাইট ব্র্যান্ডিং ও লোগো",
    labelEn: "Upload Website Branding Assets",
    description: "ওয়েবসাইট হেডার লোগো, ফ্যাভিকন ও পিডব্লিউএ (PWA) মোবাইল অ্যাপ আইকন আপলোড।",
    category: "settings",
    defaultRoles: ["admin"],
  },
  {
    key: "manage_roles_permissions",
    labelBn: "রোল ও পারমিশন কন্ট্রোল",
    labelEn: "Manage Admin Roles & Permissions",
    description: "স্টাফদের পদবি ও এক্সেস পারমিশন পরিবর্তন (শুধুমাত্র প্রধান এডমিন সংরক্ষিত)।",
    category: "security",
    defaultRoles: [],
    mainAdminOnly: true,
  },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  admin: [
    "view_dashboard",
    "manage_categories",
    "create_edit_content",
    "publish_content",
    "moderate_submissions",
    "review_approve_submissions",
    "manage_users",
    "view_reports",
    "manage_settings",
    "upload_branding",
  ],
  editor: [
    "view_dashboard",
    "manage_categories",
    "create_edit_content",
    "publish_content",
    "moderate_submissions",
    "review_approve_submissions",
    "view_reports",
  ],
  moderator: [
    "view_dashboard",
    "moderate_submissions",
    "review_approve_submissions",
    "view_reports",
  ],
  user: [],
};

const ROLE_PERMISSIONS_CONFIG_ID = "role_permissions";
const LOCAL_ROLE_PERMISSIONS_KEY = "sn_role_permissions_v1";

export function useRolePermissions() {
  const { user, isMainAdmin, roles } = useAuth();
  const [rolePermissions, setRolePermissions] = useState<Record<Role, PermissionKey[]>>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_ROLE_PERMISSIONS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object") {
          return {
            admin: Array.isArray(parsed.admin) ? parsed.admin : DEFAULT_ROLE_PERMISSIONS.admin,
            editor: Array.isArray(parsed.editor) ? parsed.editor : DEFAULT_ROLE_PERMISSIONS.editor,
            moderator: Array.isArray(parsed.moderator) ? parsed.moderator : DEFAULT_ROLE_PERMISSIONS.moderator,
            user: [],
          };
        }
      }
    } catch {}
    return DEFAULT_ROLE_PERMISSIONS;
  });

  const [saving, setSaving] = useState(false);

  // Sync from Server Content API & Firestore
  useEffect(() => {
    fetch(`/api/content?collection=settings&id=${ROLE_PERMISSIONS_CONFIG_ID}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.item?.logo_url) {
          try {
            const parsed = JSON.parse(d.item.logo_url);
            if (parsed && typeof parsed === "object") {
              setRolePermissions({
                admin: Array.isArray(parsed.admin) ? parsed.admin : DEFAULT_ROLE_PERMISSIONS.admin,
                editor: Array.isArray(parsed.editor) ? parsed.editor : DEFAULT_ROLE_PERMISSIONS.editor,
                moderator: Array.isArray(parsed.moderator) ? parsed.moderator : DEFAULT_ROLE_PERMISSIONS.moderator,
                user: [],
              });
              localStorage.setItem(LOCAL_ROLE_PERMISSIONS_KEY, d.item.logo_url);
            }
          } catch {}
        }
      })
      .catch(() => {});

    const q = query(collection(db, "settings"), where("visible", "==", true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docSnap = snap.docs.find((doc) => doc.id === ROLE_PERMISSIONS_CONFIG_ID);
        if (docSnap) {
          const raw = docSnap.data().logo_url;
          if (typeof raw === "string" && raw.length > 0) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === "object") {
                setRolePermissions({
                  admin: Array.isArray(parsed.admin) ? parsed.admin : DEFAULT_ROLE_PERMISSIONS.admin,
                  editor: Array.isArray(parsed.editor) ? parsed.editor : DEFAULT_ROLE_PERMISSIONS.editor,
                  moderator: Array.isArray(parsed.moderator) ? parsed.moderator : DEFAULT_ROLE_PERMISSIONS.moderator,
                  user: [],
                });
                try {
                  localStorage.setItem(LOCAL_ROLE_PERMISSIONS_KEY, raw);
                } catch {}
              }
            } catch {}
          }
        }
      },
      () => {}
    );

    return () => unsub();
  }, []);

  const hasPermission = useCallback(
    (perm: PermissionKey): boolean => {
      // 1. Main Admin mdmahmudulhashan0@gmail.com always has ALL permissions
      if (isMainAdmin || isSuperAdminEmail(user?.email)) {
        return true;
      }

      // 2. Main Admin-only permissions can never be assigned to others
      if (perm === "manage_roles_permissions") {
        return false;
      }

      // 3. Check effective permissions assigned to user's roles
      for (const r of roles) {
        if (rolePermissions[r]?.includes(perm)) {
          return true;
        }
      }

      return false;
    },
    [isMainAdmin, user?.email, roles, rolePermissions]
  );

  const saveRolePermissions = useCallback(
    async (nextConfig: Record<Role, PermissionKey[]>) => {
      if (!isMainAdmin && !isSuperAdminEmail(user?.email)) {
        throw new Error("অনুমতি নেই: শুধুমাত্র প্রধান এডমিন রোল পারমিশন পরিবর্তন করতে পারেন।");
      }

      setSaving(true);
      try {
        // Sanitize: ensure manage_roles_permissions is never granted to non-superadmin
        const sanitized: Record<Role, PermissionKey[]> = {
          admin: (nextConfig.admin || []).filter((p) => p !== "manage_roles_permissions"),
          editor: (nextConfig.editor || []).filter((p) => p !== "manage_roles_permissions"),
          moderator: (nextConfig.moderator || []).filter((p) => p !== "manage_roles_permissions"),
          user: [],
        };

        const serialized = JSON.stringify(sanitized);
        try {
          localStorage.setItem(LOCAL_ROLE_PERMISSIONS_KEY, serialized);
        } catch {}

        setRolePermissions(sanitized);
        await upsertSettingDoc(ROLE_PERMISSIONS_CONFIG_ID, serialized);
      } finally {
        setSaving(false);
      }
    },
    [isMainAdmin, user?.email]
  );

  const resetToDefaults = useCallback(async () => {
    await saveRolePermissions(DEFAULT_ROLE_PERMISSIONS);
  }, [saveRolePermissions]);

  const effectivePermissionsForUser = useMemo(() => {
    if (isMainAdmin || isSuperAdminEmail(user?.email)) {
      return ALL_PERMISSIONS.map((p) => p.key);
    }
    const set = new Set<PermissionKey>();
    for (const r of roles) {
      (rolePermissions[r] || []).forEach((p) => set.add(p));
    }
    return Array.from(set);
  }, [isMainAdmin, user?.email, roles, rolePermissions]);

  return {
    rolePermissions,
    hasPermission,
    saveRolePermissions,
    resetToDefaults,
    effectivePermissionsForUser,
    saving,
    allPermissionDefs: ALL_PERMISSIONS,
  };
}
