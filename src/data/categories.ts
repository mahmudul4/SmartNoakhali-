import {
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
  HeartPulse,
  Wallet,
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
  Truck,
  Scale,
  Hotel,
  Camera,
  Package,
  Bus,
  Train,
  Fuel,
  Layers,
  Utensils,
  ShoppingBag,
  ShoppingCart,
  Hammer,
  Sprout,
  Home,
  Trees,
  Cross,
  Sun,
  Radio,
  Scissors,
  Receipt,
  ShieldAlert,
  Shirt,
  Footprints,
  Coffee,
  Cake,
  Baby,
  Trophy,
  Dumbbell,
  Leaf,
  Laptop,
  Palette,
  Bike,
  Megaphone,
  UserCheck,
  Eye,
  Smile,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type CategorySlug = string;

export type CategoryFormType =
  | "general"
  | "shopping"
  | "food"
  | "doctor"
  | "hospital"
  | "medical"
  | "education"
  | "job"
  | "realestate"
  | "transport"
  | "tourism"
  | "agriculture"
  | "govt"
  | "religious_social"
  | "events"
  | "home_services"
  | "tech_digital"
  | "sports_entertainment"
  | "news_community"
  | "women_child"
  | "environment_welfare"
  | "professionals"
  | "other_services"
  | "blood"
  | "shop"
  | "hotel"
  | "personal";

export interface Division {
  id: string;
  bn: string;
  en: string;
  icon: LucideIcon;
  iconName: string;
  tint: string;
  description: string;
  sort_order: number;
  customIconUrl?: string;
  visible?: boolean;
}

export interface Category {
  slug: CategorySlug;
  divisionId: string;
  bn: string;
  en: string;
  icon: LucideIcon;
  iconName?: string;
  tint: string;
  description: string;
  formType?: CategoryFormType;
  customIconUrl?: string;
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
  HeartPulse,
  Wallet,
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
  Truck,
  Scale,
  Hotel,
  Camera,
  Package,
  Bus,
  Train,
  Fuel,
  Layers,
  Utensils,
  ShoppingBag,
  ShoppingCart,
  Hammer,
  Sprout,
  Home,
  Trees,
  Cross,
  Sun,
  Radio,
  Scissors,
  Receipt,
  ShieldAlert,
  Shirt,
  Footprints,
  Coffee,
  Cake,
  Baby,
  Trophy,
  Dumbbell,
  Leaf,
  Laptop,
  Palette,
  Bike,
  Megaphone,
  UserCheck,
  Eye,
  Smile,
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

// ============================================================================
// 22 Major Divisions of Smart Noakhali (হুবহু ২২টি বিভাগ)
// ============================================================================
export const DIVISIONS: Division[] = [
  {
    id: "donation",
    bn: "অনুদান ও মানবিক সহায়তা",
    en: "Donation & Relief",
    icon: HandCoins,
    iconName: "HandCoins",
    tint: "from-emerald-500/20 to-amber-500/10",
    description: "সাধারণ, চিকিৎসা, শিক্ষা অনুদান, যাকাত ও খরচের হিসাব",
    sort_order: 1,
    visible: true,
  },
  {
    id: "shopping",
    bn: "কেনাকাটা ও অনলাইন শপ",
    en: "Shopping & Online Stores",
    icon: ShoppingBag,
    iconName: "ShoppingBag",
    tint: "from-purple-500/20 to-pink-700/10",
    description: "পোশাক, জুতা, ব্যাগ, মোবাইল, ইলেকট্রনিক্স ও নিত্যপণ্য",
    sort_order: 2,
    visible: true,
  },
  {
    id: "food",
    bn: "খাবার ও রেস্টুরেন্ট",
    en: "Food & Restaurants",
    icon: Utensils,
    iconName: "Utensils",
    tint: "from-orange-500/20 to-amber-700/10",
    description: "রেস্টুরেন্ট, ফাস্ট ফুড, বিরিয়ানি, মিষ্টি, বেকারি ও ক্যাটারিং",
    sort_order: 3,
    visible: true,
  },
  {
    id: "health",
    bn: "স্বাস্থ্য ও চিকিৎসা",
    en: "Health & Medical",
    icon: Stethoscope,
    iconName: "Stethoscope",
    tint: "from-teal-500/20 to-emerald-700/10",
    description: "ডাক্তার, হাসপাতাল, ডায়াগনস্টিক, রক্তদাতা ও ফার্মেসী",
    sort_order: 4,
    visible: true,
  },
  {
    id: "education",
    bn: "শিক্ষা ও প্রশিক্ষণ",
    en: "Education & Training",
    icon: GraduationCap,
    iconName: "GraduationCap",
    tint: "from-indigo-500/20 to-blue-700/10",
    description: "স্কুল, কলেজ, মাদ্রাসা, কোচিং, টিউটর ও লাইব্রেরি",
    sort_order: 5,
    visible: true,
  },
  {
    id: "jobs",
    bn: "চাকরি ও ক্যারিয়ার",
    en: "Jobs & Career",
    icon: Briefcase,
    iconName: "Briefcase",
    tint: "from-sky-500/20 to-blue-700/10",
    description: "সরকারি-বেসরকারি চাকরি, পার্টটাইম, ফ্রিল্যান্সিং ও ক্যারিয়ার",
    sort_order: 6,
    visible: true,
  },
  {
    id: "business",
    bn: "ব্যবসা ও পেশাগত সেবা",
    en: "Business & Commerce",
    icon: Building2,
    iconName: "Building2",
    tint: "from-emerald-600/20 to-teal-800/10",
    description: "স্থানীয় ব্যবসা, দোকান, পাইকারি, ডিজিটাল মার্কেটিং ও প্রিন্টিং",
    sort_order: 7,
    visible: true,
  },
  {
    id: "realestate",
    bn: "বাসা, জমি ও আবাসন",
    en: "Housing & Real Estate",
    icon: Home,
    iconName: "Home",
    tint: "from-blue-600/20 to-indigo-800/10",
    description: "বাসা ও ফ্ল্যাট ভাড়া, জমি-বাড়ি বিক্রি, হোস্টেল ও মেস",
    sort_order: 8,
    visible: true,
  },
  {
    id: "transport",
    bn: "পরিবহন ও যানবাহন",
    en: "Transport & Travel",
    icon: Bus,
    iconName: "Bus",
    tint: "from-cyan-500/20 to-sky-700/10",
    description: "বাস, টিকিট, রেন্ট-এ-কার, ট্রাক, সিএনজি ও কুরিয়ার",
    sort_order: 9,
    visible: true,
  },
  {
    id: "tourism",
    bn: "পর্যটন ও ভ্রমণ",
    en: "Hotels & Tourism",
    icon: Hotel,
    iconName: "Hotel",
    tint: "from-amber-500/20 to-yellow-700/10",
    description: "দর্শনীয় স্থান, হোটেল, রিসোর্ট, ভ্রমণ প্যাকেজ ও গাইড",
    sort_order: 10,
    visible: true,
  },
  {
    id: "agriculture",
    bn: "কৃষি, মৎস্য ও প্রাণিসম্পদ",
    en: "Agriculture & Livestock",
    icon: Sprout,
    iconName: "Sprout",
    tint: "from-lime-500/20 to-emerald-700/10",
    description: "সার-বীজ, চারা, মাছ চাষ, গবাদিপশু ও পশু চিকিৎসা",
    sort_order: 11,
    visible: true,
  },
  {
    id: "govt",
    bn: "সরকারি ও নাগরিক সেবা",
    en: "Govt & Citizen Services",
    icon: Landmark,
    iconName: "Landmark",
    tint: "from-emerald-500/20 to-teal-700/10",
    description: "ইউনিয়ন পরিষদ, পৌরসভা, জন্মনিবন্ধন, এনআইডি ও হেল্পলাইন",
    sort_order: 12,
    visible: true,
  },
  {
    id: "religious_social",
    bn: "ধর্মীয় ও সামাজিক প্রতিষ্ঠান",
    en: "Religious & Social Orgs",
    icon: Sun,
    iconName: "Sun",
    tint: "from-amber-600/20 to-yellow-800/10",
    description: "মসজিদ, মাদ্রাসা, মন্দির, এতিমখানা ও স্বেচ্ছাসেবী সংগঠন",
    sort_order: 13,
    visible: true,
  },
  {
    id: "events",
    bn: "ইভেন্ট ও অনুষ্ঠান",
    en: "Events & Celebrations",
    icon: Cake,
    iconName: "Cake",
    tint: "from-pink-500/20 to-rose-700/10",
    description: "বিয়ে, জন্মদিন, ডেকোরেশন, ফটোগ্রাফি ও সাউন্ড সিস্টেম",
    sort_order: 14,
    visible: true,
  },
  {
    id: "home_services",
    bn: "বাড়ি ও ব্যক্তিগত সেবা",
    en: "Home & Personal Services",
    icon: Wrench,
    iconName: "Wrench",
    tint: "from-stone-500/20 to-zinc-700/10",
    description: "ইলেকট্রিশিয়ান, প্লাম্বার, এসি-ফ্রিজ, রাজমিস্ত্রি ও সেলুন",
    sort_order: 15,
    visible: true,
  },
  {
    id: "tech_digital",
    bn: "প্রযুক্তি ও ডিজিটাল সেবা",
    en: "Technology & Digital",
    icon: Laptop,
    iconName: "Laptop",
    tint: "from-cyan-600/20 to-blue-800/10",
    description: "ইন্টারনেট, সফটওয়্যার, ওয়েবসাইট, সাইবার ক্যাফে ও প্রিন্টিং",
    sort_order: 16,
    visible: true,
  },
  {
    id: "sports_entertainment",
    bn: "খেলাধুলা ও বিনোদন",
    en: "Sports & Recreation",
    icon: Trophy,
    iconName: "Trophy",
    tint: "from-violet-500/20 to-purple-700/10",
    description: "ক্রিকেট, ফুটবল, ব্যাডমিন্টন, জিম, স্পোর্টস ক্লাব ও মাঠ",
    sort_order: 17,
    visible: true,
  },
  {
    id: "news_community",
    bn: "সংবাদ, তথ্য ও কমিউনিটি",
    en: "News & Community",
    icon: Newspaper,
    iconName: "Newspaper",
    tint: "from-slate-500/20 to-slate-700/10",
    description: "নোয়াখালীর খবর, স্থানীয় ঘোষণা, হারানো-পাওয়া ও সচেতনতা",
    sort_order: 18,
    visible: true,
  },
  {
    id: "women_child",
    bn: "নারী, শিশু ও পরিবার",
    en: "Women & Child Care",
    icon: Baby,
    iconName: "Baby",
    tint: "from-rose-500/20 to-orange-700/10",
    description: "নারী উদ্যোক্তা, প্রশিক্ষণ, শিশু স্বাস্থ্য ও পরিবার কল্যাণ",
    sort_order: 19,
    visible: true,
  },
  {
    id: "environment_welfare",
    bn: "পরিবেশ ও জনকল্যাণ",
    en: "Environment & Welfare",
    icon: Trees,
    iconName: "Trees",
    tint: "from-emerald-500/20 to-teal-700/10",
    description: "বৃক্ষরোপণ, পরিচ্ছন্নতা, বর্জ্য ব্যবস্থাপনা ও দুর্যোগ প্রস্তুতি",
    sort_order: 20,
    visible: true,
  },
  {
    id: "professionals",
    bn: "পেশাজীবী ও বিশেষজ্ঞ",
    en: "Professionals & Specialists",
    icon: UserCheck,
    iconName: "UserCheck",
    tint: "from-indigo-500/20 to-purple-700/10",
    description: "আইনজীবী, হিসাবরক্ষক, ইঞ্জিনিয়ার, শিক্ষক ও পরামর্শক",
    sort_order: 21,
    visible: true,
  },
  {
    id: "other_services",
    bn: "অন্যান্য সেবা",
    en: "Other Community Services",
    icon: Layers,
    iconName: "Layers",
    tint: "from-teal-500/20 to-emerald-800/10",
    description: "অন্যান্য স্থানীয় ব্যবসা, নতুন ক্যাটাগরি প্রস্তাব ও কার্যক্রম",
    sort_order: 22,
    visible: true,
  },
];

// ============================================================================
// All 181 Categories (২ থেকে ২২ নম্বর বিভাগের নির্ধারিত সকল ১৮১টি ক্যাটাগরি)
// ============================================================================
export const categories: Category[] = [
  // --------------------------------------------------------------------------
  // বিভাগ ১: অনুদান ও মানবিক সহায়তা (১১টি পূর্ণাঙ্গ ক্যাটাগরি + সংরক্ষিত সেবা)
  // --------------------------------------------------------------------------
  { slug: "donation", divisionId: "donation", bn: "অনুদান ও মানবিক সহায়তা", en: "Donation Hub", icon: HandCoins, iconName: "HandCoins", tint: "from-emerald-500/20 to-amber-500/10", description: "সাধারণ, চিকিৎসা, শিক্ষা ও যাকাত অনুদান পোর্টাল", formType: "general", visible: true, sort_order: 1 },
  { slug: "donation-general", divisionId: "donation", bn: "সাধারণ অনুদান", en: "General Donation", icon: HandCoins, iconName: "HandCoins", tint: "from-emerald-500/15 to-emerald-700/10", description: "নোয়াখালীর যেকোনো মানবিক ও সামাজিক উন্নয়নে সাধারণ তহবিল", formType: "general", visible: true, sort_order: 2 },
  { slug: "donation-treatment", divisionId: "donation", bn: "চিকিৎসা অনুদান", en: "Medical Aid", icon: HeartPulse, iconName: "HeartPulse", tint: "from-rose-500/15 to-pink-700/10", description: "অসহায় ও দরিদ্র রোগীদের জীবন রক্ষাকারী চিকিৎসা তহবিল", formType: "doctor", visible: true, sort_order: 3 },
  { slug: "donation-education", divisionId: "donation", bn: "শিক্ষা অনুদান", en: "Education Aid", icon: GraduationCap, iconName: "GraduationCap", tint: "from-indigo-500/15 to-blue-700/10", description: "মেধাবী ও সুবিধাবঞ্চিত শিক্ষার্থীদের শিক্ষা উপকরণ ও ফি", formType: "education", visible: true, sort_order: 4 },
  { slug: "donation-zakat", divisionId: "donation", bn: "যাকাত ও সদকা", en: "Zakat & Sadaqah", icon: Wallet, iconName: "Wallet", tint: "from-amber-500/15 to-yellow-700/10", description: "ইসলামিক নীতিমালা অনুযায়ী হকদারদের মাঝে যাকাত ও সদকা বণ্টন", formType: "general", visible: true, sort_order: 5 },
  { slug: "orphans-helpless", divisionId: "donation", bn: "এতিম ও অসহায়দের সহায়তা", en: "Orphans & Helpless", icon: HeartHandshake, iconName: "HeartHandshake", tint: "from-purple-500/15 to-violet-700/10", description: "এতিমখানা, পথশিশু ও নিঃস্ব মানুষের সার্বিক পুনর্বাসন", formType: "general", visible: true, sort_order: 6 },
  { slug: "emergency-relief", divisionId: "donation", bn: "জরুরি ত্রাণ", en: "Emergency Relief", icon: ShieldAlert, iconName: "ShieldAlert", tint: "from-red-500/15 to-rose-700/10", description: "বন্যা, ঘূর্ণিঝড়, অগ্নিকাণ্ড ও আকস্মিক দুর্যোগে জরুরি খাদ্য ও ত্রাণ", formType: "general", visible: true, sort_order: 7 },
  { slug: "food-clothing", divisionId: "donation", bn: "খাদ্য ও বস্ত্র বিতরণ", en: "Food & Clothes", icon: Package, iconName: "Package", tint: "from-orange-500/15 to-amber-700/10", description: "শীতবস্ত্র, রমজানের ইফতার ও খাদ্যসামগ্রী বিতরণ কর্মসূচি", formType: "general", visible: true, sort_order: 8 },
  { slug: "individual-family", divisionId: "donation", bn: "ব্যক্তি ও পরিবারভিত্তিক অনুদান", en: "Family Aid", icon: Users, iconName: "Users", tint: "from-teal-500/15 to-emerald-700/10", description: "গৃহহীনদের ঘর নির্মাণ ও দুস্থ পরিবারের গোপন মানবিক সহায়তা", formType: "general", visible: true, sort_order: 9 },
  { slug: "religious-institution", divisionId: "donation", bn: "ধর্মীয় প্রতিষ্ঠানে অনুদান", en: "Religious Aid", icon: Landmark, iconName: "Landmark", tint: "from-sky-500/15 to-blue-700/10", description: "মসজিদ, মাদ্রাসা, এতিমখানা ও কবরস্থান উন্নয়নে অনুদান", formType: "general", visible: true, sort_order: 10 },
  { slug: "social-project", divisionId: "donation", bn: "সামাজিক প্রকল্প", en: "Social Projects", icon: Building2, iconName: "Building2", tint: "from-cyan-500/15 to-teal-700/10", description: "নলকূপ স্থাপন, স্যানিটেশন, বৃক্ষরোপণ ও সমাজসেবামূলক দীর্ঘমেয়াদী প্রকল্প", formType: "general", visible: true, sort_order: 11 },
  { slug: "donation-reports", divisionId: "donation", bn: "অনুদানের হিসাব ও রিপোর্ট", en: "Donation Reports", icon: FileText, iconName: "FileText", tint: "from-emerald-600/20 to-teal-800/10", description: "মোট অনুদান, ব্যয়, অবশিষ্ট তহবিল ও পূর্ণ স্বচ্ছ মাসিক হিসাব", formType: "general", visible: true, sort_order: 12 },
  { slug: "emergency-request", divisionId: "donation", bn: "জরুরি রক্তের আবেদন", en: "Blood Request", icon: ShieldAlert, iconName: "ShieldAlert", tint: "from-red-600/20 to-rose-800/10", description: "জরুরী রক্তের জন্য তাৎক্ষণিক পোস্ট", formType: "blood", visible: true, sort_order: 13 },
  { slug: "special-persons", divisionId: "donation", bn: "বিশেষ ব্যক্তিবর্গ", en: "Notable People", icon: Star, iconName: "Star", tint: "from-amber-400/20 to-amber-600/10", description: "নোয়াখালীর কৃতি সন্তান ও বিশেষ ব্যক্তিত্ব", formType: "general", visible: true, sort_order: 14 },

  // --------------------------------------------------------------------------
  // বিভাগ ২: কেনাকাটা ও অনলাইন শপ — ১২টি
  // --------------------------------------------------------------------------
  { slug: "clothing", divisionId: "shopping", bn: "পোশাক", en: "Clothing", icon: Shirt, iconName: "Shirt", tint: "from-purple-500/15 to-purple-700/10", description: "শাড়ি, থ্রি-পিস, শার্ট, পাঞ্জাবি ও পোশাক", formType: "shopping", visible: true, sort_order: 1 },
  { slug: "shoes", divisionId: "shopping", bn: "জুতা", en: "Shoes", icon: Footprints, iconName: "Footprints", tint: "from-pink-500/15 to-rose-700/10", description: "জুতো, স্যান্ডেল, কেডস ও চামড়ার পণ্য", formType: "shopping", visible: true, sort_order: 2 },
  { slug: "bags", divisionId: "shopping", bn: "ব্যাগ", en: "Bags", icon: Package, iconName: "Package", tint: "from-violet-500/15 to-purple-700/10", description: "স্কুল ব্যাগ, লেডিস ব্যাগ, ট্রাভেল লাগেজ", formType: "shopping", visible: true, sort_order: 3 },
  { slug: "mobiles", divisionId: "shopping", bn: "মোবাইল", en: "Mobiles", icon: Smartphone, iconName: "Smartphone", tint: "from-blue-500/15 to-cyan-700/10", description: "স্মার্টফোন, গ্যাজেট ও মোবাইল এক্সেসরিজ", formType: "shopping", visible: true, sort_order: 4 },
  { slug: "electronics", divisionId: "shopping", bn: "ইলেকট্রনিক্স", en: "Electronics", icon: Zap, iconName: "Zap", tint: "from-sky-500/15 to-indigo-700/10", description: "টিভি, ফ্রিজ, ফ্যান ও হোম অ্যাপ্লায়েন্স", formType: "shopping", visible: true, sort_order: 5 },
  { slug: "home-kitchen", divisionId: "shopping", bn: "ঘর ও রান্নাঘরের পণ্য", en: "Home & Kitchen", icon: Home, iconName: "Home", tint: "from-amber-500/15 to-orange-700/10", description: "ক্রোকারিজ, প্লাস্টিক ও গৃহস্থালি সামগ্রী", formType: "shopping", visible: true, sort_order: 6 },
  { slug: "bakery-shop", divisionId: "shopping", bn: "বেকারি", en: "Bakery Shop", icon: Cake, iconName: "Cake", tint: "from-rose-500/15 to-pink-700/10", description: "বিস্কুট, কেক, প্যাটিস ও কনফেকশনারি", formType: "shopping", visible: true, sort_order: 7 },
  { slug: "sweets-shop", divisionId: "shopping", bn: "মিষ্টি", en: "Sweets Shop", icon: Coffee, iconName: "Coffee", tint: "from-yellow-600/15 to-amber-700/10", description: "নোয়াখালীর ঐতিহ্যবাহী মিষ্টি ও দই", formType: "shopping", visible: true, sort_order: 8 },
  { slug: "grocery", divisionId: "shopping", bn: "মুদি পণ্য", en: "Grocery", icon: ShoppingCart, iconName: "ShoppingCart", tint: "from-emerald-500/15 to-teal-700/10", description: "চাল, ডাল, তেল ও নিত্যপ্রয়োজনীয় বাজার", formType: "shopping", visible: true, sort_order: 9 },
  { slug: "beauty-cosmetics", divisionId: "shopping", bn: "সৌন্দর্যসামগ্রী", en: "Beauty & Cosmetics", icon: Sparkles, iconName: "Sparkles", tint: "from-pink-500/15 to-rose-700/10", description: "স্কিন কেয়ার, মেকআপ ও কসমেটিকস", formType: "shopping", visible: true, sort_order: 10 },
  { slug: "agri-products", divisionId: "shopping", bn: "কৃষিপণ্য", en: "Agri Products", icon: Sprout, iconName: "Sprout", tint: "from-lime-500/15 to-emerald-700/10", description: "তাজা শাকসবজি, ফলমূল ও স্থানীয় ফসল", formType: "shopping", visible: true, sort_order: 11 },
  { slug: "gifts-crafts", divisionId: "shopping", bn: "উপহার", en: "Gifts & Crafts", icon: Award, iconName: "Award", tint: "from-teal-500/15 to-cyan-700/10", description: "উপহার সামগ্রী, ঘড়ি, চশমা ও শোপিস", formType: "shopping", visible: true, sort_order: 12 },

  // --------------------------------------------------------------------------
  // বিভাগ ৩: খাবার ও রেস্টুরেন্ট — ১১টি
  // --------------------------------------------------------------------------
  { slug: "restaurants", divisionId: "food", bn: "রেস্টুরেন্ট", en: "Restaurants", icon: Utensils, iconName: "Utensils", tint: "from-amber-500/15 to-orange-700/10", description: "পারিবারিক ডাইনিং ও চাইনিজ রেস্তোরাঁ", formType: "food", visible: true, sort_order: 1 },
  { slug: "fast-food", divisionId: "food", bn: "ফাস্ট ফুড", en: "Fast Food", icon: Utensils, iconName: "Utensils", tint: "from-red-500/15 to-orange-700/10", description: "বার্গার, পিৎজা, ফ্রাইড চিকেন ও স্ন্যাক্স", formType: "food", visible: true, sort_order: 2 },
  { slug: "bangla-food", divisionId: "food", bn: "বাংলা খাবার", en: "Bangla Food", icon: Utensils, iconName: "Utensils", tint: "from-emerald-500/15 to-teal-700/10", description: "ভাত, মাছ, মাংস, ভর্তা ও ঘরোয়া খাবার", formType: "food", visible: true, sort_order: 3 },
  { slug: "biryani", divisionId: "food", bn: "বিরিয়ানি", en: "Biryani", icon: Utensils, iconName: "Utensils", tint: "from-yellow-600/15 to-amber-700/10", description: "কাচ্চি, মোরগ পোলাও ও তেহারি", formType: "food", visible: true, sort_order: 4 },
  { slug: "bakery-food", divisionId: "food", bn: "বেকারি", en: "Bakery", icon: Cake, iconName: "Cake", tint: "from-rose-500/15 to-pink-700/10", description: "তাজা রুটি, পেস্ট্রি, কুকিজ ও স্ন্যাক্স", formType: "food", visible: true, sort_order: 5 },
  { slug: "cake", divisionId: "food", bn: "কেক", en: "Cake", icon: Cake, iconName: "Cake", tint: "from-pink-500/15 to-rose-700/10", description: "জন্মদিন, বিয়ে ও কাস্টমাইজড কেক", formType: "food", visible: true, sort_order: 6 },
  { slug: "sweets-food", divisionId: "food", bn: "মিষ্টি", en: "Sweets", icon: Coffee, iconName: "Coffee", tint: "from-amber-600/15 to-yellow-700/10", description: "রসগোল্লা, চমচম, ছানার মিষ্টি ও দধি", formType: "food", visible: true, sort_order: 7 },
  { slug: "tea-coffee", divisionId: "food", bn: "চা-কফি", en: "Tea & Coffee", icon: Coffee, iconName: "Coffee", tint: "from-stone-500/15 to-amber-700/10", description: "বিশেষ চা, কফি শপ ও আড্ডা স্পট", formType: "food", visible: true, sort_order: 8 },
  { slug: "homemade-food", divisionId: "food", bn: "হোমমেড খাবার", en: "Homemade Food", icon: Heart, iconName: "Heart", tint: "from-pink-500/15 to-purple-700/10", description: "গৃহিণীদের তৈরি স্বাস্থ্যকর ঘরোয়া খাবার", formType: "food", visible: true, sort_order: 9 },
  { slug: "catering", divisionId: "food", bn: "ক্যাটারিং", en: "Catering", icon: Users, iconName: "Users", tint: "from-indigo-500/15 to-blue-700/10", description: "অনুষ্ঠানের খাবার রান্না ও ক্যাটারিং সার্ভিস", formType: "food", visible: true, sort_order: 10 },
  { slug: "food-delivery", divisionId: "food", bn: "খাবার ডেলিভারি", en: "Food Delivery", icon: Truck, iconName: "Truck", tint: "from-teal-500/15 to-emerald-700/10", description: "বাসায় বা অফিসে দ্রুত খাবার পৌঁছে দেওয়া", formType: "food", visible: true, sort_order: 11 },

  // --------------------------------------------------------------------------
  // বিভাগ ৪: স্বাস্থ্য ও চিকিৎসা — ১০টি
  // --------------------------------------------------------------------------
  { slug: "hospital", divisionId: "health", bn: "হাসপাতাল", en: "Hospital", icon: Hospital, iconName: "Hospital", tint: "from-emerald-500/15 to-teal-700/10", description: "সরকারি ও বেসরকারি জেনারেল হাসপাতাল", formType: "hospital", visible: true, sort_order: 1 },
  { slug: "clinics", divisionId: "health", bn: "ক্লিনিক", en: "Clinics", icon: Building2, iconName: "Building2", tint: "from-teal-500/15 to-cyan-700/10", description: "বিশেষায়িত ক্লিনিক ও নার্সিং হোম", formType: "hospital", visible: true, sort_order: 2 },
  { slug: "doctor", divisionId: "health", bn: "ডাক্তার", en: "Doctor", icon: Stethoscope, iconName: "Stethoscope", tint: "from-teal-500/15 to-emerald-700/10", description: "মেডিসিন, সার্জারি ও বিশেষজ্ঞ চিকিৎসক", formType: "doctor", visible: true, sort_order: 3 },
  { slug: "diagnostic", divisionId: "health", bn: "ডায়াগনস্টিক সেন্টার", en: "Diagnostic Center", icon: Building2, iconName: "Building2", tint: "from-cyan-500/15 to-sky-700/10", description: "প্যাথলজি, এক্স-রে, সিটি স্ক্যান ও টেস্ট", formType: "medical", visible: true, sort_order: 4 },
  { slug: "pharmacy", divisionId: "health", bn: "ফার্মেসি", en: "Pharmacy", icon: Package, iconName: "Package", tint: "from-blue-500/15 to-indigo-700/10", description: "২৪ ঘণ্টার ফার্মেসি ও ঔষধের দোকান", formType: "shopping", visible: true, sort_order: 5 },
  { slug: "ambulance", divisionId: "health", bn: "অ্যাম্বুলেন্স", en: "Ambulance", icon: Ambulance, iconName: "Ambulance", tint: "from-rose-500/15 to-red-700/10", description: "জরুরী রোগী পরিবহন ও আইসিইউ অ্যাম্বুলেন্স", formType: "transport", visible: true, sort_order: 6 },
  { slug: "blood-donor", divisionId: "health", bn: "রক্তদাতা", en: "Blood Donor", icon: Droplet, iconName: "Droplet", tint: "from-rose-500/20 to-rose-700/10", description: "নোয়াখালীর স্বেচ্ছাসেবী রক্তদাতাদের তালিকা", formType: "blood", visible: true, sort_order: 7 },
  { slug: "dental-care", divisionId: "health", bn: "ডেন্টাল সেবা", en: "Dental Care", icon: Smile, iconName: "Smile", tint: "from-sky-500/15 to-cyan-700/10", description: "দন্ত চিকিৎসক ও ডেন্টাল ক্লিনিক", formType: "doctor", visible: true, sort_order: 8 },
  { slug: "eye-care", divisionId: "health", bn: "চোখের চিকিৎসা", en: "Eye Care", icon: Eye, iconName: "Eye", tint: "from-indigo-500/15 to-blue-700/10", description: "চক্ষু বিশেষজ্ঞ ও অপটিক্যাল শপ", formType: "doctor", visible: true, sort_order: 9 },
  { slug: "maternal-child-health", divisionId: "health", bn: "মাতৃ-শিশু স্বাস্থ্য", en: "Maternal & Child Health", icon: Baby, iconName: "Baby", tint: "from-pink-500/15 to-rose-700/10", description: "প্রসূতি ও শিশু বিশেষজ্ঞ ডাক্তার ও কেয়ার", formType: "doctor", visible: true, sort_order: 10 },

  // --------------------------------------------------------------------------
  // বিভাগ ৫: শিক্ষা ও প্রশিক্ষণ — ১০টি
  // --------------------------------------------------------------------------
  { slug: "school", divisionId: "education", bn: "স্কুল", en: "School", icon: GraduationCap, iconName: "GraduationCap", tint: "from-indigo-500/15 to-indigo-700/10", description: "সরকারি ও বেসরকারি মাধ্যমিক বিদ্যালয়", formType: "education", visible: true, sort_order: 1 },
  { slug: "colleges", divisionId: "education", bn: "কলেজ", en: "Colleges", icon: Building2, iconName: "Building2", tint: "from-blue-500/15 to-indigo-700/10", description: "উচ্চ মাধ্যমিক ও ডিগ্রি কলেজ", formType: "education", visible: true, sort_order: 2 },
  { slug: "madrasa", divisionId: "education", bn: "মাদ্রাসা", en: "Madrasa", icon: BookOpen, iconName: "BookOpen", tint: "from-emerald-600/15 to-teal-700/10", description: "কওমি, আলিয়া ও হাফেজিয়া মাদ্রাসা", formType: "education", visible: true, sort_order: 3 },
  { slug: "coaching", divisionId: "education", bn: "কোচিং", en: "Coaching", icon: Award, iconName: "Award", tint: "from-amber-500/15 to-orange-700/10", description: "একাডেমিক কোচিং ও বিশ্ববিদ্যালয় ভর্তি কোচিং", formType: "education", visible: true, sort_order: 4 },
  { slug: "tutors", divisionId: "education", bn: "প্রাইভেট টিউটর", en: "Private Tutors", icon: Users, iconName: "Users", tint: "from-violet-500/15 to-purple-700/10", description: "অভিজ্ঞ গৃহশিক্ষক ও টিউটোরিয়াল", formType: "education", visible: true, sort_order: 5 },
  { slug: "vocational-training", divisionId: "education", bn: "কারিগরি প্রশিক্ষণ", en: "Vocational Training", icon: Wrench, iconName: "Wrench", tint: "from-stone-500/15 to-zinc-700/10", description: "পলিটেকনিক, ড্রাইভিং ও কারিগরি শিক্ষা", formType: "education", visible: true, sort_order: 6 },
  { slug: "computer-training", divisionId: "education", bn: "কম্পিউটার শিক্ষা", en: "Computer Training", icon: Laptop, iconName: "Laptop", tint: "from-cyan-500/15 to-blue-700/10", description: "অফিস অ্যাপ্লিকেশন, গ্রাফিক্স ও ফ্রিল্যান্সিং", formType: "education", visible: true, sort_order: 7 },
  { slug: "language-learning", divisionId: "education", bn: "ভাষা শিক্ষা", en: "Language Learning", icon: Globe, iconName: "Globe", tint: "from-teal-500/15 to-emerald-700/10", description: "স্পোকেন ইংলিশ, আইইএলটিএস ও আরবি ভাষা", formType: "education", visible: true, sort_order: 8 },
  { slug: "scholarships", divisionId: "education", bn: "বৃত্তি", en: "Scholarships", icon: Award, iconName: "Award", tint: "from-yellow-500/15 to-amber-700/10", description: "শিক্ষা বৃত্তি ও মেধাবী শিক্ষার্থী সহায়তা", formType: "education", visible: true, sort_order: 9 },
  { slug: "libraries", divisionId: "education", bn: "লাইব্রেরি", en: "Libraries", icon: BookOpen, iconName: "BookOpen", tint: "from-rose-500/15 to-pink-700/10", description: "পাবলিক লাইব্রেরি ও পাঠাগার", formType: "education", visible: true, sort_order: 10 },

  // --------------------------------------------------------------------------
  // বিভাগ ৬: চাকরি ও ক্যারিয়ার — ৮টি
  // --------------------------------------------------------------------------
  { slug: "govt-jobs", divisionId: "jobs", bn: "সরকারি চাকরি", en: "Govt Jobs", icon: Landmark, iconName: "Landmark", tint: "from-emerald-600/15 to-teal-700/10", description: "সরকারি চাকরির সর্বশেষ বিজ্ঞপ্তি ও তথ্য", formType: "job", visible: true, sort_order: 1 },
  { slug: "private-jobs", divisionId: "jobs", bn: "বেসরকারি চাকরি", en: "Private Jobs", icon: Briefcase, iconName: "Briefcase", tint: "from-blue-500/15 to-indigo-700/10", description: "ব্যাংক, করপোরেট ও বেসরকারি প্রতিষ্ঠানের পদ", formType: "job", visible: true, sort_order: 2 },
  { slug: "local-jobs", divisionId: "jobs", bn: "স্থানীয় চাকরি", en: "Local Jobs", icon: MapPin, iconName: "MapPin", tint: "from-teal-500/15 to-cyan-700/10", description: "নোয়াখালীর স্থানীয় শোরুম, সেলস ও ফিল্ড জব", formType: "job", visible: true, sort_order: 3 },
  { slug: "part-time-jobs", divisionId: "jobs", bn: "পার্টটাইম", en: "Part-time Jobs", icon: PhoneCall, iconName: "PhoneCall", tint: "from-amber-500/15 to-orange-700/10", description: "শিক্ষার্থীদের জন্য খণ্ডকালীন কাজের সুযোগ", formType: "job", visible: true, sort_order: 4 },
  { slug: "freelancing", divisionId: "jobs", bn: "ফ্রিল্যান্সিং", en: "Freelancing", icon: Laptop, iconName: "Laptop", tint: "from-purple-500/15 to-violet-700/10", description: "অনলাইন আয়, গিগ ও ফ্রিল্যান্সার নেটওয়ার্ক", formType: "job", visible: true, sort_order: 5 },
  { slug: "internships", divisionId: "jobs", bn: "ইন্টার্নশিপ", en: "Internships", icon: GraduationCap, iconName: "GraduationCap", tint: "from-sky-500/15 to-blue-700/10", description: "নতুন স্নাতকদের জন্য ইন্টার্নশিপের সুযোগ", formType: "job", visible: true, sort_order: 6 },
  { slug: "remote-jobs", divisionId: "jobs", bn: "রিমোট চাকরি", en: "Remote Jobs", icon: Globe, iconName: "Globe", tint: "from-cyan-500/15 to-teal-700/10", description: "বাসায় বসে দেশি-বিদেশি প্রতিষ্ঠানে কাজ", formType: "job", visible: true, sort_order: 7 },
  { slug: "career-counseling", divisionId: "jobs", bn: "সিভি ও ক্যারিয়ার পরামর্শ", en: "Career Counseling", icon: FileText, iconName: "FileText", tint: "from-indigo-500/15 to-purple-700/10", description: "প্রফেশনাল সিভি তৈরি ও ক্যারিয়ার গাইডেন্স", formType: "job", visible: true, sort_order: 8 },

  // --------------------------------------------------------------------------
  // বিভাগ ৭: ব্যবসা ও পেশাগত সেবা — ৯টি
  // --------------------------------------------------------------------------
  { slug: "local-business", divisionId: "business", bn: "স্থানীয় ব্যবসা", en: "Local Business", icon: Building2, iconName: "Building2", tint: "from-emerald-500/15 to-teal-700/10", description: "নোয়াখালীর নিবন্ধিত স্থানীয় ব্যবসায়িক প্রতিষ্ঠান", formType: "shopping", visible: true, sort_order: 1 },
  { slug: "shops", divisionId: "business", bn: "দোকান", en: "Shops", icon: ShoppingBag, iconName: "ShoppingBag", tint: "from-blue-500/15 to-cyan-700/10", description: "মার্কেট ও বাজারের বিভিন্ন দোকান ও শোরুম", formType: "shopping", visible: true, sort_order: 2 },
  { slug: "wholesale-retail", divisionId: "business", bn: "পাইকারি ও খুচরা ব্যবসা", en: "Wholesale & Retail", icon: Package, iconName: "Package", tint: "from-purple-500/15 to-pink-700/10", description: "পাইকারি আড়ত ও খুচরা সরবরাহ কেন্দ্র", formType: "shopping", visible: true, sort_order: 3 },
  { slug: "digital-marketing-biz", divisionId: "business", bn: "ডিজিটাল মার্কেটিং", en: "Digital Marketing", icon: Megaphone, iconName: "Megaphone", tint: "from-rose-500/15 to-red-700/10", description: "ফেসবুক বিজ্ঞাপন ও অনলাইন প্রচার সেবা", formType: "tech_digital", visible: true, sort_order: 4 },
  { slug: "web-development-biz", divisionId: "business", bn: "ওয়েবসাইট তৈরি", en: "Web Development", icon: Laptop, iconName: "Laptop", tint: "from-cyan-500/15 to-blue-700/10", description: "ব্যবসা ও প্রতিষ্ঠানের আধুনিক ওয়েবসাইট তৈরি", formType: "tech_digital", visible: true, sort_order: 5 },
  { slug: "graphic-design-biz", divisionId: "business", bn: "ডিজাইন", en: "Design", icon: Palette, iconName: "Palette", tint: "from-amber-500/15 to-orange-700/10", description: "লোগো, ব্যানার, পোস্টার ও প্যাকেজিং ডিজাইন", formType: "tech_digital", visible: true, sort_order: 6 },
  { slug: "printing-press", divisionId: "business", bn: "প্রিন্টিং", en: "Printing", icon: Receipt, iconName: "Receipt", tint: "from-stone-500/15 to-zinc-700/10", description: "অফসেট ও ডিজিটাল প্রিন্টিং প্রেস", formType: "shopping", visible: true, sort_order: 7 },
  { slug: "accounting-audit", divisionId: "business", bn: "হিসাবরক্ষণ", en: "Accounting & Audit", icon: Scale, iconName: "Scale", tint: "from-indigo-500/15 to-blue-700/10", description: "বুককিপিং, ভ্যাট-ট্যাক্স ও অডিট সেবা", formType: "professionals", visible: true, sort_order: 8 },
  { slug: "consulting-services", divisionId: "business", bn: "পরামর্শক সেবা", en: "Consulting Services", icon: Users, iconName: "Users", tint: "from-teal-500/15 to-emerald-700/10", description: "ব্যবসায়িক পরিকল্পনা ও ম্যানেজমেন্ট পরামর্শ", formType: "professionals", visible: true, sort_order: 9 },

  // --------------------------------------------------------------------------
  // বিভাগ ৮: বাসা, জমি ও আবাসন — ৮টি
  // --------------------------------------------------------------------------
  { slug: "flat-rent", divisionId: "realestate", bn: "বাসা ও ফ্ল্যাট ভাড়া", en: "Flat Rent", icon: Home, iconName: "Home", tint: "from-blue-600/15 to-indigo-800/10", description: "ফ্যামিলি বাসা ও ব্যাচেলর ফ্ল্যাট ভাড়া", formType: "realestate", visible: true, sort_order: 1 },
  { slug: "house-sale", divisionId: "realestate", bn: "বাড়ি বিক্রি", en: "House Sale", icon: Building2, iconName: "Building2", tint: "from-emerald-500/15 to-teal-700/10", description: "পাকা বাড়ি, ডুপ্লেক্স ও ভবন বিক্রি", formType: "realestate", visible: true, sort_order: 2 },
  { slug: "land-sale", divisionId: "realestate", bn: "জমি বিক্রি", en: "Land Sale", icon: MapPin, iconName: "MapPin", tint: "from-amber-500/15 to-yellow-700/10", description: "আবাসিক ও বাণিজ্যিক প্লট/জমি বিক্রি", formType: "realestate", visible: true, sort_order: 3 },
  { slug: "commercial-rent", divisionId: "realestate", bn: "দোকান ও অফিস ভাড়া", en: "Commercial Rent", icon: Building2, iconName: "Building2", tint: "from-purple-500/15 to-indigo-700/10", description: "বাণিজ্যিক স্পেস, দোকান ও অফিস কক্ষ ভাড়া", formType: "realestate", visible: true, sort_order: 4 },
  { slug: "hostels", divisionId: "realestate", bn: "হোস্টেল", en: "Hostels", icon: Users, iconName: "Users", tint: "from-pink-500/15 to-rose-700/10", description: "ছাত্র ও ছাত্রী হোস্টেল সুবিধা", formType: "realestate", visible: true, sort_order: 5 },
  { slug: "student-mess", divisionId: "realestate", bn: "মেস", en: "Student Mess", icon: Home, iconName: "Home", tint: "from-teal-500/15 to-cyan-700/10", description: "শিক্ষার্থী ও চাকরিজীবীদের মেস সিট", formType: "realestate", visible: true, sort_order: 6 },
  { slug: "construction-contractors", divisionId: "realestate", bn: "নির্মাণ", en: "Construction", icon: HardHat, iconName: "HardHat", tint: "from-stone-500/15 to-zinc-700/10", description: "ভবন নির্মাণ ঠিকাদার ও ড্রয়িং-ডিজাইন", formType: "realestate", visible: true, sort_order: 7 },
  { slug: "home-renovation", divisionId: "realestate", bn: "বাড়ি মেরামত", en: "Home Renovation", icon: Hammer, iconName: "Hammer", tint: "from-orange-500/15 to-red-700/10", description: "রং, টাইলস, স্যানিটারি ও সংস্কার কাজ", formType: "realestate", visible: true, sort_order: 8 },

  // --------------------------------------------------------------------------
  // বিভাগ ৯: পরিবহন ও যানবাহন — ১০টি
  // --------------------------------------------------------------------------
  { slug: "bus", divisionId: "transport", bn: "বাস", en: "Bus", icon: Bus, iconName: "Bus", tint: "from-cyan-500/15 to-sky-700/10", description: "আন্তঃজেলা ও দূরপাল্লার বাস কাউন্টার", formType: "transport", visible: true, sort_order: 1 },
  { slug: "ticket-booking", divisionId: "transport", bn: "টিকিট", en: "Tickets", icon: Receipt, iconName: "Receipt", tint: "from-blue-500/15 to-indigo-700/10", description: "বাস, ট্রেন ও এয়ার টিকিট বুকিং", formType: "transport", visible: true, sort_order: 2 },
  { slug: "rent-a-car", divisionId: "transport", bn: "গাড়ি ভাড়া", en: "Rent A Car", icon: Car, iconName: "Car", tint: "from-emerald-500/15 to-teal-700/10", description: "প্রাইভেট কার ও নোয়া গাড়ি ভাড়া", formType: "transport", visible: true, sort_order: 3 },
  { slug: "microbus-rental", divisionId: "transport", bn: "মাইক্রোবাস", en: "Microbus", icon: Car, iconName: "Car", tint: "from-teal-500/15 to-cyan-700/10", description: "পারিবারিক ভ্রমণ ও ট্যুরে মাইক্রোবাস", formType: "transport", visible: true, sort_order: 4 },
  { slug: "truck-rental", divisionId: "transport", bn: "ট্রাক", en: "Truck", icon: Truck, iconName: "Truck", tint: "from-amber-600/15 to-orange-700/10", description: "মালবাহী বড় ট্রাক ও কভার্ড ভ্যান", formType: "transport", visible: true, sort_order: 5 },
  { slug: "pickup-rental", divisionId: "transport", bn: "পিকআপ", en: "Pickup", icon: Truck, iconName: "Truck", tint: "from-yellow-500/15 to-amber-700/10", description: "বাসা বদল ও মালামাল পরিবহনে পিকআপ", formType: "transport", visible: true, sort_order: 6 },
  { slug: "motorcycle-services", divisionId: "transport", bn: "মোটরসাইকেল", en: "Motorcycle", icon: Bike, iconName: "Bike", tint: "from-red-500/15 to-rose-700/10", description: "রাইড শেয়ারিং ও মোটরসাইকেল সার্ভিস", formType: "transport", visible: true, sort_order: 7 },
  { slug: "auto-cng", divisionId: "transport", bn: "অটো-সিএনজি", en: "Auto CNG", icon: Car, iconName: "Car", tint: "from-emerald-500/15 to-green-700/10", description: "সিএনজি অটোরিকশা ও ব্যাটারি রিকশা স্ট্যান্ড", formType: "transport", visible: true, sort_order: 8 },
  { slug: "garage", divisionId: "transport", bn: "গাড়ি মেরামত", en: "Auto Repair", icon: Wrench, iconName: "Wrench", tint: "from-stone-500/15 to-zinc-700/10", description: "অটোমোবাইল ওয়ার্কশপ ও গ্যারেজ", formType: "transport", visible: true, sort_order: 9 },
  { slug: "courier-services", divisionId: "transport", bn: "কুরিয়ার", en: "Courier", icon: Package, iconName: "Package", tint: "from-purple-500/15 to-indigo-700/10", description: "পার্সেল ও নথিপত্র প্রেরণ শাখা", formType: "transport", visible: true, sort_order: 10 },

  // --------------------------------------------------------------------------
  // বিভাগ ১০: পর্যটন ও ভ্রমণ — ৮টি
  // --------------------------------------------------------------------------
  { slug: "sightseeing-spots", divisionId: "tourism", bn: "দর্শনীয় স্থান", en: "Sightseeing", icon: MapPin, iconName: "MapPin", tint: "from-amber-500/15 to-yellow-700/10", description: "নোয়াখালীর বিখ্যাত দর্শনীয় স্থানসমূহ", formType: "tourism", visible: true, sort_order: 1 },
  { slug: "tourist-spots", divisionId: "tourism", bn: "পর্যটন স্পট", en: "Tourist Spots", icon: Globe, iconName: "Globe", tint: "from-emerald-500/15 to-teal-700/10", description: "নিঝুম দ্বীপ, স্বর্ণদ্বীপ ও পর্যটন কেন্দ্র", formType: "tourism", visible: true, sort_order: 2 },
  { slug: "hotels", divisionId: "tourism", bn: "হোটেল", en: "Hotels", icon: Hotel, iconName: "Hotel", tint: "from-blue-500/15 to-indigo-700/10", description: "নিরাপদ ও মানসম্মত আবাসিক হোটেল", formType: "tourism", visible: true, sort_order: 3 },
  { slug: "resorts", divisionId: "tourism", bn: "রিসোর্ট", en: "Resorts", icon: Hotel, iconName: "Hotel", tint: "from-teal-500/15 to-cyan-700/10", description: "ইকো রিসোর্ট ও অবকাশ যাপন কেন্দ্র", formType: "tourism", visible: true, sort_order: 4 },
  { slug: "tour-packages", divisionId: "tourism", bn: "ভ্রমণ প্যাকেজ", en: "Tour Packages", icon: Package, iconName: "Package", tint: "from-purple-500/15 to-pink-700/10", description: "নিঝুম দ্বীপ ও সুন্দরবন ভ্রমণ প্যাকেজ", formType: "tourism", visible: true, sort_order: 5 },
  { slug: "tour-guides", divisionId: "tourism", bn: "ট্যুর গাইড", en: "Tour Guides", icon: Users, iconName: "Users", tint: "from-sky-500/15 to-blue-700/10", description: "স্থানীয় অভিজ্ঞ ট্যুর গাইড ও সহায়তা", formType: "tourism", visible: true, sort_order: 6 },
  { slug: "historical-sites", divisionId: "tourism", bn: "ঐতিহাসিক স্থান", en: "Historical Sites", icon: Landmark, iconName: "Landmark", tint: "from-yellow-600/15 to-amber-700/10", description: "বজরা শাহী মসজিদ ও গান্ধী আশ্রম", formType: "tourism", visible: true, sort_order: 7 },
  { slug: "local-heritage", divisionId: "tourism", bn: "স্থানীয় ঐতিহ্য", en: "Local Heritage", icon: Star, iconName: "Star", tint: "from-rose-500/15 to-orange-700/10", description: "নোয়াখালীর লোকসংস্কৃতি ও ইতিহাস", formType: "tourism", visible: true, sort_order: 8 },

  // --------------------------------------------------------------------------
  // বিভাগ ১১: কৃষি, মৎস্য ও প্রাণিসম্পদ — ১১টি
  // --------------------------------------------------------------------------
  { slug: "seeds", divisionId: "agriculture", bn: "বীজ", en: "Seeds", icon: Sprout, iconName: "Sprout", tint: "from-lime-500/15 to-emerald-700/10", description: "উচ্চফলনশীল ধান, সবজি ও ফসলের বীজ", formType: "agriculture", visible: true, sort_order: 1 },
  { slug: "saplings-nursery", divisionId: "agriculture", bn: "চারা", en: "Saplings", icon: Trees, iconName: "Trees", tint: "from-emerald-500/15 to-teal-700/10", description: "ফলদ, বনজ ও ঔষধি গাছের চারা নার্সারি", formType: "agriculture", visible: true, sort_order: 2 },
  { slug: "fertilizers", divisionId: "agriculture", bn: "সার", en: "Fertilizers", icon: Package, iconName: "Package", tint: "from-amber-500/15 to-yellow-700/10", description: "জৈব ও রাসায়নিক সার এবং কীটনাশক", formType: "agriculture", visible: true, sort_order: 3 },
  { slug: "agri-machinery", divisionId: "agriculture", bn: "কৃষি সরঞ্জাম", en: "Agri Machinery", icon: Wrench, iconName: "Wrench", tint: "from-stone-500/15 to-zinc-700/10", description: "পাওয়ার টিলার, সেচ পাম্প ও ধান কাটার কল", formType: "agriculture", visible: true, sort_order: 4 },
  { slug: "agri-produce", divisionId: "agriculture", bn: "কৃষিপণ্য", en: "Agri Produce", icon: Sprout, iconName: "Sprout", tint: "from-green-500/15 to-emerald-700/10", description: "সরাসরি কৃষকের ক্ষেতের টাটকা ফসল", formType: "agriculture", visible: true, sort_order: 5 },
  { slug: "fish-farming", divisionId: "agriculture", bn: "মাছ চাষ", en: "Fish Farming", icon: Droplet, iconName: "Droplet", tint: "from-cyan-500/15 to-blue-700/10", description: "মৎস্য খামার ও মাছ চাষের পরামর্শ", formType: "agriculture", visible: true, sort_order: 6 },
  { slug: "fish-fry", divisionId: "agriculture", bn: "মাছের পোনা", en: "Fish Fry", icon: Droplet, iconName: "Droplet", tint: "from-sky-500/15 to-cyan-700/10", description: "রুই, কাতলা, তেলাপিয়া ও কার্পের পোনা", formType: "agriculture", visible: true, sort_order: 7 },
  { slug: "livestock-cattle", divisionId: "agriculture", bn: "গবাদিপশু", en: "Livestock", icon: PawPrint, iconName: "PawPrint", tint: "from-amber-600/15 to-orange-700/10", description: "উন্নত জাতের গাভী, ষাঁড় ও ছাগলের খামার", formType: "agriculture", visible: true, sort_order: 8 },
  { slug: "poultry-farming", divisionId: "agriculture", bn: "হাঁস-মুরগি", en: "Poultry", icon: PawPrint, iconName: "PawPrint", tint: "from-yellow-500/15 to-amber-700/10", description: "ব্রয়লার, লেয়ার, দেশি মুরগি ও হাঁসের খামার", formType: "agriculture", visible: true, sort_order: 9 },
  { slug: "vet", divisionId: "agriculture", bn: "পশু চিকিৎসা", en: "Veterinary", icon: Stethoscope, iconName: "Stethoscope", tint: "from-teal-500/15 to-emerald-700/10", description: "পশু ডাক্তার ও প্রাণিসম্পদ হাসপাতাল", formType: "agriculture", visible: true, sort_order: 10 },
  { slug: "dairy-products", divisionId: "agriculture", bn: "দুগ্ধজাত পণ্য", en: "Dairy Products", icon: Coffee, iconName: "Coffee", tint: "from-blue-500/15 to-cyan-700/10", description: "খাঁটি গরুর দুধ, ঘি ও দুগ্ধজাত সামগ্রী", formType: "agriculture", visible: true, sort_order: 11 },

  // --------------------------------------------------------------------------
  // বিভাগ ১২: সরকারি ও নাগরিক সেবা — ১০টি
  // --------------------------------------------------------------------------
  { slug: "union-parishad", divisionId: "govt", bn: "ইউনিয়ন পরিষদ", en: "Union Parishad", icon: Landmark, iconName: "Landmark", tint: "from-emerald-500/15 to-teal-700/10", description: "চেয়ারম্যান, মেম্বার ও ইউপি ডিজিটাল সেন্টার", formType: "govt", visible: true, sort_order: 1 },
  { slug: "pourashava", divisionId: "govt", bn: "পৌরসভা", en: "Pourashava", icon: Building2, iconName: "Building2", tint: "from-teal-500/15 to-cyan-700/10", description: "পৌর মেয়র, কাউন্সিলর ও নাগরিক সেবা", formType: "govt", visible: true, sort_order: 2 },
  { slug: "upazila-admin", divisionId: "govt", bn: "উপজেলা", en: "Upazila Admin", icon: Landmark, iconName: "Landmark", tint: "from-blue-500/15 to-indigo-700/10", description: "ইউএনও, এসিল্যান্ড ও উপজেলা প্রশাসন", formType: "govt", visible: true, sort_order: 3 },
  { slug: "birth-registration", divisionId: "govt", bn: "জন্মনিবন্ধন", en: "Birth Registration", icon: FileText, iconName: "FileText", tint: "from-cyan-500/15 to-sky-700/10", description: "জন্ম ও মৃত্যু নিবন্ধন সংক্রান্ত তথ্য", formType: "govt", visible: true, sort_order: 4 },
  { slug: "nid-services", divisionId: "govt", bn: "এনআইডি তথ্য", en: "NID Services", icon: Shield, iconName: "Shield", tint: "from-indigo-500/15 to-purple-700/10", description: "জাতীয় পরিচয়পত্র সংশোধন ও ভোটার সেবা", formType: "govt", visible: true, sort_order: 5 },
  { slug: "passport-services", divisionId: "govt", bn: "পাসপোর্ট", en: "Passport", icon: Plane, iconName: "Plane", tint: "from-sky-500/15 to-blue-700/10", description: "নোয়াখালী আঞ্চলিক পাসপোর্ট অফিস সেবা", formType: "govt", visible: true, sort_order: 6 },
  { slug: "land-records", divisionId: "govt", bn: "ভূমি ও খতিয়ান", en: "Land Records", icon: FileText, iconName: "FileText", tint: "from-emerald-600/15 to-teal-700/10", description: "ই-নামজারি, খতিয়ান ও ভূমি কর সেবা", formType: "govt", visible: true, sort_order: 7 },
  { slug: "citizen-certificates", divisionId: "govt", bn: "নাগরিক সনদ", en: "Citizen Certificate", icon: Award, iconName: "Award", tint: "from-amber-500/15 to-orange-700/10", description: "নাগরিকত্ব, ওয়ারিশ ও চারিত্রিক সনদ", formType: "govt", visible: true, sort_order: 8 },
  { slug: "govt-forms", divisionId: "govt", bn: "সরকারি ফরম", en: "Govt Forms", icon: FileText, iconName: "FileText", tint: "from-stone-500/15 to-zinc-700/10", description: "বিভিন্ন সরকারি আবেদনের ফরম ডাউনলোড", formType: "govt", visible: true, sort_order: 9 },
  { slug: "helpline", divisionId: "govt", bn: "জরুরি হেল্পলাইন", en: "Emergency Helpline", icon: PhoneCall, iconName: "PhoneCall", tint: "from-red-500/20 to-red-700/10", description: "৯৯৯, ১০৯, ৩৩৩, ১৬১২৩ জাতীয় হেল্পলাইন", formType: "govt", visible: true, sort_order: 10 },

  // --------------------------------------------------------------------------
  // বিভাগ ১৩: ধর্মীয় ও সামাজিক প্রতিষ্ঠান — ৮টি
  // --------------------------------------------------------------------------
  { slug: "mosques", divisionId: "religious_social", bn: "মসজিদ", en: "Mosques", icon: Sun, iconName: "Sun", tint: "from-amber-600/15 to-yellow-700/10", description: "ঐতিহাসিক ও কেন্দ্রীয় জামে মসজিদসমূহ", formType: "religious_social", visible: true, sort_order: 1 },
  { slug: "islamic-madrasas", divisionId: "religious_social", bn: "মাদ্রাসা", en: "Islamic Madrasas", icon: BookOpen, iconName: "BookOpen", tint: "from-emerald-600/15 to-teal-700/10", description: "হাফেজিয়া, কওমি ও নুরানি মাদ্রাসা", formType: "religious_social", visible: true, sort_order: 2 },
  { slug: "temples", divisionId: "religious_social", bn: "মন্দির", en: "Temples", icon: Sun, iconName: "Sun", tint: "from-orange-500/15 to-amber-700/10", description: "ঐতিহাসিক হিন্দু মন্দির ও আশ্রম", formType: "religious_social", visible: true, sort_order: 3 },
  { slug: "orphanages", divisionId: "religious_social", bn: "এতিমখানা", en: "Orphanages", icon: HeartHandshake, iconName: "HeartHandshake", tint: "from-rose-500/15 to-pink-700/10", description: "এতিম ও দুস্থ শিশুদের আশ্রয়কেন্দ্র", formType: "religious_social", visible: true, sort_order: 4 },
  { slug: "old-age-homes", divisionId: "religious_social", bn: "বৃদ্ধাশ্রম", en: "Old Age Homes", icon: Users, iconName: "Users", tint: "from-violet-500/15 to-purple-700/10", description: "প্রবীণ নিবাস ও প্রবীণ কল্যাণ কেন্দ্র", formType: "religious_social", visible: true, sort_order: 5 },
  { slug: "service-org", divisionId: "religious_social", bn: "স্বেচ্ছাসেবী সংগঠন", en: "Volunteer Orgs", icon: HeartHandshake, iconName: "HeartHandshake", tint: "from-pink-500/15 to-rose-700/10", description: "রক্তদান, ত্রাণ ও সামাজিক সংগঠন", formType: "religious_social", visible: true, sort_order: 6 },
  { slug: "charity-foundations", divisionId: "religious_social", bn: "দাতব্য প্রতিষ্ঠান", en: "Charity Foundations", icon: HandCoins, iconName: "HandCoins", tint: "from-teal-500/15 to-emerald-700/10", description: "দরিদ্র সহায়তা ও যাকাত ফাউন্ডেশন", formType: "religious_social", visible: true, sort_order: 7 },
  { slug: "community-centers", divisionId: "religious_social", bn: "কমিউনিটি সেন্টার", en: "Community Centers", icon: Building2, iconName: "Building2", tint: "from-blue-500/15 to-indigo-700/10", description: "সামাজিক অনুষ্ঠান ও মিলনায়তন কেন্দ্র", formType: "religious_social", visible: true, sort_order: 8 },

  // --------------------------------------------------------------------------
  // বিভাগ ১৪: ইভেন্ট ও অনুষ্ঠান — ৮টি
  // --------------------------------------------------------------------------
  { slug: "wedding-services", divisionId: "events", bn: "বিয়ে", en: "Wedding", icon: Heart, iconName: "Heart", tint: "from-rose-500/15 to-red-700/10", description: "বিবাহ অনুষ্ঠান আয়োজন ও সার্ভিস", formType: "events", visible: true, sort_order: 1 },
  { slug: "birthday-events", divisionId: "events", bn: "জন্মদিন", en: "Birthday", icon: Cake, iconName: "Cake", tint: "from-pink-500/15 to-rose-700/10", description: "জন্মদিনের পার্টি আয়োজন ও বেলুন সাজসজ্জা", formType: "events", visible: true, sort_order: 2 },
  { slug: "cultural-events", divisionId: "events", bn: "সাংস্কৃতিক অনুষ্ঠান", en: "Cultural Events", icon: Palette, iconName: "Palette", tint: "from-purple-500/15 to-indigo-700/10", description: "নাটক, সংগীত, কবিতা ও সাহিত্য সন্ধ্যা", formType: "events", visible: true, sort_order: 3 },
  { slug: "seminars-workshops", divisionId: "events", bn: "সেমিনার", en: "Seminars", icon: Users, iconName: "Users", tint: "from-blue-500/15 to-cyan-700/10", description: "কনফারেন্স, ওয়ার্কশপ ও কর্পোরেট সভা", formType: "events", visible: true, sort_order: 4 },
  { slug: "sports-tournaments", divisionId: "events", bn: "খেলাধুলার ইভেন্ট", en: "Sports Tournaments", icon: Trophy, iconName: "Trophy", tint: "from-emerald-500/15 to-teal-700/10", description: "ক্রিকেট, ফুটবল ও ব্যাডমিন্টন টুর্নামেন্ট", formType: "events", visible: true, sort_order: 5 },
  { slug: "event-management", divisionId: "events", bn: "ইভেন্ট ম্যানেজমেন্ট", en: "Event Management", icon: Briefcase, iconName: "Briefcase", tint: "from-teal-500/15 to-emerald-700/10", description: "সম্পূর্ণ অনুষ্ঠান পরিকল্পনা ও বাস্তবায়ন", formType: "events", visible: true, sort_order: 6 },
  { slug: "event-decoration", divisionId: "events", bn: "ডেকোরেশন", en: "Decoration", icon: Sparkles, iconName: "Sparkles", tint: "from-amber-500/15 to-orange-700/10", description: "স্টেজ, লাইটিং, গেট ও প্যান্ডেল সাজসজ্জা", formType: "events", visible: true, sort_order: 7 },
  { slug: "event-photography", divisionId: "events", bn: "ফটোগ্রাফি", en: "Photography", icon: Camera, iconName: "Camera", tint: "from-stone-500/15 to-zinc-700/10", description: "ওয়েডিং ফটোগ্রাফি ও সিনেমাটোগ্রাফি", formType: "events", visible: true, sort_order: 8 },

  // --------------------------------------------------------------------------
  // বিভাগ ১৫: বাড়ি ও ব্যক্তিগত সেবা — ৯টি
  // --------------------------------------------------------------------------
  { slug: "electrician", divisionId: "home_services", bn: "ইলেকট্রিশিয়ান", en: "Electrician", icon: Zap, iconName: "Zap", tint: "from-yellow-500/15 to-amber-700/10", description: "বাসাবাড়ি ও কারখানার বৈদ্যুতিক মিস্ত্রি", formType: "home_services", visible: true, sort_order: 1 },
  { slug: "plumber", divisionId: "home_services", bn: "প্লাম্বার", en: "Plumber", icon: Wrench, iconName: "Wrench", tint: "from-cyan-500/15 to-blue-700/10", description: "পাইপলাইনের পানি ও স্যানিটারি মিস্ত্রি", formType: "home_services", visible: true, sort_order: 2 },
  { slug: "ac-fridge-repair", divisionId: "home_services", bn: "এসি-ফ্রিজ মেরামত", en: "AC & Fridge Repair", icon: Zap, iconName: "Zap", tint: "from-sky-500/15 to-blue-700/10", description: "এসি সার্ভিসিং, গ্যাস রিফিল ও ফ্রিজ মেরামত", formType: "home_services", visible: true, sort_order: 3 },
  { slug: "carpenters", divisionId: "home_services", bn: "কাঠমিস্ত্রি", en: "Carpenters", icon: Hammer, iconName: "Hammer", tint: "from-amber-600/15 to-orange-700/10", description: "ফার্নিচার তৈরি, পলিশ ও দরজার কাজ", formType: "home_services", visible: true, sort_order: 4 },
  { slug: "mason", divisionId: "home_services", bn: "রাজমিস্ত্রি", en: "Mason", icon: HardHat, iconName: "HardHat", tint: "from-stone-500/15 to-zinc-700/10", description: "দালানকোঠা নির্মাণ ও প্লাস্টার-টাইলস মিস্ত্রি", formType: "home_services", visible: true, sort_order: 5 },
  { slug: "cleaning-services", divisionId: "home_services", bn: "পরিচ্ছন্নতা", en: "Cleaning Services", icon: Sparkles, iconName: "Sparkles", tint: "from-teal-500/15 to-emerald-700/10", description: "বাড়ি, অফিস ও ওয়াটার ট্যাংক গভীর পরিচ্ছন্নতা", formType: "home_services", visible: true, sort_order: 6 },
  { slug: "laundry-services", divisionId: "home_services", bn: "লন্ড্রি", en: "Laundry", icon: Shirt, iconName: "Shirt", tint: "from-blue-500/15 to-indigo-700/10", description: "ইস্ত্রি, ড্রাইওয়াশ ও ধোলাই সেবা", formType: "home_services", visible: true, sort_order: 7 },
  { slug: "salon-parlour", divisionId: "home_services", bn: "সেলুন", en: "Salon", icon: Scissors, iconName: "Scissors", tint: "from-purple-500/15 to-pink-700/10", description: "পুরুষদের সেলুন ও বিউটি পার্লার", formType: "home_services", visible: true, sort_order: 8 },
  { slug: "tailoring-services", divisionId: "home_services", bn: "দর্জি", en: "Tailor", icon: Scissors, iconName: "Scissors", tint: "from-rose-500/15 to-red-700/10", description: "নারী ও পুরুষের আধুনিক পোশাক সেলাই", formType: "home_services", visible: true, sort_order: 9 },

  // --------------------------------------------------------------------------
  // বিভাগ ১৬: প্রযুক্তি ও ডিজিটাল সেবা — ৮টি
  // --------------------------------------------------------------------------
  { slug: "isp-broadband", divisionId: "tech_digital", bn: "ইন্টারনেট", en: "Internet (ISP)", icon: Globe, iconName: "Globe", tint: "from-blue-500/15 to-indigo-700/10", description: "দ্রুতগতির ব্রডব্যান্ড ওয়াইফাই লাইন প্রদানকারী", formType: "tech_digital", visible: true, sort_order: 1 },
  { slug: "software-solutions", divisionId: "tech_digital", bn: "সফটওয়্যার", en: "Software", icon: Laptop, iconName: "Laptop", tint: "from-cyan-500/15 to-blue-700/10", description: "দোকানের হিসাব, পিওএস ও কাস্টম সফটওয়্যার", formType: "tech_digital", visible: true, sort_order: 2 },
  { slug: "mobile-app-dev", divisionId: "tech_digital", bn: "অ্যাপ", en: "Mobile App", icon: Smartphone, iconName: "Smartphone", tint: "from-purple-500/15 to-violet-700/10", description: "অ্যান্ড্রয়েড ও আইওএস মোবাইল অ্যাপ্লিকেশন", formType: "tech_digital", visible: true, sort_order: 3 },
  { slug: "web-development-tech", divisionId: "tech_digital", bn: "ওয়েবসাইট", en: "Website", icon: Globe, iconName: "Globe", tint: "from-emerald-500/15 to-teal-700/10", description: "বিজনেস ও পার্সোনাল ওয়েবসাইট ডিজাইন", formType: "tech_digital", visible: true, sort_order: 4 },
  { slug: "online-application-cafe", divisionId: "tech_digital", bn: "অনলাইন আবেদন", en: "Online Application", icon: FileText, iconName: "FileText", tint: "from-sky-500/15 to-blue-700/10", description: "চাকরি, ভর্তি ও সরকারি সেবা আবেদন কেন্দ্র", formType: "tech_digital", visible: true, sort_order: 5 },
  { slug: "digital-marketing-agency", divisionId: "tech_digital", bn: "ডিজিটাল মার্কেটিং", en: "Digital Marketing Agency", icon: Megaphone, iconName: "Megaphone", tint: "from-rose-500/15 to-pink-700/10", description: "সোশ্যাল মিডিয়া প্রমোশন ও বিজনেস গ্রোথ", formType: "tech_digital", visible: true, sort_order: 6 },
  { slug: "print-photocopy-scan", divisionId: "tech_digital", bn: "প্রিন্ট-স্ক্যান", en: "Print & Scan", icon: Receipt, iconName: "Receipt", tint: "from-amber-500/15 to-yellow-700/10", description: "ফটোকপি, কালার প্রিন্ট ও লেমিনেশন", formType: "tech_digital", visible: true, sort_order: 7 },
  { slug: "tech-training", divisionId: "tech_digital", bn: "প্রযুক্তি প্রশিক্ষণ", en: "Tech Training", icon: Laptop, iconName: "Laptop", tint: "from-teal-500/15 to-emerald-700/10", description: "ওয়েব ডিজাইন, পাইথন ও ডিজিটাল স্কিল কোর্স", formType: "tech_digital", visible: true, sort_order: 8 },

  // --------------------------------------------------------------------------
  // বিভাগ ১৭: খেলাধুলা ও বিনোদন — ৮টি
  // --------------------------------------------------------------------------
  { slug: "cricket-clubs", divisionId: "sports_entertainment", bn: "ক্রিকেট", en: "Cricket", icon: Trophy, iconName: "Trophy", tint: "from-emerald-500/15 to-teal-700/10", description: "স্থানীয় ক্রিকেট ক্লাব ও প্রশিক্ষণ একাডেমি", formType: "sports_entertainment", visible: true, sort_order: 1 },
  { slug: "football-clubs", divisionId: "sports_entertainment", bn: "ফুটবল", en: "Football", icon: Trophy, iconName: "Trophy", tint: "from-blue-500/15 to-cyan-700/10", description: "ফুটবল ক্লাব ও যুব প্রশিক্ষণ দল", formType: "sports_entertainment", visible: true, sort_order: 2 },
  { slug: "badminton-courts", divisionId: "sports_entertainment", bn: "ব্যাডমিন্টন", en: "Badminton", icon: Trophy, iconName: "Trophy", tint: "from-purple-500/15 to-indigo-700/10", description: "ইনডোর ও আউটডোর ব্যাডমিন্টন কোর্ট", formType: "sports_entertainment", visible: true, sort_order: 3 },
  { slug: "gym-fitness", divisionId: "sports_entertainment", bn: "জিম", en: "Gym & Fitness", icon: Dumbbell, iconName: "Dumbbell", tint: "from-orange-500/15 to-red-700/10", description: "ব্যায়ামাগার, ফিটনেস ক্লাব ও বডিবিল্ডিং", formType: "sports_entertainment", visible: true, sort_order: 4 },
  { slug: "sports-clubs", divisionId: "sports_entertainment", bn: "স্পোর্টস ক্লাব", en: "Sports Clubs", icon: Award, iconName: "Award", tint: "from-amber-500/15 to-yellow-700/10", description: "জেলা ক্রীড়া সংস্থা ও বিভিন্ন ক্লাব", formType: "sports_entertainment", visible: true, sort_order: 5 },
  { slug: "playgrounds", divisionId: "sports_entertainment", bn: "খেলার মাঠ", en: "Playgrounds", icon: MapPin, iconName: "MapPin", tint: "from-lime-500/15 to-emerald-700/10", description: "স্টেডিয়াম ও স্থানীয় খেলার মাঠসমূহ", formType: "sports_entertainment", visible: true, sort_order: 6 },
  { slug: "sports-academies", divisionId: "sports_entertainment", bn: "ক্রীড়া প্রশিক্ষণ", en: "Sports Academy", icon: GraduationCap, iconName: "GraduationCap", tint: "from-teal-500/15 to-cyan-700/10", description: "কিশোর-কিশোরীদের নিয়মিত খেলাধুলা শিক্ষা", formType: "sports_entertainment", visible: true, sort_order: 7 },
  { slug: "entertainment-parks", divisionId: "sports_entertainment", bn: "বিনোদন", en: "Entertainment", icon: Smile, iconName: "Smile", tint: "from-pink-500/15 to-rose-700/10", description: "বিনোদন পার্ক, সিনেমা হল ও পিকনিক স্পট", formType: "sports_entertainment", visible: true, sort_order: 8 },

  // --------------------------------------------------------------------------
  // বিভাগ ১৮: সংবাদ, তথ্য ও কমিউনিটি — ৭টি
  // --------------------------------------------------------------------------
  { slug: "noakhali-news", divisionId: "news_community", bn: "নোয়াখালীর খবর", en: "Noakhali News", icon: Newspaper, iconName: "Newspaper", tint: "from-slate-500/15 to-slate-700/10", description: "নোয়াখালী জেলা ও উপজেলার তাজা খবর", formType: "news_community", visible: true, sort_order: 1 },
  { slug: "local-announcements", divisionId: "news_community", bn: "স্থানীয় ঘোষণা", en: "Local Announcements", icon: Megaphone, iconName: "Megaphone", tint: "from-amber-500/15 to-orange-700/10", description: "প্রশাসন ও স্থানীয় জরুরি গণবিজ্ঞপ্তি", formType: "news_community", visible: true, sort_order: 2 },
  { slug: "lost-found", divisionId: "news_community", bn: "হারানো-পাওয়া", en: "Lost & Found", icon: HelpCircle, iconName: "HelpCircle", tint: "from-rose-500/15 to-red-700/10", description: "ডকুমেন্ট বা মূল্যবান জিনিস হারানো ও সন্ধান", formType: "news_community", visible: true, sort_order: 3 },
  { slug: "blood-search-bulletin", divisionId: "news_community", bn: "রক্তদাতা খোঁজা", en: "Blood Search Bulletin", icon: Droplet, iconName: "Droplet", tint: "from-red-600/15 to-rose-800/10", description: "জরুরি প্রয়োজনে রক্তের আহ্বান বুলেটিন", formType: "news_community", visible: true, sort_order: 4 },
  { slug: "volunteer-network", divisionId: "news_community", bn: "স্বেচ্ছাসেবক", en: "Volunteers", icon: Users, iconName: "Users", tint: "from-emerald-500/15 to-teal-700/10", description: "সামাজিক কাজের স্বেচ্ছাসেবক তালিকা", formType: "news_community", visible: true, sort_order: 5 },
  { slug: "public-awareness", divisionId: "news_community", bn: "জনসচেতনতা", en: "Public Awareness", icon: Shield, iconName: "Shield", tint: "from-blue-500/15 to-indigo-700/10", description: "আইন, স্বাস্থ্য ও ট্রাফিক সচেতনতামূলক পোস্ট", formType: "news_community", visible: true, sort_order: 6 },
  { slug: "community-initiatives", divisionId: "news_community", bn: "কমিউনিটি উদ্যোগ", en: "Community Initiatives", icon: HeartHandshake, iconName: "HeartHandshake", tint: "from-teal-500/15 to-cyan-700/10", description: "এলাকাবাসীর যৌথ উন্নয়ন ও কল্যাণ কর্মসূচি", formType: "news_community", visible: true, sort_order: 7 },

  // --------------------------------------------------------------------------
  // বিভাগ ১৯: নারী, শিশু ও পরিবার — ৬টি
  // --------------------------------------------------------------------------
  { slug: "women-entrepreneurs", divisionId: "women_child", bn: "নারী উদ্যোক্তা", en: "Women Entrepreneurs", icon: Sparkles, iconName: "Sparkles", tint: "from-pink-500/15 to-rose-700/10", description: "নারী পরিচালিত ব্যবসা, ফ্যাশন ও হোমমেড পণ্য", formType: "women_child", visible: true, sort_order: 1 },
  { slug: "women-skill-training", divisionId: "women_child", bn: "নারীদের প্রশিক্ষণ", en: "Women Skill Training", icon: GraduationCap, iconName: "GraduationCap", tint: "from-purple-500/15 to-pink-700/10", description: "সেলাই, ব্লক-বাটিক, পার্লার ও হস্তশিল্প শিক্ষা", formType: "women_child", visible: true, sort_order: 2 },
  { slug: "child-education-health", divisionId: "women_child", bn: "শিশুদের শিক্ষা ও স্বাস্থ্য", en: "Child Health & Education", icon: Baby, iconName: "Baby", tint: "from-amber-500/15 to-yellow-700/10", description: "শিশুর বিকাশ, টিকা ও প্রাক-প্রাথমিক শিক্ষা", formType: "women_child", visible: true, sort_order: 3 },
  { slug: "family-welfare", divisionId: "women_child", bn: "পরিবার কল্যাণ", en: "Family Welfare", icon: Heart, iconName: "Heart", tint: "from-teal-500/15 to-emerald-700/10", description: "পরিবার পরিকল্পনা ও পারিবারিক কাউন্সেলিং", formType: "women_child", visible: true, sort_order: 4 },
  { slug: "maternity-care", divisionId: "women_child", bn: "মাতৃত্বকালীন সহায়তা", en: "Maternity Care", icon: HeartHandshake, iconName: "HeartHandshake", tint: "from-rose-500/15 to-red-700/10", description: "গর্ভবতী মায়েদের পরামর্শ ও সহায়তা কেন্দ্র", formType: "women_child", visible: true, sort_order: 5 },
  { slug: "child-protection", divisionId: "women_child", bn: "শিশু সুরক্ষা", en: "Child Protection", icon: Shield, iconName: "Shield", tint: "from-blue-500/15 to-indigo-700/10", description: "শিশু নির্যাতন প্রতিরোধ ও শিশু হেল্পলাইন ১০৯৮", formType: "women_child", visible: true, sort_order: 6 },

  // --------------------------------------------------------------------------
  // বিভাগ ২০: পরিবেশ ও জনকল্যাণ — ৬টি
  // --------------------------------------------------------------------------
  { slug: "tree-plantation", divisionId: "environment_welfare", bn: "বৃক্ষরোপণ", en: "Tree Plantation", icon: Trees, iconName: "Trees", tint: "from-emerald-500/15 to-teal-700/10", description: "সবুজ নোয়াখালী গড়তে বৃক্ষরোপণ কর্মসূচি", formType: "environment_welfare", visible: true, sort_order: 1 },
  { slug: "cleanliness-drives", divisionId: "environment_welfare", bn: "পরিচ্ছন্নতা অভিযান", en: "Cleanliness Drives", icon: Sparkles, iconName: "Sparkles", tint: "from-teal-500/15 to-cyan-700/10", description: "পৌর ও গ্রামীণ পরিচ্ছন্নতা কার্যক্রম", formType: "environment_welfare", visible: true, sort_order: 2 },
  { slug: "waste-management", divisionId: "environment_welfare", bn: "বর্জ্য ব্যবস্থাপনা", en: "Waste Management", icon: Package, iconName: "Package", tint: "from-stone-500/15 to-zinc-700/10", description: "ময়লা-আবর্জনা অপসারণ ও ড্রেনেজ রক্ষা", formType: "environment_welfare", visible: true, sort_order: 3 },
  { slug: "eco-awareness", divisionId: "environment_welfare", bn: "পরিবেশ সচেতনতা", en: "Eco Awareness", icon: Leaf, iconName: "Leaf", tint: "from-lime-500/15 to-emerald-700/10", description: "প্লাস্টিক বর্জন ও নদী-খাল দূষণরোধ প্রচারণা", formType: "environment_welfare", visible: true, sort_order: 4 },
  { slug: "disaster-preparedness", divisionId: "environment_welfare", bn: "দুর্যোগ প্রস্তুতি", en: "Disaster Preparedness", icon: ShieldAlert, iconName: "ShieldAlert", tint: "from-orange-500/15 to-red-700/10", description: "ঘূর্ণিঝড়, বন্যা ও উপকূলীয় সতর্কবার্তা ও আশ্রয়", formType: "environment_welfare", visible: true, sort_order: 5 },
  { slug: "local-dev-projects", divisionId: "environment_welfare", bn: "স্থানীয় উন্নয়ন প্রকল্প", en: "Local Dev Projects", icon: Building2, iconName: "Building2", tint: "from-blue-500/15 to-indigo-700/10", description: "রাস্তাঘাট, ব্রিজ ও গ্রামীণ অবকাঠামো উন্নয়ন", formType: "environment_welfare", visible: true, sort_order: 6 },

  // --------------------------------------------------------------------------
  // বিভাগ ২১: পেশাজীবী ও বিশেষজ্ঞ — ৮টি
  // --------------------------------------------------------------------------
  { slug: "lawyer", divisionId: "professionals", bn: "আইনজীবী", en: "Lawyer", icon: Scale, iconName: "Scale", tint: "from-indigo-500/15 to-indigo-700/10", description: "জজ কোর্ট ও সুপ্রিম কোর্টের আইনজীবী", formType: "professionals", visible: true, sort_order: 1 },
  { slug: "chartered-accountants", divisionId: "professionals", bn: "হিসাবরক্ষক", en: "Chartered Accountants", icon: FileText, iconName: "FileText", tint: "from-blue-500/15 to-cyan-700/10", description: "চার্টার্ড অ্যাকাউন্ট্যান্ট, ট্যাক্স ও ভ্যাট কনসালটেন্ট", formType: "professionals", visible: true, sort_order: 2 },
  { slug: "engineers", divisionId: "professionals", bn: "প্রকৌশলী", en: "Engineers", icon: HardHat, iconName: "HardHat", tint: "from-amber-600/15 to-orange-700/10", description: "সিভিল, ইলেকট্রিক্যাল ও মেকানিক্যাল ইঞ্জিনিয়ার", formType: "professionals", visible: true, sort_order: 3 },
  { slug: "architects", divisionId: "professionals", bn: "স্থপতি", en: "Architects", icon: Building2, iconName: "Building2", tint: "from-teal-500/15 to-emerald-700/10", description: "আধুনিক বাড়ি ও বাণিজ্যিক ভবনের আর্কিটেক্ট", formType: "professionals", visible: true, sort_order: 4 },
  { slug: "medical-specialists", divisionId: "professionals", bn: "চিকিৎসক", en: "Medical Specialists", icon: Stethoscope, iconName: "Stethoscope", tint: "from-emerald-500/15 to-teal-700/10", description: "বিভিন্ন বিভাগের সিনিয়র কনসালট্যান্ট ও বিশেষজ্ঞ", formType: "professionals", visible: true, sort_order: 5 },
  { slug: "educators-teachers", divisionId: "professionals", bn: "শিক্ষক", en: "Educators", icon: GraduationCap, iconName: "GraduationCap", tint: "from-purple-500/15 to-indigo-700/10", description: "বিশ্ববিদ্যালয় ও কলেজের স্বনামধন্য শিক্ষক", formType: "professionals", visible: true, sort_order: 6 },
  { slug: "it-professionals", divisionId: "professionals", bn: "আইটি বিশেষজ্ঞ", en: "IT Professionals", icon: Laptop, iconName: "Laptop", tint: "from-cyan-500/15 to-blue-700/10", description: "সফটওয়্যার আর্কিটেক্ট ও সাইবার সিকিউরিটি স্পেশালিস্ট", formType: "professionals", visible: true, sort_order: 7 },
  { slug: "business-consultants", divisionId: "professionals", bn: "ব্যবসায়িক পরামর্শক", en: "Business Consultants", icon: Briefcase, iconName: "Briefcase", tint: "from-sky-500/15 to-blue-700/10", description: "নতুন ব্যবসা স্থাপন ও লিগ্যাল ট্রেড লাইসেন্স পরামর্শ", formType: "professionals", visible: true, sort_order: 8 },

  // --------------------------------------------------------------------------
  // বিভাগ ২২: অন্যান্য সেবা — ৪টি
  // --------------------------------------------------------------------------
  { slug: "other-local-businesses", divisionId: "other_services", bn: "অন্যান্য স্থানীয় ব্যবসা", en: "Other Local Businesses", icon: Layers, iconName: "Layers", tint: "from-teal-500/15 to-emerald-700/10", description: "অন্যান্য সকল বৈধ ও সেবামূলক স্থানীয় ব্যবসা", formType: "other_services", visible: true, sort_order: 1 },
  { slug: "suggest-new-category", divisionId: "other_services", bn: "নতুন ক্যাটাগরির প্রস্তাব", en: "Suggest New Category", icon: Send, iconName: "Send", tint: "from-purple-500/15 to-indigo-700/10", description: "সাইটে নেই এমন প্রয়োজনীয় নতুন সেবার প্রস্তাব দিন", formType: "other_services", visible: true, sort_order: 2 },
  { slug: "specialized-services", divisionId: "other_services", bn: "বিশেষায়িত সেবা", en: "Specialized Services", icon: Star, iconName: "Star", tint: "from-amber-500/15 to-orange-700/10", description: "অনন্য বা বিশেষ ধরনের নাগরিক পরিষেবা", formType: "other_services", visible: true, sort_order: 3 },
  { slug: "community-activities", divisionId: "other_services", bn: "নতুন কমিউনিটি কার্যক্রম", en: "Community Activities", icon: HeartHandshake, iconName: "HeartHandshake", tint: "from-rose-500/15 to-pink-700/10", description: "এলাকাভিত্তিক নতুন উদ্যোগ ও নাগরিক সহায়তা", formType: "other_services", visible: true, sort_order: 4 },
];

export const getDivisions = () => DIVISIONS;
export const getDivision = (id: string) => DIVISIONS.find((d) => d.id === id);
export const getCategoriesByDivision = (divisionId: string) =>
  categories.filter((c) => c.divisionId === divisionId);
export const getCategory = (slug: string) => categories.find((c) => c.slug === slug);
