import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  RefreshCw,
  Clock,
  ChevronRight,
  SlidersHorizontal,
  Mail,
  Smartphone,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/lib/notifications";
import {
  NOTIFICATION_CATEGORIES,
  ESSENTIAL_NOTIFICATION_CATEGORIES,
  useNotificationPreferences,
  registerDevicePushToken,
  type NotificationCategory,
  type UserNotificationItem,
} from "@/lib/district-platform";

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
});

const PAGE_SIZE = 12;

function formatBnDateTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return d.toLocaleString("bn-BD", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function getTypeStyle(type: UserNotificationItem["type"]) {
  switch (type) {
    case "success":
      return { icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-700" };
    case "warning":
      return { icon: AlertTriangle, cls: "bg-amber-500/15 text-amber-700" };
    case "status_update":
      return { icon: RefreshCw, cls: "bg-teal-500/15 text-teal-700" };
    default:
      return { icon: Info, cls: "bg-blue-500/15 text-blue-700" };
  }
}

function NotificationsPage() {
  const navigate = useNavigate();
  const { user, isAuthed } = useAuth();
  const {
    permission,
    isSupported,
    enableNotifications,
    sendTestNotification,
    userNotifications,
    userUnreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const {
    preferences,
    saving: savingPrefs,
    updatePreferences,
  } = useNotificationPreferences(user?.uid);

  const [selectedCategory, setSelectedCategory] = useState<"ALL" | NotificationCategory>("ALL");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [emailInput, setEmailInput] = useState(user?.email || preferences.email_address || "");
  const [markingAll, setMarkingAll] = useState(false);

  const filtered = useMemo(() => {
    return userNotifications.filter((n) => {
      if (unreadOnly && n.read) return false;
      if (selectedCategory !== "ALL" && (n.category || "সিস্টেম বিজ্ঞপ্তি") !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [userNotifications, unreadOnly, selectedCategory]);

  const paginated = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  const handleToggleWebPush = async () => {
    if (!preferences.web_push) {
      const res = await enableNotifications();
      if (res === "granted") {
        if (user?.uid) {
          await registerDevicePushToken(user.uid).catch(() => {});
        }
        await updatePreferences({ web_push: true });
      }
    } else {
      await updatePreferences({ web_push: false });
      toast.success("ব্রাউজার পুশ পছন্দ বন্ধ করা হয়েছে।");
    }
  };

  const handleToggleEmail = async () => {
    const nextVal = !preferences.email;
    const addr = (emailInput || user?.email || "").trim();
    if (nextVal && !addr) {
      toast.error("ইমেইল বিজ্ঞপ্তির জন্য একটি সঠিক ইমেইল ঠিকানা লিখুন।");
      return;
    }
    await updatePreferences({
      email: nextVal,
      email_address: addr || undefined,
    });
    toast.success(
      nextVal ? "ইমেইল বিজ্ঞপ্তি পছন্দ সক্রিয় করা হয়েছে।" : "ইমেইল বিজ্ঞপ্তি বন্ধ করা হয়েছে।"
    );
  };

  const handleToggleMuteCategory = async (cat: NotificationCategory) => {
    if (ESSENTIAL_NOTIFICATION_CATEGORIES.includes(cat)) {
      toast.info("জরুরি ও সিস্টেম বিজ্ঞপ্তি অপরিহার্য — এটি মিউট করা যাবে না।");
      return;
    }
    const exists = preferences.muted_categories.includes(cat);
    const nextMuted = exists
      ? preferences.muted_categories.filter((c) => c !== cat)
      : [...preferences.muted_categories, cat];
    await updatePreferences({ muted_categories: nextMuted });
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await markAllAsRead();
      toast.success("সকল বিজ্ঞপ্তি পঠিত হিসেবে চিহ্নিত হয়েছে");
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="w-full space-y-5 px-3.5 py-5 pb-24 sm:px-6 sm:py-7 lg:px-8 xl:px-10 2xl:px-12">
      {/* Header Banner */}
      <div className="rounded-[12px] border border-[#E6E1D6] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-foreground transition hover:bg-muted"
              title="হোমে ফিরুন"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-lg font-extrabold text-primary-deep sm:text-xl">
                  বিজ্ঞপ্তি ইনবক্স (Notifications)
                </h1>
                {userUnreadCount > 0 && (
                  <span className="rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
                    {userUnreadCount} অপঠিত
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                নোয়াখালী জেলার জরুরি সতর্কতা, রক্তের প্রয়োজন, অভিযোগ আপডেট ও প্রশাসনিক ঘোষণা
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {userUnreadCount > 0 && (
              <button
                type="button"
                disabled={markingAll}
                onClick={() => void handleMarkAll()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/15 disabled:opacity-60"
              >
                {markingAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" />
                )}
                <span>সকল পঠিত করুন</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPrefs((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                showPrefs
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>বিজ্ঞপ্তি সেটিংস</span>
            </button>
          </div>
        </div>
      </div>

      {/* Preferences Panel */}
      {showPrefs && (
        <div className="rounded-[12px] border border-[#E6E1D6] bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-primary" />
              <h2 className="font-display text-sm font-extrabold text-foreground">
                নোটিফিকেশন মাধ্যম ও পছন্দ (Preferences)
              </h2>
            </div>
            {savingPrefs && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                <Loader2 className="h-3 w-3 animate-spin" /> সংরক্ষণ হচ্ছে...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* In-app */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Bell className="h-3.5 w-3.5 text-emerald-700" /> ইন-অ্যাপ ইনবক্স
                </span>
                <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  সর্বদা চালু
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                ওয়েবসাইটের বেল আইকন ও ইনবক্সে তাৎক্ষণিক বিজ্ঞপ্তি।
              </p>
            </div>

            {/* Web Push */}
            <div className="rounded-2xl border border-border bg-background/70 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Smartphone className="h-3.5 w-3.5 text-primary" /> ব্রাউজার পুশ
                </span>
                <button
                  type="button"
                  disabled={!isSupported || savingPrefs}
                  onClick={() => void handleToggleWebPush()}
                  className={`rounded-lg px-2.5 py-1 text-[10.5px] font-bold transition ${
                    preferences.web_push && permission === "granted"
                      ? "bg-emerald-600 text-white"
                      : "bg-muted text-foreground hover:bg-muted/80"
                  }`}
                >
                  {preferences.web_push && permission === "granted" ? "চালু আছে" : "চালু করুন"}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                অনুমতি অবস্থা:{" "}
                <strong className="text-foreground">
                  {permission === "granted"
                    ? "অনুমোদিত (Granted)"
                    : permission === "denied"
                    ? "ব্লককৃত (Denied)"
                    : "অনুমতি প্রয়োজন"}
                </strong>
              </p>
              {permission === "granted" && (
                <button
                  type="button"
                  onClick={sendTestNotification}
                  className="text-[10.5px] font-bold text-primary hover:underline"
                >
                  টেস্ট নোটিফিকেশন পাঠান
                </button>
              )}
            </div>

            {/* Email */}
            <div className="rounded-2xl border border-border bg-background/70 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Mail className="h-3.5 w-3.5 text-primary" /> ইমেইল বিজ্ঞপ্তি
                </span>
                <button
                  type="button"
                  disabled={savingPrefs}
                  onClick={() => void handleToggleEmail()}
                  className={`rounded-lg px-2.5 py-1 text-[10.5px] font-bold transition ${
                    preferences.email
                      ? "bg-emerald-600 text-white"
                      : "bg-muted text-foreground hover:bg-muted/80"
                  }`}
                >
                  {preferences.email ? "চালু আছে" : "চালু করুন"}
                </button>
              </div>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="আপনার ইমেইল লিখুন"
                className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {!isAuthed && (
            <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800">
              লগইন করলে আপনার নোটিফিকেশন পছন্দ ও পঠিত অবস্থা সকল ডিভাইসে ক্লাউডে সিঙ্ক থাকবে।
            </p>
          )}

          {/* Category Preferences */}
          <div>
            <p className="mb-2 text-[11px] font-bold text-foreground">
              ক্যাটাগরি অনুযায়ী পছন্দ (জরুরি ও সিস্টেম বিজ্ঞপ্তি সর্বদা সক্রিয় থাকে):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {NOTIFICATION_CATEGORIES.map((cat) => {
                const isEssential = ESSENTIAL_NOTIFICATION_CATEGORIES.includes(cat);
                const isMuted = preferences.muted_categories.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => void handleToggleMuteCategory(cat)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                      isEssential
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800"
                        : isMuted
                        ? "border-border bg-muted/60 text-muted-foreground line-through"
                        : "border-primary/30 bg-primary/5 text-primary"
                    }`}
                  >
                    {isEssential && <Lock className="h-3 w-3" />}
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-muted-foreground">
            মোট প্রদর্শিত: {filtered.length} টি বিজ্ঞপ্তি
          </span>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-foreground">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => {
                setUnreadOnly(e.target.checked);
                setVisibleCount(PAGE_SIZE);
              }}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span>শুধুমাত্র অপঠিত দেখান</span>
          </label>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("ALL");
              setVisibleCount(PAGE_SIZE);
            }}
            className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${
              selectedCategory === "ALL"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            সব ক্যাটাগরি ({userNotifications.length})
          </button>
          {NOTIFICATION_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setSelectedCategory(cat);
                setVisibleCount(PAGE_SIZE);
              }}
              className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition ${
                selectedCategory === cat
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Notifications List */}
      {loading && userNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[12px] border border-[#E6E1D6] bg-white py-14 text-xs text-[#5F5F5A]">
          <Loader2 className="mb-2 h-7 w-7 animate-spin text-[#0F4D3A]" />
          <span>বিজ্ঞপ্তি লোড হচ্ছে...</span>
        </div>
      ) : paginated.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-[#E6E1D6] bg-white py-14 text-center">
          <Bell className="mx-auto mb-2.5 h-8 w-8 text-muted-foreground/50" />
          <p className="font-display text-sm font-bold text-foreground">
            এই ফিল্টারে কোনো বিজ্ঞপ্তি নেই
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            অন্য ক্যাটাগরি বেছে নিন অথবা অপঠিত ফিল্টার পরিবর্তন করুন।
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {paginated.map((item) => {
            const st = getTypeStyle(item.type);
            const IconComp = st.icon;
            const isUrgent = item.priority === "urgent";
            const isHigh = item.priority === "high";
            return (
              <div
                key={item.id}
                onClick={() => {
                  if (!item.read) void markAsRead(item.id);
                  if (item.link) {
                    if (item.link.startsWith("/")) {
                      void navigate({ to: item.link as "/" });
                    } else if (/^https?:\/\//i.test(item.link)) {
                      window.location.assign(item.link);
                    }
                  }
                }}
                className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                  isUrgent && !item.read
                    ? "border-rose-500/50 bg-rose-500/[0.06] shadow-sm"
                    : isHigh && !item.read
                    ? "border-amber-500/50 bg-amber-500/[0.05] shadow-sm"
                    : item.read
                    ? "border-border/70 bg-card/70 hover:bg-muted/30"
                    : "border-primary/35 bg-primary/[0.04] shadow-xs hover:bg-primary/[0.07]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${st.cls}`}>
                    <IconComp className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.priority === "urgent" && (
                        <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9.5px] font-black text-white">
                          জরুরি
                        </span>
                      )}
                      {item.priority === "high" && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-800">
                          গুরুত্বপূর্ণ
                        </span>
                      )}
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9.5px] font-bold text-primary">
                        {item.category || "সিস্টেম বিজ্ঞপ্তি"}
                      </span>
                      {item.audience && item.audience !== "all_users" && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[9.5px] font-semibold text-muted-foreground">
                          <ShieldCheck className="h-2.5 w-2.5" />
                          {item.audience === "specific_users"
                            ? "ব্যক্তিগত"
                            : item.audience === "all_admins"
                            ? "সকল এডমিন"
                            : item.audience === "ordinary_admins"
                            ? "সাধারণ অ্যাডমিন"
                            : "অ্যাডমিন ও এডিটর"}
                        </span>
                      )}
                      {!item.read && (
                        <span className="ml-auto rounded bg-rose-500 px-1.5 py-0.5 text-[9.5px] font-bold text-white">
                          নতুন
                        </span>
                      )}
                    </div>

                    <h3
                      className={`mt-1.5 font-display text-sm ${
                        item.read ? "font-bold text-foreground" : "font-extrabold text-primary-deep"
                      }`}
                    >
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {item.message}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatBnDateTime(item.created_at) || "সম্প্রতি"}
                      </span>

                      <div className="flex items-center gap-3">
                        {!item.read && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void markAsRead(item.id);
                            }}
                            className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                          >
                            <Check className="h-3.5 w-3.5" /> পঠিত চিহ্নিত করুন
                          </button>
                        )}
                        {item.link && (
                          <span className="inline-flex items-center gap-0.5 font-bold text-primary">
                            বিস্তারিত দেখুন <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {visibleCount < filtered.length && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-bold text-foreground shadow-xs transition hover:bg-muted"
              >
                আরও দেখুন ({filtered.length - visibleCount} টি বাকি)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
