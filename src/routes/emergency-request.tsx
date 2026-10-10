import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Droplet, Send } from "lucide-react";
import { toast } from "sonner";
import { useEmergencyRequests } from "@/lib/cloud";

export const Route = createFileRoute("/emergency-request")({
  head: () => ({ meta: [{ title: "জরুরী রক্তের অনুরোধ — স্মার্ট নোয়াখালী" }] }),
  component: Page,
});

const GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function Page() {
  const { add } = useEmergencyRequests();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ patient_name: "", phone: "", blood_group: "", hospital: "", message: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patient_name || !form.phone || !form.blood_group) return toast.error("নাম, ফোন ও রক্তের গ্রুপ আবশ্যক");
    setBusy(true);
    const res = await add(form);
    setBusy(false);
    if (!res.ok) return toast.error(res.error || "ত্রুটি");
    toast.success("অনুরোধ জমা হয়েছে। অনুমোদনের পর সবাই দেখতে পাবে।");
    setForm({ patient_name: "", phone: "", blood_group: "", hospital: "", message: "" });
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-24 pt-4">
      <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> হোম</Link>
      <div className="rounded-3xl bg-gradient-to-br from-rose-500/10 to-rose-700/5 p-5 shadow-elevated">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-sm">
          <Droplet className="h-6 w-6" />
        </div>
        <h1 className="text-center font-display text-xl font-bold text-rose-700">জরুরী রক্তের অনুরোধ</h1>
        <p className="mt-1 text-center text-xs text-muted-foreground">এডমিন অনুমোদনের পর হোমে দৃশ্যমান হবে</p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <Input label="রোগীর নাম *" value={form.patient_name} onChange={(v) => setForm({ ...form, patient_name: v })} />
          <Input label="যোগাযোগ ফোন *" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">রক্তের গ্রুপ *</label>
            <select value={form.blood_group} onChange={(e) => setForm({ ...form, blood_group: e.target.value })} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-bold text-rose-600">
              <option value="">নির্বাচন করুন</option>
              {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <Input label="হাসপাতাল" value={form.hospital} onChange={(v) => setForm({ ...form, hospital: v })} />
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">বার্তা</label>
            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3} className="w-full rounded-xl border border-border bg-background p-3 text-sm" />
          </div>
          <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-rose-600 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60">
            <Send className="h-4 w-4" /> {busy ? "জমা হচ্ছে..." : "অনুরোধ জমা দিন"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
    </div>
  );
}
