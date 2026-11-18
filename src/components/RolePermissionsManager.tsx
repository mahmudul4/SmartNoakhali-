import { useState, useEffect, useMemo } from "react";
import {
  ShieldCheck,
  Save,
  RotateCcw,
  Check,
  Lock,
  Plus,
  Copy,
  Trash2,
  Edit3,
  Power,
  X,
  AlertTriangle,
  CheckSquare,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth, type Role } from "@/lib/auth";
import {
  useRolePermissions,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_CATEGORY_LABELS,
  resolveUserRoleDisplay,
  type CustomRoleDefinition,
  type PermissionCategory,
  type PermissionKey,
} from "@/lib/permissions";
import {
  listUsers,
  setUserRole,
  setUserCustomRole,
  isProtectedMainSuperAdmin,
  type AdminUserRecord,
} from "@/lib/admin-client";
import { recordSuperAdminAudit } from "@/lib/staff-audit";

const ROLE_COLOR_SWATCHES = [
  "#059669",
  "#0284c7",
  "#7c3aed",
  "#b45309",
  "#dc2626",
  "#0f766e",
  "#4f46e5",
];

const CATEGORY_ORDER: PermissionCategory[] = [
  "dashboard",
  "homepage",
  "content",
  "moderation",
  "chat",
  "ai",
  "notifications",
  "users",
  "settings",
  "security",
];

export function RolePermissionsManager() {
  const { isMainAdmin } = useAuth();
  const {
    rolePermissions,
    customRoles,
    saveRolePermissions,
    createCustomRole,
    updateCustomRole,
    duplicateCustomRole,
    deleteCustomRole,
    resetToDefaults,
    saving: savingPerms,
    allPermissionDefs,
  } = useRolePermissions();

  const [activeTab, setActiveTab] = useState<"roles" | "custom" | "operators">("roles");
  const [selectedRole, setSelectedRole] = useState<Role>("admin");
  const [roleDrafts, setRoleDrafts] = useState<Record<Role, PermissionKey[]>>(rolePermissions);

  // Custom role editing state
  const [selectedCustomId, setSelectedCustomId] = useState<string>(
    () => customRoles[0]?.id || ""
  );
  const [customDraft, setCustomDraft] = useState<CustomRoleDefinition | null>(
    () => customRoles[0] || null
  );
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState({
    name: "",
    nameEn: "",
    description: "",
    color: "#059669",
  });
  const [confirmDeleteRole, setConfirmDeleteRole] = useState<{
    role: CustomRoleDefinition;
    assignedCount: number;
  } | null>(null);
  const [confirmResetModal, setConfirmResetModal] = useState(false);

  // Operator & Admin account assignment state
  const [allUsers, setAllUsers] = useState<AdminUserRecord[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  useEffect(() => {
    setRoleDrafts(rolePermissions);
  }, [rolePermissions]);

  useEffect(() => {
    const found = customRoles.find((r) => r.id === selectedCustomId) || customRoles[0] || null;
    if (found) {
      setSelectedCustomId(found.id);
      setCustomDraft(found);
    } else {
      setCustomDraft(null);
    }
  }, [customRoles, selectedCustomId]);

  const fetchStaff = async () => {
    setLoadingStaff(true);
    try {
      const all = await listUsers();
      setAllUsers(all);
    } catch {
      // ignore
    } finally {
      setLoadingStaff(false);
    }
  };

  useEffect(() => {
    void fetchStaff();
  }, [activeTab]);

  const staffUsers = useMemo(
    () =>
      allUsers.filter(
        (u) =>
          isProtectedMainSuperAdmin({ id: u.id, email: u.email, username: u.profile?.username }) ||
          Boolean(u.custom_role_id) ||
          (u.roles &&
            u.roles.some((r: string) => r === "admin" || r === "editor" || r === "moderator"))
      ),
    [allUsers]
  );

  const customRoleAssignmentCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of allUsers) {
      if (u.custom_role_id) {
        counts[u.custom_role_id] = (counts[u.custom_role_id] || 0) + 1;
      }
      for (const r of u.roles || []) {
        if (r.startsWith("custom_")) {
          counts[r] = (counts[r] || 0) + 1;
        }
      }
    }
    return counts;
  }, [allUsers]);

  const groupedPermissions = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => ({
      category: cat,
      label: PERMISSION_CATEGORY_LABELS[cat],
      items: allPermissionDefs.filter((p) => p.category === cat),
    })).filter((g) => g.items.length > 0);
  }, [allPermissionDefs]);

  const togglePermissionForSystemRole = (role: Role, key: PermissionKey) => {
    if (!isMainAdmin) {
      toast.error("শুধুমাত্র প্রধান সুপার অ্যাডমিন পারমিশন পরিবর্তন করতে পারেন");
      return;
    }
    const def = allPermissionDefs.find((d) => d.key === key);
    if (def?.mainAdminOnly) {
      toast.error("এই পারমিশনটি শুধুমাত্র প্রধান সুপার অ্যাডমিনের জন্য সংরক্ষিত");
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

  const toggleCategoryForList = (
    currentList: PermissionKey[],
    category: PermissionCategory,
    onUpdate: (next: PermissionKey[]) => void
  ) => {
    if (!isMainAdmin) return;
    const catKeys = allPermissionDefs
      .filter((d) => d.category === category && !d.mainAdminOnly)
      .map((d) => d.key);
    if (catKeys.length === 0) return;
    const allSelected = catKeys.every((k) => currentList.includes(k));
    if (allSelected) {
      onUpdate(currentList.filter((k) => !catKeys.includes(k)));
    } else {
      onUpdate(Array.from(new Set([...currentList, ...catKeys])));
    }
  };

  const handleSaveAllRolePerms = async () => {
    if (!isMainAdmin) {
      toast.error("অনুমতি নেই: শুধুমাত্র প্রধান সুপার অ্যাডমিন পারমিশন পরিবর্তন করতে পারেন।");
      return;
    }
    try {
      await saveRolePermissions(roleDrafts);
      void recordSuperAdminAudit({
        action: "role_change",
        module: "roles",
        target_id: selectedRole,
        target_label: selectedRole,
        summary: `সিস্টেম রোল পারমিশন ম্যাট্রিক্স আপডেট করা হয়েছে (${selectedRole})`,
      });
      toast.success("সকল সিস্টেম রোলের পারমিশন ফায়ারবেসে সফলভাবে সংরক্ষিত হয়েছে!");
    } catch (e) {
      toast.error((e as Error).message || "সংরক্ষণ ব্যর্থ হয়েছে");
    }
  };

  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMainAdmin) return;
    try {
      const created = await createCustomRole({
        name: newRoleForm.name,
        nameEn: newRoleForm.nameEn,
        description: newRoleForm.description,
        color: newRoleForm.color,
        permissions: ["view_dashboard"],
        active: true,
      });
      setSelectedCustomId(created.id);
      setCustomDraft(created);
      setShowCreateModal(false);
      setNewRoleForm({ name: "", nameEn: "", description: "", color: "#059669" });
      void recordSuperAdminAudit({
        action: "create",
        module: "roles",
        target_id: created.id,
        target_label: created.name,
        summary: `নতুন কাস্টম অ্যাডমিন রোল তৈরি: ${created.name}`,
      });
      toast.success(`"${created.name}" রোল সফলভাবে তৈরি হয়েছে! এখন পারমিশন নির্বাচন করুন।`);
    } catch (err: any) {
      toast.error(err?.message || "রোল তৈরি করা যায়নি");
    }
  };

  const handleSaveCustomRoleDraft = async () => {
    if (!isMainAdmin || !customDraft) return;
    try {
      await updateCustomRole(customDraft.id, {
        name: customDraft.name,
        nameEn: customDraft.nameEn,
        description: customDraft.description,
        color: customDraft.color,
        permissions: customDraft.permissions,
        active: customDraft.active,
      });
      void recordSuperAdminAudit({
        action: "update",
        module: "roles",
        target_id: customDraft.id,
        target_label: customDraft.name,
        summary: `কাস্টম রোল "${customDraft.name}"-এর পারমিশন (${customDraft.permissions.length}টি) আপডেট`,
      });
      toast.success(`"${customDraft.name}" সফলভাবে সংরক্ষিত হয়েছে!`);
    } catch (err: any) {
      toast.error(err?.message || "কাস্টম রোল সেভ করা যায়নি");
    }
  };

  const handleDuplicateCustom = async (r: CustomRoleDefinition) => {
    if (!isMainAdmin) return;
    try {
      const copied = await duplicateCustomRole(r.id);
      setSelectedCustomId(copied.id);
      setCustomDraft(copied);
      toast.success(`"${copied.name}" তৈরি হয়েছে`);
    } catch (err: any) {
      toast.error(err?.message || "ডুপ্লিকেট করা যায়নি");
    }
  };

  const handleDeleteCustomConfirm = async () => {
    if (!confirmDeleteRole) return;
    const { role, assignedCount } = confirmDeleteRole;
    setConfirmDeleteRole(null);
    try {
      await deleteCustomRole(role.id, assignedCount);
      void recordSuperAdminAudit({
        action: "delete",
        module: "roles",
        target_id: role.id,
        target_label: role.name,
        summary: `কাস্টম রোল মুছে ফেলা হয়েছে: ${role.name}`,
      });
      toast.success(`"${role.name}" মুছে ফেলা হয়েছে`);
    } catch (err: any) {
      toast.error(err?.message || "মুছে ফেলা যায়নি");
    }
  };

  const handleExecuteResetDefaults = async () => {
    setConfirmResetModal(false);
    if (!isMainAdmin) return;
    try {
      await resetToDefaults();
      setRoleDrafts(DEFAULT_ROLE_PERMISSIONS);
      toast.success("ডিফল্ট পারমিশন ও কাস্টম রোল রিসেট সম্পন্ন হয়েছে");
    } catch (e) {
      toast.error((e as Error).message || "রিসেট ব্যর্থ হয়েছে");
    }
  };

  const handleSystemRoleChangeForUser = async (staff: AdminUserRecord, newRole: Role) => {
    if (!isMainAdmin) {
      return toast.error("শুধুমাত্র প্রধান সুপার অ্যাডমিন রোল পরিবর্তন করতে পারেন");
    }
    if (isProtectedMainSuperAdmin({ id: staff.id, email: staff.email, username: staff.profile?.username })) {
      return toast.error("প্রধান সুপার অ্যাডমিনের রোল পরিবর্তন বা সরানো সম্ভব নয়");
    }

    setUpdatingUserId(staff.id);
    try {
      await setUserRole({
        data: {
          user_id: staff.id,
          role: newRole,
          enable: true,
        },
      });
      void recordSuperAdminAudit({
        action: "role_change",
        module: "users",
        target_id: staff.id,
        target_label: staff.email,
        summary: `${staff.email}-এর সিস্টেম রোল "${newRole}" করা হয়েছে`,
      });
      toast.success(`${staff.profile?.full_name || staff.email}-এর রোল আপডেট হয়েছে`);
      await fetchStaff();
    } catch (e) {
      toast.error((e as Error).message || "রোল পরিবর্তন করা যায়নি");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleCustomRoleAssignment = async (staff: AdminUserRecord, customRoleId: string) => {
    if (!isMainAdmin) {
      return toast.error("শুধুমাত্র প্রধান সুপার অ্যাডমিন কাস্টম রোল প্রদান করতে পারেন");
    }
    if (isProtectedMainSuperAdmin({ id: staff.id, email: staff.email, username: staff.profile?.username })) {
      return toast.error("প্রধান সুপার অ্যাডমিন অপরিবর্তনীয়");
    }
    const targetCustom = customRoles.find((c) => c.id === customRoleId) || null;
    setUpdatingUserId(staff.id);
    try {
      await setUserCustomRole({
        user_id: staff.id,
        email: staff.email,
        custom_role_id: targetCustom ? targetCustom.id : null,
        custom_role_name: targetCustom ? targetCustom.name : null,
      });
      void recordSuperAdminAudit({
        action: "role_change",
        module: "users",
        target_id: staff.id,
        target_label: staff.email,
        summary: targetCustom
          ? `${staff.email}-কে কাস্টম রোল "${targetCustom.name}" প্রদান করা হয়েছে`
          : `${staff.email}-এর কাস্টম রোল সরানো হয়েছে`,
      });
      toast.success(
        targetCustom
          ? `${staff.profile?.full_name || staff.email}-কে "${targetCustom.name}" রোল দেওয়া হয়েছে`
          : "কাস্টম রোল সরানো হয়েছে"
      );
      await fetchStaff();
    } catch (err: any) {
      toast.error(err?.message || "কাস্টম রোল সেভ করা যায়নি");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const rolesList: { role: Role; label: string; desc: string; tone: string }[] = [
    {
      role: "admin",
      label: "অ্যাডমিন (Admin)",
      desc: "দৈনন্দিন প্রশাসন, কন্টেন্ট, লাইভ চ্যাট ও ওয়েবসাইট পরিচালনা",
      tone: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    },
    {
      role: "editor",
      label: "এডিটর (Editor)",
      desc: "ক্যাটাগরি, ডিরেক্টরি তথ্য, ডাক্তার ও রক্তদাতা কন্টেন্ট নিয়ন্ত্রণ",
      tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    },
    {
      role: "moderator",
      label: "মোডারেটর (Moderator)",
      desc: "জরুরী রক্তের আবেদন, নাগরিক সাবমিশন ও লাইভ চ্যাট সহায়তা",
      tone: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    },
  ];

  const renderPermissionMatrix = (
    activeKeys: PermissionKey[],
    onToggleKey: (key: PermissionKey) => void,
    onToggleCategory: (cat: PermissionCategory) => void
  ) => (
    <div className="space-y-4">
      {groupedPermissions.map((group) => {
        const selectable = group.items.filter((i) => !i.mainAdminOnly);
        const allSelected =
          selectable.length > 0 && selectable.every((i) => activeKeys.includes(i.key));
        return (
          <div key={group.category} className="rounded-2xl border border-border/80 bg-background/50 p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
              <p className="font-display text-xs font-extrabold text-primary-deep">
                {group.label} ({group.items.filter((i) => activeKeys.includes(i.key)).length}/{group.items.length})
              </p>
              {selectable.length > 0 && isMainAdmin && (
                <button
                  type="button"
                  onClick={() => onToggleCategory(group.category)}
                  className="inline-flex items-center gap-1 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-1 text-[10.5px] font-bold text-primary-deep hover:bg-primary/15"
                >
                  {allSelected ? (
                    <>
                      <Square className="h-3 w-3" /> সব বাতিল
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-3 w-3" /> সব সিলেক্ট
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {group.items.map((def) => {
                const isChecked = activeKeys.includes(def.key);
                const isMainOnly = Boolean(def.mainAdminOnly);
                return (
                  <div
                    key={def.key}
                    onClick={() => {
                      if (!isMainOnly && isMainAdmin) onToggleKey(def.key);
                    }}
                    className={`flex items-start justify-between gap-2.5 rounded-xl border p-2.5 transition-colors ${
                      isMainOnly
                        ? "border-muted bg-muted/40 opacity-65 cursor-not-allowed"
                        : isChecked
                          ? "border-primary/45 bg-primary/5 cursor-pointer"
                          : "border-border bg-card hover:bg-muted/40 cursor-pointer"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-display text-xs font-bold text-foreground">
                          {def.labelBn}
                        </span>
                        {isMainOnly && (
                          <span className="rounded-full bg-rose-500/10 text-rose-700 px-1.5 py-0.5 text-[9px] font-extrabold border border-rose-500/20">
                            শুধুমাত্র সুপার অ্যাডমিন
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[10.5px] text-muted-foreground leading-snug">
                        {def.description}
                      </p>
                    </div>

                    <div
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                        isMainOnly
                          ? "border-border bg-muted text-muted-foreground"
                          : isChecked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card"
                      }`}
                    >
                      {isChecked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      {isMainOnly && <Lock className="h-3 w-3" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

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
                রোল, কাস্টম রোল ও গ্র্যানুলার পারমিশন কন্ট্রোল
              </h2>
              <p className="text-xs text-muted-foreground">
                সিস্টেম রোল, কাস্টম অ্যাডমিন রোল ও অপারেটর অ্যাকাউন্টের সুনির্দিষ্ট অধিকার নিয়ন্ত্রণ করুন
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-muted p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("roles")}
              className={`rounded-xl px-3 py-1.5 font-bold transition ${
                activeTab === "roles"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              সিস্টেম রোল
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("custom")}
              className={`rounded-xl px-3 py-1.5 font-bold transition ${
                activeTab === "custom"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              কাস্টম রোল ({customRoles.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("operators")}
              className={`rounded-xl px-3 py-1.5 font-bold transition ${
                activeTab === "operators"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              অপারেটর ও অ্যাডমিন ({staffUsers.length})
            </button>
          </div>
        </div>

        {/* Super Admin Immutability Notice */}
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900">
          <Lock className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
          <div className="space-y-0.5 leading-relaxed">
            <p className="font-bold">প্রধান সুপার অ্যাডমিন সুরক্ষা:</p>
            <p className="text-[11px] opacity-90">
              শুধুমাত্র প্রধান সুপার অ্যাডমিন রোল ও পারমিশন পরিবর্তন করতে পারবেন। কোনো সাধারণ অ্যাডমিন, এডিটর, মোডারেটর বা কাস্টম রোল ধারী কখনোই সুপার অ্যাডমিনের ক্ষমতা পরিবর্তন বা নিজেদের রোল বাড়াতে পারবে না।
            </p>
          </div>
        </div>
      </div>

      {activeTab === "roles" && (
        <div className="space-y-4">
          {/* System Role Selector */}
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
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="font-display text-xs font-bold text-foreground">{label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold border ${tone}`}>
                      {count} টি পারমিশন
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-2">{desc}</p>
                </button>
              );
            })}
          </div>

          <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <h3 className="font-display text-sm font-bold text-foreground">
                  “{selectedRole === "admin" ? "অ্যাডমিন" : selectedRole === "editor" ? "এডিটর" : "মোডারেটর"}” রোলের গ্র্যানুলার পারমিশন
                </h3>
                <p className="text-xs text-muted-foreground">
                  মডিউল অনুযায়ী নির্দিষ্ট অ্যাক্সেস চালু বা বন্ধ করুন
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmResetModal(true)}
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

            {renderPermissionMatrix(
              roleDrafts[selectedRole] || [],
              (key) => togglePermissionForSystemRole(selectedRole, key),
              (cat) =>
                toggleCategoryForList(roleDrafts[selectedRole] || [], cat, (next) =>
                  setRoleDrafts((prev) => ({ ...prev, [selectedRole]: next }))
                )
            )}
          </div>
        </div>
      )}

      {activeTab === "custom" && (
        <div className="space-y-4">
          {/* Custom Roles Toolbar & List */}
          <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-bold text-foreground">
                  কাস্টম অ্যাডমিন ও অপারেটর রোলসমূহ ({customRoles.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  যেমন: লাইভ চ্যাট অপারেটর, ব্যানার ম্যানেজার, কন্টেন্ট মডারেটর ইত্যাদি রোল তৈরি করুন
                </p>
              </div>
              {isMainAdmin && (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-hero px-4 py-2 text-xs font-bold text-primary-foreground shadow-card"
                >
                  <Plus className="h-3.5 w-3.5" /> নতুন কাস্টম রোল
                </button>
              )}
            </div>

            {customRoles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                কোনো কাস্টম রোল তৈরি করা হয়নি। উপরের বাটনে ক্লিক করে নতুন রোল তৈরি করুন।
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {customRoles.map((r) => {
                  const selected = customDraft?.id === r.id;
                  const assignedCount = customRoleAssignmentCount[r.id] || 0;
                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedCustomId(r.id)}
                      className={`flex cursor-pointer items-start justify-between gap-2 rounded-2xl border p-3.5 transition ${
                        selected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                          : "border-border bg-background/60 hover:border-primary/40"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className="inline-block h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: r.color || "#059669" }}
                          />
                          <p className="truncate font-display text-xs font-bold text-foreground">
                            {r.name}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${
                              r.active
                                ? "bg-emerald-500/15 text-emerald-700"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {r.active ? "সক্রিয়" : "নিষ্ক্রিয়"}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                          {r.description || "কাস্টম অ্যাডমিন রোল"}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] font-bold text-muted-foreground">
                          <span>{r.permissions.length} টি পারমিশন</span>
                          <span>• {assignedCount} জন ইউজারে যুক্ত</span>
                        </div>
                      </div>

                      {isMainAdmin && (
                        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => void handleDuplicateCustom(r)}
                            title="ডুপ্লিকেট"
                            className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-500/10"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteRole({ role: r, assignedCount })}
                            title="মুছে ফেলুন"
                            className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Custom Role Editor */}
          {customDraft && (
            <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-sm font-bold text-foreground">
                    “{customDraft.name}” সম্পাদনা ও পারমিশন সেটিংস
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!isMainAdmin}
                    onClick={() =>
                      setCustomDraft((prev) => (prev ? { ...prev, active: !prev.active } : prev))
                    }
                    className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold ${
                      customDraft.active
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                        : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" />
                    {customDraft.active ? "সক্রিয়" : "নিষ্ক্রিয়"}
                  </button>
                  <button
                    type="button"
                    disabled={savingPerms || !isMainAdmin}
                    onClick={() => void handleSaveCustomRoleDraft()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingPerms ? "সেভ হচ্ছে..." : "রোল সেভ করুন"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground">রোলের নাম (বাংলা) *</label>
                  <input
                    value={customDraft.name}
                    onChange={(e) =>
                      setCustomDraft({ ...customDraft, name: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground">ইংরেজি নাম (ঐচ্ছিক)</label>
                  <input
                    value={customDraft.nameEn || ""}
                    onChange={(e) =>
                      setCustomDraft({ ...customDraft, nameEn: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground">ব্যাজ রঙ</label>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {ROLE_COLOR_SWATCHES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCustomDraft({ ...customDraft, color: c })}
                        className={`h-6 w-6 rounded-full border-2 transition ${
                          customDraft.color === c ? "border-foreground scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-3">
                  <label className="text-[11px] font-semibold text-muted-foreground">বিবরণ</label>
                  <input
                    value={customDraft.description || ""}
                    onChange={(e) =>
                      setCustomDraft({ ...customDraft, description: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-1.5 text-xs"
                  />
                </div>
              </div>

              {renderPermissionMatrix(
                customDraft.permissions,
                (key) => {
                  const exists = customDraft.permissions.includes(key);
                  setCustomDraft({
                    ...customDraft,
                    permissions: exists
                      ? customDraft.permissions.filter((k) => k !== key)
                      : [...customDraft.permissions, key],
                  });
                },
                (cat) =>
                  toggleCategoryForList(customDraft.permissions, cat, (next) =>
                    setCustomDraft({ ...customDraft, permissions: next })
                  )
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === "operators" && (
        <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-display text-sm font-bold text-foreground">
                অ্যাডমিন ও অনুমোদিত অপারেটর তালিকা
              </h3>
              <p className="text-xs text-muted-foreground">
                প্রতিটি অ্যাকাউন্টে সিস্টেম রোল ও কাস্টম রোল সরাসরি বরাদ্দ বা পরিবর্তন করুন
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchStaff()}
              disabled={loadingStaff}
              className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${loadingStaff ? "animate-spin" : ""}`} /> রিফ্রেশ
            </button>
          </div>

          {loadingStaff ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              অপারেটর তালিকা লোড হচ্ছে...
            </div>
          ) : staffUsers.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              কোনো অনুমোদিত অ্যাডমিন বা অপারেটর অ্যাকাউন্ট পাওয়া যায়নি। “ইউজার ও অ্যাকসেস” ট্যাব থেকে নতুন অ্যাকাউন্ট তৈরি করুন।
            </div>
          ) : (
            <div className="space-y-3">
              {staffUsers.map((staff) => {
                const isSuper = isProtectedMainSuperAdmin({
                  id: staff.id,
                  email: staff.email,
                  username: staff.profile?.username,
                });
                const resolvedDisplay = resolveUserRoleDisplay({
                  email: staff.email,
                  roles: staff.roles,
                  isMainAdmin: isSuper,
                  customRoleId: staff.custom_role_id,
                  customRoleName: staff.custom_role_name,
                  customRoles,
                  designation: staff.profile?.designation || staff.designation,
                });
                const primaryRole: Role = isSuper
                  ? "admin"
                  : (staff.roles?.find(
                      (r: string) => r === "admin" || r === "editor" || r === "moderator"
                    ) as Role) || "user";

                return (
                  <div
                    key={staff.id}
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3.5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-xs sm:text-sm font-bold text-foreground">
                          {staff.profile?.full_name || staff.profile?.username || staff.email}
                        </span>
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold text-white"
                          style={{ backgroundColor: resolvedDisplay.badgeColor }}
                        >
                          {resolvedDisplay.labelBn}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground break-all mt-0.5">
                        {staff.email} • ফোন: {staff.profile?.phone || "তথ্য নেই"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {isSuper ? (
                        <span className="text-xs font-bold text-amber-800 bg-amber-500/15 px-3 py-1.5 rounded-xl border border-amber-500/30">
                          প্রধান সুপার অ্যাডমিন — অপরিবর্তনীয়
                        </span>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground">মূল রোল:</label>
                            <select
                              value={primaryRole}
                              disabled={updatingUserId === staff.id || !isMainAdmin}
                              onChange={(e) =>
                                void handleSystemRoleChangeForUser(staff, e.target.value as Role)
                              }
                              className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-bold text-foreground"
                            >
                              <option value="admin">অ্যাডমিন (Admin)</option>
                              <option value="editor">এডিটর (Editor)</option>
                              <option value="moderator">মোডারেটর (Moderator)</option>
                              <option value="user">সাধারণ ব্যবহারকারী (প্রত্যাহার)</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <label className="text-[11px] font-semibold text-muted-foreground">কাস্টম রোল:</label>
                            <select
                              value={staff.custom_role_id || ""}
                              disabled={updatingUserId === staff.id || !isMainAdmin}
                              onChange={(e) =>
                                void handleCustomRoleAssignment(staff, e.target.value)
                              }
                              className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-bold text-primary-deep"
                            >
                              <option value="">কোনো কাস্টম রোল নয়</option>
                              {customRoles.map((cr) => (
                                <option key={cr.id} value={cr.id} disabled={!cr.active}>
                                  {cr.name} {!cr.active ? "(নিষ্ক্রিয়)" : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Custom Role Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          onClick={() => setShowCreateModal(false)}
        >
          <form
            onSubmit={handleCreateCustomRole}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-elevated space-y-3.5"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-display text-sm font-bold text-primary-deep">
                নতুন কাস্টম অ্যাডমিন রোল তৈরি করুন
              </h4>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-full p-1 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">রোলের নাম (বাংলা) *</label>
              <input
                required
                value={newRoleForm.name}
                onChange={(e) => setNewRoleForm({ ...newRoleForm, name: e.target.value })}
                placeholder="যেমন: কাস্টম সাপোর্ট অপারেটর"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">ইংরেজি নাম (ঐচ্ছিক)</label>
              <input
                value={newRoleForm.nameEn}
                onChange={(e) => setNewRoleForm({ ...newRoleForm, nameEn: e.target.value })}
                placeholder="e.g. Support Operator"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">দায়িত্বের বিবরণ</label>
              <textarea
                rows={2}
                value={newRoleForm.description}
                onChange={(e) => setNewRoleForm({ ...newRoleForm, description: e.target.value })}
                placeholder="এই রোলের কাজ কী তা সংক্ষেপে লিখুন..."
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">ব্যাজ কালার</label>
              <div className="mt-1.5 flex gap-2">
                {ROLE_COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewRoleForm({ ...newRoleForm, color: c })}
                    className={`h-6 w-6 rounded-full border-2 ${
                      newRoleForm.color === c ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-bold"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="rounded-xl bg-gradient-hero px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm"
              >
                রোল তৈরি করুন
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Custom Role Confirmation Modal */}
      {confirmDeleteRole && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          onClick={() => setConfirmDeleteRole(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-elevated space-y-3"
          >
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              <h4 className="font-display text-sm font-bold">কাস্টম রোল মুছবেন?</h4>
            </div>
            {confirmDeleteRole.assignedCount > 0 ? (
              <p className="text-xs text-rose-700 leading-relaxed font-semibold">
                “{confirmDeleteRole.role.name}” রোলটি বর্তমানে {confirmDeleteRole.assignedCount} জন ইউজার/অপারেটরের সাথে যুক্ত। আগে “অপারেটর ও অ্যাডমিন” ট্যাব থেকে তাদের রোল পরিবর্তন করুন, তারপর মুছুন।
              </p>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                আপনি কি নিশ্চিত যে <strong className="text-foreground">“{confirmDeleteRole.role.name}”</strong> কাস্টম রোলটি মুছে ফেলতে চান?
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteRole(null)}
                className="rounded-xl border border-border px-3.5 py-2 text-xs font-bold"
              >
                বন্ধ করুন
              </button>
              {confirmDeleteRole.assignedCount === 0 && (
                <button
                  type="button"
                  onClick={() => void handleDeleteCustomConfirm()}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white"
                >
                  হ্যাঁ, মুছে ফেলুন
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reset Defaults Modal */}
      {confirmResetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
          onClick={() => setConfirmResetModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-elevated space-y-3"
          >
            <div className="flex items-center gap-2 text-amber-700">
              <RotateCcw className="h-5 w-5" />
              <h4 className="font-display text-sm font-bold">ডিফল্ট পারমিশনে ফিরবেন?</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              সকল সিস্টেম ও কাস্টম রোল ডিফল্ট পারমিশনে রিসেট করা হবে।
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetModal(false)}
                className="rounded-xl border border-border px-3.5 py-2 text-xs font-bold"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => void handleExecuteResetDefaults()}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white"
              >
                রিসেট করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
