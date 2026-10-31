import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  Loader2,
  Users as UsersIcon,
  KeyRound,
  MessageCircle,
  RefreshCcw,
  ShieldOff,
  ShieldAlert,
  FileText,
  Send,
  ArrowLeft,
  Lock,
  Unlock,
  ShieldCheck,
  LogOut,
  Check,
  X,
  Trash2,
  Upload,
  Image as ImageIcon,
  AlertCircle,
  Smartphone,
  Apple,
  Plus,
  Eye,
  EyeOff,
  Edit3,
  Save,
  Bell,
  LayoutGrid,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  HandCoins,
  Search,
  UserCircle2,
  Copy,
  Download,
  Settings,
  Activity,
  Camera,
  CheckCircle2,
  Sparkles,
  Database,
  Droplet,
  MapPin,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { auth, SUPER_ADMIN_EMAIL } from "@/lib/firebase";
import { sendBrowserNotification } from "@/lib/notifications";
import { CATEGORY_ICONS, CATEGORY_TINTS, DIVISIONS } from "@/data/categories";
import {
  syncCategoriesToFirestore,
  auditCategoriesFromFirestore,
  type CategoryMigrationResult,
  type CategoryAuditReport,
} from "@/lib/categories-migration";
import {
  useLogo,
  useCategories,
  useDivisions,
  useDonationConfig,
  useStaffProfiles,
  useAppPackages,
  useSiteMetaConfig,
  useServicesConfig,
  type CategoryConfigItem,
  type DivisionConfigItem,
  type DonationConfig,
  type DonationNumberItem,
  type SiteMetaConfig,
  type StaffProfileEntry,
  type ServiceItem,
  type ServicesConfig,
} from "@/lib/store";
import { downloadAppPackageBinary } from "@/lib/pwa";
import { useAuth } from "@/lib/auth";
import {
  useCloudDonations,
  useCloudExpenses,
  useCloudSubmissions,
  useCloudDonors,
  useCloudDonorEvents,
  useAppLinks,
  useEmergencyRequests,
  useCategoryAccess,
  useCategoryRequests,
  usePaymentRequests,
  useEmergencyBanners,
  useChatThreads,
  useThreadMessages,
  markThreadRead,
  uploadPublicImage,
  getUserSubmissionCounts,
  type BannerRow,
  type ChatThreadRow,
  type SubmissionRow,
  type DonationRow,
  type DonationCategory,
  DONATION_CATEGORY_LABELS,
  type DonorRow,
  type DonorEventRow,
  type EmergencyReqRow,
  type ExpenseRow,
  type ExpenseCategory,
  EXPENSE_CATEGORY_LABELS,
} from "@/lib/cloud";
import { FinancialReports } from "@/components/FinancialReports";
import {
  listUsers,
  createUser,
  setUserRole,
  deleteUser,
  suspendUser,
  resetUserPassword,
  updateUserProfile,
  listThreadsWithUsers,
  isProtectedMainSuperAdmin,
  recordUserCredential,
  type AdminUserRecord,
} from "@/lib/admin-client";
import {
  useStaffAuditLogs,
  recordStaffActivity,
  restoreDeletedAuditItem,
  type StaffActivityLogEntry,
} from "@/lib/staff-audit";
import { AttachmentView, VoiceRecorderButton } from "@/routes/chat";
import { UniversalImageUploader } from "@/components/UniversalImageUploader";
import { SecurityPanel } from "@/components/security/SecurityPanel";
import { RolePermissionsManager } from "@/components/RolePermissionsManager";
import { WebsiteBrandingManager } from "@/components/WebsiteBrandingManager";
import { TaskManager } from "@/components/TaskManager";
import { useRolePermissions } from "@/lib/permissions";
import {
  getLoginLockoutRemainingSeconds,
  recordFailedAdminLogin,
  clearFailedAdminLogins,
  getAdminSecurityPin,
  isAdminPanelLocked,
  setAdminPanelLocked,
  getSavedBackupCodes,
  logEvent,
} from "@/lib/security";

export const Route = createFileRoute("/mdmahmudulhashan")({
  head: () => ({
    meta: [
      { title: "সুপার এডমিন ও স্টাফ কন্ট্রোল প্যানেল — স্মার্ট নোয়াখালী" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const { isAuthed, isMainAdmin, isAdmin, isEditor, isModerator, isStaff, loading, signOut, user } = useAuth();
  const [screenLocked, setScreenLocked] = useState(() => isAdminPanelLocked());

  if (loading) {
    return (
      <div className="px-4 py-16 text-center text-sm text-muted-foreground">
        <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
        এডমিন ও স্টাফ এক্সেস যাচাই হচ্ছে...
      </div>
    );
  }

  // 1. If authenticated as an ordinary user without staff/admin privileges: Access Denied
  const isAuthorized = isMainAdmin || isAdmin || isEditor || isModerator || isStaff;
  if (isAuthed && !isAuthorized) {
    return (
      <div className="mx-auto max-w-md px-4 pt-16 pb-20 text-center">
        <div className="rounded-3xl border border-destructive/25 bg-destructive/5 p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="font-display text-lg font-bold text-destructive">
            অ্যাকসেস প্রত্যাখ্যাত (403 Forbidden)
          </h2>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            এডমিন ড্যাশবোর্ড (<span className="font-mono font-semibold text-foreground">/mdmahmudulhashan</span>) শুধুমাত্র অনুমোদিত এডমিন ও স্টাফ সদস্যদের জন্য সংরক্ষিত।
          </p>
          <div className="mt-3.5 rounded-xl border border-border bg-card p-3 text-xs text-left">
            <span className="text-muted-foreground text-[11px]">আপনার বর্তমান অ্যাকাউন্ট:</span>
            <p className="font-mono font-semibold text-foreground break-all">{user?.email || "সাধারণ ব্যবহারকারী"}</p>
            <span className="inline-block mt-1.5 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-bold">
              সাধারণ ইউজার (স্টাফ পারমিশন নেই)
            </span>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            আপনার একাউন্টে কোনো এডমিন বা এডিটর ভূমিকা বরাদ্দ নেই। অ্যাক্সেসের জন্য প্রধান এডমিনের সাথে যোগাযোগ করুন।
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Link
              to="/"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              হোম পেজে ফিরে যান
            </Link>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                navigate({ to: "/auth", replace: true });
              }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted"
            >
              অন্য একাউন্ট দিয়ে লগইন করুন
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. If unauthenticated visitor: show AdminLoginForm with access notice
  if (!isAuthed) {
    return <AdminLoginForm />;
  }

  const handleLogout = async () => {
    setAdminPanelLocked(false);
    setScreenLocked(false);
    await signOut();
    toast.success("সফলভাবে লগআউট হয়েছে");
    navigate({ to: "/", replace: true });
  };

  const activePin = user?.id ? getAdminSecurityPin(user.id) : "";
  if (screenLocked && activePin) {
    return (
      <AdminPinLockScreen
        userId={user?.id || "super_admin_mahmudul"}
        userEmail={user?.email || ""}
        onUnlock={() => {
          setAdminPanelLocked(false);
          setScreenLocked(false);
        }}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <Dashboard
      onLogout={handleLogout}
      isMainAdmin={isMainAdmin}
      onLockScreen={() => {
        setAdminPanelLocked(true);
        setScreenLocked(true);
        void logEvent("panel_locked", "Admin panel locked manually");
        toast.info("এডমিন প্যানেল পিন লক করা হয়েছে");
      }}
    />
  );
}

function AdminPinLockScreen({
  userId,
  userEmail,
  onUnlock,
  onLogout,
}: {
  userId: string;
  userEmail: string;
  onUnlock: () => void;
  onLogout: () => void | Promise<void>;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    const savedPin = getAdminSecurityPin(userId);
    const backupCodes = getSavedBackupCodes(userId);
    const trimmed = pin.trim();
    if ((savedPin && trimmed === savedPin) || backupCodes.includes(trimmed)) {
      setError("");
      void logEvent("panel_unlocked", "Unlocked with PIN/backup code");
      toast.success("প্যানেল আনলক হয়েছে");
      onUnlock();
    } else {
      setError("ভুল সিকিউরিটি পিন বা রিকভারি কোড!");
      toast.error("ভুল পিন কোড");
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-12 pb-20">
      <div className="rounded-3xl border border-primary/30 bg-gradient-card p-6 text-center shadow-elevated">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary ring-2 ring-primary/30">
          <Lock className="h-8 w-8" />
        </div>
        <h2 className="font-display text-xl font-bold text-primary-deep">
          এডমিন সিকিউরিটি লক সক্রিয়
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {userEmail} • প্যানেলে প্রবেশ করতে আপনার গোপন পিন অথবা ব্যাকআপ কোড দিন
        </p>

        <form onSubmit={handleUnlock} className="mt-5 space-y-3">
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="পিন বা ব্যাকআপ কোড দিন"
            autoFocus
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-center font-mono text-lg tracking-widest outline-none focus:border-primary"
          />
          {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-hero py-3 text-sm font-bold text-primary-foreground shadow-elevated"
          >
            <Unlock className="h-4 w-4" /> আনলক করুন
          </button>
        </form>

        <button
          type="button"
          onClick={() => void onLogout()}
          className="mt-4 text-xs font-semibold text-muted-foreground underline hover:text-destructive"
        >
          লগআউট করুন
        </button>
      </div>
    </div>
  );
}

function AdminLoginForm() {
  const { signInSuperAdmin, signInUserOrStaff } = useAuth();
  const { logo } = useLogo();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const lockedSec = getLoginLockoutRemainingSeconds();
    if (lockedSec > 0) {
      return toast.error(
        `অতিরিক্ত ভুল চেষ্টার কারণে লক করা হয়েছে। ${lockedSec} সেকেন্ড পর চেষ্টা করুন।`
      );
    }

    const cleanInput = (username || "").trim().toLowerCase();
    const isSuperInput =
      cleanInput === (SUPER_ADMIN_EMAIL || "").toLowerCase() ||
      cleanInput === "mahmudul" ||
      cleanInput === "mahmud" ||
      cleanInput === "mdmahmudulhashan0";

    setBusy(true);
    try {
      if (isSuperInput) {
        const ok = await signInSuperAdmin(username, password);
        if (ok) {
          clearFailedAdminLogins();
          toast.success("স্বাগতম, মেইন এডমিন!");
          return;
        }
        recordFailedAdminLogin();
        await logEvent("login_failed", username);
        toast.error("ভুল মেইন এডমিন পাসওয়ার্ড!");
      } else {
        const res = await signInUserOrStaff(username, password);
        if (res && res.isStaff) {
          clearFailedAdminLogins();
          toast.success("স্বাগতম, স্টাফ কন্ট্রোল প্যানেল!");
          return;
        } else {
          recordFailedAdminLogin();
          await logEvent("login_failed", username);
          toast.error("এই অ্যাকাউন্টে এডমিন বা স্টাফ অনুমতি নেই।");
        }
      }
    } catch (err: any) {
      recordFailedAdminLogin();
      await logEvent("login_failed", username);
      toast.error(err?.message || "ভুল ইমেইল বা পাসওয়ার্ড");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-12 pb-20">
      <div className="rounded-3xl bg-gradient-card p-6 shadow-elevated">
        <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center p-1">
          <img
            src={logo}
            alt="Smart Noakhali Logo"
            className="h-full w-full object-contain"
          />
        </div>

        <h1 className="mb-1 text-center font-display text-lg font-bold text-primary-deep">
          এডমিন ও স্টাফ কন্ট্রোল প্যানেল
        </h1>
        <p className="mb-5 text-center text-xs text-muted-foreground">
          অনুমোদিত এডমিন ও স্টাফ সদস্যদের জন্য সংরক্ষিত
        </p>

        <form onSubmit={onSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-primary-deep">
              ইমেইল বা ইউজারনেমঃ
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-primary-deep">
              পাসওয়ার্ডঃ
            </label>
            <div className="relative mt-1">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-xl border bg-background px-3 py-2.5 pr-10 text-sm outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <button
            disabled={busy}
            type="submit"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-hero py-3 text-sm font-semibold text-primary-foreground shadow-elevated disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            লগইন করে প্রবেশ করুন
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary transition-colors">
            ← হোম পেজে ফিরে যান
          </Link>
          <Link to="/auth" className="hover:text-primary font-medium transition-colors">
            সাধারণ ইউজার লগইন →
          </Link>
        </div>
      </div>
    </div>
  );
}

type Tab =
  | "overview"
  | "tasks"
  | "roles"
  | "branding"
  | "activity"
  | "profile"
  | "categories"
  | "services"
  | "info"
  | "donation"
  | "expenses"
  | "donors"
  | "events"
  | "emergency"
  | "banners"
  | "chat"
  | "apps"
  | "users"
  | "access"
  | "settings"
  | "security";

function getRoleBadgeText(
  isMainAdmin: boolean,
  isAdmin: boolean,
  isEditor: boolean,
  isModerator: boolean
) {
  if (isMainAdmin) return "সুপার অ্যাডমিন";
  if (isAdmin) return "অ্যাডমিন";
  if (isEditor) return "এডিটর";
  if (isModerator) return "মডারেটর";
  return "স্টাফ";
}

function Dashboard({
  onLogout,
  isMainAdmin,
  onLockScreen,
}: {
  onLogout: () => void | Promise<void>;
  isMainAdmin: boolean;
  onLockScreen: () => void;
}) {
  const { user, isAdmin, isEditor, isModerator } = useAuth();
  const { hasPermission } = useRolePermissions();
  const { categories, allCategories } = useCategories();
  const { getStaffProfile } = useStaffProfiles();
  const subs = useCloudSubmissions();
  const dons = useCloudDonations();
  const expensesHook = useCloudExpenses();
  const donors = useCloudDonors();
  const events = useCloudDonorEvents();
  const emerg = useEmergencyRequests();
  const banners = useEmergencyBanners();
  const catReqs = useCategoryRequests();
  const payReqs = usePaymentRequests();
  const chatThreadsHook = useChatThreads();
  const unreadChatCount = chatThreadsHook.items.reduce(
    (sum, t) => sum + (Number(t.staff_unread) || 0),
    0
  );
  const auditHook = useStaffAuditLogs();
  const deletedAuditCount = auditHook.logs.filter(
    (l) => l.action_type === "delete" && !l.restored
  ).length;
  const { logo } = useLogo();
  const [tab, setTab] = useState<Tab>("overview");
  const [totalUsersCount, setTotalUsersCount] = useState<number>(0);
  const [refreshingDashboard, setRefreshingDashboard] = useState(false);

  useEffect(() => {
    if (!isMainAdmin && !isAdmin) return;
    let cancelled = false;
    const syncUsers = async () => {
      try {
        const list = await listUsers();
        if (!cancelled) setTotalUsersCount(list.length);
      } catch {
        // ignore
      }
    };
    void syncUsers();
    const t = setInterval(syncUsers, 60000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isMainAdmin, isAdmin]);

  const myStaffProfile =
    getStaffProfile(user?.id) || getStaffProfile(user?.email);
  const myAvatar = myStaffProfile?.photo_url || logo;
  const myDisplayName =
    myStaffProfile?.full_name ||
    user?.displayName ||
    (isMainAdmin ? "মেইন সুপার এডমিন" : user?.email?.split("@")[0] || "এডমিন");
  const myRoleLabel = getRoleBadgeText(isMainAdmin, isAdmin, isEditor, isModerator);
  const hasPin = Boolean(user?.id && getAdminSecurityPin(user.id));

  const pendingSubs = subs.items.filter((s) => s.status === "pending");
  const pendingDons = dons.items.filter((d) => d.status === "pending");
  const pendingDonors = donors.items.filter((d) => d.status === "pending");
  const pendingEvents = events.items.filter((e) => e.status === "pending");
  const pendingEmerg = emerg.items.filter((e) => e.status === "pending");
  const pendingCatReqs = catReqs.requests.filter((r) => r.status === "pending");
  const pendingPayReqs = payReqs.requests.filter((r) => r.status === "pending");
  const pendingAccessTotal = pendingCatReqs.length + pendingPayReqs.length;

  const totalAmount = dons.items
    .filter((d) => d.status === "approved")
    .reduce((s, x) => s + Number(x.amount), 0);
  const approvedDonors = donors.items.filter((d) => d.status === "approved").length;
  const activeBanners = banners.items.filter((b) => b.visible).length;
  const totalPending =
    pendingSubs.length +
    (isMainAdmin ? pendingDons.length + pendingAccessTotal : 0) +
    pendingDonors.length +
    pendingEvents.length +
    pendingEmerg.length;

  // Enforce dynamic tab access based on permissions
  useEffect(() => {
    const mainAdminOnlyTabs: Tab[] = [
      "roles",
      "services",
      "donation",
      "apps",
      "users",
      "access",
      "security",
    ];
    if (!isMainAdmin && mainAdminOnlyTabs.includes(tab)) {
      setTab("overview");
      return;
    }

    if (tab === "branding" && !isMainAdmin && !hasPermission("upload_branding")) {
      setTab("overview");
      return;
    }

    if (tab === "settings" && !isMainAdmin && !hasPermission("manage_settings")) {
      setTab("overview");
      return;
    }

    if (tab === "categories" && !isMainAdmin && !hasPermission("manage_categories")) {
      setTab("overview");
      return;
    }

    if (tab === "activity" && !isMainAdmin && !hasPermission("view_reports")) {
      setTab("overview");
      return;
    }
  }, [isMainAdmin, isAdmin, tab, hasPermission]);

  async function handleDashboardRefresh() {
    setRefreshingDashboard(true);
    try {
      await auditHook.refresh();
      if (isMainAdmin || isAdmin) {
        const list = await listUsers();
        setTotalUsersCount(list.length);
      }
      toast.success("এডমিন প্যানেলের সকল লাইভ ডাটা সিঙ্ক হয়েছে!");
    } catch {
      window.location.reload();
    } finally {
      setRefreshingDashboard(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-4">
      {/* Top Personal Profile & Control Header */}
      <div className="mb-4 rounded-3xl bg-gradient-hero p-4 text-primary-foreground shadow-elevated">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setTab("profile")}
              className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white p-0.5 ring-2 ring-gold shadow-gold"
              title="প্রোফাইল ফটো পরিবর্তন করুন"
            >
              <img
                src={myAvatar}
                alt={myDisplayName}
                className="h-full w-full rounded-full object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100">
                <Camera className="h-4 w-4 text-white" />
              </span>
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="font-display text-base font-bold">{myDisplayName}</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-2.5 py-0.5 text-[10px] font-bold text-gold ring-1 ring-gold/50">
                  <ShieldCheck className="h-3 w-3" /> {myRoleLabel}
                </span>
              </div>
              <p className="text-xs opacity-90">
                {user?.email || (isMainAdmin ? SUPER_ADMIN_EMAIL : "সুপার অ্যাডমিন")} •{" "}
                {totalPending > 0 ? `${totalPending} টি অপেক্ষমাণ অনুমোদন` : "সব আপডেট ও সিঙ্কড"}
              </p>
              <button
                type="button"
                onClick={() => setTab("profile")}
                className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold text-white hover:bg-white/25"
              >
                <UserCircle2 className="h-3 w-3" /> আমার প্রোফাইল ও ফটো আপলোড
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {hasPin && (
              <button
                type="button"
                onClick={onLockScreen}
                title="প্যানেল লক করুন"
                className="flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-1.5 text-xs font-bold text-gold ring-1 ring-gold/40 transition hover:bg-amber-400/30"
              >
                <Lock className="h-3.5 w-3.5" /> লক
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleDashboardRefresh()}
              title="সকল ডাটা লাইভ সিঙ্ক করুন"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${refreshingDashboard ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => void onLogout()}
              className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/25 active:scale-95"
            >
              <LogOut className="h-3.5 w-3.5" /> লগআউট
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="সক্রিয় ক্যাটাগরি" value={`${categories.length}/${allCategories.length}`} />
        <Stat
          label="অপেক্ষমাণ তথ্য"
          value={String(pendingSubs.length)}
          accent={pendingSubs.length > 0}
        />
        {isMainAdmin && (
          <Stat
            label="অপেক্ষমাণ অনুদান"
            value={String(pendingDons.length)}
            accent={pendingDons.length > 0}
          />
        )}
        <Stat
          label="অপেক্ষমাণ দাতা"
          value={String(pendingDonors.length)}
          accent={pendingDonors.length > 0}
        />
        {isMainAdmin && (
          <Stat label="মোট অনুদান" value={`${totalAmount.toLocaleString("bn-BD")}৳`} />
        )}
        <Stat label="অনুমোদিত দাতা" value={String(approvedDonors)} />
        <Stat
          label="জরুরী রিকোয়েস্ট"
          value={String(pendingEmerg.length)}
          accent={pendingEmerg.length > 0}
        />
        {isMainAdmin ? (
          <Stat
            label="মোট ইউজার ও স্টাফ"
            value={totalUsersCount > 0 ? String(totalUsersCount) : "সিঙ্কড"}
          />
        ) : (
          <Stat label="সক্রিয় ব্যানার" value={String(activeBanners)} />
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="mt-5 flex flex-wrap gap-1.5 rounded-2xl bg-muted p-1.5">
        <TabBtn active={tab === "overview"} onClick={() => setTab("overview")}>
          ড্যাশবোর্ড
        </TabBtn>
        <TabBtn active={tab === "tasks"} onClick={() => setTab("tasks")}>
          📋 টাস্ক ও করণীয়
        </TabBtn>
        {isMainAdmin && (
          <TabBtn active={tab === "roles"} onClick={() => setTab("roles")}>
            🛡️ রোল ও পারমিশন
          </TabBtn>
        )}
        {(isMainAdmin || hasPermission("upload_branding")) && (
          <TabBtn active={tab === "branding"} onClick={() => setTab("branding")}>
            🎨 ওয়েবসাইট ব্র্যান্ডিং
          </TabBtn>
        )}
        {(isMainAdmin || hasPermission("view_reports")) && (
          <TabBtn
            active={tab === "activity"}
            onClick={() => setTab("activity")}
            badge={deletedAuditCount > 0 ? deletedAuditCount : auditHook.logs.length}
          >
            🕵️ স্টাফ অ্যাক্টিভিটি ও ডিলিট লগ
          </TabBtn>
        )}
        <TabBtn active={tab === "profile"} onClick={() => setTab("profile")}>
          আমার প্রোফাইল
        </TabBtn>
        {(isMainAdmin || hasPermission("manage_categories")) && (
          <TabBtn active={tab === "categories"} onClick={() => setTab("categories")}>
            ক্যাটাগরি
          </TabBtn>
        )}
        {isMainAdmin && (
          <TabBtn active={tab === "services"} onClick={() => setTab("services")}>
            🛠️ আমাদের সেবা পরিচালনা
          </TabBtn>
        )}
        {(isMainAdmin || hasPermission("create_edit_content") || hasPermission("moderate_submissions")) && (
          <TabBtn active={tab === "info"} onClick={() => setTab("info")} badge={pendingSubs.length}>
            তথ্য
          </TabBtn>
        )}
        {isMainAdmin && (
          <TabBtn
            active={tab === "donation"}
            onClick={() => setTab("donation")}
            badge={pendingDons.length}
          >
            💰 অনুদান ও ফান্ড ড্যাশবোর্ড
          </TabBtn>
        )}
        {isMainAdmin && (
          <TabBtn
            active={tab === "expenses"}
            onClick={() => setTab("expenses")}
            badge={expensesHook.items.length}
          >
            🤝 মানবিক ব্যয় পরিচালনা
          </TabBtn>
        )}
        {(isMainAdmin || hasPermission("create_edit_content") || hasPermission("publish_content")) && (
          <TabBtn
            active={tab === "donors"}
            onClick={() => setTab("donors")}
            badge={pendingDonors.length}
          >
            দাতা
          </TabBtn>
        )}
        {(isMainAdmin || hasPermission("create_edit_content") || hasPermission("publish_content")) && (
          <TabBtn
            active={tab === "events"}
            onClick={() => setTab("events")}
            badge={pendingEvents.length}
          >
            রক্তদান
          </TabBtn>
        )}
        {(isMainAdmin || hasPermission("moderate_submissions")) && (
          <TabBtn
            active={tab === "emergency"}
            onClick={() => setTab("emergency")}
            badge={pendingEmerg.length}
          >
            জরুরী
          </TabBtn>
        )}
        {(isMainAdmin || hasPermission("publish_content") || hasPermission("manage_settings")) && (
          <TabBtn active={tab === "banners"} onClick={() => setTab("banners")}>
            ব্যানার
          </TabBtn>
        )}
        <TabBtn
          active={tab === "chat"}
          onClick={() => setTab("chat")}
          badge={unreadChatCount}
        >
          লাইভ চ্যাট
        </TabBtn>
        {isMainAdmin && (
          <TabBtn active={tab === "apps"} onClick={() => setTab("apps")}>
            অ্যাপ আপলোড
          </TabBtn>
        )}
        {(isMainAdmin || hasPermission("manage_users")) && (
          <TabBtn
            active={tab === "users"}
            onClick={() => setTab("users")}
            badge={totalUsersCount > 0 ? totalUsersCount : undefined}
          >
            ইউজার ও পাসওয়ার্ড
          </TabBtn>
        )}
        {isMainAdmin && (
          <TabBtn
            active={tab === "access"}
            onClick={() => setTab("access")}
            badge={pendingAccessTotal}
          >
            অ্যাকসেস ও রিকোয়েস্ট
          </TabBtn>
        )}
        {(isMainAdmin || hasPermission("manage_settings")) && (
          <TabBtn active={tab === "settings"} onClick={() => setTab("settings")}>
            সেটিংস
          </TabBtn>
        )}
        {isMainAdmin && (
          <TabBtn active={tab === "security"} onClick={() => setTab("security")}>
            নিরাপত্তা
          </TabBtn>
        )}
      </div>

      {/* Active Tab Content */}
      <div className="mt-4">
        {tab === "overview" && (
          <OverviewPanel
            onJump={setTab}
            isMainAdmin={isMainAdmin}
            pendingSubs={pendingSubs.length}
            pendingDons={pendingDons.length}
            pendingDonors={pendingDonors.length}
            pendingEvents={pendingEvents.length}
            pendingEmerg={pendingEmerg.length}
            pendingAccess={pendingAccessTotal}
            activeBanners={activeBanners}
            allSubs={subs.items}
            recentSubs={subs.items.slice(0, 5)}
            recentDons={dons.items.slice(0, 5)}
            auditLogs={auditHook.logs}
          />
        )}

        {tab === "tasks" && <TaskManager />}

        {tab === "roles" && isMainAdmin && <RolePermissionsManager />}

        {tab === "branding" && (isMainAdmin || hasPermission("upload_branding")) && (
          <WebsiteBrandingManager />
        )}

        {tab === "activity" && (isMainAdmin || hasPermission("view_reports")) && (
          <StaffActivityAuditPanel auditHook={auditHook} />
        )}

        {tab === "profile" && <MyStaffProfilePanel isMainAdmin={isMainAdmin} />}

        {tab === "categories" && (isMainAdmin || hasPermission("manage_categories")) && (
          <CategoriesEditor />
        )}

        {tab === "services" && isMainAdmin && <ServicesAdminPanel />}

        {tab === "info" && (isMainAdmin || hasPermission("create_edit_content") || hasPermission("moderate_submissions")) && (
          <SubmissionsAdminPanel subs={subs} />
        )}

        {tab === "donation" && isMainAdmin && (
          <DonationsAdminPanel dons={dons} expensesHook={expensesHook} logoUrl={logo} />
        )}

        {tab === "expenses" && isMainAdmin && (
          <ExpensesAdminPanel expensesHook={expensesHook} />
        )}

        {tab === "donors" && (isMainAdmin || hasPermission("create_edit_content") || hasPermission("publish_content")) && (
          <DonorsAdminPanel donors={donors} />
        )}

        {tab === "events" && (isMainAdmin || hasPermission("create_edit_content") || hasPermission("publish_content")) && (
          <EventsAdminPanel events={events} donors={donors} />
        )}

        {tab === "emergency" && (isMainAdmin || hasPermission("moderate_submissions")) && (
          <EmergencyEditor />
        )}

        {tab === "banners" && (isMainAdmin || hasPermission("publish_content") || hasPermission("manage_settings")) && (
          <BannersEditor />
        )}

        {tab === "chat" && <ChatThreadsAdmin />}

        {tab === "apps" && isMainAdmin && <AppPackagesAdminPanel />}

        {tab === "users" && (isMainAdmin || hasPermission("manage_users")) && <UsersEditor />}

        {tab === "access" && isMainAdmin && <AccessEditor />}

        {tab === "settings" && (isMainAdmin || hasPermission("manage_settings")) && (
          <SettingsAdminPanel />
        )}

        {tab === "security" && isMainAdmin && <SecurityPanel />}
      </div>
    </div>
  );
}

// ============================================================================
// Staff Individual Profile Workspace ("প্রোফাইলের মত কাজ করবে + প্রোফাইল ফটো আপলোড")
// Regular Admin / Editor / Moderator ONLY see their own profile.
// Super Admin sees their own profile PLUS all staff profiles!
// ============================================================================
function MyStaffProfilePanel({ isMainAdmin }: { isMainAdmin: boolean }) {
  const { user, username: authUsername, isAdmin, isEditor, isModerator } = useAuth();
  const { profiles: staffMap, getStaffProfile, upsertStaffProfile } = useStaffProfiles();
  const { logo } = useLogo();
  const photoInputRef = useRef<HTMLInputElement>(null);

  const existing = getStaffProfile(user?.id) || getStaffProfile(user?.email);
  const roleLabel = isMainAdmin
    ? "সুপার এডমিন"
    : isAdmin
      ? "এডমিন"
      : isEditor
        ? "এডিটর"
        : isModerator
          ? "মোডারেটর"
          : "স্টাফ";

  const [fullName, setFullName] = useState(
    existing?.full_name || user?.displayName || (isMainAdmin ? "মেইন সুপার এডমিন" : "")
  );
  const [username, setUsername] = useState(existing?.username || authUsername || "");
  const [phone, setPhone] = useState(existing?.phone || user?.phone || "");
  const [designation, setDesignation] = useState(
    existing?.designation || (isMainAdmin ? "প্রধান প্রশাসক (Super Admin)" : roleLabel)
  );
  const [photoUrl, setPhotoUrl] = useState(existing?.photo_url || "");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Super Admin editing another staff member's photo/profile
  const staffTargetInputRef = useRef<HTMLInputElement>(null);
  const [targetStaffUid, setTargetStaffUid] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      if (existing.full_name) setFullName(existing.full_name);
      if (existing.phone) setPhone(existing.phone);
      if (existing.designation) setDesignation(existing.designation);
      if (existing.photo_url) setPhotoUrl(existing.photo_url);
    }
  }, [existing?.full_name, existing?.phone, existing?.designation, existing?.photo_url]);

  async function onUploadMyPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) return toast.error("শুধু ছবি ফাইল নির্বাচন করুন");

    setUploadingPhoto(true);
    try {
      const compressed = await uploadPublicImage(file, `staff_avatars/${user.id}`);
      if (!compressed) throw new Error("ছবি প্রসেস করা যায়নি");
      setPhotoUrl(compressed);

      await upsertStaffProfile({
        uid: user.id,
        email: user.email || "",
        full_name: fullName.trim() || user.email?.split("@")[0] || roleLabel,
        role_label: roleLabel,
        photo_url: compressed,
        phone: phone.trim(),
        designation: designation.trim(),
      });
      await updateUserProfile({
        data: {
          user_id: user.id,
          email: user.email || undefined,
          full_name: fullName.trim() || undefined,
          username: username.trim() || undefined,
          phone: phone.trim() || undefined,
          photo_url: compressed,
          designation: designation.trim() || undefined,
        },
      });
      await logEvent("profile_photo_updated", user.email || user.id);
      toast.success("প্রোফাইল ফটো সফলভাবে আপডেট হয়েছে!");
    } catch (err: any) {
      toast.error(err?.message || "ফটো আপলোড ব্যর্থ");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSaveMyProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!fullName.trim()) return toast.error("আপনার নাম লিখুন");
    setSaving(true);
    try {
      await upsertStaffProfile({
        uid: user.id,
        email: user.email || "",
        full_name: fullName.trim(),
        role_label: roleLabel,
        photo_url: photoUrl,
        phone: phone.trim(),
        designation: designation.trim() || roleLabel,
      });
      await updateUserProfile({
        data: {
          user_id: user.id,
          email: user.email || undefined,
          full_name: fullName.trim(),
          username: username.trim() || undefined,
          phone: phone.trim() || undefined,
          photo_url: photoUrl || undefined,
          designation: designation.trim() || undefined,
        },
      });
      toast.success("আপনার প্রোফাইল সংরক্ষিত হয়েছে!");
    } catch (err: any) {
      toast.error(err?.message || "সংরক্ষণ ব্যর্থ");
    } finally {
      setSaving(false);
    }
  }

  async function onSuperAdminStaffPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !targetStaffUid) return;
    const item = staffMap[targetStaffUid];
    if (!item) return;
    const compressed = await uploadPublicImage(file, `staff_avatars/${targetStaffUid}`);
    if (!compressed) return toast.error("ফটো আপলোড ব্যর্থ");
    try {
      await upsertStaffProfile({
        ...item,
        photo_url: compressed,
      });
      await updateUserProfile({
        data: {
          user_id: targetStaffUid,
          photo_url: compressed,
        },
      });
      toast.success(`${item.full_name}-এর প্রোফাইল ফটো আপডেট হয়েছে`);
    } catch (err: any) {
      toast.error(err?.message || "ত্রুটি");
    } finally {
      setTargetStaffUid(null);
    }
  }

  // Filter deduplicated staff list for Super Admin
  const allStaffItems: StaffProfileEntry[] = (Object.values(staffMap) as StaffProfileEntry[]).filter(
    (item, idx, arr) =>
      arr.findIndex(
        (x) =>
          (Boolean(x?.email && item?.email && typeof x.email === "string" && typeof item.email === "string" && x.email.trim().toLowerCase() === item.email.trim().toLowerCase())) ||
          x.uid === item.uid
      ) === idx
  );

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-bold text-primary-deep">
              <UserCircle2 className="h-5 w-5 text-primary" /> আমার ব্যক্তিগত এডমিন প্রোফাইল
            </h2>
            <p className="text-xs text-muted-foreground">
              এখানে আপনার নাম ও প্রোফাইল ফটো সেট করুন। আপনি লাইভ চ্যাটে গ্রাহকের মেসেজের উত্তর দিলে আপনার এই নাম ও ফটো গ্রাহকের কাছে শো করবে।
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary-deep">
            পদবি: {roleLabel}
          </span>
        </div>

        <div className="mt-5 grid gap-6 md:grid-cols-[200px_1fr]">
          {/* Avatar Upload Column */}
          <div className="flex flex-col items-center text-center">
            <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-primary/20 bg-muted shadow-elevated">
              <img
                src={photoUrl || logo}
                alt={fullName}
                className="h-full w-full object-cover"
              />
              {uploadingPhoto && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={onUploadMyPhoto}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploadingPhoto}
              onClick={() => photoInputRef.current?.click()}
              className="mt-3 flex items-center gap-1.5 rounded-full bg-gradient-hero px-4 py-2 text-xs font-bold text-primary-foreground shadow-card"
            >
              <Camera className="h-3.5 w-3.5" /> প্রোফাইল ফটো আপলোড
            </button>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              JPG, PNG বা WebP (সর্বোচ্চ ৫MB)
            </p>
          </div>

          {/* Profile Form Column */}
          <form onSubmit={handleSaveMyProfile} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-primary-deep">
                  আপনার প্রদর্শিত নাম (লাইভ চ্যাটে দেখাবে) *
                </label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="আপনার পূর্ণ নাম লিখুন"
                  required
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-primary-deep">
                  ইমেইল (লগইন আইডি)
                </label>
                <input
                  value={user?.email || ""}
                  disabled
                  className="mt-1 w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-primary-deep">পদবি / দায়িত্ব</label>
                <input
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="যেমন: মডারেটর / কাস্টমার সাপোর্ট"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-primary-deep">মোবাইল নাম্বার</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Live Chat Responder Preview */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
              <p className="mb-2 text-[11px] font-bold text-primary-deep">
                💬 লাইভ চ্যাটে গ্রাহকের কাছে আপনার উত্তর যেভাবে দেখাবে (প্রিভিউ):
              </p>
              <div className="flex items-start gap-2.5">
                <img
                  src={photoUrl || logo}
                  alt={fullName}
                  className="h-9 w-9 shrink-0 rounded-full border border-primary/30 bg-white object-cover"
                />
                <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-3.5 py-2 text-xs shadow-sm">
                  <div className="mb-0.5 flex items-center gap-1.5">
                    <span className="font-bold text-primary-deep">
                      {fullName || "আপনার নাম"}
                    </span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                      {roleLabel}
                    </span>
                  </div>
                  <p className="text-foreground">
                    আসসালামু আলাইকুম! আমি আপনাকে কীভাবে সাহায্য করতে পারি?
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-muted-foreground">
                🔒 আপনার প্রোফাইল সম্পূর্ণ ব্যক্তিগত — অন্য কোনো এডমিন, এডিটর বা মোডারেটর এটি দেখতে পাবে না।
              </p>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 rounded-full bg-gradient-hero px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-elevated disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                প্রোফাইল সংরক্ষণ করুন
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Super Admin Only: View and manage ALL Staff Profiles */}
      {isMainAdmin && (
        <div className="rounded-3xl bg-card p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-display text-sm font-bold text-primary-deep">
                <ShieldCheck className="h-4 w-4 text-primary" /> সকল এডমিন, এডিটর ও মোডারেটর প্রোফাইল (শুধু সুপার এডমিন দেখতে পান)
              </h3>
              <p className="text-xs text-muted-foreground">
                এডমিন, এডিটর ও মোডারেটররা কেউ কাউকে দেখতে পারে না — শুধুমাত্র আপনি (সুপার এডমিন) সবার প্রোফাইল ও ফটো দেখতে এবং পরিবর্তন করতে পারবেন।
              </p>
            </div>
          </div>

          <input
            ref={staffTargetInputRef}
            type="file"
            accept="image/*"
            onChange={onSuperAdminStaffPhotoChange}
            className="hidden"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            {allStaffItems.map((st) => (
              <div
                key={st.uid}
                className="flex items-center gap-3 rounded-2xl border border-border bg-muted/20 p-3"
              >
                <img
                  src={st.photo_url || logo}
                  alt={st.full_name}
                  className="h-12 w-12 shrink-0 rounded-full border border-primary/30 bg-white object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = logo;
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-bold text-primary-deep">{st.full_name}</p>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {st.role_label}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">{st.email}</p>
                  {st.designation && (
                    <p className="truncate text-[10px] text-muted-foreground">{st.designation}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTargetStaffUid(st.uid);
                    staffTargetInputRef.current?.click();
                  }}
                  className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary-deep hover:bg-primary/20"
                >
                  <Camera className="mr-1 inline h-3 w-3" /> ফটো
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Super Admin: Direct Android (.APK) & iPhone (.IPA / iOS) App File Upload
// No URL input — direct file upload & 1-click customer download!
// ============================================================================
function AppPackagesAdminPanel() {
  const { packages, uploadAppBinary, updateAppMeta, removeAppBinary } = useAppPackages();
  const { items: cloudLinks, update: updateCloudLink } = useAppLinks();
  const [uploadingPlatform, setUploadingPlatform] = useState<"android" | "ios" | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    platform: "android" | "ios";
    pct: number;
    stage: string;
  } | null>(null);
  const [savingPlatform, setSavingPlatform] = useState<"android" | "ios" | null>(null);

  const androidInputRef = useRef<HTMLInputElement>(null);
  const iosInputRef = useRef<HTMLInputElement>(null);

  const [drafts, setDrafts] = useState({
    android: {
      label: packages.android?.label || "Android অ্যাপ (.APK)",
      version: packages.android?.version || "2.0.0",
      releaseNotes:
        packages.android?.releaseNotes ||
        "স্মার্ট নোয়াখালী অফিশিয়াল অ্যান্ড্রয়েড অ্যাপ — এক ক্লিকে ডাউনলোড ও ইনস্টল করুন।",
      visible: packages.android?.visible ?? true,
    },
    ios: {
      label: packages.ios?.label || "iPhone অ্যাপ (iOS)",
      version: packages.ios?.version || "2.0.0",
      releaseNotes:
        packages.ios?.releaseNotes ||
        "স্মার্ট নোয়াখালী অফিশিয়াল আইফোন (iOS) অ্যাপ — এক ক্লিকে ডাউনলোড ও ইনস্টল করুন।",
      visible: packages.ios?.visible ?? true,
    },
  });

  useEffect(() => {
    setDrafts({
      android: {
        label: packages.android?.label || "Android অ্যাপ (.APK)",
        version: packages.android?.version || "2.0.0",
        releaseNotes:
          packages.android?.releaseNotes ||
          "স্মার্ট নোয়াখালী অফিশিয়াল অ্যান্ড্রয়েড অ্যাপ — এক ক্লিকে ডাউনলোড ও ইনস্টল করুন।",
        visible: packages.android?.visible ?? true,
      },
      ios: {
        label: packages.ios?.label || "iPhone অ্যাপ (iOS)",
        version: packages.ios?.version || "2.0.0",
        releaseNotes:
          packages.ios?.releaseNotes ||
          "স্মার্ট নোয়াখালী অফিশিয়াল আইফোন (iOS) অ্যাপ — এক ক্লিকে ডাউনলোড ও ইনস্টল করুন।",
        visible: packages.ios?.visible ?? true,
      },
    });
  }, [packages.android, packages.ios]);

  async function handleFileSelect(
    platform: "android" | "ios",
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingPlatform(platform);
    setUploadProgress({ platform, pct: 5, stage: "অ্যাপ ফাইল প্রস্তুত করা হচ্ছে..." });
    try {
      const draft = drafts[platform];
      const pkg = await uploadAppBinary(
        platform,
        file,
        {
          label: draft.label,
          version: draft.version,
          releaseNotes: draft.releaseNotes,
          visible: draft.visible,
        },
        (pct, stage) => setUploadProgress({ platform, pct, stage })
      );

      const row = cloudLinks.find((l) => l.platform === platform);
      if (row) {
        await updateCloudLink(row.id, {
          label: draft.label,
          url: pkg.downloadUrl || `/api/apps/download/${platform}`,
          visible: draft.visible,
        });
      }

      const sizeText =
        pkg.fileSize >= 1024 * 1024
          ? `${(pkg.fileSize / (1024 * 1024)).toFixed(2)} MB`
          : `${(pkg.fileSize / 1024).toFixed(1)} KB`;

      toast.success(
        `${pkg.fileName} (${sizeText} / ${pkg.fileSize.toLocaleString("en-US")} bytes) হুবহু সাইজে সফলভাবে আপলোড হয়েছে!`
      );
    } catch (err: any) {
      toast.error(err?.message || "অ্যাপ আপলোড ব্যর্থ হয়েছে");
    } finally {
      setUploadingPlatform(null);
      setUploadProgress(null);
    }
  }

  async function handleRemoveBinary(platform: "android" | "ios") {
    try {
      await removeAppBinary(platform);
      const row = cloudLinks.find((l) => l.platform === platform);
      if (row) {
        await updateCloudLink(row.id, { url: "" });
      }
      toast.success(
        `${platform === "android" ? "Android (.APK)" : "iPhone (iOS)"} অ্যাপ ফাইল মুছে ফেলা হয়েছে`
      );
    } catch (err: any) {
      toast.error(err?.message || "মুছে ফেলা যায়নি");
    }
  }

  async function handleSaveMeta(platform: "android" | "ios") {
    setSavingPlatform(platform);
    try {
      const draft = drafts[platform];
      await updateAppMeta(platform, {
        label: draft.label,
        version: draft.version,
        releaseNotes: draft.releaseNotes,
        visible: draft.visible,
      });
      const row = cloudLinks.find((l) => l.platform === platform);
      if (row) {
        await updateCloudLink(row.id, {
          label: draft.label,
          visible: draft.visible,
        });
      }
      toast.success("অ্যাপ তথ্য সংরক্ষিত হয়েছে");
    } catch (err: any) {
      toast.error(err?.message || "ত্রুটি");
    } finally {
      setSavingPlatform(null);
    }
  }

  const renderPlatformCard = (platform: "android" | "ios") => {
    const isIOS = platform === "ios";
    const pkg = packages[platform];
    const draft = drafts[platform];
    const isUploading = uploadingPlatform === platform;
    const isSaving = savingPlatform === platform;
    const hasUploadedFile = Boolean(pkg?.fileSize && pkg.fileSize > 0 && pkg?.fileName);
    const activeProg = uploadProgress?.platform === platform ? uploadProgress : null;

    return (
      <div
        key={platform}
        className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-card"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md ${
                isIOS
                  ? "bg-gradient-to-br from-slate-800 to-slate-950"
                  : "bg-gradient-to-br from-emerald-600 to-emerald-800"
              }`}
            >
              {isIOS ? <Apple className="h-6 w-6" /> : <Smartphone className="h-6 w-6" />}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {isIOS ? "Apple iPhone / iOS Package" : "Android APK Package"}
              </span>
              <h3 className="font-display text-base font-bold text-primary-deep">
                {isIOS ? "আইফোন অ্যাপ আপলোড (iOS)" : "অ্যান্ড্রয়েড অ্যাপ আপলোড (Android)"}
              </h3>
            </div>
          </div>

          {hasUploadedFile && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  void downloadAppPackageBinary({
                    platform,
                    fileName: pkg?.fileName,
                    fileSize: pkg?.fileSize,
                    downloadUrl: pkg?.downloadUrl,
                    embeddedDataUrl: pkg?.embeddedDataUrl,
                    chunkCount: pkg?.chunkCount,
                  })
                    .then((res) =>
                      toast.success(
                        `${res.fileName} (${res.byteLength.toLocaleString("en-US")} bytes) ডাউনলোড সম্পন্ন`
                      )
                    )
                    .catch((err) => toast.error(err?.message || "ডাউনলোড ব্যর্থ"));
                }}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary-deep hover:bg-primary/20"
              >
                <Download className="h-3.5 w-3.5" /> টেস্ট ডাউনলোড
              </button>
              <button
                type="button"
                onClick={() => void handleRemoveBinary(platform)}
                className="flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-1.5 text-xs font-bold text-destructive hover:bg-destructive hover:text-white"
                title="আপলোডকৃত ফাইল মুছে ফেলুন"
              >
                <Trash2 className="h-3.5 w-3.5" /> বাদ দিন
              </button>
            </div>
          )}
        </div>

        {/* Direct File Upload Dropzone */}
        <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 text-center">
          <input
            ref={isIOS ? iosInputRef : androidInputRef}
            type="file"
            accept={
              isIOS
                ? ".ipa,.mobileconfig,.zip,application/octet-stream"
                : ".apk,application/vnd.android.package-archive,application/octet-stream"
            }
            onChange={(e) => void handleFileSelect(platform, e)}
            className="hidden"
          />
          <p className="text-xs font-bold text-primary-deep">
            {hasUploadedFile
              ? `বর্তমান আপলোডকৃত ফাইল: ${pkg.fileName}`
              : "এখনও কোনো ফাইল আপলোড করা হয়নি — সরাসরি অ্যাপ ফাইল আপলোড করুন"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {hasUploadedFile
              ? `হুবহু সাইজ: ${
                  pkg.fileSize >= 1024 * 1024
                    ? `${(pkg.fileSize / (1024 * 1024)).toFixed(2)} MB`
                    : `${(pkg.fileSize / 1024).toFixed(1)} KB`
                } (${pkg.fileSize.toLocaleString("en-US")} bytes) • ভার্সন: v${pkg.version}`
              : isIOS
                ? "যেকোনো সাইজের সমর্থিত ফাইল: .ipa, .mobileconfig"
                : "যেকোনো সাইজের সমর্থিত ফাইল: .apk"}
          </p>
          <button
            type="button"
            disabled={isUploading}
            onClick={() =>
              isIOS ? iosInputRef.current?.click() : androidInputRef.current?.click()
            }
            className="mx-auto mt-3 flex items-center justify-center gap-2 rounded-full bg-gradient-hero px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-elevated disabled:opacity-60"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> আপলোড হচ্ছে...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />{" "}
                {isIOS
                  ? "iPhone (.IPA / Profile) ফাইল আপলোড করুন"
                  : "Android (.APK) ফাইল আপলোড করুন"}
              </>
            )}
          </button>

          {activeProg && (
            <div className="mt-3 space-y-1.5 rounded-xl bg-white/80 p-2.5 text-left shadow-2xs">
              <div className="flex items-center justify-between text-[11px] font-bold text-primary-deep">
                <span>{activeProg.stage}</span>
                <span>{activeProg.pct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-primary/15">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${activeProg.pct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* App Label, Version & Release Notes */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">
              অ্যাপের নাম/লেবেল
            </label>
            <input
              value={draft.label}
              onChange={(e) =>
                setDrafts({
                  ...drafts,
                  [platform]: { ...draft, label: e.target.value },
                })
              }
              className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">
              ভার্সন (Version)
            </label>
            <input
              value={draft.version}
              onChange={(e) =>
                setDrafts({
                  ...drafts,
                  [platform]: { ...draft, version: e.target.value },
                })
              }
              placeholder="2.0.0"
              className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold text-muted-foreground">
              রিলিজ নোটস / সংক্ষিপ্ত বিবরণ
            </label>
            <input
              value={draft.releaseNotes}
              onChange={(e) =>
                setDrafts({
                  ...drafts,
                  [platform]: { ...draft, releaseNotes: e.target.value },
                })
              }
              className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={draft.visible}
              onChange={(e) =>
                setDrafts({
                  ...drafts,
                  [platform]: { ...draft, visible: e.target.checked },
                })
              }
            />
            গ্রাহকদের জন্য ডাউনলোড পেজে দৃশ্যমান রাখুন
          </label>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSaveMeta(platform)}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
          >
            <Save className="h-3.5 w-3.5" /> {isSaving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <p className="flex items-center gap-2 font-display text-sm font-bold text-primary-deep">
          <Sparkles className="h-4 w-4 text-primary" /> সরাসরি অ্যান্ড্রয়েড ও আইফোন অ্যাপ আপলোড (শুধু সুপার এডমিন)
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          এখানে যে সাইজের অ্যাপ (.APK বা .IPA) আপলোড করবেন, ঠিক সেইম সাইজ ও সেইম অ্যাপটি কোনো পরিবর্তন ছাড়াই গ্রাহকরা সরাসরি ডাউনলোড করতে পারবেন।
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {renderPlatformCard("android")}
        {renderPlatformCard("ios")}
      </div>
    </div>
  );
}

// ============================================================================
// Super Admin: Full Category Manager (ক্যাটাগরি পরিবর্তন, নতুন যোগ, লুকানো/দেখানো, ক্রম)
// ============================================================================
const FORM_TYPE_OPTIONS = [
  { value: "shopping", label: "মার্কেট ও শপিং" },
  { value: "food", label: "খাবার ও রেস্তোরাঁ" },
  { value: "doctor", label: "ডাক্তার ও বিশেষজ্ঞ" },
  { value: "hospital", label: "হাসপাতাল ও ক্লিনিক" },
  { value: "medical", label: "মেডিকেল ও ডায়াগনস্টিক" },
  { value: "education", label: "শিক্ষা ও একাডেমি" },
  { value: "job", label: "চাকরি ও নিয়োগ" },
  { value: "realestate", label: "রিয়েল এস্টেট ও বাসাভাড়া" },
  { value: "transport", label: "পরিবহন ও যানবাহন" },
  { value: "tourism", label: "ভ্রমণ ও পর্যটন" },
  { value: "agriculture", label: "কৃষি ও খামার" },
  { value: "govt", label: "সরকারি ও জরুরি সেবা" },
  { value: "religious_social", label: "ধর্মীয় ও সামাজিক" },
  { value: "events", label: "ইভেন্ট ও বিনোদন" },
  { value: "home_services", label: "বাসাবাড়ির সেবা" },
  { value: "tech_digital", label: "প্রযুক্তি ও ডিজিটাল" },
  { value: "sports_entertainment", label: "খেলাধুলা ও সংস্কৃতি" },
  { value: "news_community", label: "সংবাদ ও মিডিয়া" },
  { value: "women_child", label: "নারী ও শিশু কর্ণার" },
  { value: "environment_welfare", label: "পরিবেশ ও কল্যাণ" },
  { value: "professionals", label: "পেশাজীবী ও কারিগরি" },
  { value: "other_services", label: "অন্যান্য সেবা" },
  { value: "blood", label: "রক্তদান ও ডোনার" },
  { value: "general", label: "সাধারণ তথ্য" },
];

function CategoriesEditor() {
  const {
    rawItems,
    updateCategory,
    addCategory,
    deleteCategory,
    moveCategory,
    resetCategories,
  } = useCategories();
  const [search, setSearch] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<CategoryConfigItem>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);

  // Sync & Audit states
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");
  const [migrationResult, setMigrationResult] = useState<CategoryMigrationResult | null>(null);
  const [auditReport, setAuditReport] = useState<CategoryAuditReport | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);

  const [newCat, setNewCat] = useState({
    slug: "",
    divisionId: "division-2-shopping-market",
    bn: "",
    en: "",
    iconName: "Users",
    tint: CATEGORY_TINTS[0].value,
    description: "",
    formType: "shopping",
    visible: true,
  });

  const divisionMap = useMemo(() => {
    const map = new Map<string, string>();
    DIVISIONS.forEach((d) => map.set(d.id, d.bn));
    return map;
  }, []);

  const filtered = useMemo(() => {
    return rawItems.filter((c) => {
      if (divisionFilter !== "all" && c.divisionId !== divisionFilter) {
        return false;
      }
      const q = (search || "").trim().toLowerCase();
      if (!q) return true;
      const divName = (c.divisionId ? divisionMap.get(c.divisionId) : "") || "";
      return `${c?.bn || ""} ${c?.en || ""} ${c?.slug || ""} ${c?.description || ""} ${divName}`
        .toLowerCase()
        .includes(q);
    });
  }, [rawItems, divisionFilter, search, divisionMap]);

  function startEdit(c: CategoryConfigItem) {
    setEditingSlug(c.slug);
    setEditDraft({ ...c });
  }

  async function saveEdit(slug: string) {
    setBusy(true);
    try {
      await updateCategory(slug, editDraft);
      setEditingSlug(null);
      toast.success("ক্যাটাগরি সফলভাবে আপডেট হয়েছে");
    } catch (e) {
      toast.error((e as Error).message || "আপডেট ব্যর্থ হয়েছে");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddCategory() {
    if (!newCat.slug.trim() || !newCat.bn.trim()) {
      return toast.error("ক্যাটাগরির বাংলা নাম ও ইংরেজি স্লাগ আবশ্যক");
    }
    setBusy(true);
    try {
      await addCategory({
        slug: newCat.slug.trim(),
        divisionId: newCat.divisionId,
        bn: newCat.bn.trim(),
        en: newCat.en.trim() || newCat.slug.trim(),
        iconName: newCat.iconName,
        tint: newCat.tint,
        description: newCat.description.trim() || newCat.bn.trim(),
        formType: newCat.formType,
        visible: newCat.visible,
      });
      toast.success("নতুন ক্যাটাগরি তৈরি হয়েছে");
      setNewCat({
        slug: "",
        divisionId: "division-2-shopping-market",
        bn: "",
        en: "",
        iconName: "Users",
        tint: CATEGORY_TINTS[0].value,
        description: "",
        formType: "shopping",
        visible: true,
      });
      setShowAdd(false);
    } catch (e) {
      toast.error((e as Error).message || "যোগ করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!confirm("আপনি কি নিশ্চিত যে সকল ক্যাটাগরি ডিফল্ট ১৮১টি মাস্টার ক্যাটাগরিতে রিসেট করবেন?")) {
      return;
    }
    setBusy(true);
    try {
      await resetCategories();
      toast.success("ক্যাটাগরি ডিফল্টে রিসেট হয়েছে");
    } catch (e) {
      toast.error((e as Error).message || "ত্রুটি");
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncFirestore() {
    setSyncing(true);
    setSyncProgress("Firestore সিঙ্ক শুরু হচ্ছে...");
    try {
      const res = await syncCategoriesToFirestore((msg) => {
        setSyncProgress(msg);
      });
      setMigrationResult(res);
      if (res.status === "failed") {
        toast.error("ক্যাটাগরি সিঙ্ক সম্পূর্ণ হতে পারেনি");
      } else {
        toast.success(`১৮১টি ক্যাটাগরি ও ২২টি বিভাগ সফলভাবে Firestore-এ সিঙ্ক হয়েছে! (${res.verifiedInFirestoreCount}টি নিশ্চিত)`);
      }
      // Trigger audit report automatically
      const report = await auditCategoriesFromFirestore();
      setAuditReport(report);
    } catch (err: any) {
      toast.error(err?.message || "সিঙ্ক ব্যর্থ হয়েছে");
    } finally {
      setSyncing(false);
      setSyncProgress("");
    }
  }

  async function handleRunAudit() {
    setAuditing(true);
    try {
      const report = await auditCategoriesFromFirestore();
      setAuditReport(report);
      setShowAuditModal(true);
      toast.success(`অডিট সম্পন্ন: প্রত্যাশিত ১৮১, ফায়ারবেসে প্রাপ্ত ${report.totalFirestore} টি`);
    } catch (err: any) {
      toast.error(err?.message || "অডিট ব্যর্থ হয়েছে");
    } finally {
      setAuditing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 1. Firestore Cloud Sync & 22-Division Audit Card */}
      <div className="overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-gold/5 p-4 sm:p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Database className="h-4 w-4" />
              </span>
              <h2 className="font-display text-base font-bold text-primary-deep">
                ফায়ারবেস ক্লাউড ১৮১টি ক্যাটাগরি ও ২২টি বিভাগ সিঙ্ক
              </h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              মাস্টার স্পেসিফিকেশনের ১৮১টি ক্যাটাগরি ও ২২টি বিভাগ সরাসরি Firebase Firestore-এ স্থায়ীভাবে সিঙ্ক ও অডিট করুন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={syncing || busy}
              onClick={handleSyncFirestore}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-hero px-4 py-2 text-xs font-bold text-primary-foreground shadow-card transition active:scale-95 disabled:opacity-50"
            >
              {syncing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>সিঙ্ক হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>ক্লাউড ফায়ারবেসে সিঙ্ক করুন</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={auditing || syncing}
              onClick={handleRunAudit}
              className="flex items-center gap-1.5 rounded-xl border border-primary/25 bg-card px-3.5 py-2 text-xs font-bold text-primary transition hover:bg-primary/5 disabled:opacity-50"
            >
              {auditing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              )}
              <span>২২-বিভাগ অডিট রিপোর্ট</span>
            </button>
          </div>
        </div>

        {syncProgress && (
          <div className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary-deep animate-pulse">
            {syncProgress}
          </div>
        )}

        {migrationResult && (
          <div className="mt-3 rounded-2xl border border-emerald-500/30 bg-emerald-50/50 p-3 text-xs dark:bg-emerald-950/20">
            <p className="font-bold text-emerald-800 dark:text-emerald-300">
              সর্বশেষ ক্লাউড সিঙ্ক ফলাফল:
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-lg bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-800">
                নতুন যুক্ত: {migrationResult.addedCount}
              </span>
              <span className="rounded-lg bg-blue-500/15 px-2 py-0.5 font-semibold text-blue-800">
                আপডেট: {migrationResult.updatedCount}
              </span>
              <span className="rounded-lg bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
                পূর্বে প্রস্তুত: {migrationResult.alreadyCorrectCount}
              </span>
              <span className="rounded-lg bg-primary/15 px-2 py-0.5 font-bold text-primary-deep">
                মোট নিশ্চিত ভেরিফায়েড: {migrationResult.verifiedInFirestoreCount}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Category Control Header */}
      <div className="rounded-2xl bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-2 font-display text-sm font-bold text-primary-deep">
              <LayoutGrid className="h-4 w-4 text-primary" /> সকল ক্যাটাগরি তালিকা ({rawItems.length} টি)
            </p>
            <p className="text-xs text-muted-foreground">
              যে কোনো ক্যাটাগরি এডিট, নতুন যোগ, বিভাগ পরিবর্তন ও ক্রম পুনর্বিন্যাস করুন
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="flex items-center gap-1 rounded-full bg-gradient-hero px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-card"
            >
              <Plus className="h-3.5 w-3.5" /> নতুন ক্যাটাগরি
            </button>
            <button
              type="button"
              onClick={handleReset}
              title="ডিফল্ট রিসেট"
              className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" /> ডিফল্ট ১৮১
            </button>
          </div>
        </div>

        {/* Add Category Form */}
        {showAdd && (
          <div className="mt-4 space-y-2.5 rounded-2xl border border-primary/30 bg-primary/5 p-3.5">
            <p className="font-display text-xs font-bold text-primary-deep">
              নতুন ক্যাটাগরি তৈরি করুন
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">বিভাগ নির্ধারণ *</label>
                <select
                  value={newCat.divisionId}
                  onChange={(e) => setNewCat({ ...newCat, divisionId: e.target.value })}
                  className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium"
                >
                  {DIVISIONS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.bn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">ফর্ম ও ফিল্ড টাইপ</label>
                <select
                  value={newCat.formType}
                  onChange={(e) => setNewCat({ ...newCat, formType: e.target.value })}
                  className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium"
                >
                  {FORM_TYPE_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label} ({f.value})
                    </option>
                  ))}
                </select>
              </div>

              <input
                value={newCat.bn}
                onChange={(e) => setNewCat({ ...newCat, bn: e.target.value })}
                placeholder="বাংলা নাম * (যেমন: কম্পিউটার সার্ভিসিং)"
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                value={newCat.slug}
                onChange={(e) => setNewCat({ ...newCat, slug: e.target.value })}
                placeholder="ইংরেজি স্লাগ * (যেমন: computer-servicing)"
                className="rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm"
              />
              <input
                value={newCat.en}
                onChange={(e) => setNewCat({ ...newCat, en: e.target.value })}
                placeholder="ইংরেজি নাম (যেমন: Computer Servicing)"
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                value={newCat.description}
                onChange={(e) => setNewCat({ ...newCat, description: e.target.value })}
                placeholder="সংক্ষিপ্ত বিবরণ"
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <select
                value={newCat.iconName}
                onChange={(e) => setNewCat({ ...newCat, iconName: e.target.value })}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                {Object.keys(CATEGORY_ICONS).map((k) => (
                  <option key={k} value={k}>
                    আইকন: {k}
                  </option>
                ))}
              </select>
              <select
                value={newCat.tint}
                onChange={(e) => setNewCat({ ...newCat, tint: e.target.value })}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                {CATEGORY_TINTS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleAddCategory}
                className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
              >
                <Save className="h-3.5 w-3.5" /> যোগ করুন
              </button>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold"
              >
                বাতিল
              </button>
            </div>
          </div>
        )}

        {/* Filters: Search & Division Filter */}
        <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ক্যাটাগরি বা বিভাগের নাম খুঁজুন..."
              className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm"
            />
          </div>

          <div>
            <select
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
            >
              <option value="all">সকল বিভাগ ({rawItems.length} টি ক্যাটাগরি)</option>
              {DIVISIONS.map((d) => {
                const count = rawItems.filter((c) => c.divisionId === d.id).length;
                return (
                  <option key={d.id} value={d.id}>
                    {d.bn} ({count} টি)
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Category Items List */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-muted-foreground px-1">
          প্রদর্শিত ক্যাটাগরি: {filtered.length} টি
        </p>

        {filtered.map((c, idx) => {
          const IconComp = CATEGORY_ICONS[c.iconName] || CATEGORY_ICONS.Users;
          const isEditing = editingSlug === c.slug;
          const divName = c.divisionId ? divisionMap.get(c.divisionId) : undefined;

          if (isEditing) {
            return (
              <div
                key={c.slug}
                className="space-y-3 rounded-2xl border border-primary/40 bg-card p-4 shadow-elevated"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-primary-deep">
                    ক্যাটাগরি সম্পাদনা: {c.slug}
                  </p>
                  <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
                    {c.slug}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      বিভাগ নির্ধারণ
                    </label>
                    <select
                      value={editDraft.divisionId ?? c.divisionId ?? "division-2-shopping-market"}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, divisionId: e.target.value })
                      }
                      className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
                    >
                      {DIVISIONS.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.bn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      ফর্ম ফিল্ড টাইপ
                    </label>
                    <select
                      value={editDraft.formType ?? c.formType ?? "general"}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, formType: e.target.value })
                      }
                      className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
                    >
                      {FORM_TYPE_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label} ({f.value})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      বাংলা নাম
                    </label>
                    <input
                      value={editDraft.bn ?? ""}
                      onChange={(e) => setEditDraft({ ...editDraft, bn: e.target.value })}
                      className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      ইংরেজি নাম
                    </label>
                    <input
                      value={editDraft.en ?? ""}
                      onChange={(e) => setEditDraft({ ...editDraft, en: e.target.value })}
                      className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      বিবরণ (সাবটাইটেল)
                    </label>
                    <input
                      value={editDraft.description ?? ""}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, description: e.target.value })
                      }
                      className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      আইকন
                    </label>
                    <select
                      value={editDraft.iconName ?? "Users"}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, iconName: e.target.value })
                      }
                      className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    >
                      {Object.keys(CATEGORY_ICONS).map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      রঙ থিম
                    </label>
                    <select
                      value={editDraft.tint ?? CATEGORY_TINTS[0].value}
                      onChange={(e) => setEditDraft({ ...editDraft, tint: e.target.value })}
                      className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                    >
                      {CATEGORY_TINTS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={editDraft.visible !== false}
                    onChange={(e) =>
                      setEditDraft({ ...editDraft, visible: e.target.checked })
                    }
                  />
                  হোম পেজ ও মেনুতে দৃশ্যমান রাখুন
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void saveEdit(c.slug)}
                    className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
                  >
                    <Save className="h-3.5 w-3.5" /> সংরক্ষণ করুন
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingSlug(null)}
                    className="rounded-full bg-muted px-3.5 py-1.5 text-xs font-semibold"
                  >
                    বাতিল
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={c.slug}
              className={`flex flex-col gap-2 rounded-2xl bg-card p-3.5 shadow-card transition sm:flex-row sm:items-center sm:justify-between ${
                c.visible === false ? "opacity-55" : ""
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${c.tint} text-primary-deep`}
                >
                  <IconComp className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-semibold text-foreground">{c.bn}</p>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {c.slug}
                    </span>
                    {divName && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary-deep">
                        {divName}
                      </span>
                    )}
                    {c.formType && (
                      <span className="rounded-md bg-secondary/20 px-1.5 py-0.5 font-mono text-[10px] text-secondary-foreground">
                        {c.formType}
                      </span>
                    )}
                    {c.visible === false && (
                      <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                        লুকানো
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{c.description}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => void moveCategory(c.slug, "up")}
                  disabled={idx === 0}
                  title="উপরে নিন"
                  className="rounded-full bg-muted p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void moveCategory(c.slug, "down")}
                  disabled={idx === filtered.length - 1}
                  title="নিচে নিন"
                  className="rounded-full bg-muted p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void updateCategory(c.slug, { visible: c.visible === false })}
                  title={c.visible === false ? "দেখান" : "লুকান"}
                  className="rounded-full bg-muted p-1.5 text-muted-foreground hover:text-foreground"
                >
                  {c.visible === false ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => startEdit(c)}
                  title="সম্পাদনা"
                  className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary-deep hover:bg-primary/20"
                >
                  <Edit3 className="h-3 w-3" /> এডিট
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`আপনি কি "${c.bn}" ক্যাটাগরি মুছে ফেলতে চান?`)) {
                      void deleteCategory(c.slug).then(() =>
                        toast.success("ক্যাটাগরি মুছে ফেলা হয়েছে")
                      );
                    }
                  }}
                  title="মুছুন"
                  className="rounded-full bg-destructive/10 p-1.5 text-destructive hover:bg-destructive/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Full 22-Division Audit Modal */}
      {showAuditModal && auditReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5"
          onClick={() => setShowAuditModal(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl bg-card p-4 sm:p-6 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-primary-deep">
                  ২২টি বিভাগের ক্যাটাগরি অডিট রিপোর্ট
                </h3>
                <p className="text-xs text-muted-foreground">
                  মোট প্রত্যাশিত: {auditReport.totalExpected} টি • ফায়ারবেস ক্লাউডে প্রাপ্ত: {auditReport.totalFirestore} টি
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="rounded-full bg-muted p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
              {auditReport.divisionSummary.map((d) => (
                <div
                  key={d.divisionId}
                  className="rounded-2xl border border-border/80 bg-muted/30 p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-xs text-foreground">{d.divisionName}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        d.actualCount >= d.expectedCount
                          ? "bg-emerald-500/15 text-emerald-800"
                          : "bg-amber-500/15 text-amber-800"
                      }`}
                    >
                      {d.actualCount} / {d.expectedCount} টি সক্রিয়
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {d.categories.map((c) => (
                      <span
                        key={c.slug}
                        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] ${
                          c.existsInFirestore
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                            : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                        }`}
                      >
                        {c.bn}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Super Admin: “আমাদের সেবা” পরিচালনা (Manage Our Services)
// Full CRUD, Active Toggle, Reordering, Page Header Editor
// Restricted strictly to Main Super Admin (mdmahmudulhashan0@gmail.com)
// ============================================================================
function ServicesAdminPanel() {
  const { isMainAdmin } = useAuth();
  const {
    config,
    services,
    addService,
    updateService,
    deleteService,
    reorderServices,
    updatePageHeader,
  } = useServicesConfig();

  // Header settings state
  const [pageTitle, setPageTitle] = useState(config.pageTitle || "");
  const [pageSubtitle, setPageSubtitle] = useState(config.pageSubtitle || "");
  const [savingHeader, setSavingHeader] = useState(false);

  // Sync draft when config loads/updates
  useEffect(() => {
    setPageTitle(config.pageTitle || "");
    setPageSubtitle(config.pageSubtitle || "");
  }, [config.pageTitle, config.pageSubtitle]);

  // Add new service state
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIconName, setNewIconName] = useState("PhoneCall");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newActive, setNewActive] = useState(true);

  // Edit service state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIconName, setEditIconName] = useState("PhoneCall");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  // Action busy states
  const [busyServiceId, setBusyServiceId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  if (!isMainAdmin) {
    return (
      <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-8 text-center shadow-card">
        <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
        <h3 className="mt-3 font-display text-base font-bold text-destructive">
          অ্যাকসেস সংরক্ষিত (Access Denied)
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          “আমাদের সেবা” পরিচালনা শুধুমাত্র মেইন সুপার অ্যাডমিনের জন্য নির্ধারিত। অন্য কোনো স্টাফ এটি পরিবর্তন করতে পারবেন না।
        </p>
      </div>
    );
  }

  // Handle saving page header
  async function handleSaveHeader(e: React.FormEvent) {
    e.preventDefault();
    if (savingHeader) return;
    if (!pageTitle.trim()) {
      return toast.error("পেজের শিরোনাম প্রদান করুন");
    }
    setSavingHeader(true);
    try {
      await updatePageHeader(pageTitle.trim(), pageSubtitle.trim());
      toast.success("আমাদের সেবা পেজের শিরোনাম ও বিবরণ সফলভাবে সংরক্ষিত হয়েছে!");
    } catch (err: any) {
      toast.error(err?.message || "শিরোনাম আপডেট ব্যর্থ হয়েছে");
    } finally {
      setSavingHeader(false);
    }
  }

  // Handle adding new service
  async function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    if (adding) return;
    if (!newTitle.trim()) {
      return toast.error("সেবার নাম/শিরোনাম প্রদান করুন");
    }
    setAdding(true);
    try {
      await addService({
        title: newTitle.trim(),
        description: newDescription.trim(),
        iconName: newIconName || "PhoneCall",
        imageUrl: newImageUrl.trim() || undefined,
        active: newActive,
      });
      toast.success(`“${newTitle.trim()}” সেবা সফলভাবে যোগ করা হয়েছে!`);
      // Reset form
      setNewTitle("");
      setNewDescription("");
      setNewIconName("PhoneCall");
      setNewImageUrl("");
      setNewActive(true);
      setShowAddForm(false);
    } catch (err: any) {
      toast.error(err?.message || "সেবা যোগ করতে ব্যর্থ হয়েছে");
    } finally {
      setAdding(false);
    }
  }

  // Start editing a service
  function startEdit(service: ServiceItem) {
    setEditingId(service.id);
    setEditTitle(service.title || "");
    setEditDescription(service.description || "");
    setEditIconName(service.iconName || "PhoneCall");
    setEditImageUrl(service.imageUrl || "");
    setEditActive(service.active !== false);
  }

  // Save edited service
  async function handleSaveEdit(id: string) {
    if (savingEdit) return;
    if (!editTitle.trim()) {
      return toast.error("সেবার শিরোনাম প্রদান করুন");
    }
    setSavingEdit(true);
    try {
      await updateService(id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        iconName: editIconName || "PhoneCall",
        imageUrl: editImageUrl.trim() || undefined,
        active: editActive,
      });
      toast.success("সেবার তথ্য সফলভাবে আপডেট হয়েছে!");
      setEditingId(null);
    } catch (err: any) {
      toast.error(err?.message || "আপডেট ব্যর্থ হয়েছে");
    } finally {
      setSavingEdit(false);
    }
  }

  // Toggle active status
  async function handleToggleActive(service: ServiceItem) {
    if (busyServiceId === service.id) return;
    setBusyServiceId(service.id);
    const nextStatus = !service.active;
    try {
      await updateService(service.id, { active: nextStatus });
      toast.success(
        nextStatus
          ? `“${service.title}” সেবা সক্রিয় করা হয়েছে`
          : `“${service.title}” সেবা নিষ্ক্রিয় করা হয়েছে (পাবলিক পেজে লুকানো থাকবে)`
      );
    } catch (err: any) {
      toast.error(err?.message || "স্ট্যাটাস পরিবর্তন ব্যর্থ");
    } finally {
      setBusyServiceId(null);
    }
  }

  // Move service up or down
  async function handleMove(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= services.length) return;
    const reordered = [...services];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    try {
      await reorderServices(reordered);
      toast.success("সেবার অবস্থান ক্রমানুসারে সাজানো হয়েছে");
    } catch (err: any) {
      toast.error(err?.message || "ক্রম পরিবর্তন ব্যর্থ");
    }
  }

  // Delete service
  async function handleDelete(service: ServiceItem) {
    if (!window.confirm(`আপনি কি নিশ্চিত যে “${service.title}” সেবা মুছে ফেলতে চান?`)) {
      return;
    }
    try {
      await deleteService(service.id);
      toast.success(`“${service.title}” সেবা মুছে ফেলা হয়েছে`);
    } catch (err: any) {
      toast.error(err?.message || "মুছে ফেলা ব্যর্থ");
    }
  }

  const iconKeys = Object.keys(CATEGORY_ICONS);
  const activeCount = services.filter((s) => s.active !== false).length;

  const filteredServices = services.filter((s) => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return true;
    return (
      (s.title || "").toLowerCase().includes(q) ||
      (s.description || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Top Banner & Stats */}
      <div className="rounded-3xl border border-primary/25 bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Wrench className="h-5 w-5" />
              </div>
              <h2 className="font-display text-base font-bold text-primary-deep sm:text-lg">
                আমাদের সেবা পরিচালনা (Our Services)
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              মেইন সুপার অ্যাডমিন হিসেবে “আমাদের সেবা” (/about) পেজের শিরোনাম, বিবরণ ও সকল সেবা রিয়েলটাইমে পরিচালনা করুন
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              মোট: {services.length} টি
            </span>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700">
              সক্রিয়: {activeCount} টি
            </span>
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="flex items-center gap-1.5 rounded-full bg-gradient-hero px-4 py-2 text-xs font-bold text-primary-foreground shadow-card transition active:scale-95"
            >
              <Plus className="h-4 w-4" />
              {showAddForm ? "ফর্ম বন্ধ করুন" : "নতুন সেবা যোগ করুন"}
            </button>
          </div>
        </div>
      </div>

      {/* Page Header Settings Card */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 font-display text-sm font-bold text-primary-deep">
            <Sparkles className="h-4 w-4 text-primary" /> পেজের শিরোনাম ও পরিচিতি বিবরণ
          </p>
          <span className="text-[11px] text-muted-foreground">
            ওয়েবসাইটে (/about) এই তথ্য প্রদর্শিত হয়
          </span>
        </div>

        <form onSubmit={handleSaveHeader} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-foreground">
              পেজ টাইটেল / মূল শিরোনাম *
            </label>
            <input
              value={pageTitle}
              onChange={(e) => setPageTitle(e.target.value)}
              placeholder="আমাদের সেবা — স্মার্ট নোয়াখালী"
              required
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">
              উপ-শিরোনাম / সংক্ষিপ্ত পরিচিতি
            </label>
            <textarea
              value={pageSubtitle}
              onChange={(e) => setPageSubtitle(e.target.value)}
              rows={2}
              placeholder="স্মার্ট নোয়াখালী হলো নোয়াখালী জেলার একটি ডিজিটাল সেবা ডিরেক্টরি..."
              className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-xs leading-relaxed"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingHeader}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-xs transition hover:bg-primary-deep disabled:opacity-60"
            >
              {savingHeader ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              শিরোনাম সংরক্ষণ করুন
            </button>
          </div>
        </form>
      </div>

      {/* Add New Service Form Modal / Accordion */}
      {showAddForm && (
        <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 shadow-elevated">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-primary-deep">
              ➕ নতুন সেবা যোগ করার ফর্ম
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-full bg-muted p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleAddService} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  সেবার নাম / শিরোনাম *
                </label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="যেমন: জরুরী যোগাযোগ ডিরেক্টরি"
                  required
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">আইকন নির্বাচন করুন</label>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {(() => {
                      const IconComp = CATEGORY_ICONS[newIconName] || CATEGORY_ICONS.Info;
                      return <IconComp className="h-5 w-5" />;
                    })()}
                  </div>
                  <select
                    value={newIconName}
                    onChange={(e) => setNewIconName(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold"
                  >
                    {iconKeys.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">
                সেবার বিস্তারিত বিবরণ
              </label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                placeholder="সেবা সম্পর্কে সংক্ষিপ্ত বিস্তারিত লিখুন..."
                className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-xs leading-relaxed"
              />
            </div>

            {/* Custom Image Upload (Optional) */}
            <div>
              <label className="text-xs font-semibold text-foreground">
                কাস্টম ছবি (ঐচ্ছিক — আইকনের পরিবর্তে ছবি শো করতে চাইলে)
              </label>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://... বা সরাসরি আপলোড করুন"
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs"
                />
                <UniversalImageUploader
                  category="general"
                  value={newImageUrl}
                  onChange={(url: string | null) => {
                    setNewImageUrl(url || "");
                    if (url) toast.success("সেবার ছবি আপলোড হয়েছে");
                  }}
                  variant="inline"
                  label="ছবি আপলোড"
                />
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-2 pt-1">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={newActive}
                  onChange={(e) => setNewActive(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                সরাসরি ওয়েবসাইটে সক্রিয় (Active) রাখুন
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="rounded-full bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={adding}
                className="flex items-center gap-1.5 rounded-full bg-gradient-hero px-5 py-2 text-xs font-bold text-primary-foreground shadow-card disabled:opacity-60"
              >
                {adding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                সেবা যোগ করুন
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search and List Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-sm font-bold text-primary-deep">
          সকল সেবা তালিকা ({services.length} টি)
        </p>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="সেবা খুঁজুন..."
            className="w-full rounded-xl border border-border bg-background py-1.5 pl-8 pr-3 text-xs"
          />
        </div>
      </div>

      {/* Services List Cards */}
      {filteredServices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {search ? "কোনো সেবা খুঁজে পাওয়া যায়নি" : "বর্তমানে কোনো সেবা যুক্ত করা নেই। ওপরের বাটনে ক্লিক করে যোগ করুন।"}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredServices.map((service, index) => {
            const isEditing = editingId === service.id;
            const IconComp = service.iconName ? CATEGORY_ICONS[service.iconName] || CATEGORY_ICONS.Info : CATEGORY_ICONS.Info;
            const isActive = service.active !== false;

            if (isEditing) {
              return (
                <div
                  key={service.id}
                  className="rounded-2xl border-2 border-primary/40 bg-card p-4 shadow-elevated"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-display text-xs font-bold text-primary-deep">
                      ✏️ সেবা সম্পাদনা: #{String(index + 1).padStart(2, "0")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-full p-1 text-muted-foreground hover:bg-muted"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground">
                          সেবার শিরোনাম *
                        </label>
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground">
                          আইকন
                        </label>
                        <select
                          value={editIconName}
                          onChange={(e) => setEditIconName(e.target.value)}
                          className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold"
                        >
                          {iconKeys.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        বিবরণ
                      </label>
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={2}
                        className="mt-0.5 w-full rounded-xl border border-border bg-background p-2.5 text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        কাস্টম ছবি URL
                      </label>
                      <div className="mt-0.5 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          value={editImageUrl}
                          onChange={(e) => setEditImageUrl(e.target.value)}
                          placeholder="https://..."
                          className="flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs"
                        />
                        <UniversalImageUploader
                          category="general"
                          value={editImageUrl}
                          onChange={(url: string | null) => {
                            setEditImageUrl(url || "");
                            if (url) toast.success("ছবি আপলোড হয়েছে");
                          }}
                          variant="inline"
                          label="ছবি আপলোড"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
                        <input
                          type="checkbox"
                          checked={editActive}
                          onChange={(e) => setEditActive(e.target.checked)}
                          className="h-4 w-4 rounded border-border text-primary"
                        />
                        সক্রিয় রাখুন
                      </label>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-full bg-muted px-3.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                      >
                        বাতিল
                      </button>
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={() => void handleSaveEdit(service.id)}
                        className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-xs disabled:opacity-60"
                      >
                        {savingEdit ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        আপডেট সংরক্ষণ
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={service.id}
                className={`flex flex-col gap-3 rounded-2xl border bg-card p-3.5 shadow-card transition sm:flex-row sm:items-center sm:justify-between ${
                  isActive ? "border-border" : "border-dashed border-border/80 bg-muted/20 opacity-80"
                }`}
              >
                <div className="flex min-w-0 items-start gap-3">
                  {/* Order handle */}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-bold text-muted-foreground">
                    #{String(index + 1).padStart(2, "0")}
                  </span>

                  {/* Thumbnail / Icon preview */}
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-xs">
                    {service.imageUrl ? (
                      <img
                        src={service.imageUrl}
                        alt={service.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <IconComp className="h-5 w-5" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-display text-sm font-bold text-foreground">
                        {service.title}
                      </h4>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isActive
                            ? "bg-emerald-500/15 text-emerald-700"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isActive ? "সক্রিয়" : "লুকানো"}
                      </span>
                    </div>
                    {service.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                        {service.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions: Reorder, Active Toggle, Edit, Delete */}
                <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-center">
                  {/* Move Up */}
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => void handleMove(index, "up")}
                    title="উপরে নিন"
                    className="rounded-full bg-muted p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>

                  {/* Move Down */}
                  <button
                    type="button"
                    disabled={index === services.length - 1}
                    onClick={() => void handleMove(index, "down")}
                    title="নিচে নিন"
                    className="rounded-full bg-muted p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>

                  {/* Active / Inactive Toggle */}
                  <button
                    type="button"
                    disabled={busyServiceId === service.id}
                    onClick={() => void handleToggleActive(service)}
                    title={isActive ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                      isActive
                        ? "bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        : "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25"
                    }`}
                  >
                    {isActive ? (
                      <>
                        <EyeOff className="h-3 w-3" /> নিষ্ক্রিয়
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3" /> সক্রিয়
                      </>
                    )}
                  </button>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() => startEdit(service)}
                    title="সম্পাদনা করুন"
                    className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary-deep hover:bg-primary/20"
                  >
                    <Edit3 className="h-3 w-3" /> এডিট
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => void handleDelete(service)}
                    title="মুছে ফেলুন"
                    className="rounded-full bg-destructive/10 p-1.5 text-destructive hover:bg-destructive hover:text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Submissions (তথ্য) Full CRUD + Category Filter
// ============================================================================
function SubmissionsAdminPanel({ subs }: { subs: ReturnType<typeof useCloudSubmissions> }) {
  const { allCategories } = useCategories();
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editingItem, setEditingItem] = useState<SubmissionRow | null>(null);
  const [form, setForm] = useState({
    category_slug: "janapratinidhi",
    title: "",
    contact: "",
    address: "",
    designation: "",
    body: "",
    image_url: "",
  });

  const directoryCats = allCategories.filter(
    (c) =>
      ![
        "submit-info",
        "admin",
        "about",
        "donation",
        "blood-donor",
        "chat",
        "app-download",
        "board-result",
      ].includes(c.slug)
  );

  const pendingItems = subs.items.filter((s) => s.status === "pending");

  const filtered = subs.items.filter((s) => {
    if (catFilter !== "all" && s.category_slug !== catFilter) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    const q = (query || "").trim().toLowerCase();
    if (q) {
      const hay = `${s.title ?? ""} ${s.contact ?? ""} ${s.address ?? ""} ${s.designation ?? ""} ${s.category_slug ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  async function handleApproveAllPending() {
    if (pendingItems.length === 0 || approvingAll) return;
    setApprovingAll(true);
    try {
      for (const item of pendingItems) {
        await subs.setStatus(item.id, "approved");
      }
      toast.success(`${pendingItems.length} টি অপেক্ষমাণ তথ্য এক ক্লিকে অনুমোদিত হয়েছে!`);
    } catch (e) {
      toast.error((e as Error).message || "ত্রুটি");
    } finally {
      setApprovingAll(false);
    }
  }

  async function handlePhotoUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    mode: "add" | "edit"
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("শুধু ছবি ফাইল নির্বাচন করুন");
      return;
    }
    setUploadingPhoto(true);
    try {
      const url = await uploadPublicImage(file, "submissions");
      if (!url) throw new Error("ছবি প্রসেস করা যায়নি");
      if (mode === "add") {
        setForm((prev) => ({ ...prev, image_url: url }));
      } else if (editingItem) {
        setEditingItem({ ...editingItem, image_url: url });
      }
      toast.success("ছবি যুক্ত হয়েছে");
    } catch (err: any) {
      toast.error(err?.message || "আপলোড ব্যর্থ");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleDirectAdd() {
    if (!form.category_slug || !form.title.trim() || !form.contact.trim()) {
      return toast.error("ক্যাটাগরি, নাম ও ফোন নম্বর আবশ্যক");
    }
    setBusy(true);
    const res = await subs.add({
      ...form,
      title: form.title.trim(),
      contact: form.contact.trim(),
      address: form.address.trim(),
      designation: form.designation.trim(),
      body: form.body.trim(),
      status: "approved",
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error || "ত্রুটি");
    toast.success("তথ্যটি সরাসরি অনুমোদিত অবস্থায় যোগ হয়েছে");
    setForm({
      category_slug: form.category_slug,
      title: "",
      contact: "",
      address: "",
      designation: "",
      body: "",
      image_url: "",
    });
    setShowAdd(false);
  }

  async function handleSaveEdit() {
    if (!editingItem) return;
    setBusy(true);
    const { error } = await subs.update(editingItem.id, {
      category_slug: editingItem.category_slug,
      title: editingItem.title,
      contact: editingItem.contact,
      address: editingItem.address,
      designation: editingItem.designation,
      body: editingItem.body,
      image_url: editingItem.image_url,
      status: editingItem.status,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("তথ্য আপডেট হয়েছে");
    setEditingItem(null);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-2xl bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-display text-sm font-bold text-primary-deep">
              সকল ক্যাটাগরির তথ্য পরিচালনা ({filtered.length} টি)
            </p>
            <p className="text-[11px] text-muted-foreground">
              অনুমোদিত: {subs.items.filter((x) => x.status === "approved").length} • অপেক্ষমাণ:{" "}
              {pendingItems.length}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {pendingItems.length > 0 && (
              <button
                type="button"
                disabled={approvingAll}
                onClick={() => void handleApproveAllPending()}
                className="flex items-center gap-1 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                {approvingAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                সব অপেক্ষমাণ অনুমোদন ({pendingItems.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="flex items-center gap-1 rounded-full bg-gradient-hero px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-card"
            >
              <Plus className="h-3.5 w-3.5" /> সরাসরি নতুন তথ্য যোগ করুন
            </button>
          </div>
        </div>

        {showAdd && (
          <div className="space-y-2.5 rounded-2xl border border-primary/30 bg-primary/5 p-3.5">
            <p className="text-xs font-bold text-primary-deep">
              যেকোনো ক্যাটাগরিতে সরাসরি তথ্য যোগ করুন
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                value={form.category_slug}
                onChange={(e) => setForm({ ...form, category_slug: e.target.value })}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                {directoryCats.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.bn} ({c.slug})
                  </option>
                ))}
              </select>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="নাম / প্রতিষ্ঠানের নাম *"
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                placeholder="ফোন নম্বর *"
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                placeholder="পদবি / বিশেষজ্ঞতা (ঐচ্ছিক)"
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="ঠিকানা"
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm sm:col-span-2"
              />
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="বিস্তারিত বিবরণ (ঐচ্ছিক)"
                rows={2}
                className="rounded-xl border border-border bg-background p-3 text-sm sm:col-span-2"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-primary-deep shadow-2xs ring-1 ring-border">
                  {uploadingPhoto ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5 text-primary" />
                  )}
                  ছবি যুক্ত করুন (ঐচ্ছিক)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handlePhotoUpload(e, "add")}
                    className="hidden"
                  />
                </label>
                {form.image_url && (
                  <img
                    src={form.image_url}
                    alt="preview"
                    className="h-9 w-9 rounded-lg border object-cover"
                  />
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleDirectAdd}
                  className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
                >
                  <Save className="h-3.5 w-3.5" /> সংরক্ষণ করুন
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold"
                >
                  বাতিল
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
          >
            <option value="all">সব ক্যাটাগরি</option>
            {directoryCats.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.bn}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
          >
            <option value="all">সব অবস্থা</option>
            <option value="pending">অপেক্ষমাণ (Pending)</option>
            <option value="approved">অনুমোদিত (Approved)</option>
            <option value="rejected">বাতিল (Rejected)</option>
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="নাম বা ফোন খুঁজুন..."
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
          />
        </div>
      </div>

      <List empty="কোনো জমাকৃত তথ্য নেই" items={filtered}>
        {(s) => {
          const catObj = allCategories.find((c) => c.slug === s.category_slug);
          return (
            <div key={s.id} className="rounded-2xl bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-semibold">{s.title}</p>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary-deep">
                      {catObj?.bn ?? s.category_slug}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">📞 {s.contact}</p>
                  {s.address && (
                    <p className="text-xs text-muted-foreground">
                      📍 {s.address}
                      {s.designation ? ` • ${s.designation}` : ""}
                    </p>
                  )}
                  {s.body && <p className="mt-1 text-xs">{s.body}</p>}
                  {s.image_url && (
                    <img
                      src={s.image_url}
                      alt=""
                      className="mt-2 h-20 w-20 rounded object-cover"
                    />
                  )}
                </div>
                <Status status={s.status} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Actions
                  onApprove={() => subs.setStatus(s.id, "approved")}
                  onReject={() => subs.setStatus(s.id, "rejected")}
                  onDelete={() => subs.remove(s.id)}
                  status={s.status}
                  inline
                />
                <button
                  type="button"
                  onClick={() => setEditingItem({ ...s })}
                  className="flex items-center gap-1 rounded-full bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-800"
                >
                  <Edit3 className="h-3 w-3" /> সম্পাদনা
                </button>
              </div>
            </div>
          );
        }}
      </List>

      {editingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
          onClick={() => setEditingItem(null)}
        >
          <div
            className="w-full max-w-md space-y-2.5 rounded-2xl bg-card p-4 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-sm font-bold text-primary-deep">
              তথ্য সম্পাদনা ও ক্যাটাগরি পরিবর্তন
            </p>
            <select
              value={editingItem.category_slug}
              onChange={(e) =>
                setEditingItem({ ...editingItem, category_slug: e.target.value })
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              {directoryCats.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.bn} ({c.slug})
                </option>
              ))}
            </select>
            <input
              value={editingItem.title}
              onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
              placeholder="নাম / শিরোনাম"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={editingItem.contact ?? ""}
              onChange={(e) => setEditingItem({ ...editingItem, contact: e.target.value })}
              placeholder="ফোন নম্বর"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={editingItem.designation ?? ""}
              onChange={(e) =>
                setEditingItem({ ...editingItem, designation: e.target.value })
              }
              placeholder="পদবি"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={editingItem.address ?? ""}
              onChange={(e) => setEditingItem({ ...editingItem, address: e.target.value })}
              placeholder="ঠিকানা"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <textarea
              value={editingItem.body ?? ""}
              onChange={(e) => setEditingItem({ ...editingItem, body: e.target.value })}
              placeholder="বিস্তারিত"
              rows={3}
              className="w-full rounded-xl border border-border bg-background p-3 text-sm"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-primary-deep">
                  <Camera className="h-3.5 w-3.5" /> ছবি পরিবর্তন
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handlePhotoUpload(e, "edit")}
                    className="hidden"
                  />
                </label>
                {editingItem.image_url && (
                  <img
                    src={editingItem.image_url}
                    alt="preview"
                    className="h-9 w-9 rounded-lg border object-cover"
                  />
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSaveEdit}
                  className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
                >
                  <Save className="h-3.5 w-3.5" /> সংরক্ষণ
                </button>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="rounded-full bg-muted px-3.5 py-1.5 text-xs font-semibold"
                >
                  বাতিল
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Super Admin: Donation Numbers Manager + Donations CRUD
// ============================================================================
function DonationNumbersManagerCard() {
  const { config, saveDonationConfig } = useDonationConfig();
  const [draft, setDraft] = useState<DonationConfig>(config);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  async function save() {
    setSaving(true);
    try {
      await saveDonationConfig(draft);
      toast.success("অনুদানের নাম্বারসমূহ Firebase-এ সংরক্ষিত হয়েছে");
    } catch (e) {
      toast.error((e as Error).message || "ত্রুটি");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="flex items-center gap-2 font-display text-sm font-bold text-primary-deep">
            <HandCoins className="h-4 w-4 text-primary" /> অনুদানের নাম্বারসমূহ পরিবর্তন (bKash / Nagad / Rocket)
          </p>
          <p className="text-xs text-muted-foreground">
            সুপার এডমিন যেকোনো সময় অনুদানের নাম্বার ও লেবেল পরিবর্তন করতে পারবেন
          </p>
        </div>
      </div>

      <div>
        <label className="text-[11px] font-semibold text-muted-foreground">
          অনুদান পেজ সাবটাইটেল
        </label>
        <input
          value={draft.subtitle}
          onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
        {draft.numbers.map((item, idx) => (
          <div
            key={item.id}
            className="space-y-2 rounded-2xl border border-border bg-muted/20 p-3 text-xs"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground">
                  লেবেল ও মাধ্যম
                </label>
                <input
                  value={item.label}
                  onChange={(e) => {
                    const next = [...draft.numbers];
                    next[idx] = { ...item, label: e.target.value };
                    setDraft({ ...draft, numbers: next });
                  }}
                  placeholder="যেমন: bKash (Personal)"
                  className="mt-0.5 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground">
                  একাউন্ট / ফোন নম্বর
                </label>
                <input
                  value={item.number}
                  onChange={(e) => {
                    const next = [...draft.numbers];
                    next[idx] = { ...item, number: e.target.value };
                    setDraft({ ...draft, numbers: next });
                  }}
                  placeholder="01850999178"
                  className="mt-0.5 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground">
                  ধরন
                </label>
                <select
                  value={item.type}
                  onChange={(e) => {
                    const next = [...draft.numbers];
                    next[idx] = {
                      ...item,
                      type: e.target.value as DonationNumberItem["type"],
                    };
                    setDraft({ ...draft, numbers: next });
                  }}
                  className="mt-0.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                >
                  <option value="personal">পার্সোনাল (Personal)</option>
                  <option value="merchant">মার্চেন্ট (Merchant)</option>
                  <option value="bank">ব্যাংক একাউন্ট (Bank)</option>
                  <option value="gateway">কার্ড / গেটওয়ে (Gateway)</option>
                </select>
              </div>
            </div>

            {item.type === "bank" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border/50">
                <input
                  value={item.bankName ?? ""}
                  onChange={(e) => {
                    const next = [...draft.numbers];
                    next[idx] = { ...item, bankName: e.target.value };
                    setDraft({ ...draft, numbers: next });
                  }}
                  placeholder="ব্যাংক (যেমন: Islami Bank PLC)"
                  className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs"
                />
                <input
                  value={item.accountName ?? ""}
                  onChange={(e) => {
                    const next = [...draft.numbers];
                    next[idx] = { ...item, accountName: e.target.value };
                    setDraft({ ...draft, numbers: next });
                  }}
                  placeholder="একাউন্ট টাইটেল (যেমন: Smart Noakhali Welfare)"
                  className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs"
                />
                <input
                  value={item.branchName ?? ""}
                  onChange={(e) => {
                    const next = [...draft.numbers];
                    next[idx] = { ...item, branchName: e.target.value };
                    setDraft({ ...draft, numbers: next });
                  }}
                  placeholder="শাখা (যেমন: Maijdee Court Branch)"
                  className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs"
                />
                <input
                  value={item.routingNumber ?? ""}
                  onChange={(e) => {
                    const next = [...draft.numbers];
                    next[idx] = { ...item, routingNumber: e.target.value };
                    setDraft({ ...draft, numbers: next });
                  }}
                  placeholder="রাউটিং নম্বর (যেমন: 125551234)"
                  className="rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-mono"
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={item.active}
                  onChange={(e) => {
                    const next = [...draft.numbers];
                    next[idx] = { ...item, active: e.target.checked };
                    setDraft({ ...draft, numbers: next });
                  }}
                />
                অনুদান পেজে প্রদর্শন করুন
              </label>

              {item.type === "gateway" && (
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-blue-600">
                  <input
                    type="checkbox"
                    checked={item.isGatewayConfigured}
                    onChange={(e) => {
                      const next = [...draft.numbers];
                      next[idx] = { ...item, isGatewayConfigured: e.target.checked };
                      setDraft({ ...draft, numbers: next });
                    }}
                  />
                  অনলাইন গেটওয়ে কানেক্টেড
                </label>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="flex items-center gap-1.5 rounded-full bg-gradient-hero px-4 py-2 text-xs font-bold text-primary-foreground shadow-card disabled:opacity-60"
      >
        <Save className="h-3.5 w-3.5" />{" "}
        {saving ? "সংরক্ষণ হচ্ছে..." : "অনুদান নাম্বার সংরক্ষণ করুন"}
      </button>
    </div>
  );
}

function DonationsAdminPanel({
  dons,
  expensesHook,
  logoUrl,
}: {
  dons: ReturnType<typeof useCloudDonations>;
  expensesHook: ReturnType<typeof useCloudExpenses>;
  logoUrl?: string;
}) {
  const [editing, setEditing] = useState<DonationRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [previewSlipUrl, setPreviewSlipUrl] = useState<string | null>(null);
  const [rejectItem, setRejectItem] = useState<DonationRow | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const pendingItems = dons.items.filter((d) => d.status === "pending");
  const pendingBankItems = pendingItems.filter((d) => d.method === "bank");
  const approvedItems = dons.items.filter((d) => d.status === "approved");
  const totalVerifiedAmount = approvedItems.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);

  const filtered = dons.items.filter((d) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (methodFilter !== "all" && d.method !== methodFilter) return false;
    if (categoryFilter !== "all" && d.category !== categoryFilter) return false;
    const q = (search || "").trim().toLowerCase();
    if (q) {
      const hay = `${d.sender_name ?? ""} ${d.sender_phone ?? ""} ${d.trx_id ?? ""} ${d.method ?? ""} ${d.note ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  async function handleApproveAllPending() {
    if (pendingItems.length === 0 || approvingAll) return;
    setApprovingAll(true);
    try {
      for (const d of pendingItems) {
        await dons.setStatus(d.id, "approved");
      }
      toast.success(`${pendingItems.length} টি অপেক্ষমাণ অনুদান এক ক্লিকে অনুমোদিত হয়েছে!`);
    } catch (e) {
      toast.error((e as Error).message || "ত্রুটি");
    } finally {
      setApprovingAll(false);
    }
  }

  async function handleConfirmReject() {
    if (!rejectItem) return;
    setBusy(true);
    try {
      await dons.setStatus(rejectItem.id, "rejected", {
        rejection_reason: rejectionReason.trim() || "তথ্য অসংগতি বা ভুল ট্রানজেকশন আইডি",
      });
      toast.success("অনুদানটি বাতিল করা হয়েছে");
      setRejectItem(null);
      setRejectionReason("");
    } catch (e) {
      toast.error((e as Error).message || "বাতিল ব্যর্থ");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    const { error } = await dons.update(editing.id, {
      sender_name: editing.sender_name,
      sender_phone: editing.sender_phone,
      amount: Number(editing.amount) || 1,
      trx_id: editing.trx_id,
      method: editing.method,
      status: editing.status,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("অনুদান আপডেট হয়েছে");
    setEditing(null);
  }

  return (
    <div className="space-y-6">
      <FinancialReports
        donations={dons.items}
        expenses={expensesHook.items}
        logoUrl={logoUrl}
      />

      <DonationNumbersManagerCard />

      {/* Verification Queue Summary Badges */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-3 shadow-xs">
          <span className="text-[11px] text-muted-foreground block">মোট অনুমোদিত অনুদান</span>
          <span className="font-display text-base font-bold text-emerald-600 sm:text-lg">
            ৳{totalVerifiedAmount.toLocaleString("bn-BD")}
          </span>
          <span className="text-[10px] text-muted-foreground block">
            {approvedItems.length} টি ভেরিফাইড
          </span>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-3 shadow-xs">
          <span className="text-[11px] text-amber-700 dark:text-amber-300 block">মোট অপেক্ষমাণ অনুদান</span>
          <span className="font-display text-base font-bold text-amber-600 sm:text-lg">
            {pendingItems.length} টি
          </span>
          <span className="text-[10px] text-muted-foreground block">যাচাই প্রয়োজন</span>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 shadow-xs">
          <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block">অপেক্ষমাণ ব্যাংক ট্রান্সফার</span>
          <span className="font-display text-base font-bold text-emerald-600 sm:text-lg">
            {pendingBankItems.length} টি
          </span>
          <span className="text-[10px] text-muted-foreground block">স্লিপ যাচাই</span>
        </div>
        <div className="rounded-2xl border border-rose-500/30 bg-rose-50/50 dark:bg-rose-950/20 p-3 shadow-xs">
          <span className="text-[11px] text-rose-700 dark:text-rose-300 block">বাতিলকৃত লেনদেন</span>
          <span className="font-display text-base font-bold text-rose-600 sm:text-lg">
            {dons.items.filter((x) => x.status === "rejected").length} টি
          </span>
          <span className="text-[10px] text-muted-foreground block">অকার্যকর TrxID</span>
        </div>
      </div>

      <div className="space-y-2.5 rounded-2xl bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-sm font-bold text-primary-deep">
            অনুদানের লেনদেন যাচাই ও ফিল্টার ({filtered.length} টি)
          </p>
          {pendingItems.length > 0 && (
            <button
              type="button"
              disabled={approvingAll}
              onClick={() => void handleApproveAllPending()}
              className="flex items-center gap-1 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {approvingAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              সব অপেক্ষমাণ অনুমোদন ({pendingItems.length})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
          >
            <option value="all">সব অবস্থা ({dons.items.length})</option>
            <option value="pending">অপেক্ষমাণ ({pendingItems.length})</option>
            <option value="approved">অনুমোদিত ({approvedItems.length})</option>
            <option value="rejected">বাতিল ({dons.items.filter((x) => x.status === "rejected").length})</option>
          </select>

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
          >
            <option value="all">সব পেমেন্ট মাধ্যম</option>
            <option value="bkash">bKash বিকাশ</option>
            <option value="nagad">Nagad নগদ</option>
            <option value="rocket">Rocket রকেট</option>
            <option value="upay">Upay উপায়</option>
            <option value="bank">Bank Transfer ব্যাংক</option>
            <option value="gateway">Gateway কার্ড</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
          >
            <option value="all">সকল ক্যাটাগরি</option>
            {(Object.keys(DONATION_CATEGORY_LABELS) as DonationCategory[]).map((c) => (
              <option key={c} value={c}>
                {DONATION_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="প্রেরকের নাম, ফোন বা TrxID খুঁজুন..."
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
          />
        </div>
      </div>

      <List empty="কোনো অনুদান নেই" items={filtered}>
        {(d) => (
          <div key={d.id} className="rounded-2xl bg-card p-4 shadow-card border border-border space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-foreground text-sm">
                    {d.sender_name}
                  </p>
                  {d.is_anonymous && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.2 text-[10px] font-bold text-primary">
                      🔒 গোপন অনুদান (Anonymous)
                    </span>
                  )}
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {d.category_label || (d.category ? (DONATION_CATEGORY_LABELS[d.category] || d.category) : "সাধারণ অনুদান")}
                  </span>
                </div>

                <p className="font-display text-base font-bold text-primary-deep mt-0.5">
                  ৳{Number(d.amount).toLocaleString("bn-BD")}
                </p>

                <p className="text-xs text-muted-foreground">
                  <span className="font-bold uppercase text-foreground">{d.method}</span> • {d.sender_phone} • TrxID:{" "}
                  <span className="font-mono font-bold text-foreground bg-muted px-1.5 py-0.2 rounded">
                    {d.trx_id}
                  </span>
                  {d.created_at && (
                    <span className="ml-1 text-[11px]">
                      • {new Date(d.created_at).toLocaleString("bn-BD")}
                    </span>
                  )}
                </p>

                {d.note && <p className="mt-1 text-xs text-muted-foreground">📝 {d.note}</p>}
                {d.rejection_reason && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">
                    ⚠️ বাতিলের কারণ: {d.rejection_reason}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <Status status={d.status} />
                {(d.deposit_slip_url || d.receipt_url) && (
                  <button
                    type="button"
                    onClick={() => setPreviewSlipUrl(d.deposit_slip_url || d.receipt_url || null)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-600 hover:bg-emerald-500/20"
                  >
                    <FileText className="h-3 w-3" /> স্লিপ দেখুন
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
              <Actions
                onApprove={() => dons.setStatus(d.id, "approved")}
                onReject={() => {
                  setRejectItem(d);
                  setRejectionReason("");
                }}
                onDelete={() => dons.remove(d.id)}
                status={d.status}
                inline
              />
              <button
                type="button"
                onClick={() => setEditing({ ...d })}
                className="flex items-center gap-1 rounded-full bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-800"
              >
                <Edit3 className="h-3 w-3" /> সম্পাদনা
              </button>
            </div>
          </div>
        )}
      </List>

      {/* Modal: View Deposit Slip */}
      {previewSlipUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewSlipUrl(null)}
        >
          <div
            className="w-full max-w-lg space-y-3 rounded-3xl bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-2">
              <p className="font-display text-sm font-bold text-foreground">
                ব্যাংক ডিপোজিট স্লিপ / রসিদের পূর্ণ ভিউ
              </p>
              <button
                type="button"
                onClick={() => setPreviewSlipUrl(null)}
                className="rounded-full bg-muted p-1 text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-2xl bg-muted/30 p-2">
              <img
                src={previewSlipUrl}
                alt="Deposit Slip"
                className="mx-auto max-h-[65vh] w-auto rounded-xl object-contain shadow-sm"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewSlipUrl(null)}
                className="rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Rejection Reason */}
      {rejectItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setRejectItem(null)}
        >
          <div
            className="w-full max-w-md space-y-3 rounded-3xl bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-sm font-bold text-rose-600">
              অনুদান বাতিল নিশ্চিতকরণ
            </p>
            <p className="text-xs text-muted-foreground">
              প্রেরক: <span className="font-semibold text-foreground">{rejectItem.sender_name}</span> • TrxID:{" "}
              <span className="font-mono font-bold text-foreground">{rejectItem.trx_id}</span>
            </p>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                বাতিলের কারণ লিখুন:
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="যেমন: TrxID টি ব্যাংক বা MFS স্টেটমেন্টে পাওয়া যায়নি..."
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={handleConfirmReject}
                className="rounded-full bg-rose-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 disabled:opacity-60"
              >
                {busy ? "বাতিল হচ্ছে..." : "হ্যাঁ, বাতিল করুন"}
              </button>
              <button
                type="button"
                onClick={() => setRejectItem(null)}
                className="rounded-full bg-muted px-3.5 py-1.5 text-xs font-semibold"
              >
                ফিরে যান
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Donation Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-sm space-y-2.5 rounded-2xl bg-card p-4 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-sm font-bold text-primary-deep">
              অনুদান তথ্য সম্পাদনা
            </p>
            <input
              value={editing.sender_name}
              onChange={(e) => setEditing({ ...editing, sender_name: e.target.value })}
              placeholder="প্রেরকের নাম"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={editing.sender_phone ?? ""}
              onChange={(e) => setEditing({ ...editing, sender_phone: e.target.value })}
              placeholder="ফোন"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={editing.amount}
              onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })}
              placeholder="টাকার পরিমাণ"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold"
            />
            <input
              value={editing.trx_id}
              onChange={(e) => setEditing({ ...editing, trx_id: e.target.value })}
              placeholder="TrxID"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-mono uppercase"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={saveEdit}
                className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
              >
                <Save className="h-3 w-3" /> সংরক্ষণ
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full bg-muted px-3 py-1.5 text-xs"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Humanitarian Relief & Expenses CRUD (Super Admin)
// ============================================================================
function ExpensesAdminPanel({
  expensesHook,
}: {
  expensesHook: ReturnType<typeof useCloudExpenses>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Add state
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<ExpenseCategory>("emergency_relief");
  const [newAmount, setNewAmount] = useState<number | "">("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newLocation, setNewLocation] = useState("");
  const [newResponsible, setNewResponsible] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newReceiptUrl, setNewReceiptUrl] = useState("");

  const totalExpense = useMemo(
    () => expensesHook.items.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0),
    [expensesHook.items]
  );

  const filtered = useMemo(() => {
    return expensesHook.items.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${item.title} ${item.location ?? ""} ${item.responsible_person ?? ""} ${item.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [expensesHook.items, categoryFilter, search]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return toast.error("ব্যয়ের শিরোনাম লিখুন");
    if (!newAmount || Number(newAmount) <= 0) return toast.error("সঠিক টাকার পরিমাণ দিন");
    setBusy(true);
    const res = await expensesHook.add({
      title: newTitle.trim(),
      category: newCategory,
      amount: Number(newAmount),
      expense_date: newDate,
      location: newLocation.trim() || undefined,
      responsible_person: newResponsible.trim() || undefined,
      description: newDescription.trim() || undefined,
      receipt_url: newReceiptUrl.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error || "ব্যয়ের তথ্য যোগ করা ব্যর্থ হয়েছে");
      return;
    }
    toast.success("নতুন মানবিক ব্যয়ের হিসাব সফলভাবে যুক্ত হয়েছে!");
    setNewTitle("");
    setNewAmount("");
    setNewLocation("");
    setNewResponsible("");
    setNewDescription("");
    setNewReceiptUrl("");
    setShowAdd(false);
  }

  async function handleSaveEdit() {
    if (!editing) return;
    if (!editing.title.trim()) return toast.error("শিরোনাম লিখুন");
    if (!editing.amount || Number(editing.amount) <= 0) return toast.error("সঠিক টাকার পরিমাণ দিন");
    setBusy(true);
    const res = await expensesHook.update(editing.id, {
      title: editing.title.trim(),
      category: editing.category,
      amount: Number(editing.amount),
      expense_date: editing.expense_date,
      location: editing.location,
      responsible_person: editing.responsible_person,
      description: editing.description,
      receipt_url: editing.receipt_url,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error?.message || "আপডেট ব্যর্থ হয়েছে");
      return;
    }
    toast.success("ব্যয়ের হিসাব সফলভাবে আপডেট হয়েছে!");
    setEditing(null);
  }

  async function handleDelete(item: ExpenseRow) {
    if (!window.confirm(`আপনি কি নিশ্চিত যে "${item.title}" ব্যয়ের হিসাবটি মুছে ফেলতে চান?`)) return;
    const res = await expensesHook.remove(item.id);
    if (res.error) {
      toast.error(res.error.message || "মুছে ফেলা ব্যর্থ হয়েছে");
      return;
    }
    toast.success("ব্যয়ের হিসাব মুছে ফেলা হয়েছে");
  }

  return (
    <div className="space-y-4">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
          <p className="text-xs font-semibold text-rose-700">সর্বমোট মানবিক ব্যয়</p>
          <p className="mt-1 font-display text-2xl font-black text-rose-900">
            {totalExpense.toLocaleString("bn-BD")} ৳
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">অনুমোদিত সকল ত্রাণ ও সহায়তা</p>
        </div>
        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
          <p className="text-xs font-semibold text-primary-deep">মোট ব্যয়ের এন্ট্রি</p>
          <p className="mt-1 font-display text-2xl font-black text-primary-deep">
            {expensesHook.items.length.toLocaleString("bn-BD")} টি
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">ডকুমেন্টেড খরচের হিসাব</p>
        </div>
        <div className="flex items-center justify-end rounded-2xl border border-border bg-card p-4">
          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 rounded-full bg-gradient-hero px-4 py-2.5 text-xs font-bold text-white shadow-card hover:opacity-95"
          >
            <Plus className="h-4 w-4" /> নতুন মানবিক ব্যয় যোগ করুন
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="space-y-3 rounded-2xl border-2 border-primary/30 bg-card p-4 shadow-elevated"
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <p className="font-display text-sm font-bold text-primary-deep">
              ➕ নতুন মানবিক ত্রাণ / ব্যয়ের তথ্য যোগ
            </p>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-full bg-muted p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-foreground">ব্যয়ের শিরোনাম / উদ্দেশ্য *</label>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="যেমন: নোয়াখালী বন্যায় খাদ্যসামগ্রী বিতরণ"
                required
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">ব্যয়ের খাত / ক্যাটাগরি *</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ExpenseCategory)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {EXPENSE_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">টাকার পরিমাণ (৳) *</label>
              <input
                type="number"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="যেমন: 25000"
                required
                min={1}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">ব্যয়ের তারিখ *</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">স্থান / এলাকা</label>
              <input
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="যেমন: মাইজদী, সদর, নোয়াখালী"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">দায়িত্বপ্রাপ্ত ব্যক্তি / টিম</label>
              <input
                value={newResponsible}
                onChange={(e) => setNewResponsible(e.target.value)}
                placeholder="যেমন: মোঃ মাহমুদুল হাসান"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">বিস্তারিত বিবরণ</label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="উপকারভোগীদের সংখ্যা, কেনাকাটার বিবরণ বা প্রাসঙ্গিক তথ্য..."
              rows={2}
              className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">ভাউচার / রসিদ / কাজের ছবি</label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={newReceiptUrl}
                onChange={(e) => setNewReceiptUrl(e.target.value)}
                placeholder="ছবির লিংক বা সরাসরি আপলোড করুন"
                className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs"
              />
              <UniversalImageUploader
                category="general"
                value={newReceiptUrl}
                onChange={(url: string | null) => {
                  setNewReceiptUrl(url || "");
                  if (url) toast.success("রসিদের ছবি আপলোড সম্পন্ন");
                }}
                variant="inline"
                label="রসিদ ছবি আপলোড"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="rounded-full bg-muted px-4 py-1.5 text-xs font-semibold"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-1 rounded-full bg-primary px-5 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> সংরক্ষণ করুন
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-2 rounded-2xl bg-card p-3 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold"
          >
            <option value="all">সকল খাতের ব্যয় ({expensesHook.items.length})</option>
            {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {EXPENSE_CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ব্যয় বা স্থান খুঁজুন..."
            className="w-full rounded-xl border border-border bg-background py-1.5 pl-8 pr-3 text-xs"
          />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-xs text-muted-foreground">
          {search ? "কোনো ব্যয়ের হিসাব পাওয়া যায়নি" : "কোনো ব্যয়ের এন্ট্রি নেই। উপরের বাটন দিয়ে যোগ করুন।"}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-card p-4 shadow-card"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-sm font-bold text-foreground">{item.title}</p>
                  <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[10px] font-bold text-rose-700">
                    {item.category_label || EXPENSE_CATEGORY_LABELS[item.category] || "ব্যয়"}
                  </span>
                  <span className="font-mono text-sm font-black text-rose-600">
                    -{Number(item.amount).toLocaleString("bn-BD")} ৳
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>📅 {item.expense_date}</span>
                  {item.location && <span>📍 {item.location}</span>}
                  {item.responsible_person && <span>👤 দায়িত্বে: {item.responsible_person}</span>}
                </div>

                {item.description && (
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                )}

                {item.receipt_url && (
                  <div className="pt-1">
                    <a
                      href={item.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                    >
                      📎 ভাউচার / রসিদ দেখুন ↗
                    </a>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditing({ ...item })}
                  className="flex items-center gap-1 rounded-full bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-500/20"
                >
                  <Edit3 className="h-3 w-3" /> এডিট
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(item)}
                  className="rounded-full bg-destructive/10 p-1.5 text-destructive hover:bg-destructive/20"
                  title="মুছে ফেলুন"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-md space-y-3 rounded-2xl bg-card p-4 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-2">
              <p className="font-display text-sm font-bold text-primary-deep">
                ✏️ মানবিক ব্যয়ের হিসাব সম্পাদনা
              </p>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full bg-muted p-1 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-xs font-semibold text-foreground">শিরোনাম</label>
                <input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-foreground">খাত</label>
                  <select
                    value={editing.category}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        category: e.target.value as ExpenseCategory,
                      })
                    }
                    className="mt-0.5 w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs"
                  >
                    {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((cat) => (
                      <option key={cat} value={cat}>
                        {EXPENSE_CATEGORY_LABELS[cat]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">পরিমাণ (৳)</label>
                  <input
                    type="number"
                    value={editing.amount}
                    onChange={(e) =>
                      setEditing({ ...editing, amount: Number(e.target.value) || 0 })
                    }
                    className="mt-0.5 w-full rounded-xl border border-border bg-background px-2.5 py-1.5 font-mono text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-foreground">তারিখ</label>
                  <input
                    type="date"
                    value={editing.expense_date}
                    onChange={(e) => setEditing({ ...editing, expense_date: e.target.value })}
                    className="mt-0.5 w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">স্থান</label>
                  <input
                    value={editing.location ?? ""}
                    onChange={(e) => setEditing({ ...editing, location: e.target.value })}
                    className="mt-0.5 w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">দায়িত্বপ্রাপ্ত ব্যক্তি</label>
                <input
                  value={editing.responsible_person ?? ""}
                  onChange={(e) => setEditing({ ...editing, responsible_person: e.target.value })}
                  className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">বিবরণ</label>
                <textarea
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={2}
                  className="mt-0.5 w-full rounded-xl border border-border bg-background p-2 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">ভাউচার / রসিদের ছবি URL</label>
                <div className="mt-0.5 flex flex-col gap-1.5 sm:flex-row sm:items-center">
                  <input
                    value={editing.receipt_url ?? ""}
                    onChange={(e) => setEditing({ ...editing, receipt_url: e.target.value })}
                    placeholder="https://..."
                    className="flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs"
                  />
                  <UniversalImageUploader
                    category="general"
                    value={editing.receipt_url ?? ""}
                    onChange={(url: string | null) => {
                      setEditing({ ...editing, receipt_url: url || "" });
                      if (url) toast.success("রসিদ আপলোড সম্পন্ন");
                    }}
                    variant="inline"
                    label="আপলোড"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full bg-muted px-4 py-1.5 text-xs font-semibold"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSaveEdit}
                className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" /> সংরক্ষণ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Blood Donors CRUD
// ============================================================================
function DonorsAdminPanel({ donors }: { donors: ReturnType<typeof useCloudDonors> }) {
  const [editing, setEditing] = useState<DonorRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [uploadingDonorPhoto, setUploadingDonorPhoto] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [bloodFilter, setBloodFilter] = useState("all");
  const [search, setSearch] = useState("");

  const pendingItems = donors.items.filter((d) => d.status === "pending");

  const filtered = donors.items.filter((d) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (bloodFilter !== "all" && d.blood_group !== bloodFilter) return false;
    const q = (search || "").trim().toLowerCase();
    if (q) {
      const hay = `${d.full_name ?? ""} ${d.phone ?? ""} ${d.blood_group ?? ""} ${d.address ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  async function handleApproveAllPending() {
    if (pendingItems.length === 0 || approvingAll) return;
    setApprovingAll(true);
    try {
      for (const d of pendingItems) {
        await donors.setStatus(d.id, "approved");
      }
      toast.success(`${pendingItems.length} জন অপেক্ষমাণ রক্তদাতা এক ক্লিকে অনুমোদিত হয়েছে!`);
    } catch (e) {
      toast.error((e as Error).message || "ত্রুটি");
    } finally {
      setApprovingAll(false);
    }
  }

  async function handleDonorPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    if (!file.type.startsWith("image/")) {
      toast.error("অনুগ্রহ করে একটি ছবি ফাইল নির্বাচন করুন");
      return;
    }
    setUploadingDonorPhoto(true);
    try {
      const url = await uploadPublicImage(file, "donors");
      if (!url) throw new Error("ছবি প্রসেস করা যায়নি");
      setEditing({ ...editing, photo_url: url });
      toast.success("রক্তদাতার ছবি সফলভাবে লোড হয়েছে");
    } catch (err: any) {
      toast.error(err?.message || "ছবি আপলোড ব্যর্থ");
    } finally {
      setUploadingDonorPhoto(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    const { error } = await donors.update(editing.id, {
      full_name: editing.full_name,
      phone: editing.phone,
      blood_group: editing.blood_group,
      address: editing.address,
      total_donations: Number(editing.total_donations) || 0,
      last_donation_date: editing.last_donation_date,
      photo_url: editing.photo_url || "",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("রক্তদাতার তথ্য আপডেট হয়েছে");
    setEditing(null);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2.5 rounded-2xl bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-sm font-bold text-primary-deep">
            রক্তদাতা পরিচালনা ({filtered.length} জন)
          </p>
          {pendingItems.length > 0 && (
            <button
              type="button"
              disabled={approvingAll}
              onClick={() => void handleApproveAllPending()}
              className="flex items-center gap-1 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {approvingAll ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              সব অপেক্ষমাণ অনুমোদন ({pendingItems.length})
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            value={bloodFilter}
            onChange={(e) => setBloodFilter(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-rose-600"
          >
            <option value="all">সব রক্তের গ্রুপ</option>
            {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
              <option key={g} value={g}>
                গ্রুপ: {g}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
          >
            <option value="all">সব অবস্থা ({donors.items.length})</option>
            <option value="pending">অপেক্ষমাণ ({pendingItems.length})</option>
            <option value="approved">
              অনুমোদিত ({donors.items.filter((x) => x.status === "approved").length})
            </option>
            <option value="rejected">
              বাতিল ({donors.items.filter((x) => x.status === "rejected").length})
            </option>
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="রক্তদাতার নাম, ফোন বা ঠিকানা খুঁজুন..."
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
          />
        </div>
      </div>

      <List empty="কোনো দাতা নেই" items={filtered}>
        {(d) => (
          <div key={d.id} className="rounded-2xl bg-card p-4 shadow-card">
            <div className="flex items-start gap-3">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-rose-500/20 bg-rose-500/10 text-rose-600 shadow-sm">
                {d.photo_url ? (
                  <img
                    src={d.photo_url}
                    alt={d.full_name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                      const fb = e.currentTarget.parentElement?.querySelector(".admin-donor-fallback") as HTMLElement;
                      if (fb) fb.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <div className={`admin-donor-fallback flex h-full w-full items-center justify-center ${d.photo_url ? "hidden" : ""}`}>
                  <Droplet className="h-6 w-6 text-rose-600" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {d.full_name}{" "}
                  <span className="ml-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-bold text-rose-600">
                    {d.blood_group}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {d.phone} • মোট দান: {d.total_donations}
                </p>
                {d.address && <p className="text-xs text-muted-foreground">{d.address}</p>}
              </div>
              <Status status={d.status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Actions
                onApprove={() => donors.setStatus(d.id, "approved")}
                onReject={() => donors.setStatus(d.id, "rejected")}
                onDelete={() => donors.remove(d.id)}
                status={d.status}
                inline
              />
              <button
                type="button"
                onClick={() => setEditing({ ...d })}
                className="flex items-center gap-1 rounded-full bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-800"
              >
                <Edit3 className="h-3 w-3" /> সম্পাদনা
              </button>
            </div>
          </div>
        )}
      </List>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-sm space-y-2.5 rounded-2xl bg-card p-4 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-sm font-bold text-primary-deep">রক্তদাতা সম্পাদনা</p>

            {/* Donor Photo Section */}
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-2.5">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-600 shadow-sm">
                {editing.photo_url ? (
                  <img
                    src={editing.photo_url}
                    alt="Donor"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                      const fb = e.currentTarget.parentElement?.querySelector(".edit-donor-fb") as HTMLElement;
                      if (fb) fb.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <div className={`edit-donor-fb flex h-full w-full items-center justify-center ${editing.photo_url ? "hidden" : ""}`}>
                  <Droplet className="h-7 w-7 text-rose-600" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-foreground">রক্তদাতার ছবি</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary-deep transition hover:bg-primary/20">
                    <Camera className="h-3 w-3" />
                    {uploadingDonorPhoto ? "আপলোড হচ্ছে..." : editing.photo_url ? "ছবি পরিবর্তন" : "ছবি যোগ করুন"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingDonorPhoto}
                      onChange={handleDonorPhotoUpload}
                    />
                  </label>
                  {editing.photo_url && (
                    <button
                      type="button"
                      onClick={() => setEditing({ ...editing, photo_url: "" })}
                      className="text-[11px] font-semibold text-destructive hover:underline"
                    >
                      ছবি মুছুন
                    </button>
                  )}
                </div>
              </div>
            </div>

            <input
              value={editing.full_name}
              onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
              placeholder="পূর্ণ নাম"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={editing.phone}
              onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
              placeholder="ফোন নম্বর"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <select
              value={editing.blood_group}
              onChange={(e) =>
                setEditing({ ...editing, blood_group: e.target.value as DonorRow["blood_group"] })
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold text-rose-600"
            >
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <input
              value={editing.address ?? ""}
              onChange={(e) => setEditing({ ...editing, address: e.target.value })}
              placeholder="ঠিকানা"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={editing.total_donations}
              onChange={(e) =>
                setEditing({ ...editing, total_donations: Number(e.target.value) })
              }
              placeholder="মোট রক্তদান সংখ্যা"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={saveEdit}
                className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
              >
                <Save className="h-3 w-3" /> সংরক্ষণ
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full bg-muted px-3 py-1.5 text-xs"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EventsAdminPanel({
  events,
  donors,
}: {
  events: ReturnType<typeof useCloudDonorEvents>;
  donors: ReturnType<typeof useCloudDonors>;
}) {
  const [editing, setEditing] = useState<DonorEventRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);

  const pendingItems = events.items.filter((e) => e.status === "pending");

  async function handleApproveAllPending() {
    if (pendingItems.length === 0 || approvingAll) return;
    setApprovingAll(true);
    try {
      for (const e of pendingItems) {
        await events.setStatus(e.id, "approved");
      }
      toast.success(`${pendingItems.length} টি অপেক্ষমাণ রক্তদান লগ এক ক্লিকে অনুমোদিত হয়েছে!`);
    } catch (e) {
      toast.error((e as Error).message || "ত্রুটি");
    } finally {
      setApprovingAll(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    const { error } = await events.update(editing.id, {
      event_date: editing.event_date,
      place: editing.place,
      note: editing.note,
      status: editing.status,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("রক্তদান লগ আপডেট হয়েছে");
    setEditing(null);
  }

  return (
    <div className="space-y-3">
      {pendingItems.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-card p-3.5 shadow-card">
          <p className="text-xs font-bold text-primary-deep">
            অপেক্ষমাণ রক্তদান লগ: {pendingItems.length} টি
          </p>
          <button
            type="button"
            disabled={approvingAll}
            onClick={() => void handleApproveAllPending()}
            className="flex items-center gap-1 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {approvingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            সব অপেক্ষমাণ অনুমোদন ({pendingItems.length})
          </button>
        </div>
      )}

      <List empty="কোনো রক্তদান লগ নেই" items={events.items}>
        {(e) => {
          const donor = donors.items.find((x) => x.id === e.donor_id);
          return (
            <div key={e.id} className="rounded-2xl bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {donor?.full_name ?? "—"}{" "}
                    <span className="ml-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-bold text-rose-600">
                      {donor?.blood_group}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    তারিখ: {e.event_date}
                    {e.place ? ` • স্থান: ${e.place}` : ""}
                  </p>
                  {e.note && <p className="mt-1 text-xs">📝 {e.note}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {e.form_image_url && (
                      <a
                        href={e.form_image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block"
                      >
                        {/\.(png|jpe?g|gif|webp)$/i.test(e.form_image_url) ||
                        e.form_image_url.startsWith("data:image") ? (
                          <img
                            src={e.form_image_url}
                            alt="form"
                            className="h-20 w-20 rounded-lg border object-cover"
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded border bg-muted px-2 py-1 text-[11px]">
                            <FileText className="h-3 w-3" /> ফর্ম
                          </span>
                        )}
                      </a>
                    )}
                    {e.photo_url && (
                      <a href={e.photo_url} target="_blank" rel="noreferrer">
                        <img
                          src={e.photo_url}
                          alt="photo"
                          className="h-20 w-20 rounded-lg border object-cover"
                        />
                      </a>
                    )}
                  </div>
                </div>
                <Status status={e.status} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Actions
                  onApprove={() => events.setStatus(e.id, "approved")}
                  onReject={() => events.setStatus(e.id, "rejected")}
                  onDelete={() => events.remove(e.id)}
                  status={e.status}
                  inline
                />
                <button
                  type="button"
                  onClick={() => setEditing({ ...e })}
                  className="flex items-center gap-1 rounded-full bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-800"
                >
                  <Edit3 className="h-3 w-3" /> সম্পাদনা
                </button>
              </div>
            </div>
          );
        }}
      </List>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-sm space-y-2.5 rounded-2xl bg-card p-4 shadow-elevated"
            onClick={(ev) => ev.stopPropagation()}
          >
            <p className="font-display text-sm font-bold text-primary-deep">
              রক্তদান লগ সম্পাদনা
            </p>
            <input
              type="date"
              value={editing.event_date}
              onChange={(ev) => setEditing({ ...editing, event_date: ev.target.value })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={editing.place ?? ""}
              onChange={(ev) => setEditing({ ...editing, place: ev.target.value })}
              placeholder="রক্তদানের স্থান / হাসপাতাল"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <textarea
              value={editing.note ?? ""}
              onChange={(ev) => setEditing({ ...editing, note: ev.target.value })}
              rows={2}
              placeholder="নোট"
              className="w-full rounded-xl border border-border bg-background p-3 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={saveEdit}
                className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
              >
                <Save className="h-3 w-3" /> সংরক্ষণ
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full bg-muted px-3 py-1.5 text-xs"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmergencyEditor() {
  const { items, add, setStatus, update, remove } = useEmergencyRequests();
  const [form, setForm] = useState({
    patient_name: "",
    phone: "",
    blood_group: "",
    hospital: "",
    message: "",
  });
  const [editing, setEditing] = useState<EmergencyReqRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const { isMainAdmin, isAdmin } = useAuth();
  const canManage = isMainAdmin || isAdmin;

  const pendingItems = items.filter((e) => e.status === "pending");

  async function handleApproveAllPending() {
    if (pendingItems.length === 0 || approvingAll) return;
    setApprovingAll(true);
    try {
      for (const e of pendingItems) {
        await setStatus(e.id, "approved");
      }
      toast.success(`${pendingItems.length} টি অপেক্ষমাণ জরুরী রক্তের আবেদন অনুমোদিত হয়েছে!`);
    } catch (e) {
      toast.error((e as Error).message || "ত্রুটি");
    } finally {
      setApprovingAll(false);
    }
  }

  async function submit() {
    if (!form.patient_name || !form.phone || !form.blood_group)
      return toast.error("নাম, ফোন ও গ্রুপ আবশ্যক");
    setBusy(true);
    const res = await add(form);
    setBusy(false);
    if (!res.ok) return toast.error(res.error || "ত্রুটি");
    toast.success("জরুরী রক্তের আবেদন যুক্ত হয়েছে");
    sendBrowserNotification(`🩸 জরুরী রক্ত প্রয়োজন (${form.blood_group})`, {
      body: `রোগী: ${form.patient_name} • ${form.hospital || "হাসপাতাল"} • ফোন: ${form.phone}`,
    });
    setForm({ patient_name: "", phone: "", blood_group: "", hospital: "", message: "" });
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    const { error } = await update(editing.id, {
      patient_name: editing.patient_name,
      phone: editing.phone,
      blood_group: editing.blood_group,
      hospital: editing.hospital,
      message: editing.message,
      status: editing.status,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("জরুরী রক্তের আবেদন আপডেট হয়েছে");
    setEditing(null);
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="space-y-2 rounded-2xl bg-card p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-display font-bold text-primary-deep">
              <AlertCircle className="h-4 w-4" /> নতুন জরুরী রক্ত অনুরোধ
            </p>
            {pendingItems.length > 0 && (
              <button
                type="button"
                disabled={approvingAll}
                onClick={() => void handleApproveAllPending()}
                className="flex items-center gap-1 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                {approvingAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                সব অপেক্ষমাণ অনুমোদন ({pendingItems.length})
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.patient_name}
              onChange={(e) => setForm({ ...form, patient_name: e.target.value })}
              placeholder="রোগীর নাম *"
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="ফোন *"
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <select
              value={form.blood_group}
              onChange={(e) => setForm({ ...form, blood_group: e.target.value })}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold text-rose-600"
            >
              <option value="">গ্রুপ *</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <input
              value={form.hospital}
              onChange={(e) => setForm({ ...form, hospital: e.target.value })}
              placeholder="হাসপাতাল"
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <textarea
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            rows={2}
            placeholder="বার্তা (ঐচ্ছিক)"
            className="w-full rounded-xl border border-border bg-background p-3 text-sm"
          />
          <button
            disabled={busy}
            onClick={submit}
            className="flex items-center gap-1 rounded-full bg-gradient-hero px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" /> যোগ করুন
          </button>
        </div>
      )}
      <List empty="কোনো জরুরী অনুরোধ নেই" items={items}>
        {(e) => (
          <div key={e.id} className="rounded-2xl bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {e.patient_name}{" "}
                  <span className="ml-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-bold text-rose-600">
                    {e.blood_group}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.phone}
                  {e.hospital ? ` • ${e.hospital}` : ""}
                </p>
                {e.message && <p className="mt-1 text-xs">{e.message}</p>}
              </div>
              <Status status={e.status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Actions
                onApprove={() => setStatus(e.id, "approved")}
                onReject={() => setStatus(e.id, "rejected")}
                onDelete={() => remove(e.id)}
                status={e.status}
                inline
              />
              <button
                type="button"
                onClick={() => setEditing({ ...e })}
                className="flex items-center gap-1 rounded-full bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-800"
              >
                <Edit3 className="h-3 w-3" /> সম্পাদনা
              </button>
            </div>
          </div>
        )}
      </List>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-sm space-y-2.5 rounded-2xl bg-card p-4 shadow-elevated"
            onClick={(ev) => ev.stopPropagation()}
          >
            <p className="font-display text-sm font-bold text-primary-deep">
              জরুরী রক্তের আবেদন সম্পাদনা
            </p>
            <input
              value={editing.patient_name}
              onChange={(ev) => setEditing({ ...editing, patient_name: ev.target.value })}
              placeholder="রোগীর নাম"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={editing.phone}
              onChange={(ev) => setEditing({ ...editing, phone: ev.target.value })}
              placeholder="ফোন নম্বর"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <select
              value={editing.blood_group}
              onChange={(ev) => setEditing({ ...editing, blood_group: ev.target.value })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold text-rose-600"
            >
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <input
              value={editing.hospital ?? ""}
              onChange={(ev) => setEditing({ ...editing, hospital: ev.target.value })}
              placeholder="হাসপাতাল"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <textarea
              value={editing.message ?? ""}
              onChange={(ev) => setEditing({ ...editing, message: ev.target.value })}
              rows={2}
              placeholder="বার্তা"
              className="w-full rounded-xl border border-border bg-background p-3 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={saveEdit}
                className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
              >
                <Save className="h-3 w-3" /> সংরক্ষণ
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full bg-muted px-3 py-1.5 text-xs"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Super Admin: All Users + Passwords + Full Info + Profile Photo Management
// ============================================================================
function UsersEditor() {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [roleFilter, setRoleFilter] = useState<
    "all" | "admin" | "editor" | "moderator" | "user"
  >("all");
  const [search, setSearch] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [editingPwUser, setEditingPwUser] = useState<AdminUserRecord | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    designation: "",
    role: "user" as "admin" | "moderator" | "editor" | "user",
  });
  const [busy, setBusy] = useState(false);
  const [detailsUser, setDetailsUser] = useState<AdminUserRecord | null>(null);
  const { logo } = useLogo();
  const { allCategories } = useCategories();
  const { items: allAccessItems, grant: grantCatAccess, revoke: revokeCatAccess } = useCategoryAccess();
  const { upsertStaffProfile } = useStaffProfiles();
  const avatarUploadRef = useRef<HTMLInputElement>(null);
  const [avatarTargetUser, setAvatarTargetUser] = useState<AdminUserRecord | null>(null);

  async function refresh(silent = false) {
    if (!silent) setLoading(true);
    try {
      const list = await listUsers();
      setUsers((prev) => {
        const map = new Map<string, AdminUserRecord>();
        // Add fresh items from list
        for (const item of list) {
          const key = (item.email || item.id || "").toLowerCase();
          if (key && !map.has(key)) map.set(key, item);
        }
        // Preserve any optimistic items in prev if not yet returned
        for (const p of prev) {
          const key = (p.email || p.id || "").toLowerCase();
          if (key && !map.has(key)) {
            map.set(key, p);
          } else if (key && map.has(key)) {
            const existing = map.get(key)!;
            if (p.password && (!existing.password || existing.password.includes("নিবন্ধিত"))) {
              map.set(key, { ...existing, password: p.password });
            }
          }
        }
        return Array.from(map.values());
      });
      setDetailsUser((prev) => {
        if (!prev) return null;
        return (
          list.find(
            (u) =>
              u.id === prev.id ||
              (u.email && prev.email && u.email.toLowerCase() === prev.email.toLowerCase())
          ) || prev
        );
      });
    } catch (e) {
      if (!silent) toast.error((e as Error).message ?? "ত্রুটি");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void refresh(false);
    const timer = setInterval(() => {
      void refresh(true);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  async function handleManualSync() {
    setSyncing(true);
    try {
      await refresh(false);
      toast.success("সকল ইউজার, পাসওয়ার্ড ও অ্যাকসেস সফলভাবে সিঙ্ক হয়েছে!");
    } finally {
      setSyncing(false);
    }
  }

  function generateRandomPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$";
    let pwd = "";
    for (let i = 0; i < 10; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    setForm((f) => ({ ...f, password: pwd }));
    toast.info("র‍্যান্ডম পাসওয়ার্ড তৈরি হয়েছে");
  }

  async function add() {
    if (!form.email || form.password.length < 6)
      return toast.error("ইমেইল ও পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) দিন");
    setBusy(true);
    const targetEmail = form.email.trim();
    const createdRole = form.role;
    try {
      const res = await createUser({ data: form });
      const nowIso = new Date().toISOString();
      const roleBadge =
        createdRole === "admin"
          ? "শুধু এডমিন"
          : createdRole === "editor"
            ? "এডিটর"
            : createdRole === "moderator"
              ? "মডারেটর"
              : "সাধারণ ইউজার";

      const optimisticUser: AdminUserRecord = {
        id: res.id,
        email: targetEmail,
        password: form.password,
        photo_url: null,
        designation: form.designation || roleBadge,
        roles: createdRole === "user" ? ["user"] : ["user", createdRole],
        verified_via: "email",
        created_at: nowIso,
        last_sign_in_at: nowIso,
        banned_until: null,
        profile: {
          full_name: form.full_name || targetEmail.split("@")[0],
          username: targetEmail.split("@")[0],
          phone: form.phone || null,
          suspended: false,
          must_change_password: false,
          photo_url: null,
          designation: form.designation || roleBadge,
        },
      };

      // Optimistically add to users list so it never flickers or disappears
      setUsers((prev) => {
        const lowerTargetEmail = (targetEmail || "").trim().toLowerCase();
        const withoutTarget = prev.filter(
          (u) =>
            u.id !== res.id &&
            (u.email || "").toLowerCase() !== lowerTargetEmail
        );
        const superAdmin = withoutTarget.find(
          (u) => (u.email || "").toLowerCase() === "mdmahmudulhashan0@gmail.com"
        );
        const others = withoutTarget.filter(
          (u) => (u.email || "").toLowerCase() !== "mdmahmudulhashan0@gmail.com"
        );
        return superAdmin
          ? [superAdmin, optimisticUser, ...others]
          : [optimisticUser, ...withoutTarget];
      });

      // Reset filters so newly created user is 100% visible
      setRoleFilter("all");
      setSearch("");
      toast.success("নতুন ইউজার ও পাসওয়ার্ড সফলভাবে তৈরি হয়েছে");

      setForm({
        email: "",
        password: "",
        full_name: "",
        phone: "",
        designation: "",
        role: "user",
      });

      // Fetch fresh list from server (will preserve optimisticUser)
      await refresh(true);
    } catch (e) {
      toast.error((e as Error).message ?? "ত্রুটি");
    } finally {
      setBusy(false);
    }
  }

  async function toggleRole(
    uid: string,
    role: "admin" | "moderator" | "editor",
    enable: boolean
  ) {
    try {
      await setUserRole({ data: { user_id: uid, role, enable } });
      toast.success(`রোল আপডেট হয়েছে (${role})`);
      await refresh(true);
    } catch (e) {
      toast.error((e as Error).message ?? "ত্রুটি");
    }
  }

  async function del(u: AdminUserRecord) {
    try {
      setUsers((prev) =>
        prev.filter(
          (item) =>
            item.id !== u.id &&
            (!u?.email || (item?.email || "").toLowerCase() !== (u?.email || "").toLowerCase())
        )
      );
      await deleteUser({ data: { user_id: u.id, email: u.email } });
      toast.success("ইউজার সফলভাবে মুছে ফেলা হয়েছে");
      await refresh(true);
    } catch (e) {
      toast.error((e as Error).message ?? "ত্রুটি");
      await refresh(true);
    }
  }

  async function toggleSuspend(u: AdminUserRecord) {
    const next = !(u.profile?.suspended || u.banned_until);
    try {
      await suspendUser({ data: { user_id: u.id, suspend: next } });
      toast.success(next ? "ইউজার স্থগিত করা হয়েছে" : "ইউজার সক্রিয় করা হয়েছে");
      await refresh(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleSaveCustomPassword() {
    if (!editingPwUser) return;
    if (newPasswordInput.trim().length < 6) {
      return toast.error("নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
    }
    setBusy(true);
    try {
      await resetUserPassword({
        data: {
          user_id: editingPwUser.id,
          email: editingPwUser.email,
          new_password: newPasswordInput.trim(),
        },
      });
      toast.success(`${editingPwUser.email}-এর পাসওয়ার্ড আপডেট হয়েছে`);
      setEditingPwUser(null);
      setNewPasswordInput("");
      await refresh(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !avatarTargetUser) return;
    const compressed = await uploadPublicImage(file, `staff_avatars/${avatarTargetUser.id}`);
    if (!compressed) return toast.error("ছবি আপলোড ব্যর্থ");
    try {
      await updateUserProfile({
        data: {
          user_id: avatarTargetUser.id,
          email: avatarTargetUser.email,
          photo_url: compressed,
        },
      });
      const roleLabel = isProtectedMainSuperAdmin({
        id: avatarTargetUser.id,
        email: avatarTargetUser.email,
      })
        ? "সুপার এডমিন"
        : avatarTargetUser.roles.includes("admin")
          ? "এডমিন"
          : avatarTargetUser.roles.includes("editor")
            ? "এডিটর"
            : avatarTargetUser.roles.includes("moderator")
              ? "মোডারেটর"
              : "ইউজার";
      await upsertStaffProfile({
        uid: avatarTargetUser.id,
        email: avatarTargetUser.email,
        full_name: avatarTargetUser.profile?.full_name || avatarTargetUser.email.split("@")[0],
        role_label: roleLabel,
        photo_url: compressed,
        phone: avatarTargetUser.profile?.phone || "",
        designation: avatarTargetUser.profile?.designation || roleLabel,
      });
      toast.success("প্রোফাইল ফটো আপডেট হয়েছে");
      await refresh(true);
    } catch (err: any) {
      toast.error(err?.message || "ত্রুটি");
    } finally {
      setAvatarTargetUser(null);
    }
  }

  const filteredUsers = users.filter((u) => {
    if (roleFilter === "admin" && !u.roles.includes("admin")) return false;
    if (roleFilter === "editor" && !u.roles.includes("editor")) return false;
    if (roleFilter === "moderator" && !u.roles.includes("moderator")) return false;
    if (
      roleFilter === "user" &&
      (u.roles.includes("admin") || u.roles.includes("editor") || u.roles.includes("moderator"))
    )
      return false;

    const q = (search || "").trim().toLowerCase();
    if (q) {
      const hay = `${u.email ?? ""} ${u.profile?.full_name ?? ""} ${u.profile?.phone ?? ""} ${u.profile?.username ?? ""} ${u.id ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <input
        ref={avatarUploadRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarUpload}
        className="hidden"
      />

      {/* Info Banner + Sync Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-950">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-bold">
            <ShieldCheck className="h-4 w-4 text-amber-700" /> সুপার এডমিন মাস্টার ইউজার, অ্যাকসেস ও পাসওয়ার্ড ভল্ট
          </p>
          <p className="mt-0.5 text-[11px] opacity-90">
            শুধুমাত্র প্রধান সুপার অ্যাডমিন এডমিন, এডিটর, মডারেটর ও সাধারণ ইউজারসহ সকলের পাসওয়ার্ড, ক্যাটাগরি অ্যাকসেস এবং জমাকৃত সকল তথ্য দেখতে ও নিয়ন্ত্রণ করতে পারবেন।
          </p>
        </div>
        <button
          type="button"
          disabled={syncing}
          onClick={() => void handleManualSync()}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-hero px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-card transition active:scale-95 disabled:opacity-60"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          সব ইউজার ও তথ্য সিঙ্ক ({users.length})
        </button>
      </div>

      {/* Add User Form */}
      <div className="space-y-2.5 rounded-2xl bg-card p-4 shadow-card">
        <p className="flex items-center gap-2 font-display text-sm font-bold text-primary-deep">
          <UsersIcon className="h-4 w-4 text-primary" /> নতুন এডমিন / স্টাফ / ইউজার তৈরি করুন
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="ইমেইল *"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            type="text"
            placeholder="পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর) *"
            className="rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm"
          />
          <input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="পূর্ণ নাম"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="ফোন নম্বর"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
            placeholder="পদবি (যেমন: এডমিন / মডারেটর)"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={form.role}
            onChange={(e) =>
              setForm({
                ...form,
                role: e.target.value as "admin" | "moderator" | "editor" | "user",
              })
            }
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold"
          >
            <option value="user">সাধারণ ইউজার (User)</option>
            <option value="editor">এডিটর (Editor)</option>
            <option value="moderator">মোডারেটর (Moderator)</option>
            <option value="admin">এডমিন (Admin — সুপার এডমিন নয়)</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            disabled={busy}
            onClick={add}
            className="flex items-center gap-1.5 rounded-full bg-gradient-hero px-4 py-2 text-xs font-bold text-primary-foreground shadow-card disabled:opacity-60 transition active:scale-95"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            ইউজার তৈরি করুন
          </button>
          <button
            type="button"
            onClick={generateRandomPassword}
            className="flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary-deep transition hover:bg-primary/20"
          >
            <KeyRound className="h-3.5 w-3.5" /> শক্তিশালী পাসওয়ার্ড তৈরি করুন
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="space-y-2 rounded-2xl bg-card p-3.5 shadow-card">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: "all", label: `সবাই (${users.length})` },
            {
              key: "admin",
              label: `এডমিন (${users.filter((u) => u.roles.includes("admin")).length})`,
            },
            {
              key: "editor",
              label: `এডিটর (${users.filter((u) => u.roles.includes("editor")).length})`,
            },
            {
              key: "moderator",
              label: `মোডারেটর (${users.filter((u) => u.roles.includes("moderator")).length})`,
            },
            {
              key: "user",
              label: `সাধারণ ইউজার (${
                users.filter(
                  (u) =>
                    !u.roles.includes("admin") &&
                    !u.roles.includes("editor") &&
                    !u.roles.includes("moderator")
                ).length
              })`,
            },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setRoleFilter(t.key as any)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                roleFilter === t.key
                  ? "bg-gradient-hero text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="নাম, ইমেইল, ফোন বা আইডি দিয়ে খুঁজুন..."
            className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs"
          />
        </div>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="rounded-2xl bg-card/50 p-8 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredUsers.map((u) => {
            const isProtectedSuper = isProtectedMainSuperAdmin({
              id: u.id,
              email: u.email,
              username: u.profile?.username,
            });
            const showPw = !!visiblePasswords[u.id];
            const pwValue = u.password || "লগইনের পর সিঙ্ক হবে / সেট করুন";
            const hasRealPw = Boolean(u.password);
            const userCatAccess = allAccessItems.filter(
              (a) =>
                a.user_id === u.id ||
                (Boolean(u?.email && a?.user_id && typeof u.email === "string" && typeof a.user_id === "string" && a.user_id.trim().toLowerCase() === u.email.trim().toLowerCase()))
            );

            return (
              <div
                key={u.id}
                className={`rounded-2xl bg-card p-4 shadow-card transition ${
                  isProtectedSuper ? "ring-2 ring-gold/70" : "border border-border/60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {/* User / Staff Avatar with upload button */}
                    <div className="relative shrink-0">
                      <img
                        src={u.profile?.photo_url || u.photo_url || logo}
                        alt={u.profile?.full_name || u.email}
                        className="h-12 w-12 rounded-full border-2 border-primary/25 bg-white object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = logo;
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarTargetUser(u);
                          avatarUploadRef.current?.click();
                        }}
                        title="প্রোফাইল ফটো পরিবর্তন করুন"
                        className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow"
                      >
                        <Camera className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setDetailsUser(u)}
                        className="text-left hover:underline"
                      >
                        <p className="truncate text-sm font-bold text-primary-deep">
                          {u.profile?.full_name || u.email}
                        </p>
                      </button>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        {u.profile?.username && (
                          <span className="font-mono text-primary-deep">@{u.profile.username}</span>
                        )}
                        {u.profile?.phone && <span>📞 {u.profile.phone}</span>}
                        {(u.profile?.designation || u.designation) && (
                          <span>🏷️ {u.profile?.designation || u.designation}</span>
                        )}
                        <span className="font-mono text-[10px]">UID: {u.id.slice(0, 14)}</span>
                        {u.verified_via && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary-deep">
                            {u.verified_via === "google"
                              ? "Google OAuth"
                              : u.verified_via === "phone"
                                ? "মোবাইল নিবন্ধন"
                                : "ইমেইল নিবন্ধন"}
                          </span>
                        )}
                      </div>

                      {/* Role & Category Access Badges */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {isProtectedSuper && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-2.5 py-0.5 text-[10px] font-extrabold text-white shadow-sm">
                            <ShieldCheck className="h-3 w-3" /> মেইন সুপার এডমিন (অপরিবর্তনীয়)
                          </span>
                        )}
                        {u.roles.includes("admin") && !isProtectedSuper && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-500/30">
                            <ShieldCheck className="h-3 w-3" /> শুধু এডমিন (সুপার এডমিন নয়)
                          </span>
                        )}
                        {u.roles.includes("editor") && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold text-purple-700 ring-1 ring-purple-500/30">
                            <Edit3 className="h-3 w-3" /> Editor
                          </span>
                        )}
                        {u.roles.includes("moderator") && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-blue-500/30">
                            <ShieldAlert className="h-3 w-3" /> Moderator
                          </span>
                        )}
                        {!isProtectedSuper &&
                          !u.roles.includes("admin") &&
                          !u.roles.includes("editor") &&
                          !u.roles.includes("moderator") && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              সাধারণ ইউজার
                            </span>
                          )}
                        {!isProtectedSuper && userCatAccess.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-500/30">
                            <KeyRound className="h-3 w-3" /> {userCatAccess.length} টি ক্যাটাগরি অ্যাকসেস
                          </span>
                        )}
                        {(u.profile?.suspended || u.banned_until) && !isProtectedSuper && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-500/30">
                            <ShieldOff className="h-3 w-3" /> স্থগিত
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDetailsUser(u)}
                      className="rounded-full bg-gradient-hero px-3 py-1.5 text-[11px] font-bold text-primary-foreground shadow-2xs hover:opacity-95"
                    >
                      সকল তথ্য ও অ্যাকসেস
                    </button>
                    {!isProtectedSuper && (
                      <button
                        type="button"
                        onClick={() => void del(u)}
                        className="rounded-full bg-destructive/10 p-1.5 text-destructive transition hover:bg-destructive hover:text-white"
                        title="ইউজার মুছুন"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Super Admin Password Vault Bar */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-3.5 w-3.5 text-primary" />
                    <span className="font-semibold text-muted-foreground">পাসওয়ার্ড:</span>
                    <span className="rounded bg-background px-2 py-0.5 font-mono text-xs font-bold text-primary-deep">
                      {hasRealPw ? (showPw ? pwValue : "••••••••••") : pwValue}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasRealPw && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setVisiblePasswords((p) => ({ ...p, [u.id]: !p[u.id] }))
                          }
                          className="rounded-lg bg-background px-2 py-1 text-[11px] font-semibold hover:bg-muted"
                        >
                          {showPw ? (
                            <>
                              <EyeOff className="mr-1 inline h-3 w-3" /> লুকান
                            </>
                          ) : (
                            <>
                              <Eye className="mr-1 inline h-3 w-3" /> দেখুন
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(pwValue);
                            toast.success("পাসওয়ার্ড কপি হয়েছে");
                          }}
                          className="rounded-lg bg-background px-2 py-1 text-[11px] font-semibold hover:bg-muted"
                        >
                          <Copy className="mr-1 inline h-3 w-3" /> কপি
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const creds = `ইউজার লগইন তথ্য:\nইমেইল: ${u.email}\nপাসওয়ার্ড: ${pwValue}`;
                            navigator.clipboard?.writeText(creds);
                            toast.success("লগইন তথ্য (ইমেইল ও পাসওয়ার্ড) কপি হয়েছে");
                          }}
                          className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-500/20"
                          title="ইমেইল ও পাসওয়ার্ড একসাথে কপি করুন"
                        >
                          📋 ক্রেডেনশিয়াল কপি
                        </button>
                      </>
                    )}
                    {!isProtectedSuper && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPwUser(u);
                          setNewPasswordInput(u.password || "");
                        }}
                        className="rounded-lg bg-primary/15 px-2.5 py-1 text-[11px] font-bold text-primary-deep hover:bg-primary/25"
                      >
                        পাসওয়ার্ড সেট/পরিবর্তন
                      </button>
                    )}
                  </div>
                </div>

                {/* Role & Account Actions */}
                {isProtectedSuper ? (
                  <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-900">
                    🔒 মেইন সুপার অ্যাডমিন স্থায়ীভাবে সুরক্ষিত — কেউ রিমোভ, স্থগিত বা বাদ দিতে পারবে না।
                  </p>
                ) : (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <RoleToggle
                      active={u.roles.includes("admin")}
                      onClick={() => toggleRole(u.id, "admin", !u.roles.includes("admin"))}
                      label="Admin"
                    />
                    <RoleToggle
                      active={u.roles.includes("editor")}
                      onClick={() => toggleRole(u.id, "editor", !u.roles.includes("editor"))}
                      label="Editor"
                    />
                    <RoleToggle
                      active={u.roles.includes("moderator")}
                      onClick={() =>
                        toggleRole(u.id, "moderator", !u.roles.includes("moderator"))
                      }
                      label="Moderator"
                    />
                    <button
                      onClick={() => toggleSuspend(u)}
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        u.profile?.suspended || u.banned_until
                          ? "bg-emerald-500/15 text-emerald-700"
                          : "bg-rose-500/15 text-rose-700"
                      }`}
                    >
                      {u.profile?.suspended || u.banned_until ? (
                        <>
                          <ShieldCheck className="h-3 w-3" /> সক্রিয় করুন
                        </>
                      ) : (
                        <>
                          <ShieldOff className="h-3 w-3" /> স্থগিত করুন
                        </>
                      )}
                    </button>
                    <EditProfileBtn u={u} onSaved={() => refresh(true)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Set Password Modal */}
      {editingPwUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
          onClick={() => setEditingPwUser(null)}
        >
          <div
            className="w-full max-w-sm space-y-3 rounded-2xl bg-card p-4 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-sm font-bold text-primary-deep">
              পাসওয়ার্ড পরিবর্তন / সেট করুন
            </p>
            <p className="text-xs text-muted-foreground">
              ইউজার: <span className="font-bold text-foreground">{editingPwUser.email}</span>
            </p>
            <input
              type="text"
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              placeholder="নতুন পাসওয়ার্ড লিখুন (কমপক্ষে ৬ অক্ষর)"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleSaveCustomPassword}
                className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
              >
                <Save className="h-3.5 w-3.5" /> পাসওয়ার্ড সংরক্ষণ
              </button>
              <button
                type="button"
                onClick={() => setEditingPwUser(null)}
                className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}

      {detailsUser && (
        <UserDetailsModal
          user={detailsUser}
          onClose={() => setDetailsUser(null)}
          allAccessItems={allAccessItems}
          onGrantAccess={grantCatAccess}
          onRevokeAccess={revokeCatAccess}
        />
      )}
    </div>
  );
}

function UserDetailsModal({
  user,
  onClose,
  allAccessItems,
  onGrantAccess,
  onRevokeAccess,
}: {
  user: AdminUserRecord;
  onClose: () => void;
  allAccessItems: Array<{ id: string; user_id: string; category_slug: string }>;
  onGrantAccess: (user_id: string, category_slug: string) => Promise<{ error: { message: string } | null }>;
  onRevokeAccess: (id: string) => Promise<{ error: { message: string } | null }>;
}) {
  const { allCategories } = useCategories();
  const { logo } = useLogo();
  const [activityData, setActivityData] = useState<Awaited<
    ReturnType<typeof getUserSubmissionCounts>
  > | null>(null);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [grantingBusy, setGrantingBusy] = useState(false);

  const isSuper = isProtectedMainSuperAdmin({
    id: user.id,
    email: user.email,
    username: user.profile?.username,
  });

  async function loadUserActivity() {
    const res = await getUserSubmissionCounts(
      user.profile?.phone ?? "",
      user.id,
      user.email
    );
    setActivityData(res);
  }

  useEffect(() => {
    void loadUserActivity();
  }, [user.id, user.email, user.profile?.phone, allAccessItems.length]);

  const userAccessRows = allAccessItems.filter(
    (a) =>
      a.user_id === user.id ||
      (Boolean(user?.email && a?.user_id && typeof user.email === "string" && typeof a.user_id === "string" && a.user_id.trim().toLowerCase() === user.email.trim().toLowerCase()))
  );

  const mergedAccessSlugs = Array.from(
    new Set([
      ...userAccessRows.map((a) => a.category_slug),
      ...(activityData?.access || []),
    ])
  );

  async function handleGrantCategory() {
    if (!selectedSlug) return toast.error("একটি ক্যাটাগরি নির্বাচন করুন");
    setGrantingBusy(true);
    try {
      const { error } = await onGrantAccess(user.id, selectedSlug);
      if (error) toast.error(error.message);
      else {
        toast.success("ক্যাটাগরি অ্যাকসেস প্রদান করা হয়েছে");
        setSelectedSlug("");
        await loadUserActivity();
      }
    } finally {
      setGrantingBusy(false);
    }
  }

  async function handleGrantAllCategories() {
    setGrantingBusy(true);
    try {
      for (const c of allCategories) {
        if (!mergedAccessSlugs.includes(c.slug)) {
          await onGrantAccess(user.id, c.slug);
        }
      }
      toast.success("সকল ক্যাটাগরিতে অ্যাকসেস প্রদান করা হয়েছে!");
      await loadUserActivity();
    } finally {
      setGrantingBusy(false);
    }
  }

  async function handleRevokeSlug(slug: string) {
    const row = userAccessRows.find((r) => r.category_slug === slug);
    const targetId = row?.id || `${user.id}_${slug}`;
    await onRevokeAccess(targetId);
    toast.success("ক্যাটাগরি অ্যাকসেস বাতিল করা হয়েছে");
    await loadUserActivity();
  }

  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("bn-BD") : "—");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-lg space-y-3 overflow-y-auto rounded-3xl bg-card p-5 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <img
              src={user.profile?.photo_url || user.photo_url || logo}
              alt=""
              className="h-14 w-14 rounded-full border-2 border-primary/30 bg-white object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = logo;
              }}
            />
            <div>
              <p className="font-display text-base font-bold text-primary-deep">
                {user.profile?.full_name || user.email}
              </p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <p className="font-mono text-[10px] text-muted-foreground">UID: {user.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full bg-muted p-1.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Password & Auth Box */}
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-3">
          <p className="text-[11px] font-bold text-primary-deep">🔐 লগইন ও পাসওয়ার্ড তথ্য</p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground">পাসওয়ার্ড:</p>
              <p className="font-mono text-sm font-bold text-primary-deep">
                {user.password || "Google / Phone লগইন (পাসওয়ার্ড সেট করতে পারেন)"}
              </p>
            </div>
            {user.password && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(user.password || "");
                  toast.success("পাসওয়ার্ড কপি হয়েছে");
                }}
                className="rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground"
              >
                <Copy className="mr-1 inline h-3 w-3" /> কপি
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <Info label="পূর্ণ নাম" val={user.profile?.full_name || "—"} />
          <Info label="ইউজারনেম" val={user.profile?.username || "—"} />
          <Info label="ইমেইল ঠিকানা" val={user.email || "—"} />
          <Info label="মোবাইল নম্বর" val={user.profile?.phone || "—"} />
          <Info label="পদবি" val={user.profile?.designation || user.designation || "—"} />
          <Info
            label="লগইন মাধ্যম"
            val={
              user.verified_via === "google"
                ? "Google সরাসরি লগইন"
                : user.verified_via === "phone"
                  ? "মোবাইল নিবন্ধন"
                  : "ইমেইল / পাসওয়ার্ড"
            }
          />
          <Info label="একাউন্ট তৈরি" val={fmt(user.created_at)} />
          <Info label="শেষ লগইন" val={fmt(user.last_sign_in_at)} />
          <Info
            label="অবস্থা"
            val={
              isSuper
                ? "স্থায়ী সুপার এডমিন"
                : user.profile?.suspended || user.banned_until
                  ? "স্থগিত"
                  : "সক্রিয়"
            }
          />
          <Info
            label="রোল / ভূমিকা"
            val={
              isSuper
                ? "Super Admin (All Access)"
                : user.roles.length
                  ? user.roles.join(", ")
                  : "user"
            }
          />
        </div>

        {/* Direct Category Access Control Inside Modal */}
        <div className="space-y-2 rounded-2xl border border-primary/25 bg-muted/40 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-primary-deep">
              🔑 ক্যাটাগরি অ্যাকসেস ও পারমিশন কন্ট্রোল
            </p>
            {!isSuper && (
              <button
                type="button"
                disabled={grantingBusy}
                onClick={() => void handleGrantAllCategories()}
                className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50"
              >
                ✓ সব ক্যাটাগরির অ্যাকসেস দিন
              </button>
            )}
          </div>

          {isSuper ? (
            <p className="text-xs font-bold text-emerald-700">
              ✓ সুপার এডমিন হিসেবে সকল ক্যাটাগরিতে পূর্ণ অ্যাকসেস রয়েছে ({allCategories.length} টি)
            </p>
          ) : (
            <>
              <div className="flex gap-1.5">
                <select
                  value={selectedSlug}
                  onChange={(e) => setSelectedSlug(e.target.value)}
                  className="flex-1 rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs"
                >
                  <option value="">নতুন ক্যাটাগরি অ্যাকসেস নির্বাচন করুন...</option>
                  {allCategories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.bn} ({c.slug})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={grantingBusy || !selectedSlug}
                  onClick={() => void handleGrantCategory()}
                  className="rounded-xl bg-gradient-hero px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                >
                  + অ্যাকসেস দিন
                </button>
              </div>

              {mergedAccessSlugs.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  এই ইউজারের এখনো কোনো নির্দিষ্ট ক্যাটাগরি অ্যাকসেস নেই। উপরে থেকে অ্যাকসেস দিতে পারেন।
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {mergedAccessSlugs.map((s) => {
                    const c = allCategories.find((x) => x.slug === s);
                    return (
                      <span
                        key={s}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-bold text-primary-deep"
                      >
                        {c?.bn ?? s}
                        <button
                          type="button"
                          onClick={() => void handleRevokeSlug(s)}
                          className="ml-0.5 rounded-full bg-rose-500/20 p-0.5 text-rose-700 hover:bg-rose-600 hover:text-white"
                          title="অ্যাকসেস বাতিল করুন"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Submissions & Full User Activity */}
        <div className="space-y-2 rounded-2xl bg-muted/40 p-3.5">
          <p className="text-xs font-bold text-primary-deep">
            📝 ইউজারের জমাকৃত তথ্য ও অ্যাক্টিভিটি সারসংক্ষেপ
          </p>
          {activityData ? (
            <div className="space-y-2.5">
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 font-semibold text-amber-700">
                  অপেক্ষমাণ তথ্য: {activityData.subCount.pending}
                </span>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-semibold text-emerald-700">
                  অনুমোদিত তথ্য: {activityData.subCount.approved}
                </span>
                <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 font-semibold text-rose-700">
                  বাতিল তথ্য: {activityData.subCount.rejected}
                </span>
                {activityData.bloodDonors.length > 0 && (
                  <span className="rounded-full bg-rose-600/15 px-2.5 py-0.5 font-bold text-rose-700">
                    🩸 রক্তদাতা প্রোফাইল: {activityData.bloodDonors.length}
                  </span>
                )}
                {activityData.donations.length > 0 && (
                  <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-bold text-primary-deep">
                    💰 অনুদান: {activityData.donations.length} টি
                  </span>
                )}
              </div>

              {activityData.lastChatPreview && (
                <div className="rounded-xl border border-border bg-card p-2.5 text-xs">
                  <p className="text-[10px] font-bold text-muted-foreground">
                    💬 সর্বশেষ লাইভ চ্যাট মেসেজ:
                  </p>
                  <p className="mt-0.5 font-medium text-foreground">
                    "{activityData.lastChatPreview}"
                  </p>
                </div>
              )}

              {activityData.submissions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-foreground">
                    জমাকৃত ডিরেক্টরি তথ্য ({activityData.submissions.length} টি):
                  </p>
                  <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                    {activityData.submissions.map((s) => {
                      const cat = allCategories.find((c) => c.slug === s.category_slug);
                      return (
                        <div
                          key={s.id}
                          className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-1.5 text-xs shadow-2xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-foreground">{s.title}</p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {cat?.bn || s.category_slug} • 📞 {s.contact || "—"}
                            </p>
                          </div>
                          <Status status={s.status} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activityData.bloodDonors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-foreground">রক্তদাতা নিবন্ধন:</p>
                  {activityData.bloodDonors.map((bd) => (
                    <div
                      key={bd.id}
                      className="flex items-center justify-between rounded-xl bg-card px-3 py-1.5 text-xs"
                    >
                      <span>
                        {bd.full_name} ({bd.blood_group}) • {bd.phone}
                      </span>
                      <Status status={bd.status} />
                    </div>
                  ))}
                </div>
              )}

              {activityData.donations.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-foreground">অনুদান রেকর্ড:</p>
                  {activityData.donations.map((dn) => (
                    <div
                      key={dn.id}
                      className="flex items-center justify-between rounded-xl bg-card px-3 py-1.5 text-xs"
                    >
                      <span>
                        {dn.amount}৳ • {dn.method} (TrxID: {dn.trx_id})
                      </span>
                      <Status status={dn.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">লোড হচ্ছে...</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, val }: { label: string; val: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="truncate text-xs font-semibold text-primary-deep">{val}</p>
    </div>
  );
}

function EditProfileBtn({
  u,
  onSaved,
}: {
  u: AdminUserRecord;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: u.profile?.full_name ?? "",
    username: u.profile?.username ?? "",
    phone: u.profile?.phone ?? "",
    designation: u.profile?.designation ?? u.designation ?? "",
  });
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await updateUserProfile({
        data: { user_id: u.id, email: u.email, ...form },
      });
      toast.success("প্রোফাইল সংরক্ষিত");
      setOpen(false);
      await onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-1 text-[11px] font-semibold text-blue-800"
      >
        <Edit3 className="h-3 w-3" /> তথ্য সম্পাদনা
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm space-y-2 rounded-2xl bg-card p-4 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-sm font-bold text-primary-deep">
              প্রোফাইল সম্পাদনা ({u.email})
            </p>
            <input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="পূর্ণ নাম"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="ইউজারনেম"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="ফোন নম্বর"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
              placeholder="পদবি"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                disabled={busy}
                onClick={save}
                className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                <Save className="h-3 w-3" /> সংরক্ষণ
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full bg-muted px-3 py-1.5 text-xs"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RoleToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      }`}
    >
      {active ? "✓ " : "+ "}
      {label}
    </button>
  );
}

function AccessEditor() {
  const { items, grant, revoke } = useCategoryAccess();
  const catReqs = useCategoryRequests();
  const payReqs = usePaymentRequests();
  const { allCategories } = useCategories();
  const { logo } = useLogo();
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [uid, setUid] = useState("");
  const [slug, setSlug] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [reqFilter, setReqFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [busy, setBusy] = useState(false);
  const [approvingAllReqs, setApprovingAllReqs] = useState(false);

  async function refreshUsers() {
    try {
      const list = await listUsers();
      setUsers(list);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void refreshUsers();
    const timer = setInterval(refreshUsers, 60000);
    return () => clearInterval(timer);
  }, []);

  const pendingCatReqs = catReqs.requests.filter((r) => r.status === "pending");
  const pendingPayReqs = payReqs.requests.filter((r) => r.status === "pending");

  async function handleApproveCatReq(reqId: string, targetUserId: string, categorySlug: string) {
    try {
      await catReqs.approveCategoryRequest(reqId);
      if (targetUserId && categorySlug) {
        await grant(targetUserId, categorySlug);
      }
      toast.success("ক্যাটাগরি অ্যাকসেস রিকোয়েস্ট অনুমোদিত হয়েছে!");
    } catch (e) {
      toast.error((e as Error).message || "ত্রুটি");
    }
  }

  async function handleApproveAllPendingReqs() {
    if (pendingCatReqs.length === 0 && pendingPayReqs.length === 0) return;
    setApprovingAllReqs(true);
    try {
      for (const r of pendingCatReqs) {
        await catReqs.approveCategoryRequest(r.id);
        if (r.userId && r.categorySlug) {
          await grant(r.userId, r.categorySlug);
        }
      }
      for (const p of pendingPayReqs) {
        await payReqs.approveRequest(p.id);
      }
      toast.success("সকল অপেক্ষমাণ অ্যাকসেস ও সাবস্ক্রিপশন রিকোয়েস্ট অনুমোদিত হয়েছে!");
    } catch (e) {
      toast.error((e as Error).message || "ত্রুটি");
    } finally {
      setApprovingAllReqs(false);
    }
  }

  async function add() {
    if (!uid || !slug) return toast.error("ইউজার ও ক্যাটাগরি নির্বাচন করুন");
    setBusy(true);
    try {
      if (slug === "__ALL__") {
        for (const c of allCategories) {
          await grant(uid, c.slug);
        }
        toast.success("নির্বাচিত ইউজারকে সকল ক্যাটাগরির অ্যাকসেস দেওয়া হয়েছে!");
      } else {
        const { error } = await grant(uid, slug);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("ক্যাটাগরি অ্যাকসেস দেওয়া হয়েছে");
      }
      setSlug("");
    } finally {
      setBusy(false);
    }
  }

  // Group granted accesses by user_id
  const groupedByUser = (() => {
    const map = new Map<string, Array<{ id: string; user_id: string; category_slug: string }>>();
    for (const a of items) {
      const existing = map.get(a.user_id) || [];
      existing.push(a);
      map.set(a.user_id, existing);
    }
    return Array.from(map.entries());
  })();

  const selectableUsers = users.filter((u) => {
    const q = (userSearch || "").trim().toLowerCase();
    if (!q) return true;
    return `${u?.profile?.full_name || ""} ${u?.email || ""} ${u?.profile?.phone || ""} ${u?.id || ""}`
      .toLowerCase()
      .includes(q);
  });

  const filteredCatReqs = catReqs.requests.filter((r) =>
    reqFilter === "all" ? true : r.status === reqFilter
  );
  const filteredPayReqs = payReqs.requests.filter((r) =>
    reqFilter === "all" ? true : r.status === reqFilter
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900">
        <p className="flex items-center gap-1.5 font-bold">
          <ShieldCheck className="h-4 w-4 text-amber-700" /> মেইন সুপার অ্যাডমিন
        </p>
        <p className="mt-0.5">
          সুপার এডমিনের জন্য সকল ক্যাটাগরি ({allCategories.length} টি), অনুদান, ইউজার ও সেটিংস স্বয়ংক্রিয়ভাবে উন্মুক্ত। নিচে গ্রাহকদের পাঠানো ক্যাটাগরি অ্যাকসেস রিকোয়েস্ট অনুমোদন করতে বা যেকোনো ইউজারকে সরাসরি ক্যাটাগরি অ্যাকসেস দিতে ও বাতিল করতে পারবেন।
        </p>
      </div>

      {/* Customer Category & Subscription Access Requests Queue */}
      <div className="space-y-3 rounded-2xl bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-2 font-display text-sm font-bold text-primary-deep">
              <Bell className="h-4 w-4 text-primary" /> গ্রাহকদের ক্যাটাগরি ও সাবস্ক্রিপশন অ্যাকসেস রিকোয়েস্ট (
              {catReqs.requests.length + payReqs.requests.length} টি)
            </p>
            <p className="text-xs text-muted-foreground">
              গ্রাহকরা কোনো ক্যাটাগরিতে তথ্য যোগ বা সাবস্ক্রিপশনের আবেদন করলে এখানে তাৎক্ষণিকভাবে দেখা যাবে
            </p>
          </div>
          {(pendingCatReqs.length > 0 || pendingPayReqs.length > 0) && (
            <button
              type="button"
              disabled={approvingAllReqs}
              onClick={() => void handleApproveAllPendingReqs()}
              className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {approvingAllReqs ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              সব অপেক্ষমাণ অনুমোদন ({pendingCatReqs.length + pendingPayReqs.length})
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              {
                key: "all",
                label: `সব রিকোয়েস্ট (${catReqs.requests.length + payReqs.requests.length})`,
              },
              {
                key: "pending",
                label: `অপেক্ষমাণ (${pendingCatReqs.length + pendingPayReqs.length})`,
              },
              {
                key: "approved",
                label: `অনুমোদিত (${
                  catReqs.requests.filter((r) => r.status === "approved").length +
                  payReqs.requests.filter((r) => r.status === "approved").length
                })`,
              },
              {
                key: "rejected",
                label: `বাতিল (${
                  catReqs.requests.filter((r) => r.status === "rejected").length +
                  payReqs.requests.filter((r) => r.status === "rejected").length
                })`,
              },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setReqFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                reqFilter === f.key
                  ? "bg-gradient-hero text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filteredCatReqs.length === 0 && filteredPayReqs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            এই ফিল্টারে কোনো ক্যাটাগরি বা সাবস্ক্রিপশন অ্যাকসেস রিকোয়েস্ট নেই
          </p>
        ) : (
          <div className="space-y-2">
            {filteredCatReqs.map((r) => {
              const cat = allCategories.find((c) => c.slug === r.categorySlug);
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-muted/20 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-xs font-bold text-primary-deep">{r.userName}</p>
                      <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold text-primary-deep">
                        ক্যাটাগরি: {cat?.bn || r.categoryBn || r.categorySlug}
                      </span>
                      <Status status={r.status} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      📞 {r.userPhone} • UID: <span className="font-mono">{r.userId.slice(0, 12)}</span>
                      {r.reason ? ` • কারণ: ${r.reason}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.status !== "approved" && (
                      <button
                        type="button"
                        onClick={() => void handleApproveCatReq(r.id, r.userId, r.categorySlug)}
                        className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white"
                      >
                        <Check className="h-3 w-3" /> অনুমোদন
                      </button>
                    )}
                    {r.status !== "rejected" && (
                      <button
                        type="button"
                        onClick={() => void catReqs.rejectCategoryRequest(r.id)}
                        className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold"
                      >
                        <X className="h-3 w-3" /> বাতিল
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void catReqs.deleteCategoryRequest(r.id)}
                      className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredPayReqs.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-xs font-bold text-primary-deep">{p.userName}</p>
                    <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
                      সাবস্ক্রিপশন: {p.amount}৳ ({p.method})
                    </span>
                    <Status status={p.status} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    📞 প্রেরক: {p.senderPhone} (লগইন: {p.userPhone}) • TrxID:{" "}
                    <span className="font-mono font-bold">{p.trxId}</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {p.status !== "approved" && (
                    <button
                      type="button"
                      onClick={() => void payReqs.approveRequest(p.id)}
                      className="flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white"
                    >
                      <Check className="h-3 w-3" /> অনুমোদন
                    </button>
                  )}
                  {p.status !== "rejected" && (
                    <button
                      type="button"
                      onClick={() => void payReqs.rejectRequest(p.id)}
                      className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold"
                    >
                      <X className="h-3 w-3" /> বাতিল
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void payReqs.deleteRequest(p.id)}
                    className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Direct Category Access Assignment */}
      <div className="space-y-2.5 rounded-2xl bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-display text-sm font-bold text-primary-deep">
            <KeyRound className="h-4 w-4 text-primary" /> সরাসরি ইউজার ও স্টাফদের ক্যাটাগরি অ্যাকসেস বরাদ্দ ({users.length} জন ইউজার)
          </p>
          <button
            type="button"
            onClick={() => void refreshUsers()}
            className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-primary-deep hover:bg-primary/10"
          >
            <RefreshCcw className="h-3 w-3" /> ইউজার তালিকা রিফ্রেশ
          </button>
        </div>

        <input
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          placeholder="ইউজার খুঁজুন (নাম, ইমেইল বা ফোন নম্বর)..."
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
        />

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold"
          >
            <option value="">ইউজার নির্বাচন করুন ({selectableUsers.length})</option>
            {selectableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.profile?.full_name || u.email} ({u.email}
                {u.profile?.phone ? ` • ${u.profile.phone}` : ""})
              </option>
            ))}
          </select>

          <select
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold"
          >
            <option value="">ক্যাটাগরি নির্বাচন করুন</option>
            <option value="__ALL__">✓ সবগুলো ক্যাটাগরি একসাথে ({allCategories.length} টি)</option>
            {allCategories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.bn} ({c.slug})
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() => void add()}
          className="flex items-center gap-1.5 rounded-full bg-gradient-hero px-5 py-2 text-xs font-bold text-primary-foreground shadow-card disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          ক্যাটাগরি অ্যাকসেস প্রদান করুন
        </button>
      </div>

      <div className="space-y-2.5">
        {groupedByUser.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            কোনো ইউজারকে এখনো আলাদা ক্যাটাগরি অ্যাকসেস বরাদ্দ করা হয়নি
          </p>
        ) : (
          groupedByUser.map(([targetUid, userRows]) => {
            const u = users.find(
              (x) =>
                x.id === targetUid ||
                (Boolean(x?.email && targetUid && typeof x.email === "string" && typeof targetUid === "string" && x.email.trim().toLowerCase() === targetUid.trim().toLowerCase()))
            );
            return (
              <div
                key={targetUid}
                className="space-y-2.5 rounded-2xl border border-border bg-card p-4 shadow-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <img
                      src={u?.profile?.photo_url || u?.photo_url || logo}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full border border-primary/30 bg-white object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = logo;
                      }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-primary-deep">
                        {u?.profile?.full_name || u?.email || targetUid}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {u?.email || targetUid}
                        {u?.profile?.phone ? ` • 📞 ${u.profile.phone}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                      {userRows.length} টি ক্যাটাগরি
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        for (const row of userRows) {
                          await revoke(row.id);
                        }
                        toast.success("এই ইউজারের সকল ক্যাটাগরি অ্যাকসেস বাতিল করা হয়েছে");
                      }}
                      className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-[10px] font-bold text-destructive hover:bg-destructive hover:text-white"
                    >
                      সব বাতিল
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {userRows.map((a) => {
                    const c = allCategories.find((x) => x.slug === a.category_slug);
                    return (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary-deep"
                      >
                        {c?.bn || a.category_slug}
                        <button
                          type="button"
                          onClick={() => void revoke(a.id)}
                          title="অ্যাকসেস বাতিল করুন"
                          className="rounded-full bg-destructive/15 p-0.5 text-destructive hover:bg-destructive hover:text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Super Admin: Advanced Site Settings & Full Data Backup
// ============================================================================
function SettingsAdminPanel() {
  const { logo, customLogo, setLogo } = useLogo();
  const { meta, saveSiteMeta } = useSiteMetaConfig();
  const { categories } = useCategories();
  const subs = useCloudSubmissions();
  const dons = useCloudDonations();
  const donors = useCloudDonors();
  const fileRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<SiteMetaConfig>(meta);
  const [savingMeta, setSavingMeta] = useState(false);
  const [logoUrlInput, setLogoUrlInput] = useState("");
  const [updatingLogo, setUpdatingLogo] = useState(false);

  useEffect(() => {
    setDraft(meta);
  }, [meta]);

  async function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("শুধু ছবি ফাইল (PNG / JPG) নির্বাচন করুন");

    setUpdatingLogo(true);
    try {
      // 1. Read base64 data url
      const rawDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 2. Try server-side direct file upload to save public/logo.png bit-for-bit
      try {
        const res = await fetch("/api/logo/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileDataBase64: rawDataUrl }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.ok && data?.logoUrl) {
            await setLogo(data.logoUrl);
            toast.success("আসল লোগো ফাইল কোনো পরিবর্তন ছাড়া সফলভাবে সেভ হয়েছে!");
            return;
          }
        }
      } catch {
        // Continue to client-side fallback if server endpoint unavailable
      }

      // 3. Client-side high-res 512x512 canvas preserving PNG transparency and colors
      const cleanDataUrl = await new Promise<string>((resolve) => {
        const img = new Image();
        const objUrl = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(objUrl);
          const canvas = document.createElement("canvas");
          const size = 512;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(rawDataUrl);
          ctx.drawImage(img, 0, 0, size, size);
          resolve(canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.95));
        };
        img.onerror = () => {
          URL.revokeObjectURL(objUrl);
          resolve(rawDataUrl);
        };
        img.src = objUrl;
      });

      await setLogo(cleanDataUrl);
      toast.success("লোগো কোনো বিকৃতি ছাড়া সফলভাবে Firebase-এ আপডেট হয়েছে!");
    } catch (err: any) {
      toast.error(err?.message || "লোগো আপলোড ব্যর্থ হয়েছে");
    } finally {
      setUpdatingLogo(false);
    }
  }

  async function handleApplyLogoUrl(e: React.FormEvent) {
    e.preventDefault();
    const cleanUrl = logoUrlInput.trim();
    if (!cleanUrl) return toast.error("সঠিক ইমেজ লিঙ্ক বা URL দিন");
    setUpdatingLogo(true);
    try {
      await setLogo(cleanUrl);
      toast.success("লোগো URL সরাসরি Firebase-এ সেট হয়েছে (কোনো পরিবর্তন ছাড়া)!");
      setLogoUrlInput("");
    } catch (err: any) {
      toast.error(err?.message || "লোগো আপডেট ব্যর্থ হয়েছে");
    } finally {
      setUpdatingLogo(false);
    }
  }

  async function handleSaveMeta(e: React.FormEvent) {
    e.preventDefault();

    const phone = (draft.contactPhone || draft.helplinePhone || "").trim();
    const email = (draft.contactEmail || "").trim();
    const address = (draft.contactAddress || "").trim();

    const cleanPhoneDigits = phone.replace(/[\s-]/g, "");
    if (phone && !/^01[3-9]\d{8}$/.test(cleanPhoneDigits)) {
      return toast.error("সঠিক বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 01850999178)");
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return toast.error("সঠিক ইমেইল এড্রেস লিখুন (যেমন: e.smartnoakhali@gmail.com)");
    }

    if (!address) {
      return toast.error("আমাদের সম্পর্কে পেজের জন্য ঠিকানা ফাঁকা রাখা যাবে না");
    }

    setSavingMeta(true);
    try {
      await saveSiteMeta(draft);
      toast.success("আমাদের সম্পর্কে যোগাযোগের তথ্য ও সিস্টেম সেটিংস সংরক্ষিত হয়েছে!");
    } catch (err: any) {
      toast.error(err?.message || "সংরক্ষণ ত্রুটি");
    } finally {
      setSavingMeta(false);
    }
  }

  function exportFullBackup() {
    const payload = {
      exportedAt: new Date().toISOString(),
      platform: "Smart Noakhali",
      meta: draft,
      categoriesCount: categories.length,
      submissionsCount: subs.items.length,
      donationsCount: dons.items.length,
      donorsCount: donors.items.length,
      submissions: subs.items,
      donations: dons.items,
      donors: donors.items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smart-noakhali-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("সম্পূর্ণ ডাটাবেইজ ব্যাকআপ ডাউনলোড হয়েছে");
  }

  return (
    <div className="space-y-4">
      {/* Logo & Branding Management Center */}
      <div className="rounded-3xl border border-primary/20 bg-card p-5 shadow-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div>
            <p className="flex items-center gap-2 font-display text-sm font-bold text-primary-deep">
              <ImageIcon className="h-4 w-4 text-primary" /> ব্র্যান্ড ও লোগো কন্ট্রোল সেন্টার (Firebase Cloud Sync)
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              কোনো ডিজাইন পরিবর্তন বা কম্প্রেশন ছাড়া হুবহু আসল রেজোলিউশনে লোগো সেট করুন।
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary-deep">
            {customLogo ? "কাস্টম লোগো সক্রিয়" : "ডিফল্ট অফিশিয়াল লোগো"}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Live Preview Card */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border/80 bg-muted/40 p-4 text-center">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">বর্তমান লাইভ লোগো প্রিভিউ</p>
            <div className="relative flex h-28 w-28 items-center justify-center p-1">
              <img
                src={logo}
                alt="Smart Noakhali Live Logo"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <a
                href={logo}
                download="smart-noakhali-logo.png"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
              >
                <Download className="h-3 w-3" /> লোগো ডাউনলোড
              </a>
              {customLogo && (
                <button
                  type="button"
                  onClick={() => {
                    void setLogo(null);
                    toast.success("ডিফল্ট অফিশিয়াল লোগোতে ফিরিয়ে আনা হয়েছে!");
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/20"
                >
                  <RotateCcw className="h-3 w-3" /> রিসেট
                </button>
              )}
            </div>
          </div>

          {/* Universal Image Upload Control Card */}
          <div className="space-y-3 rounded-2xl border border-border/80 bg-background/60 p-4">
            <div>
              <p className="text-xs font-bold text-foreground">অফিশিয়াল লোগো আপলোড</p>
              <p className="text-[11px] text-muted-foreground mb-3">
                মোবাইল গ্যালারি বা ফাইল থেকে আসল PNG/WebP লোগো সিলেক্ট করুন — স্বয়ংক্রিয়ভাবে অপ্টিমাইজ ও Firebase Storage-এ সংরক্ষিত হবে।
              </p>
              <UniversalImageUploader
                variant="card"
                category="logo"
                entityId="site_logo"
                value={customLogo || ""}
                onChange={(url) => {
                  if (url) {
                    void setLogo(url);
                    toast.success("নতুন লোগো সফলভাবে আপলোড ও আপডেট হয়েছে!");
                  } else {
                    void setLogo(null);
                    toast.success("ডিফল্ট অফিশিয়াল লোগোতে ফিরিয়ে আনা হয়েছে!");
                  }
                }}
                label="লোগো আপলোড বা পরিবর্তন করুন"
                hint="স্বচ্ছতা (transparency) বজায় রাখা হবে ও ক্লাউডে সিঙ্ক থাকবে"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Site Meta & Feature Switches */}
      <form onSubmit={handleSaveMeta} className="space-y-4 rounded-3xl bg-card p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="flex items-center gap-2 font-display text-sm font-bold text-primary-deep">
              <Settings className="h-4 w-4 text-primary" /> উন্নত সিস্টেম ও প্ল্যাটফর্ম কনফিগারেশন
            </p>
            <p className="text-xs text-muted-foreground">
              সাইটের নাম, হেল্পলাইন, এআই লাইভ চ্যাট এবং সিস্টেম ফিচার নিয়ন্ত্রণ করুন
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">সাইটের নাম</label>
            <input
              value={draft.siteTitle}
              onChange={(e) => setDraft({ ...draft, siteTitle: e.target.value })}
              className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">
              ট্যাগলাইন / স্লোগান
            </label>
            <input
              value={draft.tagline}
              onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
              className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">
              হেল্পলাইন নাম্বার
            </label>
            <input
              value={draft.helplinePhone}
              onChange={(e) => setDraft({ ...draft, helplinePhone: e.target.value })}
              className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground">
              সেশন টাইমআউট (মিনিট)
            </label>
            <input
              type="number"
              value={draft.sessionTimeoutMinutes}
              onChange={(e) =>
                setDraft({ ...draft, sessionTimeoutMinutes: Number(e.target.value) || 30 })
              }
              className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold text-muted-foreground">
              জরুরি নোটিশ টেক্সট (হোম/হেডার বার্তা)
            </label>
            <input
              value={draft.emergencyNotice}
              onChange={(e) => setDraft({ ...draft, emergencyNotice: e.target.value })}
              placeholder="কোনো বিশেষ ঘোষণা থাকলে লিখুন..."
              className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold text-muted-foreground">
              এআই (AI) স্বাগতম বার্তা
            </label>
            <input
              value={draft.aiWelcomeMessage}
              onChange={(e) => setDraft({ ...draft, aiWelcomeMessage: e.target.value })}
              className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Dedicated Section: আমাদের সম্পর্কে — যোগাযোগের তথ্য (About Page Contact Settings) */}
        <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/20 pb-2.5">
            <div>
              <p className="flex items-center gap-1.5 font-display text-sm font-bold text-primary-deep">
                <MapPin className="h-4 w-4 text-primary" /> আমাদের সম্পর্কে — যোগাযোগের তথ্য (About Page Contact Settings)
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                https://smartnoakhali.com/about পেজের ফোন নম্বর, অফিসিয়াল ইমেইল ও পূর্ণ ঠিকানা এখান থেকে পরিবর্তন ও নিয়ন্ত্রণ করুন।
              </p>
            </div>
            <Link
              to="/about"
              target="_blank"
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary hover:bg-primary/20"
            >
              পেজ দেখুন ↗
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-bold text-foreground">
                ১. যোগাযোগ / ফোন নম্বর
              </label>
              <input
                value={draft.contactPhone ?? draft.helplinePhone ?? "01850999178"}
                onChange={(e) => setDraft({ ...draft, contactPhone: e.target.value })}
                placeholder="01850999178"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs font-semibold focus:border-primary focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                বাংলাদেশি ১১ সংখ্যার নম্বর (যেমন: 01850999178)
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-foreground">
                ২. অফিসিয়াল ইমেইল
              </label>
              <input
                type="email"
                value={draft.contactEmail ?? "e.smartnoakhali@gmail.com"}
                onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })}
                placeholder="e.smartnoakhali@gmail.com"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold focus:border-primary focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                অফিসিয়াল যোগাযোগের ইমেইল অ্যাড্রেস
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-foreground">
                ৩. পূর্ণ ঠিকানা
              </label>
              <textarea
                value={draft.contactAddress ?? "কালাসর্দ্দা, গোবিন্দপুর, কুতুবের হাট-৩৮৬২, নবীপুর, সেনবাগ, নোয়াখালী, বাংলাদেশ।"}
                onChange={(e) => setDraft({ ...draft, contactAddress: e.target.value })}
                rows={2}
                placeholder="কালাসর্দ্দা, গোবিন্দপুর, কুতুবের হাট-৩৮৬২, নবীপুর, সেনবাগ, নোয়াখালী, বাংলাদেশ।"
                className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs font-medium focus:border-primary focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                আমাদের সম্পর্কে পেজে প্রদর্শিত পূর্ণ কার্যালয় বা যোগাযোগের ঠিকানা
              </p>
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="grid grid-cols-1 gap-2.5 rounded-2xl bg-muted/40 p-3.5 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold">
            <input
              type="checkbox"
              checked={draft.aiChatEnabled}
              onChange={(e) => setDraft({ ...draft, aiChatEnabled: e.target.checked })}
            />
            এআই (AI) সহকারী সক্রিয় (General & Noakhali Assistant)
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold">
            <input
              type="checkbox"
              checked={draft.liveChatEnabled ?? true}
              onChange={(e) => setDraft({ ...draft, liveChatEnabled: e.target.checked })}
            />
            লাইভ চ্যাট গ্রাহক সাপোর্ট সক্রিয়
          </label>
          <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold">
            <input
              type="checkbox"
              checked={draft.strictSecurityMode}
              onChange={(e) => setDraft({ ...draft, strictSecurityMode: e.target.checked })}
            />
            কঠোর এডমিন প্যানেল সিকিউরিটি শিল্ড (Strict Security Mode)
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">সাপোর্ট স্ট্যাটাস:</span>
            <input
              value={draft.liveChatSupportStatus || "অনলাইন (সক্রিয় সাপোর্ট)"}
              onChange={(e) => setDraft({ ...draft, liveChatSupportStatus: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1 text-xs"
              placeholder="অনলাইন (সকাল ৯টা - রাত ১০টা)"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="submit"
            disabled={savingMeta}
            className="flex items-center gap-1.5 rounded-full bg-gradient-hero px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-elevated disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />{" "}
            {savingMeta ? "সংরক্ষণ হচ্ছে..." : "সিস্টেম সেটিংস সংরক্ষণ করুন"}
          </button>

          <button
            type="button"
            onClick={exportFullBackup}
            className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold text-primary-deep hover:bg-primary/20"
          >
            <Database className="h-3.5 w-3.5" /> সম্পূর্ণ ডাটাবেইজ ব্যাকআপ (JSON)
          </button>
        </div>
      </form>

      <OtpGatewayConfigCard />

      <DonationNumbersManagerCard />
    </div>
  );
}

function OtpGatewayConfigCard() {
  const [cfg, setCfg] = useState({
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpUser: "",
    smtpPass: "",
    smtpFromName: "স্মার্ট নোয়াখালী (Smart Noakhali)",
    resendApiKey: "",
    bulksmsApiKey: "",
    bulksmsSenderId: "8809617611000",
    greenwebToken: "",
    customSmsUrl: "",
  });
  const [activeSessions, setActiveSessions] = useState<
    Array<{ target: string; channel: "email" | "phone"; code: string; expiresAt: number }>
  >([]);
  const [saving, setSaving] = useState(false);

  async function loadConfig() {
    try {
      const r = await fetch("/api/admin/otp-config");
      const data = await r.json();
      if (data?.config) {
        setCfg((prev) => ({ ...prev, ...data.config }));
      }
      if (Array.isArray(data?.activeSessions)) {
        setActiveSessions(data.activeSessions);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    void loadConfig();
    const t = setInterval(loadConfig, 5000);
    return () => clearInterval(t);
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await fetch("/api/admin/otp-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      if (!r.ok) throw new Error("সংরক্ষণ ব্যর্থ");
      toast.success("৬-ডিজিট ওটিপি (OTP) ইমেইল ও এসএমএস গেটওয়ে সংরক্ষিত হয়েছে!");
      await loadConfig();
    } catch (err: any) {
      toast.error(err?.message || "ত্রুটি");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-3xl bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 font-display text-sm font-bold text-primary-deep">
            <KeyRound className="h-4 w-4 text-primary" /> ৬-ডিজিট ওটিপি (OTP) ইমেইল ও এসএমএস গেটওয়ে সেটিংস
          </p>
          <p className="text-xs text-muted-foreground">
            ইমেইল ও মোবাইলে সরাসরি ৬ সংখ্যার ভেরিফিকেশন কোড পাঠানোর জন্য SMTP (Gmail App Password) বা SMS API কনফিগার করুন
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadConfig()}
          className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-primary-deep"
        >
          রিফ্রেশ
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">
            প্রেরকের ইমেইল (Gmail / SMTP User)
          </label>
          <input
            value={cfg.smtpUser}
            onChange={(e) => setCfg({ ...cfg, smtpUser: e.target.value })}
            placeholder="your-email@gmail.com"
            className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">
            Gmail App Password / SMTP পাসওয়ার্ড
          </label>
          <input
            type="password"
            value={cfg.smtpPass}
            onChange={(e) => setCfg({ ...cfg, smtpPass: e.target.value })}
            placeholder="১৬ অক্ষরের অ্যাপ পাসওয়ার্ড"
            className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">
            BulkSMSBD API Key (মোবাইল SMS কোডের জন্য)
          </label>
          <input
            value={cfg.bulksmsApiKey}
            onChange={(e) => setCfg({ ...cfg, bulksmsApiKey: e.target.value })}
            placeholder="BulkSMSBD API Key"
            className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground">
            GreenWeb BD SMS Token (বিকল্প SMS গেটওয়ে)
          </label>
          <input
            value={cfg.greenwebToken}
            onChange={(e) => setCfg({ ...cfg, greenwebToken: e.target.value })}
            placeholder="GreenWeb Token"
            className="mt-0.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
          />
        </div>
      </div>

      {activeSessions.length > 0 && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
          <p className="mb-2 text-xs font-bold text-primary-deep">
            সক্রিয় ওটিপি সেশন মনিটর (শুধুমাত্র সুপার এডমিনের জন্য দৃশ্যমান):
          </p>
          <div className="space-y-1.5">
            {activeSessions.map((s) => (
              <div
                key={`${s.channel}:${s.target}`}
                className="flex items-center justify-between rounded-xl bg-white px-3 py-1.5 text-xs shadow-sm"
              >
                <span>
                  <strong>{s.channel === "email" ? "📧 ইমেইল" : "📱 মোবাইল"}:</strong> {s.target}
                </span>
                <span className="rounded-lg bg-emerald-500/15 px-2.5 py-0.5 font-mono text-sm font-extrabold text-emerald-800">
                  {s.code}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-1.5 rounded-full bg-gradient-hero px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-elevated disabled:opacity-60"
      >
        <Save className="h-3.5 w-3.5" />{" "}
        {saving ? "সংরক্ষণ হচ্ছে..." : "ওটিপি গেটওয়ে সেটিংস সংরক্ষণ করুন"}
      </button>
    </form>
  );
}

function List<T>({
  items,
  empty,
  children,
}: {
  items: T[];
  empty: string;
  children: (item: T) => React.ReactNode;
}) {
  if (items.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  return <div className="space-y-3">{items.map(children)}</div>;
}

function Actions({
  onApprove,
  onReject,
  onDelete,
  status,
  inline,
  canDelete,
}: {
  onApprove: () => Promise<unknown> | unknown;
  onReject: () => Promise<unknown> | unknown;
  onDelete: () => Promise<unknown> | unknown;
  status: string;
  inline?: boolean;
  canDelete?: boolean;
}) {
  const [busy, setBusy] = useState<null | "a" | "r" | "d">(null);
  const { isMainAdmin, isAdmin } = useAuth();
  const allowDelete = canDelete ?? (isMainAdmin || isAdmin);
  async function run(key: "a" | "r" | "d", fn: () => Promise<unknown> | unknown, ok: string) {
    if (busy) return;
    setBusy(key);
    try {
      const res = (await fn()) as { error?: { message: string } } | undefined;
      if (res && res.error) toast.error(res.error.message);
      else toast.success(ok);
    } catch (e) {
      toast.error((e as Error).message ?? "ত্রুটি");
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className={inline ? "flex flex-wrap gap-2" : "mt-3 flex flex-wrap gap-2"}>
      {status !== "approved" && (
        <button
          disabled={!!busy}
          onClick={() => run("a", onApprove, "অনুমোদিত হয়েছে")}
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy === "a" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}{" "}
          অনুমোদন
        </button>
      )}
      {status !== "rejected" && (
        <button
          disabled={!!busy}
          onClick={() => run("r", onReject, "বাতিল করা হয়েছে")}
          className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
        >
          {busy === "r" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <X className="h-3 w-3" />
          )}{" "}
          বাতিল
        </button>
      )}
      {allowDelete && (
        <button
          disabled={!!busy}
          onClick={() => {
            void run("d", onDelete, "মুছে ফেলা হয়েছে");
          }}
          className="flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive disabled:opacity-60"
        >
          {busy === "d" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}{" "}
          মুছুন
        </button>
      )}
    </div>
  );
}

function Status({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-700",
    approved: "bg-emerald-500/15 text-emerald-700",
    rejected: "bg-rose-500/15 text-rose-700",
  };
  const label: Record<string, string> = {
    pending: "অপেক্ষমাণ",
    approved: "অনুমোদিত",
    rejected: "বাতিল",
  };
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${map[status]}`}>
      {label[status]}
    </span>
  );
}

function TabBtn({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-card text-primary-deep shadow-card"
          : "text-muted-foreground hover:text-primary-deep"
      }`}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white shadow-sm">
          {badge}
        </span>
      )}
    </button>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-3 shadow-card transition ${
        accent
          ? "bg-gradient-to-br from-rose-50 to-amber-50 ring-1 ring-rose-200/60"
          : "bg-gradient-card"
      }`}
    >
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 font-display text-lg font-bold ${
          accent ? "text-rose-700" : "text-primary-deep"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function OverviewPanel({
  onJump,
  isMainAdmin,
  pendingSubs,
  pendingDons,
  pendingDonors,
  pendingEvents,
  pendingEmerg,
  pendingAccess = 0,
  activeBanners,
  allSubs,
  recentSubs,
  recentDons,
  auditLogs = [],
}: {
  onJump: (t: Tab) => void;
  isMainAdmin: boolean;
  pendingSubs: number;
  pendingDons: number;
  pendingDonors: number;
  pendingEvents: number;
  pendingEmerg: number;
  pendingAccess?: number;
  activeBanners: number;
  allSubs: SubmissionRow[];
  recentSubs: Array<{ id: string; title: string; category_slug: string; status: string }>;
  recentDons: Array<{ id: string; sender_name: string; amount: number; status: string }>;
  auditLogs?: StaffActivityLogEntry[];
}) {
  const { allCategories } = useCategories();
  const { logo } = useLogo();

  // Compute top categories by submission count
  const catCounts = allCategories
    .map((c) => ({
      slug: c.slug,
      bn: c.bn,
      count: allSubs.filter((s) => s.category_slug === c.slug).length,
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const queue: Array<{ key: Tab; label: string; count: number; tone: string }> = [
    {
      key: "info",
      label: "অপেক্ষমাণ তথ্য",
      count: pendingSubs,
      tone: "bg-amber-500/15 text-amber-700",
    },
    ...(isMainAdmin
      ? [
          {
            key: "donation" as Tab,
            label: "অপেক্ষমাণ অনুদান",
            count: pendingDons,
            tone: "bg-emerald-500/15 text-emerald-700",
          },
          {
            key: "access" as Tab,
            label: "অপেক্ষমাণ অ্যাকসেস ও সাবস্ক্রিপশন",
            count: pendingAccess,
            tone: "bg-purple-500/15 text-purple-700",
          },
        ]
      : []),
    {
      key: "donors",
      label: "অপেক্ষমাণ দাতা",
      count: pendingDonors,
      tone: "bg-rose-500/15 text-rose-700",
    },
    {
      key: "events",
      label: "অপেক্ষমাণ রক্তদান",
      count: pendingEvents,
      tone: "bg-pink-500/15 text-pink-700",
    },
    {
      key: "emergency",
      label: "অপেক্ষমাণ জরুরী",
      count: pendingEmerg,
      tone: "bg-red-500/15 text-red-700",
    },
  ];

  const recentDeletedLogs = auditLogs.filter((l) => l.action_type === "delete").slice(0, 4);
  const recentStaffLogs = auditLogs.slice(0, 5);

  return (
    <div className="space-y-3">
      {/* Quick Actions */}
      <div className="rounded-2xl bg-card p-4 shadow-card">
        <p className="mb-3 font-display text-sm font-bold text-primary-deep">
          ⚡ দ্রুত অ্যাকশন ও শর্টকাট
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickAction
            onClick={() => onJump("profile")}
            icon={<UserCircle2 className="h-4 w-4" />}
            label="আমার প্রোফাইল ও ফটো"
          />
          <QuickAction
            onClick={() => onJump("tasks")}
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            label="টাস্ক ও কর্মসূচি (অফলাইন)"
          />
          {isMainAdmin && (
            <QuickAction
              onClick={() => onJump("roles")}
              icon={<ShieldCheck className="h-4 w-4" />}
              label="রোল ও পারমিশন"
            />
          )}
          {isMainAdmin && (
            <QuickAction
              onClick={() => onJump("branding")}
              icon={<ImageIcon className="h-4 w-4" />}
              label="ব্র্যান্ডিং ও লোগো"
            />
          )}
          {isMainAdmin && (
            <QuickAction
              onClick={() => onJump("activity")}
              icon={<Activity className="h-4 w-4" />}
              label="স্টাফ অ্যাক্টিভিটি ও ডিলিট"
            />
          )}
          {isMainAdmin && (
            <QuickAction
              onClick={() => onJump("users")}
              icon={<UsersIcon className="h-4 w-4" />}
              label="ইউজার ও পাসওয়ার্ড"
            />
          )}
          {isMainAdmin && (
            <QuickAction
              onClick={() => onJump("apps")}
              icon={<Smartphone className="h-4 w-4" />}
              label="অ্যাপ ফাইল আপলোড"
            />
          )}
          {isMainAdmin && (
            <QuickAction
              onClick={() => onJump("categories")}
              icon={<LayoutGrid className="h-4 w-4" />}
              label="ক্যাটাগরি এডিট"
            />
          )}
          {isMainAdmin && (
            <QuickAction
              onClick={() => onJump("services")}
              icon={<Wrench className="h-4 w-4" />}
              label="আমাদের সেবা পরিচালনা"
            />
          )}
          {isMainAdmin && (
            <QuickAction
              onClick={() => onJump("donation")}
              icon={<HandCoins className="h-4 w-4" />}
              label="অনুদান নাম্বার"
            />
          )}
          <QuickAction
            onClick={() => onJump("info")}
            icon={<Plus className="h-4 w-4" />}
            label="তথ্য যোগ/এডিট"
          />
          <QuickAction
            onClick={() => onJump("chat")}
            icon={<MessageCircle className="h-4 w-4" />}
            label="লাইভ চ্যাট উত্তর"
          />
          <QuickAction
            onClick={() => onJump("security")}
            icon={<ShieldCheck className="h-4 w-4" />}
            label="সিকিউরিটি ও পিন"
          />
        </div>
      </div>

      {/* Super Admin Exclusive: Live Staff Activity & Deletion Monitor */}
      {isMainAdmin && (
        <div className="rounded-3xl border border-primary/25 bg-card p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="flex items-center gap-1.5 font-display text-sm font-bold text-primary-deep">
                <Activity className="h-4 w-4 text-primary" /> 🕵️ এডমিন, এডিটর ও মডারেটর অ্যাক্টিভিটি ও ডিলিট মনিটর
              </p>
              <p className="text-xs text-muted-foreground">
                কে কখন কোন তথ্য অনুমোদন, এডিট বা ডিলিট করেছে তার লাইভ তালিকা (শুধু সুপার এডমিন দেখতে পান)
              </p>
            </div>
            <button
              type="button"
              onClick={() => onJump("activity")}
              className="rounded-full bg-gradient-hero px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-card"
            >
              সব লগ ও ডিলিট তথ্য দেখুন ({auditLogs.length})
            </button>
          </div>

          {recentDeletedLogs.length > 0 && (
            <div className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-rose-700">
                <Trash2 className="h-3.5 w-3.5" /> সাম্প্রতিক ডিলিট করা তথ্য ({recentDeletedLogs.length} টি)
              </p>
              <div className="space-y-1.5">
                {recentDeletedLogs.map((dl) => (
                  <div
                    key={dl.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/90 px-3 py-2 text-xs shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-rose-800">
                        🗑️ {dl.target_title}{" "}
                        <span className="font-normal text-muted-foreground">
                          ({dl.module_label})
                        </span>
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        ডিলিট করেছেন: <strong className="text-foreground">{dl.actor_name}</strong>{" "}
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary-deep">
                          {dl.actor_role_bn}
                        </span>{" "}
                        • {new Date(dl.created_at).toLocaleString("bn-BD")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onJump("activity")}
                      className="rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-bold text-white"
                    >
                      বিস্তারিত / পুনরুদ্ধার
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentStaffLogs.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              এখনো কোনো এডমিন, এডিটর বা মডারেটরের অ্যাক্টিভিটি রেকর্ড হয়নি। তারা কোনো কাজ বা ডিলিট করলেই এখানে সাথে সাথে দেখা যাবে।
            </p>
          ) : (
            <div className="mt-3 space-y-1.5">
              {recentStaffLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <img
                      src={log.actor_photo || logo}
                      alt={log.actor_name}
                      className="h-8 w-8 shrink-0 rounded-full border border-primary/30 bg-white object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        <span>{log.actor_name}</span>{" "}
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary-deep">
                          {log.actor_role_bn}
                        </span>{" "}
                        —{" "}
                        <span
                          className={
                            log.action_type === "delete"
                              ? "font-bold text-rose-600"
                              : "font-bold text-primary-deep"
                          }
                        >
                          {log.action_label}
                        </span>
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {log.module_label}: <strong>{log.target_title}</strong>
                        {log.target_detail ? ` • ${log.target_detail}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(log.created_at).toLocaleTimeString("bn-BD", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* System Health & Security Status */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <p className="mb-2.5 flex items-center gap-1.5 font-display text-sm font-bold text-primary-deep">
            <Activity className="h-4 w-4 text-emerald-600" /> সিস্টেম ও সিকিউরিটি স্ট্যাটাস
          </p>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 px-3 py-2 text-emerald-900">
              <span className="flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Firebase রিয়েলটাইম ডাটাবেইজ
              </span>
              <span className="font-bold">সক্রিয়</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2 text-primary-deep">
              <span className="flex items-center gap-1.5 font-semibold">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> এআই (AI) লাইভ চ্যাট সার্চ
              </span>
              <span className="font-bold">সক্রিয়</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-amber-500/10 px-3 py-2 text-amber-900">
              <span className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-700" /> রোল ও প্রোফাইল আইসোলেশন
              </span>
              <span className="font-bold">সুরক্ষিত</span>
            </div>
          </div>
        </div>

        {/* Pending Queue */}
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <p className="mb-2.5 font-display text-sm font-bold text-primary-deep">
            📋 অপেক্ষমাণ অনুমোদন কিউ
          </p>
          <div className="space-y-1.5">
            {queue.map((q) => (
              <button
                key={q.key}
                onClick={() => onJump(q.key)}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-3 py-1.5 text-left transition hover:border-primary"
              >
                <span className="text-xs font-medium">{q.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    q.count > 0 ? q.tone : "bg-muted text-muted-foreground"
                  }`}
                >
                  {q.count}
                </span>
              </button>
            ))}
            <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-background px-3 py-1.5">
              <span className="text-xs">সক্রিয় জরুরী ব্যানার</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  activeBanners > 0
                    ? "bg-emerald-500/15 text-emerald-700"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {activeBanners}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Distribution Analytics */}
      {catCounts.length > 0 && (
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <p className="mb-2.5 font-display text-sm font-bold text-primary-deep">
            📊 শীর্ষ ক্যাটাগরি তথ্য পরিসংখ্যান
          </p>
          <div className="space-y-2">
            {catCounts.map((c) => {
              const pct = Math.min(
                100,
                Math.round((c.count / Math.max(1, allSubs.length)) * 100)
              );
              return (
                <div key={c.slug} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold">{c.bn}</span>
                    <span className="text-muted-foreground">
                      {c.count} টি তথ্য ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-hero"
                      style={{ width: `${Math.max(8, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recentSubs.length > 0 && (
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <p className="mb-2 font-display text-sm font-bold text-primary-deep">
            🕒 সাম্প্রতিক তথ্য জমা
          </p>
          <div className="space-y-1.5">
            {recentSubs.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs"
              >
                <span className="truncate">
                  {s.title} <span className="text-muted-foreground">• {s.category_slug}</span>
                </span>
                <Status status={s.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {isMainAdmin && recentDons.length > 0 && (
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <p className="mb-2 font-display text-sm font-bold text-primary-deep">
            💰 সাম্প্রতিক অনুদান
          </p>
          <div className="space-y-1.5">
            {recentDons.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs"
              >
                <span className="truncate">
                  {d.sender_name} •{" "}
                  <span className="font-bold text-primary-deep">
                    {Number(d.amount).toLocaleString("bn-BD")}৳
                  </span>
                </span>
                <Status status={d.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QuickAction({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-background p-3 transition hover:border-primary hover:shadow-card active:scale-95"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground">
        {icon}
      </span>
      <span className="text-[11px] font-semibold text-primary-deep">{label}</span>
    </button>
  );
}

// ============= Emergency banners CRUD =============
function BannersEditor() {
  const { items, add, update, remove } = useEmergencyBanners();
  const [form, setForm] = useState({
    title: "জরুরী রক্তের প্রয়োজন",
    message: "",
    blood_group: "",
    hospital: "",
    phone: "",
    visible: true,
  });
  const [busy, setBusy] = useState(false);
  const { isMainAdmin, isAdmin } = useAuth();
  const canManageBanners = isMainAdmin || isAdmin;

  async function create() {
    if (!form.message.trim()) return toast.error("বার্তা আবশ্যক");
    setBusy(true);
    const res = await add(form);
    setBusy(false);
    if (!res.ok) return toast.error(res.error || "ত্রুটি");
    toast.success("জরুরী ব্যানার ও নোটিফিকেশন ব্রডকাস্ট সফল হয়েছে");
    sendBrowserNotification(`📢 ${form.title}`, {
      body: `${form.message}${form.phone ? ` • কল: ${form.phone}` : ""}`,
    });
    setForm({
      title: "জরুরী রক্তের প্রয়োজন",
      message: "",
      blood_group: "",
      hospital: "",
      phone: "",
      visible: true,
    });
  }

  return (
    <div className="space-y-3">
      {canManageBanners && (
        <div className="space-y-2 rounded-2xl bg-card p-4 shadow-card">
          <p className="flex items-center gap-2 font-display font-bold text-primary-deep">
            <Bell className="h-4 w-4" /> নতুন জরুরী ব্যানার
          </p>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="শিরোনাম"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <textarea
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            rows={3}
            placeholder="বার্তা * (যেমন: O+ রক্তদাতা প্রয়োজন — নোয়াখালী জেনারেল হাসপাতাল)"
            className="w-full rounded-xl border border-border bg-background p-3 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.blood_group}
              onChange={(e) => setForm({ ...form, blood_group: e.target.value })}
              placeholder="রক্তের গ্রুপ (যেমন O+)"
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="যোগাযোগ ফোন"
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <input
            value={form.hospital}
            onChange={(e) => setForm({ ...form, hospital: e.target.value })}
            placeholder="হাসপাতাল (ঐচ্ছিক)"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.visible}
                onChange={(e) => setForm({ ...form, visible: e.target.checked })}
              />{" "}
              দৃশ্যমান
            </label>
            <button
              disabled={busy}
              onClick={create}
              className="flex items-center gap-1 rounded-full bg-gradient-hero px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}{" "}
              যোগ করুন
            </button>
          </div>
        </div>
      )}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          কোনো ব্যানার নেই
        </div>
      ) : (
        items.map((b) => <BannerRowEdit key={b.id} b={b} update={update} remove={remove} />)
      )}
    </div>
  );
}

function BannerRowEdit({
  b,
  update,
  remove,
}: {
  b: BannerRow;
  update: (id: string, p: Partial<BannerRow>) => unknown;
  remove: (id: string) => unknown;
}) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    title: b.title,
    message: b.message,
    blood_group: b.blood_group ?? "",
    hospital: b.hospital ?? "",
    phone: b.phone ?? "",
    visible: b.visible,
  });
  const { isMainAdmin, isAdmin } = useAuth();
  const canManageBanners = isMainAdmin || isAdmin;

  async function save() {
    const { error } = (await update(b.id, form)) as { error?: { message: string } };
    if (error) toast.error(error.message);
    else {
      toast.success("সংরক্ষিত");
      setEdit(false);
    }
  }
  async function toggle() {
    const { error } = (await update(b.id, { visible: !b.visible })) as {
      error?: { message: string };
    };
    if (error) toast.error(error.message);
  }
  async function del() {
    const { error } = (await remove(b.id)) as { error?: { message: string } };
    if (error) toast.error(error.message);
    else toast.success("মুছে ফেলা হয়েছে");
  }

  if (!edit) {
    return (
      <div className={`rounded-2xl bg-card p-4 shadow-card ${b.visible ? "" : "opacity-60"}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-rose-700">{b.title}</p>
              {b.blood_group && (
                <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {b.blood_group}
                </span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  b.visible
                    ? "bg-emerald-500/15 text-emerald-700"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {b.visible ? "দৃশ্যমান" : "লুকানো"}
              </span>
            </div>
            <p className="mt-1 text-sm">{b.message}</p>
            {b.hospital && <p className="text-xs text-muted-foreground">🏥 {b.hospital}</p>}
            {b.phone && <p className="text-xs text-muted-foreground">📞 {b.phone}</p>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={toggle}
            className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold"
          >
            <Eye className="h-3 w-3" /> {b.visible ? "লুকান" : "দেখান"}
          </button>
          {canManageBanners && (
            <button
              onClick={() => setEdit(true)}
              className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              <Edit3 className="h-3 w-3" /> সম্পাদনা
            </button>
          )}
          {canManageBanners && (
            <button
              onClick={del}
              className="flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive"
            >
              <Trash2 className="h-3 w-3" /> মুছুন
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl bg-card p-4 shadow-card">
      <input
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
      />
      <textarea
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        rows={3}
        className="w-full rounded-xl border border-border bg-background p-3 text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={form.blood_group}
          onChange={(e) => setForm({ ...form, blood_group: e.target.value })}
          placeholder="গ্রুপ"
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <input
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="ফোন"
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      </div>
      <input
        value={form.hospital}
        onChange={(e) => setForm({ ...form, hospital: e.target.value })}
        placeholder="হাসপাতাল"
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.visible}
          onChange={(e) => setForm({ ...form, visible: e.target.checked })}
        />{" "}
        দৃশ্যমান
      </label>
      <div className="flex gap-2">
        <button
          onClick={save}
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          <Save className="h-3 w-3" /> সংরক্ষণ
        </button>
        <button
          onClick={() => setEdit(false)}
          className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold"
        >
          বাতিল
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Admin Private Live Chat Panel — Super Easy 1-Click & Inline Reply for All Staff
// Ensures responder's Name & Profile Photo are synced and shown to customer,
// while isolating non-Super-Admin staff from seeing other staff's identities.
// ============================================================================
type ThreadView = ChatThreadRow & {
  profile: { full_name: string | null; username: string | null; phone: string | null } | null;
  email: string;
};

const QUICK_STAFF_REPLIES = [
  "আসসালামু আলাইকুম! স্মার্ট নোয়াখালীতে আপনাকে স্বাগতম। কিভাবে সাহায্য করতে পারি?",
  "ধন্যবাদ, আমরা আপনার মেসেজটি পেয়েছি এবং বিষয়টি দেখছি।",
  "অনুগ্রহ করে আপনার পূর্ণ নাম ও মোবাইল নাম্বারটি দিন।",
  "আপনার তথ্যটি সফলভাবে নোট করা হয়েছে। ধন্যবাদ!",
  "জরুরী রক্ত বা অ্যাম্বুলেন্সের জন্য আমাদের জরুরী সেকশন দেখুন অথবা ৯৯৯-এ কল করুন।",
];

function ChatThreadsAdmin() {
  const [threads, setThreads] = useState<ThreadView[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ThreadView | null>(null);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "unread" | "replied">("all");
  const [inlineDrafts, setInlineDrafts] = useState<Record<string, string>>({});
  const [sendingThreadId, setSendingThreadId] = useState<string | null>(null);

  const { user, isMainAdmin, isAdmin, isEditor, isModerator } = useAuth();
  const { getStaffProfile, upsertStaffProfile } = useStaffProfiles();
  const { logo } = useLogo();
  const liveThreads = useChatThreads();

  const me = user?.id || (isMainAdmin ? "super_admin_mahmudul" : "staff_member");
  const myStaff = getStaffProfile(me) || getStaffProfile(user?.email);
  const myRoleLabel = isMainAdmin
    ? "সুপার এডমিন"
    : isAdmin
      ? "এডমিন"
      : isEditor
        ? "এডিটর"
        : isModerator
          ? "মোডারেটর"
          : "স্টাফ";
  const myName =
    myStaff?.full_name ||
    user?.displayName ||
    (isMainAdmin ? "মেইন সুপার এডমিন" : user?.email?.split("@")[0] || myRoleLabel);
  const myPhoto = myStaff?.photo_url || logo;

  async function refresh() {
    try {
      const list = (await listThreadsWithUsers()) as ThreadView[];
      setThreads(list);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    void refresh();
  }, [liveThreads.items.length, liveThreads.items.map((t) => t.last_message_at).join(",")]);

  async function sendQuickInlineReply(thread: ThreadView, customText?: string) {
    const replyBody = (customText ?? inlineDrafts[thread.id] ?? "").trim();
    if (!replyBody) {
      toast.error("উত্তর লিখুন অথবা উপরের রেডি উত্তর বাটনে ক্লিক করুন");
      return;
    }

    setSendingThreadId(thread.id);
    try {
      // Sync responder profile so customer sees their Name, Role & Photo
      await upsertStaffProfile({
        uid: me,
        email: user?.email || "",
        full_name: myName,
        role_label: myRoleLabel,
        photo_url: myStaff?.photo_url || "",
        phone: myStaff?.phone || user?.phone || "",
        designation: myStaff?.designation || myRoleLabel,
      }).catch(() => {});

      const resp = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: thread.id,
          user_id: thread.user_id,
          user_name: thread.profile?.full_name || undefined,
          user_email: thread.email || undefined,
          user_phone: thread.profile?.phone || undefined,
          sender_id: me,
          sender_role: "staff",
          sender_name: myName,
          sender_photo: myPhoto,
          sender_role_label: myRoleLabel,
          body: replyBody,
        }),
      });

      if (!resp.ok) {
        throw new Error("উত্তর পাঠানো যায়নি");
      }

      void recordStaffActivity({
        action_type: "reply",
        action_label: "গ্রাহকের লাইভ চ্যাটে দ্রুত উত্তর দিয়েছে",
        module: "chat",
        module_label: "লাইভ চ্যাট",
        target_id: thread.id,
        target_title: thread.profile?.full_name || thread.email || `গ্রাহক (${thread.id.slice(0, 10)})`,
        target_detail: `উত্তর: "${replyBody}"`,
      });

      setInlineDrafts((prev) => ({ ...prev, [thread.id]: "" }));
      toast.success(`${thread.profile?.full_name || "গ্রাহক"}-কে উত্তর পাঠানো হয়েছে!`);
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "উত্তর পাঠানো ব্যর্থ হয়েছে");
    } finally {
      setSendingThreadId(null);
    }
  }

  async function handleDeleteThread(thread: ThreadView) {
    if (!isMainAdmin) return;
    const { error } = await liveThreads.remove(thread.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setThreads((prev) => prev.filter((x) => x.id !== thread.id));
    if (active?.id === thread.id) {
      setActive(null);
    }
    toast.success(`${thread.profile?.full_name || "গ্রাহক"}-এর লাইভ চ্যাট ডিলিট করা হয়েছে`);
  }

  async function handleDeleteAllThreads() {
    if (!isMainAdmin || threads.length === 0) return;
    const { error } = await liveThreads.removeAll();
    if (error) {
      toast.error(error.message);
      return;
    }
    setThreads([]);
    setActive(null);
    toast.success("সকল লাইভ চ্যাট ডিলিট করা হয়েছে");
  }

  const unreadTotal = threads.filter((t) => Number(t.staff_unread) > 0).length;

  const filtered = threads.filter((t) => {
    if (filterMode === "unread" && !(Number(t.staff_unread) > 0)) return false;
    if (filterMode === "replied" && Number(t.staff_unread) > 0) return false;

    const q = (search || "").trim().toLowerCase();
    if (!q) return true;
    return [t?.email, t?.profile?.full_name, t?.profile?.username, t?.profile?.phone, t?.last_message_preview]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  if (active) {
    return (
      <AdminChatPanel
        thread={active}
        onBack={() => {
          setActive(null);
          void refresh();
        }}
        onDeleteThread={() => void handleDeleteThread(active)}
        me={me}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Easy Responder Identity Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-gradient-card p-3.5 shadow-card">
        <div className="flex items-center gap-3">
          <img
            src={myPhoto}
            alt={myName}
            className="h-11 w-11 shrink-0 rounded-full border-2 border-gold bg-white object-cover shadow-sm"
          />
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-xs font-bold text-primary-deep">
                আপনি উত্তর দিচ্ছেন: <span className="text-primary">{myName}</span>
              </p>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary-deep">
                {myRoleLabel}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              নিচের যেকোনো মেসেজ কার্ডে সরাসরি উত্তর লিখুন বা ১-ক্লিকে রেডি উত্তর পাঠান — গ্রাহক আপনার নাম ও ছবি দেখতে পাবেন।
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isMainAdmin && threads.length > 0 && (
            <button
              type="button"
              onClick={() => void handleDeleteAllThreads()}
              className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1.5 text-xs font-bold text-destructive transition hover:bg-destructive hover:text-white"
            >
              <Trash2 className="h-3.5 w-3.5" /> সব চ্যাট ডিলিট ({threads.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-primary-deep hover:bg-primary/10"
          >
            <RefreshCcw className="h-3.5 w-3.5" /> রিফ্রেশ
          </button>
        </div>
      </div>

      {/* Filter Pills & Search */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              filterMode === "all"
                ? "bg-gradient-hero text-white shadow-card"
                : "bg-card text-muted-foreground border border-border"
            }`}
          >
            সব মেসেজ ({threads.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("unread")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
              filterMode === "unread"
                ? "bg-rose-600 text-white shadow-card"
                : "bg-card text-rose-700 border border-rose-200"
            }`}
          >
            উত্তর বাকি ({unreadTotal})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("replied")}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              filterMode === "replied"
                ? "bg-emerald-600 text-white shadow-card"
                : "bg-card text-emerald-800 border border-emerald-200"
            }`}
          >
            উত্তর দেওয়া হয়েছে ({Math.max(0, threads.length - unreadTotal)})
          </button>
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="গ্রাহকের নাম, ফোন বা মেসেজ খুঁজুন..."
            className="w-full rounded-full border border-border bg-card py-1.5 pl-8 pr-3 text-xs shadow-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-card/50 p-8 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
          <p className="mt-2 text-xs text-muted-foreground">চ্যাট মেসেজ লোড হচ্ছে...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          <MessageCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="font-semibold text-foreground">এই মুহূর্তে কোনো লাইভ চ্যাট মেসেজ নেই</p>
          <p className="mt-1 text-xs">
            গ্রাহকরা ফ্লোটিং লাইভ চ্যাটে মেসেজ পাঠালেই এখানে তাৎক্ষণিকভাবে দেখা যাবে এবং সরাসরি উত্তর দিতে পারবেন।
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const customerName =
              t.profile?.full_name || t.email?.split("@")[0] || `গ্রাহক #${t.user_id.slice(0, 6)}`;
            const isUnread = Number(t.staff_unread) > 0;
            const draft = inlineDrafts[t.id] || "";
            const isSending = sendingThreadId === t.id;

            return (
              <div
                key={t.id}
                className={`rounded-3xl border p-4 shadow-card transition ${
                  isUnread
                    ? "border-rose-300 bg-gradient-to-br from-rose-50/60 to-card"
                    : "border-border bg-card"
                }`}
              >
                {/* Customer Info & Open Chat / Delete Buttons */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${
                        isUnread
                          ? "bg-rose-600 text-white shadow-sm"
                          : "bg-emerald-500/15 text-emerald-700"
                      }`}
                    >
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-display text-sm font-bold text-primary-deep">
                          {customerName}
                        </p>
                        {isUnread ? (
                          <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                            {t.staff_unread} টি নতুন মেসেজ
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            ✓ উত্তর দেওয়া হয়েছে
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {t.profile?.phone ? `📞 ${t.profile.phone} • ` : ""}
                        {t.email || ""} •{" "}
                        {new Date(t.last_message_at).toLocaleString("bn-BD", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActive(t)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary-deep transition hover:bg-primary hover:text-white"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> সম্পূর্ণ চ্যাট ও ফাইল/ভয়েস ({isUnread ? "উত্তর দিন" : "খুলুন"})
                    </button>
                    {isMainAdmin && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteThread(t)}
                        className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-3 py-1.5 text-xs font-bold text-destructive transition hover:bg-destructive hover:text-white"
                        title="এই লাইভ চ্যাট ডিলিট করুন"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> ডিলিট
                      </button>
                    )}
                  </div>
                </div>

                {/* Latest Message Preview Bubble */}
                <div
                  onClick={() => setActive(t)}
                  className="mt-3 cursor-pointer rounded-2xl border border-border/80 bg-background/90 px-3.5 py-2.5 text-xs transition hover:border-primary/40"
                >
                  <span className="font-bold text-muted-foreground">সর্বশেষ বার্তা: </span>
                  <span className="font-medium text-foreground">
                    {t.last_message_preview || "কোনো টেক্সট নেই — ক্লিক করে চ্যাট খুলুন"}
                  </span>
                </div>

                {/* 1-Click Quick Reply Pills */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground">⚡ ১-ক্লিক উত্তর:</span>
                  {QUICK_STAFF_REPLIES.slice(0, 3).map((qr, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={isSending}
                      onClick={() => void sendQuickInlineReply(t, qr)}
                      className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-semibold text-primary-deep transition hover:bg-primary hover:text-white disabled:opacity-50"
                    >
                      {qr.length > 34 ? `${qr.slice(0, 34)}...` : qr}
                    </button>
                  ))}
                </div>

                {/* Direct Inline Reply Input Box */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sendQuickInlineReply(t);
                  }}
                  className="mt-2.5 flex items-center gap-2"
                >
                  <input
                    value={draft}
                    onChange={(e) =>
                      setInlineDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))
                    }
                    placeholder={`${customerName}-কে সরাসরি এখানেই উত্তর লিখুন...`}
                    className="min-w-0 flex-1 rounded-full border border-border bg-background px-3.5 py-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="submit"
                    disabled={isSending}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-hero px-4 py-2 text-xs font-bold text-primary-foreground shadow-card transition active:scale-95 disabled:opacity-60"
                  >
                    {isSending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    উত্তর পাঠান
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminChatPanel({
  thread,
  onBack,
  onDeleteThread,
  me,
}: {
  thread: ThreadView;
  onBack: () => void;
  onDeleteThread: () => void;
  me: string;
}) {
  const { items, send, remove } = useThreadMessages(thread.id);
  const { user, isMainAdmin, isAdmin, isEditor, isModerator } = useAuth();
  const { getStaffProfile, upsertStaffProfile } = useStaffProfiles();
  const { logo } = useLogo();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const myStaff = getStaffProfile(me) || getStaffProfile(user?.email);
  const myRoleLabel = isMainAdmin
    ? "সুপার এডমিন"
    : isAdmin
      ? "এডমিন"
      : isEditor
        ? "এডিটর"
        : isModerator
          ? "মোডারেটর"
          : "স্টাফ";
  const myName =
    myStaff?.full_name ||
    user?.displayName ||
    (isMainAdmin ? "মেইন সুপার এডমিন" : user?.email?.split("@")[0] || myRoleLabel);
  const myPhoto = myStaff?.photo_url || logo;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items.length]);

  useEffect(() => {
    void markThreadRead(thread.id, "staff");
  }, [thread.id, items.length]);

  async function syncResponderIdentity() {
    if (!me) return;
    try {
      await upsertStaffProfile({
        uid: me,
        email: user?.email || "",
        full_name: myName,
        role_label: myRoleLabel,
        photo_url: myStaff?.photo_url || "",
        phone: myStaff?.phone || user?.phone || "",
        designation: myStaff?.designation || myRoleLabel,
      });
    } catch {
      /* ignore */
    }
  }

  async function sendReplyMessage(bodyText: string, attachmentUrl?: string | null) {
    const clean = bodyText.trim();
    if (!clean && !attachmentUrl) return;
    void syncResponderIdentity();
    const { error } = await send(me, "staff", clean, attachmentUrl, {
      sender_name: myName,
      sender_photo: myPhoto,
      sender_role_label: myRoleLabel,
      user_name: thread.profile?.full_name || undefined,
      user_email: thread.email || undefined,
      user_phone: thread.profile?.phone || undefined,
    });
    if (error) toast.error(error.message);
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || !me) return;
    setText("");
    await sendReplyMessage(t);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !me) return;
    setBusy(true);
    const url = await uploadPublicImage(f, `chat/${thread.id}`);
    setBusy(false);
    if (!url) return toast.error("আপলোড ব্যর্থ");
    await sendReplyMessage("", url);
  }

  async function onVoice(blob: Blob) {
    if (!me) return;
    setBusy(true);
    const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
    const url = await uploadPublicImage(file, `chat/${thread.id}`);
    setBusy(false);
    if (!url) return toast.error("আপলোড ব্যর্থ");
    await sendReplyMessage("", url);
  }

  return (
    <div className="flex h-[75dvh] flex-col">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-card p-3 shadow-card">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold hover:bg-primary/10"
          >
            <ArrowLeft className="inline h-3.5 w-3.5" /> তালিকায় ফেরত
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-primary-deep">
              {thread.profile?.full_name || thread.email || "গ্রাহক"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {thread.profile?.phone ? `📞 ${thread.profile.phone} • ` : ""}
              {thread.email}
            </p>
          </div>
        </div>
        {/* Responder Identity Indicator + Super Admin Delete Thread Button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-primary/10 px-2.5 py-1">
            <img
              src={myPhoto}
              alt={myName}
              className="h-6 w-6 rounded-full border border-primary/30 bg-white object-cover"
            />
            <span className="text-[11px] font-bold text-primary-deep">
              উত্তরদাতা: {myName} ({myRoleLabel})
            </span>
          </div>
          {isMainAdmin && (
            <button
              type="button"
              onClick={onDeleteThread}
              className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-3 py-1.5 text-xs font-bold text-destructive transition hover:bg-destructive hover:text-white"
            >
              <Trash2 className="h-3.5 w-3.5" /> এই চ্যাট ডিলিট করুন
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto rounded-2xl border border-border bg-card/40 p-3">
        {items.length === 0 && (
          <p className="py-12 text-center text-xs text-muted-foreground">
            এখনো কোনো বার্তা নেই — নিচের যেকোনো রেডি বাটনে ক্লিক করে কথোপকথন শুরু করুন।
          </p>
        )}
        {items.map((m) => {
          const isStaffMsg = m.sender_role === "staff";
          const isMyMsg = m.sender_id === me;
          const staffSender = isStaffMsg ? getStaffProfile(m.sender_id) : null;

          // Staff Isolation: Super Admin sees exact responder name & photo for all staff;
          // Non-Super-Admin only sees their own name & photo, while other staff are masked as "সাপোর্ট টিম"
          const displaySenderName = !isStaffMsg
            ? m.sender_name || thread.profile?.full_name || "গ্রাহক"
            : isMyMsg
              ? `${myName} (আপনি)`
              : isMainAdmin
                ? `${m.sender_name || staffSender?.full_name || "স্টাফ"} (${
                    m.sender_role_label || staffSender?.role_label || "Staff"
                  })`
                : "সাপোর্ট টিম";

          const displayAvatar = !isStaffMsg
            ? null
            : isMyMsg
              ? myPhoto
              : isMainAdmin
                ? m.sender_photo || staffSender?.photo_url || logo
                : logo;

          return (
            <div
              key={m.id}
              className={`flex items-end gap-2 ${
                isStaffMsg ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                  isStaffMsg
                    ? "bg-gradient-hero text-primary-foreground"
                    : "border border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`text-[10px] font-bold ${
                      isStaffMsg ? "text-gold" : "text-primary"
                    }`}
                  >
                    {displaySenderName}
                  </p>
                  {isMainAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        void remove(m.id);
                        toast.success("মেসেজ মুছে ফেলা হয়েছে");
                      }}
                      className={`rounded p-0.5 transition ${
                        isStaffMsg
                          ? "text-white/70 hover:bg-white/20 hover:text-white"
                          : "text-destructive/70 hover:bg-destructive/15 hover:text-destructive"
                      }`}
                      title="এই মেসেজ ডিলিট করুন"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                {m.attachment_url && <AttachmentView url={m.attachment_url} />}
                <p
                  className={`mt-0.5 text-[9px] ${
                    isStaffMsg ? "opacity-75" : "text-muted-foreground"
                  }`}
                >
                  {new Date(m.created_at).toLocaleTimeString("bn-BD", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {isStaffMsg && displayAvatar && (
                <img
                  src={displayAvatar}
                  alt={displaySenderName}
                  className="h-7 w-7 shrink-0 rounded-full border border-gold bg-white object-cover shadow-sm"
                />
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* 1-Click Ready Reply Bar */}
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {QUICK_STAFF_REPLIES.map((qr, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => void sendReplyMessage(qr)}
            className="shrink-0 rounded-full border border-primary/25 bg-card px-3 py-1 text-[11px] font-semibold text-primary-deep shadow-sm transition hover:bg-primary hover:text-white"
          >
            ⚡ {qr}
          </button>
        ))}
      </div>

      <form onSubmit={onSend} className="mt-1.5 flex items-center gap-2">
        <label
          title="ছবি বা ফাইল পাঠান"
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-card text-primary shadow-card"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          <input
            type="file"
            accept="image/*,audio/*,application/pdf"
            className="hidden"
            onChange={onFile}
          />
        </label>
        <VoiceRecorderButton onRecorded={onVoice} disabled={busy} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`${myName} হিসেবে উত্তর লিখুন...`}
          className="min-w-0 flex-1 rounded-full border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-gradient-hero px-4 text-xs font-bold text-primary-foreground shadow-elevated"
        >
          <Send className="h-4 w-4" /> পাঠান
        </button>
      </form>
    </div>
  );
}

// ============================================================================
// Super Admin Exclusive: Staff Activity & Deletion Audit Panel
// ("এডমিন, এডিটর, মডারেটর কে কি কাজ করছে কি ডিলিট করলো সব সুপার এডমিন দেখতে পারবে")
// ============================================================================
function StaffActivityAuditPanel({
  auditHook,
}: {
  auditHook: ReturnType<typeof useStaffAuditLogs>;
}) {
  const { logs, loading, refresh } = auditHook;
  const { logo } = useLogo();
  const [roleFilter, setRoleFilter] = useState<
    "all" | "deletions_only" | "admin" | "editor" | "moderator" | "super_admin"
  >("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const totalActions = logs.length;
  const totalDeletions = logs.filter((l) => l.action_type === "delete").length;
  const totalApprovals = logs.filter((l) => l.action_type === "approve").length;
  const totalEdits = logs.filter((l) => l.action_type === "edit" || l.action_type === "create").length;

  // Group summary by staff member
  const staffSummary = Object.values(
    logs.reduce<
      Record<
        string,
        {
          key: string;
          name: string;
          email: string;
          role_bn: string;
          role: string;
          photo: string;
          total: number;
          deleted: number;
          approved: number;
          edited: number;
          replied: number;
        }
      >
    >((acc, l) => {
      const k = l.actor_email || l.actor_id || "staff";
      if (!acc[k]) {
        acc[k] = {
          key: k,
          name: l.actor_name || "স্টাফ",
          email: l.actor_email || "",
          role_bn: l.actor_role_bn || "স্টাফ",
          role: l.actor_role || "staff",
          photo: l.actor_photo || "",
          total: 0,
          deleted: 0,
          approved: 0,
          edited: 0,
          replied: 0,
        };
      }
      acc[k].total += 1;
      if (l.action_type === "delete") acc[k].deleted += 1;
      if (l.action_type === "approve") acc[k].approved += 1;
      if (l.action_type === "edit" || l.action_type === "create") acc[k].edited += 1;
      if (l.action_type === "reply") acc[k].replied += 1;
      return acc;
    }, {})
  );

  const filteredLogs = logs.filter((l) => {
    if (roleFilter === "deletions_only" && l.action_type !== "delete") return false;
    if (roleFilter === "admin" && l.actor_role !== "admin") return false;
    if (roleFilter === "editor" && l.actor_role !== "editor") return false;
    if (roleFilter === "moderator" && l.actor_role !== "moderator") return false;
    if (roleFilter === "super_admin" && l.actor_role !== "super_admin") return false;

    if (actionFilter !== "all" && l.action_type !== actionFilter) return false;
    if (moduleFilter !== "all" && l.module !== moduleFilter) return false;

    const q = (search || "").trim().toLowerCase();
    if (q) {
      const hay = [
        l.actor_name,
        l.actor_email,
        l.actor_role_bn,
        l.action_label,
        l.module_label,
        l.target_title,
        l.target_detail,
        l.deleted_snapshot ? JSON.stringify(l.deleted_snapshot) : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  async function handleRestore(entry: StaffActivityLogEntry) {
    setRestoringId(entry.id);
    try {
      const res = await restoreDeletedAuditItem(entry);
      if (!res.ok) {
        toast.error(res.error || "পুনরুদ্ধার করা যায়নি");
      } else {
        toast.success(`"${entry.target_title}" সফলভাবে ডাটাবেইজে পুনরুদ্ধার (Restore) করা হয়েছে!`);
        await refresh();
      }
    } finally {
      setRestoringId(null);
    }
  }

  function getActionBadgeStyle(type: StaffActivityLogEntry["action_type"]) {
    switch (type) {
      case "delete":
        return "bg-rose-600 text-white shadow-sm";
      case "approve":
        return "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30";
      case "reject":
        return "bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/30";
      case "edit":
        return "bg-blue-500/15 text-blue-800 ring-1 ring-blue-500/30";
      case "create":
        return "bg-teal-500/15 text-teal-800 ring-1 ring-teal-500/30";
      case "reply":
        return "bg-violet-500/15 text-violet-800 ring-1 ring-violet-500/30";
      default:
        return "bg-primary/15 text-primary-deep";
    }
  }

  function getRoleBadgeStyle(role: string) {
    if (role === "super_admin") return "bg-amber-500/20 text-amber-900 ring-1 ring-amber-500/40";
    if (role === "admin") return "bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-500/30";
    if (role === "editor") return "bg-blue-500/15 text-blue-800 ring-1 ring-blue-500/30";
    if (role === "moderator") return "bg-purple-500/15 text-purple-800 ring-1 ring-purple-500/30";
    return "bg-muted text-muted-foreground";
  }

  const SNAPSHOT_LABELS: Record<string, string> = {
    title: "শিরোনাম / নাম",
    full_name: "রক্তদাতার নাম",
    patient_name: "রোগীর নাম",
    sender_name: "অনুদানকারীর নাম",
    contact: "ফোন নম্বর",
    phone: "ফোন নম্বর",
    sender_phone: "প্রেরকের ফোন",
    category_slug: "ক্যাটাগরি",
    blood_group: "রক্তের গ্রুপ",
    address: "ঠিকানা",
    hospital: "হাসপাতাল",
    designation: "পদবি / পরিচয়",
    body: "বিস্তারিত / মেসেজ",
    message: "বার্তা",
    note: "নোট",
    amount: "টাকার পরিমাণ",
    trx_id: "TrxID",
    method: "মাধ্যম",
    event_date: "রক্তদানের তারিখ",
    place: "স্থান",
    status: "স্ট্যাটাস",
    email: "ইমেইল",
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="rounded-3xl border border-primary/25 bg-gradient-card p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-hero text-white shadow-card">
                <Activity className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-primary-deep">
                  এডমিন, এডিটর ও মডারেটর অ্যাক্টিভিটি এবং ডিলিট অডিট লগ
                </h2>
                <p className="text-xs text-muted-foreground">
                  কে কখন কোন তথ্য অনুমোদন, এডিট, চ্যাট বা ডিলিট করেছে তার সম্পূর্ণ বিস্তারিত ও ডিলিট হওয়া তথ্য পুনরুদ্ধার প্যানেল
                </p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary-deep transition hover:bg-primary/20"
          >
            <RefreshCcw className="h-3.5 w-3.5" /> লাইভ রিফ্রেশ
          </button>
        </div>

        {/* Summary KPI Grid */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border">
            <p className="text-[11px] text-muted-foreground">মোট স্টাফ অ্যাক্টিভিটি</p>
            <p className="mt-0.5 font-display text-xl font-bold text-primary-deep">
              {totalActions}
            </p>
          </div>
          <div className="rounded-2xl bg-rose-500/10 p-3 shadow-sm ring-1 ring-rose-500/30">
            <p className="text-[11px] font-semibold text-rose-700">🗑️ মোট ডিলিট করা তথ্য</p>
            <p className="mt-0.5 font-display text-xl font-bold text-rose-700">
              {totalDeletions}
            </p>
          </div>
          <div className="rounded-2xl bg-emerald-500/10 p-3 shadow-sm ring-1 ring-emerald-500/30">
            <p className="text-[11px] font-semibold text-emerald-800">✓ মোট অনুমোদন (Approve)</p>
            <p className="mt-0.5 font-display text-xl font-bold text-emerald-700">
              {totalApprovals}
            </p>
          </div>
          <div className="rounded-2xl bg-blue-500/10 p-3 shadow-sm ring-1 ring-blue-500/30">
            <p className="text-[11px] font-semibold text-blue-800">✏️ এডিট ও নতুন যোগ</p>
            <p className="mt-0.5 font-display text-xl font-bold text-blue-700">
              {totalEdits}
            </p>
          </div>
        </div>
      </div>

      {/* Staff Member Wise Breakdown */}
      {staffSummary.length > 0 && (
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <p className="mb-2.5 font-display text-xs font-bold text-primary-deep">
            👥 স্টাফ সদস্যভিত্তিক কাজের সারসংক্ষেপ (কে কতটি কাজ ও ডিলিট করেছে)
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {staffSummary.map((st) => (
              <div
                key={st.key}
                onClick={() => setSearch(st.email || st.name)}
                className="flex cursor-pointer items-center justify-between gap-2.5 rounded-2xl border border-border bg-muted/30 p-3 transition hover:border-primary"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <img
                    src={st.photo || logo}
                    alt={st.name}
                    className="h-10 w-10 shrink-0 rounded-full border border-primary/30 bg-white object-cover"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1">
                      <p className="truncate text-xs font-bold text-foreground">{st.name}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${getRoleBadgeStyle(
                          st.role
                        )}`}
                      >
                        {st.role_bn}
                      </span>
                    </div>
                    <p className="truncate text-[10px] text-muted-foreground">{st.email}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary-deep">
                    মোট: {st.total}
                  </span>
                  {st.deleted > 0 && (
                    <span className="rounded-full bg-rose-600 px-2 py-0.5 text-white">
                      ডিলিট: {st.deleted}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Role & Action Filter Bar */}
      <div className="space-y-3 rounded-2xl bg-card p-4 shadow-card">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setRoleFilter("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              roleFilter === "all"
                ? "bg-gradient-hero text-white shadow-card"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            সব রোল ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter("deletions_only")}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              roleFilter === "deletions_only"
                ? "bg-rose-600 text-white shadow-card"
                : "bg-rose-500/10 text-rose-700 hover:bg-rose-500/20"
            }`}
          >
            🗑️ শুধু ডিলিট লগ ({totalDeletions})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter("admin")}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              roleFilter === "admin"
                ? "bg-gradient-hero text-white shadow-card"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            এডমিন (Admin)
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter("editor")}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              roleFilter === "editor"
                ? "bg-gradient-hero text-white shadow-card"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            এডিটর (Editor)
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter("moderator")}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              roleFilter === "moderator"
                ? "bg-gradient-hero text-white shadow-card"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            মোডারেটর (Moderator)
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter("super_admin")}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              roleFilter === "super_admin"
                ? "bg-gradient-hero text-white shadow-card"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            সুপার এডমিন
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
          >
            <option value="all">সব কাজের ধরন (All Actions)</option>
            <option value="delete">🗑️ ডিলিট করা তথ্য (Deleted)</option>
            <option value="approve">✓ অনুমোদন (Approved)</option>
            <option value="reject">✕ বাতিল (Rejected)</option>
            <option value="edit">✏️ সম্পাদনা (Edited)</option>
            <option value="create">➕ নতুন যোগ (Created)</option>
            <option value="reply">💬 লাইভ চ্যাট উত্তর (Chat Reply)</option>
            <option value="user">👤 ইউজার/রোল পরিবর্তন</option>
          </select>

          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold"
          >
            <option value="all">সব সেকশন (All Sections)</option>
            <option value="info">তথ্য ডিরেক্টরি</option>
            <option value="donors">রক্তদাতা</option>
            <option value="events">রক্তদান লগ</option>
            <option value="emergency">জরুরী রক্ত অনুরোধ</option>
            <option value="banners">জরুরী ব্যানার</option>
            <option value="chat">লাইভ চ্যাট</option>
            <option value="donation">অনুদান</option>
            <option value="users">ইউজার ম্যানেজমেন্ট</option>
            <option value="profile">প্রোফাইল</option>
          </select>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="স্টাফের নাম, ইমেইল বা ডিলিট তথ্য খুঁজুন..."
              className="w-full rounded-xl border border-border bg-background py-2 pl-8 pr-3 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Activity & Deletion Cards List */}
      {loading && filteredLogs.length === 0 ? (
        <div className="flex justify-center p-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
          এই ফিল্টারে কোনো স্টাফ অ্যাক্টিভিটি বা ডিলিট লগ পাওয়া যায়নি।
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const isDelete = log.action_type === "delete";
            const snapEntries = log.deleted_snapshot
              ? Object.entries(log.deleted_snapshot).filter(
                  ([k, v]) =>
                    v !== null &&
                    v !== undefined &&
                    v !== "" &&
                    k !== "id" &&
                    k !== "author_id" &&
                    k !== "created_at" &&
                    k !== "updated_at"
                )
              : [];

            return (
              <div
                key={log.id}
                className={`rounded-2xl bg-card p-4 shadow-card transition ${
                  isDelete
                    ? "border-2 border-rose-500/35 bg-gradient-to-br from-rose-500/[0.03] to-card"
                    : "border border-border"
                }`}
              >
                {/* Actor & Timestamp Header */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={log.actor_photo || logo}
                      alt={log.actor_name}
                      className="h-11 w-11 shrink-0 rounded-full border-2 border-primary/30 bg-white object-cover shadow-sm"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-display text-sm font-bold text-foreground">
                          {log.actor_name}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${getRoleBadgeStyle(
                            log.actor_role
                          )}`}
                        >
                          {log.actor_role_bn}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${getActionBadgeStyle(
                            log.action_type
                          )}`}
                        >
                          {log.action_label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        ইমেইল: <span className="font-mono">{log.actor_email}</span> • সেকশন:{" "}
                        <strong className="text-primary-deep">{log.module_label}</strong>
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                    🕒 {new Date(log.created_at).toLocaleString("bn-BD")}
                  </span>
                </div>

                {/* Target Item Details */}
                <div className="mt-3 rounded-xl bg-muted/40 p-3">
                  <p className="text-xs font-bold text-primary-deep">
                    {isDelete ? "🗑️ যে তথ্যটি ডিলিট করা হয়েছে:" : "📌 কাজের বিবরণ:"}{" "}
                    <span className={isDelete ? "text-rose-700" : "text-foreground"}>
                      {log.target_title}
                    </span>
                  </p>
                  {log.target_detail && (
                    <p className="mt-1 text-xs text-muted-foreground">{log.target_detail}</p>
                  )}
                </div>

                {/* Full Deleted Item Snapshot + 1-Click Restore */}
                {isDelete && snapEntries.length > 0 && (
                  <div className="mt-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-bold text-rose-800">
                        🔍 ডিলিট হওয়া তথ্যের সম্পূর্ণ রেকর্ড (Deleted Data Snapshot):
                      </p>
                      {log.collection_name && (
                        <div>
                          {log.restored ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> পুনরুদ্ধার করা হয়েছে
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={restoringId === log.id}
                              onClick={() => void handleRestore(log)}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {restoringId === log.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3 w-3" />
                              )}
                              ডিলিট হওয়া তথ্য পুনরুদ্ধার করুন (Restore)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
                      {snapEntries.map(([k, v]) => (
                        <div
                          key={k}
                          className="rounded-lg bg-white/80 px-2.5 py-1.5 shadow-2xs"
                        >
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {SNAPSHOT_LABELS[k] || k}:{" "}
                          </span>
                          <span className="font-semibold text-foreground break-words">
                            {String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

