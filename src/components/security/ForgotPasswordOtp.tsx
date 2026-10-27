import { useState, useEffect } from "react";
import { CheckCircle2, Loader2, Mail, Phone, ShieldCheck, KeyRound, ArrowRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { logAnon } from "@/lib/security";

type ResetMethod = "email_link" | "email_otp" | "phone_otp";

/**
 * Safely parses fetch response body without throwing "Unexpected end of JSON input".
 */
async function safeParseJsonResponse(resp: Response): Promise<{ ok: boolean; status: number; data: any; rawText: string }> {
  let rawText = "";
  try {
    rawText = await resp.text();
  } catch {
    rawText = "";
  }

  let data: any = {};
  if (rawText && rawText.trim().length > 0) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { error: "সার্ভার থেকে সঠিক রেসপন্স পাওয়া যায়নি" };
    }
  }

  return {
    ok: resp.ok && (data.ok !== false),
    status: resp.status,
    data,
    rawText,
  };
}

export function ForgotPasswordOtp({ onDone }: { onDone: () => void }) {
  const [method, setMethod] = useState<ResetMethod>("email_link");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  // Firebase Email Reset Link state
  const [emailLinkSent, setEmailLinkSent] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // OTP flow state
  const [otpSent, setOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Cooldown countdown effect
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  /**
   * Part 3: Firebase Native Password Reset Email Flow
   * User enters email -> Validate email -> Send password reset email -> Show confirmation
   */
  async function handleSendFirebaseResetLink(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return toast.error("অনুগ্রহ করে একটি সঠিক ও কার্যকর ইমেইল ঠিকানা প্রদান করুন");
    }

    if (cooldownSeconds > 0) {
      return toast.info(`অনুগ্রহ করে পুনরায় অনুরোধের জন্য ${cooldownSeconds} সেকেন্ড অপেক্ষা করুন।`);
    }

    setBusy(true);
    try {
      // Firebase standard password reset email
      await sendPasswordResetEmail(auth, cleanEmail);

      await logAnon(cleanEmail, "password_reset_requested");
      setEmailLinkSent(true);
      setCooldownSeconds(60);
      toast.success("পাসওয়ার্ড রিসেট লিংক সফলভাবে আপনার ইমেইলে পাঠানো হয়েছে!");
    } catch (err: any) {
      const code = String(err?.code || "");
      console.warn("Firebase password reset notice:", err);

      if (code === "auth/invalid-email") {
        toast.error("সঠিক ও বৈধ ইমেইল ঠিকানা প্রদান করুন।");
      } else if (code === "auth/user-not-found") {
        // Prevent user enumeration attacks while still reassuring genuine users
        setEmailLinkSent(true);
        setCooldownSeconds(60);
        toast.success("যদি এই ইমেইলটি নিবন্ধিত থাকে, তবে পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে।");
      } else if (code === "auth/too-many-requests") {
        toast.error("অনেকবার চেষ্টা করা হয়েছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন।");
        setCooldownSeconds(60);
      } else if (code === "auth/network-request-failed") {
        toast.error("ইন্টারনেট সংযোগে সমস্যা দেখা দিয়েছে। সংযোগ চেক করে পুনরায় চেষ্টা করুন।");
      } else {
        toast.error(err?.message || "পাসওয়ার্ড রিসেট লিংক পাঠানো যায়নি।");
      }
    } finally {
      setBusy(false);
    }
  }

  /**
   * OTP Request Flow with safe JSON response parsing
   */
  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    const channel = method === "phone_otp" ? "phone" : "email";
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();

    if (channel === "email" && (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))) {
      return toast.error("সঠিক ইমেইল ঠিকানা দিন");
    }
    if (channel === "phone" && cleanPhone.replace(/\D/g, "").length < 11) {
      return toast.error("সঠিক ১১ সংখ্যার মোবাইল নাম্বার দিন");
    }

    setBusy(true);
    try {
      const resp = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          email: cleanEmail,
          phone: cleanPhone,
        }),
      });

      const parsed = await safeParseJsonResponse(resp);
      if (!parsed.ok) {
        throw new Error(parsed.data?.error || "৬ সংখ্যার কোড পাঠানো যায়নি");
      }

      if (parsed.data?.otpToken) {
        setOtpToken(String(parsed.data.otpToken));
      }
      await logAnon(channel === "email" ? cleanEmail : cleanPhone, "password_reset_requested");
      setOtpSent(true);
      toast.success(parsed.data?.message || "৬ সংখ্যার ভেরিফিকেশন কোড পাঠানো হয়েছে!");
    } catch (err: any) {
      toast.error(err?.message ?? "কোড পাঠানো সম্ভব হয়নি");
    } finally {
      setBusy(false);
    }
  }

  /**
   * OTP Verification & Password Reset with safe JSON parsing
   */
  async function handleVerifyAndReset(e: React.FormEvent) {
    e.preventDefault();
    const channel = method === "phone_otp" ? "phone" : "email";
    const cleanCode = code.replace(/\D/g, "");

    if (cleanCode.length < 6) {
      return toast.error("৬ সংখ্যার ভেরিফিকেশন কোডটি দিন");
    }
    if (newPassword.length < 6) {
      return toast.error("নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
    }

    setBusy(true);
    try {
      const resp = await fetch("/api/auth/reset-password-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          email: email.trim(),
          phone: phone.trim(),
          code: cleanCode,
          newPassword,
          otpToken,
        }),
      });

      const parsed = await safeParseJsonResponse(resp);
      if (!parsed.ok) {
        throw new Error(parsed.data?.error || "পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে");
      }

      toast.success("পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে! এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।");
      onDone();
    } catch (err: any) {
      toast.error(err?.message ?? "ত্রুটি হয়েছে, আবার চেষ্টা করুন");
    } finally {
      setBusy(false);
    }
  }

  // 1. Firebase Reset Link Confirmation View
  if (emailLinkSent && method === "email_link") {
    return (
      <div className="mt-3 space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-700">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-display text-base font-bold text-emerald-950">
            রিসেট লিংক পাঠানো হয়েছে!
          </h3>
          <p className="mt-1 text-xs text-emerald-900 leading-relaxed">
            <span className="font-bold text-foreground">{email}</span> ঠিকানায় একটি পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে। আপনার ইমেইল ইনবক্স অথবা স্প্যাম (Spam/Junk) ফোল্ডার চেক করে লিংকে ক্লিক করুন।
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={onDone}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-hero py-2.5 text-xs font-bold text-primary-foreground shadow-elevated"
          >
            <span>লগইন পেজে যান</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            disabled={busy || cooldownSeconds > 0}
            onClick={handleSendFirebaseResetLink}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-background py-2 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" />
            {cooldownSeconds > 0
              ? `পুনরায় পাঠাতে অপেক্ষা করুন (${cooldownSeconds}s)`
              : "আবার লিংক পাঠান"}
          </button>
        </div>
      </div>
    );
  }

  // 2. OTP Verification View
  if (otpSent && (method === "email_otp" || method === "phone_otp")) {
    return (
      <form onSubmit={handleVerifyAndReset} className="mt-3 space-y-3">
        <div className="rounded-xl bg-emerald-500/10 p-3 text-center text-xs text-emerald-900">
          <ShieldCheck className="mx-auto mb-1 h-4 w-4 text-emerald-700" />
          আপনার {method === "email_otp" ? `ইমেইল (${email})` : `মোবাইল নাম্বার (${phone})`}-এ পাঠানো ৬
          সংখ্যার কোড ও নতুন পাসওয়ার্ড দিন।
        </div>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.slice(0, 6))}
          placeholder="৬ সংখ্যার ভেরিফিকেশন কোড"
          className="w-full rounded-xl border border-primary/40 bg-background px-3.5 py-2.5 text-center font-mono text-base font-bold tracking-[0.3em] outline-none focus:border-primary"
        />
        <input
          type="password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)"
          className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-hero py-3 text-sm font-bold text-primary-foreground shadow-elevated disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          পাসওয়ার্ড পরিবর্তন সম্পন্ন করুন
        </button>
      </form>
    );
  }

  // 3. Selection and Email / Phone Form
  return (
    <div className="mt-3 space-y-3">
      {/* Recovery Method Tabs */}
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-muted/60 p-1">
        <button
          type="button"
          onClick={() => setMethod("email_link")}
          className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-bold transition ${
            method === "email_link"
              ? "bg-card text-primary-deep shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Mail className="h-3.5 w-3.5 text-primary" />
          <span>ইমেইল লিংক</span>
        </button>
        <button
          type="button"
          onClick={() => setMethod("email_otp")}
          className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-bold transition ${
            method === "email_otp"
              ? "bg-card text-primary-deep shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>ইমেইল ওটিপি</span>
        </button>
        <button
          type="button"
          onClick={() => setMethod("phone_otp")}
          className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-bold transition ${
            method === "phone_otp"
              ? "bg-card text-primary-deep shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Phone className="h-3.5 w-3.5 text-amber-600" />
          <span>মোবাইল কোড</span>
        </button>
      </div>

      {method === "email_link" ? (
        <form onSubmit={handleSendFirebaseResetLink} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            আপনার অ্যাকাউন্টের নিবন্ধিত ইমেইল ঠিকানা দিলে একটি নিরাপদ পাসওয়ার্ড রিসেট লিংক পাঠানো হবে।
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold text-primary-deep">
              নিবন্ধিত ইমেইল ঠিকানা
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="যেমন: user@example.com"
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <button
            type="submit"
            disabled={busy || cooldownSeconds > 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-hero py-3 text-sm font-bold text-primary-foreground shadow-elevated disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4 text-gold" />
            )}
            {cooldownSeconds > 0
              ? `অপেক্ষা করুন (${cooldownSeconds}s)`
              : "রিসেট লিংক পাঠান"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRequestOtp} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {method === "email_otp"
              ? "আপনার ইমেইলে ৬ সংখ্যার ওটিপি কোড পাঠানো হবে।"
              : "আপনার মোবাইল নাম্বারে ৬ সংখ্যার ওটিপি কোড পাঠানো হবে।"}
          </p>

          {method === "email_otp" ? (
            <div>
              <label className="mb-1 block text-xs font-semibold text-primary-deep">
                নিবন্ধিত ইমেইল ঠিকানা
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="আপনার নিবন্ধিত ইমেইল ঠিকানা"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-semibold text-primary-deep">
                নিবন্ধিত মোবাইল নাম্বার
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="যেমন: 018XXXXXXXX"
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-primary"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-hero py-3 text-sm font-bold text-primary-foreground shadow-elevated disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} ৬ সংখ্যার ভেরিফিকেশন কোড পাঠান
          </button>
        </form>
      )}
    </div>
  );
}
