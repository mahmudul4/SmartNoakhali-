import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Phone, Mail, MapPin } from "lucide-react";
import { useLogo } from "@/lib/store";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "আমাদের সেবা — স্মার্ট নোয়াখালী" }, { name: "description", content: "স্মার্ট নোয়াখালী সম্পর্কে জানুন" }] }),
  component: About,
});

function About() {
  const { logo } = useLogo();
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-4">
      <Link to="/" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> হোম</Link>

      <div className="overflow-hidden rounded-3xl bg-gradient-hero p-6 text-primary-foreground shadow-elevated">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="h-20 w-20 shrink-0 flex items-center justify-center p-1">
            <img
              src={logo}
              alt="Smart Noakhali Logo"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">আমাদের সেবা — স্মার্ট নোয়াখালী</h1>
            <p className="mt-2 text-sm opacity-90 leading-relaxed">
              স্মার্ট নোয়াখালী হলো নোয়াখালী জেলার একটি ডিজিটাল সেবা ডিরেক্টরি, যেখানে এক ক্লিকেই পাবেন আইনজীবী, ডাক্তার, পুলিশ, ফায়ার সার্ভিস, রক্তদাতা সহ সকল গুরুত্বপূর্ণ যোগাযোগ।
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <InfoRow icon={Phone} label="যোগাযোগ" value="01850999178" href="tel:01850999178" />
        <InfoRow icon={Mail} label="ইমেইল" value="e.smartnoakhali@gmail.com" href="mailto:e.smartnoakhali@gmail.com" />
        <InfoRow icon={MapPin} label="ঠিকানা" value="কালাসর্দ্দা, গোবিন্দপুর, কুতুবের হাট-৩৮৬২, নবীপুর, সেনবাগ, নোয়াখালী, বাংলাদেশ।" />
      </div>

      <div className="mt-4 rounded-2xl bg-card p-5 shadow-card">
        <p className="font-display font-bold text-primary-deep">আমাদের লক্ষ্য</p>
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
          <li>• এলাকার সকল জরুরী সেবার নম্বর এক জায়গায় রাখা</li>
          <li>• রক্তদাতাদের সাথে দ্রুত যোগাযোগের সুযোগ</li>
          <li>• স্বচ্ছ ও নির্ভরযোগ্য তথ্য প্রদান</li>
          <li>• এলাকাবাসীর জন্য সহজ ডিজিটাল প্ল্যাটফর্ম</li>
        </ul>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, href }: { icon: typeof Phone; label: string; value: string; href?: string }) {
  const content = (
    <div className="flex items-center gap-3 rounded-2xl bg-gradient-card p-4 shadow-card">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
  return href ? <a href={href}>{content}</a> : content;
}