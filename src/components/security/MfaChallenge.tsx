import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { verifyTotp, useBackupCode } from "@/lib/security";

/** Second login step: 6-digit authenticator code, or a one-time backup code. */
export function MfaChallenge({ onSuccess, onCancel }: { onSuccess: () => void; onCancel?: () => void }) {
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (backup) await useBackupCode(code);
      else await verifyTotp(code);
      toast.success("যাচাই সফল");
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ভুল যাচাইকরণ কোড।");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl bg-gradient-card p-6 shadow-elevated">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground"><ShieldCheck className="h-6 w-6" /></div>
      <h1 className="text-center font-display text-xl font-bold text-primary-deep">দুই ধাপের যাচাই</h1>
      <p className="mt-1 text-center text-xs text-muted-foreground">
        {backup ? "আপনার একটি ব্যাকআপ কোড লিখুন।" : "Google Authenticator অ্যাপে দেখানো ৬ সংখ্যার কোড লিখুন।"}
      </p>
      <input value={code} onChange={(e) => setCode(e.target.value)} inputMode={backup ? "text" : "numeric"} autoComplete="one-time-code"
        placeholder={backup ? "XXXXX-XXXXX" : "123456"} required
        className="mt-5 w-full rounded-xl border bg-background px-3 py-3 text-center text-lg tracking-widest" />
      <button disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-hero py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />} যাচাই করুন
      </button>
      <button type="button" onClick={() => { setBackup(!backup); setCode(""); }} className="mt-3 block w-full text-center text-xs text-primary-deep underline">
        {backup ? "অথেনটিকেটর কোড ব্যবহার করুন" : "অ্যাপ নেই? ব্যাকআপ কোড ব্যবহার করুন"}
      </button>
      {onCancel && <button type="button" onClick={onCancel} className="mt-2 block w-full text-center text-xs text-muted-foreground">বাতিল ও লগআউট</button>}
    </form>
  );
}
