import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Upload, Droplet, Phone, Send, HeartPulse, CheckCircle2, XCircle, Search, X, MapPin, Edit3, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { useCloudDonors, useCloudDonorEvents, uploadPublicImage, type DonorRow } from "@/lib/cloud";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/blood-donor")({
  head: () => ({ meta: [{ title: "রক্তদাতা — স্মার্ট নোয়াখালী" }] }),
  component: BloodPage,
});

const GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

function BloodPage() {
  const { items, add, update, remove } = useCloudDonors();
  const { add: addEvent } = useCloudDonorEvents();
  const { isAdmin } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<string>("");
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [donatedFor, setDonatedFor] = useState<DonorRowMini | null>(null);
  const [editingDonor, setEditingDonor] = useState<DonorRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const approved = useMemo(() => items.filter((d) => d.status === "approved"), [items]);
  const filtered = approved.filter((d) =>
    (groupFilter ? d.blood_group === groupFilter : true) &&
    [d.full_name, d.address, d.phone].filter(Boolean).join(" ").toLowerCase().includes(filter.toLowerCase())
  );

  async function handleSaveDonorEdit() {
    if (!editingDonor) return;
    setSavingEdit(true);
    const { error } = await update(editingDonor.id, {
      full_name: editingDonor.full_name,
      phone: editingDonor.phone,
      blood_group: editingDonor.blood_group,
      address: editingDonor.address,
      total_donations: Number(editingDonor.total_donations) || 0,
      last_donation_date: editingDonor.last_donation_date,
    });
    setSavingEdit(false);
    if (error) return toast.error(error.message);
    toast.success("রক্তদাতার তথ্য আপডেট হয়েছে");
    setEditingDonor(null);
  }

  async function handleDeleteDonor(id: string) {
    if (!isAdmin) return;
    const { error } = await remove(id);
    if (error) toast.error(error.message);
    else toast.success("রক্তদাতার তথ্য মুছে ফেলা হয়েছে");
  }

  return (
    <div className="mx-auto w-full max-w-3xl overflow-x-hidden px-3.5 pb-24 pt-4 sm:px-4">
      <Link to="/" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 shrink-0" /> হোম
      </Link>

      <div className="mb-4 flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl bg-gradient-card p-3.5 shadow-card sm:p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600 sm:h-12 sm:w-12">
          <Droplet className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-bold text-primary-deep">রক্তদাতা</h1>
          <p className="truncate text-xs text-muted-foreground">{approved.length} জন স্বেচ্ছা রক্তদাতা</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="shrink-0 rounded-full bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition active:scale-95"
        >
          {showForm ? "বন্ধ" : "নিবন্ধন"}
        </button>
      </div>

      {showForm && <DonorForm onDone={() => setShowForm(false)} addDonor={add} />}

      <div className="mb-3 flex w-full min-w-0 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="নাম / ঠিকানা / ফোন..."
            className="w-full min-w-0 rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm shadow-card outline-none focus:border-primary"
          />
        </div>
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="shrink-0 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-bold text-rose-600 shadow-card outline-none"
        >
          <option value="">সব গ্রুপ</option>
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div className="grid w-full min-w-0 grid-cols-1 gap-3">
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            কোনো রক্তদাতা নেই।
          </div>
        )}
        {filtered.map((d) => (
          <DonorCard
            key={d.id}
            d={d}
            isAdmin={isAdmin}
            onDonate={() => setDonatedFor(d)}
            onEdit={() => setEditingDonor({ ...d })}
            onDelete={() => void handleDeleteDonor(d.id)}
          />
        ))}
      </div>

      {editingDonor && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
          onClick={() => setEditingDonor(null)}
        >
          <div
            className="w-full max-w-sm space-y-2.5 rounded-2xl bg-card p-4 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-sm font-bold text-primary-deep">রক্তদাতা সম্পাদনা</p>
            <input
              value={editingDonor.full_name}
              onChange={(e) => setEditingDonor({ ...editingDonor, full_name: e.target.value })}
              placeholder="পূর্ণ নাম"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={editingDonor.phone}
              onChange={(e) => setEditingDonor({ ...editingDonor, phone: e.target.value })}
              placeholder="ফোন নম্বর"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <select
              value={editingDonor.blood_group}
              onChange={(e) =>
                setEditingDonor({
                  ...editingDonor,
                  blood_group: e.target.value as DonorRow["blood_group"],
                })
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold text-rose-600"
            >
              {GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <input
              value={editingDonor.address ?? ""}
              onChange={(e) => setEditingDonor({ ...editingDonor, address: e.target.value })}
              placeholder="ঠিকানা"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={editingDonor.total_donations}
              onChange={(e) =>
                setEditingDonor({ ...editingDonor, total_donations: Number(e.target.value) })
              }
              placeholder="মোট রক্তদান সংখ্যা"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => void handleSaveDonorEdit()}
                className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
              >
                <Save className="h-3.5 w-3.5" /> সংরক্ষণ
              </button>
              <button
                type="button"
                onClick={() => setEditingDonor(null)}
                className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}

      {donatedFor && (
        <DonatedModal
          donor={donatedFor}
          onClose={() => setDonatedFor(null)}
          onSubmit={async (payload) => {
            const { error } = await addEvent({ donor_id: donatedFor.id, ...payload });
            if (error) {
              toast.error(error.message);
              return false;
            }
            toast.success("ধন্যবাদ! আপনার রক্তদান এডমিনের কাছে পাঠানো হয়েছে।");
            return true;
          }}
        />
      )}
    </div>
  );
}

type DonorRowMini = { id: string; full_name: string; blood_group: string };

function DonorForm({ onDone, addDonor }: { onDone: () => void; addDonor: ReturnType<typeof useCloudDonors>["add"] }) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    blood_group: "" as "" | (typeof GROUPS)[number],
    address: "",
    age: "",
    last_donation_date: "",
    total_donations: "",
  });
  const [photo_url, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const url = await uploadPublicImage(f, "donors");
    setUploading(false);
    if (!url) return toast.error("আপলোড ব্যর্থ");
    setPhoto(url);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name || !form.phone || !form.blood_group || !form.address || !form.last_donation_date || form.total_donations === "") {
      return toast.error("সব আবশ্যক ঘর পূরণ করুন");
    }
    setSubmitting(true);
    const res = await addDonor({
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      blood_group: form.blood_group as (typeof GROUPS)[number],
      address: form.address.trim(),
      age: form.age ? Number(form.age) : undefined,
      last_donation_date: form.last_donation_date,
      total_donations: Number(form.total_donations) || 0,
      photo_url,
    });
    setSubmitting(false);
    if (!res.ok) return toast.error(res.error ?? "জমা দেওয়া যায়নি");
    toast.success("নিবন্ধন জমা হয়েছে — অনুমোদনের অপেক্ষায়");
    onDone();
  }

  return (
    <form onSubmit={submit} className="mb-4 w-full min-w-0 space-y-3 overflow-hidden rounded-2xl bg-card p-4 shadow-card">
      <p className="font-display text-sm font-bold text-primary-deep">রক্তদাতা নিবন্ধন</p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <input
          required
          placeholder="পূর্ণ নাম *"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          className="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
        />
        <input
          required
          placeholder="ফোন *"
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
        />
        <select
          required
          value={form.blood_group}
          onChange={(e) => setForm({ ...form, blood_group: e.target.value as (typeof GROUPS)[number] })}
          className="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-bold text-rose-600"
        >
          <option value="">রক্তের গ্রুপ *</option>
          {GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <input
          placeholder="বয়স"
          type="number"
          min={16}
          max={80}
          value={form.age}
          onChange={(e) => setForm({ ...form, age: e.target.value })}
          className="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
        />
      </div>
      <input
        required
        placeholder="ঠিকানা *"
        value={form.address}
        onChange={(e) => setForm({ ...form, address: e.target.value })}
        className="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
      />
      <input
        required
        type="number"
        min={0}
        max={500}
        placeholder="মোট রক্তদান *"
        value={form.total_donations}
        onChange={(e) => setForm({ ...form, total_donations: e.target.value })}
        className="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
      />
      <label className="block w-full min-w-0">
        <span className="mb-1 block text-xs text-muted-foreground">শেষ রক্তদানের তারিখ *</span>
        <input
          required
          type="date"
          value={form.last_donation_date}
          onChange={(e) => setForm({ ...form, last_donation_date: e.target.value })}
          className="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
        />
      </label>
      <label className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-background px-3 py-3 text-sm transition hover:bg-muted/40">
        <Upload className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-muted-foreground">
          {uploading ? "আপলোড ও প্রসেস হচ্ছে..." : photo_url ? "ছবি যোগ হয়েছে (পরিবর্তন করতে চাপুন)" : "রক্তদাতার ছবি (ঐচ্ছিক)"}
        </span>
        <input type="file" accept="image/*" className="hidden" onChange={onFile} />
      </label>
      {photo_url && (
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-2">
          <img src={photo_url} alt="Donor preview" className="h-14 w-14 rounded-full border border-primary/20 object-cover" />
          <div className="flex-1 text-xs">
            <p className="font-semibold text-emerald-700">ছবি সফলভাবে সংযুক্ত হয়েছে</p>
            <button
              type="button"
              onClick={() => setPhoto(null)}
              className="mt-0.5 text-[11px] font-semibold text-destructive hover:underline"
            >
              ছবি মুছে ফেলুন
            </button>
          </div>
        </div>
      )}
      <button
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        <Send className="h-4 w-4 shrink-0" /> {submitting ? "জমা হচ্ছে..." : "নিবন্ধন করুন"}
      </button>
    </form>
  );
}

function daysAgo(iso: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function DonorCard({
  d,
  isAdmin,
  onDonate,
  onEdit,
  onDelete,
}: {
  d: {
    id: string;
    full_name: string;
    phone: string;
    blood_group: string;
    address: string | null;
    photo_url: string | null;
    total_donations: number;
    last_donation_date: string | null;
  };
  isAdmin: boolean;
  onDonate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const days = daysAgo(d.last_donation_date);
  const available = days === null || days >= 90;
  return (
    <div className="w-full max-w-full min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-gradient-card p-3.5 shadow-card sm:p-4">
      <div className="flex w-full min-w-0 items-center justify-between gap-2.5 sm:gap-3">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rose-500/10 text-rose-600 ring-2 ring-rose-500/20 sm:h-12 sm:w-12">
          {d.photo_url ? (
            <img
              src={d.photo_url}
              alt={d.full_name}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = "none";
                const fb = (e.currentTarget.parentElement?.querySelector(".fallback-droplet") as HTMLElement);
                if (fb) fb.classList.remove("hidden");
              }}
            />
          ) : null}
          <div className={`fallback-droplet flex h-full w-full items-center justify-center ${d.photo_url ? "hidden" : ""}`}>
            <Droplet className="h-5 w-5 sm:h-6 sm:w-6 text-rose-600" />
          </div>
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="min-w-0 truncate text-sm font-bold text-foreground sm:text-base">{d.full_name}</p>
            <span className="shrink-0 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[11px] font-extrabold text-rose-600">
              {d.blood_group}
            </span>
          </div>
          {d.address && (
            <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0 text-rose-500" />
              <span className="truncate">{d.address}</span>
            </p>
          )}
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            শেষ দান: {days !== null ? `${days} দিন আগে` : "—"} • মোট: {d.total_donations} বার
          </p>
        </div>

        <a
          href={`tel:${d.phone}`}
          aria-label={`কল করুন ${d.full_name}`}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-gold px-3.5 py-2 text-xs font-extrabold text-primary-deep shadow-gold transition hover:brightness-105 active:scale-95"
        >
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <span>কল</span>
        </a>
      </div>

      <div className="mt-3 flex w-full min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2">
        {available ? (
          <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-primary">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="truncate">রক্তদানের জন্য উপলব্ধ</span>
          </span>
        ) : (
          <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-destructive">
            <XCircle className="h-4 w-4 shrink-0" />
            <span className="truncate">{90 - (days ?? 0)} দিন বাকি</span>
          </span>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-1 text-[11px] font-semibold text-blue-800"
              >
                <Edit3 className="h-3 w-3" /> এডিট
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-1 text-[11px] font-semibold text-destructive"
              >
                <Trash2 className="h-3 w-3" /> ডিলিট
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onDonate}
            className="flex shrink-0 items-center gap-1 rounded-full bg-rose-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm transition active:scale-95"
          >
            <HeartPulse className="h-3 w-3 shrink-0" /> রক্তদান আপডেট
          </button>
        </div>
      </div>
    </div>
  );
}

function DonatedModal({
  donor,
  onClose,
  onSubmit,
}: {
  donor: DonorRowMini;
  onClose: () => void;
  onSubmit: (payload: {
    event_date: string;
    place: string;
    form_image_url?: string | null;
    photo_url?: string | null;
    note?: string | null;
  }) => Promise<boolean>;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [formImage, setFormImage] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState<null | "form" | "photo">(null);
  const [busy, setBusy] = useState(false);

  async function pick(kind: "form" | "photo", e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(kind);
    const url = await uploadPublicImage(f, `donor-events/${donor.id}`);
    setUploading(null);
    if (!url) return toast.error("আপলোড ব্যর্থ");
    if (kind === "form") setFormImage(url);
    else setPhoto(url);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !place.trim()) return toast.error("তারিখ ও স্থান আবশ্যক");
    setBusy(true);
    const ok = await onSubmit({
      event_date: date,
      place: place.trim(),
      form_image_url: formImage,
      photo_url: photo,
      note: note.trim() || null,
    });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-3xl bg-card p-5 shadow-elevated"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-primary-deep">রক্তদান আপডেট</p>
            <p className="truncate text-xs text-muted-foreground">
              {donor.full_name} • <span className="font-bold text-rose-600">{donor.blood_group}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-muted p-1.5">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-primary-deep">রক্তদানের তারিখ *</span>
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-primary-deep">রক্তদানের স্থান *</span>
            <input
              required
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="যেমন: নোয়াখালী জেনারেল হাসপাতাল"
              className="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-background px-3 py-2.5 text-sm">
            <Upload className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {uploading === "form" ? "আপলোড..." : formImage ? "ফর্ম ছবি যোগ হয়েছে" : "পূরণকৃত ফর্ম (ঐচ্ছিক)"}
            </span>
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => pick("form", e)} />
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-background px-3 py-2.5 text-sm">
            <Upload className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {uploading === "photo" ? "আপলোড..." : photo ? "ছবি যোগ হয়েছে" : "রক্তদানের ছবি (ঐচ্ছিক)"}
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => pick("photo", e)} />
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="মন্তব্য (ঐচ্ছিক)"
            className="w-full min-w-0 resize-none rounded-xl border border-border bg-background p-3 text-sm"
          />
        </div>
        <button
          disabled={busy}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          <Send className="h-4 w-4 shrink-0" /> {busy ? "জমা হচ্ছে..." : "সাবমিট"}
        </button>
      </form>
    </div>
  );
}
