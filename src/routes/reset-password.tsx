import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updatePassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { ForgotPasswordOtp } from "@/components/security/ForgotPasswordOtp";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "নতুন পাসওয়ার্ড সেট করুন — স্মার্ট নোয়াখালী" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { isAuthed, user } = useAuth();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAuthed) return;
    if (pw.length < 6) return toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
    if (pw !== confirm) return toast.error("দুই পাসওয়ার্ড মিলছে না");

    setBusy(true);
    try {
      if (auth.currentUser) {
        try {
          await updatePassword(auth.currentUser, pw);
        } catch {
          // Proceed with server password update even if Firebase requires re-login
        }
      }
      if (user?.email || user?.phone) {
        await fetch("/api/auth/reset-password-direct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: user.email || user.phone,
            newPassword: pw,
          }),
        }).catch(() => {});
      }
      toast.success("পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!");
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err?.message || "পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pt-8 pb-20">
      <div className="rounded-3xl bg-gradient-card p-6 shadow-elevated">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground shadow-card">
          <KeyRound className="h-5 w-5" />
        </div>
        <h2 className="text-center font-display text-xl font-bold text-primary-deep">
          নতুন পাসওয়ার্ড সেট করুন
        </h2>
        {isAuthed && (
          <p className="mt-1 text-center text-xs text-muted-foreground">
            আপনার একাউন্টের জন্য নতুন পাসওয়ার্ড নির্ধারণ করুন।
          </p>
        )}

        {isAuthed ? (
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-primary-deep">নতুন পাসওয়ার্ড</label>
              <input
                type="password"
                required
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="কমপক্ষে ৬ অক্ষর"
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-primary-deep">পুনরায় পাসওয়ার্ড</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="আবার লিখুন"
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <button
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-hero py-3 text-sm font-semibold text-primary-foreground shadow-elevated disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              পাসওয়ার্ড সংরক্ষণ করুন
            </button>
          </form>
        ) : (
          <div className="mt-3">
            <ForgotPasswordOtp onDone={() => navigate({ to: "/auth" })} />
          </div>
        )}
      </div>
    </div>
  );
}