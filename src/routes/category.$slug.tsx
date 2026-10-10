import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  MapPin,
  Phone,
  User,
  Droplet,
  CheckCircle2,
  XCircle,
  HeartPulse,
  ShieldCheck,
  Edit3,
  Trash2,
  Save,
} from "lucide-react";
import { getCategory, type CategorySlug } from "@/data/categories";
import { useCategories } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { MobileSearch } from "@/components/SiteHeader";
import {
  useCloudSubmissions,
  useCloudDonors,
  useCloudDonorEvents,
  type DonorRow,
} from "@/lib/cloud";
import { toast } from "sonner";

export interface Listing {
  id: string;
  name: string;
  designation?: string;
  address?: string;
  phone: string;
  photo?: string;
  bloodGroup?: string;
  lastDonation?: string;
  totalDonations?: number;
}

export const Route = createFileRoute("/category/$slug")({
  head: ({ params }) => {
    const cat = getCategory(params.slug);
    return {
      meta: [
        { title: cat ? `${cat.bn} — স্মার্ট নোয়াখালী` : "ক্যাটাগরি — স্মার্ট নোয়াখালী" },
        { name: "description", content: cat?.description ?? "ক্যাটাগরি তালিকা" },
      ],
    };
  },
  loader: ({ params }) => {
    return { slug: params.slug };
  },
  component: CategoryPage,
});

function daysAgo(iso?: string) {
  if (!iso) return null;
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return diff;
}

function CategoryPage() {
  const { slug } = Route.useLoaderData() as { slug: string };
  const { getCategoryBySlug } = useCategories();
  const { isAdmin, isStaff } = useAuth();
  const cat = getCategoryBySlug(slug) ?? getCategory(slug);
  const [query, setQuery] = useState("");
  const submissions = useCloudSubmissions();
  const donors = useCloudDonors();
  const events = useCloudDonorEvents();
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const isBloodCategory = Boolean(cat && (cat.slug === "blood-donor" || cat.slug === "blood"));

  const approvedExtras: Listing[] = useMemo(() => {
    if (!cat) return [];
    if (cat.slug === "blood-donor" || cat.slug === "blood") {
      return donors.items
        .filter((d) => d.status === "approved")
        .map((d) => ({
          id: d.id,
          name: d.full_name,
          phone: d.phone,
          address: d.address ?? undefined,
          photo: d.photo_url ?? undefined,
          bloodGroup: d.blood_group as string,
          lastDonation: d.last_donation_date ?? undefined,
          totalDonations: d.total_donations,
        }));
    }
    return submissions.items
      .filter((s) => s.status === "approved" && s.category_slug === cat.slug)
      .map((s) => ({
        id: s.id,
        name: s.title,
        phone: s.contact ?? "",
        address: s.address ?? undefined,
        designation: s.designation ?? undefined,
        photo: s.image_url ?? undefined,
      }));
  }, [submissions.items, donors.items, cat]);

  if (!cat) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">ক্যাটাগরি পাওয়া যায়নি।</p>
        <Link to="/" className="mt-4 inline-block text-primary underline">হোমে ফিরুন</Link>
      </div>
    );
  }

  const list: Listing[] = approvedExtras;
  void (cat.slug as CategorySlug);
  const filtered = list.filter((l: Listing) =>
    [l.name, l.designation, l.address, l.phone, l.bloodGroup]
      .filter(Boolean).join(" ").toLowerCase().includes(query.toLowerCase())
  );

  function donatedToday(l: Listing) {
    const donor = donors.items.find((d) => d.id === l.id);
    if (donor) {
      void events.add({ donor_id: donor.id, event_date: new Date().toISOString().slice(0, 10) });
      toast.success("রক্তদান জমা হয়েছে — অনুমোদনের অপেক্ষায়");
    }
  }

  async function handleSaveListingEdit() {
    if (!editingListing) return;
    setSavingEdit(true);
    try {
      if (isBloodCategory) {
        const { error } = await donors.update(editingListing.id, {
          full_name: editingListing.name,
          phone: editingListing.phone,
          address: editingListing.address ?? "",
          blood_group: (editingListing.bloodGroup || "O+") as DonorRow["blood_group"],
          total_donations: Number(editingListing.totalDonations ?? 0),
        });
        if (error) toast.error(error.message);
        else {
          toast.success("তথ্য আপডেট হয়েছে");
          setEditingListing(null);
        }
      } else {
        const { error } = await submissions.update(editingListing.id, {
          title: editingListing.name,
          contact: editingListing.phone,
          address: editingListing.address ?? "",
          designation: editingListing.designation ?? "",
        });
        if (error) toast.error(error.message);
        else {
          toast.success("তথ্য আপডেট হয়েছে");
          setEditingListing(null);
        }
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteListing(l: Listing) {
    if (!isAdmin) return;
    if (isBloodCategory) {
      const { error } = await donors.remove(l.id);
      if (error) toast.error(error.message);
      else toast.success("তথ্য মুছে ফেলা হয়েছে");
    } else {
      const { error } = await submissions.remove(l.id);
      if (error) toast.error(error.message);
      else toast.success("তথ্য মুছে ফেলা হয়েছে");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl overflow-x-hidden px-3.5 pb-24 pt-4 sm:px-4">
      <div className="mb-3 flex w-full min-w-0 items-center justify-between gap-2">
        <Link to="/" className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 shrink-0" /> হোম
        </Link>
        {isStaff && (
          <Link
            to="/mdmahmudulhashan"
            className="inline-flex min-w-0 items-center gap-1 rounded-full bg-gold/15 px-3 py-1 text-xs font-bold text-primary-deep ring-1 ring-gold/40"
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">ড্যাশবোর্ড / তথ্য পরিচালনা</span>
          </Link>
        )}
      </div>

      <div className="mb-4 flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl bg-gradient-card p-3.5 shadow-card sm:p-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${cat.tint} text-primary-deep sm:h-12 sm:w-12`}>
          <cat.icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-bold text-primary-deep">{cat.bn}</h1>
          <p className="truncate text-xs text-muted-foreground">{cat.description}</p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{list.length}</span>
      </div>

      <Link
        to="/submit-info"
        onClick={() => { try { sessionStorage.setItem("submit-info:category", cat.slug); } catch { /* ignore */ } }}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-hero px-4 py-3 text-sm font-bold text-primary-foreground shadow-elevated transition active:scale-[0.98]"
      >
        + নিবন্ধন করুন
      </Link>

      {list.length > 0 && (
        <div className="mb-4">
          <MobileSearch value={query} onChange={setQuery} placeholder={`${cat.bn} এ অনুসন্ধান...`} />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <p className="text-sm text-muted-foreground">এখনো কোনো তথ্য যোগ করা হয়নি।</p>
          <Link to="/submit-info" className="mt-3 inline-block rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
            তথ্য দিন
          </Link>
        </div>
      ) : (
        <div className="grid w-full min-w-0 grid-cols-1 gap-3">
          {filtered.map((l: Listing) =>
            cat.slug === "blood" || cat.slug === "blood-donor" ? (
              <BloodCard
                key={l.id}
                l={l}
                isAdmin={isAdmin}
                onDonatedToday={() => donatedToday(l)}
                onEdit={() => setEditingListing({ ...l })}
                onDelete={() => void handleDeleteListing(l)}
              />
            ) : (
              <PersonCard
                key={l.id}
                l={l}
                isAdmin={isAdmin}
                onEdit={() => setEditingListing({ ...l })}
                onDelete={() => void handleDeleteListing(l)}
              />
            )
          )}
        </div>
      )}

      {editingListing && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"
          onClick={() => setEditingListing(null)}
        >
          <div
            className="w-full max-w-sm space-y-2.5 rounded-2xl bg-card p-4 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-sm font-bold text-primary-deep">তথ্য সম্পাদনা</p>
            <input
              value={editingListing.name}
              onChange={(e) => setEditingListing({ ...editingListing, name: e.target.value })}
              placeholder="নাম / শিরোনাম"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={editingListing.phone}
              onChange={(e) => setEditingListing({ ...editingListing, phone: e.target.value })}
              placeholder="ফোন নম্বর"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            {!isBloodCategory && (
              <input
                value={editingListing.designation ?? ""}
                onChange={(e) =>
                  setEditingListing({ ...editingListing, designation: e.target.value })
                }
                placeholder="পদবি / বিশেষজ্ঞতা"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            )}
            <input
              value={editingListing.address ?? ""}
              onChange={(e) => setEditingListing({ ...editingListing, address: e.target.value })}
              placeholder="ঠিকানা"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => void handleSaveListingEdit()}
                className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground"
              >
                <Save className="h-3.5 w-3.5" /> সংরক্ষণ
              </button>
              <button
                type="button"
                onClick={() => setEditingListing(null)}
                className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PersonCard({
  l,
  isAdmin,
  onEdit,
  onDelete,
}: {
  l: Listing;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group w-full max-w-full min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-gradient-card p-3.5 shadow-card transition hover:shadow-elevated sm:p-4">
      <div className="flex w-full min-w-0 items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary sm:h-12 sm:w-12">
          {l.photo ? <img src={l.photo} alt={l.name} className="h-full w-full rounded-full object-cover" /> : <User className="h-5 w-5 sm:h-6 sm:w-6" />}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-sm font-bold text-foreground sm:text-base">{l.name}</p>
          {l.designation && <p className="truncate text-xs text-muted-foreground">{l.designation}</p>}
          {l.address && (
            <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate">{l.address}</span>
            </p>
          )}
        </div>
        {l.phone && (
          <a
            href={`tel:${l.phone}`}
            aria-label={`কল করুন ${l.name}`}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-gold px-3.5 py-2 text-xs font-extrabold text-primary-deep shadow-gold transition active:scale-95"
          >
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>কল</span>
          </a>
        )}
      </div>
      {isAdmin && (
        <div className="mt-2.5 flex items-center justify-end gap-2 border-t border-border/50 pt-2">
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
        </div>
      )}
    </div>
  );
}

function BloodCard({
  l,
  isAdmin,
  onDonatedToday,
  onEdit,
  onDelete,
}: {
  l: Listing;
  isAdmin: boolean;
  onDonatedToday: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const days = daysAgo(l.lastDonation);
  const available = days === null || days >= 90;
  return (
    <div className="w-full max-w-full min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-gradient-card p-3.5 shadow-card sm:p-4">
      <div className="flex w-full min-w-0 items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-rose-500/10 text-rose-600 ring-2 ring-rose-500/20 sm:h-12 sm:w-12">
          {l.photo ? <img src={l.photo} alt={l.name} className="h-full w-full object-cover" /> : <Droplet className="h-5 w-5 sm:h-6 sm:w-6" />}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="min-w-0 truncate text-sm font-bold text-foreground sm:text-base">{l.name}</p>
            <span className="shrink-0 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[11px] font-extrabold text-rose-600">{l.bloodGroup}</span>
          </div>
          {l.address && (
            <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0 text-rose-500" />
              <span className="truncate">{l.address}</span>
            </p>
          )}
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            শেষ দান: {days !== null ? `${days} দিন আগে` : "—"} • মোট দান: {l.totalDonations ?? 0}
          </p>
        </div>
        <a
          href={`tel:${l.phone}`}
          aria-label={`কল করুন ${l.name}`}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-gold px-3.5 py-2 text-xs font-extrabold text-primary-deep shadow-gold transition active:scale-95"
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
            onClick={onDonatedToday}
            className="flex shrink-0 items-center gap-1 rounded-full bg-rose-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm transition active:scale-95"
          >
            <HeartPulse className="h-3 w-3 shrink-0" /> আজ রক্ত দিয়েছি
          </button>
        </div>
      </div>
    </div>
  );
}