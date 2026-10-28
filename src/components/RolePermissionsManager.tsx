import { useState, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  Save,
  RotateCcw,
  Check,
  X,
  AlertCircle,
  Lock,
  UserCheck,
  UserX,
  Sparkles,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth, type Role } from "@/lib/auth";
import {
  useRolePermissions,
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  type PermissionKey,
} from "@/lib/permissions";
import { SUPER_ADMIN_EMAIL, isSuperAdminEmail } from "@/lib/firebase";
import { listUsers, setUserRole, isProtectedMainSuperAdmin, type AdminUserRecord } from "@/lib/admin-client";

export function RolePermissionsManager() {
  const { user, isMainAdmin } = useAuth();
  const {
    rolePermissions,
    saveRolePermissions,
    resetToDefaults,
    saving: savingPerms,
    allPermissionDefs,
  } = useRolePermissions();

  const [activeTab, setActiveTab] = useState<"roles" | "staff">("roles");
  const [selectedRole, setSelectedRole] = useState<Role>("editor");
  const [roleDrafts, setRoleDrafts] = useState<Record<Role, PermissionKey[]>>(rolePermissions);
  const [staffUsers, setStaffUsers] = useState<AdminUserRecord[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [updatingUserRole, setUpdatingUserRole] = useState<string | null>(null);

  // Sync draft when server permissions update
  useEffect(() => {
    setRoleDrafts(rolePermissions);
  }, [rolePermissions]);

  // Load staff users
  const fetchStaff = async () => {
    setLoadingStaff(true);
    try {
      const all = await listUsers();
      const staffOnly = all.filter(
        (u) =>
          isProtectedMainSuperAdmin({ id: u.id, email: u.email, username: u.profile?.username }) ||
          (u.roles &&
            u.roles.some((r: string) => r === "admin" || r === "editor" || r === "moderator"))
      );
      setStaffUsers(staffOnly);
    } catch {
      // ignore
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    if (activeTab === "staff") {
      void fetchStaff();
    }
  }, [activeTab]);

  const togglePermissionForRole = (role: Role, key: PermissionKey) => {
    if (!isMainAdmin) {
      toast.error("শুধুমাত্র প্রধান এডমিন পারমিশন পরিবর্তন করতে পারেন");
      return;
    }
    if (key === "manage_roles_permissions") {
      toast.error("রোল ও পারমিশন কন্ট্রোল শুধুমাত্র প্রধান এডমিনের জন্য সংরক্ষিত");
      return;
    }

    const current = roleDrafts[role] || [];
    const exists = current.includes(key);
    const updated = exists ? current.filter((k) => k !== key) : [...current, key];
    setRoleDrafts((prev) => ({
      ...prev,
      [role]: updated,
    }));
  };

  const handleSaveAllRolePerms = async () => {
    if (!isMainAdmin) {
      toast.error("অনুমতি নেই: শুধুমাত্র প্রধান এডমিন পারমিশন পরিবর্তন করতে পারেন।");
      return;
    }

    try {
      await saveRolePermissions(roleDrafts);
      toast.success("সকল রোলের পারমিশন ফায়ারবেসে সফলভাবে সংরক্ষিত হয়েছে!");
    } catch (e) {
      toast.error((e as Error).message || "সংরক্ষণ ব্যর্থ হয়েছে");
    }
  };

  const handleResetDefaults = async () => {
    if (!isMainAdmin) return;
    try {
      await resetToDefaults();
      setRoleDrafts(DEFAULT_ROLE_PERMISSIONS);
      toast.success("ডিফল্ট পারমিশনে রিসেট সম্পন্ন হয়েছে");
    } catch (e) {
      toast.error((e as Error).message || "রিসেট ব্যর্থ হয়েছে");
    }
  };

  const handleRoleChangeForStaff = async (staff: AdminUserRecord, newRole: Role) => {
    if (!isMainAdmin) {
      toast.error("শুধুমাত্র প্রধান এডমিন স্টাফদের রোল পরিবর্তন করতে পারেন");
      return;
    }
    if (isProtectedMainSuperAdmin({ id: staff.id, email: staff.email, username: staff.profile?.username })) {
      toast.error("প্রধান এডমিনের রোল পরিবর্তন বা সরানো সম্ভব নয়");
      return;
    }

    setUpdatingUserRole(staff.id);
    try {
      await setUserRole({
        data: {
          user_id: staff.id,
          role: newRole,
          enable: true,
        },
      });
      toast.success(`${staff.profile?.full_name || staff.profile?.username || "স্টাফ"}-এর রোল "${newRole}" করা হয়েছে`);
      await fetchStaff();
    } catch (e) {
      toast.error((e as Error).message || "রোল পরিবর্তন করা যায়নি");
    } finally {
      setUpdatingUserRole(null);
    }
  };

  const rolesList: { role: Role; label: string; desc: string; tone: string }[] = [
    {
      role: "admin",
      label: "জেনারেল এডমিন (General Admin)",
      desc: "দৈনন্দিন প্রশাসন, ব্যবহারকারী ও ওয়েবসাইট সামগ্রিক ব্যবস্থাপনা",
      tone: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    },
    {
      role: "editor",
      label: "এডিটর (Editor)",
      desc: "ক্যাটাগরি, ডিরেক্টরি তথ্য, ডাক্তার ও রক্তদাতা কন্টেন্ট নিয়ন্ত্রণ",
      tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    },
    {
      role: "moderator",
      label: "মোডারেটর (Moderator)",
      desc: "জরুরী রক্তের আবেদন ও নাগরিক সাবমিশন যাচাই-বাছাই ও অনুমোদন",
      tone: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-display text-base sm:text-lg font-bold text-foreground">
                ডায়নামিক রোল ও পারমিশন কন্ট্রোল
              </h2>
              <p className="text-xs text-muted-foreground">
                জেনারেল এডমিন, এডিটর ও মোডারেটরদের জন্য গ্র্যানুলার অ্যাক্সেস নিয়ন্ত্রণ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-2xl bg-muted p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("roles")}
              className={`rounded-xl px-3 py-1.5 font-bold transition ${
                activeTab === "roles"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              রোল পারমিশন ম্যাট্রিক্স
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("staff")}
              className={`rounded-xl px-3 py-1.5 font-bold transition ${
                activeTab === "staff"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              স্টাফ অ্যাকাউন্টসমূহ
            </button>
          </div>
        </div>

        {/* Security Notification Banner */}
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800">
          <Lock className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <div className="space-y-0.5 leading-relaxed">
            <p className="font-bold">প্রধান সুপার অ্যাডমিন নিরাপত্তা গ্যারান্টি:</p>
            <p className="text-[11px] opacity-90">
              শুধুমাত্র অনুমোদিত প্রধান এডমিন এই পারমিশন পরিবর্তন করতে পারেন। সাধারণ এডমিন বা এডিটররা
              কখনোই প্রধান এডমিনের অধিকার পরিবর্তন বা নিজেদের ক্ষমতা বৃদ্ধি করতে পারবে না।
            </p>
          </div>
        </div>
      </div>

      {activeTab === "roles" ? (
        <div className="space-y-4">
          {/* Role Selector Cards */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {rolesList.map(({ role, label, desc, tone }) => {
              const count = (roleDrafts[role] || []).length;
              const isSelected = selectedRole === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  className={`flex flex-col items-start rounded-2xl border p-3.5 text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-card ring-2 ring-primary/20"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="font-display text-xs font-bold text-foreground">
                      {label}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold border ${tone}`}
                    >
                      {count} টি পারমিশন
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-2">{desc}</p>
                </button>
              );
            })}
          </div>

          {/* Permissions Matrix for Selected Role */}
          <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-card">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-foreground">
                  "{selectedRole === "admin" ? "জেনারেল এডমিন" : selectedRole === "editor" ? "এডিটর" : "মোডারেটর"}"-এর জন্য প্রযোজ্য পারমিশনসমূহ
                </h3>
                <p className="text-xs text-muted-foreground">
                  চেকবক্স সিলেক্ট বা আনসিলেক্ট করে এই রোলের জন্য নির্দিষ্ট পারমিশন সক্রিয় করুন
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  disabled={savingPerms || !isMainAdmin}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> ডিফল্ট
                </button>
                <button
                  type="button"
                  onClick={handleSaveAllRolePerms}
                  disabled={savingPerms || !isMainAdmin}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingPerms ? "সংরক্ষণ হচ্ছে..." : "ফায়ারবেসে সেভ করুন"}
                </button>
              </div>
            </div>

            {/* Granular Permission Toggles */}
            <div className="space-y-2.5">
              {allPermissionDefs.map((def) => {
                const isChecked = (roleDrafts[selectedRole] || []).includes(def.key);
                const isMainOnly = def.mainAdminOnly;

                return (
                  <div
                    key={def.key}
                    onClick={() => {
                      if (!isMainOnly && isMainAdmin) {
                        togglePermissionForRole(selectedRole, def.key);
                      }
                    }}
                    className={`flex items-start justify-between gap-3 rounded-2xl border p-3 transition-colors ${
                      isMainOnly
                        ? "border-muted bg-muted/30 opacity-60 cursor-not-allowed"
                        : isChecked
                        ? "border-primary/40 bg-primary/5 cursor-pointer"
                        : "border-border bg-card/60 hover:bg-muted/40 cursor-pointer"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-xs sm:text-sm font-bold text-foreground">
                          {def.labelBn}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          ({def.labelEn})
                        </span>
                        {isMainOnly && (
                          <span className="rounded-full bg-rose-500/10 text-rose-700 px-2 py-0.5 text-[9px] font-extrabold border border-rose-500/20">
                            মেইন এডমিন সংরক্ষিত
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                        {def.description}
                      </p>
                    </div>

                    <div className="shrink-0 pt-0.5">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-lg border transition ${
                          isMainOnly
                            ? "border-border bg-muted text-muted-foreground"
                            : isChecked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card"
                        }`}
                      >
                        {isChecked && <Check className="h-4 w-4 stroke-[3]" />}
                        {isMainOnly && <Lock className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Staff Users Management */
        <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-display text-sm font-bold text-foreground">
                অনুমোদিত স্টাফ ও এডমিন অ্যাকাউন্ট তালিকা
              </h3>
              <p className="text-xs text-muted-foreground">
                প্রতিটি স্টাফ অ্যাকাউন্টের দায়িত্ব নির্ধারণ করুন এবং অ্যাক্সেস পরিচালনা করুন
              </p>
            </div>
            <button
              type="button"
              onClick={fetchStaff}
              disabled={loadingStaff}
              className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${loadingStaff ? "animate-spin" : ""}`} /> রিফ্রেশ
            </button>
          </div>

          {loadingStaff ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              স্টাফ অ্যাকাউন্টসমূহ লোড হচ্ছে...
            </div>
          ) : staffUsers.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              কোনো বিশেষ স্টাফ অ্যাকাউন্ট পাওয়া যায়নি।
            </div>
          ) : (
            <div className="space-y-3">
              {staffUsers.map((staff) => {
                const isSuper = isProtectedMainSuperAdmin({ id: staff.id, email: staff.email, username: staff.profile?.username });
                const primaryRole: Role = isSuper
                  ? "admin"
                  : (staff.roles?.find((r: string) => r === "admin" || r === "editor" || r === "moderator") as Role) || "user";

                return (
                  <div
                    key={staff.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-xs sm:text-sm font-bold text-foreground">
                          {staff.profile?.full_name || staff.profile?.username || "স্টাফ ব্যবহারকারী"}
                        </span>
                        {isSuper && (
                          <span className="rounded-full bg-amber-500/15 text-amber-700 px-2 py-0.5 text-[9px] font-bold border border-amber-500/30">
                            প্রধান সুপার এডমিন
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-muted-foreground break-all mt-0.5">
                        {staff.email} • ফোন: {staff.profile?.phone || "তথ্য নেই"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isSuper ? (
                        <span className="text-xs font-bold text-amber-700 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/30">
                          সর্বোচ্চ অধিকার সংরক্ষিত
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <label className="text-[11px] text-muted-foreground">রোল:</label>
                          <select
                            value={primaryRole}
                            disabled={updatingUserRole === staff.id || !isMainAdmin}
                            onChange={(e) =>
                              handleRoleChangeForStaff(staff, e.target.value as Role)
                            }
                            className="rounded-xl border border-border bg-card px-2.5 py-1 text-xs font-bold text-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                          >
                            <option value="admin">জেনারেল এডমিন</option>
                            <option value="editor">এডিটর</option>
                            <option value="moderator">মোডারেটর</option>
                            <option value="user">সাধারণ ব্যবহারকারী (অ্যাক্সেস প্রত্যাহার)</option>
                          </select>
                        </div>
                      )}
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
