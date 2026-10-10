import { useState } from "react";
import { CheckCircle2, Loader2, Mail, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { logAnon } from "@/lib/security";

export function ForgotPasswordOtp({ onDone }: { onDone: () => void }) {
  const [channel, setChannel] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const resp = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          email: email.trim(),
          phone: phone.trim(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || "৬ সংখ্যার কোড পাঠানো যায়নি");
      }
      if (data.otpToken) {
        setOtpToken(String(data.otpToken));
      }
      await logAnon(channel === "email" ? email.trim() : phone.trim(), "password_reset_requested");
      setOtpSent(true);
      toast.success(data.message || "৬ সংখ্যার ভেরিফিকেশন কোড পাঠানো হয়েছে!");
    } catch (err: any) {
      toast.error(err?.message ?? "ত্রুটি");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyAndReset(e: React.FormEvent) {
    e.preventDefault();
    if (code.replace(/\D/g, "").length < 6) {
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
          code: code.trim(),
          newPassword,
          otpToken,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        throw new Error(data.error || "পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে");
      }
      toast.success("পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে! এখন লগইন করুন।");
      onDone();
    } catch (err: any) {
      toast.error(err?.message ?? "ত্রুটি");
    } finally {
      setBusy(false);
    }
  }

  if (!otpSent) {
    return (
      <form onSubmit={handleRequestOtp} className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setChannel("email")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
              channel === "email"
                ? "bg-gradient-hero text-white shadow-card"
                : "border border-border bg-white text-primary-deep"
            }`}
          >
            <Mail className="h-3.5 w-3.5" /> ইমেইল কোড
          </button>
          <button
            type="button"
            onClick={() => setChannel("phone")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition ${
              channel === "phone"
                ? "bg-gradient-hero text-white shadow-card"
                : "border border-border bg-white text-primary-deep"
            }`}
          >
            <Phone className="h-3.5 w-3.5" /> মোবাইল কোড
          </button>
        </div>

        {channel === "email" ? (
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="আপনার নিবন্ধিত ইমেইল ঠিকানা"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
        ) : (
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="আপনার নিবন্ধিত মোবাইল নাম্বার (01XXXXXXXXX)"
            className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:border-primary"
          />
        )}

        <button
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-hero py-3 text-sm font-bold text-primary-foreground shadow-elevated disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} ৬ সংখ্যার ভেরিফিকেশন কোড পাঠান
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyAndReset} className="mt-3 space-y-3">
      <div className="rounded-xl bg-emerald-500/10 p-3 text-center text-xs text-emerald-900">
        <ShieldCheck className="mx-auto mb-1 h-4 w-4 text-emerald-700" />
        আপনার {channel === "email" ? `ইমেইল (${email})` : `মোবাইল নাম্বার (${phone})`}-এ পাঠানো ৬
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
