import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  User as UserIcon,
  Mail,
  Phone,
  ShieldCheck,
  Calendar,
  Sparkles,
  Camera,
  Save,
  CheckCircle2,
  Clock,
  Activity,
  ArrowLeft,
  LogOut,
  RefreshCw,
  Lock,
  Globe,
  FileText,
  BadgeCheck,
  Smartphone,
  ExternalLink,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { listMySecurityEvents } from "@/lib/security";
import { useCloudSubmissions } from "@/lib/cloud";
import { isSuperAdminEmail, REGULAR_ADMIN_EMAIL } from "@/lib/firebase";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "আমার প্রোফাইল ও অ্যাকাউন্ট অ্যাক্টিভিটি — স্মার্ট নোয়াখালী" },
      { name: "description", content: "আপনার প্রোফাইল তথ্য দেখুন, পাসওয়ার্ড পরিবর্তন করুন এবং অ্যাকাউন্ট অ্যাক্টিভিটি পর্যবেক্ষণ করুন।" },
    ],
  }),
  component: ProfilePage,
});

interface SecurityEventItem {
  id: string;
  event: string;
  detail?: string;
  created_at: string;
  user_agent?: string | null;
}

function formatBnDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString("bn-BD", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

function getEventBadge(eventName: string): { label: string; color: string } {
  const ev = (eventName || "").toLowerCase();
  if (ev.includes("google") || ev.includes("login_success")) {
    return { label: "লগইন সফল", color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" };
  }
  if (ev.includes("profile")) {
    return { label: "প্রোফাইল আপডেট", color: "bg-blue-500/15 text-blue-700 border-blue-500/30" };
  }
  if (ev.includes("signup")) {
    return { label: "নতুন একাউন্ট", color: "bg-purple-500/15 text-purple-700 border-purple-500/30" };
  }
  if (ev.includes("failed")) {
    return { label: "ব্যর্থ প্রচেষ্টা", color: "bg-red-500/15 text-red-700 border-red-500/30" };
  }
  if (ev.includes("locked") || ev.includes("pin")) {
    return { label: "সিকিউরিটি", color: "bg-amber-500/15 text-amber-700 border-amber-500/30" };
  }
  return { label: "সিস্টেম ইভেন্ট", color: "bg-muted text-muted-foreground border-border" };
}

function ProfilePage() {
  const navigate = useNavigate();
  const {
    user,
    firebaseUser,
    isAuthed,
    loading: authLoading,
    isAdmin,
    isStaff,
    isMainAdmin,
    roles,
    username,
    signOut,
    updateProfileInfo,
  } = useAuth();

  const { items: submissions } = useCloudSubmissions();

  // Form states
  const [displayName, setDisplayName] = useState("");
  const [uname, setUname] = useState("");
  const [phone, setPhone] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Security activity state
  const [activities, setActivities] = useState<SecurityEventItem[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<"info" | "activity" | "submissions">("info");

  // Load user data into form
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setPhone(user.phone || "");
      setPhotoURL(user.photoURL || "");
      setUname(username || (user.email ? user.email.split("@")[0] : "user"));
    }
  }, [user, username]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !isAuthed) {
      navigate({ to: "/auth", replace: true });
    }
  }, [authLoading, isAuthed, navigate]);

  // Load security events
  const loadActivities = async () => {
    setLoadingActivities(true);
    try {
      const items = await listMySecurityEvents();
      setActivities(items || []);
    } catch (err) {
      console.warn("Failed to load activities:", err);
    } finally {
      setLoadingActivities(false);
    }
  };

  useEffect(() => {
    if (isAuthed) {
      void loadActivities();
    }
  }, [isAuthed]);

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">প্রোফাইল তথ্য লোড হচ্ছে...</p>
      </div>
    );
  }

  if (!isAuthed || !user) {
    return null;
  }

  // Filter user's own submissions
  const userSubmissions = (submissions || []).filter((s: any) => {
    if (user.uid && s.user_id === user.uid) return true;
    if (user.email && s.submitter_email === user.email) return true;
    if (user.phone && s.submitter_phone === user.phone) return true;
    return false;
  });

  const isSuper = isSuperAdminEmail(user.email);
  const isRegularAdmin = (user.email || "").trim().toLowerCase() === REGULAR_ADMIN_EMAIL.toLowerCase();

  // Save changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("অনুগ্রহ করে আপনার নাম দিন");
      return;
    }
    setSaving(true);
    try {
      await updateProfileInfo({
        displayName: displayName.trim(),
        photoURL: photoURL.trim() || undefined,
        phone: phone.trim() || undefined,
        username: uname.trim() || undefined,
      });
      setIsEditing(false);
      toast.success("প্রোফাইল তথ্য সফলভাবে আপডেট হয়েছে!");
      void loadActivities();
    } catch (err: any) {
      toast.error(err?.message || "প্রোফাইল আপডেট করতে সমস্যা হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    toast.success("সফলভাবে লগআউট হয়েছে");
    navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
      {/* Top Navigation */}
      <div className="mb-5 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> হোমে ফিরে যান
        </Link>
        <div className="flex items-center gap-2">
          {isStaff && (
            <Link
              to="/mdmahmudulhashan"
              className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/15 px-3 py-1.5 text-xs font-bold text-gold transition hover:bg-gold/25"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-gold" /> এডমিন প্যানেল
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" /> লগআউট
          </button>
        </div>
      </div>

      {/* Main Profile Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-card p-6 shadow-elevated sm:p-8">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute left-0 bottom-0 -ml-16 -mb-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />

        <div className="relative z-10 flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-6">
          {/* Avatar with status border */}
          <div className="relative shrink-0">
            <div className="relative h-24 w-24 overflow-hidden rounded-full bg-gradient-to-tr from-amber-400 via-primary to-emerald-600 p-1 shadow-gold ring-4 ring-background sm:h-28 sm:w-28">
              {photoURL || user.photoURL ? (
                <img
                  src={photoURL || user.photoURL || ""}
                  alt={displayName || "User Avatar"}
                  className="h-full w-full rounded-full object-cover bg-white"
                  onError={() => setPhotoURL("")}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserIcon className="h-12 w-12" />
                </div>
              )}
            </div>
          </div>

          {/* User Details */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
                {user.displayName || "স্মার্ট ব্যবহারকারী"}
              </h1>
              {isSuper && (
                <span className="rounded-full bg-gradient-hero px-3 py-0.5 text-xs font-bold text-primary-foreground shadow-sm">
                  প্রধান সুপার এডমিন
                </span>
              )}
              {isRegularAdmin && !isSuper && (
                <span className="rounded-full bg-gold/20 px-3 py-0.5 text-xs font-bold text-gold border border-gold/40">
                  এডমিন
                </span>
              )}
              {!isSuper && !isRegularAdmin && isStaff && (
                <span className="rounded-full bg-primary/15 px-3 py-0.5 text-xs font-bold text-primary border border-primary/30">
                  স্টাফ মেম্বার
                </span>
              )}
              {!isStaff && (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground border border-border">
                  সাধারণ সদস্য
                </span>
              )}
            </div>

            <p className="mt-1 font-mono text-xs font-semibold text-primary">
              @{uname || "user"}
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-y-1.5 gap-x-4 text-xs text-muted-foreground sm:justify-start">
              {user.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-primary" />
                  <span>{user.email}</span>
                  {user.emailVerified && (
                    <span title="ভেরিফাইড"><BadgeCheck className="h-3.5 w-3.5 text-emerald-600" /></span>
                  )}
                </div>
              )}
              {user.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  <span>{user.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-primary" />
                <span>{user.email ? "ইমেইল ও পাসওয়ার্ড" : "মোবাইল একাউন্ট"}</span>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
              <button
                type="button"
                onClick={() => setIsEditing((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted active:scale-95"
              >
                <Camera className="h-3.5 w-3.5 text-primary" />
                <span>{isEditing ? "সম্পাদনা বন্ধ করুন" : "প্রোফাইল সম্পাদন"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Edit Form Dropdown / Expander */}
        {isEditing && (
          <form
            onSubmit={handleSaveProfile}
            className="mt-6 border-t border-border/80 pt-6 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <h2 className="mb-4 font-display text-sm font-bold text-foreground">
              প্রোফাইল তথ্য ও ছবি সম্পাদন করুন
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-primary-deep">
                  ডিসপ্লে নাম / পূর্ণ নাম *
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="আপনার নাম লিখুন"
                  required
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-primary-deep">
                  ইউজারনেম
                </label>
                <input
                  type="text"
                  value={uname}
                  onChange={(e) => setUname(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="যেমন: mahmudul_12"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-primary-deep">
                  মোবাইল নাম্বার
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-primary-deep">
                  প্রোফাইল ছবির URL (বা Google সিঙ্ক করুন)
                </label>
                <input
                  type="url"
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-hero px-5 py-2 text-xs font-bold text-primary-foreground shadow-elevated disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> সংরক্ষণ হচ্ছে...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" /> সংরক্ষণ করুন
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Profile Overview Stats */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-2xl border border-border/80 bg-gradient-card p-4 text-center shadow-card">
          <p className="text-[11px] font-semibold text-muted-foreground">অ্যাকাউন্ট স্ট্যাটাস</p>
          <div className="mt-1 flex items-center justify-center gap-1 font-display text-base font-bold text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> সক্রিয়
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-gradient-card p-4 text-center shadow-card">
          <p className="text-[11px] font-semibold text-muted-foreground">সাইন-ইন মাধ্যম</p>
          <p className="mt-1 font-display text-base font-bold text-primary-deep">
            {user.email ? "ইমেইল ও পাসওয়ার্ড" : "মোবাইল নম্বর"}
          </p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-gradient-card p-4 text-center shadow-card">
          <p className="text-[11px] font-semibold text-muted-foreground">আমার সাবমিশন</p>
          <p className="mt-1 font-display text-lg font-bold text-foreground">
            {userSubmissions.length} টি
          </p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-gradient-card p-4 text-center shadow-card">
          <p className="text-[11px] font-semibold text-muted-foreground">অ্যাক্টিভিটি রেকর্ড</p>
          <p className="mt-1 font-display text-lg font-bold text-foreground">
            {activities.length} টি
          </p>
        </div>
      </div>

      {/* Tabs Selection */}
      <div className="mt-6 flex gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("info")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "info"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <UserIcon className="h-3.5 w-3.5" /> প্রোফাইল বিবরণ
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("activity")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "activity"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Activity className="h-3.5 w-3.5" /> অ্যাকাউন্ট অ্যাক্টিভিটি ({activities.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("submissions")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeTab === "submissions"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <FileText className="h-3.5 w-3.5" /> সাবমিশন ইতিহাস ({userSubmissions.length})
        </button>
      </div>

      {/* Tab 1: Profile Information */}
      {activeTab === "info" && (
        <div className="mt-5 space-y-4 animate-in fade-in duration-200">
          <div className="rounded-2xl border border-border/80 bg-gradient-card p-5 shadow-card sm:p-6">
            <h3 className="mb-4 font-display text-sm font-bold text-foreground">
              ব্যক্তিগত ও অ্যাকাউন্ট তথ্যাবলী
            </h3>
            <div className="divide-y divide-border/60 text-xs">
              <div className="flex flex-col py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-muted-foreground">পূর্ণ নাম (Display Name):</span>
                <span className="font-bold text-foreground">{user.displayName || "দেওয়া হয়নি"}</span>
              </div>
              <div className="flex flex-col py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-muted-foreground">ইউজারনেম (Username):</span>
                <span className="font-mono font-bold text-primary">@{uname}</span>
              </div>
              <div className="flex flex-col py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-muted-foreground">ইমেইল ঠিকানা (Email):</span>
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <span>{user.email || "—"}</span>
                  {user.emailVerified ? (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      ভেরিফাইড
                    </span>
                  ) : (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                      আনভেরিফাইড
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-muted-foreground">মোবাইল ফোন (Mobile):</span>
                <span className="font-bold text-foreground">{user.phone || "সংযুক্ত করা হয়নি"}</span>
              </div>
              <div className="flex flex-col py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-muted-foreground">অ্যাকাউন্ট রোল (Role):</span>
                <div className="flex items-center gap-1 font-bold text-primary-deep">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  <span>
                    {isSuper
                      ? "প্রধান সুপার এডমিন (সর্বোচ্চ ক্ষমতা)"
                      : isRegularAdmin
                      ? "এডমিন"
                      : isStaff
                      ? "স্টাফ"
                      : "সাধারণ ব্যবহারকারী"}
                  </span>
                </div>
              </div>
              <div className="flex flex-col py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-muted-foreground">ইউজার আইডি (UID):</span>
                <span className="font-mono text-[11px] text-muted-foreground">{user.uid}</span>
              </div>
            </div>
          </div>

          {/* Security & Actions Box */}
          <div className="rounded-2xl border border-border/80 bg-gradient-card p-5 shadow-card">
            <h3 className="mb-2 font-display text-sm font-bold text-foreground">
              নিরাপত্তা ও সেটিংস
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              আপনার পাসওয়ার্ড পরিবর্তন করতে পারেন অথবা নতুন তথ্য জমা দিতে পারেন।
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Link
                to="/reset-password"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-muted"
              >
                <Lock className="h-3.5 w-3.5 text-primary" /> পাসওয়ার্ড পরিবর্তন
              </Link>
              <Link
                to="/submit-info"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-muted"
              >
                <FileText className="h-3.5 w-3.5 text-primary" /> নতুন তথ্য সাবমিট করুন
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Account Activity */}
      {activeTab === "activity" && (
        <div className="mt-5 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-foreground">
              সাম্প্রতিক অ্যাকাউন্ট অ্যাক্টিভিটি ও সিকিউরিটি লগ
            </h3>
            <button
              type="button"
              onClick={() => void loadActivities()}
              disabled={loadingActivities}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${loadingActivities ? "animate-spin" : ""}`} />
              রিফ্রেশ
            </button>
          </div>

          {activities.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              <Clock className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
              এখনো কোনো সাম্প্রতিক অ্যাক্টিভিটি রেকর্ড পাওয়া যায়নি।
            </div>
          ) : (
            <div className="space-y-2.5">
              {activities.map((act) => {
                const badge = getEventBadge(act.event);
                return (
                  <div
                    key={act.id}
                    className="flex flex-col justify-between gap-2 rounded-2xl border border-border/80 bg-gradient-card p-3.5 shadow-sm transition hover:border-primary/40 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                          <span className="font-mono text-[11px] font-semibold text-foreground">
                            {act.event}
                          </span>
                        </div>
                        {act.detail && (
                          <p className="mt-1 text-xs text-muted-foreground">{act.detail}</p>
                        )}
                        {act.user_agent && (
                          <p className="mt-0.5 max-w-md truncate text-[10px] text-muted-foreground/70">
                            ডিভাইস: {act.user_agent}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-left sm:text-right">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {formatBnDate(act.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: User Submissions */}
      {activeTab === "submissions" && (
        <div className="mt-5 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-foreground">
              আমার জমাকৃত তথ্যের তালিকা
            </h3>
            <Link
              to="/submit-info"
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              + নতুন তথ্য জমা দিন
            </Link>
          </div>

          {userSubmissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              <FileText className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
              আপনার কোনো জমাকৃত তথ্য বা সাবমিশন নেই।
              <div className="mt-3">
                <Link
                  to="/submit-info"
                  className="inline-flex items-center gap-1 rounded-xl bg-gradient-hero px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm"
                >
                  তথ্য জমা দিন
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {userSubmissions.map((sub: any) => {
                const status = sub.status || "pending";
                const isApproved = status === "approved";
                const isRejected = status === "rejected";
                return (
                  <div
                    key={sub.id}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-gradient-card p-4 shadow-sm sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isApproved
                              ? "bg-emerald-500/15 text-emerald-700"
                              : isRejected
                              ? "bg-red-500/15 text-red-700"
                              : "bg-amber-500/15 text-amber-700"
                          }`}
                        >
                          {isApproved ? "অনুমোদিত" : isRejected ? "বাতিল" : "পেন্ডিং (যাচাই চলছে)"}
                        </span>
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {sub.category_slug || "সাধারণ"}
                        </span>
                      </div>
                      <h4 className="mt-1 font-display text-sm font-bold text-foreground">
                        {sub.title || sub.name || "নামহীন সাবমিশন"}
                      </h4>
                      {sub.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {sub.description}
                        </p>
                      )}
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="text-[11px] text-muted-foreground">
                        {sub.created_at ? formatBnDate(sub.created_at) : "সম্প্রতি"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
