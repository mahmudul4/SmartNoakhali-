import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
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
  DIVISIONS,
  CATEGORY_ICONS,
  type Category,
  type Division,
} from "@/data/categories";
import defaultLogoUrl from "@/assets/logo.png";
import { clearBinaryFromIdb, saveBinaryToIdb, sanitizeAppFileName } from "@/lib/pwa";
import { compressDataUrlToWebP } from "@/lib/imageProcessor";
import { isValidPersistedIconUrl } from "@/lib/r2Storage";
import {
  normalizeResponsiveLayouts,
  type HeroDeviceBreakpoint,
  type HeroEditableElementId,
  type HeroElementPosition,
  type HeroBreakpointLayout,
  type HeroResponsiveLayouts,
} from "@/lib/heroPositioning";

export type {
  HeroDeviceBreakpoint,
  HeroEditableElementId,
  HeroElementPosition,
  HeroBreakpointLayout,
  HeroResponsiveLayouts,
};

export const defaultLogo: string = defaultLogoUrl;

export const SITE_CONFIG_ID = "site_config";
export const DIVISIONS_CONFIG_ID = "divisions_config";
export const DONATION_CONFIG_ID = "donation_config";
export const CATEGORIES_CONFIG_ID = "categories_config";
export const STAFF_PROFILES_CONFIG_ID = "staff_profiles_config";
export const APP_PACKAGES_CONFIG_ID = "app_packages_config";
export const SITE_META_CONFIG_ID = "site_meta_config";
export const SERVICES_CONFIG_ID = "services_config";
export const HERO_BANNER_CONFIG_ID = "hero_banner_config";
export const HOMEPAGE_CONFIG_ID = "homepage_config";
export const WEBSITE_CONTENT_CONFIG_ID = "website_content_config";
export const MEDIA_LIBRARY_CONFIG_ID = "media_library_config";
export const AI_CHAT_CONFIG_ID = "ai_chat_config";

export const LOCAL_LOGO_KEY = "sn_site_logo_v3";
export const LOCAL_DIVISIONS_KEY = "sn_divisions_config_v1";
export const LOCAL_DONATION_KEY = "sn_donation_config_v1";
export const LOCAL_CATEGORIES_KEY = "sn_categories_config_v1";
export const LOCAL_STAFF_PROFILES_KEY = "sn_staff_profiles_v1";
export const LOCAL_APP_PACKAGES_KEY = "sn_app_packages_v1";
export const LOCAL_SITE_META_KEY = "sn_site_meta_v1";
export const LOCAL_SERVICES_KEY = "sn_services_config_v1";
export const LOCAL_HERO_BANNER_KEY = "sn_hero_banner_config_v1";
export const LOCAL_HOMEPAGE_KEY = "sn_homepage_config_v1";
export const LOCAL_WEBSITE_CONTENT_KEY = "sn_website_content_config_v1";
export const LOCAL_MEDIA_LIBRARY_KEY = "sn_media_library_v1";
export const LOCAL_AI_CHAT_CONFIG_KEY = "sn_ai_chat_config_v1";

/**
 * Strips any undefined fields recursively so Firestore setDoc/updateDoc never fails.
 * Preserves FieldValues (serverTimestamp, arrayUnion, etc.), Dates, Arrays, and primitive types.
 */
export function sanitizeFirestorePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  if (!obj || typeof obj !== "object") return {};
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date) &&
      typeof (value as any).toMillis !== "function" &&
      (value.constructor?.name === "Object" || !value.constructor)
    ) {
      cleaned[key] = sanitizeFirestorePayload(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export async function upsertSettingDoc(
  settingId: string,
  payloadValue: string,
  options?: { visible?: boolean; allowStaff?: boolean }
) {
  const trimmedRaw = typeof payloadValue === "string" ? payloadValue.trim() : "";
  if (
    (settingId === HERO_BANNER_CONFIG_ID || settingId.startsWith("hero_img_")) &&
    trimmedRaw.length > 295000
  ) {
    throw new Error(
      "হিরো ব্যানারের ডাটা সাইজ ২৯৫ KB সীমা অতিক্রম করেছে। অনুগ্রহ করে ছবি পুনরায় অপ্টিমাইজ করে চেষ্টা করুন।"
    );
  }
  // Never exceed 295,000 bytes to ensure Firestore 1MB document limit is never exceeded
  const cleanUrl = sanitizeString(payloadValue, 295000, "");
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
    } else if (settingId === SERVICES_CONFIG_ID) {
      localStorage.setItem(LOCAL_SERVICES_KEY, cleanUrl);
    } else if (settingId === HERO_BANNER_CONFIG_ID) {
      localStorage.setItem(LOCAL_HERO_BANNER_KEY, cleanUrl);
    } else if (settingId === DIVISIONS_CONFIG_ID) {
      localStorage.setItem(LOCAL_DIVISIONS_KEY, cleanUrl);
    } else if (settingId === HOMEPAGE_CONFIG_ID) {
      localStorage.setItem(LOCAL_HOMEPAGE_KEY, cleanUrl);
    } else if (settingId === WEBSITE_CONTENT_CONFIG_ID) {
      localStorage.setItem(LOCAL_WEBSITE_CONTENT_KEY, cleanUrl);
    } else if (settingId === MEDIA_LIBRARY_CONFIG_ID) {
      localStorage.setItem(LOCAL_MEDIA_LIBRARY_KEY, cleanUrl);
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
function isSafeLogoUrl(url: unknown): url is string {
  if (typeof url !== "string" || !url.trim()) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith("data:") && trimmed.length > 250000) return false;
  return true;
}

export function useLogo() {
  const [customLogo, setCustomLogo] = useState<string | null>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_LOGO_KEY);
      return isSafeLogoUrl(cached) ? cached : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    // 1. Direct document read from Firestore immediately on mount
    getDoc(doc(db, "settings", SITE_CONFIG_ID))
      .then((snap) => {
        if (snap.exists()) {
          const url = snap.data()?.logo_url;
          if (isSafeLogoUrl(url)) {
            setCustomLogo(url);
            try {
              localStorage.setItem(LOCAL_LOGO_KEY, url);
            } catch {}
          }
        }
      })
      .catch(() => {});

    // 2. Real-time direct doc listener
    const unsubDirect = onSnapshot(
      doc(db, "settings", SITE_CONFIG_ID),
      (snap) => {
        if (snap.exists()) {
          const url = snap.data()?.logo_url;
          if (isSafeLogoUrl(url)) {
            setCustomLogo(url);
            try {
              localStorage.setItem(LOCAL_LOGO_KEY, url);
            } catch {}
          } else {
            setCustomLogo(null);
          }
        }
      },
      () => {}
    );

    return () => unsubDirect();
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
export type DonationAccountType = "personal" | "merchant" | "bank" | "gateway";
export type DonationMethodType = "bkash" | "nagad" | "rocket" | "upay" | "bank" | "card";

export interface DonationNumberItem {
  id: string;
  method: DonationMethodType;
  type: DonationAccountType;
  label: string;
  number: string;
  active: boolean;
  tone: string;
  bankName?: string;
  accountName?: string;
  branchName?: string;
  routingNumber?: string;
  instructions?: string;
  displayOrder?: number;
  setupStatus?: "connected" | "setup_required" | "disabled";
  isGatewayConfigured?: boolean;
}

export interface DonationConfig {
  subtitle: string;
  numbers: DonationNumberItem[];
}

export const DEFAULT_DONATION_CONFIG: DonationConfig = {
  subtitle: "আপনার সহযোগিতাই আমাদের শক্তি — মানবতার সেবায় এগিয়ে আসুন",
  numbers: [
    {
      id: "bkash_personal",
      method: "bkash",
      type: "personal",
      label: "bKash Personal (Send Money)",
      number: "01850999178",
      active: true,
      tone: "from-pink-500 to-rose-600",
      instructions: "বিকাশ অ্যাপ বা *247# ডায়াল করে Send Money অপশন ব্যবহার করুন এবং প্রাপ্ত Transaction ID (TrxID) নিচে দিন।",
      setupStatus: "connected",
      displayOrder: 1,
    },
    {
      id: "bkash_merchant",
      method: "bkash",
      type: "merchant",
      label: "bKash Merchant (Payment)",
      number: "01850999178",
      active: false,
      tone: "from-pink-600 to-rose-700",
      instructions: "বিকাশ অ্যাপ থেকে Make Payment অপশনে গিয়ে মার্চেন্ট নম্বরে পেমেন্ট করুন।",
      setupStatus: "setup_required",
      displayOrder: 2,
    },
    {
      id: "nagad_personal",
      method: "nagad",
      type: "personal",
      label: "Nagad Personal (Send Money)",
      number: "01850999178",
      active: true,
      tone: "from-orange-500 to-red-600",
      instructions: "নগদ অ্যাপ বা *167# ডায়াল করে Send Money করুন এবং প্রাপ্ত Transaction ID নিচে লিখুন।",
      setupStatus: "connected",
      displayOrder: 3,
    },
    {
      id: "nagad_merchant",
      method: "nagad",
      type: "merchant",
      label: "Nagad Merchant (Payment)",
      number: "01850999178",
      active: false,
      tone: "from-orange-600 to-amber-700",
      instructions: "নগদ অ্যাপ থেকে মার্চেন্ট পেমেন্ট অপশন ব্যবহার করুন।",
      setupStatus: "setup_required",
      displayOrder: 4,
    },
    {
      id: "rocket_personal",
      method: "rocket",
      type: "personal",
      label: "Rocket Personal (Send Money)",
      number: "01850999178",
      active: true,
      tone: "from-purple-600 to-indigo-700",
      instructions: "রকেট অ্যাপ বা *322# থেকে Send Money করুন এবং Transaction ID সংগ্রহ করুন।",
      setupStatus: "connected",
      displayOrder: 5,
    },
    {
      id: "rocket_merchant",
      method: "rocket",
      type: "merchant",
      label: "Rocket Merchant (Payment)",
      number: "01850999178",
      active: false,
      tone: "from-purple-700 to-violet-800",
      instructions: "রকেট মার্চেন্ট পেমেন্ট করুন।",
      setupStatus: "setup_required",
      displayOrder: 6,
    },
    {
      id: "upay_personal",
      method: "upay",
      type: "personal",
      label: "Upay Personal (Send Money)",
      number: "01850999178",
      active: true,
      tone: "from-sky-500 to-blue-700",
      instructions: "উপায় অ্যাপ বা *268# থেকে Send Money করুন।",
      setupStatus: "connected",
      displayOrder: 7,
    },
    {
      id: "upay_merchant",
      method: "upay",
      type: "merchant",
      label: "Upay Merchant (Payment)",
      number: "01850999178",
      active: false,
      tone: "from-sky-600 to-indigo-800",
      instructions: "উপায় মার্চেন্ট পেমেন্ট অপশন ব্যবহার করুন।",
      setupStatus: "setup_required",
      displayOrder: 8,
    },
    {
      id: "bank_transfer",
      method: "bank",
      type: "bank",
      label: "ব্যাংক ট্রান্সফার (Bank Transfer)",
      number: "2050123456789010",
      bankName: "ইসলামী ব্যাংক বাংলাদেশ পিএলসি (IBBL)",
      accountName: "স্মার্ট নোয়াখালী ওয়েলফেয়ার ট্রাস্ট",
      branchName: "মাইজদী কোর্ট শাখা, নোয়াখালী",
      routingNumber: "125551234",
      active: true,
      tone: "from-emerald-600 to-teal-800",
      instructions: "যেকোনো ব্যাংক একাউন্ট বা ইন্টারনেট ব্যাংকিং (NPSB/BEFTN/RTGS) এর মাধ্যমে ডিপোজিট করুন এবং ডিপোজিট স্লিপ বা ট্রানজেকশন রেফারেন্স জমা দিন।",
      setupStatus: "connected",
      displayOrder: 9,
    },
    {
      id: "debit_card",
      method: "card",
      type: "gateway",
      label: "ডেবিট কার্ড (Visa / Mastercard)",
      number: "card-gateway",
      isGatewayConfigured: false,
      active: true,
      tone: "from-blue-600 to-indigo-800",
      instructions: "অনুমোদিত গেটওয়ে দিয়ে নিরাপদ ডেবিট কার্ড পেমেন্ট।",
      setupStatus: "setup_required",
      displayOrder: 10,
    },
    {
      id: "credit_card",
      method: "card",
      type: "gateway",
      label: "ক্রেডিট কার্ড (Visa / Mastercard / Amex)",
      number: "card-gateway",
      isGatewayConfigured: false,
      active: true,
      tone: "from-indigo-600 to-violet-800",
      instructions: "অনুমোদিত গেটওয়ে দিয়ে নিরাপদ ক্রেডিট কার্ড পেমেন্ট।",
      setupStatus: "setup_required",
      displayOrder: 11,
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
        numbers: parsed.numbers.map((n, idx) => {
          const validMethods: DonationMethodType[] = ["bkash", "nagad", "rocket", "upay", "bank", "card"];
          const method = validMethods.includes(n.method as DonationMethodType)
            ? (n.method as DonationMethodType)
            : "bkash";
          const validTypes: DonationAccountType[] = ["personal", "merchant", "bank", "gateway"];
          const type = validTypes.includes(n.type as DonationAccountType)
            ? (n.type as DonationAccountType)
            : method === "bank"
              ? "bank"
              : method === "card"
                ? "gateway"
                : "personal";

          return {
            id: String(n.id || `num_${idx}`),
            method,
            type,
            label: String(n.label || "bKash Personal"),
            number: String(n.number || "01850999178"),
            active: Boolean(n.active ?? true),
            tone: String(n.tone || "from-pink-500 to-rose-600"),
            bankName: n.bankName ? String(n.bankName) : undefined,
            accountName: n.accountName ? String(n.accountName) : undefined,
            branchName: n.branchName ? String(n.branchName) : undefined,
            routingNumber: n.routingNumber ? String(n.routingNumber) : undefined,
            instructions: n.instructions ? String(n.instructions) : undefined,
            displayOrder: Number(n.displayOrder ?? idx + 1),
            setupStatus: (n.setupStatus as any) || (type === "gateway" || type === "merchant" ? "setup_required" : "connected"),
            isGatewayConfigured: Boolean(n.isGatewayConfigured ?? false),
          };
        }),
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
    // 1. Direct document read from Firestore immediately on mount
    getDoc(doc(db, "settings", DONATION_CONFIG_ID))
      .then((snap) => {
        if (snap.exists()) {
          const parsed = parseDonationConfig(snap.data()?.logo_url);
          if (parsed) {
            setConfig(parsed);
            try {
              localStorage.setItem(LOCAL_DONATION_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      })
      .catch(() => {});

    // 2. Real-time direct doc listener
    const unsubDirect = onSnapshot(
      doc(db, "settings", DONATION_CONFIG_ID),
      (snap) => {
        if (snap.exists()) {
          const parsed = parseDonationConfig(snap.data()?.logo_url);
          if (parsed) {
            setConfig(parsed);
            try {
              localStorage.setItem(LOCAL_DONATION_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      },
      () => {}
    );

    return () => unsubDirect();
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
// 3. Dynamic Divisions & Categories Hooks (/settings/divisions_config & /settings/categories_config)
// ============================================================================
export interface DivisionConfigItem {
  id: string;
  bn: string;
  en: string;
  iconName: string;
  tint: string;
  description: string;
  visible: boolean;
  sort_order: number;
  customIconUrl?: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export const DEFAULT_DIVISION_ITEMS: DivisionConfigItem[] = DIVISIONS.map((d, idx) => {
  const item: DivisionConfigItem = {
    id: d.id,
    bn: d.bn,
    en: d.en,
    iconName: d.iconName,
    tint: d.tint,
    description: d.description,
    visible: true,
    sort_order: d.sort_order || idx + 1,
    isDeleted: false,
  };
  if (d.customIconUrl) {
    item.customIconUrl = d.customIconUrl;
  }
  return item;
});

interface ParsedDivisionWrapper {
  items: DivisionConfigItem[];
  deletedDivisionIds: string[];
  trashedDivisions: DivisionConfigItem[];
}

function parseDivisionConfigWrapper(raw: string | null | undefined): ParsedDivisionWrapper | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    let rawList: any[] = [];
    const deletedIds = new Set<string>();
    const trashedMap = new Map<string, DivisionConfigItem>();

    if (Array.isArray(parsed)) {
      rawList = parsed;
    } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
      rawList = parsed.items;
      if (Array.isArray(parsed.deletedDivisionIds)) {
        parsed.deletedDivisionIds.forEach((id: string) => deletedIds.add(String(id)));
      }
      if (Array.isArray(parsed.trashedDivisions)) {
        for (const t of parsed.trashedDivisions) {
          if (t && typeof t.id === "string") {
            trashedMap.set(t.id, { ...t, isDeleted: true });
            deletedIds.add(t.id);
          }
        }
      }
    }

    if (rawList.length > 0 || deletedIds.size > 0) {
      const divMap = new Map<string, DivisionConfigItem>();
      // 1. Seed defaults unless explicitly deleted
      for (const d of DEFAULT_DIVISION_ITEMS) {
        if (!deletedIds.has(d.id)) {
          divMap.set(d.id, { ...d });
        }
      }
      // 2. Apply customizations or custom divisions
      for (const item of rawList) {
        if (!item || typeof item.id !== "string") continue;
        const id = String(item.id).trim();
        if (!id) continue;
        const fallback = DIVISIONS.find((d) => d.id === id);
        const iconName = item.iconName && CATEGORY_ICONS[item.iconName] ? item.iconName : fallback?.iconName || "PhoneCall";
        const iconUrl = item.customIconUrl || fallback?.customIconUrl;
        const entry: DivisionConfigItem = {
          id,
          bn: String(item.bn || fallback?.bn || id),
          en: String(item.en || fallback?.en || id),
          iconName,
          tint: String(item.tint || fallback?.tint || "from-emerald-500/20 to-teal-700/10"),
          description: String(item.description || fallback?.description || ""),
          visible: item.visible !== false,
          sort_order: typeof item.sort_order === "number" ? item.sort_order : (fallback?.sort_order || 99),
          isDeleted: item.isDeleted === true || deletedIds.has(id),
          deletedAt: item.deletedAt,
        };
        if (iconUrl) {
          entry.customIconUrl = iconUrl;
        }
        if (entry.isDeleted) {
          deletedIds.add(id);
          trashedMap.set(id, entry);
          divMap.delete(id);
        } else {
          divMap.set(id, entry);
        }
      }
      return {
        items: Array.from(divMap.values()).sort((a, b) => a.sort_order - b.sort_order),
        deletedDivisionIds: Array.from(deletedIds),
        trashedDivisions: Array.from(trashedMap.values()),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

function toResolvedDivision(item: DivisionConfigItem): Division {
  const fallback = DIVISIONS.find((d) => d.id === item.id);
  const iconKey = item.iconName && CATEGORY_ICONS[item.iconName] ? item.iconName : fallback?.iconName || "PhoneCall";
  const IconComp = CATEGORY_ICONS[iconKey] || CATEGORY_ICONS.PhoneCall;
  return {
    id: item.id,
    bn: item.bn,
    en: item.en,
    icon: IconComp,
    iconName: iconKey,
    tint: item.tint || fallback?.tint || "from-emerald-500/20 to-teal-700/10",
    description: item.description || fallback?.description || "",
    sort_order: item.sort_order,
    customIconUrl: item.customIconUrl || fallback?.customIconUrl,
    visible: item.visible !== false,
  };
}

export function useDivisions() {
  const [state, setState] = useState<ParsedDivisionWrapper>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_DIVISIONS_KEY);
      return (
        parseDivisionConfigWrapper(cached) ?? {
          items: DEFAULT_DIVISION_ITEMS,
          deletedDivisionIds: [],
          trashedDivisions: [],
        }
      );
    } catch {
      return {
        items: DEFAULT_DIVISION_ITEMS,
        deletedDivisionIds: [],
        trashedDivisions: [],
      };
    }
  });

  useEffect(() => {
    fetch(`/api/content?collection=settings&id=${DIVISIONS_CONFIG_ID}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.item?.logo_url) {
          const parsed = parseDivisionConfigWrapper(d.item.logo_url);
          if (parsed) {
            setState(parsed);
            try {
              localStorage.setItem(
                LOCAL_DIVISIONS_KEY,
                JSON.stringify({ ...parsed, updatedAt: new Date().toISOString() })
              );
            } catch {}
          }
        }
      })
      .catch(() => {});

    const unsubDirect = onSnapshot(
      doc(db, "settings", DIVISIONS_CONFIG_ID),
      (docSnap) => {
        if (docSnap.exists()) {
          const parsed = parseDivisionConfigWrapper(docSnap.data()?.logo_url);
          if (parsed) {
            setState(parsed);
            try {
              localStorage.setItem(
                LOCAL_DIVISIONS_KEY,
                JSON.stringify({ ...parsed, updatedAt: new Date().toISOString() })
              );
            } catch {}
          }
        }
      },
      () => {}
    );
    return () => unsubDirect();
  }, []);

  const persistDivisionsState = useCallback(async (nextState: ParsedDivisionWrapper) => {
    const normalizedItems = [...nextState.items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((d, idx) => ({ ...d, sort_order: idx + 1, isDeleted: false }));
    const payload = {
      items: normalizedItems,
      deletedDivisionIds: Array.from(new Set(nextState.deletedDivisionIds)),
      trashedDivisions: nextState.trashedDivisions,
      updatedAt: new Date().toISOString(),
    };
    const serialized = JSON.stringify(payload);
    try {
      localStorage.setItem(LOCAL_DIVISIONS_KEY, serialized);
    } catch {}
    setState({
      items: normalizedItems,
      deletedDivisionIds: payload.deletedDivisionIds,
      trashedDivisions: payload.trashedDivisions,
    });
    await upsertSettingDoc(DIVISIONS_CONFIG_ID, serialized);
  }, []);

  const saveDivisionsConfig = useCallback(
    async (next: DivisionConfigItem[]) => {
      await persistDivisionsState({
        items: next,
        deletedDivisionIds: state.deletedDivisionIds,
        trashedDivisions: state.trashedDivisions,
      });
    },
    [persistDivisionsState, state.deletedDivisionIds, state.trashedDivisions]
  );

  const addDivision = useCallback(
    async (newDiv: Omit<DivisionConfigItem, "sort_order"> & { sort_order?: number }) => {
      const cleanId = String(newDiv.id || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "_");
      if (!cleanId) throw new Error("সঠিক বিভাগ ID (ইংরেজি অক্ষর) দিন");
      if (state.items.some((d) => d.id.toLowerCase() === cleanId)) {
        throw new Error("এই ID-র বিভাগ ইতিমধ্যে বিদ্যমান রয়েছে");
      }
      const sortOrder = typeof newDiv.sort_order === "number" ? newDiv.sort_order : state.items.length + 1;
      const entry: DivisionConfigItem = {
        id: cleanId,
        bn: String(newDiv.bn || cleanId).trim(),
        en: String(newDiv.en || cleanId).trim(),
        iconName: newDiv.iconName || "Layers",
        tint: newDiv.tint || "from-emerald-500/20 to-teal-700/10",
        description: String(newDiv.description || "").trim(),
        visible: newDiv.visible !== false,
        sort_order: sortOrder,
        isDeleted: false,
        ...(newDiv.customIconUrl?.trim() ? { customIconUrl: newDiv.customIconUrl.trim() } : {}),
      };

      await setDoc(
        doc(db, "departments", cleanId),
        sanitizeFirestorePayload({
          ...entry,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );

      await persistDivisionsState({
        items: [...state.items, entry],
        deletedDivisionIds: state.deletedDivisionIds.filter((id) => id !== cleanId),
        trashedDivisions: state.trashedDivisions.filter((t) => t.id !== cleanId),
      });
      return entry;
    },
    [persistDivisionsState, state]
  );

  const updateDivision = useCallback(
    async (id: string, patch: Partial<DivisionConfigItem>) => {
      const next = state.items.map((d) => (d.id === id ? { ...d, ...patch } : d));
      const target = next.find((d) => d.id === id);
      if (target) {
        await setDoc(
          doc(db, "departments", id),
          sanitizeFirestorePayload({
            ...target,
            updatedAt: serverTimestamp(),
          }),
          { merge: true }
        ).catch(() => {});
      }
      await persistDivisionsState({
        items: next,
        deletedDivisionIds: state.deletedDivisionIds,
        trashedDivisions: state.trashedDivisions,
      });
    },
    [persistDivisionsState, state]
  );

  const deleteDivision = useCallback(
    async (id: string, options?: { softDeleteOnly?: boolean; hardDelete?: boolean }) => {
      const target = state.items.find((d) => d.id === id);
      if (!target) return;
      const isHard = Boolean(options?.hardDelete && !options?.softDeleteOnly);
      if (isHard) {
        await deleteDoc(doc(db, "departments", id)).catch(() => {});
      } else {
        await setDoc(
          doc(db, "departments", id),
          sanitizeFirestorePayload({
            id,
            isDeleted: true,
            visible: false,
            deletedAt: new Date().toISOString(),
            updatedAt: serverTimestamp(),
          }),
          { merge: true }
        ).catch(() => {});
      }

      const trashedEntry: DivisionConfigItem = {
        ...target,
        isDeleted: true,
        visible: false,
        deletedAt: new Date().toISOString(),
      };

      await persistDivisionsState({
        items: state.items.filter((d) => d.id !== id),
        deletedDivisionIds: Array.from(new Set([...state.deletedDivisionIds, id])),
        trashedDivisions: isHard
          ? state.trashedDivisions.filter((t) => t.id !== id)
          : [...state.trashedDivisions.filter((t) => t.id !== id), trashedEntry],
      });
    },
    [persistDivisionsState, state]
  );

  const restoreDivision = useCallback(
    async (id: string) => {
      const trashed = state.trashedDivisions.find((t) => t.id === id);
      const fallback = DEFAULT_DIVISION_ITEMS.find((d) => d.id === id);
      const restored: DivisionConfigItem | undefined = trashed
        ? { ...trashed, isDeleted: false, visible: true, deletedAt: undefined }
        : fallback
          ? { ...fallback, isDeleted: false, visible: true }
          : undefined;
      if (!restored) throw new Error("পুনরুদ্ধারের জন্য বিভাগ খুঁজে পাওয়া যায়নি");

      await setDoc(
        doc(db, "departments", id),
        sanitizeFirestorePayload({
          ...restored,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      ).catch(() => {});

      await persistDivisionsState({
        items: [...state.items.filter((d) => d.id !== id), restored],
        deletedDivisionIds: state.deletedDivisionIds.filter((x) => x !== id),
        trashedDivisions: state.trashedDivisions.filter((t) => t.id !== id),
      });
    },
    [persistDivisionsState, state]
  );

  const reorderDivisions = useCallback(
    async (id: string, direction: "up" | "down") => {
      const sorted = [...state.items].sort((a, b) => a.sort_order - b.sort_order);
      const idx = sorted.findIndex((d) => d.id === id);
      if (idx === -1) return;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= sorted.length) return;
      const [moved] = sorted.splice(idx, 1);
      sorted.splice(targetIdx, 0, moved);
      await saveDivisionsConfig(sorted);
    },
    [saveDivisionsConfig, state.items]
  );

  const resolvedDivisions = useMemo(() => state.items.map(toResolvedDivision), [state.items]);
  const visibleDivisions = useMemo(
    () => resolvedDivisions.filter((d) => d.visible !== false).sort((a, b) => a.sort_order - b.sort_order),
    [resolvedDivisions]
  );

  return {
    divisions: visibleDivisions,
    allDivisions: resolvedDivisions,
    rawDivisions: state.items,
    trashedDivisions: state.trashedDivisions,
    saveDivisionsConfig,
    addDivision,
    updateDivision,
    deleteDivision,
    restoreDivision,
    reorderDivisions,
    getDivisionById: (id: string) => resolvedDivisions.find((d) => d.id === id),
  };
}

export interface CategoryConfigItem {
  id?: string;
  name?: string;
  slug: string;
  departmentId?: string;
  divisionId?: string;
  bn: string;
  en: string;
  icon?: string;
  iconName: string;
  tint: string;
  description: string;
  formType?: string;
  customIconUrl?: string;
  iconObjectKey?: string;
  iconContentType?: string;
  iconFileSize?: number;
  iconUpdatedAt?: string;
  iconCleared?: boolean;
  customRoute?: string;
  displayOrder?: number;
  sort_order: number;
  isActive?: boolean;
  visible: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  updatedBy?: string;
}

export async function checkCategoryReferences(slug: string): Promise<{
  submissionsCount: number;
  donationsCount: number;
  total: number;
}> {
  let submissionsCount = 0;
  let donationsCount = 0;
  try {
    const q1 = query(collection(db, "submissions"), where("category_slug", "==", slug));
    const snap1 = await getDocs(q1);
    submissionsCount = snap1.size;
  } catch {
    try {
      const q1Alt = query(collection(db, "submissions"), where("category", "==", slug));
      const snap1Alt = await getDocs(q1Alt);
      submissionsCount = Math.max(submissionsCount, snap1Alt.size);
    } catch {}
  }

  try {
    const q2 = query(collection(db, "donations"), where("category", "==", slug));
    const snap2 = await getDocs(q2);
    donationsCount = snap2.size;
  } catch {}

  return {
    submissionsCount,
    donationsCount,
    total: submissionsCount + donationsCount,
  };
}

const DEFAULT_CATEGORY_ITEMS: CategoryConfigItem[] = defaultCategories
  .filter((c) => c.slug !== "chat" && c.slug !== "app-download")
  .map((c, idx) => {
    const item: CategoryConfigItem = {
      id: c.slug,
      name: c.bn,
      slug: c.slug,
      departmentId: c.divisionId,
      divisionId: c.divisionId,
      bn: c.bn,
      en: c.en,
      icon: c.iconName || "Users",
      iconName: c.iconName || "Users",
      tint: c.tint,
      description: c.description,
      formType: c.formType || "general",
      displayOrder: c.sort_order || idx + 1,
      sort_order: c.sort_order || idx + 1,
      isActive: true,
      visible: true,
      isDeleted: false,
    };
    if (c.customIconUrl) {
      item.customIconUrl = c.customIconUrl;
    }
    return item;
  });

export function normalizeCategorySlug(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-");
}

function canonicalMatchKey(raw: string): string {
  return normalizeCategorySlug(raw).replace(/_/g, "-");
}

export interface DuplicateCategoryDiagnostics {
  aliasDocIds: Array<{ docId: string; canonicalSlug: string; bn: string; divisionId: string }>;
  sameDivisionDuplicates: Array<{ divisionId: string; bn: string; slugs: string[] }>;
  crossDivisionSharedNames: Array<{ bn: string; entries: Array<{ slug: string; divisionId: string }> }>;
  unassignedOrInvalidDivision: Array<{ slug: string; bn: string; divisionId: string }>;
}

const VALID_DIVISION_ID_SET = new Set(DIVISIONS.map((d) => d.id));

function resolveSafeDivisionId(rawDivId: unknown, fallbackDivId?: string): string {
  const clean = typeof rawDivId === "string" ? rawDivId.trim() : "";
  if (clean && clean !== "division-2-shopping-market") {
    return clean;
  }
  if (fallbackDivId && fallbackDivId !== "division-2-shopping-market") {
    return fallbackDivId;
  }
  return "other_services";
}

interface ParsedCategoryWrapper {
  items: CategoryConfigItem[];
  deletedSlugs: string[];
  trashedItems: CategoryConfigItem[];
}

function sanitizeCategoryIconUrl(raw: unknown): string | undefined {
  return isValidPersistedIconUrl(raw) ? raw.trim() : undefined;
}

function parseCategoryConfigWrapper(raw: string | null | undefined): ParsedCategoryWrapper | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    let itemsList: any[] = [];
    const deletedSlugs = new Set<string>();
    const trashedMap = new Map<string, CategoryConfigItem>();

    if (Array.isArray(parsed)) {
      itemsList = parsed;
    } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
      itemsList = parsed.items;
      if (Array.isArray(parsed.deletedSlugs)) {
        parsed.deletedSlugs.forEach((s: string) => deletedSlugs.add(normalizeCategorySlug(s)));
      }
      if (Array.isArray(parsed.trashedItems)) {
        for (const t of parsed.trashedItems) {
          if (t && typeof t.slug === "string") {
            const cSlug = normalizeCategorySlug(t.slug);
            const safeTrashedUrl = t.iconCleared === true ? undefined : sanitizeCategoryIconUrl(t.customIconUrl);
            const copy: CategoryConfigItem = { ...t, slug: cSlug, id: cSlug, isDeleted: true };
            if (safeTrashedUrl) copy.customIconUrl = safeTrashedUrl;
            else delete copy.customIconUrl;
            trashedMap.set(cSlug, copy);
            deletedSlugs.add(cSlug);
          }
        }
      }
    }

    if (itemsList.length > 0 || deletedSlugs.size > 0) {
      const catMap = new Map<string, CategoryConfigItem>();

      // 1. Gather explicit deletions
      for (const item of itemsList) {
        if (!item || typeof item.slug !== "string") continue;
        if (item.isDeleted === true) {
          deletedSlugs.add(normalizeCategorySlug(item.slug));
        }
      }

      // 2. Seed master defaults unless explicitly deleted
      for (const d of DEFAULT_CATEGORY_ITEMS) {
        if (!deletedSlugs.has(d.slug)) {
          catMap.set(d.slug, { ...d });
        }
      }

      // 3. Apply customizations or custom categories
      for (const item of itemsList) {
        if (!item || typeof item.slug !== "string") continue;
        const slug = normalizeCategorySlug(item.slug);
        if (!slug || slug === "chat" || slug === "app-download") continue;

        const fallback = defaultCategories.find(
          (d) => d.slug === slug || canonicalMatchKey(d.slug) === canonicalMatchKey(slug)
        );
        const targetSlug = fallback ? fallback.slug : slug;

        const rawIcon = String(item.iconName || item.icon || "");
        const iconName =
          rawIcon && rawIcon !== "Users" && CATEGORY_ICONS[rawIcon]
            ? rawIcon
            : fallback && CATEGORY_ICONS[fallback.iconName || "Users"]
              ? fallback.iconName || "Users"
              : rawIcon || "Users";
        const rawTint = String(item.tint || "");
        const tint =
          rawTint && rawTint !== "from-emerald-500/15 to-emerald-700/10"
            ? rawTint
            : fallback?.tint || "from-emerald-500/15 to-emerald-700/10";
        const description = String(item.description ?? fallback?.description ?? "");
        const divisionId = resolveSafeDivisionId(
          item.divisionId || item.departmentId,
          fallback?.divisionId
        );
        const formType = String(item.formType || fallback?.formType || "general");
        const iconCleared = item.iconCleared === true;
        const explicitIcon = sanitizeCategoryIconUrl(item.customIconUrl);
        const customIconUrl = iconCleared ? undefined : (explicitIcon || sanitizeCategoryIconUrl(fallback?.customIconUrl));
        const rawCustomRoute = item.customRoute;
        const customRoute =
          typeof rawCustomRoute === "string" && rawCustomRoute.trim()
            ? rawCustomRoute.trim()
            : undefined;
        const sortOrder =
          typeof item.sort_order === "number"
            ? item.sort_order
            : typeof item.displayOrder === "number"
              ? item.displayOrder
              : fallback?.sort_order || 999;

        const catItem: CategoryConfigItem = {
          id: targetSlug,
          name: String(item.bn || fallback?.bn || targetSlug),
          slug: targetSlug,
          divisionId,
          departmentId: divisionId,
          bn: String(item.bn || fallback?.bn || targetSlug),
          en: String(item.en || fallback?.en || targetSlug),
          icon: iconName,
          iconName,
          tint,
          description,
          formType,
          displayOrder: sortOrder,
          sort_order: sortOrder,
          isActive: item.isActive !== false && item.visible !== false,
          visible: item.visible !== false && item.isActive !== false,
          isDeleted: item.isDeleted === true || deletedSlugs.has(targetSlug),
          deletedAt: item.deletedAt,
          updatedAt: item.updatedAt,
          ...(iconCleared ? { iconCleared: true } : {}),
        };
        if (customIconUrl && !iconCleared) {
          catItem.customIconUrl = customIconUrl;
          if (typeof item.iconObjectKey === "string" && item.iconObjectKey.trim()) {
            catItem.iconObjectKey = item.iconObjectKey.trim();
          }
          if (typeof item.iconContentType === "string" && item.iconContentType.trim()) {
            catItem.iconContentType = item.iconContentType.trim();
          }
          if (typeof item.iconFileSize === "number" && item.iconFileSize > 0) {
            catItem.iconFileSize = item.iconFileSize;
          }
          if (typeof item.iconUpdatedAt === "string" && item.iconUpdatedAt.trim()) {
            catItem.iconUpdatedAt = item.iconUpdatedAt.trim();
          }
        }
        if (customRoute) {
          catItem.customRoute = customRoute;
        }

        if (catItem.isDeleted) {
          deletedSlugs.add(targetSlug);
          trashedMap.set(targetSlug, catItem);
          catMap.delete(targetSlug);
        } else {
          catMap.set(targetSlug, catItem);
        }
      }

      return {
        items: Array.from(catMap.values())
          .filter((c) => !deletedSlugs.has(c.slug) && c.isDeleted !== true)
          .sort((a, b) => a.sort_order - b.sort_order),
        deletedSlugs: Array.from(deletedSlugs),
        trashedItems: Array.from(trashedMap.values()),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

function toResolvedCategory(item: CategoryConfigItem): Category {
  const fallback = defaultCategories.find((d) => d.slug === item.slug);
  const iconKey =
    item.iconName && item.iconName !== "Users" && CATEGORY_ICONS[item.iconName]
      ? item.iconName
      : fallback?.iconName && CATEGORY_ICONS[fallback.iconName]
        ? fallback.iconName
        : item.iconName || "Users";
  const IconComp = CATEGORY_ICONS[iconKey] || CATEGORY_ICONS.Users;
  const tint =
    item.tint && item.tint !== "from-emerald-500/15 to-emerald-700/10"
      ? item.tint
      : fallback?.tint || item.tint || "from-emerald-500/15 to-emerald-700/10";
  const description = item.description || fallback?.description || "";
  const iconCleared = item.iconCleared === true;
  const resolvedIconUrl = iconCleared
    ? undefined
    : (sanitizeCategoryIconUrl(item.customIconUrl) || sanitizeCategoryIconUrl(fallback?.customIconUrl));

  return {
    slug: item.slug,
    divisionId: resolveSafeDivisionId(item.divisionId, fallback?.divisionId),
    bn: item.bn,
    en: item.en,
    icon: IconComp,
    iconName: iconKey,
    tint,
    description,
    formType: (item.formType || fallback?.formType || "general") as Category["formType"],
    customIconUrl: resolvedIconUrl,
    ...(resolvedIconUrl && item.iconObjectKey ? { iconObjectKey: item.iconObjectKey } : {}),
    ...(resolvedIconUrl && item.iconContentType ? { iconContentType: item.iconContentType } : {}),
    ...(resolvedIconUrl && typeof item.iconFileSize === "number" ? { iconFileSize: item.iconFileSize } : {}),
    ...(resolvedIconUrl && item.iconUpdatedAt ? { iconUpdatedAt: item.iconUpdatedAt } : {}),
    iconCleared,
    customRoute: item.customRoute,
    visible: item.visible,
    sort_order: item.sort_order,
  };
}

export function useCategories() {
  const [catState, setCatState] = useState<ParsedCategoryWrapper>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_CATEGORIES_KEY);
      return (
        parseCategoryConfigWrapper(cached) ?? {
          items: DEFAULT_CATEGORY_ITEMS,
          deletedSlugs: [],
          trashedItems: [],
        }
      );
    } catch {
      return {
        items: DEFAULT_CATEGORY_ITEMS,
        deletedSlugs: [],
        trashedItems: [],
      };
    }
  });

  const catStateRef = useRef<ParsedCategoryWrapper>(catState);
  catStateRef.current = catState;

  const applyCatState = useCallback((next: ParsedCategoryWrapper) => {
    catStateRef.current = next;
    setCatState(next);
  }, []);

  const [aliasDocIds, setAliasDocIds] = useState<
    Array<{ docId: string; canonicalSlug: string; bn: string; divisionId: string }>
  >([]);

  useEffect(() => {
    const baseDeletedSlugsSet = new Set<string>();
    const baseTrashedMap = new Map<string, CategoryConfigItem>();

    try {
      const raw = localStorage.getItem(LOCAL_CATEGORIES_KEY);
      const parsedLocal = parseCategoryConfigWrapper(raw);
      if (parsedLocal) {
        parsedLocal.deletedSlugs.forEach((s) => baseDeletedSlugsSet.add(normalizeCategorySlug(s)));
        parsedLocal.trashedItems.forEach((t) => baseTrashedMap.set(t.slug, t));
      }
    } catch {}

    const writeLocalWrapper = (wrapper: ParsedCategoryWrapper) => {
      try {
        localStorage.setItem(
          LOCAL_CATEGORIES_KEY,
          JSON.stringify({
            items: wrapper.items,
            deletedSlugs: wrapper.deletedSlugs,
            trashedItems: wrapper.trashedItems,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch {}
    };

    let collectionHasLoaded = false;
    let directDocHasLoaded = false;
    const collectionDocsMap = new Map<string, CategoryConfigItem>();
    const collectionDeletedSet = new Set<string>();
    const collectionTrashedMap = new Map<string, CategoryConfigItem>();
    let latestDirectWrapper: ParsedCategoryWrapper | null = null;

    const reconcileAndApply = () => {
      const effectiveDeletedSet = new Set<string>(baseDeletedSlugsSet);
      if (latestDirectWrapper) {
        latestDirectWrapper.deletedSlugs.forEach((s) => effectiveDeletedSet.add(normalizeCategorySlug(s)));
      }
      collectionDeletedSet.forEach((s) => effectiveDeletedSet.add(s));
      // If a /categories/{slug} doc is explicitly active (isDeleted !== true), it is not deleted
      collectionDocsMap.forEach((_, slug) => {
        effectiveDeletedSet.delete(slug);
      });

      const mergedTrashedMap = new Map<string, CategoryConfigItem>(baseTrashedMap);
      if (latestDirectWrapper) {
        latestDirectWrapper.trashedItems.forEach((t) => mergedTrashedMap.set(t.slug, t));
      }
      collectionTrashedMap.forEach((t, slug) => mergedTrashedMap.set(slug, t));
      collectionDocsMap.forEach((_, slug) => mergedTrashedMap.delete(slug));

      const mergedMap = new Map<string, CategoryConfigItem>();

      // 1. Seed defaults unless deleted
      for (const def of DEFAULT_CATEGORY_ITEMS) {
        if (!effectiveDeletedSet.has(def.slug)) {
          mergedMap.set(def.slug, { ...def });
        }
      }

      // 2. Overlay settings/categories_config items (preserves wrapper ordering & settings overrides)
      if (latestDirectWrapper) {
        for (const directItem of latestDirectWrapper.items) {
          if (!effectiveDeletedSet.has(directItem.slug)) {
            mergedMap.set(directItem.slug, { ...directItem });
          }
        }
      }

      // 3. Authoritatively overlay live /categories/{slug} docs (never drop custom docs, always win for icon fields)
      if (collectionHasLoaded) {
        collectionDocsMap.forEach((liveDoc, slug) => {
          if (effectiveDeletedSet.has(slug)) return;
          const prev = mergedMap.get(slug);
          mergedMap.set(slug, {
            ...(prev || {}),
            ...liveDoc,
            ...(liveDoc.iconCleared
              ? {
                  iconCleared: true,
                  customIconUrl: undefined,
                  iconObjectKey: undefined,
                  iconContentType: undefined,
                  iconFileSize: undefined,
                }
              : liveDoc.customIconUrl
                ? {
                    customIconUrl: liveDoc.customIconUrl,
                    iconCleared: false,
                    ...(liveDoc.iconObjectKey ? { iconObjectKey: liveDoc.iconObjectKey } : {}),
                    ...(liveDoc.iconContentType ? { iconContentType: liveDoc.iconContentType } : {}),
                    ...(typeof liveDoc.iconFileSize === "number" ? { iconFileSize: liveDoc.iconFileSize } : {}),
                    ...(liveDoc.iconUpdatedAt ? { iconUpdatedAt: liveDoc.iconUpdatedAt } : {}),
                  }
                : prev?.iconCleared
                  ? { iconCleared: true, customIconUrl: undefined }
                  : prev?.customIconUrl
                    ? { customIconUrl: prev.customIconUrl, iconCleared: false }
                    : {}),
          });
        });
      }

      const finalItems = Array.from(mergedMap.values())
        .filter((c) => !effectiveDeletedSet.has(c.slug) && c.isDeleted !== true)
        .sort((a, b) => a.sort_order - b.sort_order);

      const wrapper: ParsedCategoryWrapper = {
        items: finalItems,
        deletedSlugs: Array.from(effectiveDeletedSet),
        trashedItems: Array.from(mergedTrashedMap.values()),
      };
      applyCatState(wrapper);
      writeLocalWrapper(wrapper);
    };

    // 1. Pull from Server Content API immediately on mount (only before Firestore listeners arrive)
    fetch(`/api/content?collection=settings&id=${CATEGORIES_CONFIG_ID}`)
      .then((r) => r.json())
      .then((d) => {
        if (collectionHasLoaded || directDocHasLoaded) return;
        if (d?.item?.logo_url) {
          const parsed = parseCategoryConfigWrapper(d.item.logo_url);
          if (parsed && (parsed.items.length > 0 || parsed.deletedSlugs.length > 0)) {
            latestDirectWrapper = parsed;
            reconcileAndApply();
          }
        }
      })
      .catch(() => {});

    // 2. Real-time sync directly from Firestore /categories collection (Authoritative per-doc source)
    const unsubCategories = onSnapshot(
      collection(db, "categories"),
      (snapshot) => {
        if (!snapshot.empty) {
          collectionHasLoaded = true;
          collectionDocsMap.clear();
          collectionDeletedSet.clear();
          collectionTrashedMap.clear();
          const detectedAliases: Array<{
            docId: string;
            canonicalSlug: string;
            bn: string;
            divisionId: string;
          }> = [];

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const rawDocSlug = String(data.slug || docSnap.id);
            const normalizedSlug = normalizeCategorySlug(rawDocSlug);
            if (!normalizedSlug || normalizedSlug === "chat" || normalizedSlug === "app-download") {
              return;
            }
            const fallback = defaultCategories.find(
              (d) => d.slug === normalizedSlug || canonicalMatchKey(d.slug) === canonicalMatchKey(normalizedSlug)
            );
            const canonicalSlug = fallback ? fallback.slug : normalizedSlug;

            if (docSnap.id !== canonicalSlug) {
              detectedAliases.push({
                docId: docSnap.id,
                canonicalSlug,
                bn: String(data.bn || data.name || docSnap.id),
                divisionId: String(data.divisionId || data.departmentId || ""),
              });
            }

            const rawIcon = String(data.iconName || data.icon || "");
            const iconName =
              rawIcon && rawIcon !== "Users" && CATEGORY_ICONS[rawIcon]
                ? rawIcon
                : fallback && CATEGORY_ICONS[fallback.iconName || "Users"]
                  ? fallback.iconName || "Users"
                  : rawIcon || "Users";
            const sortOrder =
              typeof data.sort_order === "number"
                ? data.sort_order
                : typeof data.displayOrder === "number"
                  ? data.displayOrder
                  : fallback?.sort_order || 999;
            const divId = resolveSafeDivisionId(data.divisionId || data.departmentId, fallback?.divisionId);

            const hasExplicitCustomIconField = Object.prototype.hasOwnProperty.call(data, "customIconUrl");
            const explicitUrl = sanitizeCategoryIconUrl(data.customIconUrl);
            const explicitEmptyClear =
              hasExplicitCustomIconField &&
              typeof data.customIconUrl === "string" &&
              data.customIconUrl.trim() === "" &&
              data.iconCleared !== false;
            const iconCleared = data.iconCleared === true || explicitEmptyClear;
            const customIconUrl = iconCleared
              ? undefined
              : (explicitUrl || sanitizeCategoryIconUrl(fallback?.customIconUrl));
            const customRoute =
              typeof data.customRoute === "string" && data.customRoute.trim()
                ? data.customRoute.trim()
                : undefined;

            const firestoreCat: CategoryConfigItem = {
              id: canonicalSlug,
              slug: canonicalSlug,
              name: String(data.bn || data.name || fallback?.bn || canonicalSlug),
              bn: String(data.bn || data.name || fallback?.bn || canonicalSlug),
              en: String(data.en || fallback?.en || canonicalSlug),
              divisionId: divId,
              departmentId: divId,
              icon: iconName,
              iconName,
              tint: data.tint || fallback?.tint || "from-emerald-500/15 to-emerald-700/10",
              description: String(data.description ?? fallback?.description ?? ""),
              formType: String(data.formType || fallback?.formType || "general"),
              displayOrder: sortOrder,
              sort_order: sortOrder,
              isActive: data.isActive !== false && data.visible !== false,
              visible: data.visible !== false && data.isActive !== false,
              isDeleted: data.isDeleted === true,
              deletedAt: data.deletedAt,
              updatedAt: data.updatedAt,
              ...(iconCleared ? { iconCleared: true } : {}),
              ...(customIconUrl && !iconCleared ? { customIconUrl, iconCleared: false } : {}),
              ...(customIconUrl && !iconCleared && typeof data.iconObjectKey === "string" && data.iconObjectKey.trim()
                ? { iconObjectKey: data.iconObjectKey.trim() }
                : {}),
              ...(customIconUrl && !iconCleared && typeof data.iconContentType === "string" && data.iconContentType.trim()
                ? { iconContentType: data.iconContentType.trim() }
                : {}),
              ...(customIconUrl && !iconCleared && typeof data.iconFileSize === "number" && data.iconFileSize > 0
                ? { iconFileSize: data.iconFileSize }
                : {}),
              ...(customIconUrl && !iconCleared && typeof data.iconUpdatedAt === "string" && data.iconUpdatedAt.trim()
                ? { iconUpdatedAt: data.iconUpdatedAt.trim() }
                : {}),
              ...(customRoute ? { customRoute } : {}),
            };

            if (firestoreCat.isDeleted) {
              collectionDeletedSet.add(canonicalSlug);
              collectionTrashedMap.set(canonicalSlug, firestoreCat);
              collectionDocsMap.delete(canonicalSlug);
            } else {
              const existing = collectionDocsMap.get(canonicalSlug);
              // Prefer canonical doc ID over alias doc ID if both exist
              if (!existing || docSnap.id === canonicalSlug) {
                collectionDocsMap.set(canonicalSlug, firestoreCat);
              }
            }
          });

          setAliasDocIds(detectedAliases);
          reconcileAndApply();
        }
      },
      (err) => {
        console.warn("Firestore /categories listener notice:", err?.message);
      }
    );

    // 3. Listen to settings/categories_config (reconciled with live /categories docs so icons/custom docs are never lost)
    const unsubDirect = onSnapshot(
      doc(db, "settings", CATEGORIES_CONFIG_ID),
      (docSnap) => {
        if (docSnap.exists()) {
          const rawPayload = docSnap.data()?.logo_url;
          const parsed = parseCategoryConfigWrapper(rawPayload);
          if (parsed && (parsed.items.length > 0 || parsed.deletedSlugs.length > 0)) {
            directDocHasLoaded = true;
            latestDirectWrapper = parsed;
            reconcileAndApply();
          }
        }
      },
      () => {}
    );

    return () => {
      unsubCategories();
      unsubDirect();
    };
  }, [applyCatState]);

  const persistCategoryWrapper = useCallback(
    async (
      nextList: CategoryConfigItem[],
      options?: {
        addDeleted?: string[];
        removeDeleted?: string[];
        addTrashed?: CategoryConfigItem[];
        removeTrashedSlugs?: string[];
      }
    ) => {
      const currentState = catStateRef.current;
      const deletedSet = new Set(currentState.deletedSlugs);
      (options?.addDeleted || []).forEach((s) => deletedSet.add(normalizeCategorySlug(s)));
      (options?.removeDeleted || []).forEach((s) => deletedSet.delete(normalizeCategorySlug(s)));

      const trashedMap = new Map<string, CategoryConfigItem>();
      for (const t of currentState.trashedItems) {
        trashedMap.set(t.slug, t);
      }
      for (const t of options?.addTrashed || []) {
        trashedMap.set(t.slug, { ...t, isDeleted: true });
      }
      for (const s of options?.removeTrashedSlugs || []) {
        trashedMap.delete(normalizeCategorySlug(s));
      }

      const normalized = nextList
        .filter(
          (c) =>
            c.slug !== "chat" &&
            c.slug !== "app-download" &&
            c.isDeleted !== true &&
            !deletedSet.has(c.slug)
        )
        .map((c, idx) => {
          const sanitizedUrl = c.iconCleared ? undefined : sanitizeCategoryIconUrl(c.customIconUrl);
          const cleanItem: CategoryConfigItem = {
            ...c,
            sort_order: idx + 1,
            displayOrder: idx + 1,
            isActive: c.visible !== false,
          };
          if (c.iconCleared || !sanitizedUrl) {
            delete cleanItem.customIconUrl;
          } else {
            cleanItem.customIconUrl = sanitizedUrl;
          }
          return cleanItem;
        });

      const wrapper: ParsedCategoryWrapper = {
        items: normalized,
        deletedSlugs: Array.from(deletedSet),
        trashedItems: Array.from(trashedMap.values()),
      };

      const fullSerialized = JSON.stringify({
        ...wrapper,
        updatedAt: new Date().toISOString(),
      });
      try {
        localStorage.setItem(LOCAL_CATEGORIES_KEY, fullSerialized);
      } catch {}

      applyCatState(wrapper);

      // Keep Firestore settings/categories_config safely under 285KB so upsertSettingDoc never slices JSON mid-string
      const buildCloudJson = (
        itemsArr: CategoryConfigItem[],
        trashedArr: CategoryConfigItem[]
      ) =>
        JSON.stringify({
          items: itemsArr,
          deletedSlugs: Array.from(deletedSet),
          trashedItems: trashedArr,
          updatedAt: new Date().toISOString(),
        });

      let cloudSerialized = fullSerialized;
      if (cloudSerialized.length > 275000) {
        const compactedItems = normalized.map((c) => {
          if (typeof c.customIconUrl === "string" && c.customIconUrl.startsWith("data:") && c.customIconUrl.length > 2048) {
            const copy = { ...c };
            delete copy.customIconUrl;
            return copy;
          }
          return c;
        });
        const compactedTrashed = Array.from(trashedMap.values()).map((t) => {
          if (typeof t.customIconUrl === "string" && t.customIconUrl.startsWith("data:")) {
            const copy = { ...t };
            delete copy.customIconUrl;
            return copy;
          }
          return t;
        });
        cloudSerialized = buildCloudJson(compactedItems, compactedTrashed);

        if (cloudSerialized.length > 280000) {
          const slimItems = compactedItems.map((c) => ({
            id: c.id,
            slug: c.slug,
            divisionId: c.divisionId,
            bn: c.bn,
            en: c.en,
            iconName: c.iconName,
            sort_order: c.sort_order,
            visible: c.visible,
            ...(c.iconCleared ? { iconCleared: true } : {}),
            ...(c.customIconUrl && !c.iconCleared ? { customIconUrl: c.customIconUrl } : {}),
            ...(c.customRoute ? { customRoute: c.customRoute } : {}),
          })) as CategoryConfigItem[];
          cloudSerialized = buildCloudJson(slimItems, []);
        }
      }

      await upsertSettingDoc(CATEGORIES_CONFIG_ID, cloudSerialized);
    },
    [applyCatState]
  );

  const saveCategories = useCallback(
    async (nextList: CategoryConfigItem[], deletedSlug?: string, restoredSlug?: string) => {
      await persistCategoryWrapper(nextList, {
        addDeleted: deletedSlug ? [deletedSlug] : [],
        removeDeleted: restoredSlug ? [restoredSlug] : [],
        removeTrashedSlugs: restoredSlug ? [restoredSlug] : [],
      });
    },
    [persistCategoryWrapper]
  );

  const updateCategory = useCallback(
    async (slug: string, patch: Partial<CategoryConfigItem>) => {
      const normalizedInput = normalizeCategorySlug(slug);
      const currentItems = catStateRef.current.items;
      const existingMatch = currentItems.find(
        (c) => c.slug === normalizedInput || canonicalMatchKey(c.slug) === canonicalMatchKey(normalizedInput)
      );
      const masterMatch = defaultCategories.find(
        (d) => d.slug === normalizedInput || canonicalMatchKey(d.slug) === canonicalMatchKey(normalizedInput)
      );
      const cleanSlug = existingMatch?.slug || masterMatch?.slug || normalizedInput;
      if (!cleanSlug) {
        throw new Error("সঠিক ক্যাটাগরি স্লাগ পাওয়া যায়নি।");
      }

      const docRef = doc(db, "categories", cleanSlug);

      const updatePayload: Record<string, any> = {
        slug: cleanSlug,
        id: cleanSlug,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || "admin",
      };

      if (patch.bn !== undefined) {
        updatePayload.bn = String(patch.bn);
        updatePayload.name = String(patch.bn);
      }
      if (patch.en !== undefined) updatePayload.en = String(patch.en);
      if (patch.divisionId !== undefined) {
        const safeDiv = resolveSafeDivisionId(patch.divisionId);
        updatePayload.divisionId = safeDiv;
        updatePayload.departmentId = safeDiv;
      }
      if (patch.iconName !== undefined) {
        updatePayload.iconName = String(patch.iconName);
        updatePayload.icon = String(patch.iconName);
      }
      if (patch.tint !== undefined) updatePayload.tint = String(patch.tint);
      if (patch.description !== undefined) updatePayload.description = String(patch.description);
      if (patch.formType !== undefined) updatePayload.formType = String(patch.formType);
      if (patch.customRoute !== undefined) {
        updatePayload.customRoute = typeof patch.customRoute === "string" ? patch.customRoute.trim() : "";
      }
      if (patch.sort_order !== undefined) {
        const orderNum = Number(patch.sort_order);
        updatePayload.sort_order = isNaN(orderNum) ? 1 : orderNum;
        updatePayload.displayOrder = isNaN(orderNum) ? 1 : orderNum;
      }
      if (patch.visible !== undefined) {
        updatePayload.visible = Boolean(patch.visible);
        updatePayload.isActive = Boolean(patch.visible);
      }

      let expectedIconUrl: string | undefined;
      let expectedIconCleared: boolean | undefined;

      if (patch.iconCleared === true) {
        updatePayload.iconCleared = true;
        updatePayload.customIconUrl = "";
        updatePayload.iconObjectKey = "";
        updatePayload.iconContentType = "";
        updatePayload.iconFileSize = 0;
        updatePayload.iconUpdatedAt = new Date().toISOString();
        expectedIconUrl = "";
        expectedIconCleared = true;
      } else if (patch.customIconUrl !== undefined) {
        const rawTrimmed = typeof patch.customIconUrl === "string" ? patch.customIconUrl.trim() : "";
        if (rawTrimmed) {
          const validUrl = sanitizeCategoryIconUrl(rawTrimmed);
          if (!validUrl) {
            throw new Error("অবৈধ বা অস্থায়ী (blob) আইকন লিংক ডেটাবেসে সংরক্ষণ করা যাবে না।");
          }
          updatePayload.customIconUrl = validUrl;
          updatePayload.iconCleared = false;
          updatePayload.iconObjectKey =
            typeof patch.iconObjectKey === "string" ? patch.iconObjectKey.trim() : "";
          updatePayload.iconContentType =
            typeof patch.iconContentType === "string" ? patch.iconContentType.trim() : "";
          updatePayload.iconFileSize =
            typeof patch.iconFileSize === "number" && patch.iconFileSize > 0 ? patch.iconFileSize : 0;
          updatePayload.iconUpdatedAt =
            typeof patch.iconUpdatedAt === "string" && patch.iconUpdatedAt.trim()
              ? patch.iconUpdatedAt.trim()
              : new Date().toISOString();
          expectedIconUrl = validUrl;
          expectedIconCleared = false;
        } else if (patch.iconCleared === false) {
          updatePayload.customIconUrl = "";
          updatePayload.iconCleared = false;
          updatePayload.iconObjectKey = "";
          updatePayload.iconContentType = "";
          updatePayload.iconFileSize = 0;
          expectedIconUrl = "";
          expectedIconCleared = false;
        } else {
          updatePayload.customIconUrl = "";
          updatePayload.iconCleared = true;
          updatePayload.iconObjectKey = "";
          updatePayload.iconContentType = "";
          updatePayload.iconFileSize = 0;
          updatePayload.iconUpdatedAt = new Date().toISOString();
          expectedIconUrl = "";
          expectedIconCleared = true;
        }
      } else if (patch.iconCleared === false) {
        updatePayload.iconCleared = false;
        expectedIconCleared = false;
      }

      const safePayload = sanitizeFirestorePayload(updatePayload);
      await setDoc(docRef, safePayload, { merge: true });

      const verifiedSnap = await getDoc(docRef);
      if (!verifiedSnap.exists()) {
        throw new Error("ফায়ারবেস ডেটাবেসে ক্যাটাগরি আপডেট নিশ্চিত করা যায়নি।");
      }
      const verifiedData = verifiedSnap.data() || {};
      if (expectedIconUrl !== undefined) {
        const savedIconUrl = typeof verifiedData.customIconUrl === "string" ? verifiedData.customIconUrl.trim() : "";
        if (expectedIconCleared) {
          if (verifiedData.iconCleared !== true || savedIconUrl !== "") {
            throw new Error("ফায়ারবেস ডেটাবেসে আইকন রিমুভ নিশ্চিত করা যায়নি।");
          }
        } else if (expectedIconUrl && savedIconUrl !== expectedIconUrl) {
          throw new Error("ফায়ারবেস ডেটাবেসে নতুন আইকন লিংক সংরক্ষণ যাচাই করা যায়নি।");
        }
      }

      const freshItems = catStateRef.current.items;
      let foundInList = false;
      const next = freshItems.map((c) => {
        if (c.slug !== cleanSlug) return c;
        foundInList = true;
        const updated: CategoryConfigItem = { ...c };
        if (patch.bn !== undefined) {
          updated.bn = patch.bn;
          updated.name = patch.bn;
        }
        if (patch.en !== undefined) updated.en = patch.en;
        if (patch.divisionId !== undefined) {
          const safeDiv = resolveSafeDivisionId(patch.divisionId);
          updated.divisionId = safeDiv;
          updated.departmentId = safeDiv;
        }
        if (patch.iconName !== undefined) {
          updated.iconName = patch.iconName;
          updated.icon = patch.iconName;
        }
        if (patch.tint !== undefined) updated.tint = patch.tint;
        if (patch.description !== undefined) updated.description = patch.description;
        if (patch.formType !== undefined) updated.formType = patch.formType;
        if (patch.customRoute !== undefined) {
          const trimmedRoute = typeof patch.customRoute === "string" ? patch.customRoute.trim() : "";
          if (trimmedRoute) updated.customRoute = trimmedRoute;
          else delete updated.customRoute;
        }
        if (patch.sort_order !== undefined) {
          const num = Number(patch.sort_order);
          updated.sort_order = isNaN(num) ? 1 : num;
          updated.displayOrder = isNaN(num) ? 1 : num;
        }
        if (patch.visible !== undefined) {
          updated.visible = Boolean(patch.visible);
          updated.isActive = Boolean(patch.visible);
        }
        if (expectedIconCleared === true) {
          updated.iconCleared = true;
          delete updated.customIconUrl;
          delete updated.iconObjectKey;
          delete updated.iconContentType;
          delete updated.iconFileSize;
          updated.iconUpdatedAt = updatePayload.iconUpdatedAt;
        } else if (expectedIconUrl) {
          updated.customIconUrl = expectedIconUrl;
          updated.iconCleared = false;
          if (updatePayload.iconObjectKey) updated.iconObjectKey = updatePayload.iconObjectKey;
          else delete updated.iconObjectKey;
          if (updatePayload.iconContentType) updated.iconContentType = updatePayload.iconContentType;
          else delete updated.iconContentType;
          if (updatePayload.iconFileSize > 0) updated.iconFileSize = updatePayload.iconFileSize;
          else delete updated.iconFileSize;
          if (updatePayload.iconUpdatedAt) updated.iconUpdatedAt = updatePayload.iconUpdatedAt;
        } else if (patch.customIconUrl !== undefined && !expectedIconUrl) {
          delete updated.customIconUrl;
          delete updated.iconObjectKey;
          delete updated.iconContentType;
          delete updated.iconFileSize;
          updated.iconCleared = false;
        } else if (patch.iconCleared === false) {
          updated.iconCleared = false;
        }
        return updated;
      });

      if (!foundInList) {
        const baseFallback = DEFAULT_CATEGORY_ITEMS.find((d) => d.slug === cleanSlug);
        const createdEntry: CategoryConfigItem = {
          ...(baseFallback || {
            id: cleanSlug,
            slug: cleanSlug,
            name: String(verifiedData.bn || cleanSlug),
            bn: String(verifiedData.bn || cleanSlug),
            en: String(verifiedData.en || cleanSlug),
            divisionId: resolveSafeDivisionId(verifiedData.divisionId),
            departmentId: resolveSafeDivisionId(verifiedData.divisionId),
            icon: String(verifiedData.iconName || "Users"),
            iconName: String(verifiedData.iconName || "Users"),
            tint: String(verifiedData.tint || "from-emerald-500/15 to-emerald-700/10"),
            description: String(verifiedData.description || ""),
            formType: String(verifiedData.formType || "general"),
            sort_order: typeof verifiedData.sort_order === "number" ? verifiedData.sort_order : freshItems.length + 1,
            displayOrder: typeof verifiedData.sort_order === "number" ? verifiedData.sort_order : freshItems.length + 1,
            visible: verifiedData.visible !== false,
            isActive: verifiedData.visible !== false,
          }),
          ...(expectedIconCleared
            ? { iconCleared: true, customIconUrl: undefined }
            : expectedIconUrl
              ? { customIconUrl: expectedIconUrl, iconCleared: false }
              : {}),
        };
        next.push(createdEntry);
      }

      await persistCategoryWrapper(next);
    },
    [persistCategoryWrapper]
  );

  const addCategory = useCallback(
    async (
      newCat: Omit<CategoryConfigItem, "sort_order"> & { sort_order?: number; customIconUrl?: string }
    ) => {
      const cleanSlug = normalizeCategorySlug(newCat?.slug || "");
      if (!cleanSlug) throw new Error("সঠিক ক্যাটাগরি স্লাগ (ইংরেজি অক্ষর) দিন");
      const currentItems = catStateRef.current.items;
      if (currentItems.some((c) => canonicalMatchKey(c?.slug || "") === canonicalMatchKey(cleanSlug))) {
        throw new Error("এই স্লাগের ক্যাটাগরি ইতিমধ্যে ডেটাবেসে বিদ্যমান রয়েছে");
      }

      const sortOrder = typeof newCat.sort_order === "number" ? newCat.sort_order : currentItems.length + 1;
      const rawCustomIcon = typeof newCat.customIconUrl === "string" ? newCat.customIconUrl.trim() : "";
      let cleanIconUrl: string | undefined;
      if (rawCustomIcon) {
        cleanIconUrl = sanitizeCategoryIconUrl(rawCustomIcon);
        if (!cleanIconUrl) {
          throw new Error("অবৈধ বা অস্থায়ী (blob) আইকন লিংক ডেটাবেসে সংরক্ষণ করা যাবে না।");
        }
      }
      const cleanCustomRoute =
        typeof newCat.customRoute === "string" && newCat.customRoute.trim().length > 0
          ? newCat.customRoute.trim()
          : undefined;
      const safeDivisionId = resolveSafeDivisionId(newCat.divisionId);

      const itemToInsert: CategoryConfigItem = {
        id: cleanSlug,
        slug: cleanSlug,
        name: newCat.bn,
        bn: newCat.bn,
        en: newCat.en || cleanSlug,
        departmentId: safeDivisionId,
        divisionId: safeDivisionId,
        iconName: newCat.iconName || "Users",
        icon: newCat.iconName || "Users",
        tint: newCat.tint || "from-emerald-500/15 to-emerald-700/10",
        description: newCat.description || newCat.bn,
        formType: newCat.formType || "general",
        displayOrder: sortOrder,
        sort_order: sortOrder,
        isActive: newCat.visible !== false,
        visible: newCat.visible !== false,
        isDeleted: false,
        ...(cleanIconUrl
          ? {
              customIconUrl: cleanIconUrl,
              iconCleared: false,
              ...(newCat.iconObjectKey ? { iconObjectKey: newCat.iconObjectKey } : {}),
              ...(newCat.iconContentType ? { iconContentType: newCat.iconContentType } : {}),
              ...(typeof newCat.iconFileSize === "number" && newCat.iconFileSize > 0
                ? { iconFileSize: newCat.iconFileSize }
                : {}),
              iconUpdatedAt: newCat.iconUpdatedAt || new Date().toISOString(),
            }
          : newCat.iconCleared
            ? { iconCleared: true }
            : {}),
        ...(cleanCustomRoute ? { customRoute: cleanCustomRoute } : {}),
      };

      const docRef = doc(db, "categories", cleanSlug);
      const insertPayload = sanitizeFirestorePayload({
        ...itemToInsert,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: auth.currentUser?.email || "admin",
        updatedBy: auth.currentUser?.email || "admin",
      });

      await setDoc(docRef, insertPayload);

      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        throw new Error("ফায়ারবেস ডেটাবেসে ক্যাটাগরি সংরক্ষণ নিশ্চিত করা যায়নি");
      }

      const next: CategoryConfigItem[] = [
        ...catStateRef.current.items.filter((c) => c.slug !== cleanSlug),
        itemToInsert,
      ];
      await persistCategoryWrapper(next, {
        removeDeleted: [cleanSlug],
        removeTrashedSlugs: [cleanSlug],
      });
      return itemToInsert;
    },
    [persistCategoryWrapper]
  );

  const deleteCategory = useCallback(
    async (slug: string, options?: { softDeleteOnly?: boolean; force?: boolean }) => {
      const cleanSlug = normalizeCategorySlug(slug);
      const refs = await checkCategoryReferences(cleanSlug);
      const hasRefs = refs.total > 0;

      if (hasRefs && !options?.softDeleteOnly && !options?.force) {
        throw new Error(
          `এই ক্যাটাগরিতে ${refs.submissionsCount}টি তালিকা এবং ${refs.donationsCount}টি অনুদান রেকর্ড রয়েছে। সরাসরি মুছে ফেলা সম্ভব নয়; নিরাপদে নিষ্ক্রিয় (Trash / Soft Delete) করুন।`
        );
      }

      const currentItems = catStateRef.current.items;
      const existingItem = currentItems.find((c) => c.slug === cleanSlug);
      const docRef = doc(db, "categories", cleanSlug);
      const deletePayload = sanitizeFirestorePayload({
        id: cleanSlug,
        slug: cleanSlug,
        isDeleted: true,
        visible: false,
        isActive: false,
        deletedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || "admin",
      });

      await setDoc(docRef, deletePayload, { merge: true });

      const verifySnap = await getDoc(docRef);
      if (!verifySnap.exists() || verifySnap.data()?.isDeleted !== true) {
        throw new Error("ফায়ারবেস ডেটাবেসে ক্যাটাগরি ডিলিট স্ট্যাটাস নিশ্চিত করা যায়নি।");
      }

      const trashedEntry: CategoryConfigItem | undefined = existingItem
        ? {
            ...existingItem,
            isDeleted: true,
            visible: false,
            isActive: false,
            deletedAt: new Date().toISOString(),
          }
        : undefined;

      const next = catStateRef.current.items.filter((c) => c.slug !== cleanSlug);
      await persistCategoryWrapper(next, {
        addDeleted: [cleanSlug],
        addTrashed: trashedEntry ? [trashedEntry] : [],
      });
    },
    [persistCategoryWrapper]
  );

  const restoreCategory = useCallback(
    async (slug: string) => {
      const cleanSlug = normalizeCategorySlug(slug);
      const currentState = catStateRef.current;
      const trashed = currentState.trashedItems.find((t) => t.slug === cleanSlug);
      const masterFallback = DEFAULT_CATEGORY_ITEMS.find((d) => d.slug === cleanSlug);
      const restoredItem: CategoryConfigItem | undefined = trashed
        ? {
            ...trashed,
            isDeleted: false,
            visible: true,
            isActive: true,
            deletedAt: undefined,
          }
        : masterFallback
          ? { ...masterFallback, isDeleted: false, visible: true, isActive: true }
          : undefined;

      if (!restoredItem) {
        throw new Error("পুনরুদ্ধারের জন্য ট্র্যাশে এই ক্যাটাগরি পাওয়া যায়নি");
      }

      await setDoc(
        doc(db, "categories", cleanSlug),
        sanitizeFirestorePayload({
          ...restoredItem,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.email || "admin",
        }),
        { merge: true }
      );

      await persistCategoryWrapper(
        [...catStateRef.current.items.filter((c) => c.slug !== cleanSlug), restoredItem],
        {
          removeDeleted: [cleanSlug],
          removeTrashedSlugs: [cleanSlug],
        }
      );
      return restoredItem;
    },
    [persistCategoryWrapper]
  );

  const permanentlyDeleteCategory = useCallback(
    async (slug: string) => {
      const cleanSlug = normalizeCategorySlug(slug);
      await deleteDoc(doc(db, "categories", cleanSlug)).catch(() => {});
      await persistCategoryWrapper(
        catStateRef.current.items.filter((c) => c.slug !== cleanSlug),
        {
          addDeleted: [cleanSlug],
          removeTrashedSlugs: [cleanSlug],
        }
      );
    },
    [persistCategoryWrapper]
  );

  const bulkDeleteCategories = useCallback(
    async (slugs: string[], options?: { softDeleteOnly?: boolean; force?: boolean }) => {
      const cleanSlugs = Array.from(new Set(slugs.map(normalizeCategorySlug).filter(Boolean)));
      if (cleanSlugs.length === 0) return { deleted: 0, skipped: [] as string[] };

      const trashedAdditions: CategoryConfigItem[] = [];
      const deletedList: string[] = [];
      const skipped: string[] = [];

      for (const s of cleanSlugs) {
        try {
          const refs = await checkCategoryReferences(s);
          if (refs.total > 0 && !options?.softDeleteOnly && !options?.force) {
            skipped.push(s);
            continue;
          }
          const existingItem = catStateRef.current.items.find((c) => c.slug === s);
          await setDoc(
            doc(db, "categories", s),
            sanitizeFirestorePayload({
              id: s,
              slug: s,
              isDeleted: true,
              visible: false,
              isActive: false,
              deletedAt: new Date().toISOString(),
              updatedAt: serverTimestamp(),
              updatedBy: auth.currentUser?.email || "admin",
            }),
            { merge: true }
          );
          deletedList.push(s);
          if (existingItem) {
            trashedAdditions.push({
              ...existingItem,
              isDeleted: true,
              visible: false,
              isActive: false,
              deletedAt: new Date().toISOString(),
            });
          }
        } catch {
          skipped.push(s);
        }
      }

      if (deletedList.length > 0) {
        await persistCategoryWrapper(
          catStateRef.current.items.filter((c) => !deletedList.includes(c.slug)),
          {
            addDeleted: deletedList,
            addTrashed: trashedAdditions,
          }
        );
      }

      return { deleted: deletedList.length, skipped };
    },
    [persistCategoryWrapper]
  );

  const cleanupDuplicateCategories = useCallback(
    async (docIdsToRemove: string[]) => {
      let removed = 0;
      for (const rawId of docIdsToRemove) {
        const trimmed = String(rawId || "").trim();
        if (!trimmed) continue;
        // Never delete canonical master doc IDs during alias cleanup
        const isMasterCanonical = DEFAULT_CATEGORY_ITEMS.some((m) => m.slug === trimmed);
        if (isMasterCanonical) continue;
        await deleteDoc(doc(db, "categories", trimmed)).catch(() => {});
        removed++;
      }
      setAliasDocIds((prev) => prev.filter((a) => !docIdsToRemove.includes(a.docId)));
      return { removed };
    },
    []
  );

  const exportCategoriesBackupJson = useCallback(() => {
    const current = catStateRef.current;
    const payload = {
      exportedAt: new Date().toISOString(),
      platform: "Smart Noakhali",
      activeCount: current.items.length,
      trashedCount: current.trashedItems.length,
      deletedSlugs: current.deletedSlugs,
      categories: current.items,
      trashedCategories: current.trashedItems,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smart-noakhali-categories-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const moveCategory = useCallback(
    async (slug: string, direction: "up" | "down") => {
      const currentItems = catStateRef.current.items;
      const idx = currentItems.findIndex((c) => c.slug === slug);
      if (idx === -1) return;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= currentItems.length) return;
      const copy = [...currentItems];
      const [moved] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, moved);
      const firstChanged = copy[Math.min(idx, targetIdx)];
      const secondChanged = copy[Math.max(idx, targetIdx)];
      await Promise.all(
        [
          { slug: firstChanged.slug, order: Math.min(idx, targetIdx) + 1 },
          { slug: secondChanged.slug, order: Math.max(idx, targetIdx) + 1 },
        ].map((entry) =>
          setDoc(
            doc(db, "categories", entry.slug),
            sanitizeFirestorePayload({
              slug: entry.slug,
              id: entry.slug,
              sort_order: entry.order,
              displayOrder: entry.order,
              updatedAt: serverTimestamp(),
              updatedBy: auth.currentUser?.email || "admin",
            }),
            { merge: true }
          ).catch(() => {})
        )
      );
      await persistCategoryWrapper(copy);
    },
    [persistCategoryWrapper]
  );

  const resetCategories = useCallback(async () => {
    try {
      localStorage.removeItem(LOCAL_CATEGORIES_KEY);
    } catch {}
    const currentState = catStateRef.current;
    await persistCategoryWrapper(DEFAULT_CATEGORY_ITEMS, {
      removeDeleted: currentState.deletedSlugs,
      removeTrashedSlugs: currentState.trashedItems.map((t) => t.slug),
    });
  }, [persistCategoryWrapper]);

  const duplicateDiagnostics: DuplicateCategoryDiagnostics = useMemo(() => {
    const sameDivMap = new Map<string, string[]>();
    const crossDivMap = new Map<string, Array<{ slug: string; divisionId: string }>>();
    const unassigned: Array<{ slug: string; bn: string; divisionId: string }> = [];

    for (const c of catState.items) {
      const divId = c.divisionId || "";
      if (!divId || !VALID_DIVISION_ID_SET.has(divId)) {
        unassigned.push({ slug: c.slug, bn: c.bn, divisionId: divId || "empty" });
      }
      const normName = (c.bn || "").trim().toLowerCase();
      if (normName) {
        const divKey = `${divId}::${normName}`;
        const list = sameDivMap.get(divKey) || [];
        list.push(c.slug);
        sameDivMap.set(divKey, list);

        const crossList = crossDivMap.get(normName) || [];
        crossList.push({ slug: c.slug, divisionId: divId });
        crossDivMap.set(normName, crossList);
      }
    }

    const sameDivisionDuplicates: DuplicateCategoryDiagnostics["sameDivisionDuplicates"] = [];
    sameDivMap.forEach((slugs, key) => {
      if (slugs.length > 1) {
        const [divisionId, bn] = key.split("::");
        sameDivisionDuplicates.push({ divisionId, bn, slugs });
      }
    });

    const crossDivisionSharedNames: DuplicateCategoryDiagnostics["crossDivisionSharedNames"] = [];
    crossDivMap.forEach((entries, bn) => {
      const uniqueDivs = new Set(entries.map((e) => e.divisionId));
      if (entries.length > 1 && uniqueDivs.size > 1) {
        crossDivisionSharedNames.push({ bn, entries });
      }
    });

    return {
      aliasDocIds,
      sameDivisionDuplicates,
      crossDivisionSharedNames,
      unassignedOrInvalidDivision: unassigned,
    };
  }, [aliasDocIds, catState.items]);

  const allCategories = useMemo(
    () => [...catState.items].sort((a, b) => a.sort_order - b.sort_order).map(toResolvedCategory),
    [catState.items]
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
    rawItems: catState.items,
    trashedCategories: catState.trashedItems,
    deletedSlugs: catState.deletedSlugs,
    duplicateDiagnostics,
    getCategoryBySlug,
    getCategoriesByDivisionId: (divId: string) => visibleCategories.filter((c) => c.divisionId === divId),
    saveCategories,
    updateCategory,
    addCategory,
    deleteCategory,
    restoreCategory,
    permanentlyDeleteCategory,
    bulkDeleteCategories,
    cleanupDuplicateCategories,
    exportCategoriesBackupJson,
    moveCategory,
    resetCategories,
    checkCategoryReferences,
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
    email: "", // Masked for privacy
    full_name: "সুপার অ্যাডমিন",
    username: "super_admin",
    phone: "", // Masked for privacy
    designation: "মেইন সুপার অ্যাডমিন • স্মার্ট নোয়াখালী",
    role_label: "সুপার অ্যাডমিন",
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
    // 1. Direct document read from Firestore immediately on mount
    getDoc(doc(db, "settings", STAFF_PROFILES_CONFIG_ID))
      .then((snap) => {
        if (snap.exists()) {
          const parsed = parseStaffProfiles(snap.data()?.logo_url);
          if (parsed) {
            setProfiles(parsed);
            try {
              localStorage.setItem(LOCAL_STAFF_PROFILES_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      })
      .catch(() => {});

    // 2. Real-time direct doc listener
    const unsubDirect = onSnapshot(
      doc(db, "settings", STAFF_PROFILES_CONFIG_ID),
      (snap) => {
        if (snap.exists()) {
          const parsed = parseStaffProfiles(snap.data()?.logo_url);
          if (parsed) {
            setProfiles(parsed);
            try {
              localStorage.setItem(LOCAL_STAFF_PROFILES_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      },
      () => {}
    );

    return () => unsubDirect();
  }, []);

  const upsertStaffProfile = useCallback(
    async (entry: Partial<StaffProfileEntry> & { uid: string; email?: string }) => {
      const entryEmail = (entry.email || "").trim().toLowerCase();
      const existing = profiles[entry.uid] ||
        Object.values(profiles).find(
          (p) => Boolean(entryEmail && p?.email && typeof p.email === "string" && p.email.trim().toLowerCase() === entryEmail)
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
      if (merged.email && typeof merged.email === "string") {
        nextMap[merged.email.trim().toLowerCase()] = merged;
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
      if (!uidOrEmail || typeof uidOrEmail !== "string") return null;
      const key = uidOrEmail.trim();
      if (!key) return null;
      const lowerKey = key.toLowerCase();
      if (profiles[key]) return profiles[key];
      if (profiles[lowerKey]) return profiles[lowerKey];
      const byMatch = Object.values(profiles).find(
        (p) =>
          p.uid === key ||
          (Boolean(p?.email && typeof p.email === "string" && p.email.trim().toLowerCase() === lowerKey)) ||
          (Boolean(p?.username && typeof p.username === "string" && p.username.trim().toLowerCase() === lowerKey))
      );
      if (byMatch) return byMatch;
      const isCurrentViewerSuperAdmin = isSuperAdminEmail(auth.currentUser?.email);

      if (isSuperAdminEmail(key) || key === "super_admin_mahmudul") {
        const rawProfile = profiles.super_admin_mahmudul || DEFAULT_STAFF_PROFILES.super_admin_mahmudul;
        if (!isCurrentViewerSuperAdmin) {
          // Privacy protection: mask sensitive email, phone, and username for non-super-admin viewers
          return {
            ...rawProfile,
            email: "",
            username: "super_admin",
            full_name: "সুপার অ্যাডমিন",
            phone: "",
            role_label: "সুপার অ্যাডমিন",
            designation: "মেইন সুপার অ্যাডমিন • স্মার্ট নোয়াখালী",
          };
        }
        return {
          ...rawProfile,
          role_label: "সুপার অ্যাডমিন",
        };
      }
      if (lowerKey === REGULAR_ADMIN_EMAIL.toLowerCase()) {
        return {
          uid: key,
          email: REGULAR_ADMIN_EMAIL,
          full_name: "Admin (Smart Noakhali)",
          username: "admin_bear",
          phone: "",
          designation: "অ্যাডমিন • স্মার্ট নোয়াখালী",
          role_label: "অ্যাডমিন",
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

  // Sync directly from Firestore /settings/app_packages_config
  useEffect(() => {
    // 1. Immediate direct read
    getDoc(doc(db, "settings", APP_PACKAGES_CONFIG_ID))
      .then((docSnap) => {
        if (docSnap.exists()) {
          const parsed = parseAppPackages(docSnap.data()?.logo_url);
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
              } catch {}
              return merged;
            });
          }
        }
      })
      .catch(() => {});

    // 2. Direct document listener
    const unsubDirect = onSnapshot(
      doc(db, "settings", APP_PACKAGES_CONFIG_ID),
      (docSnap) => {
        if (docSnap.exists()) {
          const parsed = parseAppPackages(docSnap.data()?.logo_url);
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
              } catch {}
              return merged;
            });
          }
        }
      },
      () => {}
    );

    return () => unsubDirect();
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
  contactPhone?: string;
  contactEmail?: string;
  contactAddress?: string;
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
  tagline: "নোয়াখালী জেলার সকল জরুরি সেবা ও তথ্যের ডিজিটাল প্ল্যাটফর্ম",
  helplinePhone: "01850999178",
  contactPhone: "01850999178",
  contactEmail: "e.smartnoakhali@gmail.com",
  contactAddress: "কালাসর্দ্দা, গোবিন্দপুর, কুতুবের হাট-৩৮৬২, নবীপুর, সেনবাগ, নোয়াখালী, বাংলাদেশ।",
  emergencyNotice: "জরুরি রক্ত বা যেকোনো তথ্যের জন্য নিচের লাইভ চ্যাট বা সহায়তা ব্যবহার করুন।",
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
    // 1. Direct document read from Firestore immediately on mount
    getDoc(doc(db, "settings", SITE_META_CONFIG_ID))
      .then((snap) => {
        if (snap.exists()) {
          const parsed = parseSiteMeta(snap.data()?.logo_url);
          if (parsed) {
            setMeta(parsed);
            try {
              localStorage.setItem(LOCAL_SITE_META_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      })
      .catch(() => {});

    // 2. Real-time direct doc listener
    const unsubDirect = onSnapshot(
      doc(db, "settings", SITE_META_CONFIG_ID),
      (snap) => {
        if (snap.exists()) {
          const parsed = parseSiteMeta(snap.data()?.logo_url);
          if (parsed) {
            setMeta(parsed);
            try {
              localStorage.setItem(LOCAL_SITE_META_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      },
      () => {}
    );

    return () => unsubDirect();
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

// ============================================================================
// 7. Our Services Configuration Hook (/settings/services_config)
// Managed by Main Super Admin for “আমাদের সেবা” (/about & Category view)
// ============================================================================
export interface ServiceItem {
  id: string;
  title: string;
  description: string;
  iconName?: string;
  imageUrl?: string;
  active: boolean;
  sort_order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServicesConfig {
  pageTitle: string;
  pageSubtitle: string;
  services: ServiceItem[];
}

export const DEFAULT_SERVICES_CONFIG: ServicesConfig = {
  pageTitle: "আমাদের সেবা — স্মার্ট নোয়াখালী",
  pageSubtitle:
    "স্মার্ট নোয়াখালী হলো নোয়াখালী জেলার একটি ডিজিটাল সেবা ডিরেক্টরি, যেখানে এক ক্লিকেই পাবেন আইনজীবী, ডাক্তার, পুলিশ, ফায়ার সার্ভিস, রক্তদাতা সহ সকল গুরুত্বপূর্ণ যোগাযোগ।",
  services: [
    {
      id: "srv_emergency_directory",
      title: "জরুরি যোগাযোগ ডিরেক্টরি",
      description: "এলাকার সকল জরুরি সেবার নম্বর (আইনজীবী, ডাক্তার, পুলিশ, ফায়ার সার্ভিস) এক জায়গায় রাখা ও তাৎক্ষণিক কল করার সুবিধা।",
      iconName: "PhoneCall",
      active: true,
      sort_order: 1,
    },
    {
      id: "srv_blood_donor_network",
      title: "স্বেচ্ছা রক্তদাতা নেটওয়ার্ক",
      description: "রক্তদাতাদের সাথে দ্রুত যোগাযোগের সুযোগ ও জরুরি প্রয়োজনে রক্তের আবেদন প্রকাশের সার্বক্ষণিক সুবিধা।",
      iconName: "Droplet",
      active: true,
      sort_order: 2,
    },
    {
      id: "srv_reliable_verified_info",
      title: "স্বচ্ছ ও নির্ভরযোগ্য তথ্য প্রদান",
      description: "নোয়াখালী জেলার প্রতিটি উপজেলা ও ইউনিয়নের সঠিক, আপডেটেড ও যাচাইকৃত সেবা ও যোগাযোগের তথ্য।",
      iconName: "Shield",
      active: true,
      sort_order: 3,
    },
    {
      id: "srv_citizen_digital_platform",
      title: "এলাকাবাসীর সহজ ডিজিটাল প্ল্যাটফর্ম",
      description: "স্মার্টফোন ও ওয়েবে যে কারো ব্যবহারের জন্য অত্যন্ত সহজ ডিজিটাল প্ল্যাটফর্ম এবং সার্বক্ষণিক লাইভ চ্যাট সাপোর্ট।",
      iconName: "Smartphone",
      active: true,
      sort_order: 4,
    },
  ],
};

function parseServicesConfig(raw: string | null | undefined): ServicesConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const pageTitle =
        typeof parsed.pageTitle === "string" && parsed.pageTitle.trim()
          ? parsed.pageTitle.trim()
          : DEFAULT_SERVICES_CONFIG.pageTitle;
      const pageSubtitle =
        typeof parsed.pageSubtitle === "string"
          ? parsed.pageSubtitle
          : DEFAULT_SERVICES_CONFIG.pageSubtitle;
      const rawList = Array.isArray(parsed.services) ? parsed.services : [];
      const services: ServiceItem[] = rawList
        .filter((s: any) => s && typeof s === "object" && s.title)
        .map((s: any, idx: number) => ({
          id: String(s.id || `srv_${idx + 1}`),
          title: String(s.title || "").trim(),
          description: String(s.description || "").trim(),
          iconName: typeof s.iconName === "string" && s.iconName ? s.iconName : undefined,
          imageUrl: typeof s.imageUrl === "string" && s.imageUrl ? s.imageUrl : undefined,
          active: s.active !== false,
          sort_order: typeof s.sort_order === "number" ? s.sort_order : idx + 1,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        }))
        .sort((a: ServiceItem, b: ServiceItem) => a.sort_order - b.sort_order);

      return {
        pageTitle,
        pageSubtitle,
        services: services.length > 0 ? services : DEFAULT_SERVICES_CONFIG.services,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function useServicesConfig() {
  const [config, setConfig] = useState<ServicesConfig>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_SERVICES_KEY);
      return parseServicesConfig(cached) ?? DEFAULT_SERVICES_CONFIG;
    } catch {
      return DEFAULT_SERVICES_CONFIG;
    }
  });

  useEffect(() => {
    // 1. Initial direct document read
    getDoc(doc(db, "settings", SERVICES_CONFIG_ID))
      .then((snap) => {
        if (snap.exists()) {
          const parsed = parseServicesConfig(snap.data()?.logo_url);
          if (parsed) {
            setConfig(parsed);
            try {
              localStorage.setItem(LOCAL_SERVICES_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      })
      .catch(() => {});

    // 2. Real-time direct doc listener
    const unsubDirect = onSnapshot(
      doc(db, "settings", SERVICES_CONFIG_ID),
      (snap) => {
        if (snap.exists()) {
          const parsed = parseServicesConfig(snap.data()?.logo_url);
          if (parsed) {
            setConfig(parsed);
            try {
              localStorage.setItem(LOCAL_SERVICES_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      },
      () => {}
    );

    // 3. Collection query listener for backwards-compatibility
    const q = query(collection(db, "settings"), where("visible", "==", true));
    const unsubCol = onSnapshot(
      q,
      (snap) => {
        const docSnap = snap.docs.find((d) => d.id === SERVICES_CONFIG_ID);
        if (docSnap) {
          const parsed = parseServicesConfig(docSnap.data().logo_url);
          if (parsed) {
            setConfig(parsed);
            try {
              localStorage.setItem(LOCAL_SERVICES_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      },
      () => {}
    );

    return () => {
      unsubDirect();
      unsubCol();
    };
  }, []);

  const saveServicesConfig = useCallback(async (next: ServicesConfig) => {
    const serialized = JSON.stringify(next);
    try {
      localStorage.setItem(LOCAL_SERVICES_KEY, serialized);
    } catch {}
    setConfig(next);
    await upsertSettingDoc(SERVICES_CONFIG_ID, serialized, { visible: true });
  }, []);

  const addService = useCallback(
    async (newService: Omit<ServiceItem, "id" | "sort_order">) => {
      const newId = `srv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const item: ServiceItem = {
        ...newService,
        id: newId,
        sort_order: (config.services?.length || 0) + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const next: ServicesConfig = {
        ...config,
        services: [...config.services, item],
      };
      await saveServicesConfig(next);
      return item;
    },
    [config, saveServicesConfig]
  );

  const updateService = useCallback(
    async (id: string, patch: Partial<ServiceItem>) => {
      const nextServices = config.services.map((s) =>
        s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s
      );
      const next: ServicesConfig = { ...config, services: nextServices };
      await saveServicesConfig(next);
    },
    [config, saveServicesConfig]
  );

  const deleteService = useCallback(
    async (id: string) => {
      const nextServices = config.services
        .filter((s) => s.id !== id)
        .map((s, idx) => ({ ...s, sort_order: idx + 1 }));
      const next: ServicesConfig = { ...config, services: nextServices };
      await saveServicesConfig(next);
    },
    [config, saveServicesConfig]
  );

  const reorderServices = useCallback(
    async (reordered: ServiceItem[]) => {
      const normalized = reordered.map((s, idx) => ({ ...s, sort_order: idx + 1 }));
      const next: ServicesConfig = { ...config, services: normalized };
      await saveServicesConfig(next);
    },
    [config, saveServicesConfig]
  );

  const updatePageHeader = useCallback(
    async (title: string, subtitle: string) => {
      const next: ServicesConfig = {
        ...config,
        pageTitle: title,
        pageSubtitle: subtitle,
      };
      await saveServicesConfig(next);
    },
    [config, saveServicesConfig]
  );

  return {
    config,
    services: config.services,
    saveServicesConfig,
    addService,
    updateService,
    deleteService,
    reorderServices,
    updatePageHeader,
  };
}

// ============================================================================
// 8. Dynamic Hero Banner Configuration Hook (/settings/hero_banner_config)
// ============================================================================
export type HeroImageFocalPosition =
  | "center center"
  | "center top"
  | "center bottom"
  | "left center"
  | "right center"
  | "center 20%"
  | "center 35%"
  | "center 70%"
  | "25% 25%"
  | "75% 25%";

export type HeroLayoutMode = "centered" | "full_width" | "split_left" | "split_right";
export type HeroImageFit = "cover" | "contain";
export type HeroTransitionStyle = "slide" | "fade" | "none";

export interface HeroBannerConfig {
  id?: string;
  name?: string;
  status?: "published" | "draft";
  order?: number;
  startDate?: string;
  endDate?: string;
  textAlign?: "left" | "center" | "right";
  layoutMode?: HeroLayoutMode;
  imageFit?: HeroImageFit;
  desktopHeightPx?: number;
  tabletHeightPx?: number;
  mobileHeightPx?: number;
  visible: boolean;
  badgeText: string;
  headingLine1: string;
  headingLine2: string;
  description: string;
  primaryButtonText: string;
  primaryButtonLink: string;
  secondaryButtonText: string;
  secondaryButtonLink: string;
  optionalButtonText?: string;
  optionalButtonLink?: string;
  optionalText?: string;
  optionalTextColor?: string;
  responsiveLayouts?: HeroResponsiveLayouts;
  backgroundMode: "gradient" | "solid" | "image";
  desktopImageUrl: string;
  mobileImageUrl: string;
  imagePositionDesktop: HeroImageFocalPosition;
  imagePositionTablet?: HeroImageFocalPosition;
  imagePositionMobile: HeroImageFocalPosition;
  overlayColor: string;
  overlayOpacity: number;
  solidColor: string;
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
  textColor: string;
  subtextColor: string;
  badgeColor?: string;
  badgeBgColor?: string;
  headingColor?: string;
  descriptionColor?: string;
  primaryButtonColor?: string;
  primaryButtonBgColor?: string;
  secondaryButtonColor?: string;
  secondaryButtonBgColor?: string;
  optionalButtonColor?: string;
  optionalButtonBgColor?: string;
  borderRadius: "rounded-[12px]" | "rounded-2xl" | "rounded-[26px]" | "rounded-3xl" | "rounded-[32px]";
  showDecorativeGlow: boolean;
  updatedAt?: string;
}

export interface HeroBannerItem extends HeroBannerConfig {
  id: string;
  name: string;
  status: "published" | "draft";
  order: number;
  startDate: string;
  endDate: string;
  textAlign: "left" | "center" | "right";
  layoutMode: HeroLayoutMode;
  imageFit: HeroImageFit;
  desktopHeightPx: number;
  tabletHeightPx: number;
  mobileHeightPx: number;
  badgeColor: string;
  badgeBgColor: string;
  headingColor: string;
  descriptionColor: string;
  primaryButtonColor: string;
  primaryButtonBgColor: string;
  secondaryButtonColor: string;
  secondaryButtonBgColor: string;
  optionalButtonText: string;
  optionalButtonLink: string;
  optionalButtonColor: string;
  optionalButtonBgColor: string;
  optionalText: string;
  optionalTextColor: string;
}

export interface HeroCarouselSettings {
  autoRotate: boolean;
  intervalSeconds: number;
  showArrows: boolean;
  showDots: boolean;
  pauseOnHover: boolean;
  transitionStyle: HeroTransitionStyle;
  lockUniformDimensions?: boolean;
  uniformDesktopHeightPx?: number;
  uniformTabletHeightPx?: number;
  uniformMobileHeightPx?: number;
}

export interface HeroBannersStorePayload {
  banners: HeroBannerItem[];
  carousel: HeroCarouselSettings;
  updatedAt?: string;
}

export const DEFAULT_HERO_CAROUSEL_SETTINGS: HeroCarouselSettings = {
  autoRotate: true,
  intervalSeconds: 5,
  showArrows: true,
  showDots: true,
  pauseOnHover: true,
  transitionStyle: "slide",
  lockUniformDimensions: true,
  uniformDesktopHeightPx: 336,
  uniformTabletHeightPx: 324,
  uniformMobileHeightPx: 308,
};

export const DEFAULT_HERO_BANNER_ITEM: HeroBannerItem = {
  id: "hero_main_1",
  name: "প্রধান ডিজিটাল সেবা ব্যানার",
  status: "published",
  order: 0,
  startDate: "",
  endDate: "",
  textAlign: "left",
  layoutMode: "centered",
  imageFit: "cover",
  desktopHeightPx: 336,
  tabletHeightPx: 324,
  mobileHeightPx: 308,
  visible: true,
  badgeText: "",
  headingLine1: "নোয়াখালীর প্রয়োজনে, এক জায়গায়",
  headingLine2: "",
  description: "রক্ত, চিকিৎসা, আইনি সহায়তা ও জরুরি যোগাযোগ",
  primaryButtonText: "জরুরি ৯৯৯",
  primaryButtonLink: "tel:999",
  secondaryButtonText: "",
  secondaryButtonLink: "/submit-info",
  optionalButtonText: "",
  optionalButtonLink: "",
  optionalText: "",
  optionalTextColor: "#ffffff",
  backgroundMode: "image",
  desktopImageUrl: "/hero-noakhali.jpg",
  mobileImageUrl: "/hero-noakhali.jpg",
  imagePositionDesktop: "center center",
  imagePositionTablet: "center center",
  imagePositionMobile: "center center",
  overlayColor: "#0F4D3A",
  overlayOpacity: 45,
  solidColor: "#0F4D3A",
  gradientFrom: "#0F4D3A",
  gradientVia: "#0F4D3A",
  gradientTo: "#0F4D3A",
  textColor: "#ffffff",
  subtextColor: "#FAF7F2",
  badgeColor: "#ffffff",
  badgeBgColor: "rgba(255,255,255,0.14)",
  headingColor: "#ffffff",
  descriptionColor: "#FAF7F2",
  primaryButtonColor: "#ffffff",
  primaryButtonBgColor: "#C62828",
  secondaryButtonColor: "#0F4D3A",
  secondaryButtonBgColor: "#ffffff",
  optionalButtonColor: "#ffffff",
  optionalButtonBgColor: "rgba(255,255,255,0.16)",
  borderRadius: "rounded-[12px]",
  showDecorativeGlow: false,
};

export const DEFAULT_HERO_BANNER_CONFIG: HeroBannerConfig = DEFAULT_HERO_BANNER_ITEM;

function normalizeHeroBannerItem(
  rawItem: Partial<HeroBannerItem>,
  idx: number
): HeroBannerItem {
  const layoutMode: HeroLayoutMode =
    rawItem.layoutMode === "full_width" ||
    rawItem.layoutMode === "split_left" ||
    rawItem.layoutMode === "split_right"
      ? rawItem.layoutMode
      : "centered";
  const imageFit: HeroImageFit = rawItem.imageFit === "contain" ? "contain" : "cover";
  const desktopHeightPx =
    typeof rawItem.desktopHeightPx === "number" && !Number.isNaN(rawItem.desktopHeightPx)
      ? Math.min(560, Math.max(240, Math.round(rawItem.desktopHeightPx)))
      : DEFAULT_HERO_BANNER_ITEM.desktopHeightPx;
  const tabletHeightPx =
    typeof rawItem.tabletHeightPx === "number" && !Number.isNaN(rawItem.tabletHeightPx)
      ? Math.min(520, Math.max(240, Math.round(rawItem.tabletHeightPx)))
      : DEFAULT_HERO_BANNER_ITEM.tabletHeightPx;
  const mobileHeightPx =
    typeof rawItem.mobileHeightPx === "number" && !Number.isNaN(rawItem.mobileHeightPx)
      ? Math.min(480, Math.max(240, Math.round(rawItem.mobileHeightPx)))
      : DEFAULT_HERO_BANNER_ITEM.mobileHeightPx;
  const resolvedTextAlign: "left" | "center" | "right" =
    rawItem.textAlign === "left" || rawItem.textAlign === "center" || rawItem.textAlign === "right"
      ? rawItem.textAlign
      : DEFAULT_HERO_BANNER_ITEM.textAlign;

  const merged: HeroBannerItem = {
    ...DEFAULT_HERO_BANNER_ITEM,
    ...rawItem,
    id: String(rawItem.id || `hero_banner_${idx + 1}`).trim(),
    name: String(rawItem.name || `হিরো ব্যানার #${idx + 1}`).trim(),
    status: rawItem.status === "draft" ? "draft" : "published",
    order: typeof rawItem.order === "number" ? rawItem.order : idx,
    startDate: String(rawItem.startDate || ""),
    endDate: String(rawItem.endDate || ""),
    textAlign: resolvedTextAlign,
    layoutMode,
    imageFit,
    desktopHeightPx,
    tabletHeightPx,
    mobileHeightPx,
    imagePositionDesktop: rawItem.imagePositionDesktop || "center center",
    imagePositionTablet:
      rawItem.imagePositionTablet || rawItem.imagePositionDesktop || "center center",
    imagePositionMobile: rawItem.imagePositionMobile || "center center",
    visible: rawItem.visible !== false,
    showDecorativeGlow: Boolean(rawItem.showDecorativeGlow),
    overlayOpacity:
      typeof rawItem.overlayOpacity === "number"
        ? Math.min(90, Math.max(0, rawItem.overlayOpacity))
        : DEFAULT_HERO_BANNER_ITEM.overlayOpacity,
    headingColor: rawItem.headingColor || rawItem.textColor || DEFAULT_HERO_BANNER_ITEM.headingColor,
    descriptionColor:
      rawItem.descriptionColor || rawItem.subtextColor || DEFAULT_HERO_BANNER_ITEM.descriptionColor,
    badgeColor: rawItem.badgeColor || rawItem.textColor || DEFAULT_HERO_BANNER_ITEM.badgeColor,
    badgeBgColor: rawItem.badgeBgColor || DEFAULT_HERO_BANNER_ITEM.badgeBgColor,
    primaryButtonColor: rawItem.primaryButtonColor || DEFAULT_HERO_BANNER_ITEM.primaryButtonColor,
    primaryButtonBgColor:
      rawItem.primaryButtonBgColor || DEFAULT_HERO_BANNER_ITEM.primaryButtonBgColor,
    secondaryButtonColor:
      rawItem.secondaryButtonColor || DEFAULT_HERO_BANNER_ITEM.secondaryButtonColor,
    secondaryButtonBgColor:
      rawItem.secondaryButtonBgColor || DEFAULT_HERO_BANNER_ITEM.secondaryButtonBgColor,
    optionalButtonText: rawItem.optionalButtonText || "",
    optionalButtonLink: rawItem.optionalButtonLink || "",
    optionalButtonColor:
      rawItem.optionalButtonColor || DEFAULT_HERO_BANNER_ITEM.optionalButtonColor,
    optionalButtonBgColor:
      rawItem.optionalButtonBgColor || DEFAULT_HERO_BANNER_ITEM.optionalButtonBgColor,
    optionalText: rawItem.optionalText || "",
    optionalTextColor:
      rawItem.optionalTextColor || DEFAULT_HERO_BANNER_ITEM.optionalTextColor,
    responsiveLayouts: normalizeResponsiveLayouts(rawItem.responsiveLayouts, resolvedTextAlign),
  };
  return merged;
}

function parseHeroBannersPayload(raw: string | null | undefined): HeroBannersStorePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.banners)) {
        const list = parsed.banners
          .filter((x: unknown) => Boolean(x && typeof x === "object"))
          .map((item: Partial<HeroBannerItem>, idx: number) => normalizeHeroBannerItem(item, idx))
          .sort((a: HeroBannerItem, b: HeroBannerItem) => a.order - b.order);
        const rawStyle = parsed?.carousel?.transitionStyle;
        const transitionStyle: HeroTransitionStyle =
          rawStyle === "fade" || rawStyle === "none" ? rawStyle : "slide";
        return {
          banners: list.length > 0 ? list : [DEFAULT_HERO_BANNER_ITEM],
          carousel: {
            ...DEFAULT_HERO_CAROUSEL_SETTINGS,
            ...(parsed.carousel && typeof parsed.carousel === "object" ? parsed.carousel : {}),
            transitionStyle,
            lockUniformDimensions: parsed?.carousel?.lockUniformDimensions !== false,
            uniformDesktopHeightPx: Math.min(
              560,
              Math.max(240, Number(parsed?.carousel?.uniformDesktopHeightPx ?? 336))
            ),
            uniformTabletHeightPx: Math.min(
              520,
              Math.max(240, Number(parsed?.carousel?.uniformTabletHeightPx ?? 324))
            ),
            uniformMobileHeightPx: Math.min(
              480,
              Math.max(240, Number(parsed?.carousel?.uniformMobileHeightPx ?? 308))
            ),
            intervalSeconds: Math.min(
              20,
              Math.max(2, Number(parsed?.carousel?.intervalSeconds ?? 5))
            ),
          },
          updatedAt: parsed.updatedAt,
        };
      }
      // Migrate legacy single-banner config cleanly
      const single = normalizeHeroBannerItem(parsed as Partial<HeroBannerItem>, 0);
      return {
        banners: [single],
        carousel: DEFAULT_HERO_CAROUSEL_SETTINGS,
        updatedAt: single.updatedAt,
      };
    }
  } catch {
    // ignore malformed json
  }
  return null;
}

export function isBannerWithinSchedule(b: HeroBannerItem, nowMs = Date.now()): boolean {
  if (!b.visible || b.status === "draft") return false;
  if (b.startDate) {
    const startMs = Date.parse(b.startDate);
    if (!Number.isNaN(startMs) && nowMs < startMs) return false;
  }
  if (b.endDate) {
    const endMs = Date.parse(b.endDate);
    if (!Number.isNaN(endMs) && nowMs > endMs) return false;
  }
  return true;
}

const HERO_IMG_SETTING_PREFIX = "sn-setting://";
const heroImgCache = new Map<string, string>();
const heroDataUrlToKeyCache = new Map<string, string>();

function buildHeroImgSettingKey(bannerId: string, slot: "desktop" | "mobile"): string {
  const safeId = (bannerId || "banner")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 48);
  return `hero_img_${safeId || "banner"}_${slot}`;
}

function hydrateHeroImageSyncFromLocal(url: string): string {
  if (!url || !url.startsWith(HERO_IMG_SETTING_PREFIX)) return url;
  const key = url.slice(HERO_IMG_SETTING_PREFIX.length).trim();
  if (!key) return "";
  const cached = heroImgCache.get(key);
  if (cached) return cached;
  try {
    const localVal = localStorage.getItem(`sn_${key}`);
    if (localVal) {
      heroImgCache.set(key, localVal);
      heroDataUrlToKeyCache.set(localVal, key);
      return localVal;
    }
  } catch {
    // ignore
  }
  return "";
}

function hydratePayloadSyncFromLocal(raw: HeroBannersStorePayload): HeroBannersStorePayload {
  return {
    ...raw,
    banners: raw.banners.map((b) => ({
      ...b,
      desktopImageUrl: hydrateHeroImageSyncFromLocal(b.desktopImageUrl),
      mobileImageUrl: hydrateHeroImageSyncFromLocal(b.mobileImageUrl),
    })),
  };
}

async function resolveHeroImageRef(url: string): Promise<string> {
  if (!url || !url.startsWith(HERO_IMG_SETTING_PREFIX)) return url;
  const key = url.slice(HERO_IMG_SETTING_PREFIX.length).trim();
  if (!/^hero_img_[a-zA-Z0-9_-]+$/.test(key)) return "";

  const memHit = heroImgCache.get(key);
  if (memHit) return memHit;

  try {
    const snap = await getDoc(doc(db, "settings", key));
    if (snap.exists()) {
      const val = snap.data()?.logo_url;
      if (typeof val === "string" && val.trim()) {
        heroImgCache.set(key, val);
        heroDataUrlToKeyCache.set(val, key);
        try {
          localStorage.setItem(`sn_${key}`, val);
        } catch {
          // ignore quota error
        }
        return val;
      }
    }
  } catch {
    // fallback to localStorage cache if offline
  }

  return hydrateHeroImageSyncFromLocal(url);
}

async function hydrateHeroBannersPayload(
  raw: HeroBannersStorePayload
): Promise<HeroBannersStorePayload> {
  const hydratedBanners = await Promise.all(
    raw.banners.map(async (b) => {
      const [desktopUrl, mobileUrl] = await Promise.all([
        resolveHeroImageRef(b.desktopImageUrl),
        resolveHeroImageRef(b.mobileImageUrl),
      ]);
      return {
        ...b,
        desktopImageUrl: desktopUrl,
        mobileImageUrl: mobileUrl,
      };
    })
  );
  return {
    ...raw,
    banners: hydratedBanners,
  };
}

async function offloadHeroImageIfNeeded(
  bannerId: string,
  slot: "desktop" | "mobile",
  rawUrl: string
): Promise<{ storedRef: string; displayUrl: string }> {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) return { storedRef: "", displayUrl: "" };

  // External / Firebase Storage HTTPS URLs don't need Firestore asset offloading
  if (!trimmed.startsWith("data:")) {
    return { storedRef: trimmed, displayUrl: trimmed };
  }

  const settingKey = buildHeroImgSettingKey(bannerId, slot);
  const existingKeyForData = heroDataUrlToKeyCache.get(trimmed);
  if (existingKeyForData === settingKey && heroImgCache.get(settingKey) === trimmed) {
    // Unchanged embedded image — avoid redundant Firestore asset write
    return {
      storedRef: `${HERO_IMG_SETTING_PREFIX}${settingKey}`,
      displayUrl: trimmed,
    };
  }

  let finalDataUrl = trimmed;
  if (finalDataUrl.length > 250000) {
    finalDataUrl = await compressDataUrlToWebP(finalDataUrl, 165 * 1024);
  }
  if (finalDataUrl.length > 290000) {
    throw new Error(
      "ব্যানার ছবিটি অতিরিক্ত বড়। অনুগ্রহ করে আরও ছোট বা কম রেজোলিউশনের ছবি আপলোড করুন।"
    );
  }

  await upsertSettingDoc(settingKey, finalDataUrl, { visible: true });
  heroImgCache.set(settingKey, finalDataUrl);
  heroDataUrlToKeyCache.set(finalDataUrl, settingKey);
  try {
    localStorage.setItem(`sn_${settingKey}`, finalDataUrl);
  } catch {
    // ignore quota error
  }

  return {
    storedRef: `${HERO_IMG_SETTING_PREFIX}${settingKey}`,
    displayUrl: finalDataUrl,
  };
}

export async function deleteHeroImageAsset(
  bannerId: string,
  slot: "desktop" | "mobile"
): Promise<void> {
  const settingKey = buildHeroImgSettingKey(bannerId, slot);
  const cachedVal = heroImgCache.get(settingKey);
  if (cachedVal) {
    heroDataUrlToKeyCache.delete(cachedVal);
  }
  heroImgCache.delete(settingKey);
  try {
    localStorage.removeItem(`sn_${settingKey}`);
  } catch {
    // ignore
  }
  try {
    await deleteDoc(doc(db, "settings", settingKey));
  } catch {
    // ignore missing doc or offline cleanup
  }
}

export function useHeroBannerConfig() {
  const initialHydrated = useMemo(() => {
    try {
      const cached = localStorage.getItem(LOCAL_HERO_BANNER_KEY);
      const parsed = parseHeroBannersPayload(cached);
      if (parsed) {
        return {
          hasCache: true,
          payload: hydratePayloadSyncFromLocal(parsed),
        };
      }
    } catch {
      // ignore
    }
    return {
      hasCache: false,
      payload: {
        banners: [DEFAULT_HERO_BANNER_ITEM],
        carousel: DEFAULT_HERO_CAROUSEL_SETTINGS,
      },
    };
  }, []);

  const [payload, setPayload] = useState<HeroBannersStorePayload>(initialHydrated.payload);
  const [loading, setLoading] = useState(!initialHydrated.hasCache);
  const payloadRef = useRef<HeroBannersStorePayload>(payload);
  payloadRef.current = payload;

  useEffect(() => {
    let active = true;
    let firestoreApplied = false;
    let applySeq = 0;

    const safetyTimer = setTimeout(() => {
      if (active) setLoading(false);
    }, 2500);

    const applyParsedPayload = async (
      parsed: HeroBannersStorePayload | null,
      source: "firestore" | "api"
    ) => {
      if (!active || !parsed) return;
      if (source === "api" && firestoreApplied) return;
      if (source === "firestore") firestoreApplied = true;

      const mySeq = ++applySeq;
      const hydrated = await hydrateHeroBannersPayload(parsed);
      if (!active || mySeq !== applySeq) return;

      payloadRef.current = hydrated;
      setPayload(hydrated);
      try {
        localStorage.setItem(LOCAL_HERO_BANNER_KEY, JSON.stringify(parsed));
      } catch {
        // ignore
      }
    };

    getDoc(doc(db, "settings", HERO_BANNER_CONFIG_ID))
      .then(async (snap) => {
        if (!active) return;
        if (snap.exists()) {
          const parsed = parseHeroBannersPayload(snap.data()?.logo_url);
          if (parsed) {
            await applyParsedPayload(parsed, "firestore");
          }
        }
        if (active) setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    fetch(`/api/content?collection=settings&id=${HERO_BANNER_CONFIG_ID}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(async (d) => {
        if (!active || firestoreApplied) return;
        if (d?.item?.logo_url) {
          const parsed = parseHeroBannersPayload(d.item.logo_url);
          if (parsed) {
            await applyParsedPayload(parsed, "api");
            if (active) setLoading(false);
          }
        }
      })
      .catch(() => {});

    const unsubDirect = onSnapshot(
      doc(db, "settings", HERO_BANNER_CONFIG_ID),
      async (snap) => {
        if (!active) return;
        if (snap.exists()) {
          const parsed = parseHeroBannersPayload(snap.data()?.logo_url);
          if (parsed) {
            await applyParsedPayload(parsed, "firestore");
          }
        }
        if (active) setLoading(false);
      },
      () => {
        if (active) setLoading(false);
      }
    );

    return () => {
      active = false;
      clearTimeout(safetyTimer);
      unsubDirect();
    };
  }, []);

  const persistBannersPayload = useCallback(async (nextPayload: HeroBannersStorePayload) => {
    if (!auth.currentUser || !isSuperAdminEmail(auth.currentUser.email)) {
      throw new Error(
        "হিরো ব্যানার ডাটাবেজে সেভ করতে মূল সুপার অ্যাডমিন অ্যাকাউন্টে (Firebase Auth) লগইন থাকা প্রয়োজন।"
      );
    }

    const nowIso = new Date().toISOString();
    const normalizedBanners = nextPayload.banners.map((b, idx) =>
      normalizeHeroBannerItem({ ...b, order: idx, updatedAt: nowIso }, idx)
    );

    const processedPairs = await Promise.all(
      normalizedBanners.map(async (b) => {
        const [desktopRes, mobileRes] = await Promise.all([
          offloadHeroImageIfNeeded(b.id, "desktop", b.desktopImageUrl),
          offloadHeroImageIfNeeded(b.id, "mobile", b.mobileImageUrl),
        ]);
        return {
          stored: {
            ...b,
            desktopImageUrl: desktopRes.storedRef,
            mobileImageUrl: mobileRes.storedRef,
          },
          display: {
            ...b,
            desktopImageUrl: desktopRes.displayUrl,
            mobileImageUrl: mobileRes.displayUrl,
          },
        };
      })
    );

    const cleanCarousel: HeroCarouselSettings = {
      ...DEFAULT_HERO_CAROUSEL_SETTINGS,
      ...nextPayload.carousel,
      lockUniformDimensions: nextPayload.carousel?.lockUniformDimensions !== false,
      uniformDesktopHeightPx: Math.min(
        560,
        Math.max(240, Number(nextPayload.carousel?.uniformDesktopHeightPx ?? 336))
      ),
      uniformTabletHeightPx: Math.min(
        520,
        Math.max(240, Number(nextPayload.carousel?.uniformTabletHeightPx ?? 324))
      ),
      uniformMobileHeightPx: Math.min(
        480,
        Math.max(240, Number(nextPayload.carousel?.uniformMobileHeightPx ?? 308))
      ),
      intervalSeconds: Math.min(20, Math.max(2, Number(nextPayload.carousel?.intervalSeconds ?? 5))),
    };

    const storagePayload: HeroBannersStorePayload = {
      banners: processedPairs.map((p) => p.stored),
      carousel: cleanCarousel,
      updatedAt: nowIso,
    };

    const displayPayload: HeroBannersStorePayload = {
      banners: processedPairs.map((p) => p.display),
      carousel: cleanCarousel,
      updatedAt: nowIso,
    };

    const serialized = JSON.stringify(storagePayload);
    if (serialized.length > 290000) {
      throw new Error(
        "মোট ব্যানার কনফিগারেশন সাইজ সীমা অতিক্রম করেছে। অনুগ্রহ করে পুরোনো অব্যবহৃত ব্যানার কমিয়ে চেষ্টা করুন।"
      );
    }

    // Confirm Firestore write BEFORE mutating local cache or React state
    await upsertSettingDoc(HERO_BANNER_CONFIG_ID, serialized, { visible: true });

    try {
      localStorage.setItem(LOCAL_HERO_BANNER_KEY, serialized);
    } catch {
      // ignore quota error
    }
    payloadRef.current = displayPayload;
    setPayload(displayPayload);
    return displayPayload;
  }, []);

  const activeBanners = useMemo(
    () =>
      [...payload.banners]
        .sort((a, b) => a.order - b.order)
        .filter((b) => isBannerWithinSchedule(b)),
    [payload.banners]
  );

  const primaryBanner = activeBanners[0] ?? payload.banners[0] ?? DEFAULT_HERO_BANNER_ITEM;

  const saveBanner = useCallback(
    async (item: HeroBannerItem) => {
      const current = payloadRef.current;
      const idx = current.banners.findIndex((b) => b.id === item.id);
      const nextList =
        idx >= 0
          ? current.banners.map((b, i) => (i === idx ? item : b))
          : [...current.banners, { ...item, order: current.banners.length }];
      return persistBannersPayload({ ...current, banners: nextList });
    },
    [persistBannersPayload]
  );

  const addBanner = useCallback(
    async (partial?: Partial<HeroBannerItem>) => {
      const current = payloadRef.current;
      const nextIndex = current.banners.length + 1;
      const newBanner = normalizeHeroBannerItem(
        {
          ...DEFAULT_HERO_BANNER_ITEM,
          ...partial,
          status: partial?.status === "published" ? "published" : "draft",
          id: `hero_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          name: partial?.name || `নতুন হিরো ব্যানার #${nextIndex}`,
          order: current.banners.length,
        },
        current.banners.length
      );
      await persistBannersPayload({
        ...current,
        banners: [...current.banners, newBanner],
      });
      return newBanner;
    },
    [persistBannersPayload]
  );

  const duplicateBanner = useCallback(
    async (bannerId: string) => {
      const current = payloadRef.current;
      const src = current.banners.find((b) => b.id === bannerId);
      if (!src) return null;
      const copyItem = normalizeHeroBannerItem(
        {
          ...src,
          id: `hero_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          name: `${src.name} (কপি)`,
          status: "draft",
          order: current.banners.length,
        },
        current.banners.length
      );
      await persistBannersPayload({
        ...current,
        banners: [...current.banners, copyItem],
      });
      return copyItem;
    },
    [persistBannersPayload]
  );

  const deleteBanner = useCallback(
    async (bannerId: string) => {
      const current = payloadRef.current;
      if (current.banners.length <= 1) {
        throw new Error("অন্তত একটি প্রধান হিরো ব্যানার রাখা আবশ্যক।");
      }
      const nextList = current.banners.filter((b) => b.id !== bannerId);
      const saved = await persistBannersPayload({ ...current, banners: nextList });
      void Promise.all([
        deleteHeroImageAsset(bannerId, "desktop"),
        deleteHeroImageAsset(bannerId, "mobile"),
      ]);
      return saved;
    },
    [persistBannersPayload]
  );

  const reorderBanners = useCallback(
    async (bannerId: string, direction: "up" | "down") => {
      const current = payloadRef.current;
      const sorted = [...current.banners].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((b) => b.id === bannerId);
      if (idx < 0) return current;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= sorted.length) return current;
      const [moved] = sorted.splice(idx, 1);
      sorted.splice(targetIdx, 0, moved);
      return persistBannersPayload({ ...current, banners: sorted });
    },
    [persistBannersPayload]
  );

  const saveCarouselSettings = useCallback(
    async (carousel: HeroCarouselSettings) => {
      const current = payloadRef.current;
      return persistBannersPayload({ ...current, carousel });
    },
    [persistBannersPayload]
  );

  const saveHeroBannerConfig = useCallback(
    async (next: HeroBannerConfig) => {
      const targetId = next.id || primaryBanner.id;
      const normalized = normalizeHeroBannerItem({ ...next, id: targetId }, 0);
      await saveBanner(normalized);
      return normalized;
    },
    [primaryBanner.id, saveBanner]
  );

  const resetHeroBannerConfig = useCallback(async () => {
    const current = payloadRef.current;
    const oldIds = current.banners.map((b) => b.id);
    const result = await persistBannersPayload({
      banners: [DEFAULT_HERO_BANNER_ITEM],
      carousel: DEFAULT_HERO_CAROUSEL_SETTINGS,
    });
    for (const oldId of oldIds) {
      if (oldId !== DEFAULT_HERO_BANNER_ITEM.id) {
        void Promise.all([
          deleteHeroImageAsset(oldId, "desktop"),
          deleteHeroImageAsset(oldId, "mobile"),
        ]);
      }
    }
    return result;
  }, [persistBannersPayload]);

  return {
    banner: primaryBanner,
    banners: payload.banners,
    activeBanners,
    carousel: payload.carousel,
    loading,
    saveBanner,
    addBanner,
    duplicateBanner,
    deleteBanner,
    reorderBanners,
    saveCarouselSettings,
    saveAllHeroBanners: persistBannersPayload,
    saveHeroBannerConfig,
    resetHeroBannerConfig,
    defaultBanner: DEFAULT_HERO_BANNER_ITEM,
  };
}

// ============================================================================
// 9. Homepage Quick Actions, Shortcuts, Announcements & Section Visibility (/settings/homepage_config)
// ============================================================================
export interface HomepageQuickAction {
  id: string;
  label: string;
  to: string;
  tone: "red" | "rose" | "emerald" | "blue" | "amber";
  iconName: string;
  visible: boolean;
}

export interface HomepageFeaturedShortcut {
  id: string;
  title: string;
  subtitle: string;
  to: string;
  iconName: string;
  tone: "primary" | "blue" | "emerald" | "amber" | "rose";
  visible: boolean;
}

export interface HomepageAnnouncement {
  visible: boolean;
  title: string;
  text: string;
  link: string;
  tone: "emerald" | "amber" | "rose" | "blue";
}

export interface HomepageConfig {
  showHero: boolean;
  showQuickActions: boolean;
  showFeaturedShortcuts: boolean;
  showEmergencyBanner: boolean;
  showDivisions: boolean;
  showFooterAppCallout: boolean;
  quickActions: HomepageQuickAction[];
  featuredShortcuts: HomepageFeaturedShortcut[];
  announcement: HomepageAnnouncement;
  updatedAt?: string;
}

export const DEFAULT_HOMEPAGE_CONFIG: HomepageConfig = {
  showHero: true,
  showQuickActions: true,
  showFeaturedShortcuts: true,
  showEmergencyBanner: true,
  showDivisions: true,
  showFooterAppCallout: true,
  quickActions: [
    {
      id: "qa_emergency_blood",
      label: "জরুরি রক্ত",
      to: "/emergency-request",
      tone: "red",
      iconName: "ShieldAlert",
      visible: true,
    },
    {
      id: "qa_blood_donor",
      label: "রক্তদাতা খুঁজুন",
      to: "/blood-donor",
      tone: "emerald",
      iconName: "Droplet",
      visible: true,
    },
  ],
  featuredShortcuts: [
    {
      id: "fs_map",
      title: "নোয়াখালী ম্যাপ",
      subtitle: "৯ উপজেলা ও দূরত্ব",
      to: "/map",
      iconName: "MapPin",
      tone: "primary",
      visible: true,
    },
    {
      id: "fs_directory",
      title: "ডিরেক্টরি",
      subtitle: "প্রতিষ্ঠান ও ব্যবসা",
      to: "/directory",
      iconName: "Building2",
      tone: "blue",
      visible: true,
    },
    {
      id: "fs_career",
      title: "শিক্ষা ও ক্যারিয়ার",
      subtitle: "চাকরি ও প্রতিষ্ঠান",
      to: "/career",
      iconName: "Briefcase",
      tone: "emerald",
      visible: true,
    },
    {
      id: "fs_complaint",
      title: "অভিযোগ ট্র্যাকিং",
      subtitle: "লাইভ অগ্রগতি",
      to: "/complaint-tracking",
      iconName: "AlertTriangle",
      tone: "amber",
      visible: true,
    },
  ],
  announcement: {
    visible: false,
    title: "গুরুত্বপূর্ণ ঘোষণা",
    text: "",
    link: "",
    tone: "amber",
  },
};

function parseHomepageConfig(raw: string | null | undefined): HomepageConfig | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === "object") {
      return {
        ...DEFAULT_HOMEPAGE_CONFIG,
        ...p,
        quickActions: Array.isArray(p.quickActions) && p.quickActions.length > 0
          ? p.quickActions
          : DEFAULT_HOMEPAGE_CONFIG.quickActions,
        featuredShortcuts: Array.isArray(p.featuredShortcuts) && p.featuredShortcuts.length > 0
          ? p.featuredShortcuts
          : DEFAULT_HOMEPAGE_CONFIG.featuredShortcuts,
        announcement: {
          ...DEFAULT_HOMEPAGE_CONFIG.announcement,
          ...(p.announcement && typeof p.announcement === "object" ? p.announcement : {}),
        },
      };
    }
  } catch {}
  return null;
}

export function useHomepageConfig() {
  const [homepageConfig, setHomepageConfig] = useState<HomepageConfig>(() => {
    try {
      return parseHomepageConfig(localStorage.getItem(LOCAL_HOMEPAGE_KEY)) ?? DEFAULT_HOMEPAGE_CONFIG;
    } catch {
      return DEFAULT_HOMEPAGE_CONFIG;
    }
  });

  useEffect(() => {
    fetch(`/api/content?collection=settings&id=${HOMEPAGE_CONFIG_ID}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.item?.logo_url) {
          const parsed = parseHomepageConfig(d.item.logo_url);
          if (parsed) {
            setHomepageConfig(parsed);
            try {
              localStorage.setItem(LOCAL_HOMEPAGE_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      })
      .catch(() => {});

    const unsub = onSnapshot(
      doc(db, "settings", HOMEPAGE_CONFIG_ID),
      (snap) => {
        if (snap.exists()) {
          const parsed = parseHomepageConfig(snap.data()?.logo_url);
          if (parsed) {
            setHomepageConfig(parsed);
            try {
              localStorage.setItem(LOCAL_HOMEPAGE_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  const saveHomepageConfig = useCallback(async (next: HomepageConfig) => {
    const cleanNext: HomepageConfig = {
      ...DEFAULT_HOMEPAGE_CONFIG,
      ...next,
      updatedAt: new Date().toISOString(),
    };
    const serialized = JSON.stringify(cleanNext);
    try {
      localStorage.setItem(LOCAL_HOMEPAGE_KEY, serialized);
    } catch {}
    setHomepageConfig(cleanNext);
    await upsertSettingDoc(HOMEPAGE_CONFIG_ID, serialized, { visible: true });
    return cleanNext;
  }, []);

  return {
    homepageConfig,
    saveHomepageConfig,
    resetHomepageConfig: () => saveHomepageConfig(DEFAULT_HOMEPAGE_CONFIG),
  };
}

// ============================================================================
// 10. Website Content, FAQ, Public Notices, Footer, Social & Theme Config (/settings/website_content_config)
// ============================================================================
export type ThemeAccentPreset = "emerald" | "teal" | "blue" | "gold";

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  visible: boolean;
}

export interface PublicNoticeEntry {
  id: string;
  title: string;
  body: string;
  date: string;
  visible: boolean;
}

export interface WebsiteContentConfig {
  aboutMissionGoals: string[];
  faqItems: FaqEntry[];
  publicNotices: PublicNoticeEntry[];
  footerCopyright: string;
  footerTagline: string;
  footerLinks: Array<{ label: string; to: string }>;
  socialLinks: {
    facebook: string;
    youtube: string;
    website: string;
    whatsapp: string;
  };
  seoTitle: string;
  seoDescription: string;
  themeAccent: ThemeAccentPreset;
  updatedAt?: string;
}

export const DEFAULT_WEBSITE_CONTENT_CONFIG: WebsiteContentConfig = {
  aboutMissionGoals: [
    "নোয়াখালী জেলার প্রতিটি উপজেলা ও ইউনিয়নের সঠিক যোগাযোগ তথ্য এক ক্লিকে প্রদান।",
    "জরুরি প্রয়োজনে ২৪ ঘণ্টা স্বেচ্ছায় রক্তদাতাদের সাথে দ্রুত সংযোগ স্থাপন।",
    "সব ধরনের সরকারি, বেসরকারি, আইনি ও জরুরি সেবা সম্পূর্ণ বিনামূল্যে পৌঁছে দেওয়া।",
    "এলাকাবাসীর সহজ ব্যবহার ও সার্বক্ষণিক লাইভ চ্যাট ও সহায়তা নিশ্চিত করা।",
  ],
  faqItems: [
    {
      id: "faq_1",
      question: "স্মার্ট নোয়াখালী প্ল্যাটফর্মে নতুন তথ্য বা প্রতিষ্ঠান কীভাবে যোগ করবো?",
      answer: "মেনু থেকে 'নতুন সেবা যোগ করুন' পেজে গিয়ে ফর্ম পূরণ করে জমা দিন। অনুমোদনের পর তা ডিরেক্টরিতে প্রকাশিত হবে।",
      visible: true,
    },
    {
      id: "faq_2",
      question: "জরুরি রক্তের প্রয়োজনে কীভাবে রক্তদাতা খুঁজবো?",
      answer: "হোম পেজ থেকে 'রক্তদাতা খুঁজুন' বা 'জরুরি রক্ত' বাটনে ক্লিক করে রক্তের গ্রুপ ও উপজেলা অনুযায়ী সরাসরি রক্তদাতাদের সাথে যোগাযোগ করতে পারবেন।",
      visible: true,
    },
  ],
  publicNotices: [],
  footerCopyright: "© স্মার্ট নোয়াখালী • নোয়াখালীর ডিজিটাল সিটিজেন সেবা ডিরেক্টরি",
  footerTagline: "Android / iOS অ্যাপ ও PWA ডাউনলোড করুন",
  footerLinks: [
    { label: "আমাদের সেবা", to: "/about" },
    { label: "ডিরেক্টরি", to: "/directory" },
    { label: "রক্তদাতা", to: "/blood-donor" },
    { label: "অনুদান তহবিল", to: "/donation" },
  ],
  socialLinks: {
    facebook: "",
    youtube: "",
    website: "https://smartnoakhali.com",
    whatsapp: "",
  },
  seoTitle: "Smart Noakhali — নোয়াখালীর ডিজিটাল সেবা ও ডিরেক্টরি",
  seoDescription:
    "২২টি প্রধান বিভাগ ও নোয়াখালীর সকল জরুরি সেবা, ডাক্তার, রক্তদাতা, পুলিশ, আইনজীবী ও নাগরিক তথ্য এক ক্লিকে।",
  themeAccent: "emerald",
};

function parseWebsiteContentConfig(raw: string | null | undefined): WebsiteContentConfig | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === "object") {
      return {
        ...DEFAULT_WEBSITE_CONTENT_CONFIG,
        ...p,
        aboutMissionGoals: Array.isArray(p.aboutMissionGoals) && p.aboutMissionGoals.length > 0
          ? p.aboutMissionGoals
          : DEFAULT_WEBSITE_CONTENT_CONFIG.aboutMissionGoals,
        faqItems: Array.isArray(p.faqItems) ? p.faqItems : DEFAULT_WEBSITE_CONTENT_CONFIG.faqItems,
        publicNotices: Array.isArray(p.publicNotices) ? p.publicNotices : [],
        footerLinks: Array.isArray(p.footerLinks) ? p.footerLinks : DEFAULT_WEBSITE_CONTENT_CONFIG.footerLinks,
        socialLinks: {
          ...DEFAULT_WEBSITE_CONTENT_CONFIG.socialLinks,
          ...(p.socialLinks && typeof p.socialLinks === "object" ? p.socialLinks : {}),
        },
      };
    }
  } catch {}
  return null;
}

export function useWebsiteContentConfig() {
  const [contentConfig, setContentConfig] = useState<WebsiteContentConfig>(() => {
    try {
      return parseWebsiteContentConfig(localStorage.getItem(LOCAL_WEBSITE_CONTENT_KEY)) ?? DEFAULT_WEBSITE_CONTENT_CONFIG;
    } catch {
      return DEFAULT_WEBSITE_CONTENT_CONFIG;
    }
  });

  useEffect(() => {
    fetch(`/api/content?collection=settings&id=${WEBSITE_CONTENT_CONFIG_ID}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.item?.logo_url) {
          const parsed = parseWebsiteContentConfig(d.item.logo_url);
          if (parsed) {
            setContentConfig(parsed);
            try {
              localStorage.setItem(LOCAL_WEBSITE_CONTENT_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      })
      .catch(() => {});

    const unsub = onSnapshot(
      doc(db, "settings", WEBSITE_CONTENT_CONFIG_ID),
      (snap) => {
        if (snap.exists()) {
          const parsed = parseWebsiteContentConfig(snap.data()?.logo_url);
          if (parsed) {
            setContentConfig(parsed);
            try {
              localStorage.setItem(LOCAL_WEBSITE_CONTENT_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  const saveWebsiteContentConfig = useCallback(async (next: WebsiteContentConfig) => {
    const cleanNext: WebsiteContentConfig = {
      ...DEFAULT_WEBSITE_CONTENT_CONFIG,
      ...next,
      updatedAt: new Date().toISOString(),
    };
    const serialized = JSON.stringify(cleanNext);
    try {
      localStorage.setItem(LOCAL_WEBSITE_CONTENT_KEY, serialized);
    } catch {}
    setContentConfig(cleanNext);
    await upsertSettingDoc(WEBSITE_CONTENT_CONFIG_ID, serialized, { visible: true });
    return cleanNext;
  }, []);

  return {
    contentConfig,
    saveWebsiteContentConfig,
    resetWebsiteContentConfig: () => saveWebsiteContentConfig(DEFAULT_WEBSITE_CONTENT_CONFIG),
  };
}

// ============================================================================
// 11. Dynamic AI Chat Configuration & Knowledge Base (/settings/ai_chat_config)
// (Zero API keys stored here — GEMINI_API_KEY stays strictly server-side)
// ============================================================================
export interface AiChatFaqItem {
  id: string;
  question: string;
  answer: string;
  keywords: string;
  visible: boolean;
}

export interface AiChatConfig {
  enabled: boolean;
  botName: string;
  welcomeMessage: string;
  systemInstructions: string;
  tone: "helpful_bn" | "concise_bn" | "bilingual";
  quickPrompts: string[];
  faqs: AiChatFaqItem[];
  autoSuggestHandoff: boolean;
  handoffNotice: string;
  updatedAt?: string;
}

export const DEFAULT_AI_CHAT_CONFIG: AiChatConfig = {
  enabled: true,
  botName: "Smart Noakhali AI",
  welcomeMessage:
    "আসসালামু আলাইকুম! আমি স্মার্ট নোয়াখালী এআই সহকারী। জরুরি নম্বর, রক্তদাতা, ডাক্তার, হাসপাতাল, ট্রেন বা যেকোনো নাগরিক সেবা সম্পর্কে বাংলায় বা বাংলিশে প্রশ্ন করুন।",
  systemInstructions:
    "সর্বদা বাংলায় ভদ্র, স্পষ্ট ও তথ্যনির্ভর উত্তর দিন। শুধু ওয়েবসাইটের যাচাইকৃত পাবলিক তথ্য ব্যবহার করুন এবং কোনো তথ্য না থাকলে অনুমান না করে লাইভ চ্যাটে অপারেটরের সাথে যুক্ত হওয়ার পরামর্শ দিন।",
  tone: "helpful_bn",
  quickPrompts: [
    "মাইজদীতে কোন কোন হাসপাতাল আছে?",
    "জরুরি রক্তের প্রয়োজনে কী করবো?",
    "অ্যাডমিন অনুদান ও বিকাশ/নগদ নম্বর কী?",
    "নোয়াখালী ফায়ার সার্ভিস ও পুলিশ হেল্পলাইন নম্বর দিন",
  ],
  faqs: [
    {
      id: "ai_faq_1",
      question: "নোয়াখালী সদর / জেনারেল হাসপাতাল কোথায় ও যোগাযোগ নম্বর কী?",
      answer:
        "২৫০ শয্যা বিশিষ্ট নোয়াখালী জেনারেল হাসপাতাল মাইজদী কোর্টে অবস্থিত। ওয়েবসাইটের 'স্বাস্থ্য ও চিকিৎসা' বিভাগের 'হাসপাতাল ও ক্লিনিক' ক্যাটাগরিতে অনুমোদিত সকল হাসপাতাল ও জরুরি নম্বর দেখতে পারবেন। জরুরি অ্যাম্বুলেন্স বা পুলিশের জন্য ৯৯৯ কল করুন।",
      keywords: "হাসপাতাল,haspatal,hospital,maijdee,মাইজদী,জেনারেল হাসপাতাল",
      visible: true,
    },
    {
      id: "ai_faq_2",
      question: "জরুরি রক্তদাতা কীভাবে পাবো?",
      answer:
        "হোমপেজের 'রক্তদাতা' বা '/blood-donor' পেজে গিয়ে রক্তের গ্রুপ (A+, B+, O+, AB+ ইত্যাদি) দিয়ে যাচাইকৃত রক্তদাতা খুঁজতে পারেন। এছাড়া '/emergency-request' পেজ থেকে জরুরি রক্তের অনুরোধ পোস্ট করতে পারেন।",
      keywords: "রক্ত,রক্তদাতা,blood,rokto,roktodata,donor,emergency blood",
      visible: true,
    },
  ],
  autoSuggestHandoff: true,
  handoffNotice: "সরাসরি হিউম্যান অপারেটরের সহায়তা দরকার হলে নিচের বাটনে ট্যাপ করে লাইভ চ্যাটে যুক্ত হোন।",
};

function parseAiChatConfig(raw: string | null | undefined): AiChatConfig | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === "object") {
      return {
        ...DEFAULT_AI_CHAT_CONFIG,
        ...p,
        enabled: p.enabled !== false,
        autoSuggestHandoff: p.autoSuggestHandoff !== false,
        quickPrompts:
          Array.isArray(p.quickPrompts) && p.quickPrompts.length > 0
            ? p.quickPrompts.map((x: unknown) => String(x)).filter(Boolean)
            : DEFAULT_AI_CHAT_CONFIG.quickPrompts,
        faqs: Array.isArray(p.faqs) ? p.faqs : DEFAULT_AI_CHAT_CONFIG.faqs,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function useAiChatConfig() {
  const [aiConfig, setAiConfig] = useState<AiChatConfig>(() => {
    try {
      return (
        parseAiChatConfig(localStorage.getItem(LOCAL_AI_CHAT_CONFIG_KEY)) ??
        DEFAULT_AI_CHAT_CONFIG
      );
    } catch {
      return DEFAULT_AI_CHAT_CONFIG;
    }
  });

  useEffect(() => {
    let active = true;
    fetch(`/api/content?collection=settings&id=${AI_CHAT_CONFIG_ID}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active) return;
        if (d?.item?.logo_url) {
          const parsed = parseAiChatConfig(d.item.logo_url);
          if (parsed) {
            setAiConfig(parsed);
            try {
              localStorage.setItem(LOCAL_AI_CHAT_CONFIG_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      })
      .catch(() => {});

    const unsub = onSnapshot(
      doc(db, "settings", AI_CHAT_CONFIG_ID),
      (snap) => {
        if (!active) return;
        if (snap.exists()) {
          const parsed = parseAiChatConfig(snap.data()?.logo_url);
          if (parsed) {
            setAiConfig(parsed);
            try {
              localStorage.setItem(LOCAL_AI_CHAT_CONFIG_KEY, JSON.stringify(parsed));
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

  const saveAiChatConfig = useCallback(async (next: AiChatConfig) => {
    const cleanNext: AiChatConfig = {
      ...DEFAULT_AI_CHAT_CONFIG,
      ...next,
      updatedAt: new Date().toISOString(),
    };
    const serialized = JSON.stringify(cleanNext);
    try {
      localStorage.setItem(LOCAL_AI_CHAT_CONFIG_KEY, serialized);
    } catch {}
    setAiConfig(cleanNext);
    await upsertSettingDoc(AI_CHAT_CONFIG_ID, serialized, { visible: true });
    return cleanNext;
  }, []);

  return {
    aiConfig,
    saveAiChatConfig,
    resetAiChatConfig: () => saveAiChatConfig(DEFAULT_AI_CHAT_CONFIG),
  };
}