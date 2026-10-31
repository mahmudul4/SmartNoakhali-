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
  DIVISIONS,
  CATEGORY_ICONS,
  type Category,
  type Division,
} from "@/data/categories";
import defaultLogoUrl from "@/assets/logo.png";
import { clearBinaryFromIdb, saveBinaryToIdb, sanitizeAppFileName } from "@/lib/pwa";

export const defaultLogo: string = defaultLogoUrl;

export const SITE_CONFIG_ID = "site_config";
export const DIVISIONS_CONFIG_ID = "divisions_config";
export const DONATION_CONFIG_ID = "donation_config";
export const CATEGORIES_CONFIG_ID = "categories_config";
export const STAFF_PROFILES_CONFIG_ID = "staff_profiles_config";
export const APP_PACKAGES_CONFIG_ID = "app_packages_config";
export const SITE_META_CONFIG_ID = "site_meta_config";
export const SERVICES_CONFIG_ID = "services_config";

export const LOCAL_LOGO_KEY = "sn_site_logo_v3";
export const LOCAL_DIVISIONS_KEY = "sn_divisions_config_v1";
export const LOCAL_DONATION_KEY = "sn_donation_config_v1";
export const LOCAL_CATEGORIES_KEY = "sn_categories_config_v1";
export const LOCAL_STAFF_PROFILES_KEY = "sn_staff_profiles_v1";
export const LOCAL_APP_PACKAGES_KEY = "sn_app_packages_v1";
export const LOCAL_SITE_META_KEY = "sn_site_meta_v1";
export const LOCAL_SERVICES_KEY = "sn_services_config_v1";

export async function upsertSettingDoc(
  settingId: string,
  payloadValue: string,
  options?: { visible?: boolean; allowStaff?: boolean }
) {
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
    } else if (settingId === DIVISIONS_CONFIG_ID) {
      localStorage.setItem(LOCAL_DIVISIONS_KEY, cleanUrl);
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
}

export const DEFAULT_DIVISION_ITEMS: DivisionConfigItem[] = DIVISIONS.map((d, idx) => ({
  id: d.id,
  bn: d.bn,
  en: d.en,
  iconName: d.iconName,
  tint: d.tint,
  description: d.description,
  visible: true,
  sort_order: d.sort_order || idx + 1,
  customIconUrl: d.customIconUrl,
}));

function parseDivisionConfig(raw: string | null | undefined): DivisionConfigItem[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const divMap = new Map<string, DivisionConfigItem>();
      // 1. Seed with all 22 default divisions
      for (const d of DEFAULT_DIVISION_ITEMS) {
        divMap.set(d.id, { ...d });
      }
      // 2. Apply any custom edits or overrides
      for (const item of parsed) {
        if (!item || typeof item.id !== "string") continue;
        const id = String(item.id);
        const fallback = DIVISIONS.find((d) => d.id === id);
        const iconName = item.iconName && CATEGORY_ICONS[item.iconName] ? item.iconName : fallback?.iconName || "PhoneCall";
        divMap.set(id, {
          id,
          bn: String(item.bn || fallback?.bn || item.id),
          en: String(item.en || fallback?.en || item.id),
          iconName,
          tint: String(item.tint || fallback?.tint || "from-emerald-500/20 to-teal-700/10"),
          description: String(item.description || fallback?.description || ""),
          visible: item.visible !== false,
          sort_order: typeof item.sort_order === "number" ? item.sort_order : (fallback?.sort_order || 99),
          customIconUrl: item.customIconUrl || fallback?.customIconUrl,
        });
      }
      return Array.from(divMap.values()).sort((a, b) => a.sort_order - b.sort_order);
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
  const [items, setItems] = useState<DivisionConfigItem[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_DIVISIONS_KEY);
      return parseDivisionConfig(cached) ?? DEFAULT_DIVISION_ITEMS;
    } catch {
      return DEFAULT_DIVISION_ITEMS;
    }
  });

  useEffect(() => {
    fetch(`/api/content?collection=settings&id=${DIVISIONS_CONFIG_ID}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.item?.logo_url) {
          const parsed = parseDivisionConfig(d.item.logo_url);
          if (parsed) {
            setItems(parsed);
            try {
              localStorage.setItem(LOCAL_DIVISIONS_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      })
      .catch(() => {});

    const unsubDirect = onSnapshot(
      doc(db, "settings", DIVISIONS_CONFIG_ID),
      (docSnap) => {
        if (docSnap.exists()) {
          const parsed = parseDivisionConfig(docSnap.data()?.logo_url);
          if (parsed) {
            setItems(parsed);
            try {
              localStorage.setItem(LOCAL_DIVISIONS_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      },
      () => {}
    );
    return () => unsubDirect();
  }, []);

  const saveDivisionsConfig = useCallback(async (next: DivisionConfigItem[]) => {
    const serialized = JSON.stringify(next);
    try {
      localStorage.setItem(LOCAL_DIVISIONS_KEY, serialized);
    } catch {}
    setItems(next);
    await upsertSettingDoc(DIVISIONS_CONFIG_ID, serialized);
  }, []);

  const updateDivision = useCallback(
    async (id: string, patch: Partial<DivisionConfigItem>) => {
      const next = items.map((d) => (d.id === id ? { ...d, ...patch } : d));
      await saveDivisionsConfig(next);
    },
    [items, saveDivisionsConfig]
  );

  const resolvedDivisions = useMemo(() => items.map(toResolvedDivision), [items]);
  const visibleDivisions = useMemo(
    () => resolvedDivisions.filter((d) => d.visible !== false).sort((a, b) => a.sort_order - b.sort_order),
    [resolvedDivisions]
  );

  return {
    divisions: visibleDivisions,
    allDivisions: resolvedDivisions,
    rawDivisions: items,
    saveDivisionsConfig,
    updateDivision,
    getDivisionById: (id: string) => resolvedDivisions.find((d) => d.id === id),
  };
}

export interface CategoryConfigItem {
  slug: string;
  divisionId?: string;
  bn: string;
  en: string;
  iconName: string;
  tint: string;
  description: string;
  formType?: string;
  customIconUrl?: string;
  visible: boolean;
  sort_order: number;
}

const DEFAULT_CATEGORY_ITEMS: CategoryConfigItem[] = defaultCategories
  .filter((c) => c.slug !== "chat" && c.slug !== "app-download")
  .map((c, idx) => ({
    slug: c.slug,
    divisionId: c.divisionId,
    bn: c.bn,
    en: c.en,
    iconName: c.iconName || "Users",
    tint: c.tint,
    description: c.description,
    formType: c.formType || "general",
    customIconUrl: c.customIconUrl,
    visible: true,
    sort_order: c.sort_order || idx + 1,
  }));

function parseCategoryConfig(raw: string | null | undefined): CategoryConfigItem[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const catMap = new Map<string, CategoryConfigItem>();
      // 1. Seed with ALL 181+ default categories from master categories list
      for (const d of DEFAULT_CATEGORY_ITEMS) {
        catMap.set(d.slug, { ...d });
      }
      // 2. Apply any saved customization or edits
      for (const item of parsed) {
        if (!item || typeof item.slug !== "string" || item.slug === "chat" || item.slug === "app-download") continue;
        const slug = String(item.slug);
        const fallback = defaultCategories.find((d) => d.slug === slug);
        const rawIcon = String(item.iconName || item.icon || "");
        const iconName = (rawIcon && rawIcon !== "Users" && CATEGORY_ICONS[rawIcon])
          ? rawIcon
          : (fallback && CATEGORY_ICONS[fallback.iconName || "Users"] ? (fallback.iconName || "Users") : (rawIcon || "Users"));
        const rawTint = String(item.tint || "");
        const tint = (rawTint && rawTint !== "from-emerald-500/15 to-emerald-700/10")
          ? rawTint
          : (fallback?.tint || "from-emerald-500/15 to-emerald-700/10");
        const description = String(item.description || fallback?.description || "");
        const divisionId = String(item.divisionId || fallback?.divisionId || "shopping");
        const formType = String(item.formType || fallback?.formType || "general");
        const customIconUrl = item.customIconUrl || fallback?.customIconUrl;

        catMap.set(slug, {
          slug,
          divisionId,
          bn: String(item.bn || fallback?.bn || item.slug),
          en: String(item.en || fallback?.en || item.slug),
          iconName,
          tint,
          description,
          formType,
          customIconUrl,
          visible: item.visible !== false,
          sort_order: typeof item.sort_order === "number" ? item.sort_order : (fallback?.sort_order || 999),
        });
      }
      return Array.from(catMap.values()).sort((a, b) => a.sort_order - b.sort_order);
    }
  } catch {
    // ignore
  }
  return null;
}

function toResolvedCategory(item: CategoryConfigItem): Category {
  const fallback = defaultCategories.find((d) => d.slug === item.slug);
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
    divisionId: item.divisionId || fallback?.divisionId || "about",
    bn: item.bn,
    en: item.en,
    icon: IconComp,
    iconName: iconKey,
    tint,
    description,
    formType: (item.formType || fallback?.formType || "general") as Category["formType"],
    customIconUrl: item.customIconUrl || fallback?.customIconUrl,
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

    // Listen directly to the categories config document in Firestore for instant cross-session sync
    const unsubDirect = onSnapshot(
      doc(db, "settings", CATEGORIES_CONFIG_ID),
      (docSnap) => {
        if (docSnap.exists()) {
          const parsed = parseCategoryConfig(docSnap.data()?.logo_url);
          if (parsed) {
            setItems(parsed);
            try {
              localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(parsed));
            } catch {}
          }
        }
      },
      () => {}
    );

    // Also listen to settings collection queries for backwards-compatibility
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
    return () => {
      unsubDirect();
      unsub();
    };
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
      const rawSlug = typeof newCat?.slug === "string" ? newCat.slug : "";
      const cleanSlug = rawSlug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-");
      if (!cleanSlug) throw new Error("সঠিক ক্যাটাগরি স্লাগ (ইংরেজি অক্ষর) দিন");
      if (items.some((c) => (c?.slug || "").toLowerCase() === cleanSlug)) {
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
    getCategoriesByDivisionId: (divId: string) => visibleCategories.filter((c) => c.divisionId === divId),
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
  tagline: "নোয়াখালী জেলার সকল জরুরী সেবা ও তথ্যের ডিজিটাল প্ল্যাটফর্ম",
  helplinePhone: "01850999178",
  contactPhone: "01850999178",
  contactEmail: "e.smartnoakhali@gmail.com",
  contactAddress: "কালাসর্দ্দা, গোবিন্দপুর, কুতুবের হাট-৩৮৬২, নবীপুর, সেনবাগ, নোয়াখালী, বাংলাদেশ।",
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
      title: "জরুরী যোগাযোগ ডিরেক্টরি",
      description: "এলাকার সকল জরুরী সেবার নম্বর (আইনজীবী, ডাক্তার, পুলিশ, ফায়ার সার্ভিস) এক জায়গায় রাখা ও তাৎক্ষণিক কল করার সুবিধা।",
      iconName: "PhoneCall",
      active: true,
      sort_order: 1,
    },
    {
      id: "srv_blood_donor_network",
      title: "স্বেচ্ছা রক্তদাতা নেটওয়ার্ক",
      description: "রক্তদাতাদের সাথে দ্রুত যোগাযোগের সুযোগ ও জরুরী প্রয়োজনে রক্তের আবেদন প্রকাশের সার্বক্ষণিক সুবিধা।",
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