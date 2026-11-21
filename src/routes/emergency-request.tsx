import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Droplet, Send } from "lucide-react";
import { toast } from "sonner";
import { useEmergencyRequests } from "@/lib/cloud";

export const Route = createFileRoute("/emergency-request")({
  head: () => ({ meta: [{ title: "জরুরি রক্তের অনুরোধ — স্মার্ট নোয়াখালী" }] }),
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
    <div className="w-full px-3.5 pb-24 pt-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
      <Link to="/" className="mb-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-[#5F5F5A] hover:text-[#1C1C1C]">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> হোম
      </Link>
      <div className="mx-auto max-w-xl rounded-[12px] border border-[#E6E1D6] bg-white p-5 sm:p-6">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#C62828]/10 text-[#C62828]">
          <Droplet className="h-6 w-6" strokeWidth={1.5} />
        </div>
        <h1 className="text-center font-display text-xl font-bold text-[#C62828]">জরুরি রক্তের অনুরোধ</h1>
        <p className="mt-1 text-center text-xs text-[#5F5F5A]">এডমিন অনুমোদনের পর হোমে দৃশ্যমান হবে</p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <Input label="রোগীর নাম *" value={form.patient_name} onChange={(v) => setForm({ ...form, patient_name: v })} />
          <Input label="যোগাযোগ ফোন *" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#5F5F5A]">রক্তের গ্রুপ *</label>
            <select value={form.blood_group} onChange={(e) => setForm({ ...form, blood_group: e.target.value })} className="min-h-[44px] w-full rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] px-3 py-2.5 text-sm font-bold text-[#C62828] outline-none focus:border-[#0F4D3A]">
              <option value="">নির্বাচন করুন</option>
              {GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <Input label="হাসপাতাল" value={form.hospital} onChange={(v) => setForm({ ...form, hospital: v })} />
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#5F5F5A]">বার্তা</label>
            <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3} className="w-full rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] p-3 text-sm text-[#1C1C1C] outline-none focus:border-[#0F4D3A]" />
          </div>
          <button disabled={busy} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#C62828] py-3 text-sm font-bold text-white transition hover:bg-[#B71C1C] disabled:opacity-60">
            <Send className="h-4 w-4" strokeWidth={1.5} /> {busy ? "জমা হচ্ছে..." : "অনুরোধ জমা দিন"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[#5F5F5A]">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[44px] w-full rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] px-3 py-2.5 text-sm text-[#1C1C1C] outline-none focus:border-[#0F4D3A]" />
    </div>
  );
}
