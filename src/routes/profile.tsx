import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
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
  AlertTriangle,
  Bookmark,
  Bell,
  Trash2,
  ExternalLink,
  Loader2,
  AlertCircle,
  Check,
  CheckCheck,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { listMySecurityEvents } from "@/lib/security";
import { useCloudSubmissions } from "@/lib/cloud";
import { isSuperAdminEmail, REGULAR_ADMIN_EMAIL } from "@/lib/firebase";
import { UniversalImageUploader } from "@/components/UniversalImageUploader";
import {
  useComplaints,
  useUserFavorites,
  toggleUserFavorite,
  useUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type ComplaintItem,
} from "@/lib/district-platform";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "আমার প্রোফাইল ও নাগরিক ড্যাশবোর্ড — স্মার্ট নোয়াখালী" },
      {
        name: "description",
        content:
          "আপনার প্রোফাইল তথ্য, সেবা সাবমিশন, অভিযোগ ট্র্যাকিং, প্রিয় তালিকা ও নোটিফিকেশন পর্যবেক্ষণ করুন।",
      },
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
    isAuthed,
    loading: authLoading,
    isAdmin,
    isStaff,
    username,
    signOut,
    updateProfileInfo,
  } = useAuth();

  const { items: submissions } = useCloudSubmissions();
  const { complaints } = useComplaints();
  const { favorites } = useUserFavorites(user?.uid);
  const { notifications, unreadCount } = useUserNotifications(user?.uid);

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

  // Active tab: overview | submissions | complaints | favorites | notifications | security
  const [activeTab, setActiveTab] = useState<
    "overview" | "submissions" | "complaints" | "favorites" | "notifications" | "security"
  >("overview");

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

  // Filter user's own submissions
  const userSubmissions = useMemo(() => {
    if (!user) return [];
    return (submissions || []).filter((s: any) => {
      if (user.uid && s.user_id === user.uid) return true;
      if (user.email && s.submitter_email === user.email) return true;
      if (user.phone && s.submitter_phone === user.phone) return true;
      return false;
    });
  }, [submissions, user]);

  // Filter user's complaints
  const userComplaints = useMemo(() => {
    if (!user) return [];
    return (complaints || []).filter((c: ComplaintItem) => {
      if (user.uid && c.user_id === user.uid) return true;
      if (user.phone && c.contact_phone === user.phone) return true;
      return false;
    });
  }, [complaints, user]);

  // Profile completeness score
  const completenessScore = useMemo(() => {
    let score = 25; // Base registration
    if (user?.displayName) score += 25;
    if (user?.photoURL || photoURL) score += 25;
    if (user?.phone || phone) score += 25;
    return Math.min(score, 100);
  }, [user, photoURL, phone]);

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

  const handleRemoveFavorite = async (item: any) => {
    try {
      await toggleUserFavorite(user.uid, item);
      toast.success("প্রিয় তালিকা থেকে সরানো হয়েছে");
    } catch (err: any) {
      toast.error("প্রিয় তালিকা আপডেট করতে সমস্যা হয়েছে");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-3.5 py-6 sm:px-4 sm:py-8">
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
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-card p-5 shadow-elevated sm:p-7">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute left-0 bottom-0 -ml-16 -mb-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl pointer-events-none" />

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
                  নাগরিক অ্যাকাউন্ট
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
                    <span title="ভেরিফাইড">
                      <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
                    </span>
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
                <span>{user.email ? "ইমেইল অ্যাকাউন্ট" : "মোবাইল অ্যাকাউন্ট"}</span>
              </div>
            </div>

            {/* Profile Completion Meter */}
            <div className="mt-4 max-w-sm">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-foreground flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" /> প্রোফাইল সম্পূর্ণতা
                </span>
                <span className="font-bold text-primary">{completenessScore}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-gradient-hero transition-all duration-500 rounded-full"
                  style={{ width: `${completenessScore}%` }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
              <button
                type="button"
                onClick={() => setIsEditing((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted active:scale-95"
              >
                <Camera className="h-3.5 w-3.5 text-primary" />
                <span>{isEditing ? "সম্পাদনা বন্ধ" : "তথ্য ও ছবি পরিবর্তন"}</span>
              </button>
              <Link
                to="/submit-info"
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-hero px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm active:scale-95"
              >
                <Sparkles className="h-3.5 w-3.5 text-gold" />
                <span>নতুন সেবা যোগ করুন</span>
              </Link>
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
                  onChange={(e) =>
                    setUname(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                  }
                  placeholder="যেমন: noakhali_user"
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

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-primary-deep">
                  প্রোফাইল ছবি (ক্যামেরা বা গ্যালারি থেকে নির্বাচন করুন)
                </label>
                <UniversalImageUploader
                  variant="inline"
                  category="profile"
                  entityId={user.uid}
                  value={photoURL}
                  onChange={(url) => setPhotoURL(url || "")}
                  label="প্রোফাইল ছবি আপলোড করুন"
                  hint="মোবাইল বা পিসি থেকে ছবি নির্বাচন করুন — স্বয়ংক্রিয়ভাবে অপ্টিমাইজ ও Firebase Storage-এ সংরক্ষিত হবে"
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

      {/* Tabs Navigation Bar */}
      <div className="mt-6 flex overflow-x-auto gap-2 border-b border-border pb-2 scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            activeTab === "overview"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" /> ওভারভিউ
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("submissions")}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            activeTab === "submissions"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <FileText className="h-3.5 w-3.5" /> আমার সেবা ({userSubmissions.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("complaints")}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            activeTab === "complaints"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" /> আমার অভিযোগ ({userComplaints.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("favorites")}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            activeTab === "favorites"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Bookmark className="h-3.5 w-3.5" /> প্রিয় তালিকা ({favorites.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("notifications")}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            activeTab === "notifications"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Bell className="h-3.5 w-3.5" /> নোটিফিকেশন
          {unreadCount > 0 && (
            <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] text-white font-mono">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("security")}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            activeTab === "security"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Lock className="h-3.5 w-3.5" /> নিরাপত্তা ও হিস্ট্রি
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="mt-5 space-y-4 animate-in fade-in duration-200">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <div className="rounded-2xl border border-border/80 bg-gradient-card p-4 text-center shadow-card">
              <p className="text-[11px] font-semibold text-muted-foreground">জমাকৃত সেবা</p>
              <p className="mt-1 font-display text-xl font-bold text-foreground">
                {userSubmissions.length} টি
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-gradient-card p-4 text-center shadow-card">
              <p className="text-[11px] font-semibold text-muted-foreground">দাখিলকৃত অভিযোগ</p>
              <p className="mt-1 font-display text-xl font-bold text-foreground">
                {userComplaints.length} টি
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-gradient-card p-4 text-center shadow-card">
              <p className="text-[11px] font-semibold text-muted-foreground">বুকমার্ককৃত আইটেম</p>
              <p className="mt-1 font-display text-xl font-bold text-primary">
                {favorites.length} টি
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-gradient-card p-4 text-center shadow-card">
              <p className="text-[11px] font-semibold text-muted-foreground">অ্যাক্টিভিটি লগ</p>
              <p className="mt-1 font-display text-xl font-bold text-emerald-600">
                {activities.length} টি
              </p>
            </div>
          </div>

          {/* Quick District Portals */}
          <div className="rounded-2xl border border-border/80 bg-gradient-card p-5 shadow-card">
            <h3 className="font-display text-sm font-bold text-foreground mb-3">
              নাগরিক জরুরি পোর্টালসমূহ
            </h3>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Link
                to="/directory"
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-border bg-card text-center hover:border-primary/40 hover:bg-muted/40 transition"
              >
                <span className="text-xl mb-1">🏢</span>
                <span className="text-xs font-bold text-foreground">প্রতিষ্ঠান ডিরেক্টরি</span>
                <span className="text-[10px] text-muted-foreground">ব্যবসা ও অফিস</span>
              </Link>

              <Link
                to="/map"
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-border bg-card text-center hover:border-primary/40 hover:bg-muted/40 transition"
              >
                <span className="text-xl mb-1">🗺️</span>
                <span className="text-xs font-bold text-foreground">নোয়াখালী ম্যাপ</span>
                <span className="text-[10px] text-muted-foreground">৯ উপজেলার তথ্য</span>
              </Link>

              <Link
                to="/career"
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-border bg-card text-center hover:border-primary/40 hover:bg-muted/40 transition"
              >
                <span className="text-xl mb-1">🎓</span>
                <span className="text-xs font-bold text-foreground">শিক্ষা ও ক্যারিয়ার</span>
                <span className="text-[10px] text-muted-foreground">চাকরি ও প্রতিষ্ঠান</span>
              </Link>

              <Link
                to="/complaint-tracking"
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-border bg-card text-center hover:border-primary/40 hover:bg-muted/40 transition"
              >
                <span className="text-xl mb-1">📢</span>
                <span className="text-xs font-bold text-foreground">অভিযোগ ট্র্যাকিং</span>
                <span className="text-[10px] text-muted-foreground">লাইভ সমাধান</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: User Submissions */}
      {activeTab === "submissions" && (
        <div className="mt-5 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-foreground">
              আমার জমাকৃত সেবাসমূহের তালিকা
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
              আপনার কোনো জমাকৃত তথ্য বা সেবা নেই।
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
                          {sub.category_slug || "সাধারণ সেবা"}
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

      {/* Tab 3: My Complaints */}
      {activeTab === "complaints" && (
        <div className="mt-5 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-bold text-foreground">
                আমার দাখিলকৃত নাগরিক অভিযোগসমূহ
              </h3>
              <p className="text-xs text-muted-foreground">
                প্রতিটি অভিযোগের ট্র্যাকিং নম্বর দিয়ে অগ্রগতি পর্যবেক্ষণ করুন
              </p>
            </div>
            <Link
              to="/complaint-tracking"
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              + নতুন অভিযোগ দাখিল
            </Link>
          </div>

          {userComplaints.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
              আপনার কোনো সক্রিয় বা অতীত অভিযোগ পাওয়া যায়নি।
              <div className="mt-3">
                <Link
                  to="/complaint-tracking"
                  className="inline-flex items-center gap-1 rounded-xl bg-gradient-hero px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm"
                >
                  অভিযোগ দাখিল করুন
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {userComplaints.map((comp) => {
                return (
                  <div
                    key={comp.id}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-border/80 bg-gradient-card p-4 shadow-sm sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-lg">
                          #{comp.tracking_number}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            comp.status === "resolved"
                              ? "bg-emerald-500/15 text-emerald-700"
                              : comp.status === "rejected"
                              ? "bg-red-500/15 text-red-700"
                              : comp.status === "in_progress"
                              ? "bg-blue-500/15 text-blue-700"
                              : "bg-amber-500/15 text-amber-700"
                          }`}
                        >
                          {comp.status === "resolved"
                            ? "সমাধান সম্পন্ন"
                            : comp.status === "rejected"
                            ? "বাতিল"
                            : comp.status === "in_progress"
                            ? "কার্যক্রম চলমান"
                            : "পর্যালোচনা চলছে"}
                        </span>
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {comp.category} • 📍 {comp.upazila}
                        </span>
                      </div>

                      <h4 className="mt-1 font-display text-sm font-bold text-foreground">
                        {comp.subject}
                      </h4>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {comp.description}
                      </p>

                      {comp.admin_remarks && (
                        <div className="mt-2 rounded-xl bg-muted/60 p-2 text-xs text-muted-foreground">
                          <strong className="text-foreground">সমাধান বার্তা:</strong>{" "}
                          {comp.admin_remarks}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <Link
                        to="/complaint-tracking"
                        search={{ q: comp.tracking_number } as any}
                        className="inline-flex items-center gap-1 rounded-xl bg-card border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted active:scale-95"
                      >
                        ট্র্যাক করুন <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Bookmarked Favorites */}
      {activeTab === "favorites" && (
        <div className="mt-5 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-foreground">
              সংরক্ষিত প্রিয় তালিকা ({favorites.length} টি)
            </h3>
            <span className="text-xs text-muted-foreground">
              আপনার সংরক্ষিত সেবা ও প্রতিষ্ঠান
            </span>
          </div>

          {favorites.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              <Bookmark className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
              আপনার প্রিয় তালিকায় কোনো আইটেম যোগ করা হয়নি।
              <p className="mt-1 text-[11px]">
                ডিরেক্টরি বা ক্যারিয়ার পোর্টাল থেকে বুকমার্ক বাটনে ক্লিক করে এখানে যুক্ত করতে পারেন।
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {favorites.map((fav) => (
                <div
                  key={fav.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-gradient-card p-3.5 shadow-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {fav.target_type || "সেবা"}
                      </span>
                    </div>
                    <h4 className="mt-0.5 font-display text-xs sm:text-sm font-bold text-foreground">
                      {fav.title}
                    </h4>
                    {fav.subtitle && (
                      <p className="line-clamp-1 text-[11px] text-muted-foreground">
                        {fav.subtitle}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {fav.link && (
                      <Link
                        to={fav.link}
                        className="inline-flex items-center gap-1 rounded-xl bg-muted px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/80 text-foreground"
                      >
                        দেখুন <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleRemoveFavorite(fav)}
                      className="p-1.5 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="সরিয়ে ফেলুন"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: In-App Notifications */}
      {activeTab === "notifications" && (
        <div className="mt-5 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-foreground">
              নোটিফিকেশন সেন্টার ({notifications.length} টি)
            </h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={async () => {
                  if (user?.uid) {
                    await markAllNotificationsRead(user.uid);
                    toast.success("সকল নোটিফিকেশন পঠিত হিসেবে চিহ্নিত হয়েছে");
                  }
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" /> সকল পঠিত চিহ্নিত করুন
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              <Bell className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
              এখনো কোনো নোটিফিকেশন নেই।
            </div>
          ) : (
            <div className="space-y-2.5">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`flex flex-col justify-between gap-2 rounded-2xl border p-3.5 shadow-sm sm:flex-row sm:items-center ${
                    notif.read
                      ? "border-border/60 bg-card/60 opacity-80"
                      : "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                        notif.read ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
                      }`}
                    >
                      <Bell className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-display text-xs sm:text-sm font-bold text-foreground">
                          {notif.title}
                        </h4>
                        {!notif.read && (
                          <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[9px] font-bold text-white">
                            নতুন
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{notif.message}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 sm:justify-end">
                    <span className="text-[10.5px] text-muted-foreground">
                      {formatBnDate(notif.created_at)}
                    </span>
                    {!notif.read && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (user?.uid) await markNotificationRead(user.uid, notif.id);
                        }}
                        className="rounded-lg bg-card border border-border p-1 text-muted-foreground hover:text-foreground"
                        title="পঠিত চিহ্নিত করুন"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Security & Account Info */}
      {activeTab === "security" && (
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
                      : "সাধারণ নাগরিক"}
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
              নিরাপত্তা ও পাসওয়ার্ড ব্যবস্থাপনা
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              আপনার পাসওয়ার্ড পরিবর্তন করতে পারেন অথবা সাইন-আউট করতে পারেন।
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <Link
                to="/reset-password"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-muted"
              >
                <Lock className="h-3.5 w-3.5 text-primary" /> পাসওয়ার্ড পরিবর্তন
              </Link>
            </div>
          </div>

          {/* Activity Logs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-foreground">
                সাম্প্রতিক সিকিউরিটি অডিট ও লগইন হিস্ট্রি
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
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
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
        </div>
      )}
    </div>
  );
}
