import { useEffect, useState } from "react";
import {
  ShieldCheck,
  KeyRound,
  History,
  Lock,
  Unlock,
  Copy,
  RefreshCcw,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { updatePassword } from "firebase/auth";
import { auth, SUPER_ADMIN_EMAIL } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { recordUserCredential } from "@/lib/admin-client";
import {
  EVENT_LABELS,
  listMySecurityEvents,
  logEvent,
  passwordProblem,
  verifyPassword,
  getAdminSecurityPin,
  setAdminSecurityPin,
  setAdminPanelLocked,
  genBackupCodes,
  getSavedBackupCodes,
  saveBackupCodes,
  ua,
} from "@/lib/security";

const box = "rounded-2xl bg-card p-4 shadow-card border border-border/60";
const inp = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";
const btn = "rounded-full bg-gradient-hero px-4 py-2 text-xs font-semibold text-primary-foreground shadow-card disabled:opacity-60";

export function SecurityPanel({ onLockNow }: { onLockNow?: () => void }) {
  return (
    <div className="space-y-3.5">
      <AccountSecurityStatus onLockNow={onLockNow} />
      <AdminPinSecurityBox onLockNow={onLockNow} />
      <PasswordBox />
      <BackupCodesBox />
      <EventsBox />
    </div>
  );
}

function AccountSecurityStatus({ onLockNow }: { onLockNow?: () => void }) {
  const { user, roles, isMainAdmin, isAdmin, isEditor, isModerator } = useAuth();
  const uid = user?.id || "super_admin_mahmudul";
  const hasPin = Boolean(getAdminSecurityPin(uid));

  const roleTier = isMainAdmin
    ? "সুপার এডমিন / মেইন এডমিন (সর্বোচ্চ নিরাপত্তা স্তর)"
    : isAdmin
    ? "এডমিন (সীমিত স্টাফ অ্যাকসেস)"
    : isEditor
    ? "এডিটর (কন্টেন্ট মডারেশন)"
    : isModerator
    ? "মডারেটর (চ্যাট ও রিভিউ)"
    : "সাধারণ ইউজার";

  return (
    <div className={box}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display text-sm font-bold text-primary-deep">
          <ShieldCheck className="h-4 w-4 text-emerald-600" /> উন্নত সিকিউরিটি শিল্ড ও সেশন স্ট্যাটাস
        </p>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
          <CheckCircle2 className="h-3 w-3" /> Zero-Trust সক্রিয়
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
        <div className="rounded-xl bg-muted/40 p-2.5">
          <p className="text-[10px] text-muted-foreground">লগইনকৃত একাউন্ট</p>
          <p className="mt-0.5 font-semibold text-foreground">{user?.email || "স্টাফ অ্যাকাউন্ট"}</p>
        </div>
        <div className="rounded-xl bg-muted/40 p-2.5">
          <p className="text-[10px] text-muted-foreground">অ্যাকসেস লেভেল</p>
          <p className="mt-0.5 font-bold text-primary-deep">{roleTier}</p>
        </div>
        <div className="rounded-xl bg-muted/40 p-2.5">
          <p className="text-[10px] text-muted-foreground">ইমেইল ও ক্লাউড যাচাই</p>
          <p className="mt-0.5 font-semibold text-emerald-700">
            {user?.emailVerified ? "✓ ভেরিফাইড (Firebase Auth)" : "সক্রিয় সেশন"}
          </p>
        </div>
        <div className="rounded-xl bg-muted/40 p-2.5">
          <p className="text-[10px] text-muted-foreground">প্যানেল পিন (PIN) লক</p>
          <p className={`mt-0.5 font-semibold ${hasPin ? "text-emerald-700" : "text-amber-700"}`}>
            {hasPin ? "✓ পিন সুরক্ষা চালু আছে" : "পিন এখনো সেট করা হয়নি"}
          </p>
        </div>
      </div>

      <div className="mt-2.5 rounded-xl bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        <p className="flex items-center gap-1.5 truncate">
          <Smartphone className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span>ডিভাইস সিগনেচার: {ua().slice(0, 85)}...</span>
        </p>
        <p className="mt-0.5 text-[10px]">
          সক্রিয় রোলসমূহ: <span className="font-mono font-semibold uppercase text-foreground">{roles.join(", ") || "user"}</span> • ব্রুট-ফোর্স লকআউট: সক্রিয় (৫ বার ভুল চেষ্টায় অটো-লক)
        </p>
      </div>

      {onLockNow && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setAdminPanelLocked(true);
              void logEvent("panel_locked", "Manual lock button");
              onLockNow();
            }}
            className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3.5 py-1.5 text-xs font-bold text-amber-900 transition hover:bg-amber-500/25"
          >
            <Lock className="h-3.5 w-3.5" /> এখনই এডমিন প্যানেল লক করুন
          </button>
        </div>
      )}
    </div>
  );
}

function AdminPinSecurityBox({ onLockNow }: { onLockNow?: () => void }) {
  const { user } = useAuth();
  const uid = user?.id || "super_admin_mahmudul";
  const [savedPin, setSavedPin] = useState(() => getAdminSecurityPin(uid));
  const [pinInput, setPinInput] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  function handleSavePin(e: React.FormEvent) {
    e.preventDefault();
    const clean = pinInput.trim();
    if (!/^\d{4,6}$/.test(clean)) {
      return toast.error("৪ থেকে ৬ সংখ্যার পিন (PIN) দিন");
    }
    if (clean !== confirmPin.trim()) {
      return toast.error("পিন দুটি মিলছে না");
    }
    setAdminSecurityPin(uid, clean);
    setSavedPin(clean);
    setPinInput("");
    setConfirmPin("");
    void logEvent("pin_enabled", "Admin 2-step security PIN enabled");
    toast.success("এডমিন প্যানেল সিকিউরিটি পিন চালু হয়েছে!");
  }

  function handleRemovePin() {
    setAdminSecurityPin(uid, "");
    setSavedPin("");
    void logEvent("pin_removed");
    toast.success("সিকিউরিটি পিন সরানো হয়েছে");
  }

  return (
    <div className={box}>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 font-display text-sm font-bold text-primary-deep">
          <Lock className="h-4 w-4 text-primary" /> ২-স্তরের প্যানেল পিন লক (Admin Security PIN)
        </p>
        {savedPin && (
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
            পিন সক্রিয়
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        এডমিন প্যানেলে অতিরিক্ত সুরক্ষার জন্য ৪-৬ সংখ্যার গোপন পিন সেট করুন। প্যানেল লক করলে পিন ছাড়া কেউ প্রবেশ করতে পারবে না।
      </p>

      <form onSubmit={handleSavePin} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
          placeholder="নতুন পিন (৪-৬ সংখ্যা)"
          className={inp}
          required
        />
        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
          placeholder="পিন নিশ্চিত করুন"
          className={inp}
          required
        />
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <button type="submit" className={btn}>
            {savedPin ? "পিন পরিবর্তন করুন" : "পিন চালু করুন"}
          </button>
          {savedPin && (
            <>
              <button
                type="button"
                onClick={() => {
                  setAdminPanelLocked(true);
                  void logEvent("panel_locked");
                  onLockNow?.();
                }}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary-deep"
              >
                <Lock className="h-3.5 w-3.5" /> প্যানেল লক পরীক্ষা করুন
              </button>
              <button
                type="button"
                onClick={handleRemovePin}
                className="flex items-center gap-1 rounded-full bg-destructive/10 px-3.5 py-2 text-xs font-semibold text-destructive"
              >
                <Unlock className="h-3.5 w-3.5" /> পিন বন্ধ করুন
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

function PasswordBox() {
  const { user } = useAuth();
  const [cur, setCur] = useState("");
  const [np, setNp] = useState("");
  const [cf, setCf] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    const p = passwordProblem(np);
    if (p) return toast.error(p);
    if (np !== cf) return toast.error("পাসওয়ার্ড মিলছে না");
    if (!auth.currentUser) return toast.error("লগইন করা নেই");
    setBusy(true);
    try {
      await verifyPassword(cur);
      await updatePassword(auth.currentUser, np);
      if (user?.email) {
        await recordUserCredential({
          uid: user.id,
          email: user.email,
          password: np,
        });
      }
      await logEvent("password_changed");
      toast.success("পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে");
      setCur("");
      setNp("");
      setCf("");
    } catch (err: any) {
      toast.error(err.message ?? "পাসওয়ার্ড বদলানো যায়নি।");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={go} className={box}>
      <p className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-primary-deep">
        <KeyRound className="h-4 w-4 text-primary" /> একাউন্ট পাসওয়ার্ড পরিবর্তন
      </p>
      <div className="space-y-2">
        <input
          type="password"
          className={inp}
          placeholder="বর্তমান পাসওয়ার্ড"
          value={cur}
          onChange={(e) => setCur(e.target.value)}
          required
        />
        <input
          type="password"
          className={inp}
          placeholder="নতুন শক্তিশালী পাসওয়ার্ড (৮+ অক্ষর, বড়/ছোট, সংখ্যা, চিহ্ন)"
          value={np}
          onChange={(e) => setNp(e.target.value)}
          required
        />
        <input
          type="password"
          className={inp}
          placeholder="নতুন পাসওয়ার্ড আবার লিখুন"
          value={cf}
          onChange={(e) => setCf(e.target.value)}
          required
        />
      </div>
      <button disabled={busy} className={`${btn} mt-3`}>
        {busy ? "অপেক্ষা..." : "পাসওয়ার্ড আপডেট করুন"}
      </button>
    </form>
  );
}

function BackupCodesBox() {
  const { user } = useAuth();
  const uid = user?.id || "super_admin_mahmudul";
  const [codes, setCodes] = useState<string[]>(() => getSavedBackupCodes(uid));

  function generateNew() {
    const next = genBackupCodes(8);
    saveBackupCodes(uid, next);
    setCodes(next);
    void logEvent("backup_codes_regenerated");
    toast.success("নতুন ব্যাকআপ রিকভারি কোড তৈরি হয়েছে");
  }

  function copyAll() {
    if (!codes.length) return;
    navigator.clipboard.writeText(codes.join("\n"));
    toast.success("সব ব্যাকআপ কোড কপি হয়েছে");
  }

  return (
    <div className={box}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 font-display text-sm font-bold text-primary-deep">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> জরুরী রিকভারি ব্যাকআপ কোড
          </p>
          <p className="text-xs text-muted-foreground">
            পিন ভুলে গেলে বা জরুরী মুহূর্তে একাউন্ট পুনরুদ্ধারের জন্য কোডগুলো সংরক্ষণ করে রাখুন
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={generateNew}
            className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary-deep"
          >
            <RefreshCcw className="h-3 w-3" /> {codes.length ? "নতুন কোড" : "কোড তৈরি করুন"}
          </button>
          {codes.length > 0 && (
            <button
              type="button"
              onClick={copyAll}
              className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold"
            >
              <Copy className="h-3 w-3" /> কপি
            </button>
          )}
        </div>
      </div>

      {codes.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {codes.map((c) => (
            <div
              key={c}
              className="rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-center font-mono text-xs font-bold text-primary-deep"
            >
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EventsBox() {
  const [rows, setRows] = useState<
    { id: string; event: string; detail?: string; created_at: string; user_agent: string | null }[]
  >([]);

  function load() {
    void listMySecurityEvents().then(setRows);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className={box}>
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-2 font-display text-sm font-bold text-primary-deep">
          <History className="h-4 w-4 text-primary" /> সিকিউরিটি অডিট লগ (কার্যকলাপ ইতিহাস)
        </p>
        <button
          type="button"
          onClick={load}
          className="rounded-full bg-muted p-1.5 text-muted-foreground hover:text-foreground"
          title="রিফ্রেশ"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">এখনো কোনো সিকিউরিটি লগ নেই</p>
      ) : (
        <ul className="space-y-1.5 text-xs">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-muted/30 px-3 py-2"
            >
              <div>
                <p className="font-semibold text-foreground">
                  {EVENT_LABELS[r.event] ?? r.event}
                </p>
                {r.detail && (
                  <p className="text-[10px] text-muted-foreground">{r.detail}</p>
                )}
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString("bn-BD")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
