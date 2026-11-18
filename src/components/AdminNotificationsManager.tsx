import React, { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Globe,
  UserCheck,
  Send,
  Trash2,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  RefreshCw,
  Search,
  Link2,
  Clock,
  Mail,
  Smartphone,
  Bell,
  RotateCcw,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { recordSuperAdminAudit } from "@/lib/staff-audit";
import {
  NOTIFICATION_CATEGORIES,
  useAdminNotifications,
  useNotificationDeliveries,
  dispatchNotification,
  deleteAdminNotification,
  retryNotificationDelivery,
  type NotificationAudience,
  type NotificationCategory,
  type NotificationPriority,
  type NotificationDeliveryRecord,
  type UserNotificationItem,
} from "@/lib/district-platform";

const TYPE_OPTIONS: Array<{
  value: UserNotificationItem["type"];
  label: string;
}> = [
  { value: "info", label: "সাধারণ তথ্য (Info)" },
  { value: "success", label: "সফল / সুসংবাদ (Success)" },
  { value: "warning", label: "জরুরি সতর্কতা (Warning)" },
  { value: "status_update", label: "স্ট্যাটাস আপডেট (Update)" },
];

const AUDIENCE_OPTIONS: Array<{
  value: NotificationAudience;
  label: string;
}> = [
  { value: "all_users", label: "সকল নাগরিক ও ব্যবহারকারী (All Users)" },
  { value: "specific_users", label: "নির্দিষ্ট ব্যবহারকারী (Specific UIDs)" },
  { value: "all_admins", label: "সকল এডমিন (All Admins)" },
  { value: "ordinary_admins", label: "শুধু সাধারণ এডমিন (Ordinary Admins)" },
  { value: "staff_editors", label: "স্টাফ, এডিটর ও মডারেটর (Staff & Editors)" },
];

const PRIORITY_OPTIONS: Array<{
  value: NotificationPriority;
  label: string;
}> = [
  { value: "normal", label: "সাধারণ (Normal)" },
  { value: "high", label: "গুরুত্বপূর্ণ (High)" },
  { value: "urgent", label: "অতি জরুরি (Urgent)" },
];

interface DirectoryUserOption {
  uid: string;
  email: string;
  full_name: string;
  roles: string[];
}

export function AdminNotificationsManager() {
  const { isMainAdmin } = useAuth();
  const { items, loading, error } = useAdminNotifications(isMainAdmin);
  const { deliveries, loading: loadingDeliveries } = useNotificationDeliveries(isMainAdmin);

  const [activeSubTab, setActiveSubTab] = useState<"compose" | "deliveries">("compose");
  const [audience, setAudience] = useState<NotificationAudience>("all_users");
  const [targetUserId, setTargetUserId] = useState("");
  const [targetEmail, setTargetEmail] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<UserNotificationItem["type"]>("info");
  const [category, setCategory] = useState<NotificationCategory>("জরুরি বিজ্ঞপ্তি");
  const [priority, setPriority] = useState<NotificationPriority>("normal");
  const [link, setLink] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [channelInApp, setChannelInApp] = useState(true);
  const [channelWebPush, setChannelWebPush] = useState(false);
  const [channelEmail, setChannelEmail] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(
    () => `idem_${Date.now().toString(36)}`
  );

  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<UserNotificationItem | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [userOptions, setUserOptions] = useState<DirectoryUserOption[]>([]);

  useEffect(() => {
    if (!isMainAdmin) return;
    let mounted = true;
    fetch("/api/auth/users")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mounted || !data || !Array.isArray(data.users)) return;
        setUserOptions(
          data.users.map((u: any) => ({
            uid: String(u.uid || ""),
            email: String(u.email || ""),
            full_name: String(u.full_name || u.username || u.email || "User"),
            roles: Array.isArray(u.roles) ? u.roles : ["user"],
          }))
        );
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [isMainAdmin]);

  const kpis = useMemo(() => {
    const sent = deliveries.filter((d) => d.status === "sent").length;
    const queued = deliveries.filter((d) => d.status === "queued").length;
    const failed = deliveries.filter((d) => d.status === "failed").length;
    const readCount = items.filter((n) => n.read).length;
    return {
      totalPublished: items.length,
      sent,
      queued,
      failed,
      readCount,
    };
  }, [items, deliveries]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        (n.category || "").toLowerCase().includes(q) ||
        (n.user_id || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  if (!isMainAdmin) {
    return (
      <div className="rounded-3xl border border-amber-500/40 bg-amber-50/70 p-6 text-center">
        <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-amber-700" />
        <h3 className="font-display text-sm font-bold text-amber-950">
          প্রধান সুপার এডমিন সংরক্ষিত বিভাগ
        </h3>
        <p className="mt-1 text-xs text-amber-800">
          মাল্টি-চ্যানেল সিস্টেম বিজ্ঞপ্তি প্রকাশ ও পরিচালনা করার অনুমতি শুধুমাত্র প্রধান সুপার এডমিনের।
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error("বিজ্ঞপ্তির শিরোনাম ও বার্তা লিখুন।");
      return;
    }
    if (!channelInApp && !channelWebPush && !channelEmail) {
      toast.error("কমপক্ষে একটি ডেলিভারি চ্যানেল (ইন-অ্যাপ / পুশ / ইমেইল) নির্বাচন করুন।");
      return;
    }
    if (audience === "specific_users" && !targetUserId.trim()) {
      toast.error("নির্দিষ্ট ব্যবহারকারীর কমপক্ষে একটি UID লিখুন।");
      return;
    }

    setSubmitting(true);
    try {
      const scheduledIso = scheduledAt ? new Date(scheduledAt).toISOString() : undefined;
      const result = await dispatchNotification({
        title: title.trim(),
        message: message.trim(),
        type,
        category,
        priority,
        audience,
        user_id: audience === "specific_users" ? targetUserId.trim() : undefined,
        target_email: channelEmail ? targetEmail.trim() : undefined,
        link: link.trim() || undefined,
        scheduled_at: scheduledIso,
        channels: {
          in_app: channelInApp,
          web_push: channelWebPush,
          email: channelEmail,
        },
        idempotency_key: idempotencyKey.trim() || undefined,
      });

      if (result.duplicate) {
        toast.info("এই Idempotency Key দিয়ে ইতিমধ্যেই বিজ্ঞপ্তি পাঠানো হয়েছে (ডুপ্লিকেট প্রতিরোধ)।");
        return;
      }

      const failedCount = result.deliveries.filter((d) => d.status === "failed").length;
      const sentCount = result.deliveries.filter((d) => d.status === "sent").length;
      const queuedCount = result.deliveries.filter((d) => d.status === "queued").length;

      await recordSuperAdminAudit({
        action: "notification_send",
        module: "notifications",
        target_id: result.notifId,
        target_label: title.trim(),
        summary: `${category} • টার্গেট: ${audience} • সফল: ${sentCount}, সিডিউলড: ${queuedCount}, ব্যর্থ: ${failedCount}`,
        metadata: {
          priority,
          channels: { in_app: channelInApp, web_push: channelWebPush, email: channelEmail },
        },
      });

      if (failedCount > 0) {
        toast.warning(
          `বিজ্ঞপ্তি তৈরি হয়েছে (সফল: ${sentCount}, সিডিউলড: ${queuedCount}, ব্যর্থ: ${failedCount})। বিস্তারিত ডেলিভারি লগে দেখুন।`
        );
      } else if (queuedCount > 0) {
        toast.success(`সিডিউলড বিজ্ঞপ্তি কিউ করা হয়েছে (${new Date(scheduledIso!).toLocaleString("bn-BD")})`);
      } else {
        toast.success("বিজ্ঞপ্তি সফলভাবে প্রকাশিত হয়েছে!");
      }

      setTitle("");
      setMessage("");
      setLink("");
      setScheduledAt("");
      setIdempotencyKey(`idem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`);
      if (audience === "specific_users") {
        setTargetUserId("");
      }
    } catch (err: any) {
      toast.error(err?.message || "বিজ্ঞপ্তি পাঠানো যায়নি।");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDeleteNotification() {
    if (!confirmDeleteItem) return;
    setDeletingId(confirmDeleteItem.id);
    try {
      await deleteAdminNotification(confirmDeleteItem.id);
      await recordSuperAdminAudit({
        action: "delete",
        module: "notifications",
        target_id: confirmDeleteItem.id,
        target_label: confirmDeleteItem.title,
        summary: `প্রকাশিত বিজ্ঞপ্তি মুছে ফেলা হয়েছে (${confirmDeleteItem.category || "সাধারণ"})`,
      });
      toast.success("বিজ্ঞপ্তিটি মুছে ফেলা হয়েছে।");
      setConfirmDeleteItem(null);
    } catch (err: any) {
      toast.error(err?.message || "বিজ্ঞপ্তি মোছা সম্ভব হয়নি।");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRetryDelivery(rec: NotificationDeliveryRecord) {
    setRetryingId(rec.id);
    try {
      const linkedNotif = items.find((n) => n.id === rec.notification_id);
      const res = await retryNotificationDelivery(rec, linkedNotif?.message);
      if (res.ok) {
        toast.success(`${rec.recipient} এ ইমেইল পুনরায় পাঠানো সফল হয়েছে!`);
      } else {
        toast.error(res.error || "ইমেইল পাঠানো ব্যর্থ হয়েছে।");
      }
    } finally {
      setRetryingId(null);
    }
  }

  const appendUserSelection = (u: DirectoryUserOption) => {
    const current = targetUserId
      .split(/[\s,]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (!current.includes(u.uid)) {
      setTargetUserId([...current, u.uid].join(", "));
    }
    if (channelEmail && u.email && !u.email.endsWith(".smartnoakhali.app")) {
      const emails = targetEmail
        .split(/[\s,;]+/)
        .map((x) => x.trim())
        .filter(Boolean);
      if (!emails.includes(u.email)) {
        setTargetEmail([...emails, u.email].join(", "));
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-amber-500/5 p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-sm">
              <BellRing className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-base font-extrabold text-primary-deep">
                মাল্টি-চ্যানেল বিজ্ঞপ্তি ড্যাশবোর্ড (Super Admin Only)
              </h2>
              <p className="text-xs text-muted-foreground">
                ইন-অ্যাপ ইনবক্স, ব্রাউজার পুশ, ইমেইল ডিসপ্যাচ, সিডিউলিং ও সৎ ডেলিভারি লগ ট্র্যাকিং
              </p>
            </div>
          </div>

          <div className="flex rounded-xl border border-border bg-muted/50 p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveSubTab("compose")}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeSubTab === "compose"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              বিজ্ঞপ্তি পাঠান ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab("deliveries")}
              className={`rounded-lg px-3 py-1.5 transition ${
                activeSubTab === "deliveries"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ডেলিভারি লগ ({deliveries.length})
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-card/90 p-3">
            <p className="text-[10.5px] font-semibold text-muted-foreground">প্রকাশিত বিজ্ঞপ্তি</p>
            <p className="mt-0.5 text-lg font-extrabold text-foreground">{kpis.totalPublished}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3">
            <p className="text-[10.5px] font-semibold text-emerald-800">সফল ডেলিভারি</p>
            <p className="mt-0.5 text-lg font-extrabold text-emerald-700">{kpis.sent}</p>
          </div>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-[10.5px] font-semibold text-amber-800">অপেক্ষমাণ / সিডিউলড</p>
            <p className="mt-0.5 text-lg font-extrabold text-amber-700">{kpis.queued}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-3">
            <p className="text-[10.5px] font-semibold text-rose-800">ব্যর্থ ডেলিভারি</p>
            <p className="mt-0.5 text-lg font-extrabold text-rose-700">{kpis.failed}</p>
          </div>
        </div>
      </div>

      {activeSubTab === "compose" ? (
        <>
          {/* Create Notification Form */}
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="rounded-3xl border border-border/80 bg-card p-5 shadow-card space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <h3 className="font-display text-sm font-bold text-foreground">
                নতুন মাল্টি-চ্যানেল বিজ্ঞপ্তি তৈরি করুন
              </h3>
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
                Key: {idempotencyKey}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-bold text-foreground">
                  লক্ষ্য দর্শক (Audience) *
                </label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as NotificationAudience)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold focus:border-primary focus:outline-none"
                >
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-foreground">
                  বিজ্ঞপ্তির ক্যাটাগরি (১০টি বাংলা ক্যাটাগরি) *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as NotificationCategory)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold focus:border-primary focus:outline-none"
                >
                  {NOTIFICATION_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {audience === "specific_users" && (
                <div className="sm:col-span-2 space-y-2 rounded-2xl border border-border/80 bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-[11px] font-bold text-foreground">
                      টার্গেট ব্যবহারকারীর UID (একাধিক হলে কমা দিয়ে লিখুন) *
                    </label>
                    {userOptions.length > 0 && (
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const found = userOptions.find((u) => u.uid === e.target.value);
                          if (found) appendUserSelection(found);
                          e.target.value = "";
                        }}
                        className="max-w-xs rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-semibold focus:border-primary focus:outline-none"
                      >
                        <option value="">+ নিবন্ধিত ইউজার থেকে বাছাই করুন</option>
                        {userOptions.map((u) => (
                          <option key={u.uid} value={u.uid}>
                            {u.full_name} ({u.email || u.uid})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <input
                    type="text"
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    placeholder="যেমন: uid_123, uid_456"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-foreground">
                  বিজ্ঞপ্তির শিরোনাম *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="যেমন: জরুরি রক্তদান ক্যাম্পেইন ২০২৬"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold focus:border-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-foreground">ধরন (Type)</label>
                  <select
                    value={type}
                    onChange={(e) =>
                      setType(e.target.value as UserNotificationItem["type"])
                    }
                    className="mt-1 w-full rounded-xl border border-border bg-background px-2.5 py-2 text-xs font-semibold focus:border-primary focus:outline-none"
                  >
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-foreground">অগ্রাধিকার (Priority)</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as NotificationPriority)}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-2.5 py-2 text-xs font-semibold focus:border-primary focus:outline-none"
                  >
                    {PRIORITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-foreground">
                  বিস্তারিত বার্তা *
                </label>
                <textarea
                  required
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="নাগরিকদের জন্য স্পষ্ট ও তথ্যপূর্ণ বার্তা লিখুন..."
                  className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-xs leading-relaxed focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                  <Link2 className="h-3 w-3" /> অ্যাকশন লিংক (ঐচ্ছিক — যেমন /donation)
                </label>
                <input
                  type="text"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="/notifications অথবা /donation"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                  <Clock className="h-3 w-3" /> সিডিউল সময় (ঐচ্ছিক — খালি রাখলে তাৎক্ষণিক)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                />
              </div>

              {/* Delivery Channels */}
              <div className="sm:col-span-2 rounded-2xl border border-border/80 bg-muted/20 p-3.5 space-y-2.5">
                <p className="text-[11px] font-bold text-foreground">ডেলিভারি চ্যানেল নির্বাচন:</p>
                <div className="flex flex-wrap gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={channelInApp}
                      onChange={(e) => setChannelInApp(e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    <Bell className="h-3.5 w-3.5 text-primary" />
                    <span>ইন-অ্যাপ ইনবক্স (In-App)</span>
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={channelWebPush}
                      onChange={(e) => setChannelWebPush(e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    <Smartphone className="h-3.5 w-3.5 text-amber-600" />
                    <span>ব্রাউজার পুশ (Web Push লগ)</span>
                  </label>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={channelEmail}
                      onChange={(e) => setChannelEmail(e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    <Mail className="h-3.5 w-3.5 text-blue-600" />
                    <span>ইমেইল (SMTP / Resend)</span>
                  </label>
                </div>

                {channelEmail && (
                  <div>
                    <label className="text-[11px] font-bold text-foreground">
                      প্রাপক ইমেইল ঠিকানা (একাধিক হলে কমা দিয়ে লিখুন) *
                    </label>
                    <input
                      type="text"
                      value={targetEmail}
                      onChange={(e) => setTargetEmail(e.target.value)}
                      placeholder="user1@example.com, user2@example.com"
                      className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs focus:border-primary focus:outline-none"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      সেটিংস ট্যাবে SMTP বা Resend API Key কনফিগার করা না থাকলে ব্যর্থতার প্রকৃত কারণ ডেলিভারি লগে রেকর্ড হবে।
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-hero px-5 py-2.5 text-xs font-extrabold text-primary-foreground shadow-elevated transition hover:brightness-105 active:scale-95 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>{submitting ? "প্রকাশ হচ্ছে..." : "বিজ্ঞপ্তি ডিসপ্যাচ করুন"}</span>
              </button>
            </div>
          </form>

          {/* Published Notifications List */}
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-card space-y-3.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-display text-sm font-bold text-foreground">
                প্রকাশিত বিজ্ঞপ্তি তালিকা ({items.length} টি)
              </h3>
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="শিরোনাম বা ক্যাটাগরি খুঁজুন..."
                  className="w-full rounded-xl border border-border bg-background py-1.5 pl-8 pr-3 text-xs focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 text-xs text-muted-foreground">
                <Loader2 className="mb-2 h-6 w-6 animate-spin text-primary" />
                বিজ্ঞপ্তি তালিকা লোড হচ্ছে...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
                কোনো বিজ্ঞপ্তি পাওয়া যায়নি।
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredItems.map((item) => {
                  const IconComp =
                    item.type === "success"
                      ? CheckCircle2
                      : item.type === "warning"
                      ? AlertTriangle
                      : item.type === "status_update"
                      ? RefreshCw
                      : Info;
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col justify-between gap-3 rounded-2xl border border-border/70 bg-background/70 p-3.5 sm:flex-row sm:items-start"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <IconComp className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h4 className="font-display text-xs font-extrabold text-foreground">
                              {item.title}
                            </h4>
                            {item.priority === "urgent" && (
                              <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white">
                                জরুরি
                              </span>
                            )}
                            {item.priority === "high" && (
                              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                                গুরুত্বপূর্ণ
                              </span>
                            )}
                            {item.category && (
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9.5px] font-bold text-primary">
                                {item.category}
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9.5px] font-bold ${
                                item.is_global
                                  ? "bg-emerald-500/15 text-emerald-700"
                                  : "bg-blue-500/15 text-blue-700"
                              }`}
                            >
                              {item.audience === "all_users" || item.is_global ? (
                                <Globe className="h-2.5 w-2.5" />
                              ) : (
                                <UserCheck className="h-2.5 w-2.5" />
                              )}
                              {item.audience || (item.is_global ? "all_users" : item.user_id || "specific")}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                            {item.message}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                            <span>{new Date(item.created_at).toLocaleString("bn-BD")}</span>
                            {item.scheduled_at && (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                <Clock className="h-2.5 w-2.5" /> সিডিউল: {new Date(item.scheduled_at).toLocaleString("bn-BD")}
                              </span>
                            )}
                            {item.link && (
                              <span className="font-mono text-primary">{item.link}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={deletingId === item.id}
                        onClick={() => setConfirmDeleteItem(item)}
                        className="inline-flex shrink-0 items-center gap-1 self-end rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-500/20 sm:self-start"
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        <span>মুছুন</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Delivery Logs Tab */
        <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-card space-y-3.5">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h3 className="font-display text-sm font-bold text-foreground">
                চ্যানেলভিত্তিক ডেলিভারি লগ (/notification_deliveries)
              </h3>
              <p className="text-[11px] text-muted-foreground">
                প্রতিটি ইন-অ্যাপ, Web Push ও ইমেইল প্রেরণের প্রকৃত অবস্থা ও ত্রুটি লগ
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> {deliveries.length} রেকর্ড
            </span>
          </div>

          {loadingDeliveries && deliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-xs text-muted-foreground">
              <Loader2 className="mb-2 h-6 w-6 animate-spin text-primary" />
              ডেলিভারি লগ লোড হচ্ছে...
            </div>
          ) : deliveries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-10 text-center text-xs text-muted-foreground">
              এখনো কোনো ডেলিভারি লগ রেকর্ড করা হয়নি।
            </div>
          ) : (
            <div className="space-y-2">
              {deliveries.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-col justify-between gap-2.5 rounded-2xl border border-border/70 bg-background/70 p-3.5 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase ${
                          d.status === "sent"
                            ? "bg-emerald-600 text-white"
                            : d.status === "queued"
                            ? "bg-amber-500 text-white"
                            : "bg-rose-600 text-white"
                        }`}
                      >
                        {d.status === "sent" ? "SENT" : d.status === "queued" ? "QUEUED" : "FAILED"}
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-foreground">
                        {d.channel}
                      </span>
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        {d.category}
                      </span>
                      <span className="font-display text-xs font-bold text-foreground">
                        {d.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      প্রাপক: <strong className="text-foreground">{d.recipient}</strong> •{" "}
                      {new Date(d.created_at).toLocaleString("bn-BD")}
                    </p>
                    {d.error_message && (
                      <p className="rounded-lg bg-rose-500/10 px-2.5 py-1 text-[11px] font-medium text-rose-800">
                        কারণ: {d.error_message}
                      </p>
                    )}
                  </div>

                  {d.status === "failed" && d.channel === "email" && (
                    <button
                      type="button"
                      disabled={retryingId === d.id}
                      onClick={() => void handleRetryDelivery(d)}
                      className="inline-flex shrink-0 items-center gap-1 self-end rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary transition hover:bg-primary/15 sm:self-center"
                    >
                      {retryingId === d.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      <span>পুনরায় চেষ্টা</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirm Delete Modal (no window.confirm) */}
      {confirmDeleteItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          onClick={() => setConfirmDeleteItem(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-elevated space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertTriangle className="h-5 w-5" />
                <h4 className="font-display text-sm font-extrabold">বিজ্ঞপ্তি মুছে ফেলবেন?</h4>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDeleteItem(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              “<strong className="text-foreground">{confirmDeleteItem.title}</strong>” বিজ্ঞপ্তিটি ডেটাবেস থেকে স্থায়ীভাবে মুছে ফেলা হবে।
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteItem(null)}
                className="rounded-xl border border-border px-3.5 py-2 text-xs font-bold text-foreground hover:bg-muted"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={deletingId === confirmDeleteItem.id}
                onClick={() => void confirmDeleteNotification()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deletingId === confirmDeleteItem.id && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                <span>হ্যাঁ, মুছুন</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
