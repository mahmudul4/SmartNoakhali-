import React, { useEffect, useState, useCallback } from "react";
import { Bell, BellRing, BellOff, X, AlertTriangle, Droplet, Check, Volume2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useEmergencyBanners, useEmergencyRequests, type BannerRow } from "@/lib/cloud";

export function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // AudioContext blocked or unsupported
  }
}

export function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return Promise.resolve("denied");
  }
  return Notification.requestPermission();
}

export function sendBrowserNotification(title: string, options?: NotificationOptions) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try {
      playNotificationSound();
      const n = new Notification(title, {
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
        ...options,
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      // ignore
    }
  }
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "denied";
    return Notification.permission;
  });

  const { items: banners } = useEmergencyBanners();
  const { items: bloodRequests } = useEmergencyRequests();

  const activeBanners = banners.filter((b) => b.visible);
  const activeBlood = bloodRequests.filter((r) => r.status === "approved" || r.status === "pending");

  const totalAlerts = activeBanners.length + activeBlood.length;

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setPermission(Notification.permission);
  }, []);

  const enableNotifications = useCallback(async () => {
    const res = await requestNotificationPermission();
    setPermission(res);
    if (res === "granted") {
      toast.success("নোটিফিকেশন সফলভাবে চালু হয়েছে!");
      sendBrowserNotification("স্মার্ট নোয়াখালী", {
        body: "আপনার ডিভাইসে জরুরী নোটিফিকেশন সিস্টেম সক্রিয় হয়েছে।",
      });
    } else if (res === "denied") {
      toast.error("ব্রাউজার সেটিংসে নোটিফিকেশন ব্লক করা আছে। অনুমতি দিন।");
    }
    return res;
  }, []);

  const sendTestNotification = useCallback(() => {
    if (permission !== "granted") {
      void enableNotifications();
      return;
    }
    sendBrowserNotification("🔔 টেস্ট নোটিফিকেশন — স্মার্ট নোয়াখালী", {
      body: "জরুরী রক্তদান, সেবা ও বিশেষ বার্তা আপনার ডিভাইসে এভাবে পৌঁছাবে।",
    });
    toast.success("টেস্ট নোটিফিকেশন পাঠানো হয়েছে!");
  }, [permission, enableNotifications]);

  return {
    permission,
    isSupported: typeof window !== "undefined" && "Notification" in window,
    enableNotifications,
    sendTestNotification,
    totalAlerts,
    activeBanners,
    activeBlood,
  };
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const {
    permission,
    enableNotifications,
    sendTestNotification,
    totalAlerts,
    activeBanners,
    activeBlood,
  } = useNotifications();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
        title="নোটিফিকেশন সেন্টার"
        aria-label="নোটিফিকেশন"
      >
        {permission === "granted" ? (
          <BellRing className="h-4 w-4 text-amber-300" />
        ) : (
          <Bell className="h-4 w-4 text-white" />
        )}
        {totalAlerts > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white shadow-sm ring-1 ring-white">
            {totalAlerts}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 pt-16 backdrop-blur-xs sm:p-4 sm:pt-20"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md space-y-3 rounded-3xl border border-border bg-card p-5 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BellRing className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-display text-base font-extrabold text-foreground">
                    নোটিফিকেশন সেন্টার
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    জরুরী বার্তা ও রক্তদান আপডেট
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Permission Banner */}
            {permission !== "granted" ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-950">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                  <div className="flex-1 text-xs">
                    <p className="font-bold text-amber-900">পুশ নোটিফিকেশন বন্ধ আছে</p>
                    <p className="mt-0.5 text-muted-foreground text-[11px]">
                      জরুরী রক্তের অনুরোধ এবং নোয়াখালীর গুরুত্বপূর্ণ আপডেট পেতে নোটিফিকেশন চালু করুন।
                    </p>
                    <button
                      type="button"
                      onClick={() => void enableNotifications()}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-hero px-3.5 py-1.5 text-[11px] font-bold text-white shadow"
                    >
                      <BellRing className="h-3 w-3 text-yellow-300" /> নোটিফিকেশন চালু করুন
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-emerald-950">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>নোটিফিকেশন সক্রিয় রয়েছে</span>
                </div>
                <button
                  type="button"
                  onClick={sendTestNotification}
                  className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 shadow-xs hover:bg-emerald-50"
                >
                  <Volume2 className="h-3 w-3" /> টেস্ট করুন
                </button>
              </div>
            )}

            {/* Notification Lists */}
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {activeBanners.length === 0 && activeBlood.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  <Bell className="mx-auto h-8 w-8 opacity-30 mb-2" />
                  বর্তমানে কোনো নতুন নোটিফিকেশন নেই।
                </div>
              ) : (
                <>
                  {activeBanners.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-2xl border border-amber-500/30 bg-amber-50/50 p-3 text-xs shadow-xs"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-base">📢</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-foreground">{b.title}</p>
                          <p className="mt-0.5 text-muted-foreground">{b.message}</p>
                          {b.phone && (
                            <a
                              href={`tel:${b.phone}`}
                              className="mt-1.5 inline-flex items-center gap-1 font-bold text-primary hover:underline"
                            >
                              📞 {b.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {activeBlood.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-2xl border border-rose-500/30 bg-rose-50/50 p-3 text-xs shadow-xs"
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white font-bold text-[10px]">
                          {r.blood_group}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-bold text-foreground">জরুরী রক্ত প্রয়োজন</p>
                            <span className="text-[10px] text-muted-foreground">
                              {r.created_at ? new Date(r.created_at).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" }) : ""}
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-0.5">
                            রোগী: <strong>{r.patient_name}</strong> • {r.hospital || "হাসপাতাল"}
                          </p>
                          {r.phone && (
                            <a
                              href={`tel:${r.phone}`}
                              className="mt-1.5 inline-flex items-center gap-1 font-bold text-rose-700 hover:underline"
                            >
                              📞 কল করুন: {r.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-2xl bg-muted py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/80"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
