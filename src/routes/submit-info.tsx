import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Send, CheckCircle2, Upload } from "lucide-react";
import { useCategories } from "@/lib/store";
import { toast } from "sonner";
import { useCloudSubmissions, uploadPublicImage } from "@/lib/cloud";

export const Route = createFileRoute("/submit-info")({
  head: () => ({ meta: [{ title: "তথ্য দিন — স্মার্ট নোয়াখালী" }, { name: "description", content: "নতুন তথ্য জমা দিন। এডমিন অনুমোদনের পর প্রকাশিত হবে।" }] }),
  component: SubmitInfo,
});

function SubmitInfo() {
  const { categories } = useCategories();
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ category_slug: "", title: "", contact: "", address: "", designation: "", body: "", image_url: "" });
  const { add } = useCloudSubmissions();

  useEffect(() => {
    try {
      const pre = sessionStorage.getItem("submit-info:category");
      if (pre) {
        setForm((p) => ({ ...p, category_slug: pre }));
        sessionStorage.removeItem("submit-info:category");
      }
    } catch { /* ignore */ }
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) return toast.error("ছবি 4MB এর কম হতে হবে");
    setUploading(true);
    const url = await uploadPublicImage(f, "submissions");
    setUploading(false);
    if (!url) return toast.error("আপলোড ব্যর্থ");
    setForm((p) => ({ ...p, image_url: url }));
    toast.success("ছবি আপলোড হয়েছে");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category_slug || !form.title || !form.contact || !form.address) return toast.error("ক্যাটাগরি, নাম, ফোন ও ঠিকানা আবশ্যক");
    setSubmitting(true);
    const res = await add({
      category_slug: form.category_slug,
      title: form.title.trim(),
      contact: form.contact.trim(),
      address: form.address.trim(),
      designation: form.designation.trim() || undefined,
      body: form.body.trim() || undefined,
      image_url: form.image_url || undefined,
    });
    setSubmitting(false);
    if (!res.ok) return toast.error(res.error ?? "জমা দেওয়া যায়নি");
    setSubmitted(true);
    toast.success("তথ্য জমা হয়েছে। অনুমোদনের অপেক্ষায়।");
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-md px-4 pt-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="font-display text-xl font-bold text-primary-deep">ধন্যবাদ!</h1>
        <p className="mt-2 text-sm text-muted-foreground">আপনার তথ্য সফলভাবে জমা হয়েছে।</p>
        <Link to="/" className="mt-6 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">হোমে ফিরুন</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-4">
      <Link to="/" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> হোম</Link>
      <div className="mb-4 rounded-2xl bg-gradient-card p-4 shadow-card">
        <h1 className="font-display text-lg font-bold text-primary-deep">তথ্য দিন</h1>
        <p className="text-xs text-muted-foreground">এডমিন অনুমোদনের পর প্রকাশিত হবে।</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-card p-4 shadow-card">
        <Field label="ক্যাটাগরি *">
          <select required value={form.category_slug} onChange={(e) => setForm({ ...form, category_slug: e.target.value })} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
            <option value="">নির্বাচন করুন</option>
            {categories.filter((c) => !["submit-info", "admin", "about", "donation", "blood-donor", "chat", "app-download", "board-result"].includes(c.slug)).map((c) => (
              <option key={c.slug} value={c.slug}>{c.bn}</option>
            ))}
          </select>
        </Field>
        <Field label="নাম / শিরোনাম *"><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" /></Field>
        <Field label="ফোন নম্বর *"><input required value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} type="tel" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" /></Field>
        <Field label="ঠিকানা *"><input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" /></Field>
        <Field label="পদবি (ঐচ্ছিক)"><input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm" /></Field>
        <Field label="বিস্তারিত">
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm" />
        </Field>
        <Field label="ছবি (ঐচ্ছিক)">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-background px-3 py-3 text-sm">
            <Upload className="h-4 w-4 text-primary" />
            <span className="flex-1 text-muted-foreground">{uploading ? "আপলোড হচ্ছে..." : form.image_url ? "ছবি যোগ হয়েছে" : "ছবি বাছাই করুন"}</span>
            <input type="file" accept="image/*" className="hidden" onChange={onFile} />
          </label>
          {form.image_url && <img src={form.image_url} alt="" className="mt-2 h-24 w-24 rounded-lg object-cover" />}
        </Field>
        <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-hero py-3 font-semibold text-primary-foreground shadow-elevated disabled:opacity-60">
          <Send className="h-4 w-4" /> {submitting ? "জমা হচ্ছে..." : "জমা দিন"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}
