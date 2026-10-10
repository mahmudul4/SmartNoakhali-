import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, Copy, HandCoins, CheckCircle2, Send, Edit3, Save } from "lucide-react";
import { toast } from "sonner";
import { useCloudDonations } from "@/lib/cloud";
import { useDonationConfig, type DonationConfig } from "@/lib/store";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/donation")({
  head: () => ({
    meta: [
      { title: "অনুদান — স্মার্ট নোয়াখালী" },
      { name: "description", content: "bKash / Nagad এর মাধ্যমে অনুদান দিন এবং দাতাদের তালিকা দেখুন।" },
    ],
  }),
  component: DonationPage,
});

function DonationPage() {
  const { items, add } = useCloudDonations();
  const { config, activeNumbers, saveDonationConfig } = useDonationConfig();
  const { isMainAdmin } = useAuth();
  const [editingNumbers, setEditingNumbers] = useState(false);
  const [draftConfig, setDraftConfig] = useState<DonationConfig>(config);
  const [savingConfig, setSavingConfig] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ sender_name: "", sender_phone: "", method: "bkash" as "bkash" | "nagad", trx_id: "", amount: "", note: "" });

  useEffect(() => {
    setDraftConfig(config);
  }, [config]);

  const approved = useMemo(() => items.filter((i) => i.status === "approved"), [items]);
  const total = useMemo(() => approved.reduce((s, i) => s + Number(i.amount), 0), [approved]);

  function copy(num: string, label: string) {
    navigator.clipboard.writeText(num).then(() => toast.success(`${label} নম্বর কপি হয়েছে`));
  }

  async function handleSaveNumbers() {
    setSavingConfig(true);
    try {
      await saveDonationConfig(draftConfig);
      setEditingNumbers(false);
      toast.success("অনুদানের নাম্বার সফলভাবে আপডেট হয়েছে");
    } catch (e) {
      toast.error((e as Error).message || "আপডেট ব্যর্থ");
    } finally {
      setSavingConfig(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!form.sender_name || !form.sender_phone || !form.trx_id || !amt) {
      toast.error("সব আবশ্যিক ঘর পূরণ করুন");
      return;
    }
    if (amt <= 0) return toast.error("সঠিক টাকার পরিমাণ দিন");
    setSubmitting(true);
    const res = await add({
      sender_name: form.sender_name.trim(),
      sender_phone: form.sender_phone.trim(),
      method: form.method,
      trx_id: form.trx_id.trim(),
      amount: amt,
      note: form.note.trim() || undefined,
    });
    setSubmitting(false);
    if (!res.ok) return toast.error(res.error ?? "জমা দেওয়া যায়নি");
    setSubmitted(true);
    setForm({ sender_name: "", sender_phone: "", method: "bkash", trx_id: "", amount: "", note: "" });
    toast.success("অনুদান জমা হয়েছে — অনুমোদনের অপেক্ষায়");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> হোম</Link>
        {isMainAdmin && (
          <button
            type="button"
            onClick={() => setEditingNumbers((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-xs font-bold text-primary-deep ring-1 ring-gold/40"
          >
            <Edit3 className="h-3.5 w-3.5 text-primary" /> অনুদান নাম্বার পরিবর্তন করুন
          </button>
        )}
      </div>

      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-card p-4 shadow-card">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-amber-500/20 text-primary-deep">
          <HandCoins className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="font-display text-lg font-bold text-primary-deep">অনুদান</h1>
          <p className="text-xs text-muted-foreground">{config.subtitle}</p>
        </div>
      </div>

      {isMainAdmin && editingNumbers && (
        <div className="mb-4 space-y-3 rounded-2xl border border-primary/30 bg-card p-4 shadow-elevated">
          <p className="font-display text-sm font-bold text-primary-deep">সুপার এডমিন: অনুদানের নাম্বারসমূহ পরিবর্তন করুন</p>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">সাবটাইটেল বার্তা</label>
            <input
              value={draftConfig.subtitle}
              onChange={(e) => setDraftConfig({ ...draftConfig, subtitle: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            {draftConfig.numbers.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-3">
                <input
                  value={item.label}
                  onChange={(e) => {
                    const next = [...draftConfig.numbers];
                    next[idx] = { ...item, label: e.target.value };
                    setDraftConfig({ ...draftConfig, numbers: next });
                  }}
                  placeholder="লেবেল (যেমন: bKash Personal)"
                  className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold"
                />
                <input
                  value={item.number}
                  onChange={(e) => {
                    const next = [...draftConfig.numbers];
                    next[idx] = { ...item, number: e.target.value };
                    setDraftConfig({ ...draftConfig, numbers: next });
                  }}
                  placeholder="নাম্বার (যেমন: 01850999178)"
                  className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-mono font-bold"
                />
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input
                    type="checkbox"
                    checked={item.active}
                    onChange={(e) => {
                      const next = [...draftConfig.numbers];
                      next[idx] = { ...item, active: e.target.checked };
                      setDraftConfig({ ...draftConfig, numbers: next });
                    }}
                  />
                  সক্রিয় (প্রদর্শন করুন)
                </label>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={savingConfig}
              onClick={handleSaveNumbers}
              className="flex items-center gap-1.5 rounded-full bg-gradient-hero px-4 py-2 text-xs font-bold text-primary-foreground shadow-card"
            >
              <Save className="h-3.5 w-3.5" /> {savingConfig ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
            </button>
            <button
              type="button"
              onClick={() => setEditingNumbers(false)}
              className="rounded-full bg-muted px-4 py-2 text-xs font-semibold"
            >
              বাতিল
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 rounded-2xl bg-gradient-hero p-4 text-primary-foreground shadow-elevated">
        <p className="text-xs opacity-80">মোট অনুমোদিত অনুদান</p>
        <p className="font-display text-3xl font-extrabold text-gold">{total.toLocaleString("bn-BD")} টাকা</p>
        <p className="mt-1 text-[11px] opacity-80">{approved.length} জন দাতা</p>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        {activeNumbers.map((numItem) => (
          <PayCard
            key={numItem.id}
            label={numItem.label}
            number={numItem.number}
            onCopy={() => copy(numItem.number, numItem.label)}
            tone={numItem.tone}
          />
        ))}
      </div>

      {submitted ? (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <div className="text-sm">
            <p className="font-semibold text-primary-deep">ধন্যবাদ!</p>
            <p className="text-xs text-muted-foreground">এডমিন যাচাইয়ের পর আপনার নাম তালিকায় যোগ হবে।</p>
          </div>
          <button onClick={() => setSubmitted(false)} className="ml-auto rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">আরও দিন</button>
        </div>
      ) : (
        <form onSubmit={submit} className="mb-6 space-y-3 rounded-2xl bg-card p-4 shadow-card">
          <p className="font-display text-sm font-bold text-primary-deep">অনুদান জমা দিন</p>
          <Input value={form.sender_name} onChange={(v) => setForm({ ...form, sender_name: v })} placeholder="প্রেরকের নাম *" />
          <Input value={form.sender_phone} onChange={(v) => setForm({ ...form, sender_phone: v })} placeholder="প্রেরকের নম্বর *" type="tel" />
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm({ ...form, method: "bkash" })} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${form.method === "bkash" ? "border-pink-500 bg-pink-500/10 text-pink-700" : "border-border"}`}>bKash</button>
            <button type="button" onClick={() => setForm({ ...form, method: "nagad" })} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${form.method === "nagad" ? "border-orange-500 bg-orange-500/10 text-orange-700" : "border-border"}`}>Nagad</button>
          </div>
          <Input value={form.trx_id} onChange={(v) => setForm({ ...form, trx_id: v })} placeholder="TrxID (অদ্বিতীয়) *" />
          <Input value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} placeholder="টাকার পরিমাণ *" type="number" />
          <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="মন্তব্য (ঐচ্ছিক)" rows={2} className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-hero py-3 text-sm font-semibold text-primary-foreground shadow-elevated disabled:opacity-60">
            <Send className="h-4 w-4" /> {submitting ? "জমা হচ্ছে..." : "জমা দিন"}
          </button>
        </form>
      )}

      <div className="rounded-2xl bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-display text-sm font-bold text-primary-deep">দাতাদের তালিকা</p>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{approved.length}</span>
        </div>
        {approved.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">এখনো অনুমোদিত কোনো অনুদান নেই।</p>
        ) : (
          <ul className="divide-y divide-border">
            {approved.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-medium">{d.sender_name}</span>
                <span className="rounded-md bg-gold/15 px-2 py-0.5 text-xs font-bold text-primary-deep">{Number(d.amount).toLocaleString("bn-BD")} টাকা</span>
              </li>
            ))}
            <li className="flex items-center justify-between pt-3 text-sm font-bold">
              <span>মোট</span>
              <span className="text-primary-deep">{total.toLocaleString("bn-BD")} টাকা</span>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

function PayCard({ label, number, onCopy, tone }: { label: string; number: string; onCopy: () => void; tone: string }) {
  return (
    <div className={`flex items-center justify-between rounded-2xl bg-gradient-to-br ${tone} p-4 text-white shadow-card`}>
      <div>
        <p className="text-xs opacity-90">{label}</p>
        <p className="font-display text-lg font-bold">{number}</p>
      </div>
      <button onClick={onCopy} className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold backdrop-blur active:scale-95">
        <Copy className="h-3.5 w-3.5" /> কপি
      </button>
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
  );
}
