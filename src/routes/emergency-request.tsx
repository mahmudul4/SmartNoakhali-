import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Droplet,
  FileText,
  Loader2,
  MapPin,
  Minus,
  Phone,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  EMERGENCY_BLOOD_GROUPS,
  getEmergencyStatusMeta,
  getEmergencyUrgencyMeta,
  isEmergencyRequestPubliclyActive,
  isValidOptionalMapUrl,
  normalizeBdPhone,
  sortEmergencyRequestsPublic,
  useEmergencyRequests,
  useMyEmergencyRequests,
  type EmergencyUrgency,
} from "@/lib/cloud";
import { NOAKHALI_UPAZILAS } from "@/lib/district-platform";

export const Route = createFileRoute("/emergency-request")({
  head: () => ({
    meta: [
      { title: "জরুরি রক্তের অনুরোধ — স্মার্ট নোয়াখালী" },
      {
        name: "description",
        content:
          "নোয়াখালীতে জরুরি রক্তের প্রয়োজনে যাচাইকৃত অনুরোধ জমা দিন এবং চলমান রক্তের অনুরোধ দেখুন।",
      },
    ],
  }),
  component: EmergencyRequestPage,
});

const QUICK_HOSPITALS = [
  "২৫০ শয্যাবিশিষ্ট নোয়াখালী জেনারেল হাসপাতাল",
  "আবদুল মালেক উকিল মেডিকেল কলেজ হাসপাতাল",
  "প্রাইম হসপিটাল, মাইজদী",
  "গুড হিল কমপ্লেক্স হাসপাতাল",
  "চৌমুহনী জেনারেল হাসপাতাল",
];

const QUICK_RELATIONS = ["পরিবারের সদস্য", "আত্মীয়", "বন্ধু", "সহকর্মী", "নিজেই"];

const DISTRICTS = ["নোয়াখালী", "ফেনী", "লক্ষ্মীপুর", "কুমিল্লা", "চট্টগ্রাম", "ঢাকা", "অন্যান্য"];

function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getTomorrowIsoDate(): string {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface FormState {
  blood_group: string;
  bags_needed: number;
  urgency: EmergencyUrgency;
  needed_date: string;
  needed_time: string;
  patient_name: string;
  patient_age: string;
  patient_gender: "" | "male" | "female" | "other";
  hospital: string;
  district: string;
  upazila: string;
  address: string;
  map_link: string;
  requester_name: string;
  relation: string;
  phone: string;
  alt_phone: string;
  message: string;
  instructions: string;
  consent_accurate: boolean;
  consent_public: boolean;
}

function createInitialForm(): FormState {
  return {
    blood_group: "",
    bags_needed: 1,
    urgency: "urgent",
    needed_date: getTodayIsoDate(),
    needed_time: "",
    patient_name: "",
    patient_age: "",
    patient_gender: "",
    hospital: "",
    district: "নোয়াখালী",
    upazila: "",
    address: "",
    map_link: "",
    requester_name: "",
    relation: "",
    phone: "",
    alt_phone: "",
    message: "",
    instructions: "",
    consent_accurate: false,
    consent_public: false,
  };
}

type StepNumber = 1 | 2 | 3 | 4;
type FieldErrors = Partial<Record<keyof FormState, string>>;

function EmergencyRequestPage() {
  const { items: allRequests, add } = useEmergencyRequests();
  const {
    items: myRequests,
    loading: myLoading,
    cancelMyRequest,
  } = useMyEmergencyRequests();

  const [viewTab, setViewTab] = useState<"form" | "my_requests">("form");
  const [step, setStep] = useState<StepNumber>(1);
  const [form, setForm] = useState<FormState>(() => createInitialForm());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{
    id: string;
    requestCode: string;
    bloodGroup: string;
    patientName: string;
    hospital: string;
  } | null>(null);

  const activePublicRequests = useMemo(
    () =>
      sortEmergencyRequestsPublic(
        allRequests.filter((r) => isEmergencyRequestPubliclyActive(r))
      ),
    [allRequests]
  );

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function validateStep(targetStep: StepNumber): boolean {
    const nextErrors: FieldErrors = {};

    if (targetStep === 1 || targetStep === 4) {
      if (!form.blood_group) {
        nextErrors.blood_group = "রক্তের গ্রুপ নির্বাচন করুন";
      }
      if (!form.patient_name.trim()) {
        nextErrors.patient_name = "রোগীর নাম লিখুন";
      }
      if (form.patient_age.trim()) {
        const age = Number(form.patient_age);
        if (Number.isNaN(age) || age < 0 || age > 120) {
          nextErrors.patient_age = "সঠিক বয়স (০-১২০) লিখুন";
        }
      }
      if (!form.needed_date) {
        nextErrors.needed_date = "রক্ত প্রয়োজনের তারিখ দিন";
      }
    }

    if (targetStep === 2 || targetStep === 4) {
      if (!form.hospital.trim()) {
        nextErrors.hospital = "হাসপাতাল বা ক্লিনিকের নাম লিখুন";
      }
      if (!form.district.trim()) {
        nextErrors.district = "জেলা নির্বাচন করুন";
      }
      if (form.district === "নোয়াখালী" && !form.upazila.trim()) {
        nextErrors.upazila = "উপজেলা নির্বাচন করুন";
      }
      if (form.map_link.trim() && !isValidOptionalMapUrl(form.map_link)) {
        nextErrors.map_link = "সঠিক Google Maps লিংক (https://...) দিন অথবা খালি রাখুন";
      }
    }

    if (targetStep === 3 || targetStep === 4) {
      if (!form.requester_name.trim()) {
        nextErrors.requester_name = "আবেদনকারীর নাম লিখুন";
      }
      if (!normalizeBdPhone(form.phone)) {
        nextErrors.phone = "সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)";
      }
      if (form.alt_phone.trim() && !normalizeBdPhone(form.alt_phone)) {
        nextErrors.alt_phone = "বিকল্প নম্বরটি ১১ ডিজিটের সঠিক বাংলাদেশি নম্বর হতে হবে";
      }
      if (!form.consent_accurate) {
        nextErrors.consent_accurate = "তথ্যের সত্যতা নিশ্চিতকরণ টিক দিন";
      }
      if (!form.consent_public) {
        nextErrors.consent_public = "তথ্য ও নম্বর প্রকাশের সম্মতি টিক দিন";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleNext() {
    if (!validateStep(step)) {
      toast.error("অনুগ্রহ করে চিহ্নিত তথ্যগুলো সঠিকভাবে পূরণ করুন");
      return;
    }
    setStep((prev) => (prev < 4 ? ((prev + 1) as StepNumber) : prev));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setStep((prev) => (prev > 1 ? ((prev - 1) as StepNumber) : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!validateStep(4)) {
      toast.error("সকল আবশ্যক তথ্য ও সম্মতি যাচাই করুন");
      return;
    }

    setBusy(true);
    const res = await add({
      patient_name: form.patient_name.trim(),
      patient_age: form.patient_age.trim() ? Number(form.patient_age) : null,
      patient_gender: form.patient_gender,
      phone: form.phone.trim(),
      alt_phone: form.alt_phone.trim(),
      requester_name: form.requester_name.trim(),
      relation: form.relation.trim(),
      blood_group: form.blood_group,
      bags_needed: form.bags_needed,
      needed_date: form.needed_date,
      needed_time: form.needed_time,
      urgency: form.urgency,
      hospital: form.hospital.trim(),
      district: form.district.trim(),
      upazila: form.upazila.trim(),
      address: form.address.trim(),
      map_link: form.map_link.trim(),
      message: form.message.trim(),
      instructions: form.instructions.trim(),
      consent_accurate: form.consent_accurate,
      consent_public: form.consent_public,
    });
    setBusy(false);

    if (!res.ok) {
      toast.error(res.error || "অনুরোধ জমা দেওয়া যায়নি");
      return;
    }

    setSubmittedResult({
      id: res.id || "",
      requestCode: res.requestCode || "SN-BLD",
      bloodGroup: form.blood_group,
      patientName: form.patient_name.trim(),
      hospital: form.hospital.trim(),
    });
    toast.success("আপনার জরুরি রক্তের অনুরোধ সফলভাবে জমা হয়েছে!");
    setForm(createInitialForm());
    setErrors({});
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleCancelOwn(id: string) {
    if (cancellingId) return;
    setCancellingId(id);
    const res = await cancelMyRequest(id);
    setCancellingId(null);
    if (!res.ok) {
      toast.error(res.error || "বাতিল করা যায়নি");
      return;
    }
    toast.success("অনুরোধটি বাতিল করা হয়েছে");
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("অনুরোধ কোড কপি হয়েছে");
    } catch {
      toast.error("কপি করা যায়নি");
    }
  }

  return (
    <div className="w-full px-3.5 pb-24 pt-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
      {/* Top Bar */}
      <div className="mx-auto mb-4 flex max-w-2xl flex-wrap items-center justify-between gap-2">
        <Link
          to="/"
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-[#5F5F5A] hover:text-[#1C1C1C]"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.6} />
          <span>হোমপেজ</span>
        </Link>

        <Link
          to="/blood-donor"
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] border border-[#E6E1D6] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#0F4D3A] transition hover:border-[#0F4D3A]"
        >
          <Users className="h-3.5 w-3.5" strokeWidth={1.6} />
          <span>রক্তদাতা খুঁজুন</span>
        </Link>
      </div>

      <div className="mx-auto max-w-2xl space-y-5">
        {/* Page Hero Header */}
        <div className="rounded-[14px] border border-[#E6E1D6] bg-white p-5 sm:p-6">
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left sm:gap-4">
            <div className="mb-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-[#C62828]/10 text-[#C62828] sm:mb-0">
              <Droplet className="h-6 w-6" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl font-bold text-[#1C1C1C] sm:text-2xl">
                জরুরি রক্তের অনুরোধ
              </h1>
              <p className="mt-1 text-xs leading-relaxed text-[#5F5F5A] sm:text-sm">
                সঠিক তথ্য দিয়ে জরুরি রক্তের অনুরোধ জমা দিন। এডমিন যাচাই করে অনুমোদন করার সাথে
                সাথেই হোমপেজে ও স্বেচ্ছাসেবীদের মাঝে দৃশ্যমান হবে।
              </p>
            </div>
          </div>

          {/* Segmented Tab Switch */}
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] p-1">
            <button
              type="button"
              onClick={() => setViewTab("form")}
              className={`min-h-[40px] rounded-[8px] px-3 text-xs font-bold transition ${
                viewTab === "form"
                  ? "bg-white text-[#C62828] border border-[#E6E1D6]"
                  : "text-[#5F5F5A] hover:text-[#1C1C1C]"
              }`}
            >
              নতুন অনুরোধ করুন
            </button>
            <button
              type="button"
              onClick={() => setViewTab("my_requests")}
              className={`min-h-[40px] rounded-[8px] px-3 text-xs font-bold transition ${
                viewTab === "my_requests"
                  ? "bg-white text-[#0F4D3A] border border-[#E6E1D6]"
                  : "text-[#5F5F5A] hover:text-[#1C1C1C]"
              }`}
            >
              আমার অনুরোধসমূহ{" "}
              {myRequests.length > 0 ? `(${myRequests.length.toLocaleString("bn-BD")})` : ""}
            </button>
          </div>
        </div>

        {/* Success Confirmation Card */}
        {viewTab === "form" && submittedResult && (
          <div className="rounded-[14px] border border-[#0F4D3A]/30 bg-white p-5 sm:p-6">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0F4D3A]/10 text-[#0F4D3A]">
                <CheckCircle2 className="h-7 w-7" strokeWidth={1.75} />
              </div>
              <h2 className="mt-3 font-display text-lg font-bold text-[#0F4D3A]">
                অনুরোধ সফলভাবে জমা হয়েছে!
              </h2>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[#5F5F5A]">
                এডমিন তথ্য যাচাই করে অনুমোদন দেওয়ার পরপরই আপনার অনুরোধটি হোমপেজে এবং সবার
                কাছে দৃশ্যমান হবে।
              </p>

              <div className="mt-4 w-full max-w-md rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] p-3.5 text-left text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#5F5F5A]">অনুরোধ আইডি:</span>
                  <button
                    type="button"
                    onClick={() => void copyCode(submittedResult.requestCode)}
                    className="inline-flex items-center gap-1 font-bold text-[#1C1C1C] tabular-nums hover:text-[#0F4D3A]"
                  >
                    <span>{submittedResult.requestCode}</span>
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-[#5F5F5A]">রক্তের গ্রুপ ও রোগী:</span>
                  <span className="font-bold text-[#C62828]">
                    {submittedResult.bloodGroup} · {submittedResult.patientName}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-[#5F5F5A]">হাসপাতাল:</span>
                  <span className="font-medium text-[#1C1C1C]">{submittedResult.hospital}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-[#5F5F5A]">বর্তমান অবস্থা:</span>
                  <span className="rounded-[6px] border border-[#E6E1D6] bg-white px-2 py-0.5 text-[11px] font-bold text-[#5F5F5A]">
                    অনুমোদনের অপেক্ষায়
                  </span>
                </div>
              </div>

              <div className="mt-5 flex w-full max-w-md flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSubmittedResult(null);
                    setViewTab("my_requests");
                  }}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#0F4D3A] px-4 text-xs font-bold text-white hover:bg-[#0B3C2D]"
                >
                  <FileText className="h-3.5 w-3.5" />
                  আমার অনুরোধ দেখুন
                </button>
                <button
                  type="button"
                  onClick={() => setSubmittedResult(null)}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-[#E6E1D6] bg-white px-4 text-xs font-semibold text-[#1C1C1C] hover:border-[#0F4D3A]"
                >
                  আরেকটি অনুরোধ করুন
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Multi-Step Form */}
        {viewTab === "form" && !submittedResult && (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="rounded-[14px] border border-[#E6E1D6] bg-white p-4 sm:p-6"
          >
            {/* Progress Stepper */}
            <div className="mb-5 grid grid-cols-4 gap-1.5 border-b border-[#E6E1D6] pb-4">
              {[
                { num: 1 as StepNumber, label: "রক্ত ও রোগী" },
                { num: 2 as StepNumber, label: "হাসপাতাল" },
                { num: 3 as StepNumber, label: "যোগাযোগ" },
                { num: 4 as StepNumber, label: "যাচাই ও জমা" },
              ].map((s) => {
                const active = step === s.num;
                const done = step > s.num;
                return (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => {
                      if (s.num < step) setStep(s.num);
                    }}
                    className={`flex flex-col items-center gap-1 rounded-[8px] p-1.5 text-center transition ${
                      s.num < step ? "cursor-pointer hover:bg-[#FAF7F2]" : "cursor-default"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                        active
                          ? "bg-[#C62828] text-white"
                          : done
                          ? "bg-[#0F4D3A] text-white"
                          : "border border-[#E6E1D6] bg-[#FAF7F2] text-[#5F5F5A]"
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.2} /> : s.num}
                    </span>
                    <span
                      className={`text-[11px] font-semibold leading-tight ${
                        active ? "text-[#C62828]" : done ? "text-[#0F4D3A]" : "text-[#5F5F5A]"
                      }`}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* STEP 1: Blood & Patient Info */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-bold text-[#1C1C1C]">
                    ১. কোন গ্রুপের রক্ত প্রয়োজন? <span className="text-[#C62828]">*</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {EMERGENCY_BLOOD_GROUPS.map((bg) => {
                      const selected = form.blood_group === bg;
                      return (
                        <button
                          key={bg}
                          type="button"
                          onClick={() => updateField("blood_group", bg)}
                          className={`min-h-[48px] rounded-[10px] border text-sm font-extrabold transition ${
                            selected
                              ? "border-[#C62828] bg-[#C62828] text-white"
                              : "border-[#E6E1D6] bg-[#FAF7F2] text-[#C62828] hover:border-[#C62828]/50"
                          }`}
                        >
                          {bg}
                        </button>
                      );
                    })}
                  </div>
                  {errors.blood_group && <FieldError text={errors.blood_group} />}
                </div>

                {/* Bags + Urgency */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#1C1C1C]">
                      ২. কত ব্যাগ রক্ত প্রয়োজন? <span className="text-[#C62828]">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateField("bags_needed", Math.max(1, form.bags_needed - 1))
                        }
                        aria-label="কমান"
                        className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] text-[#1C1C1C] hover:border-[#0F4D3A]"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <div className="flex h-11 flex-1 items-center justify-center rounded-[10px] border border-[#E6E1D6] bg-white text-sm font-bold tabular-nums text-[#1C1C1C]">
                        {form.bags_needed.toLocaleString("bn-BD")} ব্যাগ
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updateField("bags_needed", Math.min(20, form.bags_needed + 1))
                        }
                        aria-label="বাড়ান"
                        className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] text-[#1C1C1C] hover:border-[#0F4D3A]"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#1C1C1C]">
                      ৩. জরুরি মাত্রা <span className="text-[#C62828]">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: "critical", label: "অত্যন্ত জরুরি" },
                          { id: "urgent", label: "জরুরি" },
                          { id: "scheduled", label: "নির্ধারিত" },
                        ] as const
                      ).map((u) => {
                        const active = form.urgency === u.id;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => updateField("urgency", u.id)}
                            className={`min-h-[44px] rounded-[10px] border px-2 text-xs font-bold transition ${
                              active
                                ? "border-[#C62828] bg-[#C62828] text-white"
                                : "border-[#E6E1D6] bg-[#FAF7F2] text-[#5F5F5A] hover:text-[#1C1C1C]"
                            }`}
                          >
                            {u.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label className="text-xs font-bold text-[#1C1C1C]">
                        ৪. কবে রক্ত প্রয়োজন? <span className="text-[#C62828]">*</span>
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateField("needed_date", getTodayIsoDate())}
                          className={`rounded-[6px] px-2 py-0.5 text-[11px] font-semibold ${
                            form.needed_date === getTodayIsoDate()
                              ? "bg-[#0F4D3A] text-white"
                              : "bg-[#FAF7F2] text-[#5F5F5A]"
                          }`}
                        >
                          আজ
                        </button>
                        <button
                          type="button"
                          onClick={() => updateField("needed_date", getTomorrowIsoDate())}
                          className={`rounded-[6px] px-2 py-0.5 text-[11px] font-semibold ${
                            form.needed_date === getTomorrowIsoDate()
                              ? "bg-[#0F4D3A] text-white"
                              : "bg-[#FAF7F2] text-[#5F5F5A]"
                          }`}
                        >
                          আগামীকাল
                        </button>
                      </div>
                    </div>
                    <input
                      type="date"
                      value={form.needed_date}
                      onChange={(e) => updateField("needed_date", e.target.value)}
                      className="min-h-[44px] w-full rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] px-3 py-2 text-sm text-[#1C1C1C] outline-none focus:border-[#0F4D3A]"
                    />
                    {errors.needed_date && <FieldError text={errors.needed_date} />}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#1C1C1C]">
                      সম্ভাব্য সময় (ঐচ্ছিক)
                    </label>
                    <input
                      type="time"
                      value={form.needed_time}
                      onChange={(e) => updateField("needed_time", e.target.value)}
                      className="min-h-[44px] w-full rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] px-3 py-2 text-sm text-[#1C1C1C] outline-none focus:border-[#0F4D3A]"
                    />
                  </div>
                </div>

                {/* Patient Details */}
                <div className="border-t border-[#E6E1D6] pt-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-bold text-[#1C1C1C]">
                        রোগীর নাম <span className="text-[#C62828]">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.patient_name}
                        onChange={(e) => updateField("patient_name", e.target.value)}
                        placeholder="যেমন: মো. করিম উদ্দিন"
                        className="min-h-[44px] w-full rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] px-3 py-2 text-sm text-[#1C1C1C] outline-none focus:border-[#0F4D3A]"
                      />
                      {errors.patient_name && <FieldError text={errors.patient_name} />}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-[#1C1C1C]">
                        বয়স (ঐচ্ছিক)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={120}
                        inputMode="numeric"
                        value={form.patient_age}
                        onChange={(e) => updateField("patient_age", e.target.value)}
                        placeholder="যেমন: ৩৫"
                        className="min-h-[44px] w-full rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] px-3 py-2 text-sm text-[#1C1C1C] outline-none focus:border-[#0F4D3A]"
                      />
                      {errors.patient_age && <FieldError text={errors.patient_age} />}
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="mb-1.5 block text-xs font-bold text-[#1C1C1C]">
                      রোগীর লিঙ্গ (ঐচ্ছিক)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: "male", label: "পুরুষ" },
                          { id: "female", label: "নারী" },
                          { id: "other", label: "অন্যান্য" },
                        ] as const
                      ).map((g) => {
                        const active = form.patient_gender === g.id;
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() =>
                              updateField("patient_gender", active ? "" : g.id)
                            }
                            className={`min-h-[40px] rounded-[10px] border text-xs font-semibold transition ${
                              active
                                ? "border-[#0F4D3A] bg-[#0F4D3A] text-white"
                                : "border-[#E6E1D6] bg-[#FAF7F2] text-[#5F5F5A] hover:text-[#1C1C1C]"
                            }`}
                          >
                            {g.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Hospital & Location */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#1C1C1C]">
                    হাসপাতাল / ক্লিনিকের নাম <span className="text-[#C62828]">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.hospital}
                    onChange={(e) => updateField("hospital", e.target.value)}
                    placeholder="হাসপাতাল বা ক্লিনিকের নাম লিখুন"
                    className="min-h-[44px] w-full rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] px-3 py-2 text-sm text-[#1C1C1C] outline-none focus:border-[#0F4D3A]"
                  />
                  {errors.hospital && <FieldError text={errors.hospital} />}

                  {/* Quick Hospital Suggestions */}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {QUICK_HOSPITALS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => updateField("hospital", h)}
                        className={`rounded-[8px] border px-2.5 py-1 text-[11px] font-medium transition ${
                          form.hospital === h
                            ? "border-[#0F4D3A] bg-[#0F4D3A]/10 text-[#0F4D3A]"
                            : "border-[#E6E1D6] bg-[#FAF7F2] text-[#5F5F5A] hover:border-[#0F4D3A]/40"
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#1C1C1C]">
                      জেলা <span className="text-[#C62828]">*</span>
                    </label>
                    <select
                      value={form.district}
                      onChange={(e) => {
                        const val = e.target.value;
                        updateField("district", val);
                        if (val !== "নোয়াখালী") {
                          updateField("upazila", "");
                        }
                      }}
                      className="min-h-[44px] w-full rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] px-3 py-2 text-sm text-[#1C1C1C] outline-none focus:border-[#0F4D3A]"
                    >
                      {DISTRICTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    {errors.district && <FieldError text={errors.district} />}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#1C1C1C]">
                      উপজেলা / এলাকা{" "}
                      {form.district === "নোয়াখালী" && (
                        <span className="text-[#C62828]">*</span>
                      )}
                    </label>
                    {form.district === "নোয়াখালী" ? (
                      <select
                        value={form.upazila}
                        onChange={(e) => updateField("upazila", e.target.value)}
                        className="min-h-[44px] w-full rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] px-3 py-2 text-sm text-[#1C1C1C] outline-none focus:border-[#0F4D3A]"
                      >
                        <option value="">উপজেলা নির্বাচন করুন</option>
                        {NOAKHALI_UPAZILAS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={form.upazila}
                        onChange={(e) => updateField("upazila", e.target.value)}
                        placeholder="উপজেলা / থানার নাম"
                        className="min-h-[44px] w-full rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] px-3 py-2 text-sm text-[#1C1C1C] outline-none focus:border-[#0F4D3A]"
                      />
                    )}
                    {errors.upazila && <FieldError text={errors.upazila} />}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#1C1C1C]">
                    বিস্তারিত ঠিকানা / ওয়ার্ড-বেড নম্বর (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    placeholder="যেমন: ৩য় তলা, পুরুষ সার্জারি ওয়ার্ড, বেড নং ১২"
                    className="min-h-[44px] w-full rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] px-3 py-2 text-sm text-[#1C1C1C] outline-none focus:border-[#0F4D3A]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#1C1C1C]">
                    Google Maps লোকেশন লিংক (ঐচ্ছিক)
                  </label>
                  <input
                    type="url"
                    value={form.map_link}
                    onChange={(e) => updateField("map_link", e.target.value)}
                    placeholder="https://maps.google.com/..."
                    className="min-h-[44px] w-full rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] px-3 py-2 text-sm text-[#1C1C1C] outline-none focus:border-[#0F4D3A]"
                  />
                  {errors.map_link && <FieldError text={errors.map_link} />}
                </div>
              </div>
            )}

            {/* STEP 3: Requester, Notes & Consent */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#1C1C1C]">
                      আবেদনকারীর নাম <span className="text-[#C62828]">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.requester_name}
                      onChange={(e) => updateField("requester_name", e.target.value)}
                      placeholder="আপনার নাম লিখুন"
                      className="min-h-[44px] w-full rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] px-3 py-2 text-sm text-[#1C1C1C] outline-none focus:border-[#0F4D3A]"
                    />
                    {errors.requester_name && <FieldError text={errors.requester_name} />}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#1C1C1C]">
                      রোগীর সাথে সম্পর্ক (ঐচ্ছিক)
                    </label>
                    <input
                      type="text"
                      value={form.relation}
                      onChange={(e) => updateField("relation", e.target.value)}
                      placeholder="যেমন: ভাই, বন্ধু, সন্তান"
                      className="min-h-[44px] w-full rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] px-3 py-2 text-sm text-[#1C1C1C] outline-none focus:border-[#0F4D3A]"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {QUICK_RELATIONS.map((rel) => (
                        <button
                          key={rel}
                          type="button"
                          onClick={() => updateField("relation", rel)}
                          className={`rounded-[6px] border px-2 py-0.5 text-[11px] font-medium ${
                            form.relation === rel
                              ? "border-[#0F4D3A] bg-[#0F4D3A]/10 text-[#0F4D3A]"
                              : "border-[#E6E1D6] bg-[#FAF7F2] text-[#5F5F5A]"
                          }`}
                        >
                          {rel}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#1C1C1C]">
                      যোগাযোগ মোবাইল নম্বর <span className="text-[#C62828]">*</span>
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={form.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      placeholder="017XXXXXXXX"
                      className="min-h-[44px] w-full rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] px-3 py-2 text-sm font-semibold tabular-nums text-[#1C1C1C] outline-none focus:border-[#0F4D3A]"
                    />
                    {errors.phone && <FieldError text={errors.phone} />}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#1C1C1C]">
                      বিকল্প মোবাইল নম্বর (ঐচ্ছিক)
                    </label>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={form.alt_phone}
                      onChange={(e) => updateField("alt_phone", e.target.value)}
                      placeholder="018XXXXXXXX"
                      className="min-h-[44px] w-full rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] px-3 py-2 text-sm tabular-nums text-[#1C1C1C] outline-none focus:border-[#0F4D3A]"
                    />
                    {errors.alt_phone && <FieldError text={errors.alt_phone} />}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#1C1C1C]">
                    রোগীর অবস্থা / জরুরি বিবরণ (ঐচ্ছিক)
                  </label>
                  <textarea
                    rows={3}
                    value={form.message}
                    onChange={(e) => updateField("message", e.target.value)}
                    placeholder="যেমন: হিমোগ্লোবিন কমে গেছে / জরুরি অপারেশনের জন্য ফ্রেশ ব্লাড প্রয়োজন"
                    className="w-full rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] p-3 text-sm text-[#1C1C1C] outline-none focus:border-[#0F4D3A]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#1C1C1C]">
                    রক্তদাতার জন্য বিশেষ নির্দেশনা (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={form.instructions}
                    onChange={(e) => updateField("instructions", e.target.value)}
                    placeholder="যেমন: আসার আগে ফোন দিয়ে আসবেন / যাতায়াত খরচ বহন করা হবে"
                    className="min-h-[44px] w-full rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] px-3 py-2 text-sm text-[#1C1C1C] outline-none focus:border-[#0F4D3A]"
                  />
                </div>

                {/* Required Consent Checkboxes */}
                <div className="space-y-2.5 rounded-[12px] border border-[#E6E1D6] bg-[#FAF7F2] p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-[#1C1C1C]">
                    <ShieldCheck className="h-4 w-4 text-[#0F4D3A]" />
                    যাচাই ও প্রকাশের সম্মতি (আবশ্যক)
                  </p>

                  <label className="flex cursor-pointer items-start gap-2.5 text-xs text-[#1C1C1C]">
                    <input
                      type="checkbox"
                      checked={form.consent_accurate}
                      onChange={(e) => updateField("consent_accurate", e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#0F4D3A]"
                    />
                    <span>
                      আমি নিশ্চিত করছি যে উপরের সকল তথ্য সম্পূর্ণ সত্য ও যাচাইযোগ্য। মিথ্যা বা
                      প্রতারণামূলক তথ্য দিলে অনুরোধটি বাতিল করা হবে।
                    </span>
                  </label>
                  {errors.consent_accurate && <FieldError text={errors.consent_accurate} />}

                  <label className="flex cursor-pointer items-start gap-2.5 text-xs text-[#1C1C1C]">
                    <input
                      type="checkbox"
                      checked={form.consent_public}
                      onChange={(e) => updateField("consent_public", e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#0F4D3A]"
                    />
                    <span>
                      রক্তদাতাদের সাথে দ্রুত যোগাযোগের জন্য অনুমোদনের পর আমার মোবাইল নম্বর ও
                      হাসপাতালের তথ্য ওয়েবসাইটে প্রকাশ করার সম্মতি দিচ্ছি।
                    </span>
                  </label>
                  {errors.consent_public && <FieldError text={errors.consent_public} />}
                </div>
              </div>
            )}

            {/* STEP 4: Final Preview */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="rounded-[10px] border border-[#0F4D3A]/25 bg-[#0F4D3A]/5 px-3.5 py-2.5 text-xs text-[#0F4D3A]">
                  অনুরোধ জমা দেওয়ার আগে প্রদত্ত তথ্যগুলো একবার দেখে নিন। প্রয়োজনে আগের ধাপে
                  ফিরে পরিবর্তন করতে পারবেন।
                </div>

                {/* Preview Card matching Homepage Design */}
                <div className="rounded-[12px] border border-[#E6E1D6] bg-[#FAF7F2] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-[#C62828] font-display text-base font-extrabold text-white">
                      {form.blood_group}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-[6px] border border-[#E6E1D6] bg-white px-2 py-0.5 text-[11px] font-bold text-[#1C1C1C]">
                          {form.bags_needed.toLocaleString("bn-BD")} ব্যাগ
                        </span>
                        <span
                          className={`rounded-[6px] px-2 py-0.5 text-[11px] font-bold ${
                            getEmergencyUrgencyMeta(form.urgency).badgeClass
                          }`}
                        >
                          {getEmergencyUrgencyMeta(form.urgency).label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-bold text-[#1C1C1C]">
                        রোগী: {form.patient_name}
                        {form.patient_age ? ` (${form.patient_age} বছর)` : ""}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-3 space-y-1.5 border-t border-[#E6E1D6] pt-3 text-xs text-[#5F5F5A]">
                    <div className="flex items-start gap-2">
                      <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0F4D3A]" />
                      <dd className="font-semibold text-[#1C1C1C]">{form.hospital}</dd>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5F5F5A]" />
                      <dd>
                        {[form.upazila, form.district].filter(Boolean).join(", ")}
                        {form.address ? ` · ${form.address}` : ""}
                      </dd>
                    </div>
                    <div className="flex items-start gap-2">
                      <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C62828]" />
                      <dd className="font-medium text-[#1C1C1C] tabular-nums">
                        {form.needed_date}
                        {form.needed_time ? ` · ${form.needed_time}` : ""}
                      </dd>
                    </div>
                    <div className="flex items-start gap-2">
                      <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0F4D3A]" />
                      <dd>
                        আবেদনকারী: {form.requester_name}
                        {form.relation ? ` (${form.relation})` : ""}
                      </dd>
                    </div>
                    <div className="flex items-start gap-2">
                      <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C62828]" />
                      <dd className="font-bold text-[#1C1C1C] tabular-nums">
                        {normalizeBdPhone(form.phone) || form.phone}
                        {form.alt_phone
                          ? ` · বিকল্প: ${normalizeBdPhone(form.alt_phone) || form.alt_phone}`
                          : ""}
                      </dd>
                    </div>
                  </dl>

                  {form.message && (
                    <p className="mt-2.5 rounded-[8px] border border-[#E6E1D6] bg-white px-3 py-2 text-xs text-[#1C1C1C]">
                      {form.message}
                    </p>
                  )}
                  {form.instructions && (
                    <p className="mt-2 text-[11px] text-[#5F5F5A]">
                      নির্দেশনা: {form.instructions}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Navigation / Submit Buttons */}
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#E6E1D6] pt-4">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={busy}
                  className="inline-flex min-h-[46px] items-center gap-1.5 rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2] px-4 text-xs font-bold text-[#1C1C1C] transition hover:border-[#0F4D3A]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  পেছনে
                </button>
              ) : (
                <div />
              )}

              {step < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex min-h-[46px] flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-[#C62828] px-5 text-sm font-bold text-white transition hover:bg-[#B71C1C] sm:flex-none"
                >
                  <span>পরবর্তী ধাপ</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#C62828] px-6 text-sm font-bold text-white transition hover:bg-[#B71C1C] disabled:opacity-60 sm:flex-none"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>অনুরোধ জমা হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>জরুরি অনুরোধ জমা দিন</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        )}

        {/* MY REQUESTS TAB */}
        {viewTab === "my_requests" && (
          <div className="rounded-[14px] border border-[#E6E1D6] bg-white p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2 border-b border-[#E6E1D6] pb-3">
              <div>
                <h2 className="font-display text-base font-bold text-[#1C1C1C]">
                  আমার জমা দেওয়া অনুরোধসমূহ
                </h2>
                <p className="text-xs text-[#5F5F5A]">
                  আপনার ব্রাউজার/অ্যাকাউন্ট থেকে জমা দেওয়া অনুরোধের লাইভ অবস্থা
                </p>
              </div>
            </div>

            {myLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#5F5F5A]">
                <Loader2 className="h-4 w-4 animate-spin" /> লোড হচ্ছে...
              </div>
            ) : myRequests.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-[#5F5F5A]">
                  আপনি এখনো কোনো জরুরি রক্তের অনুরোধ জমা দেননি।
                </p>
                <button
                  type="button"
                  onClick={() => setViewTab("form")}
                  className="mt-3 inline-flex min-h-[42px] items-center gap-1.5 rounded-[10px] bg-[#C62828] px-4 text-xs font-bold text-white hover:bg-[#B71C1C]"
                >
                  <Plus className="h-4 w-4" /> নতুন অনুরোধ করুন
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {myRequests.map((req) => {
                  const statusMeta = getEmergencyStatusMeta(req.status);
                  const canCancel = req.status === "pending" || req.status === "approved";
                  return (
                    <div
                      key={req.id}
                      className="rounded-[12px] border border-[#E6E1D6] bg-[#FAF7F2]/60 p-3.5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#C62828] font-display text-sm font-extrabold text-white">
                            {req.blood_group}
                          </span>
                          <div>
                            <p className="text-sm font-bold text-[#1C1C1C]">
                              {req.patient_name}{" "}
                              <span className="text-xs font-semibold text-[#5F5F5A]">
                                ({Math.max(1, Number(req.bags_needed ?? 1)).toLocaleString("bn-BD")} ব্যাগ)
                              </span>
                            </p>
                            <p className="text-xs text-[#5F5F5A]">
                              {req.hospital || "হাসপাতাল উল্লেখ নেই"}
                              {req.request_code ? ` · ${req.request_code}` : ""}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`rounded-[8px] px-2.5 py-1 text-[11px] font-bold ${statusMeta.toneClass}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>

                      {req.rejected_reason && req.status === "rejected" && (
                        <p className="mt-2 rounded-[8px] border border-[#C62828]/25 bg-[#C62828]/5 px-3 py-1.5 text-xs text-[#C62828]">
                          বাতিলের কারণ: {req.rejected_reason}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E6E1D6] pt-2.5 text-[11px] text-[#5F5F5A]">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(req.created_at).toLocaleDateString("bn-BD", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>

                        {canCancel && (
                          <button
                            type="button"
                            disabled={cancellingId === req.id}
                            onClick={() => void handleCancelOwn(req.id)}
                            className="inline-flex min-h-[34px] items-center gap-1 rounded-[8px] border border-[#C62828]/30 bg-white px-3 py-1 text-xs font-semibold text-[#C62828] hover:bg-[#C62828]/10 disabled:opacity-50"
                          >
                            {cancellingId === req.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" />
                            )}
                            অনুরোধ বাতিল করুন
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Active Public Emergencies Preview at Bottom of /emergency-request */}
        {activePublicRequests.length > 0 && (
          <div className="rounded-[14px] border border-[#E6E1D6] bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 border-b border-[#E6E1D6] pb-2.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-[#C62828]" strokeWidth={1.75} />
                <h2 className="font-display text-sm font-bold text-[#1C1C1C]">
                  চলমান অনুমোদিত রক্তের অনুরোধ ({activePublicRequests.length.toLocaleString("bn-BD")})
                </h2>
              </div>
              <Link to="/" className="text-xs font-semibold text-[#0F4D3A] hover:underline">
                হোমে দেখুন
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {activePublicRequests.slice(0, 4).map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-[#E6E1D6] bg-[#FAF7F2]/60 p-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[#C62828] text-xs font-extrabold text-white">
                      {req.blood_group}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[#1C1C1C]">
                        {req.patient_name} ·{" "}
                        {Math.max(1, Number(req.bags_needed ?? 1)).toLocaleString("bn-BD")} ব্যাগ
                      </p>
                      <p className="truncate text-[11px] text-[#5F5F5A]">
                        {req.hospital || "হাসপাতাল"}
                      </p>
                    </div>
                  </div>
                  {req.consent_public !== false && req.phone && (
                    <a
                      href={`tel:${req.phone}`}
                      className="inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-[8px] bg-[#C62828] px-3 text-xs font-bold text-white hover:bg-[#B71C1C]"
                    >
                      <Phone className="h-3 w-3" /> কল
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldError({ text }: { text: string }) {
  return (
    <p className="mt-1 flex items-center gap-1 text-[11.5px] font-medium text-[#C62828]">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      <span>{text}</span>
    </p>
  );
}
