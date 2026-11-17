import React, { useMemo, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  useAdminNotifications,
  createAdminNotification,
  deleteAdminNotification,
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

export function AdminNotificationsManager() {
  const { isMainAdmin } = useAuth();
  const { items, loading, error } = useAdminNotifications(isMainAdmin);

  const [isGlobal, setIsGlobal] = useState(true);
  const [targetUserId, setTargetUserId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<UserNotificationItem["type"]>("info");
  const [link, setLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        (n.user_id || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  if (!isMainAdmin) {
    return (
      <div className="rounded-3xl border border-amber-500/40 bg-amber-50/70 p-6 text-center">
        <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-amber-700" />
        <h3 className="font-display text-sm font-bold text-amber-950">
          প্রধান এডমিন সংরক্ষিত বিভাগ
        </h3>
        <p className="mt-1 text-xs text-amber-800">
          সিস্টেম বিজ্ঞপ্তি প্রকাশ ও পরিচালনা করার অনুমতি শুধুমাত্র প্রধান এডমিনের।
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
    if (!isGlobal && !targetUserId.trim()) {
      toast.error("নির্দিষ্ট ব্যবহারকারীর UID লিখুন অথবা 'সকল ব্যবহারকারী' নির্বাচন করুন।");
      return;
    }

    setSubmitting(true);
    try {
      await createAdminNotification({
        title: title.trim(),
        message: message.trim(),
        type,
        is_global: isGlobal,
        user_id: isGlobal ? undefined : targetUserId.trim(),
        link: link.trim() || undefined,
      });
      toast.success(
        isGlobal
          ? "সকল নাগরিক ও ব্যবহারকারীর জন্য গ্লোবাল বিজ্ঞপ্তি পাঠানো হয়েছে!"
          : "নির্দিষ্ট ব্যবহারকারীর কাছে বিজ্ঞপ্তি পাঠানো হয়েছে!"
      );
      setTitle("");
      setMessage("");
      setLink("");
      if (!isGlobal) setTargetUserId("");
    } catch (err: any) {
      toast.error(err?.message || "বিজ্ঞপ্তি পাঠানো যায়নি।");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("এই বিজ্ঞপ্তিটি কি ডেটাবেস থেকে মুছে ফেলবেন?")) return;
    setDeletingId(id);
    try {
      await deleteAdminNotification(id);
      toast.success("বিজ্ঞপ্তিটি মুছে ফেলা হয়েছে।");
    } catch (err: any) {
      toast.error(err?.message || "বিজ্ঞপ্তি মোছা সম্ভব হয়নি।");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-amber-500/5 p-5 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-sm">
            <BellRing className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-base font-extrabold text-primary-deep">
              বিজ্ঞপ্তি ও ব্রডকাস্ট ম্যানেজমেন্ট (Main Admin Only)
            </h2>
            <p className="text-xs text-muted-foreground">
              হোমপেজ ও প্রোফাইলের নোটিফিকেশন বেল আইকনে তাৎক্ষণিক বিজ্ঞপ্তি প্রকাশ এবং পরিচালনা করুন।
            </p>
          </div>
        </div>
      </div>

      {/* Create Notification Form */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="rounded-3xl border border-border/80 bg-card p-5 shadow-card space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <h3 className="font-display text-sm font-bold text-foreground">
            নতুন বিজ্ঞপ্তি পাঠান
          </h3>
          <div className="inline-flex rounded-full border border-border bg-muted/60 p-0.5">
            <button
              type="button"
              onClick={() => setIsGlobal(true)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition ${
                isGlobal
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Globe className="h-3 w-3" /> সকল ব্যবহারকারী (Global)
            </button>
            <button
              type="button"
              onClick={() => setIsGlobal(false)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold transition ${
                !isGlobal
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserCheck className="h-3 w-3" /> নির্দিষ্ট ইউজার (UID)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {!isGlobal && (
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-foreground">
                টার্গেট ব্যবহারকারীর UID *
              </label>
              <input
                type="text"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                placeholder="Firebase User UID (যেমন: aBcDeFg123...)"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
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

          <div>
            <label className="text-[11px] font-bold text-foreground">
              বিজ্ঞপ্তির ধরন (Type)
            </label>
            <select
              value={type}
              onChange={(e) =>
                setType(e.target.value as UserNotificationItem["type"])
              }
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold focus:border-primary focus:outline-none"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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

          <div className="sm:col-span-2">
            <label className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
              <Link2 className="h-3 w-3" /> অ্যাকশন লিংক (ঐচ্ছিক — যেমন /donation বা https://...)
            </label>
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="/donation"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-hero px-5 py-2.5 text-xs font-extrabold text-primary-foreground shadow-elevated transition hover:brightness-105 active:scale-95 disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            <span>{submitting ? "প্রকাশ হচ্ছে..." : "বিজ্ঞপ্তি প্রকাশ করুন"}</span>
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
              placeholder="বিজ্ঞপ্তি খুঁজুন..."
              className="w-full rounded-full border border-border bg-background py-1.5 pl-8 pr-3 text-xs focus:border-primary focus:outline-none"
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
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${
                            item.is_global
                              ? "bg-emerald-500/15 text-emerald-700"
                              : "bg-blue-500/15 text-blue-700"
                          }`}
                        >
                          {item.is_global ? "সকল (Global)" : `UID: ${item.user_id || "—"}`}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {item.message}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                        <span>
                          {new Date(item.created_at).toLocaleString("bn-BD")}
                        </span>
                        {item.link && (
                          <span className="font-mono text-primary">{item.link}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={deletingId === item.id}
                    onClick={() => void handleDelete(item.id)}
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
    </div>
  );
}
