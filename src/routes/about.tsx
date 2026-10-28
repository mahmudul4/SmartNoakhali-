import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Phone, Mail, MapPin, CheckCircle2, Sparkles, Layers } from "lucide-react";
import { useLogo, useSiteMetaConfig, useServicesConfig, type ServiceItem } from "@/lib/store";
import { CATEGORY_ICONS } from "@/data/categories";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "আমাদের সেবা — স্মার্ট নোয়াখালী" },
      { name: "description", content: "স্মার্ট নোয়াখালী ডিজিটাল সেবা ও তথ্যের প্ল্যাটফর্ম" },
    ],
  }),
  component: About,
});

function About() {
  const { logo } = useLogo();
  const { meta } = useSiteMetaConfig();
  const { config, services } = useServicesConfig();

  const phone = meta.contactPhone || meta.helplinePhone || "01850999178";
  const email = meta.contactEmail || "e.smartnoakhali@gmail.com";
  const address =
    meta.contactAddress ||
    "কালাসর্দ্দা, গোবিন্দপুর, কুতুবের হাট-৩৮৬২, নবীপুর, সেনবাগ, নোয়াখালী, বাংলাদেশ।";

  const activeServices = (services || []).filter((s) => s.active !== false);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-4">
      {/* Back button */}
      <Link
        to="/"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> ফিরে যান হোম-এ
      </Link>

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-6 text-primary-foreground shadow-elevated">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/10 p-2 backdrop-blur-xs">
            <img
              src={logo}
              alt="Smart Noakhali Logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold backdrop-blur-xs">
              <Sparkles className="h-3.5 w-3.5" />
              <span>ডিজিটাল সেবা পরিচিতি</span>
            </div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">
              {config.pageTitle || "আমাদের সেবা — স্মার্ট নোয়াখালী"}
            </h1>
            <p className="mt-2 text-sm opacity-90 leading-relaxed sm:text-base">
              {config.pageSubtitle ||
                "স্মার্ট নোয়াখালী হলো নোয়াখালী জেলার একটি ডিজিটাল সেবা ডিরেক্টরি, যেখানে এক ক্লিকেই পাবেন আইনজীবী, ডাক্তার, পুলিশ, ফায়ার সার্ভিস, রক্তদাতা সহ সকল গুরুত্বপূর্ণ যোগাযোগ।"}
            </p>
          </div>
        </div>
      </div>

      {/* Contact info rows */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <InfoRow icon={Phone} label="জরুরী হটলাইন ও যোগাযোগ" value={phone} href={`tel:${phone}`} />
        <InfoRow icon={Mail} label="অফিসিয়াল ইমেইল" value={email} href={`mailto:${email}`} />
        <InfoRow icon={MapPin} label="কার্যালয়ের ঠিকানা" value={address} />
      </div>

      {/* Services List Section */}
      <div className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-primary-deep sm:text-xl">
              আমাদের সেবাসমূহ
            </h2>
            <p className="text-xs text-muted-foreground">
              নোয়াখালীর সাধারণ নাগরিকদের জন্য সার্বক্ষণিক প্রদত্ত সেবা
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            {activeServices.length} টি সেবা সক্রিয়
          </span>
        </div>

        {activeServices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            বর্তমানে কোনো সেবা সক্রিয় নেই।
          </div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2">
            {activeServices.map((service, idx) => (
              <ServiceCard key={service.id || idx} service={service} index={idx} />
            ))}
          </div>
        )}
      </div>

      {/* Goals & Missions */}
      <div className="mt-6 rounded-2xl border border-border/80 bg-card p-5 shadow-card">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <h3 className="font-display font-bold text-primary-deep">আমাদের লক্ষ্য ও উদ্দেশ্য</h3>
        </div>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 text-sm text-foreground/90">
          <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
            <span className="text-primary font-bold">•</span>
            <span>নোয়াখালী জেলার প্রতিটি উপজেলা ও ইউনিয়নের সঠিক যোগাযোগ তথ্য এক ক্লিকে প্রদান।</span>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
            <span className="text-primary font-bold">•</span>
            <span>জরুরী প্রয়োজনে ২৪ ঘণ্টা স্বেচ্ছায় রক্তদাতাদের সাথে দ্রুত সংযোগ স্থাপন।</span>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
            <span className="text-primary font-bold">•</span>
            <span>সব ধরণের সরকারি, বেসরকারি, আইনি ও জরুরি সেবা সম্পূর্ণ বিনামূল্যে পৌঁছে দেওয়া।</span>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
            <span className="text-primary font-bold">•</span>
            <span>এলাকাবাসীর সহজ ব্যবহার ও সার্বক্ষণিক লাইভ চ্যাট ও এআই সহায়তা নিশ্চিত করা।</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceCard({ service, index }: { service: ServiceItem; index: number }) {
  const IconComponent = service.iconName ? CATEGORY_ICONS[service.iconName] || Layers : Layers;

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated">
      <div>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-xs">
            {service.imageUrl ? (
              <img
                src={service.imageUrl}
                alt={service.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <IconComponent className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-primary/70">
                #{String(index + 1).padStart(2, "0")}
              </span>
              <h4 className="font-display text-sm font-bold text-foreground sm:text-base leading-snug">
                {service.title}
              </h4>
            </div>
            {service.description && (
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed sm:text-[13px]">
                {service.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="flex h-full items-center gap-3 rounded-2xl border border-border/60 bg-gradient-card p-3.5 shadow-card transition hover:border-primary/30">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="truncate text-xs font-semibold sm:text-sm">{value}</p>
      </div>
    </div>
  );
  return href ? (
    <a href={href} className="block transition hover:opacity-90">
      {content}
    </a>
  ) : (
    content
  );
}