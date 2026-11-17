import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BellRing,
  X,
  AlertTriangle,
  Check,
  CheckCheck,
  Info,
  CheckCircle2,
  RefreshCw,
  Megaphone,
  Phone,
  Clock,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useEmergencyBanners, useEmergencyRequests } from "@/lib/cloud";
import { useAuth } from "@/lib/auth";
import { useUserNotifications, type UserNotificationItem } from "@/lib/district-platform";

export function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
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

  const { user } = useAuth();
  const { items: banners } = useEmergencyBanners();
  const { items: bloodRequests } = useEmergencyRequests();
  const {
    notifications: userNotifications,
    unreadCount: userUnreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
  } = useUserNotifications(user?.uid);

  const activeBanners = useMemo(() => banners.filter((b) => b.visible), [banners]);
  const activeBlood = useMemo(
    () => bloodRequests.filter((r) => r.status === "approved" || r.status === "pending"),
    [bloodRequests]
  );

  const totalAlerts = userUnreadCount + activeBanners.length + activeBlood.length;

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
    sendBrowserNotification("স্মার্ট নোয়াখালী", {
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
    userNotifications,
    userUnreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
  };
}

function formatBanglaTimestamp(isoString?: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return date.toLocaleString("bn-BD", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function getNotifTypeMeta(type: UserNotificationItem["type"]) {
  switch (type) {
    case "success":
      return {
        icon: CheckCircle2,
        iconBg: "bg-emerald-500/15 text-emerald-700",
      };
    case "warning":
      return {
        icon: AlertTriangle,
        iconBg: "bg-amber-500/15 text-amber-700",
      };
    case "status_update":
      return {
        icon: RefreshCw,
        iconBg: "bg-teal-500/15 text-teal-700",
      };
    default:
      return {
        icon: Info,
        iconBg: "bg-blue-500/15 text-blue-700",
      };
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    activeBanners,
    activeBlood,
    userNotifications,
    userUnreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const ackStorageKey = `sn_ack_alert_ids_${user?.uid || "guest"}`;
  const [ackAlertIds, setAckAlertIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(ackStorageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(ackStorageKey);
      setAckAlertIds(raw ? JSON.parse(raw) : []);
    } catch {
      setAckAlertIds([]);
    }
  }, [ackStorageKey]);

  const acknowledgeAlert = useCallback(
    (alertKey: string) => {
      setAckAlertIds((prev) => {
        if (prev.includes(alertKey)) return prev;
        const next = [...prev, alertKey];
        try {
          localStorage.setItem(ackStorageKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [ackStorageKey]
  );

  // Genuine unread count across Firestore user_notifications and unacknowledged live alerts
  const unreadBannerCount = useMemo(
    () => activeBanners.filter((b) => !ackAlertIds.includes(`banner_${b.id}`)).length,
    [activeBanners, ackAlertIds]
  );
  const unreadBloodCount = useMemo(
    () => activeBlood.filter((r) => !ackAlertIds.includes(`blood_${r.id}`)).length,
    [activeBlood, ackAlertIds]
  );
  const genuineUnreadCount = userUnreadCount + unreadBannerCount + unreadBloodCount;
  const hasAnyItems =
    userNotifications.length > 0 || activeBanners.length > 0 || activeBlood.length > 0;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const handleMarkAllRead = async () => {
    if (genuineUnreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllAsRead();
      const allLiveKeys = [
        ...activeBanners.map((b) => `banner_${b.id}`),
        ...activeBlood.map((r) => `blood_${r.id}`),
      ];
      if (allLiveKeys.length > 0) {
        const merged = Array.from(new Set([...ackAlertIds, ...allLiveKeys]));
        setAckAlertIds(merged);
        try {
          localStorage.setItem(ackStorageKey, JSON.stringify(merged));
        } catch {}
      }
      toast.success("সকল বিজ্ঞপ্তি পঠিত হিসেবে চিহ্নিত হয়েছে");
    } catch {
      toast.error("বিজ্ঞপ্তি আপডেট করতে সমস্যা হয়েছে");
    } finally {
      setMarkingAll(false);
    }
  };

  const handleOpenNotification = async (item: UserNotificationItem) => {
    if (!item.read) {
      void markAsRead(item.id);
    }
    if (item.link) {
      setOpen(false);
      if (item.link.startsWith("/")) {
        void navigate({ to: item.link as "/" });
      } else if (/^https?:\/\//i.test(item.link)) {
        window.location.assign(item.link);
      }
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-200/30 bg-white/10 text-white backdrop-blur-xs transition-all duration-200 hover:bg-white/20 active:scale-95 sm:h-9 sm:w-9"
        title="বিজ্ঞপ্তি"
        aria-label={genuineUnreadCount > 0 ? `বিজ্ঞপ্তি (${genuineUnreadCount} টি অপঠিত)` : "বিজ্ঞপ্তি"}
      >
        <Bell className="h-4 w-4 text-white" />
        {genuineUnreadCount > 0 && (
          <>
            <span className="pointer-events-none absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping opacity-75" />
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black text-white shadow-sm ring-1 ring-white">
              {genuineUnreadCount > 99 ? "99+" : genuineUnreadCount}
            </span>
          </>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 p-3 pt-16 backdrop-blur-xs sm:p-4 sm:pt-20"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="বিজ্ঞপ্তি"
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-3xl border border-border/80 bg-card shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-gradient-to-r from-emerald-950/[0.04] to-transparent px-5 py-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <BellRing className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bangla text-base font-extrabold text-foreground">
                      বিজ্ঞপ্তি
                    </h3>
                    {genuineUnreadCount > 0 && (
                      <span className="inline-flex items-center rounded-full bg-rose-500/15 px-2 py-0.5 text-[10.5px] font-bold text-rose-700">
                        {genuineUnreadCount} টি অপঠিত
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    গুরুত্বপূর্ণ আপডেট ও জরুরী বার্তা
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {genuineUnreadCount > 0 && (
                  <button
                    type="button"
                    disabled={markingAll}
                    onClick={() => void handleMarkAllRead()}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10.5px] font-bold text-primary transition hover:bg-primary/15 disabled:opacity-60"
                  >
                    {markingAll ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCheck className="h-3 w-3" />
                    )}
                    <span>সকল পঠিত করুন</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="বিজ্ঞপ্তি বন্ধ করুন"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="max-h-[62vh] space-y-2.5 overflow-y-auto px-4 py-3.5">
              {error && (
                <div className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {loading && !hasAnyItems ? (
                <div className="flex flex-col items-center justify-center py-10 text-xs text-muted-foreground">
                  <Loader2 className="mb-2 h-6 w-6 animate-spin text-primary" />
                  <span>বিজ্ঞপ্তি লোড হচ্ছে...</span>
                </div>
              ) : !hasAnyItems ? (
                <div className="py-10 text-center">
                  <div className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
                    <Bell className="h-5 w-5 opacity-60" />
                  </div>
                  <p className="font-bangla text-sm font-bold text-foreground">
                    কোনো নতুন বিজ্ঞপ্তি নেই
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    বর্তমানে কোনো অপঠিত বার্তা বা জরুরী সতর্কতা নেই।
                  </p>
                </div>
              ) : (
                <>
                  {/* Firestore User & Global Notifications */}
                  {userNotifications.map((item) => {
                    const meta = getNotifTypeMeta(item.type);
                    const TypeIcon = meta.icon;
                    const formattedTime = formatBanglaTimestamp(item.created_at);

                    return (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => void handleOpenNotification(item)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            void handleOpenNotification(item);
                          }
                        }}
                        className={`group relative cursor-pointer rounded-2xl border p-3.5 transition-all ${
                          item.read
                            ? "border-border/70 bg-background/60 hover:bg-muted/40"
                            : "border-primary/30 bg-primary/[0.04] shadow-xs hover:bg-primary/[0.07]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${meta.iconBg}`}
                          >
                            <TypeIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={`text-xs leading-snug ${
                                  item.read
                                    ? "font-semibold text-foreground"
                                    : "font-extrabold text-primary-deep"
                                }`}
                              >
                                {item.title}
                              </p>
                              {!item.read && (
                                <span
                                  className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500"
                                  title="অপঠিত"
                                />
                              )}
                            </div>
                            <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                              {item.message}
                            </p>
                            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formattedTime || "সম্প্রতি"}
                              </span>
                              <div className="flex items-center gap-2">
                                {!item.read && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void markAsRead(item.id);
                                    }}
                                    className="inline-flex items-center gap-0.5 font-bold text-primary hover:underline"
                                  >
                                    <Check className="h-3 w-3" /> পঠিত
                                  </button>
                                )}
                                {item.link && (
                                  <span className="inline-flex items-center gap-0.5 font-bold text-primary">
                                    বিস্তারিত <ChevronRight className="h-3 w-3" />
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Active Emergency Banners */}
                  {activeBanners.map((b) => {
                    const isAck = ackAlertIds.includes(`banner_${b.id}`);
                    return (
                      <div
                        key={`banner_${b.id}`}
                        onClick={() => acknowledgeAlert(`banner_${b.id}`)}
                        className={`cursor-pointer rounded-2xl border p-3.5 text-xs transition ${
                          isAck
                            ? "border-amber-500/20 bg-amber-50/30"
                            : "border-amber-500/40 bg-amber-50/80 shadow-xs"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700">
                            <Megaphone className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-bold text-foreground">{b.title}</p>
                              {!isAck && (
                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-600" />
                              )}
                            </div>
                            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                              {b.message}
                            </p>
                            {b.phone && (
                              <a
                                href={`tel:${b.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-primary shadow-xs hover:underline"
                              >
                                <Phone className="h-3 w-3" /> {b.phone}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Active Emergency Blood Requests */}
                  {activeBlood.map((r) => {
                    const isAck = ackAlertIds.includes(`blood_${r.id}`);
                    return (
                      <div
                        key={`blood_${r.id}`}
                        onClick={() => {
                          acknowledgeAlert(`blood_${r.id}`);
                          setOpen(false);
                          void navigate({ to: "/emergency-request" });
                        }}
                        className={`cursor-pointer rounded-2xl border p-3.5 text-xs transition ${
                          isAck
                            ? "border-rose-500/20 bg-rose-50/30"
                            : "border-rose-500/40 bg-rose-50/80 shadow-xs"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-600 text-[11px] font-black text-white shadow-xs">
                            {r.blood_group}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-bold text-foreground">জরুরী রক্ত প্রয়োজন</p>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground">
                                  {formatBanglaTimestamp(r.created_at)}
                                </span>
                                {!isAck && (
                                  <span className="h-2 w-2 shrink-0 rounded-full bg-rose-600" />
                                )}
                              </div>
                            </div>
                            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                              রোগী: <strong className="text-foreground">{r.patient_name}</strong> •{" "}
                              {r.hospital || "হাসপাতাল"}
                            </p>
                            {r.phone && (
                              <a
                                href={`tel:${r.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 shadow-xs hover:underline"
                              >
                                <Phone className="h-3 w-3" /> কল করুন: {r.phone}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border/60 bg-muted/20 px-4 py-3 text-center">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-2xl bg-muted py-2 text-xs font-bold text-foreground/80 transition hover:bg-muted/80"
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
