import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { auth, db, storage, sanitizeString } from "@/lib/firebase";
import {
  MEDIA_LIBRARY_CONFIG_ID,
  LOCAL_MEDIA_LIBRARY_KEY,
  upsertSettingDoc,
  defaultLogo,
} from "@/lib/store";
import { processAndCompressImage, validateImageFile } from "@/lib/imageProcessor";
import { recordSuperAdminAudit } from "@/lib/staff-audit";

export type MediaAssetType = "logo" | "banner" | "icon" | "photo" | "svg";

export interface MediaAssetRecord {
  id: string;
  name: string;
  type: MediaAssetType;
  url: string;
  storagePath?: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  isSystemProtected?: boolean;
  trashed?: boolean;
  trashedAt?: string;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: string;
}

interface MediaLibraryPayload {
  assets: MediaAssetRecord[];
  updatedAt: string;
}

const DEFAULT_SYSTEM_ASSETS: MediaAssetRecord[] = [
  {
    id: "sys_default_logo",
    name: "স্মার্ট নোয়াখালী সিস্টেম লোগো (Protected)",
    type: "logo",
    url: defaultLogo || "/logo.png",
    mimeType: "image/png",
    sizeBytes: 0,
    isSystemProtected: true,
    trashed: false,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
];

/**
 * Sanitizes SVG markup with DOMParser, removing scripts, event handlers,
 * javascript: URLs, foreignObject, and unsafe embedded elements.
 */
export function sanitizeSvgMarkup(rawSvg: string): {
  ok: boolean;
  sanitized?: string;
  error?: string;
} {
  try {
    const trimmed = String(rawSvg || "").trim();
    if (!trimmed) {
      return { ok: false, error: "SVG ফাইলটি খালি।" };
    }
    if (trimmed.length > 250000) {
      return { ok: false, error: "SVG ফাইলটি ২৫০ KB-এর বেশি বড় হতে পারবে না।" };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(trimmed, "image/svg+xml");
    const parseErr = doc.querySelector("parsererror");
    if (parseErr) {
      return { ok: false, error: "SVG ফাইলটির ফরম্যাট বৈধ নয়।" };
    }

    const root = doc.documentElement;
    if (!root || root.tagName.toLowerCase() !== "svg") {
      return { ok: false, error: "বৈধ <svg> রুট এলিমেন্ট পাওয়া যায়নি।" };
    }

    const forbiddenTags = new Set([
      "script",
      "foreignobject",
      "iframe",
      "object",
      "embed",
      "link",
      "meta",
      "base",
      "audio",
      "video",
    ]);

    const walkAndClean = (node: Element) => {
      const children = Array.from(node.children);
      for (const child of children) {
        const tag = child.tagName.toLowerCase();
        if (forbiddenTags.has(tag)) {
          child.remove();
          continue;
        }
        if (tag === "style") {
          const css = child.textContent || "";
          if (/expression\s*\(|javascript:|@import|behavior\s*:/i.test(css)) {
            child.remove();
            continue;
          }
        }
        // Clean attributes
        const attrs = Array.from(child.attributes);
        for (const attr of attrs) {
          const nameLow = attr.name.toLowerCase();
          const valClean = attr.value.replace(/[\u0000-\u0020]+/g, "").toLowerCase();
          if (nameLow.startsWith("on")) {
            child.removeAttribute(attr.name);
            continue;
          }
          if (
            (nameLow === "href" ||
              nameLow === "xlink:href" ||
              nameLow === "src" ||
              nameLow === "action" ||
              nameLow === "formaction") &&
            (valClean.startsWith("javascript:") ||
              valClean.startsWith("vbscript:") ||
              valClean.startsWith("data:text/html"))
          ) {
            child.removeAttribute(attr.name);
            continue;
          }
          if (nameLow === "style" && /expression\s*\(|javascript:|@import/i.test(attr.value)) {
            child.removeAttribute(attr.name);
          }
        }
        walkAndClean(child);
      }
    };

    // Clean root attributes too
    for (const attr of Array.from(root.attributes)) {
      const nameLow = attr.name.toLowerCase();
      if (nameLow.startsWith("on")) {
        root.removeAttribute(attr.name);
      }
    }
    walkAndClean(root);

    const serializer = new XMLSerializer();
    const cleanSvg = serializer.serializeToString(root);
    return { ok: true, sanitized: cleanSvg };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "SVG স্যানিটাইজ করতে সমস্যা হয়েছে।",
    };
  }
}

function mergeAssetsWithDefaults(list: MediaAssetRecord[]): MediaAssetRecord[] {
  const map = new Map<string, MediaAssetRecord>();
  for (const sys of DEFAULT_SYSTEM_ASSETS) {
    map.set(sys.id, sys);
  }
  for (const item of list) {
    if (!item || !item.id || !item.url) continue;
    const isProtected = item.isSystemProtected || DEFAULT_SYSTEM_ASSETS.some((d) => d.id === item.id);
    map.set(item.id, {
      ...item,
      isSystemProtected: isProtected,
      trashed: isProtected ? false : Boolean(item.trashed),
    });
  }
  return Array.from(map.values()).sort((a, b) =>
    (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)
  );
}

function readLocalMediaAssets(): MediaAssetRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_MEDIA_LIBRARY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MediaLibraryPayload> | MediaAssetRecord[];
      const items = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.assets)
          ? parsed.assets
          : [];
      return mergeAssetsWithDefaults(items);
    }
  } catch {
    // ignore
  }
  return DEFAULT_SYSTEM_ASSETS;
}

function writeLocalMediaAssets(assets: MediaAssetRecord[]): string {
  const payload: MediaLibraryPayload = {
    assets,
    updatedAt: new Date().toISOString(),
  };
  const serialized = JSON.stringify(payload);
  try {
    localStorage.setItem(LOCAL_MEDIA_LIBRARY_KEY, serialized);
  } catch {
    // ignore
  }
  return serialized;
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("ডাটা ইউআরএল তৈরি করা যায়নি"));
    reader.readAsDataURL(blob);
  });
}

export function useMediaLibrary() {
  const [allAssets, setAllAssets] = useState<MediaAssetRecord[]>(() => readLocalMediaAssets());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const persistAssets = useCallback(async (nextList: MediaAssetRecord[]) => {
    const merged = mergeAssetsWithDefaults(nextList);
    setAllAssets(merged);
    const serialized = writeLocalMediaAssets(merged);
    await upsertSettingDoc(MEDIA_LIBRARY_CONFIG_ID, serialized);
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`/api/content?collection=settings&id=${MEDIA_LIBRARY_CONFIG_ID}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active || !d?.item?.logo_url) return;
        try {
          const parsed = JSON.parse(d.item.logo_url) as Partial<MediaLibraryPayload>;
          if (Array.isArray(parsed?.assets)) {
            const merged = mergeAssetsWithDefaults(parsed.assets);
            setAllAssets(merged);
            writeLocalMediaAssets(merged);
          }
        } catch {
          // ignore
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    const q = query(collection(db, "settings"), where("visible", "==", true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docSnap = snap.docs.find((d) => d.id === MEDIA_LIBRARY_CONFIG_ID);
        if (docSnap) {
          const raw = docSnap.data().logo_url;
          if (typeof raw === "string" && raw.trim()) {
            try {
              const parsed = JSON.parse(raw) as Partial<MediaLibraryPayload>;
              if (Array.isArray(parsed?.assets)) {
                const merged = mergeAssetsWithDefaults(parsed.assets);
                setAllAssets(merged);
                writeLocalMediaAssets(merged);
              }
            } catch {
              // ignore
            }
          }
        }
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => {
      active = false;
      unsub();
    };
  }, []);

  const uploadMediaAsset = useCallback(
    async (
      file: File,
      options?: { name?: string; type?: MediaAssetType; replaceId?: string }
    ): Promise<MediaAssetRecord> => {
      const check = validateImageFile(file);
      if (!check.ok) {
        throw new Error(check.error || "অবৈধ ফাইল");
      }

      setUploading(true);
      try {
        const isSvg =
          file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
        const assetType: MediaAssetType = isSvg ? "svg" : options?.type || "photo";
        const assetId =
          options?.replaceId ||
          `med_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const now = new Date().toISOString();

        let uploadFile: File;
        let width: number | undefined;
        let height: number | undefined;
        let mimeType = file.type || "image/webp";

        if (isSvg) {
          const rawSvg = await file.text();
          const cleanRes = sanitizeSvgMarkup(rawSvg);
          if (!cleanRes.ok || !cleanRes.sanitized) {
            throw new Error(cleanRes.error || "SVG নিরাপত্তা যাচাই ব্যর্থ হয়েছে।");
          }
          const blob = new Blob([cleanRes.sanitized], { type: "image/svg+xml" });
          uploadFile = new File([blob], `${assetId}.svg`, { type: "image/svg+xml" });
          mimeType = "image/svg+xml";
        } else {
          const preset =
            assetType === "logo" || assetType === "icon"
              ? "logo"
              : assetType === "banner"
                ? "banner"
                : "content";
          const processed = await processAndCompressImage(file, { preset });
          uploadFile = processed.file;
          width = processed.width;
          height = processed.height;
          mimeType = uploadFile.type;
        }

        const ext = isSvg
          ? "svg"
          : mimeType.includes("png")
            ? "png"
            : mimeType.includes("jpeg") || mimeType.includes("jpg")
              ? "jpg"
              : "webp";
        const storagePath = `media_library/${assetId}.${ext}`;

        let finalUrl = "";
        try {
          const storageRef = ref(storage, storagePath);
          await uploadBytes(storageRef, uploadFile, { contentType: mimeType });
          finalUrl = await getDownloadURL(storageRef);
        } catch (storageErr) {
          if (uploadFile.size <= 90 * 1024) {
            finalUrl = await readBlobAsDataUrl(uploadFile);
          } else {
            throw new Error(
              storageErr instanceof Error
                ? `Firebase Storage আপলোড ব্যর্থ হয়েছে: ${storageErr.message}`
                : "Firebase Storage আপলোড ব্যর্থ হয়েছে।"
            );
          }
        }

        const cleanName = sanitizeString(
          options?.name || file.name.replace(/\.[^/.]+$/, ""),
          120,
          "মিডিয়া অ্যাসেট"
        );

        const existing = allAssets.find((a) => a.id === assetId);
        const record: MediaAssetRecord = {
          id: assetId,
          name: cleanName,
          type: assetType,
          url: finalUrl,
          storagePath: finalUrl.startsWith("data:") ? undefined : storagePath,
          mimeType,
          sizeBytes: uploadFile.size,
          width,
          height,
          isSystemProtected: existing?.isSystemProtected || false,
          trashed: false,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
          uploadedBy: auth.currentUser?.email || "super_admin",
        };

        const nextList = [
          record,
          ...allAssets.filter((a) => a.id !== assetId),
        ];
        await persistAssets(nextList);

        void recordSuperAdminAudit({
          action: options?.replaceId ? "media_update" : "create",
          module: "media_library",
          target_id: assetId,
          target_label: cleanName,
          summary: options?.replaceId
            ? `মিডিয়া অ্যাসেট রিপ্লেস করা হয়েছে (${assetType})`
            : `নতুন মিডিয়া অ্যাসেট আপলোড করা হয়েছে (${assetType})`,
          metadata: { mimeType, sizeBytes: uploadFile.size, assetType },
        });

        return record;
      } finally {
        setUploading(false);
      }
    },
    [allAssets, persistAssets]
  );

  const registerExternalAsset = useCallback(
    async (params: { name: string; url: string; type?: MediaAssetType }) => {
      const cleanUrl = sanitizeString(params.url, 1500, "");
      if (!cleanUrl) throw new Error("সঠিক মিডিয়া URL দিন");
      const id = `med_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const now = new Date().toISOString();
      const record: MediaAssetRecord = {
        id,
        name: sanitizeString(params.name, 120, "বাহ্যিক মিডিয়া"),
        type: params.type || "photo",
        url: cleanUrl,
        mimeType: "image/external",
        sizeBytes: 0,
        trashed: false,
        createdAt: now,
        updatedAt: now,
        uploadedBy: auth.currentUser?.email || "super_admin",
      };
      await persistAssets([record, ...allAssets]);
      void recordSuperAdminAudit({
        action: "media_update",
        module: "media_library",
        target_id: id,
        target_label: record.name,
        summary: "বাহ্যিক মিডিয়া URL লাইব্রেরিতে যুক্ত করা হয়েছে",
      });
      return record;
    },
    [allAssets, persistAssets]
  );

  const trashMediaAsset = useCallback(
    async (id: string) => {
      const target = allAssets.find((a) => a.id === id);
      if (!target) return;
      if (target.isSystemProtected) {
        throw new Error("সিস্টেম-সুরক্ষিত ডিফল্ট অ্যাসেট ডিলিট করা যাবে না।");
      }
      const nextList = allAssets.map((a) =>
        a.id === id
          ? { ...a, trashed: true, trashedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          : a
      );
      await persistAssets(nextList);
      void recordSuperAdminAudit({
        action: "trash",
        module: "media_library",
        target_id: id,
        target_label: target.name,
        summary: "মিডিয়া অ্যাসেট ট্র্যাশে পাঠানো হয়েছে",
      });
    },
    [allAssets, persistAssets]
  );

  const restoreMediaAsset = useCallback(
    async (id: string) => {
      const target = allAssets.find((a) => a.id === id);
      if (!target) return;
      const nextList = allAssets.map((a) =>
        a.id === id
          ? { ...a, trashed: false, trashedAt: undefined, updatedAt: new Date().toISOString() }
          : a
      );
      await persistAssets(nextList);
      void recordSuperAdminAudit({
        action: "restore",
        module: "media_library",
        target_id: id,
        target_label: target.name,
        summary: "মিডিয়া অ্যাসেট ট্র্যাশ থেকে পুনরুদ্ধার করা হয়েছে",
      });
    },
    [allAssets, persistAssets]
  );

  const permanentlyDeleteMediaAsset = useCallback(
    async (id: string) => {
      const target = allAssets.find((a) => a.id === id);
      if (!target) return;
      if (target.isSystemProtected) {
        throw new Error("সিস্টেম-সুরক্ষিত অ্যাসেট স্থায়ীভাবে ডিলিট করা যাবে না।");
      }
      if (target.storagePath) {
        await deleteObject(ref(storage, target.storagePath)).catch(() => {});
      }
      const nextList = allAssets.filter((a) => a.id !== id);
      await persistAssets(nextList);
      void recordSuperAdminAudit({
        action: "delete",
        module: "media_library",
        target_id: id,
        target_label: target.name,
        summary: "মিডিয়া অ্যাসেট স্থায়ীভাবে ডিলিট করা হয়েছে",
      });
    },
    [allAssets, persistAssets]
  );

  const assets = useMemo(() => allAssets.filter((a) => !a.trashed), [allAssets]);
  const trashedAssets = useMemo(() => allAssets.filter((a) => Boolean(a.trashed)), [allAssets]);

  return {
    assets,
    trashedAssets,
    allAssets,
    loading,
    uploading,
    uploadMediaAsset,
    registerExternalAsset,
    trashMediaAsset,
    restoreMediaAsset,
    permanentlyDeleteMediaAsset,
  };
}
