import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LogIn,
  Mail,
  UserPlus,
  Phone,
  CheckCircle2,
  RefreshCcw,
  User,
  Lock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { isSuperAdminEmail, REGULAR_ADMIN_EMAIL } from "@/lib/firebase";
import { ForgotPasswordOtp } from "@/components/security/ForgotPasswordOtp";
import { useAuth } from "@/lib/auth";
import { useLogo } from "@/lib/store";
import { logEvent } from "@/lib/security";
import { recordUserCredential } from "@/lib/admin-client";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "লগইন / নিবন্ধন — স্মার্ট নোয়াখালী" }] }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot";
type VerifyChannel = "email" | "phone";

function toEnglishDigits(str: string): string {
  const map: Record<string, string> = {
    "০": "0",
    "১": "1",
    "২": "2",
    "৩": "3",
    "৪": "4",
    "৫": "5",
    "৬": "6",
    "৭": "7",
    "৮": "8",
    "৯": "9",
  };
  return (str || "").replace(/[০-৯]/g, (d) => map[d] || d);
}

function normalizeBdPhone(raw: string): string {
  const digits = toEnglishDigits(raw).replace(/\D/g, "");
  if (digits.startsWith("8801") && digits.length === 13) {
    return digits.slice(2);
  }
  return digits;
}

function isValidBdPhone(raw: string): boolean {
  return /^01[3-9]\d{8}$/.test(normalizeBdPhone(raw));
}

function isValidEmailAddress(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

function generateAutoUsername(fullName?: string | null, email?: string | null, phone?: string | null): string {
  const safeEmail = (email || "").trim();
  const safeName = (fullName || "").trim();
  const safePhone = (phone || "").trim();

  const baseFromEmail = safeEmail.includes("@")
    ? safeEmail.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase()
    : "";
  if (baseFromEmail && baseFromEmail.length >= 3) {
    return baseFromEmail;
  }
  const baseFromName = safeName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const phoneSuffix = normalizeBdPhone(safePhone).slice(-4) || Math.floor(100 + Math.random() * 900);
  if (baseFromName.length >= 3) {
    return `${baseFromName.slice(0, 12)}${phoneSuffix}`;
  }
  const cleanPhone = normalizeBdPhone(safePhone);
  if (cleanPhone.length >= 6) {
    return `user_${cleanPhone.slice(-6)}`;
  }
  return `sn_user_${Math.floor(1000 + Math.random() * 9000)}`;
}

function friendlyError(msg: string) {
  const m = msg || "";
  if (m.includes("সুপার এডমিন") || m.includes("ভেরিফিকেশন")) {
    return m;
  }
  if (
    m.includes("auth/invalid-credential") ||
    m.includes("auth/wrong-password") ||
    m.includes("auth/user-not-found")
  ) {
    return "ভুল ইমেইল/ফোন নাম্বার অথবা পাসওয়ার্ড";
  }
  if (m.includes("auth/email-already-in-use")) {
    return "এই ইমেইল বা নাম্বারটি ইতিমধ্যেই নিবন্ধিত — লগইন করুন";
  }
  if (m.includes("auth/invalid-verification-code")) {
    return "ভুল ভেরিফিকেশন কোড! সঠিক ৬ সংখ্যার কোডটি দিন।";
  }
  if (m.includes("auth/code-expired")) {
    return "ভেরিফিকেশন কোডের মেয়াদ শেষ হয়েছে। নতুন কোড পাঠান।";
  }
  if (m.includes("auth/popup-closed-by-user")) {
    return "লগইন পপআপ বন্ধ করা হয়েছে";
  }
  return m || "ত্রুটি";
}

function AuthPage() {
  const navigate = useNavigate();
  const {
    isAuthed,
    isStaff,
    isMainAdmin,
    signInUserOrStaff,
    completeVerifiedSignup,
  } = useAuth();
  const { logo } = useLogo();

  const [mode, setMode] = useState<Mode>("login");
  const [loginId, setLoginId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAuthed) {
      if (isMainAdmin || isStaff) {
        navigate({ to: "/mdmahmudulhashan" });
      } else {
        navigate({ to: "/" });
      }
    }
  }, [isAuthed, isMainAdmin, isStaff, navigate]);

  async function handleLogin() {
    const cleanInput = toEnglishDigits(loginId.trim());
    if (!cleanInput) throw new Error("ইমেইল অথবা ফোন নাম্বার দিন");
    if (!password) throw new Error("পাসওয়ার্ড দিন");

    const lowerClean = cleanInput.toLowerCase();
    if (
      isSuperAdminEmail(cleanInput) ||
      lowerClean === "mahmudul" ||
      lowerClean === "mahmud" ||
      lowerClean === "mdmahmudulhashan0"
    ) {
      throw new Error(
        "সুপার এডমিন সাধারণ ইউজার লগইন দিয়ে প্রবেশ করতে পারবেন না। শুধুমাত্র এডমিন প্যানেল (/mdmahmudulhashan) দিয়ে লগইন করুন।"
      );
    }

    const res = await signInUserOrStaff(cleanInput, password);
    await logEvent("login_success", res.isStaff ? "staff_via_user_login" : "user_login");

    if (res.isStaff) {
      toast.success("স্বাগতম! স্টাফ ড্যাশবোর্ডে প্রবেশ সফল");
      navigate({ to: "/mdmahmudulhashan" });
    } else {
      toast.success("লগইন সফল হয়েছে");
      navigate({ to: "/" });
    }
  }

  async function handleDirectSignup() {
    if (!fullName.trim() || fullName.trim().length < 2) {
      throw new Error("আপনার পূর্ণ নাম সঠিকভাবে লিখুন");
    }
    if (password.length < 6) {
      throw new Error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
    }
    if (confirmPassword && password !== confirmPassword) {
      throw new Error("পাসওয়ার্ড দুটি মিলছে না");
    }

    const normalizedPhone = normalizeBdPhone(phone);
    const cleanedEmail = email.trim().toLowerCase();

    if (!cleanedEmail && !normalizedPhone) {
      throw new Error("ইমেইল ঠিকানা অথবা সচল মোবাইল নাম্বার (যেকোনো একটি বা দুটিই) দিন");
    }

    if (cleanedEmail && !isValidEmailAddress(cleanedEmail)) {
      throw new Error("সঠিক ইমেইল ঠিকানা দিন (যেমন: name@gmail.com)");
    }

    if (cleanedEmail && isSuperAdminEmail(cleanedEmail)) {
      throw new Error("এই ইমেইলটি সংরক্ষিত।");
    }

    if (normalizedPhone && !isValidBdPhone(normalizedPhone)) {
      throw new Error("সঠিক ১১ সংখ্যার মোবাইল নাম্বার দিন (যেমন: 01812345678)");
    }

    const finalUsername =
      username.trim() || generateAutoUsername(fullName, cleanedEmail, normalizedPhone);

    const channel: VerifyChannel = cleanedEmail ? "email" : "phone";

    await completeVerifiedSignup({
      fullName: fullName.trim(),
      username: finalUsername,
      email: cleanedEmail,
      phone: normalizedPhone,
      password,
      verifiedVia: channel,
    });

    await logEvent("signup_success", `direct_${channel}_signup`);
    toast.success("অভিনন্দন! আপনার অ্যাকাউন্ট তৈরি ও সরাসরি লগইন সফল হয়েছে।");
    navigate({ to: "/" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        await handleLogin();
      } else if (mode === "signup") {
        await handleDirectSignup();
      }
    } catch (err) {
      toast.error(friendlyError(err instanceof Error ? err.message : "ত্রুটি"));
    } finally {
      setBusy(false);
    }
  }

  const isNameValid = fullName.trim().length >= 2;
  const isEmailValid = email.trim() ? isValidEmailAddress(email) : false;
  const isPhoneValid = phone.trim() ? isValidBdPhone(phone) : false;
  const isPasswordValid = password.length >= 6;
  const isConfirmMatch = !confirmPassword || password === confirmPassword;

  return (
    <div className="mx-auto max-w-md px-4 pt-6 pb-24">
      <Link to="/" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> হোমে ফিরে যান
      </Link>
      <div className="rounded-3xl bg-gradient-card p-6 shadow-elevated">
        <div className="mx-auto mb-3 flex h-24 w-24 items-center justify-center p-1">
          <img
            src={logo}
            alt="Smart Noakhali Logo"
            className="h-full w-full object-contain"
          />
        </div>

        {(mode === "login" || mode === "signup") && (
          <div className="mb-4 flex gap-2 rounded-2xl bg-muted p-1.5">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                mode === "login"
                  ? "bg-card text-primary-deep shadow-card"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LogIn className="mr-1.5 inline h-3.5 w-3.5" /> লগইন করুন
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                mode === "signup"
                  ? "bg-card text-primary-deep shadow-card"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserPlus className="mr-1.5 inline h-3.5 w-3.5" /> নতুন রেজিস্ট্রেশন
            </button>
          </div>
        )}

        {mode === "forgot" ? (
          <div className="mt-2">
            <h1 className="mb-1 text-center font-display text-lg font-bold text-primary-deep">
              পাসওয়ার্ড পুনরুদ্ধার
            </h1>
            <ForgotPasswordOtp onDone={() => setMode("login")} />
          </div>
        ) : mode === "login" ? (
          <>
            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-primary-deep">
                  ইমেইল, মোবাইল নাম্বার অথবা ইউজারনেম
                </label>
                <input
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="যেমন: name@gmail.com বা 018XXXXXXXX"
                  type="text"
                  required
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-primary-deep">
                  পাসওয়ার্ড
                </label>
                <div className="relative">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="আপনার পাসওয়ার্ড দিন"
                    type={showPwd ? "text" : "password"}
                    required
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="পাসওয়ার্ড দেখান"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-gradient-hero py-3 text-sm font-bold text-primary-foreground shadow-elevated active:scale-[0.99] disabled:opacity-60"
              >
                {busy ? "লগইন হচ্ছে..." : "লগইন করুন"}
              </button>
            </form>
          </>
        ) : (
          /* Easy 1-Step User Registration Form */
          <form onSubmit={onSubmit} className="space-y-3.5">
            {/* Field 1: Full Name */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="flex items-center gap-1 text-xs font-bold text-primary-deep">
                  <User className="h-3.5 w-3.5 text-primary" /> আপনার পূর্ণ নাম *
                </label>
                {isNameValid && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> সঠিক
                  </span>
                )}
              </div>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="আপনার নাম লিখুন (যেমন: মোঃ রহিম উদ্দিন)"
                required
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Field 2: Mobile Number */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="flex items-center gap-1 text-xs font-bold text-primary-deep">
                  <Phone className="h-3.5 w-3.5 text-primary" /> মোবাইল নাম্বার (অথবা নিচে ইমেইল দিন)
                </label>
                {isPhoneValid && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> সঠিক নাম্বার
                  </span>
                )}
              </div>
              <input
                value={phone}
                onChange={(e) => setPhone(toEnglishDigits(e.target.value))}
                placeholder="01812345678"
                type="tel"
                inputMode="tel"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Field 3: Email Address */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="flex items-center gap-1 text-xs font-bold text-primary-deep">
                  <Mail className="h-3.5 w-3.5 text-primary" /> ইমেইল ঠিকানা (অথবা উপরে মোবাইল নাম্বার দিন)
                </label>
                {isEmailValid && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" /> সঠিক ইমেইল
                  </span>
                )}
              </div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@gmail.com"
                type="email"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Field 4: Password & Confirm */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="flex items-center gap-1 text-xs font-bold text-primary-deep">
                    <Lock className="h-3.5 w-3.5 text-primary" /> পাসওয়ার্ড *
                  </label>
                  {isPasswordValid && (
                    <span className="text-[10px] font-bold text-emerald-700">✓ ৬+ অক্ষর</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="কমপক্ষে ৬ অক্ষর"
                    type={showPwd ? "text" : "password"}
                    required
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-9 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="পাসওয়ার্ড দেখান"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-bold text-primary-deep">
                    পাসওয়ার্ড নিশ্চিত করুন
                  </label>
                  {confirmPassword && (
                    <span
                      className={`text-[10px] font-bold ${
                        isConfirmMatch ? "text-emerald-700" : "text-destructive"
                      }`}
                    >
                      {isConfirmMatch ? "✓ মিলেছে" : "মিলছে না"}
                    </span>
                  )}
                </div>
                <input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="পুনরায় পাসওয়ার্ড দিন"
                  type={showPwd ? "text" : "password"}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Collapsible Optional Username */}
            <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
              <button
                type="button"
                onClick={() => setShowOptionalFields((v) => !v)}
                className="flex w-full items-center justify-between text-left text-[11px] font-semibold text-muted-foreground hover:text-primary-deep"
              >
                <span>ঐচ্ছিক তথ্য (পছন্দের ইউজারনেম)</span>
                {showOptionalFields ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {showOptionalFields && (
                <div className="mt-2.5 border-t border-border/60 pt-2.5">
                  <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                    পছন্দের ইউজারনেম (খালি রাখলে নাম থেকে স্বয়ংক্রিয় তৈরি হবে)
                  </label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="যেমন: rahim_noakhali"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-hero py-3.5 text-sm font-bold text-primary-foreground shadow-elevated transition active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-gold" />
              )}
              <span>
                {busy
                  ? "অ্যাকাউন্ট তৈরি হচ্ছে..."
                  : "সরাসরি অ্যাকাউন্ট তৈরি ও লগইন করুন"}
              </span>
              <ArrowRight className="h-4 w-4 text-gold" />
            </button>
          </form>
        )}

        <div className="mt-4 flex flex-col items-center gap-2 text-xs">
          {mode === "login" && (
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="font-semibold text-primary-deep hover:underline"
            >
              পাসওয়ার্ড ভুলে গেছেন?
            </button>
          )}
          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => setMode("login")}
              className="font-semibold text-muted-foreground hover:underline"
            >
              ← লগইনে ফিরে যান
            </button>
          )}
        </div>
      </div>
    </div>
  );
}