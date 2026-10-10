import React, { useEffect, useState } from "react";
import { Download, Smartphone, Share, PlusSquare, X, WifiOff, CheckCircle2 } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { registerSW } from "virtual:pwa-register";
import { db } from "@/lib/firebase";

// Register Service Worker in production; clean up any dev-sw in development
if (typeof window !== "undefined") {
  if (import.meta.env.PROD) {
    try {
      registerSW({ immediate: true });
    } catch {
      // ignore in non-SW environments
    }
  } else if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        for (const r of regs) {
          void r.unregister();
        }
      })
      .catch(() => {});
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(e: BeforeInstallPromptEvent | null) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((fn) => fn(globalDeferredPrompt));
  });

  window.addEventListener("appinstalled", () => {
    globalDeferredPrompt = null;
    promptListeners.forEach((fn) => fn(null));
  });
}

const IDB_NAME = "sn_app_binary_idb_v1";
const IDB_STORE = "binaries";

function openAppBinaryIdb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(IDB_STORE)) {
          database.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveBinaryToIdb(
  platform: "android" | "ios",
  fileName: string,
  fileSize: number,
  buffer: ArrayBuffer
): Promise<void> {
  const idb = await openAppBinaryIdb();
  if (!idb) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = idb.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(
        {
          platform,
          fileName,
          fileSize,
          buffer,
          savedAt: new Date().toISOString(),
        },
        platform
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function clearBinaryFromIdb(platform: "android" | "ios"): Promise<void> {
  const idb = await openAppBinaryIdb();
  if (!idb) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = idb.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).delete(platform);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadBinaryFromIdb(
  platform: "android" | "ios",
  expectedSize?: number
): Promise<ArrayBuffer | null> {
  if (!expectedSize || expectedSize <= 0) return null;
  const idb = await openAppBinaryIdb();
  if (!idb) return null;
  return new Promise((resolve) => {
    try {
      const tx = idb.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(platform);
      req.onsuccess = () => {
        const res = req.result as
          | { fileSize?: number; buffer?: ArrayBuffer }
          | undefined;
        if (
          res?.buffer &&
          res.buffer.byteLength > 0 &&
          res.buffer.byteLength !== 52640 &&
          res.buffer.byteLength !== 42444
        ) {
          if (res.buffer.byteLength === expectedSize) {
            resolve(res.buffer);
            return;
          }
        }
        resolve(null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function decodeBase64DataUrlToBuffer(dataUrlOrBase64: string): Promise<ArrayBuffer | null> {
  try {
    const cleanB64 = dataUrlOrBase64.includes(",")
      ? dataUrlOrBase64.split(",")[1]
      : dataUrlOrBase64;
    const binStr = atob(cleanB64.trim());
    const len = binStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binStr.charCodeAt(i);
    }
    return bytes.buffer;
  } catch {
    return null;
  }
}

export async function loadChunkedBinaryFromFirestore(
  platform: "android" | "ios",
  chunkCount: number
): Promise<ArrayBuffer | null> {
  if (!chunkCount || chunkCount <= 0 || chunkCount > 120) return null;
  try {
    // Try server /api/content mirror first for speed and zero permission issues
    try {
      const resp = await fetch("/api/content?collection=settings");
      if (resp.ok && (resp.headers.get("content-type") || "").includes("application/json")) {
        const json = await resp.json();
        if (Array.isArray(json?.items)) {
          const map = new Map<string, string>();
          for (const item of json.items) {
            if (item && typeof item.id === "string" && typeof item.logo_url === "string") {
              map.set(item.id, item.logo_url);
            }
          }
          const serverParts: string[] = [];
          let allFound = true;
          for (let idx = 0; idx < chunkCount; idx++) {
            const c = map.get(`app_pkg_chunk_${platform}_${idx}`);
            if (!c) {
              allFound = false;
              break;
            }
            serverParts.push(c);
          }
          if (allFound && serverParts.length === chunkCount) {
            const decoded = await decodeBase64DataUrlToBuffer(serverParts.join(""));
            if (decoded && decoded.byteLength > 0) return decoded;
          }
        }
      }
    } catch {
      // fallback to Firestore
    }

    const chunkPromises = Array.from({ length: chunkCount }, (_, idx) =>
      getDoc(doc(db, "settings", `app_pkg_chunk_${platform}_${idx}`))
    );
    const snaps = await Promise.all(chunkPromises);
    const parts: string[] = [];
    for (const s of snaps) {
      if (!s.exists()) return null;
      const chunkStr = s.data()?.logo_url;
      if (typeof chunkStr !== "string" || !chunkStr) return null;
      parts.push(chunkStr);
    }
    const joined = parts.join("");
    return await decodeBase64DataUrlToBuffer(joined);
  } catch {
    return null;
  }
}

export function sanitizeAppFileName(rawName: string | undefined, platform: "android" | "ios"): string {
  if (!rawName || !rawName.trim()) return "";
  let cleaned = rawName
    .trim()
    .replace(/\s+\./g, ".")
    .replace(/\s+/g, "-")
    .replace(/\.json$/i, "");
  if (platform === "android") {
    cleaned = cleaned.replace(/\.apk$/i, ".apk");
    if (!cleaned.toLowerCase().endsWith(".apk")) {
      cleaned = `${cleaned}.apk`;
    }
  } else {
    if (
      !cleaned.toLowerCase().endsWith(".mobileconfig") &&
      !cleaned.toLowerCase().endsWith(".ipa")
    ) {
      cleaned = `${cleaned}.ipa`;
    }
  }
  return cleaned;
}

export async function downloadAppPackageBinary(opts: {
  platform: "android" | "ios";
  fileName?: string;
  fileSize?: number;
  downloadUrl?: string;
  embeddedDataUrl?: string;
  chunkCount?: number;
}): Promise<{ ok: boolean; fileName: string; byteLength: number }> {
  const { platform, embeddedDataUrl, downloadUrl, fileSize, chunkCount } = opts;
  const cleanFileName =
    sanitizeAppFileName(opts.fileName, platform) ||
    (platform === "android" ? "app-release.apk" : "app-release.ipa");
  const mimeType =
    platform === "android"
      ? "application/vnd.android.package-archive"
      : "application/octet-stream";
  const apiPath = `/api/apps/download/${platform}`;

  // 1. Try direct server binary endpoint first to ensure exact server-stored file & exact byte size
  const candidates = Array.from(
    new Set(
      [
        apiPath,
        downloadUrl &&
        !downloadUrl.startsWith("/downloads/Smart-Noakhali-") &&
        !downloadUrl.startsWith("data:")
          ? downloadUrl
          : "",
      ].filter(Boolean)
    )
  );

  for (const url of candidates) {
    try {
      const resp = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, {
        cache: "no-store",
      });
      if (!resp.ok) continue;
      const contentType = (resp.headers.get("content-type") || "").toLowerCase();
      if (contentType.includes("application/json") || contentType.includes("text/html")) {
        continue;
      }
      const buf = await resp.arrayBuffer();
      if (buf.byteLength <= 0 || buf.byteLength === 52640 || buf.byteLength === 42444) {
        continue;
      }
      const prefix = new TextDecoder("utf-8", { fatal: false })
        .decode(buf.slice(0, 32))
        .trim()
        .toLowerCase();
      if (prefix.startsWith("{") || prefix.startsWith("<!doctype") || prefix.startsWith("<html")) {
        continue;
      }
      // If expected fileSize is known, prefer exact match
      if (fileSize && fileSize > 0 && buf.byteLength !== fileSize) {
        // Still allow if server has a newer uploaded binary with X-App-Exact-Size matching buf.byteLength
        const headerExact = Number(resp.headers.get("x-app-exact-size") || 0);
        if (headerExact > 0 && buf.byteLength !== headerExact) {
          continue;
        }
      }

      await saveBinaryToIdb(platform, cleanFileName, buf.byteLength, buf);
      triggerBlobDownload(buf, mimeType, cleanFileName);
      return { ok: true, fileName: cleanFileName, byteLength: buf.byteLength };
    } catch {
      // try next fallback
    }
  }

  // 2. Check local IndexedDB binary cache if exact byte size matches
  if (fileSize && fileSize > 0) {
    const cachedBuf = await loadBinaryFromIdb(platform, fileSize);
    if (cachedBuf && cachedBuf.byteLength === fileSize) {
      triggerBlobDownload(cachedBuf, mimeType, cleanFileName);
      return { ok: true, fileName: cleanFileName, byteLength: cachedBuf.byteLength };
    }
  }

  // 3. If embedded data URL is present and valid binary, decode directly
  if (embeddedDataUrl && embeddedDataUrl.startsWith("data:")) {
    const buf = await decodeBase64DataUrlToBuffer(embeddedDataUrl);
    if (buf && buf.byteLength > 0 && (!fileSize || buf.byteLength === fileSize)) {
      await saveBinaryToIdb(platform, cleanFileName, buf.byteLength, buf);
      triggerBlobDownload(buf, mimeType, cleanFileName);
      return { ok: true, fileName: cleanFileName, byteLength: buf.byteLength };
    }
  }

  // 4. If multi-megabyte binary is stored in chunks, reassemble & verify byte size
  if (chunkCount && chunkCount > 0) {
    const chunkedBuf = await loadChunkedBinaryFromFirestore(platform, chunkCount);
    if (chunkedBuf && chunkedBuf.byteLength > 0) {
      await saveBinaryToIdb(platform, cleanFileName, chunkedBuf.byteLength, chunkedBuf);
      triggerBlobDownload(chunkedBuf, mimeType, cleanFileName);
      return { ok: true, fileName: cleanFileName, byteLength: chunkedBuf.byteLength };
    }
  }

  throw new Error("এখনো কোনো অ্যাপ ফাইল আপলোড করা হয়নি। সুপার এডমিন প্যানেল থেকে অ্যাপ ফাইল আপলোড করুন।");
}

function triggerBlobDownload(buf: ArrayBuffer, mimeType: string, fileName: string) {
  const blob = new Blob([buf], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // ignore
    }
  }, 4000);
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => globalDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));
    setIsAndroid(/android/.test(ua));

    const listener = (e: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(e);
      if (!e) {
        const nowStandalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (window.navigator as unknown as { standalone?: boolean }).standalone === true;
        if (nowStandalone) setIsInstalled(true);
      }
    };
    promptListeners.add(listener);
    return () => {
      promptListeners.delete(listener);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    const promptEvent = deferredPrompt || globalDeferredPrompt;
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      globalDeferredPrompt = null;
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: Boolean(deferredPrompt || globalDeferredPrompt),
    isInstalled,
    isIOS,
    isAndroid,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-1.5 text-[11px] font-bold text-amber-200 ring-1 ring-amber-300/40 transition hover:bg-white/25 active:scale-95"
        title="এক ক্লিকে অ্যাপ ইনস্টল করুন"
      >
        <Download className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden xs:inline sm:inline">অ্যাপ ইনস্টল</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-1.5 text-[11px] font-bold text-amber-200 ring-1 ring-amber-300/40 transition hover:bg-white/25"
        >
          <Smartphone className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">iOS অ্যাপ</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-3xl bg-card p-5 text-foreground shadow-elevated"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-display text-base font-bold text-primary-deep">
                  iPhone / iPad-এ অ্যাপ ইনস্টল করুন
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded-full bg-muted p-1 text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 space-y-2.5 text-xs text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Share className="h-4 w-4 shrink-0 text-primary" />
                  <span>
                    ১. Safari ব্রাউজারের নিচে <strong>Share</strong> বাটনে ট্যাপ করুন।
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <PlusSquare className="h-4 w-4 shrink-0 text-primary" />
                  <span>
                    ২. নিচে স্ক্রল করে <strong>Add to Home Screen</strong> নির্বাচন করুন।
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    ৩. উপরে ডান কোণায় <strong>Add</strong> ট্যাপ করলেই অ্যাপ ইনস্টল হয়ে যাবে!
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-2xl bg-gradient-hero py-2.5 text-xs font-bold text-white shadow-card"
              >
                বুঝেছি
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-elevated">
      <WifiOff className="h-3.5 w-3.5 animate-pulse" />
      <span>অফলাইন মোড — সংরক্ষিত ডাটা ব্যবহৃত হচ্ছে</span>
    </div>
  );
};
