import { useEffect, useState, useCallback, useMemo } from "react";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { signInWithPopup } from "firebase/auth";
import {
  auth,
  db,
  googleProvider,
  SUPER_ADMIN_EMAIL,
  REGULAR_ADMIN_EMAIL,
  isSuperAdminEmail,
  OperationType,
  handleFirestoreError,
  sanitizeString,
} from "@/lib/firebase";
import {
  categories as defaultCategories,
  CATEGORY_ICONS,
  type Category,
} from "@/data/categories";
import defaultLogoUrl from "@/assets/logo.png";

export const defaultLogo: string = defaultLogoUrl;

const SITE_CONFIG_ID = "site_config";
const DONATION_CONFIG_ID = "donation_config";
const CATEGORIES_CONFIG_ID = "categories_config";
const STAFF_PROFILES_CONFIG_ID = "staff_profiles_config";
const APP_PACKAGES_CONFIG_ID = "app_packages_config";
const SITE_META_CONFIG_ID = "site_meta_config";

const LOCAL_DONATION_KEY = "sn_donation_config_v1";
const LOCAL_CATEGORIES_KEY = "sn_categories_config_v1";
const LOCAL_STAFF_PROFILES_KEY = "sn_staff_profiles_v1";
const LOCAL_APP_PACKAGES_KEY = "sn_app_packages_v1";
const LOCAL_SITE_META_KEY = "sn_site_meta_v1";

async function ensureSuperAdminForSettings() {
  const u = auth.currentUser;
  if (u && u.emailVerified && isSuperAdminEmail(u.email)) {
    return u;
  }
  googleProvider.setCustomParameters({ login_hint: SUPER_ADMIN_EMAIL });
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

async function ensureStaffForProfileSettings() {
  const u = auth.currentUser;
  if (u && u.emailVerified) {
    return u;
  }
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function upsertSettingDoc(
  settingId: string,
  payloadValue: string,
  options?: { visible?: boolean; allowStaff?: boolean }
) {
  if (options?.allowStaff) {
    await ensureStaffForProfileSettings();
  } else {
    await ensureSuperAdminForSettings();
  }
  const path = `settings/${settingId}`;
  const ref = doc(db, "settings", settingId);
  const cleanUrl = sanitizeString(payloadValue, 295000, "");
  const isVisible = options?.visible !== false;
  const snap = await getDoc(ref).catch((e) =>
    handleFirestoreError(e, OperationType.GET, path)
  );
  if (!snap.exists()) {
    await setDoc(ref, {
      key: settingId,
      logo_url: cleanUrl,
      visible: isVisible,
      updatedAt: serverTimestamp(),
    }).catch((e) => handleFirestoreError(e, OperationType.CREATE, path));
  } else {
    await updateDoc(ref, {
      logo_url: cleanUrl,
      visible: isVisible,
      updatedAt: serverTimestamp(),
    }).catch((e) => handleFirestoreError(e, OperationType.UPDATE, path));
  }
}

// ============================================================================
// 1. Site Logo Hook (/settings/site_config)
// ============================================================================
export function useLogo() {
  const [customLogo, setCustomLogo] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "settings"), where("visible", "==", true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const configDoc = snap.docs.find((d) => d.id === SITE_CONFIG_ID);
        if (configDoc) {
          const url = configDoc.data().logo_url;
          setCustomLogo(typeof url === "string" && url.length > 0 ? url : null);
        } else {
          setCustomLogo(null);
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, "settings");
        } catch {
          // Keep default logo on read error
        }
      }
    );
    return () => unsub();
  }, []);

  const setLogo = useCallback(async (nextLogo: string | null) => {
    await upsertSettingDoc(SITE_CONFIG_ID, nextLogo ?? "");
  }, []);

  return {
    logo: customLogo || defaultLogo,
    customLogo,
    defaultLogo,
    setLogo,
  };
}

// ============================================================================
// 2. Donation Numbers Configuration Hook (/settings/donation_config)
// ============================================================================
export interface DonationNumberItem {
  id: string;
  method: "bkash" | "nagad" | "rocket" | "upay";
  label: string;
  number: string;
  active: boolean;
  tone: string;
}

export interface DonationConfig {
  numbers: DonationNumberItem[];
  subtitle: string;
}

export const DEFAULT_DONATION_CONFIG: DonationConfig = {
  subtitle: "আপনার সহযোগিতাই আমাদের শক্তি",
  numbers: [
    {
      id: "bkash_main",
      method: "bkash",
      label: "bKash (Personal)",
      number: "01850999178",
      active: true,
      tone: "from-pink-500 to-rose-600",
    },
    {
      id: "nagad_main",
      method: "nagad",
      label: "Nagad (Personal)",
      number: "01850999178",
      active: true,
      tone: "from-orange-500 to-red-600",
    },
    {
      id: "rocket_main",
      method: "rocket",
      label: "Rocket (Personal)",
      number: "01850999178",
      active: false,
      tone: "from-purple-600 to-indigo-700",
    },
    {
      id: "upay_main",
      method: "upay",
      label: "Upay (Personal)",
      number: "01850999178",
      active: false,
      tone: "from-sky-500 to-blue-700",
    },
  ],
};

function parseDonationConfig(raw: string | null | undefined): DonationConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DonationConfig>;
    if (Array.isArray(parsed.numbers) && parsed.numbers.length > 0) {
      return {
        subtitle:
          typeof parsed.subtitle === "string" && parsed.subtitle.trim()
            ? parsed.subtitle.trim()
            : DEFAULT_DONATION_CONFIG.subtitle,
        numbers: parsed.numbers.map((n, idx) => ({
          id: String(n.id || `num_${idx}`),
          method: (["bkash", "nagad", "rocket", "upay"].includes(String(n.method))
            ? n.method
            : "bkash") as DonationNumberItem["method"],
          label: String(n.label || "bKash (Personal)"),
          number: String(n.number || "01850999178"),
          active: Boolean(n.active ?? true),
          tone: String(n.tone || "from-pink-500 to-rose-600"),
        })),
      };
    }
  } catch {
    // ignore invalid json
  }
  return null;
}

export function useDonationConfig() {
  const [config, setConfig] = useState<DonationConfig>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_DONATION_KEY);
      return parseDonationConfig(cached) ?? DEFAULT_DONATION_CONFIG;
    } catch {
      return DEFAULT_DONATION_CONFIG;
    }
  });

  useEffect(() => {
    const q = query(collection(db, "settings"), where("visible", "==", true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docSnap = snap.docs.find((d) => d.id === DONATION_CONFIG_ID);
        if (docSnap) {
          const parsed = parseDonationConfig(docSnap.data().logo_url);
          if (parsed) {
            setConfig(parsed);
            try {
              localStorage.setItem(LOCAL_DONATION_KEY, JSON.stringify(parsed));
            } catch {
              // ignore
            }
          }
        }
      },
      () => {
        // Keep current config on snapshot error
      }
    );
    return () => unsub();
  }, []);

  const saveDonationConfig = useCallback(async (next: DonationConfig) => {
    const serialized = JSON.stringify(next);
    try {
      localStorage.setItem(LOCAL_DONATION_KEY, serialized);
    } catch {
      // ignore
    }
    setConfig(next);
    await upsertSettingDoc(DONATION_CONFIG_ID, serialized);
  }, []);

  return {
    config,
    activeNumbers: config.numbers.filter((n) => n.active && n.number.trim().length > 0),
    saveDonationConfig,
  };
}

// ============================================================================
// 3. Dynamic Categories Hook (/settings/categories_config)
// ============================================================================
export interface CategoryConfigItem {
  slug: string;
  bn: string;
  en: string;
  iconName: string;
  tint: string;
  description: string;
  visible: boolean;
  sort_order: number;
}

const DEFAULT_CATEGORY_ITEMS: CategoryConfigItem[] = defaultCategories
  .filter((c) => c.slug !== "chat" && c.slug !== "app-download")
  .map((c, idx) => ({
    slug: c.slug,
    bn: c.bn,
    en: c.en,
    iconName: c.iconName || "Users",
    tint: c.tint,
    description: c.description,
    visible: true,
    sort_order: idx + 1,
  }));

function parseCategoryConfig(raw: string | null | undefined): CategoryConfigItem[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
        .filter(
          (item) =>
            item &&
            typeof item.slug === "string" &&
            item.slug !== "chat" &&
            item.slug !== "app-download"
        )
        .map((item, idx) => ({
          slug: String(item.slug),
          bn: String(item.bn || item.slug),
          en: String(item.en || item.slug),
          iconName: String(item.iconName || "Users"),
          tint: String(item.tint || "from-emerald-500/15 to-emerald-700/10"),
          description: String(item.description || ""),
          visible: item.visible !== false,
          sort_order: typeof item.sort_order === "number" ? item.sort_order : idx + 1,
        }));
    }
  } catch {
    // ignore
  }
  return null;
}

function toResolvedCategory(item: CategoryConfigItem): Category {
  const IconComp = CATEGORY_ICONS[item.iconName] || CATEGORY_ICONS.Users;
  return {
    slug: item.slug,
    bn: item.bn,
    en: item.en,
    icon: IconComp,
    iconName: item.iconName,
    tint: item.tint,
    description: item.description,
    visible: item.visible,
    sort_order: item.sort_order,
  };
}

export function useCategories() {
  const [items, setItems] = useState<CategoryConfigItem[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_CATEGORIES_KEY);
      return parseCategoryConfig(cached) ?? DEFAULT_CATEGORY_ITEMS;
    } catch {
      return DEFAULT_CATEGORY_ITEMS;
    }
  });

  useEffect(() => {
    const q = query(collection(db, "settings"), where("visible", "==", true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docSnap = snap.docs.find((d) => d.id === CATEGORIES_CONFIG_ID);
        if (docSnap) {
          const parsed = parseCategoryConfig(docSnap.data().logo_url);
          if (parsed) {
            setItems(parsed);
            try {
              localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(parsed));
            } catch {
              // ignore
            }
          }
        }
      },
      () => {
        // Keep current categories on snapshot error
      }
    );
    return () => unsub();
  }, []);

  const saveCategories = useCallback(async (nextList: CategoryConfigItem[]) => {
    const normalized = nextList
      .filter((c) => c.slug !== "chat" && c.slug !== "app-download")
      .map((c, idx) => ({ ...c, sort_order: idx + 1 }));
    const serialized = JSON.stringify(normalized);
    try {
      localStorage.setItem(LOCAL_CATEGORIES_KEY, serialized);
    } catch {
      // ignore
    }
    setItems(normalized);
    await upsertSettingDoc(CATEGORIES_CONFIG_ID, serialized);
  }, []);

  const updateCategory = useCallback(
    async (slug: string, patch: Partial<CategoryConfigItem>) => {
      const next = items.map((c) => (c.slug === slug ? { ...c, ...patch } : c));
      await saveCategories(next);
    },
    [items, saveCategories]
  );

  const addCategory = useCallback(
    async (newCat: Omit<CategoryConfigItem, "sort_order">) => {
      const cleanSlug = newCat.slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-");
      if (!cleanSlug) throw new Error("সঠিক ক্যাটাগরি স্লাগ (ইংরেজি অক্ষর) দিন");
      if (items.some((c) => c.slug === cleanSlug)) {
        throw new Error("এই স্লাগের ক্যাটাগরি ইতিমধ্যে আছে");
      }
      const next: CategoryConfigItem[] = [
        ...items,
        {
          ...newCat,
          slug: cleanSlug,
          sort_order: items.length + 1,
        },
      ];
      await saveCategories(next);
    },
    [items, saveCategories]
  );

  const deleteCategory = useCallback(
    async (slug: string) => {
      const next = items.filter((c) => c.slug !== slug);
      await saveCategories(next);
    },
    [items, saveCategories]
  );

  const moveCategory = useCallback(
    async (slug: string, direction: "up" | "down") => {
      const idx = items.findIndex((c) => c.slug === slug);
      if (idx === -1) return;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= items.length) return;
      const copy = [...items];
      const [moved] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, moved);
      await saveCategories(copy);
    },
    [items, saveCategories]
  );

  const resetCategories = useCallback(async () => {
    await saveCategories(DEFAULT_CATEGORY_ITEMS);
  }, [saveCategories]);

  const allCategories = useMemo(
    () =>
      [...items]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(toResolvedCategory),
    [items]
  );

  const visibleCategories = useMemo(
    () =>
      allCategories.filter(
        (c) => c.visible !== false && c.slug !== "chat" && c.slug !== "app-download"
      ),
    [allCategories]
  );

  const getCategoryBySlug = useCallback(
    (slug: string) => allCategories.find((c) => c.slug === slug),
    [allCategories]
  );

  return {
    categories: visibleCategories,
    allCategories,
    rawItems: items,
    getCategoryBySlug,
    saveCategories,
    updateCategory,
    addCategory,
    deleteCategory,
    moveCategory,
    resetCategories,
  };
}

// ============================================================================
// 4. Staff Profiles Hook (/settings/staff_profiles_config)
// Stores Profile Photos, Names, Designations & Role Labels for Admins, Editors, Moderators
// Used in Admin Panel Personal Profiles AND Live Chat Staff Replies!
// ============================================================================
export interface StaffProfileEntry {
  uid: string;
  email: string;
  full_name: string;
  username: string;
  phone: string;
  designation: string;
  role_label: string;
  photo_url: string;
  bio: string;
  updated_at: string;
}

const DEFAULT_STAFF_PROFILES: Record<string, StaffProfileEntry> = {
  super_admin_mahmudul: {
    uid: "super_admin_mahmudul",
    email: SUPER_ADMIN_EMAIL,
    full_name: "Mahmudul Hasan (সুপার এডমিন)",
    username: "mahmudul",
    phone: "01850999178",
    designation: "মেইন সুপার এডমিন • স্মার্ট নোয়াখালী",
    role_label: "সুপার এডমিন",
    photo_url: "",
    bio: "স্মার্ট নোয়াখালী মেইন এডমিন ও সিস্টেম নিয়ন্ত্রক",
    updated_at: new Date().toISOString(),
  },
};

function parseStaffProfiles(raw: string | null | undefined): Record<string, StaffProfileEntry> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { ...DEFAULT_STAFF_PROFILES, ...parsed };
    }
  } catch {
    // ignore
  }
  return null;
}

export function useStaffProfiles() {
  const [profiles, setProfiles] = useState<Record<string, StaffProfileEntry>>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STAFF_PROFILES_KEY);
      return parseStaffProfiles(cached) ?? DEFAULT_STAFF_PROFILES;
    } catch {
      return DEFAULT_STAFF_PROFILES;
    }
  });

  useEffect(() => {
    const q = query(collection(db, "settings"), where("visible", "==", true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docSnap = snap.docs.find((d) => d.id === STAFF_PROFILES_CONFIG_ID);
        if (docSnap) {
          const parsed = parseStaffProfiles(docSnap.data().logo_url);
          if (parsed) {
            setProfiles(parsed);
            try {
              localStorage.setItem(LOCAL_STAFF_PROFILES_KEY, JSON.stringify(parsed));
            } catch {
              // ignore
            }
          }
        }
      },
      () => {
        // Keep cached profiles
      }
    );
    return () => unsub();
  }, []);

  const upsertStaffProfile = useCallback(
    async (entry: Partial<StaffProfileEntry> & { uid: string; email?: string }) => {
      const existing = profiles[entry.uid] ||
        Object.values(profiles).find(
          (p) => entry.email && p.email.toLowerCase() === entry.email.toLowerCase()
        ) || {
          uid: entry.uid,
          email: entry.email || "",
          full_name: "এডমিন টিম",
          username: "staff",
          phone: "",
          designation: "স্মার্ট নোয়াখালী টিম",
          role_label: "এডমিন",
          photo_url: "",
          bio: "",
          updated_at: new Date().toISOString(),
        };

      const isSuper =
        isSuperAdminEmail(entry.email || existing.email) ||
        entry.uid === "super_admin_mahmudul";

      const merged: StaffProfileEntry = {
        ...existing,
        ...entry,
        uid: entry.uid,
        email: entry.email ?? existing.email,
        role_label: isSuper ? "সুপার এডমিন" : entry.role_label || existing.role_label || "এডমিন",
        updated_at: new Date().toISOString(),
      };

      const nextMap: Record<string, StaffProfileEntry> = {
        ...profiles,
        [entry.uid]: merged,
      };
      if (merged.email) {
        nextMap[merged.email.toLowerCase()] = merged;
      }

      const serialized = JSON.stringify(nextMap);
      try {
        localStorage.setItem(LOCAL_STAFF_PROFILES_KEY, serialized);
      } catch {
        // ignore
      }
      setProfiles(nextMap);

      try {
        await upsertSettingDoc(STAFF_PROFILES_CONFIG_ID, serialized, {
          visible: true,
          allowStaff: true,
        });
      } catch {
        // Local state already updated if offline
      }
      return merged;
    },
    [profiles]
  );

  const getStaffProfile = useCallback(
    (uidOrEmail?: string | null): StaffProfileEntry | null => {
      if (!uidOrEmail) return null;
      const key = uidOrEmail.trim();
      if (profiles[key]) return profiles[key];
      if (profiles[key.toLowerCase()]) return profiles[key.toLowerCase()];
      const byMatch = Object.values(profiles).find(
        (p) =>
          p.uid === key ||
          (p.email && p.email.toLowerCase() === key.toLowerCase()) ||
          (p.username && p.username.toLowerCase() === key.toLowerCase())
      );
      if (byMatch) return byMatch;
      if (isSuperAdminEmail(key) || key === "super_admin_mahmudul") {
        return profiles.super_admin_mahmudul || DEFAULT_STAFF_PROFILES.super_admin_mahmudul;
      }
      if (key.toLowerCase() === REGULAR_ADMIN_EMAIL.toLowerCase()) {
        return {
          uid: key,
          email: REGULAR_ADMIN_EMAIL,
          full_name: "Admin (Smart Noakhali)",
          username: "admin_bear",
          phone: "",
          designation: "এডমিন • স্মার্ট নোয়াখালী",
          role_label: "এডমিন",
          photo_url: "",
          bio: "",
          updated_at: new Date().toISOString(),
        };
      }
      return null;
    },
    [profiles]
  );

  return {
    profiles,
    upsertStaffProfile,
    getStaffProfile,
  };
}

// ============================================================================
// 5. Direct Android & iOS App Packages Hook (/settings/app_packages_config)
// Super Admin uploads Android (.apk) and iPhone (.ipa) app binaries directly
// ============================================================================
export interface AppPackageInfo {
  platform: "android" | "ios";
  label: string;
  version: string;
  fileName: string;
  fileSize: number;
  downloadUrl: string;
  embeddedDataUrl?: string;
  visible: boolean;
  uploadedAt: string;
  releaseNotes: string;
}

export interface AppPackagesConfig {
  android: AppPackageInfo;
  ios: AppPackageInfo;
}

export const DEFAULT_APP_PACKAGES: AppPackagesConfig = {
  android: {
    platform: "android",
    label: "স্মার্ট নোয়াখালী Android অ্যাপ (APK)",
    version: "2.0.0",
    fileName: "",
    fileSize: 0,
    downloadUrl: "",
    visible: true,
    uploadedAt: "",
    releaseNotes: "অ্যান্ড্রয়েড ফোনের জন্য অফিসিয়াল অ্যাপ — এক ক্লিকে ডাউনলোড ও ইনস্টল করুন।",
  },
  ios: {
    platform: "ios",
    label: "স্মার্ট নোয়াখালী iPhone (iOS) অ্যাপ",
    version: "2.0.0",
    fileName: "",
    fileSize: 0,
    downloadUrl: "",
    visible: true,
    uploadedAt: "",
    releaseNotes: "আইফোন (iOS) ব্যবহারকারীদের জন্য অফিসিয়াল অ্যাপ প্যাকেজ।",
  },
};

function parseAppPackages(raw: string | null | undefined): AppPackagesConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return {
        android: { ...DEFAULT_APP_PACKAGES.android, ...(parsed.android || {}) },
        ios: { ...DEFAULT_APP_PACKAGES.ios, ...(parsed.ios || {}) },
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function useAppPackages() {
  const [packages, setPackages] = useState<AppPackagesConfig>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_APP_PACKAGES_KEY);
      return parseAppPackages(cached) ?? DEFAULT_APP_PACKAGES;
    } catch {
      return DEFAULT_APP_PACKAGES;
    }
  });

  // Sync from Firestore /settings/app_packages_config
  useEffect(() => {
    const q = query(collection(db, "settings"), where("visible", "==", true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docSnap = snap.docs.find((d) => d.id === APP_PACKAGES_CONFIG_ID);
        if (docSnap) {
          const parsed = parseAppPackages(docSnap.data().logo_url);
          if (parsed) {
            setPackages(parsed);
            try {
              localStorage.setItem(LOCAL_APP_PACKAGES_KEY, JSON.stringify(parsed));
            } catch {
              // ignore
            }
          }
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  // Also check server disk manifest (/api/apps/status) on mount
  useEffect(() => {
    fetch("/api/apps/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.ok && data.apps) {
          setPackages((prev) => {
            const next = { ...prev };
            let changed = false;
            for (const plat of ["android", "ios"] as const) {
              const srv = data.apps[plat];
              if (srv && srv.fileName && !next[plat].fileName) {
                next[plat] = {
                  ...next[plat],
                  fileName: srv.fileName,
                  fileSize: srv.fileSize,
                  version: srv.version || next[plat].version,
                  downloadUrl: `/api/apps/download/${plat}`,
                  uploadedAt: srv.uploadedAt,
                };
                changed = true;
              }
            }
            return changed ? next : prev;
          });
        }
      })
      .catch(() => {});
  }, []);

  const saveAppPackagesConfig = useCallback(async (next: AppPackagesConfig) => {
    const serialized = JSON.stringify(next);
    try {
      localStorage.setItem(LOCAL_APP_PACKAGES_KEY, serialized);
    } catch {
      // ignore
    }
    setPackages(next);
    await upsertSettingDoc(APP_PACKAGES_CONFIG_ID, serialized);
  }, []);

  const uploadAppBinary = useCallback(
    async (
      platform: "android" | "ios",
      file: File,
      meta: { label: string; version: string; releaseNotes: string; visible: boolean }
    ) => {
      const base64DataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("ফাইল পড়া যায়নি"));
        reader.readAsDataURL(file);
      });

      const resp = await fetch("/api/apps/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          fileName: file.name,
          fileDataBase64: base64DataUrl,
          version: meta.version,
          mimeType: file.type || "application/octet-stream",
        }),
      });

      const json = await resp.json();
      if (!resp.ok || !json.ok) {
        throw new Error(json.error || "অ্যাপ আপলোড ব্যর্থ হয়েছে");
      }

      const nextPkg: AppPackageInfo = {
        platform,
        label: meta.label.trim() || DEFAULT_APP_PACKAGES[platform].label,
        version: meta.version.trim() || "2.0.0",
        fileName: file.name,
        fileSize: file.size,
        downloadUrl: json.downloadUrl || `/api/apps/download/${platform}`,
        // Keep embedded data URL in Firestore if compact (< 180KB) for cloud portability
        embeddedDataUrl: base64DataUrl.length <= 180000 ? base64DataUrl : undefined,
        visible: meta.visible,
        uploadedAt: new Date().toISOString(),
        releaseNotes: meta.releaseNotes.trim(),
      };

      const nextConfig: AppPackagesConfig = {
        ...packages,
        [platform]: nextPkg,
      };

      await saveAppPackagesConfig(nextConfig);
      return nextPkg;
    },
    [packages, saveAppPackagesConfig]
  );

  const updateAppMeta = useCallback(
    async (platform: "android" | "ios", patch: Partial<AppPackageInfo>) => {
      const nextConfig: AppPackagesConfig = {
        ...packages,
        [platform]: {
          ...packages[platform],
          ...patch,
        },
      };
      await saveAppPackagesConfig(nextConfig);
    },
    [packages, saveAppPackagesConfig]
  );

  return {
    packages,
    uploadAppBinary,
    updateAppMeta,
    saveAppPackagesConfig,
  };
}

// ============================================================================
// 6. Site Meta & Security Configuration Hook (/settings/site_meta_config)
// ============================================================================
export interface SiteMetaConfig {
  siteTitle: string;
  tagline: string;
  helplinePhone: string;
  emergencyNotice: string;
  aiChatEnabled: boolean;
  aiWelcomeMessage: string;
  adminPinCode: string;
  sessionTimeoutMinutes: number;
  strictSecurityMode: boolean;
}

export const DEFAULT_SITE_META: SiteMetaConfig = {
  siteTitle: "স্মার্ট নোয়াখালী",
  tagline: "নোয়াখালী জেলার সকল জরুরী সেবা ও তথ্যের ডিজিটাল প্ল্যাটফর্ম",
  helplinePhone: "01850999178",
  emergencyNotice: "জরুরী রক্ত বা যেকোনো তথ্যের জন্য নিচের লাইভ চ্যাট বা এআই সহকারী ব্যবহার করুন।",
  aiChatEnabled: true,
  aiWelcomeMessage:
    "আসসালামু আলাইকুম! আমি স্মার্ট নোয়াখালী এআই সহকারী। ডাক্তার, হাসপাতাল, অ্যাম্বুলেন্স, ফায়ার সার্ভিস, রক্তদাতা বা যেকোনো নাম্বার খুঁজতে আমাকে প্রশ্ন করুন!",
  adminPinCode: "",
  sessionTimeoutMinutes: 30,
  strictSecurityMode: true,
};

function parseSiteMeta(raw: string | null | undefined): SiteMetaConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return { ...DEFAULT_SITE_META, ...parsed };
    }
  } catch {
    // ignore
  }
  return null;
}

export function useSiteMetaConfig() {
  const [meta, setMeta] = useState<SiteMetaConfig>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_SITE_META_KEY);
      return parseSiteMeta(cached) ?? DEFAULT_SITE_META;
    } catch {
      return DEFAULT_SITE_META;
    }
  });

  useEffect(() => {
    const q = query(collection(db, "settings"), where("visible", "==", true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docSnap = snap.docs.find((d) => d.id === SITE_META_CONFIG_ID);
        if (docSnap) {
          const parsed = parseSiteMeta(docSnap.data().logo_url);
          if (parsed) {
            setMeta(parsed);
            try {
              localStorage.setItem(LOCAL_SITE_META_KEY, JSON.stringify(parsed));
            } catch {
              // ignore
            }
          }
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  const saveSiteMeta = useCallback(async (next: SiteMetaConfig) => {
    const serialized = JSON.stringify(next);
    try {
      localStorage.setItem(LOCAL_SITE_META_KEY, serialized);
    } catch {
      // ignore
    }
    setMeta(next);
    await upsertSettingDoc(SITE_META_CONFIG_ID, serialized);
  }, []);

  return {
    meta,
    saveSiteMeta,
  };
}