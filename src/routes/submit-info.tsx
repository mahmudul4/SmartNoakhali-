import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  Droplet,
  Info,
  Sparkles,
  MapPin,
  Phone,
  Camera,
  Trash2,
  Building,
  HelpCircle,
  FileText,
  User,
} from "lucide-react";
import { useCategories, useDivisions } from "@/lib/store";
import { toast } from "sonner";
import { useCloudSubmissions } from "@/lib/cloud";
import { UniversalImageUploader } from "@/components/UniversalImageUploader";
import { getFormSchemaForCategory } from "@/data/category-forms";

export const Route = createFileRoute("/submit-info")({
  head: () => ({
    meta: [
      { title: "তথ্য দিন — স্মার্ট নোয়াখালী" },
      {
        name: "description",
        content: "নোয়াখালীর যেকোনো ব্যবসা, প্রতিষ্ঠান, ডাক্তার, চাকরি বা সেবার তথ্য জমা দিন।",
      },
    ],
  }),
  component: SubmitInfo,
});

const NOAKHALI_UPAZILAS = [
  "নোয়াখালী সদর (মাইজদী)",
  "বেগমগঞ্জ (চৌমুহনী)",
  "চাটখিল",
  "সেনবাগ",
  "কোম্পানীগঞ্জ (বসুরহাট)",
  "সোনাইমুড়ী",
  "সুবর্ণচর",
  "কবিরহাট",
  "হাতিয়া",
];

function SubmitInfo() {
  const { categories, getCategoryBySlug } = useCategories();
  const { divisions } = useDivisions();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Core Form State
  const [categorySlug, setCategorySlug] = useState("");
  const [title, setTitle] = useState("");
  const [upazila, setUpazila] = useState("নোয়াখালী সদর (মাইজদী)");
  const [unionPourashava, setUnionPourashava] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [altContact, setAltContact] = useState("");
  const [designation, setDesignation] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [generalDetails, setGeneralDetails] = useState("");

  // Dynamic Category Specific Fields Map
  const [dynamicValues, setDynamicValues] = useState<Record<string, string>>({});

  const { add } = useCloudSubmissions();

  // Pick up preselected category from sessionStorage or URL query
  useEffect(() => {
    try {
      const pre = sessionStorage.getItem("submit-info:category");
      if (pre) {
        setCategorySlug(pre);
        sessionStorage.removeItem("submit-info:category");
      }
    } catch {
      /* ignore */
    }
  }, []);

  const selectedCategory = getCategoryBySlug(categorySlug);
  const formSchema = useMemo(() => {
    return getFormSchemaForCategory(selectedCategory?.formType);
  }, [selectedCategory?.formType]);

  // Reset dynamic fields when category changes
  const handleCategoryChange = (slug: string) => {
    setCategorySlug(slug);
    setDynamicValues({});
  };

  const handleDynamicChange = (key: string, val: string) => {
    setDynamicValues((prev) => ({ ...prev, [key]: val }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!categorySlug) {
      return toast.error("অনুগ্রহ করে একটি ক্যাটাগরি নির্বাচন করুন");
    }
    if (!title.trim()) {
      return toast.error("নাম বা শিরোনাম আবশ্যক");
    }
    if (!contact.trim()) {
      return toast.error("যোগাযোগের জন্য মোবাইল নম্বর আবশ্যক");
    }
    if (!address.trim() && !area.trim()) {
      return toast.error("এলাকা বা পূর্ণ ঠিকানা প্রদান করুন");
    }

    // Build consolidated full address
    const fullAddressParts = [
      address.trim(),
      area.trim() ? `এলাকা: ${area.trim()}` : "",
      unionPourashava.trim() ? `পৌর/ইউপি: ${unionPourashava.trim()}` : "",
      upazila,
      "নোয়াখালী",
    ].filter(Boolean);
    const fullAddress = fullAddressParts.join(", ");

    // Build rich body containing all category-specific metadata
    const metaLines: string[] = [];
    if (formSchema.fields && formSchema.fields.length > 0) {
      for (const f of formSchema.fields) {
        const v = dynamicValues[f.key];
        if (v && v.trim()) {
          metaLines.push(`${f.label}: ${v.trim()}`);
        }
      }
    }
    if (altContact.trim()) {
      metaLines.push(`বিকল্প যোগাযোগ: ${altContact.trim()}`);
    }
    if (generalDetails.trim()) {
      metaLines.push(`বিস্তারিত: ${generalDetails.trim()}`);
    }

    const consolidatedBody = metaLines.join("\n• ");

    setSubmitting(true);
    try {
      const res = await add({
        category_slug: categorySlug,
        title: title.trim(),
        contact: contact.trim(),
        address: fullAddress,
        designation: designation.trim() || undefined,
        body: consolidatedBody.trim() ? `• ${consolidatedBody.trim()}` : undefined,
        image_url: imageUrl.trim() || undefined,
      });

      if (!res.ok) {
        toast.error(res.error ?? "তথ্য জমা দেওয়া ব্যর্থ হয়েছে");
        return;
      }

      setSubmitted(true);
      toast.success("তথ্য সফলভাবে জমা হয়েছে! এডমিন যাচাই করে প্রকাশ করবেন।");
    } catch (err: any) {
      toast.error(err?.message || "সার্ভার সংযোগে ত্রুটি হয়েছে");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-md px-4 pt-12 text-center pb-24">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-600 shadow-card">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <h1 className="font-display text-2xl font-bold text-primary-deep">
          অসংখ্য ধন্যবাদ!
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          আপনার প্রদত্ত তথ্যটি সফলভাবে সিস্টেমে সংরক্ষিত হয়েছে। এডমিন প্যানেল থেকে তথ্যটি যাচাই করে ওয়েবসাইটে দ্রুত প্রকাশ করা হবে।
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="rounded-full bg-gradient-hero px-6 py-2.5 text-xs font-bold text-white shadow-card hover:opacity-95"
          >
            হোম পেজে ফিরুন
          </Link>
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setTitle("");
              setContact("");
              setAddress("");
              setArea("");
              setImageUrl("");
              setDynamicValues({});
              setGeneralDetails("");
            }}
            className="rounded-full bg-muted px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted/80"
          >
            ➕ আরও তথ্য দিন
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-3.5 pb-28 pt-4 sm:px-4">
      <Link
        to="/"
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> হোম পেজ
      </Link>

      {/* Header Banner */}
      <div className="mb-4 rounded-3xl border border-primary/20 bg-gradient-card p-5 shadow-card">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Send className="h-4 w-4" />
          </span>
          <div>
            <h1 className="font-display text-lg font-bold text-primary-deep sm:text-xl">
              তথ্য দিন — স্মার্ট নোয়াখালী
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              ২২টি প্রধান বিভাগের ১৮১টি ক্যাটাগরির যেকোনো সেবা বা প্রতিষ্ঠানের তথ্য যোগ করুন
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-3xl border border-border bg-card p-5 shadow-card"
      >
        {/* Step 1: Category Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground flex items-center justify-between">
            <span>১. ক্যাটাগরি নির্বাচন করুন *</span>
            {selectedCategory && (
              <span className="text-[11px] font-semibold text-primary">
                বিভাগ: {divisions.find((d) => d.id === selectedCategory.divisionId)?.bn || selectedCategory.divisionId}
              </span>
            )}
          </label>
          <select
            required
            value={categorySlug}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="w-full rounded-2xl border border-border bg-background px-3.5 py-3 text-xs sm:text-sm font-semibold outline-none focus:border-primary"
          >
            <option value="">-- ১৮১টি ক্যাটাগরি থেকে নির্বাচন করুন --</option>
            {divisions.map((div) => {
              const divCats = categories.filter((c) => c.divisionId === div.id);
              if (divCats.length === 0) return null;
              return (
                <optgroup key={div.id} label={`━━ ${div.bn} (${divCats.length}টি) ━━`}>
                  {divCats.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.bn} ({c.en})
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
          {selectedCategory && (
            <p className="text-[11px] text-muted-foreground pt-0.5">
              💡 {selectedCategory.description}
            </p>
          )}
        </div>

        {/* Step 2: Name / Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground">
            {formSchema.nameLabel || "২. নাম / প্রতিষ্ঠানের নাম *"}
          </label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={formSchema.namePlaceholder || "যেমন: সেবা বা প্রতিষ্ঠানের নাম লিখুন"}
            className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>

        {/* Step 3: Optional Profile Photo / Business Logo (STEP 5 MANDATORY) */}
        <div className="space-y-2 rounded-2xl border border-border/80 bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div>
              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Camera className="h-4 w-4 text-primary" /> ৩. প্রোফাইল ছবি / প্রতিষ্ঠানের ছবি (ঐচ্ছিক)
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                ছবি না দিলেও তথ্য জমা দেওয়া যাবে। ছবি দিলে ভিজিটরদের কাছে নির্ভরযোগ্যতা বৃদ্ধি পাবে।
              </p>
            </div>
            {imageUrl && (
              <button
                type="button"
                onClick={() => setImageUrl("")}
                className="flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive hover:bg-destructive/20"
              >
                <Trash2 className="h-3 w-3" /> ছবি মুছুন
              </button>
            )}
          </div>

          <div className="pt-1">
            <UniversalImageUploader
              category="general"
              value={imageUrl}
              onChange={(url: string | null) => {
                setImageUrl(url || "");
                if (url) toast.success("ছবি সফলভাবে আপলোড সম্পন্ন হয়েছে");
              }}
              label="ছবি নির্বাচন বা আপলোড করুন"
              hint="PNG, JPG, JPEG, WebP ফরম্যাট সমর্থিত (স্বয়ংক্রিয় অপ্টিমাইজড)"
              variant="card"
            />
          </div>
        </div>

        {/* Step 4: Category-Specific Dynamic Fields (STEP 4 MANDATORY) */}
        {formSchema.fields && formSchema.fields.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="border-b border-primary/15 pb-2">
              <p className="font-display text-xs font-bold text-primary-deep flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> ৪. ক্যাটাগরি নির্ধারিত বিশেষ তথ্যসমূহ
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                এই ক্যাটাগরির উপযোগী সঠিক তথ্য প্রদান করুন
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {formSchema.fields.map((field) => (
                <div
                  key={field.key}
                  className={field.type === "textarea" ? "sm:col-span-2 space-y-1" : "space-y-1"}
                >
                  <label className="text-[11px] font-bold text-foreground">
                    {field.label} {field.required ? "*" : ""}
                  </label>
                  {field.type === "select" ? (
                    <select
                      required={field.required}
                      value={dynamicValues[field.key] || ""}
                      onChange={(e) => handleDynamicChange(field.key, e.target.value)}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold outline-none focus:border-primary"
                    >
                      <option value="">-- নির্বাচন করুন --</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      required={field.required}
                      value={dynamicValues[field.key] || ""}
                      onChange={(e) => handleDynamicChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={2}
                      className="w-full rounded-xl border border-border bg-background p-2.5 text-xs outline-none focus:border-primary"
                    />
                  ) : (
                    <input
                      type={field.type === "number" ? "number" : "text"}
                      required={field.required}
                      value={dynamicValues[field.key] || ""}
                      onChange={(e) => handleDynamicChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Location Details */}
        <div className="space-y-3 rounded-2xl border border-border/80 bg-muted/20 p-4">
          <p className="font-display text-xs font-bold text-foreground flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-primary" /> ৫. অবস্থান ও ঠিকানা
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">উপজেলা *</label>
              <select
                value={upazila}
                onChange={(e) => setUpazila(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold outline-none focus:border-primary"
              >
                {NOAKHALI_UPAZILAS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">
                ইউনিয়ন / পৌরসভা / ওয়ার্ড
              </label>
              <input
                value={unionPourashava}
                onChange={(e) => setUnionPourashava(e.target.value)}
                placeholder="যেমন: নোয়াখালী পৌরসভা / ৮ নং ওয়ার্ড"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">এলাকা / গ্রাম / পাড়া</label>
              <input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="যেমন: টাউন হল মোড় / মাইজদী বাজার"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">পূর্ণ ঠিকানা *</label>
              <input
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="রোড নম্বর, হোল্ডিং বা পরিচিত ল্যান্ডমার্ক"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Step 6: Contact Information */}
        <div className="space-y-3 rounded-2xl border border-border/80 bg-muted/20 p-4">
          <p className="font-display text-xs font-bold text-foreground flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 text-primary" /> ৬. যোগাযোগের নম্বর
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">
                প্রধান মোবাইল নম্বর *
              </label>
              <input
                required
                type="tel"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="যেমন: 018XXXXXXXX"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs font-bold outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground">
                বিকল্প নম্বর বা হোয়াটসঅ্যাপ (ঐচ্ছিক)
              </label>
              <input
                type="tel"
                value={altContact}
                onChange={(e) => setAltContact(e.target.value)}
                placeholder="যেমন: 017XXXXXXXX"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-muted-foreground">
                যোগাযোগকারী ব্যক্তির নাম বা পদবি (ঐচ্ছিক)
              </label>
              <input
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="যেমন: প্রোপ্রাইটর / ম্যানেজার / দায়িত্বপ্রাপ্ত"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Step 7: General / Additional Details */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">
            ৭. অতিরিক্ত কোনো তথ্য বা বিবরণ থাকলে লিখুন (ঐচ্ছিক)
          </label>
          <textarea
            value={generalDetails}
            onChange={(e) => setGeneralDetails(e.target.value)}
            rows={2}
            placeholder="বিশেষ ছাড়, সুবিধা, সময়সূচি বা অন্যান্য তথ্য..."
            className="w-full rounded-2xl border border-border bg-background p-3 text-xs outline-none focus:border-primary"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-hero py-3.5 text-sm font-bold text-white shadow-card transition active:scale-[0.99] disabled:opacity-60"
          >
            {submitting ? (
              <>সংরক্ষণ ও জমা হচ্ছে...</>
            ) : (
              <>
                <Send className="h-4 w-4" /> তথ্য জমা দিন (Submit Info)
              </>
            )}
          </button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            🔒 আপনার তথ্য নিরাপদভাবে Firebase Cloud-এ সংরক্ষিত হবে এবং এডমিন যাচাইয়ের পর সর্বসাধারণের জন্য লাইভ হবে।
          </p>
        </div>
      </form>
    </div>
  );
}
