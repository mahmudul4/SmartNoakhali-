import { useState, useEffect, useCallback } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, isSuperAdminEmail } from "@/lib/firebase";
import { upsertSettingDoc, SITE_CONFIG_ID, LOCAL_LOGO_KEY } from "@/lib/store";
import { useAuth } from "@/lib/auth";

export interface SiteBranding {
  logoUrl: string;
  faviconUrl: string;
  pwaIcon192: string;
  pwaIcon512: string;
  pwaMaskable512?: string;
  updatedAt: string;
  updatedBy?: string;
}

export const DEFAULT_BRANDING: SiteBranding = {
  logoUrl: "/logo.png",
  faviconUrl: "/favicon.ico",
  pwaIcon192: "/pwa-192x192.png",
  pwaIcon512: "/pwa-512x512.png",
  pwaMaskable512: "/pwa-maskable-512x512.png",
  updatedAt: new Date().toISOString(),
};

const BRANDING_CONFIG_ID = "branding";
const LOCAL_BRANDING_KEY = "sn_branding_config_v1";

export function applyBrandingToDocument(branding: Partial<SiteBranding>) {
  if (typeof document === "undefined") return;

  // 1. Update favicon
  if (branding.faviconUrl) {
    const iconLinks = document.querySelectorAll<HTMLLinkElement>(
      "link[rel='icon'], link[rel='shortcut icon']"
    );
    iconLinks.forEach((link) => {
      link.href = branding.faviconUrl!;
    });
  }

  // 2. Update apple touch icon
  if (branding.pwaIcon192 || branding.logoUrl) {
    const appleIcon = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
    if (appleIcon) {
      appleIcon.href = branding.pwaIcon192 || branding.logoUrl!;
    }
  }

  // 3. Update OG image
  if (branding.logoUrl) {
    const ogImage = document.querySelector<HTMLMetaElement>("meta[property='og:image']");
    if (ogImage) ogImage.content = branding.logoUrl;
    const twImage = document.querySelector<HTMLMetaElement>("meta[name='twitter:image']");
    if (twImage) twImage.content = branding.logoUrl;
  }
}

export function useBranding() {
  const { user, isMainAdmin } = useAuth();
  const [branding, setBranding] = useState<SiteBranding>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_BRANDING_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object") {
          return {
            logoUrl: parsed.logoUrl || DEFAULT_BRANDING.logoUrl,
            faviconUrl: parsed.faviconUrl || DEFAULT_BRANDING.faviconUrl,
            pwaIcon192: parsed.pwaIcon192 || DEFAULT_BRANDING.pwaIcon192,
            pwaIcon512: parsed.pwaIcon512 || DEFAULT_BRANDING.pwaIcon512,
            pwaMaskable512: parsed.pwaMaskable512 || DEFAULT_BRANDING.pwaMaskable512,
            updatedAt: parsed.updatedAt || DEFAULT_BRANDING.updatedAt,
            updatedBy: parsed.updatedBy,
          };
        }
      }
    } catch {}
    return DEFAULT_BRANDING;
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // 1. Fetch from Server Content API
    fetch(`/api/content?collection=settings&id=${BRANDING_CONFIG_ID}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.item?.logo_url) {
          try {
            const parsed = JSON.parse(d.item.logo_url);
            if (parsed && typeof parsed === "object") {
              const full: SiteBranding = {
                logoUrl: parsed.logoUrl || DEFAULT_BRANDING.logoUrl,
                faviconUrl: parsed.faviconUrl || DEFAULT_BRANDING.faviconUrl,
                pwaIcon192: parsed.pwaIcon192 || DEFAULT_BRANDING.pwaIcon192,
                pwaIcon512: parsed.pwaIcon512 || DEFAULT_BRANDING.pwaIcon512,
                pwaMaskable512: parsed.pwaMaskable512 || DEFAULT_BRANDING.pwaMaskable512,
                updatedAt: parsed.updatedAt || new Date().toISOString(),
                updatedBy: parsed.updatedBy,
              };
              setBranding(full);
              applyBrandingToDocument(full);
              try {
                localStorage.setItem(LOCAL_BRANDING_KEY, JSON.stringify(full));
              } catch {}
            }
          } catch {}
        }
      })
      .catch(() => {});

    // 2. Realtime listener on Firestore settings
    const q = query(collection(db, "settings"), where("visible", "==", true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docSnap = snap.docs.find((d) => d.id === BRANDING_CONFIG_ID);
        if (docSnap) {
          const raw = docSnap.data().logo_url;
          if (typeof raw === "string" && raw.length > 0) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === "object") {
                const full: SiteBranding = {
                  logoUrl: parsed.logoUrl || DEFAULT_BRANDING.logoUrl,
                  faviconUrl: parsed.faviconUrl || DEFAULT_BRANDING.faviconUrl,
                  pwaIcon192: parsed.pwaIcon192 || DEFAULT_BRANDING.pwaIcon192,
                  pwaIcon512: parsed.pwaIcon512 || DEFAULT_BRANDING.pwaIcon512,
                  pwaMaskable512: parsed.pwaMaskable512 || DEFAULT_BRANDING.pwaMaskable512,
                  updatedAt: parsed.updatedAt || new Date().toISOString(),
                  updatedBy: parsed.updatedBy,
                };
                setBranding(full);
                applyBrandingToDocument(full);
                try {
                  localStorage.setItem(LOCAL_BRANDING_KEY, JSON.stringify(full));
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

  const saveBranding = useCallback(
    async (patch: Partial<SiteBranding>) => {
      if (!isMainAdmin && !isSuperAdminEmail(user?.email)) {
        throw new Error("অনুমতি নেই: শুধুমাত্র প্রধান এডমিন ব্র্যান্ডিং সম্পদ পরিবর্তন করতে পারেন।");
      }

      setSaving(true);
      try {
        const next: SiteBranding = {
          ...branding,
          ...patch,
          updatedAt: new Date().toISOString(),
          updatedBy: user?.email || "admin",
        };

        const serialized = JSON.stringify(next);
        try {
          localStorage.setItem(LOCAL_BRANDING_KEY, serialized);
          if (next.logoUrl) {
            localStorage.setItem(LOCAL_LOGO_KEY, next.logoUrl);
          }
        } catch {}

        setBranding(next);
        applyBrandingToDocument(next);

        // Save to Firestore settings/branding
        await upsertSettingDoc(BRANDING_CONFIG_ID, serialized);

        // Backward compatibility: also sync site_config so useLogo() picks up the new logo
        if (next.logoUrl) {
          await upsertSettingDoc(SITE_CONFIG_ID, next.logoUrl);
        }
      } finally {
        setSaving(false);
      }
    },
    [isMainAdmin, user?.email, branding]
  );

  const resetBranding = useCallback(async () => {
    await saveBranding(DEFAULT_BRANDING);
  }, [saveBranding]);

  return {
    branding,
    saveBranding,
    resetBranding,
    saving,
  };
}

export async function uploadBrandingFile(
  file: File,
  assetType: "logo" | "favicon" | "pwa192" | "pwa512" | "pwaMaskable"
): Promise<{ url: string; width: number; height: number; size: number }> {
  // Validate type
  const validMimes = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/svg+xml",
    "image/x-icon",
    "image/vnd.microsoft.icon",
  ];
  if (!validMimes.includes(file.type) && !file.name.endsWith(".ico")) {
    throw new Error("শুধুমাত্র PNG, JPG, WebP, SVG বা ICO ফরম্যাটের ফাইল আপলোড করুন।");
  }

  // Validate size (max 3MB)
  if (file.size > 3 * 1024 * 1024) {
    throw new Error("ফাইলের আকার সর্বোচ্চ ৩ মেগাবাইট (3MB) হতে পারে।");
  }

  // Measure dimensions
  const dims = await new Promise<{ width: number; height: number }>((resolve) => {
    const objUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      resolve({ width: 0, height: 0 });
    };
    img.src = objUrl;
  });

  // Try uploading to Firebase Storage first
  try {
    const ext = file.name.split(".").pop() || "png";
    const filename = `${assetType}_${Date.now()}.${ext}`;
    const storageRef = ref(storage, `branding/${filename}`);
    await uploadBytes(storageRef, file, {
      contentType: file.type || "image/png",
      cacheControl: "public, max-age=86400",
    });
    const downloadUrl = await getDownloadURL(storageRef);
    return {
      url: downloadUrl,
      width: dims.width,
      height: dims.height,
      size: file.size,
    };
  } catch (storageErr) {
    console.warn("Firebase Storage direct upload fallback to compact Base64/DataURL:", storageErr);
    // Safe client-side fallback as high-fidelity Base64 data URL
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    return {
      url: dataUrl,
      width: dims.width,
      height: dims.height,
      size: file.size,
    };
  }
}
