import {
  Users, Shield, Flame, Stethoscope, Droplet, PawPrint, GraduationCap,
  Ambulance, Newspaper, Wrench, PhoneCall, Zap, Building2, HardHat,
  Accessibility, Plane, HeartHandshake, FileText, Star, Send, Info,
  HandCoins, MessageCircle, Smartphone, Globe, Landmark, Briefcase,
  Hospital, Car, BookOpen, Award, HelpCircle, MapPin, Heart,
  type LucideIcon,
} from "lucide-react";

export type CategorySlug = string;

export interface Category {
  slug: CategorySlug;
  bn: string;
  en: string;
  icon: LucideIcon;
  iconName?: string;
  tint: string;
  description: string;
  visible?: boolean;
  sort_order?: number;
}

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Users,
  Shield,
  Flame,
  Stethoscope,
  Droplet,
  PawPrint,
  GraduationCap,
  Ambulance,
  Newspaper,
  Wrench,
  PhoneCall,
  Zap,
  Building2,
  HardHat,
  Accessibility,
  Plane,
  HeartHandshake,
  FileText,
  Star,
  Send,
  Info,
  HandCoins,
  MessageCircle,
  Smartphone,
  Globe,
  Landmark,
  Briefcase,
  Hospital,
  Car,
  BookOpen,
  Award,
  HelpCircle,
  MapPin,
  Heart,
};

export const CATEGORY_TINTS: Array<{ label: string; value: string }> = [
  { label: "সবুজ (Emerald)", value: "from-emerald-500/15 to-emerald-700/10" },
  { label: "নীল (Blue)", value: "from-blue-500/15 to-blue-700/10" },
  { label: "কমলা-লাল (Fire)", value: "from-orange-500/15 to-red-600/10" },
  { label: "টিল (Teal)", value: "from-teal-500/15 to-teal-700/10" },
  { label: "গোলাপী-লাল (Rose)", value: "from-rose-500/20 to-rose-700/10" },
  { label: "হলুদ-সোনালী (Amber)", value: "from-amber-500/15 to-amber-700/10" },
  { label: "ইন্ডিগো (Indigo)", value: "from-indigo-500/15 to-indigo-700/10" },
  { label: "লাল (Red)", value: "from-red-500/15 to-red-700/10" },
  { label: "স্লেট (Slate)", value: "from-slate-500/15 to-slate-700/10" },
  { label: "আকাশী (Sky)", value: "from-sky-500/15 to-sky-700/10" },
  { label: "বেগুনী (Violet)", value: "from-violet-500/15 to-violet-700/10" },
  { label: "সায়ান (Cyan)", value: "from-cyan-500/15 to-cyan-700/10" },
  { label: "গোলাপী (Pink)", value: "from-pink-500/15 to-pink-700/10" },
];

export const categories: Category[] = [
  { slug: "janapratinidhi", bn: "জনপ্রতিনিধি", en: "Representatives", icon: Users, iconName: "Users", tint: "from-emerald-500/15 to-emerald-700/10", description: "ইউনিয়ন ও পৌর জনপ্রতিনিধি" },
  { slug: "police", bn: "পুলিশ", en: "Police", icon: Shield, iconName: "Shield", tint: "from-blue-500/15 to-blue-700/10", description: "থানা ও দায়িত্বপ্রাপ্ত কর্মকর্তা" },
  { slug: "fire", bn: "ফায়ার সার্ভিস", en: "Fire Service", icon: Flame, iconName: "Flame", tint: "from-orange-500/15 to-red-600/10", description: "অগ্নিনির্বাপন ও জরুরী সেবা" },
  { slug: "doctor", bn: "ডাক্তার", en: "Doctors", icon: Stethoscope, iconName: "Stethoscope", tint: "from-teal-500/15 to-teal-700/10", description: "চিকিৎসক ও বিশেষজ্ঞ" },
  { slug: "blood-donor", bn: "রক্তদাতা", en: "Blood Donors", icon: Droplet, iconName: "Droplet", tint: "from-rose-500/20 to-rose-700/10", description: "স্বেচ্ছা রক্তদাতাদের তালিকা" },
  { slug: "vet", bn: "পশু ডাক্তার", en: "Vet", icon: PawPrint, iconName: "PawPrint", tint: "from-amber-500/15 to-amber-700/10", description: "পশু চিকিৎসক" },
  { slug: "school", bn: "বিদ্যালয়", en: "Schools", icon: GraduationCap, iconName: "GraduationCap", tint: "from-indigo-500/15 to-indigo-700/10", description: "শিক্ষা প্রতিষ্ঠান" },
  { slug: "ambulance", bn: "অ্যাম্বুলেন্স", en: "Ambulance", icon: Ambulance, iconName: "Ambulance", tint: "from-red-500/15 to-red-700/10", description: "জরুরী যানবাহন" },
  { slug: "journalist", bn: "সাংবাদিক", en: "Journalists", icon: Newspaper, iconName: "Newspaper", tint: "from-slate-500/15 to-slate-700/10", description: "স্থানীয় সংবাদকর্মী" },
  { slug: "garage", bn: "গ্যারেজ", en: "Garage", icon: Wrench, iconName: "Wrench", tint: "from-zinc-500/15 to-zinc-700/10", description: "গাড়ি মেরামত" },
  { slug: "helpline", bn: "জরুরী হেল্পলাইন", en: "Helpline", icon: PhoneCall, iconName: "PhoneCall", tint: "from-emerald-600/20 to-emerald-800/10", description: "জরুরী যোগাযোগ" },
  { slug: "electrician", bn: "ইলেকট্রিশিয়ান", en: "Electrician", icon: Zap, iconName: "Zap", tint: "from-yellow-500/15 to-yellow-700/10", description: "বৈদ্যুতিক মিস্ত্রি" },
  { slug: "electricity-office", bn: "বিদ্যুৎ অফিস", en: "Power Office", icon: Building2, iconName: "Building2", tint: "from-sky-500/15 to-sky-700/10", description: "পল্লী বিদ্যুৎ সমিতি" },
  { slug: "mason", bn: "রাজমিস্ত্রি", en: "Mason", icon: HardHat, iconName: "HardHat", tint: "from-stone-500/15 to-stone-700/10", description: "নির্মাণ মিস্ত্রি" },
  { slug: "disabled", bn: "প্রতিবন্ধী", en: "Disabled", icon: Accessibility, iconName: "Accessibility", tint: "from-violet-500/15 to-violet-700/10", description: "প্রতিবন্ধী সেবা" },
  { slug: "expatriate", bn: "প্রবাসী", en: "Expatriate", icon: Plane, iconName: "Plane", tint: "from-cyan-500/15 to-cyan-700/10", description: "প্রবাসী তথ্য" },
  { slug: "service-org", bn: "সেবা সংগঠন", en: "Service Org", icon: HeartHandshake, iconName: "HeartHandshake", tint: "from-pink-500/15 to-pink-700/10", description: "সেবামূলক সংগঠন" },
  { slug: "board-result", bn: "বোর্ড রেজাল্ট", en: "Board Result", icon: FileText, iconName: "FileText", tint: "from-emerald-500/15 to-teal-700/10", description: "পরীক্ষার ফলাফল" },
  { slug: "special-persons", bn: "বিশেষ ব্যাক্তিবর্গ", en: "Notable People", icon: Star, iconName: "Star", tint: "from-amber-400/20 to-amber-600/10", description: "বিশেষ ব্যাক্তিবর্গ" },
  { slug: "donation", bn: "অনুদান", en: "Donation", icon: HandCoins, iconName: "HandCoins", tint: "from-emerald-500/20 to-amber-500/10", description: "অনুদান দিন ও তালিকা দেখুন" },
  { slug: "submit-info", bn: "তথ্য দিন", en: "Submit Info", icon: Send, iconName: "Send", tint: "from-emerald-500/20 to-emerald-700/10", description: "নতুন তথ্য জমা দিন" },
  { slug: "about", bn: "আমাদের সেবা", en: "About", icon: Info, iconName: "Info", tint: "from-emerald-600/15 to-emerald-800/10", description: "আমাদের সম্পর্কে" },
];

export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);
