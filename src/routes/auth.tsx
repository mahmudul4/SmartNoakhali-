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

function generateAutoUsername(fullName: string, email: string, phone: string): string {
  const baseFromEmail = email.trim().split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
  if (baseFromEmail && baseFromEmail.length >= 3) {
    return baseFromEmail;
  }
  const baseFromName = fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const phoneSuffix = normalizeBdPhone(phone).slice(-4) || Math.floor(100 + Math.random() * 900);
  if (baseFromName.length >= 3) {
    return `${baseFromName.slice(0, 12)}${phoneSuffix}`;
  }
  const cleanPhone = normalizeBdPhone(phone);
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
    signInWithGoogle,
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
  const [verifyChannel, setVerifyChannel] = useState<VerifyChannel>("email");

  // Direct 6-Digit OTP Verification State (Both Email and Phone)
  const [otpSent, setOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpTargetDisplay, setOtpTargetDisplay] = useState("");
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAuthed) {
      if (isMainAdmin || isStaff) {
        navigate({ to: "/mdmahmudulhashan" });
      } else {
        navigate({ to: "/" });
      }
    }
  }, [isAuthed, isStaff, isMainAdmin, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleGoogleLogin() {
    setBusy(true);
    try {
      const appU = await signInWithGoogle(undefined, { disallowSuperAdmin: true });
      const isRegAdmin =
        (appU.email || "").trim().toLowerCase() === REGULAR_ADMIN_EMAIL.toLowerCase();
      await recordUserCredential({
        uid: appU.uid,
        email: appU.email || "",
        full_name: appU.displayName || undefined,
        photo_url: appU.photoURL || undefined,
        roles: isRegAdmin ? ["admin", "user"] : undefined,
        verified_via: "google",
      });
      await logEvent("login_success", "google_popup_user_or_staff");
      if (isRegAdmin) {
        toast.success("স্বাগতম! এডমিন হিসেবে লগইন সফল হয়েছে");
        navigate({ to: "/mdmahmudulhashan" });
      } else {
        toast.success("Google ভেরিফাইড লগইন সফল হয়েছে");
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(friendlyError(err instanceof Error ? err.message : "ত্রুটি"));
    } finally {
      setBusy(false);
    }
  }

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

  async function handleSendSixDigitOtp() {
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

    if (verifyChannel === "email") {
      if (!cleanedEmail || !isValidEmailAddress(cleanedEmail)) {
        throw new Error("ভেরিফিকেশনের জন্য সঠিক ইমেইল ঠিকানা দিন (যেমন: name@gmail.com)");
      }
      if (isSuperAdminEmail(cleanedEmail)) {
        throw new Error("এই ইমেইলটি সংরক্ষিত।");
      }
    } else {
      if (!isValidBdPhone(normalizedPhone)) {
        throw new Error("সঠিক ১১ সংখ্যার সচল মোবাইল নাম্বার দিন (যেমন: 01812345678)");
      }
    }

    // Request direct 6-digit OTP code from server
    const resp = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: verifyChannel,
        email: cleanedEmail,
        phone: normalizedPhone,
      }),
    });

    const data = await resp.json();
    if (!resp.ok || !data.ok) {
      throw new Error(data.error || "৬ সংখ্যার ভেরিফিকেশন কোড পাঠানো যায়নি");
    }
    if (data.otpToken) {
      setOtpToken(String(data.otpToken));
    }

    setOtpSent(true);
    setOtpCode("");
    setOtpTargetDisplay(
      data.target || (verifyChannel === "email" ? cleanedEmail : normalizedPhone)
    );
    setCooldown(45);
    toast.success(
      verifyChannel === "email"
        ? `${cleanedEmail} ইমেইলে ৬ সংখ্যার ভেরিফিকেশন কোড পাঠানো হয়েছে!`
        : `${normalizedPhone} নাম্বারে ৬ সংখ্যার ভেরিফিকেশন কোড (OTP) পাঠানো হয়েছে!`
    );
    setTimeout(() => {
      otpInputRefs.current[0]?.focus();
    }, 100);
  }

  async function handleVerifySixDigitOtp() {
    const cleanCode = toEnglishDigits(otpCode).replace(/\D/g, "").slice(0, 6);
    if (cleanCode.length < 6) {
      throw new Error("৬ সংখ্যার সম্পূর্ণ ভেরিফিকেশন কোডটি দিন");
    }

    const normalizedPhone = normalizeBdPhone(phone);
    const cleanedEmail = email.trim().toLowerCase();
    const finalUsername =
      username.trim() || generateAutoUsername(fullName, cleanedEmail, normalizedPhone);

    const verifyResp = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: verifyChannel,
        email: cleanedEmail,
        phone: normalizedPhone,
        code: cleanCode,
        otpToken,
      }),
    });
    const verifyData = await verifyResp.json();
    if (!verifyResp.ok || !verifyData.verified) {
      throw new Error(verifyData.error || "ভুল ভেরিফিকেশন কোড! সঠিক ৬ সংখ্যার কোডটি দিন।");
    }

    await completeVerifiedSignup({
      fullName: fullName.trim(),
      username: finalUsername,
      email: cleanedEmail,
      phone: normalizedPhone,
      password,
      verifiedVia: verifyChannel,
    });

    toast.success(
      verifyChannel === "email"
        ? "ইমেইল ৬-ডিজিট কোড ভেরিফিকেশন সম্পন্ন! আপনার অ্যাকাউন্ট তৈরি হয়েছে।"
        : "মোবাইল নাম্বার ৬-ডিজিট কোড ভেরিফিকেশন সম্পন্ন! আপনার অ্যাকাউন্ট তৈরি হয়েছে।"
    );
    navigate({ to: "/" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        await handleLogin();
      } else if (mode === "signup") {
        if (!otpSent) {
          await handleSendSixDigitOtp();
        } else {
          await handleVerifySixDigitOtp();
        }
      }
    } catch (err) {
      toast.error(friendlyError(err instanceof Error ? err.message : "ত্রুটি"));
    } finally {
      setBusy(false);
    }
  }

  function handleOtpDigitChange(index: number, rawVal: string) {
    const cleanVal = toEnglishDigits(rawVal).replace(/\D/g, "");
    if (!cleanVal) {
      const chars = otpCode.padEnd(6, " ").split("");
      chars[index] = " ";
      setOtpCode(chars.join("").trimEnd());
      return;
    }

    if (cleanVal.length > 1) {
      const sliced = cleanVal.slice(0, 6);
      setOtpCode(sliced);
      const focusIdx = Math.min(sliced.length, 5);
      otpInputRefs.current[focusIdx]?.focus();
      return;
    }

    const chars = otpCode.padEnd(6, " ").split("");
    chars[index] = cleanVal[0];
    const nextCode = chars.join("").replace(/ /g, "");
    setOtpCode(nextCode);

    if (index < 5 && cleanVal) {
      otpInputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      const currentChar = otpCode[index];
      if (!currentChar && index > 0) {
        otpInputRefs.current[index - 1]?.focus();
      }
    }
  }

  const isNameValid = fullName.trim().length >= 2;
  const isTargetValid =
    verifyChannel === "phone" ? isValidBdPhone(phone) : isValidEmailAddress(email);
  const isPasswordValid = password.length >= 6;
  const isConfirmMatch = !confirmPassword || password === confirmPassword;

  return (
    <div className="mx-auto max-w-md px-4 pt-6 pb-24">
      <Link to="/" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> হোমে ফিরে যান
      </Link>
      <div className="rounded-3xl bg-gradient-card p-6 shadow-elevated">
        <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-white p-1 ring-2 ring-gold shadow-gold">
          <img
            src={logo}
            alt="Smart Noakhali Logo"
            className="h-full w-full rounded-full object-contain"
          />
        </div>

        {(mode === "login" || mode === "signup") && (
          <div className="mb-4 flex gap-2 rounded-2xl bg-muted p-1.5">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setOtpSent(false);
              }}
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
              onClick={() => {
                setMode("signup");
                setOtpSent(false);
              }}
              className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                mode === "signup"
                  ? "bg-card text-primary-deep shadow-card"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserPlus className="mr-1.5 inline h-3.5 w-3.5" /> নতুন অ্যাকাউন্ট খুলুন
            </button>
          </div>
        )}

        {mode === "forgot" ? (
          <div className="mt-2">
            <h1 className="mb-1 text-center font-display text-lg font-bold text-primary-deep">
              ৬-ডিজিট কোডের মাধ্যমে পাসওয়ার্ড পুনরুদ্ধার
            </h1>
            <ForgotPasswordOtp onDone={() => setMode("login")} />
          </div>
        ) : mode === "login" ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-primary/30 bg-card py-3 text-sm font-semibold text-primary-deep shadow-card transition hover:border-primary hover:bg-primary/5 active:scale-[0.99] disabled:opacity-60"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.5 1.18-4.22 1.18-3.25 0-6-2.2-6.98-5.15H1.01v3.14C3.02 21.15 7.21 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.02 14.02c-.25-.74-.39-1.54-.39-2.37 0-.83.14-1.63.39-2.37V6.14H1.01C.37 7.42 0 8.87 0 11.65s.37 4.23 1.01 5.51l4.01-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.02 2.85 1.01 6.84l4.01 3.14C6 7.02 8.75 4.75 12 4.75Z"
                />
              </svg>
              Google দিয়ে ১-ক্লিকে লগইন করুন
            </button>

            <div className="my-4 flex items-center gap-3 text-[11px] text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>অথবা ইমেইল / ফোন নাম্বার দিন</span>
              <div className="h-px flex-1 bg-border" />
            </div>

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
          /* Direct 2-Step 6-Digit OTP User Registration Form (Both Email & Phone) */
          <div>
            {/* Step Progress Indicator */}
            <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <div
                  className={`flex items-center gap-1.5 ${
                    !otpSent ? "text-primary-deep" : "text-emerald-700"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-extrabold text-white ${
                      !otpSent ? "bg-primary" : "bg-emerald-600"
                    }`}
                  >
                    {!otpSent ? "১" : "✓"}
                  </span>
                  <span>সাধারণ তথ্য পূরণ</span>
                </div>
                <div className="mx-2 h-0.5 flex-1 rounded bg-border">
                  <div
                    className={`h-full rounded transition-all duration-300 ${
                      otpSent ? "w-full bg-emerald-600" : "w-1/2 bg-primary"
                    }`}
                  />
                </div>
                <div
                  className={`flex items-center gap-1.5 ${
                    otpSent ? "text-primary-deep" : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-extrabold ${
                      otpSent
                        ? "bg-primary text-white"
                        : "bg-muted-foreground/20 text-muted-foreground"
                    }`}
                  >
                    ২
                  </span>
                  <span>৬-ডিজিট কোড যাচাই</span>
                </div>
              </div>
            </div>

            {!otpSent ? (
              <form onSubmit={onSubmit} className="space-y-3.5">
                {/* Quick Google Verified Signup Option */}
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleGoogleLogin}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-card py-2.5 text-xs font-bold text-primary-deep shadow-sm transition hover:border-primary hover:bg-primary/5"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.5 1.18-4.22 1.18-3.25 0-6-2.2-6.98-5.15H1.01v3.14C3.02 21.15 7.21 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.02 14.02c-.25-.74-.39-1.54-.39-2.37 0-.83.14-1.63.39-2.37V6.14H1.01C.37 7.42 0 8.87 0 11.65s.37 4.23 1.01 5.51l4.01-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.02 2.85 1.01 6.84l4.01 3.14C6 7.02 8.75 4.75 12 4.75Z"
                    />
                  </svg>
                  Google দিয়ে সরাসরি ভেরিফাইড নিবন্ধন করুন
                </button>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  <span>অথবা ৬-ডিজিট কোডের মাধ্যমে নিবন্ধন করুন</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Channel Selector */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-primary-deep">
                    কোন মাধ্যমে ৬ সংখ্যার ভেরিফিকেশন কোড পেতে চান? *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setVerifyChannel("email")}
                      className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
                        verifyChannel === "email"
                          ? "bg-gradient-hero text-white shadow-card ring-2 ring-primary/30"
                          : "border border-border bg-white text-primary-deep hover:bg-muted/50"
                      }`}
                    >
                      <Mail className="h-3.5 w-3.5" /> ইমেইল কোড (OTP)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVerifyChannel("phone")}
                      className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition ${
                        verifyChannel === "phone"
                          ? "bg-gradient-hero text-white shadow-card ring-2 ring-primary/30"
                          : "border border-border bg-white text-primary-deep hover:bg-muted/50"
                      }`}
                    >
                      <Phone className="h-3.5 w-3.5" /> মোবাইল নাম্বার (OTP)
                    </button>
                  </div>
                </div>

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

                {/* Field 2: Email or Phone (Primary 6-Digit OTP Target) */}
                {verifyChannel === "email" ? (
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="flex items-center gap-1 text-xs font-bold text-primary-deep">
                        <Mail className="h-3.5 w-3.5 text-primary" /> সচল ইমেইল ঠিকানা (৬-ডিজিট কোড যাবে) *
                      </label>
                      {isTargetValid && (
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
                      required
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                ) : (
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="flex items-center gap-1 text-xs font-bold text-primary-deep">
                        <Phone className="h-3.5 w-3.5 text-primary" /> সচল মোবাইল নাম্বার (৬-ডিজিট কোড যাবে) *
                      </label>
                      {isTargetValid && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> সঠিক নাম্বার
                        </span>
                      )}
                    </div>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(toEnglishDigits(e.target.value))}
                      placeholder="01812345678 (বাংলা বা ইংরেজি সংখ্যায়)"
                      type="tel"
                      inputMode="tel"
                      required
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                )}

                {/* Field 3: Password & Confirm */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="flex items-center gap-1 text-xs font-bold text-primary-deep">
                        <Lock className="h-3.5 w-3.5 text-primary" /> নতুন পাসওয়ার্ড *
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

                {/* Collapsible Optional Fields */}
                <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setShowOptionalFields((v) => !v)}
                    className="flex w-full items-center justify-between text-left text-[11px] font-semibold text-muted-foreground hover:text-primary-deep"
                  >
                    <span>
                      ঐচ্ছিক তথ্য (কাস্টম ইউজারনেম বা{" "}
                      {verifyChannel === "email" ? "মোবাইল নাম্বার" : "ইমেইল"})
                    </span>
                    {showOptionalFields ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>

                  {showOptionalFields && (
                    <div className="mt-2.5 space-y-2.5 border-t border-border/60 pt-2.5">
                      <div>
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
                      {verifyChannel === "email" ? (
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                            মোবাইল নাম্বার (ঐচ্ছিক)
                          </label>
                          <input
                            value={phone}
                            onChange={(e) => setPhone(toEnglishDigits(e.target.value))}
                            placeholder="01XXXXXXXXX"
                            type="tel"
                            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">
                            ইমেইল ঠিকানা (ঐচ্ছিক)
                          </label>
                          <input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="example@gmail.com"
                            type="email"
                            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-hero py-3.5 text-sm font-bold text-primary-foreground shadow-elevated transition active:scale-[0.99] disabled:opacity-60"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>
                    {busy
                      ? "৬ সংখ্যার কোড পাঠানো হচ্ছে..."
                      : verifyChannel === "email"
                      ? "পরবর্তী ধাপ: ইমেইলে ৬ সংখ্যার কোড পাঠান"
                      : "পরবর্তী ধাপ: মোবাইলে ৬ সংখ্যার কোড পাঠান"}
                  </span>
                  <ArrowRight className="h-4 w-4 text-gold" />
                </button>
              </form>
            ) : (
              /* Step 2: Direct 6-Box OTP Code Verification (For BOTH Email & Mobile Number) */
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-800">
                      <ShieldCheck className="h-3.5 w-3.5" /> ধাপ ২: ৬ সংখ্যার ভেরিফিকেশন কোড যাচাই
                    </span>
                    <p className="mt-2.5 text-xs leading-relaxed text-foreground">
                      আপনার{" "}
                      <strong className="font-mono text-primary-deep">
                        {verifyChannel === "email" ? "ইমেইল" : "মোবাইল নাম্বার"} ({otpTargetDisplay})
                      </strong>
                      -এ পাঠানো ৬ সংখ্যার ভেরিফিকেশন কোডটি নিচের বক্সে লিখুন:
                    </p>
                  </div>

                  {/* 6-Box OTP Input */}
                  <div className="mt-4 flex justify-center gap-2">
                    {[0, 1, 2, 3, 4, 5].map((idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          otpInputRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpCode[idx] || ""}
                        onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className="h-12 w-11 rounded-xl border-2 border-primary/30 bg-white text-center font-mono text-lg font-extrabold text-primary-deep shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    ))}
                  </div>

                  <p className="mt-2 text-center text-[11px] text-muted-foreground">
                    {verifyChannel === "email"
                      ? "আপনার ইমেইলের Inbox বা Spam ফোল্ডারে প্রাপ্ত ৬ ডিজিট কোডটি লিখুন"
                      : "আপনার মোবাইলের SMS-এ প্রাপ্ত ৬ ডিজিট কোডটি লিখুন"}
                  </p>

                  <button
                    type="submit"
                    disabled={busy || otpCode.replace(/\D/g, "").length < 6}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-hero py-3.5 text-sm font-bold text-primary-foreground shadow-elevated transition active:scale-[0.99] disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-gold" />
                    )}
                    {busy ? "কোড যাচাই হচ্ছে..." : "ভেরিফাই ও নিবন্ধন সম্পন্ন করুন"}
                  </button>

                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="font-semibold text-muted-foreground hover:text-foreground"
                    >
                      ← তথ্য সংশোধন করুন
                    </button>
                    <button
                      type="button"
                      disabled={cooldown > 0 || busy}
                      onClick={() => {
                        setBusy(true);
                        void handleSendSixDigitOtp()
                          .catch((e) => toast.error(e.message))
                          .finally(() => setBusy(false));
                      }}
                      className="inline-flex items-center gap-1 font-bold text-primary-deep disabled:opacity-50"
                    >
                      <RefreshCcw className="h-3 w-3" />
                      {cooldown > 0 ? `পুনরায় পাঠান (${cooldown}s)` : "নতুন ৬-ডিজিট কোড পাঠান"}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
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