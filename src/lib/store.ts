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
import {
  auth,
  db,
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
import { clearBinaryFromIdb, saveBinaryToIdb, sanitizeAppFileName } from "@/lib/pwa";

export const defaultLogo: string = defaultLogoUrl;

export const SITE_CONFIG_ID = "site_config";
const DONATION_CONFIG_ID = "donation_config";
const CATEGORIES_CONFIG_ID = "categories_config";
const STAFF_PROFILES_CONFIG_ID = "staff_profiles_config";
const APP_PACKAGES_CONFIG_ID = "app_packages_config";
const SITE_META_CONFIG_ID = "site_meta_config";

export const LOCAL_LOGO_KEY = "sn_site_logo_v3";
const LOCAL_DONATION_KEY = "sn_donation_config_v1";
const LOCAL_CATEGORIES_KEY = "sn_categories_config_v1";
const LOCAL_STAFF_PROFILES_KEY = "sn_staff_profiles_v1";
const LOCAL_APP_PACKAGES_KEY = "sn_app_packages_v1";
const LOCAL_SITE_META_KEY = "sn_site_meta_v1";

export async function upsertSettingDoc(
  settingId: string,
  payloadValue: string,
  options?: { visible?: boolean; allowStaff?: boolean }
) {
  const cleanUrl =
    settingId === SITE_CONFIG_ID
      ? (typeof payloadValue === "string" ? payloadValue.trim() : "")
      : sanitizeString(payloadValue, 295000, "");
  const isVisible = options?.visible !== false;

  // 1. Immediately cache in localStorage
  try {
    if (settingId === SITE_CONFIG_ID) {
      if (cleanUrl.length < 500000) {
        localStorage.setItem(LOCAL_LOGO_KEY, cleanUrl);
      }
    } else if (settingId === DONATION_CONFIG_ID) {
      localStorage.setItem(LOCAL_DONATION_KEY, cleanUrl);
    } else if (settingId === CATEGORIES_CONFIG_ID) {
      localStorage.setItem(LOCAL_CATEGORIES_KEY, cleanUrl);
    } else if (settingId === STAFF_PROFILES_CONFIG_ID) {
      localStorage.setItem(LOCAL_STAFF_PROFILES_KEY, cleanUrl);
    } else if (settingId === APP_PACKAGES_CONFIG_ID) {
      localStorage.setItem(LOCAL_APP_PACKAGES_KEY, cleanUrl);
    } else if (settingId === SITE_META_CONFIG_ID) {
      localStorage.setItem(LOCAL_SITE_META_KEY, cleanUrl);
    }
  } catch {
    // ignore
  }

  // 2. Immediately persist to Server Content API (/api/content/upsert & /api/content/sync)
  if (!settingId.startsWith("app_pkg_chunk_")) {
    fetch("/api/content/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collection: "settings",
        id: settingId,
        doc: {
          id: settingId,
          key: settingId,
          logo_url: cleanUrl,
          visible: isVisible,
          updated_at: new Date().toISOString(),
        },
      }),
    }).catch(() => {});

    fetch("/api/content/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [settingId]: cleanUrl }),
    }).catch(() => {});
  }

  // 3. Persist to Firebase Firestore
  const path = `settings/${settingId}`;
  const ref = doc(db, "settings", settingId);
  try {
    await setDoc(
      ref,
      {
        key: settingId,
        logo_url: cleanUrl,
        visible: isVisible,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.error(`Firestore settings sync failed for ${path}:`, e);
    throw e;
  }
}

// ============================================================================
// 1. Site Logo Hook (/settings/site_config)
// ============================================================================
export function useLogo() {
  const [customLogo, setCustomLogo] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LOCAL_LOGO_KEY) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    // Pull from Server API immediately on mount
    fetch(`/api/content?collection=settings&id=${SITE_CONFIG_ID}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.item?.logo_url && typeof d.item.logo_url === "string") {
          setCustomLogo(d.item.logo_url);
          try {
            localStorage.setItem(LOCAL_LOGO_KEY, d.item.logo_url);
          } catch {}
        }
      })
      .catch(() => {});

    // Listen to realtime Firestore updates
    const q = query(collection(db, "settings"), where("visible", "==", true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const configDoc = snap.docs.find((d) => d.id === SITE_CONFIG_ID);
        if (configDoc) {
          const url = configDoc.data().logo_url;
          if (typeof url === "string" && url.length > 0) {
            setCustomLogo(url);
            try {
              localStorage.setItem(LOCAL_LOGO_KEY, url);
            } catch {}
          } else {
            setCustomLogo(null);
          }
        }
      },
      () => {
        // Keep current or cached logo on snapshot error
      }
    );
    return () => unsub();
  }, []);

  const setLogo = useCallback(async (nextLogo: string | null) => {
    const val = nextLogo ?? "";
    try {
      if (val.length < 500000) {
        localStorage.setItem(LOCAL_LOGO_KEY, val);
      }
    } catch {}
    setCustomLogo(nextLogo);
    await upsertSettingDoc(SITE_CONFIG_ID, val);
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
    // Pull from Server Content API immediately on mount
    fetch(`/api/content?collection=settings&id=${DONATION_CONFIG_ID}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.item?.logo_url) {
          const parsed = parseDonationConfig(d.item.logo_url);
          if (parsed) {
            setConfig(parsed);
            try {
              localStorage.setItem(LOCAL_DONATION_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      })
      .catch(() => {});

    // Listen to realtime Firestore updates
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

const DEFAULT_CATEGORY_FALLBACKS: Record<string, { iconName: string; tint: string; description: string }> = {
  doctor: { iconName: "Stethoscope", tint: "from-teal-500/15 to-teal-700/10", description: "চিকিৎসক ও বিশেষজ্ঞ" },
  hospital: { iconName: "Building2", tint: "from-sky-500/15 to-sky-700/10", description: "হাসপাতাল ও ক্লিনিক" },
  ambulance: { iconName: "Truck", tint: "from-red-500/15 to-red-700/10", description: "জরুরী অ্যাম্বুলেন্স" },
  "blood-donor": { iconName: "Droplet", tint: "from-rose-500/20 to-rose-700/10", description: "স্বেচ্ছা রক্তদাতাদের তালিকা" },
  police: { iconName: "Shield", tint: "from-blue-500/15 to-blue-700/10", description: "থানা ও পুলিশ ফাঁড়ি" },
  "fire-service": { iconName: "Flame", tint: "from-orange-500/15 to-red-600/10", description: "অগ্নিনির্বাপন ও উদ্ধার" },
  fire: { iconName: "Flame", tint: "from-orange-500/15 to-red-600/10", description: "অগ্নিনির্বাপন ও উদ্ধার" },
  electricity: { iconName: "Zap", tint: "from-yellow-500/15 to-yellow-700/10", description: "বিদ্যুৎ অভিযোগ ও সেবা" },
  electrician: { iconName: "Zap", tint: "from-yellow-500/15 to-yellow-700/10", description: "বৈদ্যুতিক মিস্ত্রি" },
  journalist: { iconName: "Newspaper", tint: "from-slate-500/15 to-slate-700/10", description: "স্থানীয় সংবাদকর্মী ও প্রেস" },
  lawyer: { iconName: "Scale", tint: "from-indigo-500/15 to-indigo-700/10", description: "আইনজীবী ও নোটারি" },
  education: { iconName: "GraduationCap", tint: "from-emerald-500/15 to-emerald-700/10", description: "শিক্ষা প্রতিষ্ঠান" },
  school: { iconName: "GraduationCap", tint: "from-indigo-500/15 to-indigo-700/10", description: "শিক্ষা প্রতিষ্ঠান" },
  hotel: { iconName: "Hotel", tint: "from-amber-500/15 to-amber-700/10", description: "হোটেল ও রেস্টুরেন্ট" },
  "tourist-spot": { iconName: "Camera", tint: "from-pink-500/15 to-pink-700/10", description: "দর্শনীয় স্থান ও পার্ক" },
  courier: { iconName: "Package", tint: "from-violet-500/15 to-violet-700/10", description: "কুরিয়ার ও পার্সেল" },
  bus: { iconName: "Bus", tint: "from-cyan-500/15 to-cyan-700/10", description: "বাস সার্ভিস ও কাউন্টার" },
  train: { iconName: "Train", tint: "from-sky-500/15 to-sky-700/10", description: "ট্রেন সময়সূচী ও স্টেশন" },
  "rent-a-car": { iconName: "Car", tint: "from-stone-500/15 to-stone-700/10", description: "রেন্ট-এ-কার ও মাইক্রোবাস" },
  garage: { iconName: "Wrench", tint: "from-zinc-500/15 to-zinc-700/10", description: "গাড়ি মেরামত" },
  gas: { iconName: "Fuel", tint: "from-orange-500/15 to-red-600/10", description: "গ্যাস ও এলপিজি সিলিন্ডার" },
  bank: { iconName: "Landmark", tint: "from-emerald-600/15 to-teal-700/10", description: "ব্যাংক ও এটিএম বুথ" },
  service: { iconName: "Layers", tint: "from-teal-500/15 to-emerald-700/10", description: "অন্যান্য জরুরি সেবা" },
  janapratinidhi: { iconName: "Users", tint: "from-emerald-500/15 to-emerald-700/10", description: "ইউনিয়ন ও পৌর জনপ্রতিনিধি" },
  helpline: { iconName: "PhoneCall", tint: "from-emerald-600/20 to-emerald-800/10", description: "জরুরী হেল্পলাইন" },
  "electricity-office": { iconName: "Building2", tint: "from-sky-500/15 to-sky-700/10", description: "পল্লী বিদ্যুৎ সমিতি" },
  mason: { iconName: "HardHat", tint: "from-stone-500/15 to-stone-700/10", description: "নির্মাণ মিস্ত্রি" },
  disabled: { iconName: "Accessibility", tint: "from-violet-500/15 to-violet-700/10", description: "প্রতিবন্ধী সেবা" },
  expatriate: { iconName: "Plane", tint: "from-cyan-500/15 to-cyan-700/10", description: "প্রবাসী তথ্য" },
  "service-org": { iconName: "HeartHandshake", tint: "from-pink-500/15 to-pink-700/10", description: "সেবামূলক সংগঠন" },
  "board-result": { iconName: "FileText", tint: "from-emerald-500/15 to-teal-700/10", description: "পরীক্ষার ফলাফল" },
  "special-persons": { iconName: "Star", tint: "from-amber-400/20 to-amber-600/10", description: "বিশেষ ব্যাক্তিবর্গ" },
  donation: { iconName: "HandCoins", tint: "from-emerald-500/20 to-amber-500/10", description: "অনুদান দিন ও তালিকা দেখুন" },
  "submit-info": { iconName: "Send", tint: "from-emerald-500/20 to-emerald-700/10", description: "নতুন তথ্য জমা দিন" },
  about: { iconName: "Info", tint: "from-emerald-600/15 to-emerald-800/10", description: "আমাদের সম্পর্কে" },
};

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
        .map((item, idx) => {
          const slug = String(item.slug);
          const fallback = DEFAULT_CATEGORY_FALLBACKS[slug] || defaultCategories.find((d) => d.slug === slug);
          const rawIcon = String(item.iconName || item.icon || "");
          const iconName = (rawIcon && rawIcon !== "Users" && CATEGORY_ICONS[rawIcon])
            ? rawIcon
            : (fallback && CATEGORY_ICONS[fallback.iconName] ? fallback.iconName : (rawIcon || "Users"));
          const rawTint = String(item.tint || "");
          const tint = (rawTint && rawTint !== "from-emerald-500/15 to-emerald-700/10")
            ? rawTint
            : (fallback?.tint || "from-emerald-500/15 to-emerald-700/10");
          const description = String(item.description || fallback?.description || "");

          return {
            slug,
            bn: String(item.bn || item.slug),
            en: String(item.en || item.slug),
            iconName,
            tint,
            description,
            visible: item.visible !== false,
            sort_order: typeof item.sort_order === "number" ? item.sort_order : idx + 1,
          };
        });
    }
  } catch {
    // ignore
  }
  return null;
}

function toResolvedCategory(item: CategoryConfigItem): Category {
  const fallback = DEFAULT_CATEGORY_FALLBACKS[item.slug];
  const iconKey = (item.iconName && item.iconName !== "Users" && CATEGORY_ICONS[item.iconName])
    ? item.iconName
    : (fallback?.iconName && CATEGORY_ICONS[fallback.iconName] ? fallback.iconName : (item.iconName || "Users"));
  const IconComp = CATEGORY_ICONS[iconKey] || CATEGORY_ICONS.Users;
  const tint = (item.tint && item.tint !== "from-emerald-500/15 to-emerald-700/10")
    ? item.tint
    : (fallback?.tint || item.tint || "from-emerald-500/15 to-emerald-700/10");
  const description = item.description || fallback?.description || "";

  return {
    slug: item.slug,
    bn: item.bn,
    en: item.en,
    icon: IconComp,
    iconName: iconKey,
    tint,
    description,
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
    // Pull from Server Content API immediately on mount
    fetch(`/api/content?collection=settings&id=${CATEGORIES_CONFIG_ID}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.item?.logo_url) {
          const parsed = parseCategoryConfig(d.item.logo_url);
          if (parsed) {
            setItems(parsed);
            try {
              localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      })
      .catch(() => {});

    // Listen to realtime Firestore updates
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
  chunkCount?: number;
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
    label: "স্মার্ট নোয়াখালী Android অ্যাপ (.APK)",
    version: "2.0.0",
    fileName: "Smart-Noakhali-Android.apk",
    fileSize: 15925248,
    downloadUrl: "/api/apps/download/android",
    visible: true,
    uploadedAt: "2026-10-14T07:42:00.000Z",
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
    releaseNotes: "আইফোন (iOS) ব্যবহারকারীদের জন্য অফিসিয়াল ওয়েব অ্যাপ।",
  },
};

function isLegacyBundledPackage(rawEntry: Partial<AppPackageInfo> | undefined): boolean {
  if (!rawEntry) return false;
  return false;
}

function normalizePackageEntry(
  rawEntry: Partial<AppPackageInfo> | undefined,
  fallback: AppPackageInfo
): AppPackageInfo {
  if (!rawEntry) return fallback;
  const merged: AppPackageInfo = { ...fallback, ...rawEntry };
  merged.fileName = merged.fileName ? sanitizeAppFileName(merged.fileName, fallback.platform) : "";
  if (!merged.fileSize || merged.fileSize <= 0) {
    merged.fileSize = 0;
    merged.fileName = "";
    merged.downloadUrl = "";
  }
  return merged;
}

function parseAppPackages(raw: string | null | undefined): AppPackagesConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return {
        android: normalizePackageEntry(parsed.android, DEFAULT_APP_PACKAGES.android),
        ios: normalizePackageEntry(parsed.ios, DEFAULT_APP_PACKAGES.ios),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

function arrayBufferSliceToBase64(buffer: ArrayBuffer, start: number, end: number): string {
  const bytes = new Uint8Array(buffer.slice(start, end));
  const chunkSize = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    parts.push(String.fromCharCode.apply(null, Array.from(sub)));
  }
  return btoa(parts.join(""));
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
            setPackages((prev) => {
              const merged: AppPackagesConfig = {
                android: {
                  ...parsed.android,
                  fileSize: parsed.android.fileSize || prev.android.fileSize,
                  fileName: parsed.android.fileName || prev.android.fileName,
                  downloadUrl: parsed.android.downloadUrl || prev.android.downloadUrl,
                },
                ios: {
                  ...parsed.ios,
                  fileSize: parsed.ios.fileSize || prev.ios.fileSize,
                  fileName: parsed.ios.fileName || prev.ios.fileName,
                  downloadUrl: parsed.ios.downloadUrl || prev.ios.downloadUrl,
                },
              };
              try {
                localStorage.setItem(LOCAL_APP_PACKAGES_KEY, JSON.stringify(merged));
              } catch {
                // ignore
              }
              return merged;
            });
          }
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  // Poll server disk manifest (/api/apps/status) and server content mirror so customers always get exact uploaded file & size
  useEffect(() => {
    let active = true;
    async function syncFromServer() {
      try {
        const [statusResp, contentResp] = await Promise.all([
          fetch("/api/apps/status").catch(() => null),
          fetch(`/api/content?collection=settings&id=${APP_PACKAGES_CONFIG_ID}`).catch(() => null),
        ]);

        let contentParsed: AppPackagesConfig | null = null;
        if (
          contentResp &&
          contentResp.ok &&
          (contentResp.headers.get("content-type") || "").includes("application/json")
        ) {
          const cJson = await contentResp.json().catch(() => null);
          if (cJson?.item?.logo_url) {
            contentParsed = parseAppPackages(cJson.item.logo_url);
          }
        }

        let serverApps: Record<string, any> | null = null;
        if (
          statusResp &&
          statusResp.ok &&
          (statusResp.headers.get("content-type") || "").includes("application/json")
        ) {
          const sJson = await statusResp.json().catch(() => null);
          if (sJson?.ok && sJson.apps) {
            serverApps = sJson.apps;
          }
        }

        if (!active) return;

        setPackages((prev) => {
          const next: AppPackagesConfig = {
            android: contentParsed?.android ? { ...prev.android, ...contentParsed.android } : { ...prev.android },
            ios: contentParsed?.ios ? { ...prev.ios, ...contentParsed.ios } : { ...prev.ios },
          };
          let changed = Boolean(contentParsed);

          if (serverApps) {
            for (const plat of ["android", "ios"] as const) {
              const srv = serverApps[plat];
              if (srv && srv.fileName && srv.fileSize > 0 && !isLegacyBundledPackage(srv)) {
                const cleanName = sanitizeAppFileName(srv.fileName, plat);
                if (
                  next[plat].fileSize !== srv.fileSize ||
                  next[plat].fileName !== cleanName ||
                  next[plat].downloadUrl !== `/api/apps/download/${plat}`
                ) {
                  next[plat] = {
                    ...next[plat],
                    fileName: cleanName,
                    fileSize: Number(srv.fileSize),
                    version: srv.version || next[plat].version || "2.0.0",
                    label: srv.label || next[plat].label,
                    releaseNotes: srv.releaseNotes || next[plat].releaseNotes,
                    visible: srv.visible ?? next[plat].visible ?? true,
                    downloadUrl: `/api/apps/download/${plat}`,
                    uploadedAt: srv.uploadedAt || next[plat].uploadedAt,
                  };
                  changed = true;
                }
              }
            }
          }

          if (changed) {
            try {
              localStorage.setItem(LOCAL_APP_PACKAGES_KEY, JSON.stringify(next));
            } catch {
              // ignore
            }
            return next;
          }
          return prev;
        });
      } catch {
        // ignore
      }
    }

    void syncFromServer();
    const timer = setInterval(syncFromServer, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
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
      meta: { label: string; version: string; releaseNotes: string; visible: boolean },
      onProgress?: (percent: number, stage: string) => void
    ) => {
      if (!file || file.size <= 0) {
        throw new Error("সঠিক অ্যাপ ফাইল নির্বাচন করুন");
      }
      onProgress?.(5, `ফাইল পড়া হচ্ছে (${(file.size / (1024 * 1024)).toFixed(2)} MB)...`);
      const cleanFileName =
        sanitizeAppFileName(file.name, platform) ||
        (platform === "android" ? "app-release.apk" : "app-release.ipa");
      const exactFileSize = file.size;
      const mimeType =
        platform === "android"
          ? "application/vnd.android.package-archive"
          : file.type || "application/octet-stream";

      const arrayBuf = await file.arrayBuffer();
      if (arrayBuf.byteLength !== exactFileSize) {
        throw new Error("ফাইল সাইজ যাচাই ব্যর্থ হয়েছে, আবার চেষ্টা করুন");
      }

      // 1. Save full exact binary in local IndexedDB for instant local download
      await saveBinaryToIdb(platform, cleanFileName, exactFileSize, arrayBuf);

      // 2. Upload binary in 2MB chunks to server (/api/apps/upload-chunk + /api/apps/finalize-upload)
      // so apps of ANY size (e.g. 5MB, 30MB, 100MB+) upload reliably without payload truncation
      let serverDownloadUrl = `/api/apps/download/${platform}`;
      const SERVER_CHUNK_BYTES = 2 * 1024 * 1024; // 2 MB raw binary per chunk
      const totalServerChunks = Math.max(1, Math.ceil(exactFileSize / SERVER_CHUNK_BYTES));
      let chunkUploadSucceeded = false;

      try {
        for (let idx = 0; idx < totalServerChunks; idx++) {
          const start = idx * SERVER_CHUNK_BYTES;
          const end = Math.min(exactFileSize, start + SERVER_CHUNK_BYTES);
          const chunkB64 = arrayBufferSliceToBase64(arrayBuf, start, end);
          const pct = 10 + Math.round(((idx + 1) / totalServerChunks) * 65);
          onProgress?.(
            pct,
            `সার্ভারে আপলোড হচ্ছে (${idx + 1}/${totalServerChunks} অংশ — ${(end / (1024 * 1024)).toFixed(2)} / ${(exactFileSize / (1024 * 1024)).toFixed(2)} MB)...`
          );

          const cResp = await fetch("/api/apps/upload-chunk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              platform,
              chunkIndex: idx,
              totalChunks: totalServerChunks,
              chunkBase64: chunkB64,
            }),
          });
          if (!cResp.ok) {
            throw new Error(`Chunk ${idx + 1} upload failed`);
          }
        }

        onProgress?.(80, "ফাইল সাইজ ও বাইনারি যাচাই করা হচ্ছে...");
        const finResp = await fetch("/api/apps/finalize-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform,
            fileName: cleanFileName,
            expectedSize: exactFileSize,
            version: meta.version.trim() || "2.0.0",
            label: meta.label.trim(),
            releaseNotes: meta.releaseNotes.trim(),
            visible: meta.visible,
            mimeType,
          }),
        });
        if (finResp.ok) {
          const finJson = await finResp.json().catch(() => null);
          if (finJson?.ok && finJson.meta?.fileSize === exactFileSize) {
            chunkUploadSucceeded = true;
            if (finJson.downloadUrl) {
              serverDownloadUrl = finJson.downloadUrl;
            }
          }
        }
      } catch {
        // Fallback to single-request upload if chunk endpoint wasn't reachable
      }

      if (!chunkUploadSucceeded) {
        onProgress?.(50, "সার্ভারে সরাসরি ফাইল আপলোড হচ্ছে...");
        const fullB64 = arrayBufferSliceToBase64(arrayBuf, 0, exactFileSize);
        const dataUrl = `data:${mimeType};base64,${fullB64}`;
        try {
          const resp = await fetch("/api/apps/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              platform,
              fileName: cleanFileName,
              fileDataBase64: dataUrl,
              expectedSize: exactFileSize,
              version: meta.version.trim() || "2.0.0",
              label: meta.label.trim(),
              releaseNotes: meta.releaseNotes.trim(),
              visible: meta.visible,
              mimeType,
            }),
          });
          if (resp.ok) {
            const json = await resp.json().catch(() => null);
            if (json?.downloadUrl) {
              serverDownloadUrl = json.downloadUrl;
            }
          }
        } catch {
          // continue
        }
      }

      // 3. For files <= 10 MB, also mirror chunks into settings store for redundant cloud backup
      let chunkCount = 0;
      let embeddedDataUrl: string | undefined = undefined;
      if (exactFileSize <= 10 * 1024 * 1024) {
        try {
          const fullB64 = arrayBufferSliceToBase64(arrayBuf, 0, exactFileSize);
          const dataUrl = `data:${mimeType};base64,${fullB64}`;
          if (dataUrl.length <= 180000) {
            embeddedDataUrl = dataUrl;
          } else {
            const CHUNK_LEN = 240000;
            const totalCloudChunks = Math.ceil(dataUrl.length / CHUNK_LEN);
            if (totalCloudChunks <= 60) {
              chunkCount = totalCloudChunks;
              for (let idx = 0; idx < totalCloudChunks; idx++) {
                const slice = dataUrl.slice(idx * CHUNK_LEN, (idx + 1) * CHUNK_LEN);
                const pct = 82 + Math.round(((idx + 1) / totalCloudChunks) * 12);
                onProgress?.(
                  pct,
                  `ক্লাউড ব্যাকআপ সিঙ্ক হচ্ছে (${idx + 1}/${totalCloudChunks})...`
                );
                await upsertSettingDoc(`app_pkg_chunk_${platform}_${idx}`, slice, {
                  visible: true,
                });
              }
            }
          }
        } catch {
          // Server binary is already saved and verified
        }
      }

      onProgress?.(96, "কনফিগারেশন সংরক্ষণ হচ্ছে...");

      const nextPkg: AppPackageInfo = {
        platform,
        label: meta.label.trim() || DEFAULT_APP_PACKAGES[platform].label,
        version: meta.version.trim() || "2.0.0",
        fileName: cleanFileName,
        fileSize: exactFileSize,
        downloadUrl: serverDownloadUrl,
        embeddedDataUrl,
        chunkCount: chunkCount > 0 ? chunkCount : undefined,
        visible: meta.visible,
        uploadedAt: new Date().toISOString(),
        releaseNotes: meta.releaseNotes.trim(),
      };

      const nextConfig: AppPackagesConfig = {
        ...packages,
        [platform]: nextPkg,
      };

      await saveAppPackagesConfig(nextConfig);
      onProgress?.(100, "হুবহু সাইজে অ্যাপ আপলোড সম্পন্ন!");
      return nextPkg;
    },
    [packages, saveAppPackagesConfig]
  );

  const removeAppBinary = useCallback(
    async (platform: "android" | "ios") => {
      await clearBinaryFromIdb(platform);
      try {
        await fetch("/api/apps/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform }),
        });
      } catch {
        // ignore
      }
      const nextConfig: AppPackagesConfig = {
        ...packages,
        [platform]: {
          ...DEFAULT_APP_PACKAGES[platform],
          label: packages[platform]?.label || DEFAULT_APP_PACKAGES[platform].label,
          version: packages[platform]?.version || DEFAULT_APP_PACKAGES[platform].version,
          releaseNotes:
            packages[platform]?.releaseNotes || DEFAULT_APP_PACKAGES[platform].releaseNotes,
          visible: packages[platform]?.visible ?? true,
        },
      };
      await saveAppPackagesConfig(nextConfig);
    },
    [packages, saveAppPackagesConfig]
  );

  const updateAppMeta = useCallback(
    async (platform: "android" | "ios", patch: Partial<AppPackageInfo>) => {
      try {
        await fetch("/api/apps/update-meta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform,
            label: patch.label,
            version: patch.version,
            releaseNotes: patch.releaseNotes,
            visible: patch.visible,
          }),
        });
      } catch {
        // ignore
      }
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
    removeAppBinary,
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
  liveChatEnabled: boolean;
  liveChatSupportStatus: string;
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
  liveChatEnabled: true,
  liveChatSupportStatus: "অনলাইন (সক্রিয় সাপোর্ট)",
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