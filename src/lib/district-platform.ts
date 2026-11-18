import { useState, useEffect, useCallback, useMemo } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { sanitizeFirestorePayload } from "@/lib/store";

function useFirebaseAuthUid(): string | null {
  const [authUid, setAuthUid] = useState<string | null>(() => auth.currentUser?.uid ?? null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUid(u?.uid ?? null);
    });
    return () => unsub();
  }, []);
  return authUid;
}

// ============================================================================
// 1. CONSTANTS & LOCATION DATA
// ============================================================================

export const NOAKHALI_UPAZILAS = [
  "নোয়াখালী সদর (মাইজদী)",
  "বেগমগঞ্জ (চৌমুহনী)",
  "চাটখিল",
  "সেনবাগ",
  "কোম্পানীগঞ্জ (বসুরহাট)",
  "সোনাইমুড়ী",
  "সুবর্ণচর",
  "কবিরহাট",
  "হাতিয়া",
] as const;

export type NoakhaliUpazila = typeof NOAKHALI_UPAZILAS[number];

export interface UpazilaGeoInfo {
  id: string;
  nameBn: string;
  nameEn: string;
  lat: number;
  lng: number;
  headquarters: string;
  description: string;
  postalCode: string;
  svgPath?: string;
}

export const UPAZILA_GEO_LIST: UpazilaGeoInfo[] = [
  {
    id: "sadar",
    nameBn: "নোয়াখালী সদর (মাইজদী)",
    nameEn: "Noakhali Sadar (Maijdee)",
    lat: 22.8696,
    lng: 91.0995,
    headquarters: "মাইজদী কোর্ট",
    description: "নোয়াখালী জেলার প্রশাসনিক কেন্দ্র ও প্রধান শহর।",
    postalCode: "3800",
  },
  {
    id: "begumganj",
    nameBn: "বেগমগঞ্জ (চৌমুহনী)",
    nameEn: "Begumganj (Chowmuhani)",
    lat: 22.9557,
    lng: 91.1033,
    headquarters: "চৌমুহনী",
    description: "বৃহত্তম বাণিজ্যিক কেন্দ্র ও পাইকারি বাণিজ্য হাব।",
    postalCode: "3820",
  },
  {
    id: "chatkhil",
    nameBn: "চাটখিল",
    nameEn: "Chatkhil",
    lat: 23.0537,
    lng: 90.9632,
    headquarters: "চাটখিল বাজার",
    description: "উত্তরের সমৃদ্ধ উপজেলা, প্রবাসী ও বাণিজ্যে সমৃদ্ধ।",
    postalCode: "3870",
  },
  {
    id: "senbagh",
    nameBn: "সেনবাগ",
    nameEn: "Senbagh",
    lat: 22.9902,
    lng: 91.2335,
    headquarters: "সেনবাগ বাজার",
    description: "কৃষি ও শিক্ষা ঐতিহ্যে সমৃদ্ধ উত্তর-পূর্বের উপজেলা।",
    postalCode: "3830",
  },
  {
    id: "companiganj",
    nameBn: "কোম্পানীগঞ্জ (বসুরহাট)",
    nameEn: "Companiganj (Basurhat)",
    lat: 22.8687,
    lng: 91.2882,
    headquarters: "বসুরহাট পৌরসভা",
    description: "উপকূলীয় এবং রাজনীতি ও বাণিজ্যের গুরুত্বপূর্ণ অঞ্চল।",
    postalCode: "3850",
  },
  {
    id: "sonaimuri",
    nameBn: "সোনাইমুড়ী",
    nameEn: "Sonaimuri",
    lat: 23.0333,
    lng: 91.1000,
    headquarters: "সোনাইমুড়ী বাজার",
    description: "গান্ধী আশ্রম ট্রাস্ট ও ঐতিহ্যবাহী বাণিজ্যিক এলাকা।",
    postalCode: "3827",
  },
  {
    id: "subarnachar",
    nameBn: "সুবর্ণচর",
    nameEn: "Subarnachar",
    lat: 22.6717,
    lng: 91.1219,
    headquarters: "চর জব্বর",
    description: "উর্বর কৃষি, নদী ও সমুদ্র উপকূলীয় সম্ভাবনাময় অঞ্চল।",
    postalCode: "3811",
  },
  {
    id: "kabirhat",
    nameBn: "কবিরহাট",
    nameEn: "Kabirhat",
    lat: 22.8397,
    lng: 91.1923,
    headquarters: "কবিরহাট পৌরসভা",
    description: "মধ্য-দক্ষিণের ঐতিহ্যবাহী কৃষিনির্ভর পৌর অঞ্চল।",
    postalCode: "3853",
  },
  {
    id: "hatiya",
    nameBn: "হাতিয়া",
    nameEn: "Hatiya",
    lat: 22.2891,
    lng: 91.1097,
    headquarters: "ওছখালী বাজার",
    description: "বঙ্গোপসাগরের কোল ঘেঁষা ঐতিহ্যবাহী ও অপার সৌন্দর্যের দ্বীপ উপজেলা (নিঝুম দ্বীপ)।",
    postalCode: "3890",
  },
];

// ============================================================================
// 2. BUSINESS & INSTITUTION DIRECTORY
// ============================================================================

export type InstitutionCategory =
  | "shop_business"
  | "restaurant_hotel"
  | "hospital_clinic"
  | "diagnostic_center"
  | "education"
  | "training_center"
  | "office_govt"
  | "transport_utility"
  | "tourist_spot";

export const INSTITUTION_CATEGORIES: { id: InstitutionCategory; bn: string; icon: string }[] = [
  { id: "shop_business", bn: "দোকান ও ব্যবসা প্রতিষ্ঠান", icon: "Store" },
  { id: "restaurant_hotel", bn: "রেস্টুরেন্ট ও হোটেল", icon: "Utensils" },
  { id: "hospital_clinic", bn: "হাসপাতাল ও ক্লিনিক", icon: "Hospital" },
  { id: "diagnostic_center", bn: "ডায়াগনস্টিক ও ল্যাব", icon: "Activity" },
  { id: "education", bn: "শিক্ষা প্রতিষ্ঠান", icon: "GraduationCap" },
  { id: "training_center", bn: "প্রশিক্ষণ ও কারিগরি", icon: "BookOpen" },
  { id: "office_govt", bn: "অফিস ও সরকারি প্রতিষ্ঠান", icon: "Building2" },
  { id: "transport_utility", bn: "পরিবহন ও জরুরি সেবা", icon: "Truck" },
  { id: "tourist_spot", bn: "দর্শনীয় স্থান ও ঐতিহ্য", icon: "MapPin" },
];

export interface Institution {
  id: string;
  name: string;
  en_name?: string;
  category: InstitutionCategory;
  type?: string;
  description: string;
  address: string;
  upazila: string;
  union?: string;
  phone: string;
  alternate_phone?: string;
  email?: string;
  website?: string;
  google_maps_url?: string;
  lat?: number;
  lng?: number;
  opening_hours?: string;
  verified: boolean;
  featured?: boolean;
  logo_url?: string;
  cover_url?: string;
  gallery_urls?: string[];
  status: "approved" | "pending" | "rejected";
  submitted_by_uid?: string;
  submitted_by_name?: string;
  created_at: string;
  updated_at?: string;
  view_count?: number;
}

// Built-in Seed Institutions of Noakhali (for immediate rich search & map availability)
export const DEFAULT_INSTITUTIONS: Institution[] = [
  {
    id: "inst-250-bed-hospital",
    name: "নোয়াখালী ২৫০ শয্যা জেনারেল হাসপাতাল",
    en_name: "Noakhali 250 Bed General Hospital",
    category: "hospital_clinic",
    type: "সরকারি জেনারেল হাসপাতাল",
    description: "নোয়াখালী জেলার সর্ববৃহৎ ও প্রধান সরকারি চিকিৎসাকেন্দ্র। জরুরি বিভাগ ২৪ ঘণ্টা খোলা।",
    address: "হাসপাতাল রোড, মাইজদী কোর্ট, নোয়াখালী",
    upazila: "নোয়াখালী সদর (মাইজদী)",
    union: "মাইজদী পৌরসভা",
    phone: "01730324838",
    google_maps_url: "https://maps.google.com/?q=22.8680,91.0988",
    lat: 22.8680,
    lng: 91.0988,
    opening_hours: "২৪ ঘণ্টা জরুরি সেবা",
    verified: true,
    featured: true,
    status: "approved",
    created_at: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "inst-nstu",
    name: "নোয়াখালী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয় (নোবিপ্রবি)",
    en_name: "Noakhali Science and Technology University (NSTU)",
    category: "education",
    type: "পাবলিক বিশ্ববিদ্যালয়",
    description: "উপকূলের অক্সফোর্ড খ্যাত নোয়াখালীর সর্বোচ্চ উচ্চশিক্ষা ও গবেষণার পাবলিক বিশ্ববিদ্যালয়।",
    address: "সোনাপুর, নোয়াখালী",
    upazila: "নোয়াখালী সদর (মাইজদী)",
    union: "সোনাপুর",
    phone: "02334496522",
    website: "https://nstu.edu.bd",
    google_maps_url: "https://maps.google.com/?q=22.7925,91.1008",
    lat: 22.7925,
    lng: 91.1008,
    opening_hours: "রবি-বৃহস্পতি: সকাল ৯:০০ - বিকেল ৫:০০",
    verified: true,
    featured: true,
    status: "approved",
    created_at: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "inst-chowmuhani-govt-college",
    name: "চৌমুহনী সরকারি এস. এ. কলেজ",
    en_name: "Chowmuhani Govt S.A. College",
    category: "education",
    type: "সরকারি কলেজ ও অনার্স-মাস্টার্স কেন্দ্র",
    description: "নোয়াখালীর ঐতিহ্যবাহী সরকারি শিক্ষা প্রতিষ্ঠান, জাতীয় বিশ্ববিদ্যালয়ের অধীন স্নাতক ও স্নাতকোত্তর।",
    address: "কলেজ রোড, চৌমুহনী, বেগমগঞ্জ",
    upazila: "বেগমগঞ্জ (চৌমুহনী)",
    union: "চৌমুহনী পৌরসভা",
    phone: "02334432111",
    google_maps_url: "https://maps.google.com/?q=22.9512,91.1055",
    lat: 22.9512,
    lng: 91.1055,
    opening_hours: "সকাল ৯:০০ - বিকেল ৪:০০",
    verified: true,
    featured: true,
    status: "approved",
    created_at: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "inst-dc-office-noakhali",
    name: "জেলা প্রশাসকের কার্যালয়, নোয়াখালী",
    en_name: "Office of the Deputy Commissioner, Noakhali",
    category: "office_govt",
    type: "জেলা প্রশাসন",
    description: "নোয়াখালী জেলার সর্বোচ্চ প্রশাসনিক কার্যালয়। নাগরিক সেবা, ভূমি রেকর্ড ও সার্বিক সমন্বয়।",
    address: "কালেক্টরেট ভবন, মাইজদী কোর্ট, নোয়াখালী",
    upazila: "নোয়াখালী সদর (মাইজদী)",
    union: "মাইজদী পৌরসভা",
    phone: "02334431200",
    website: "http://www.noakhali.gov.bd",
    google_maps_url: "https://maps.google.com/?q=22.8696,91.0995",
    lat: 22.8696,
    lng: 91.0995,
    opening_hours: "রবি-বৃহস্পতি: সকাল ৯:০০ - বিকেল ৫:০০",
    verified: true,
    featured: true,
    status: "approved",
    created_at: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "inst-noakhali-police-super",
    name: "পুলিশ সুপার কার্যালয়, নোয়াখালী",
    en_name: "Superintendent of Police Office, Noakhali",
    category: "office_govt",
    type: "জেলা পুলিশ প্রশাসন ও হেল্পলাইন",
    description: "আইনশৃঙ্খলা নিয়ন্ত্রণ, পুলিশ ভেরিফিকেশন, নাগরিক নিরাপত্তা ও কন্ট্রোল রুম।",
    address: "পুলিশ লাইন রোড, মাইজদী, নোয়াখালী",
    upazila: "নোয়াখালী সদর (মাইজদী)",
    union: "মাইজদী পৌরসভা",
    phone: "01320115000",
    google_maps_url: "https://maps.google.com/?q=22.8655,91.0945",
    lat: 22.8655,
    lng: 91.0945,
    opening_hours: "২৪ ঘণ্টা কন্ট্রোল রুম",
    verified: true,
    featured: true,
    status: "approved",
    created_at: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "inst-gandhi-ashram",
    name: "গান্ধী আশ্রম ট্রাস্ট, জয়াগ",
    en_name: "Gandhi Ashram Trust, Joyag",
    category: "tourist_spot",
    type: "ঐতিহাসিক দর্শনীয় স্থান ও শান্তি কেন্দ্র",
    description: "মহাত্মা গান্ধীর স্মৃতিবিজড়িত ঐতিহাসিক শান্তিকেন্দ্র, জাদুঘর ও গ্রামীণ কারিগরি কেন্দ্র।",
    address: "জয়াগ বাজার, সোনাইমুড়ী, নোয়াখালী",
    upazila: "সোনাইমুড়ী",
    union: "জয়াগ",
    phone: "01711122334",
    google_maps_url: "https://maps.google.com/?q=23.0450,91.0820",
    lat: 23.0450,
    lng: 91.0820,
    opening_hours: "সকাল ৯:০০ - বিকেল ৫:০০",
    verified: true,
    featured: true,
    status: "approved",
    created_at: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "inst-nijhum-dwip-national-park",
    name: "নিঝুম দ্বীপ জাতীয় উদ্যান ও হরিণ অভয়ারণ্য",
    en_name: "Nijhum Dwip National Park",
    category: "tourist_spot",
    type: "প্রাকৃতিক পর্যটন ও জীববৈচিত্র্য",
    description: "বঙ্গোপসাগরের বুকে মায়াবী দ্বীপ, চিত্রা হরিণ, ম্যানগ্রোভ বন ও পরিযায়ী পাখির স্বর্গরাজ্য।",
    address: "নিঝুম দ্বীপ, হাতিয়া, নোয়াখালী",
    upazila: "হাতিয়া",
    union: "নিঝুম দ্বীপ",
    phone: "01819998877",
    google_maps_url: "https://maps.google.com/?q=22.0620,91.0020",
    lat: 22.0620,
    lng: 91.0020,
    opening_hours: "সার্বক্ষণিক উন্মুক্ত",
    verified: true,
    featured: true,
    status: "approved",
    created_at: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "inst-basurhat-pourashava",
    name: "বসুরহাট পৌরসভা কার্যালয়",
    en_name: "Basurhat Pourashava Office",
    category: "office_govt",
    type: "স্থানীয় সরকার",
    description: "কোম্পানীগঞ্জ উপজেলার বাণিজ্যিক ও নাগরিক সেবা কার্যালয়।",
    address: "বসুরহাট প্রধান সড়ক, কোম্পানীগঞ্জ",
    upazila: "কোম্পানীগঞ্জ (বসুরহাট)",
    union: "বসুরহাট পৌরসভা",
    phone: "02334475100",
    google_maps_url: "https://maps.google.com/?q=22.8687,91.2882",
    lat: 22.8687,
    lng: 91.2882,
    opening_hours: "রবি-বৃহস্পতি: সকাল ৯:০০ - বিকেল ৫:০০",
    verified: true,
    featured: false,
    status: "approved",
    created_at: "2024-01-01T00:00:00.000Z",
  },
];

// ============================================================================
// 3. EDUCATION & CAREER PORTAL
// ============================================================================

export type JobType = "govt" | "private" | "local_noakhali" | "internship" | "scholarship";

export interface JobCircular {
  id: string;
  title: string;
  organization: string;
  job_type: JobType;
  location: string;
  upazila: string;
  qualification: string;
  salary?: string;
  deadline: string;
  application_link?: string;
  attachment_url?: string;
  description: string;
  how_to_apply?: string;
  verified: boolean;
  status: "approved" | "pending" | "rejected";
  created_at: string;
  updated_at?: string;
}

export const DEFAULT_JOB_CIRCULARS: JobCircular[] = [
  {
    id: "job-dc-recruitment-2026",
    title: "জেলা প্রশাসকের কার্যালয়ে বিভিন্ন পদে নিয়োগ বিজ্ঞপ্তি",
    organization: "জেলা প্রশাসকের কার্যালয়, নোয়াখালী",
    job_type: "govt",
    location: "নোয়াখালী সদর (মাইজディー)",
    upazila: "নোয়াখালী সদর (মাইজদী)",
    qualification: "স্নাতক / এইচএসসি / সমমান",
    salary: "গ্রেড ১২-১৬ (সরকারি স্কেল)",
    deadline: "2026-12-15",
    application_link: "http://noakhali.teletalk.com.bd",
    description: "জেলা প্রশাসকের কার্যালয়ে রাজস্ব প্রশাসনের শূন্য পদসমূহে সরাসরি নিয়োগের নিমিত্তে নোয়াখালী জেলার যোগ্য প্রার্থীদের নিকট থেকে অনলাইনে আবেদন আহ্বান করা হচ্ছে।",
    how_to_apply: "অনলাইনে টেলিটক ওয়েবসাইটের মাধ্যমে আবেদন ও পরীক্ষার ফি জমা দিতে হবে।",
    verified: true,
    status: "approved",
    created_at: "2026-11-01T00:00:00.000Z",
  },
  {
    id: "job-nstu-officer-2026",
    title: "নোবিপ্রবিতে সহকারী রেজিস্ট্রার ও কর্মকর্তা নিয়োগ",
    organization: "নোয়াখালী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়",
    job_type: "govt",
    location: "সোনাপুর, নোয়াখালী",
    upazila: "নোয়াখালী সদর (মাইজদী)",
    qualification: "প্রথম শ্রেণির স্নাতকোত্তর ডিগ্রি বা সমমান",
    salary: "জাতীয় বেতন স্কেল ২০১৫",
    deadline: "2026-12-20",
    application_link: "https://nstu.edu.bd/career",
    description: "নোয়াখালী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়ে শূন্য পদে স্থায়ী ও অস্থায়ী ভিত্তিতে কর্মকর্তা পদে নিয়োগ দেওয়া হবে।",
    how_to_apply: "বিশ্ববিদ্যালয়ের নির্ধারিত ফরমে রেজিস্ট্রার দপ্তর বরাবর আবেদন পাঠাতে হবে।",
    verified: true,
    status: "approved",
    created_at: "2026-11-02T00:00:00.000Z",
  },
  {
    id: "job-chowmuhani-bank-officer",
    title: "চৌমুহনী বাণিজ্যিক শাখায় কাস্টমার সার্ভিস অফিসার",
    organization: "অগ্রণী কমার্শিয়াল ফাইন্যান্স লিমিটেড",
    job_type: "private",
    location: "চৌমুহনী বাজার, বেগমগঞ্জ",
    upazila: "বেগমগঞ্জ (চৌমুহনী)",
    qualification: "বিবিএ / স্নাতক (বাণিজ্য বিভাগ অগ্রাধিকার)",
    salary: "২৫,০০০ - ৩৫,০০০ টাকা",
    deadline: "2026-11-30",
    application_link: "mailto:hr@agranifinance.com",
    description: "চৌমুহনী শাখায় দ্রুত গ্রাহক সেবা প্রদান ও ব্যাংকিং অ্যাকাউন্ট ব্যবস্থাপনায় পারদর্শী কর্মী আবশ্যক।",
    how_to_apply: "সিভি ও জাতীয় পরিচয়পত্রের কপি ইমেইলে জমা দিন।",
    verified: true,
    status: "approved",
    created_at: "2026-11-05T00:00:00.000Z",
  },
  {
    id: "job-district-ict-trainer",
    title: "স্মার্ট নোয়াখালী ডিজিটাল ফ্রিল্যান্সিং ট্রেইনার",
    organization: "জেলা যুব উন্নয়ন অধিদপ্তর ও আইসিটি ল্যাব",
    job_type: "internship",
    location: "মাইজদী কোর্ট",
    upazila: "নোয়াখালী সদর (মাইজদী)",
    qualification: "কম্পিউটার সায়েন্স / গ্রাফিক্স / ওয়েব ডেভেলপমেন্টে অভিজ্ঞতা",
    salary: "সম্মানী ভাতা ১৮,০০০ টাকা",
    deadline: "2026-12-05",
    application_link: "https://smartnoakhali.com",
    description: "তরুণ-তরুণীদের তথ্যপ্রযুক্তি দক্ষতা বৃদ্ধি ও ফ্রিল্যান্সিং প্রশিক্ষণে প্রশিক্ষক হিসেবে দায়িত্ব পালন করতে হবে।",
    how_to_apply: "অনলাইনে পোর্টাল থেকে আবেদন করুন।",
    verified: true,
    status: "approved",
    created_at: "2026-11-06T00:00:00.000Z",
  },
];

// ============================================================================
// 4. COMPLAINT TRACKING SYSTEM
// ============================================================================

export type ComplaintStatus =
  | "submitted"
  | "under_review"
  | "in_progress"
  | "waiting_info"
  | "resolved"
  | "rejected";

export const COMPLAINT_STATUS_MAP: Record<
  ComplaintStatus,
  { label: string; color: string; badgeClass: string; step: number }
> = {
  submitted: {
    label: "দাখিলকৃত (Submitted)",
    color: "#6b7280",
    badgeClass: "bg-gray-500/15 text-gray-700 border-gray-500/30",
    step: 1,
  },
  under_review: {
    label: "পর্যালোচনাধীন (Under Review)",
    color: "#d97706",
    badgeClass: "bg-amber-500/15 text-amber-700 border-amber-500/30",
    step: 2,
  },
  in_progress: {
    label: "প্রক্রিয়াধীন (In Progress)",
    color: "#2563eb",
    badgeClass: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    step: 3,
  },
  waiting_info: {
    label: "অতিরিক্ত তথ্য প্রয়োজন (Waiting Info)",
    color: "#9333ea",
    badgeClass: "bg-purple-500/15 text-purple-700 border-purple-500/30",
    step: 3,
  },
  resolved: {
    label: "সমাধান সম্পন্ন (Resolved)",
    color: "#16a34a",
    badgeClass: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    step: 4,
  },
  rejected: {
    label: "বাতিলকৃত (Rejected)",
    color: "#dc2626",
    badgeClass: "bg-red-500/15 text-red-700 border-red-500/30",
    step: 4,
  },
};

export interface ComplaintTrackingItem {
  id: string; // document id & tracking number (e.g. SNK-CMP-7489)
  tracking_number: string;
  category: string;
  subject: string;
  description: string;
  upazila: string;
  location?: string;
  attachment_url?: string;
  status: ComplaintStatus;
  status_history?: Array<{
    status: ComplaintStatus;
    updated_at: string;
    note?: string;
  }>;
  admin_remarks?: string;
  resolution_details?: string;
  user_id?: string;
  user_name?: string;
  contact_phone?: string;
  created_at: string;
  updated_at?: string;
}

// ============================================================================
// 5. USER FAVORITES & NOTIFICATIONS
// ============================================================================

export interface UserFavoriteItem {
  id: string;
  user_id: string;
  target_id: string;
  target_type: "institution" | "job" | "service";
  title: string;
  subtitle?: string;
  link: string;
  created_at: string;
}

export const NOTIFICATION_CATEGORIES = [
  "জরুরি বিজ্ঞপ্তি",
  "রক্তের প্রয়োজন",
  "রক্তদাতা সংক্রান্ত আপডেট",
  "অনুদান সংক্রান্ত বিজ্ঞপ্তি",
  "নতুন তথ্য অনুমোদন",
  "তথ্য সংশোধন",
  "অভিযোগের আপডেট",
  "অ্যাকাউন্ট সংক্রান্ত বিজ্ঞপ্তি",
  "প্রশাসনিক বিজ্ঞপ্তি",
  "সিস্টেম বিজ্ঞপ্তি",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const ESSENTIAL_NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  "সিস্টেম বিজ্ঞপ্তি",
  "জরুরি বিজ্ঞপ্তি",
];

export type NotificationPriority = "normal" | "high" | "urgent";

export type NotificationAudience =
  | "all_users"
  | "specific_users"
  | "all_admins"
  | "ordinary_admins"
  | "staff_editors";

export type NotificationStatus = "created" | "queued" | "sent" | "failed" | "partial";

export interface UserNotificationItem {
  id: string;
  user_id?: string; // empty means global broadcast
  is_global: boolean;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "status_update";
  category?: NotificationCategory;
  priority?: NotificationPriority;
  audience?: NotificationAudience;
  target_roles?: string[];
  scheduled_at?: string;
  status?: NotificationStatus;
  idempotency_key?: string;
  channels?: Array<"in_app" | "web_push" | "email">;
  created_by?: string;
  link?: string;
  read: boolean;
  created_at: string;
  updated_at?: string;
}

export interface NotificationDeliveryRecord {
  id: string;
  notification_id: string;
  title: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  audience: NotificationAudience;
  channel: "in_app" | "web_push" | "email";
  recipient: string;
  status: "queued" | "sent" | "failed";
  error_message?: string;
  idempotency_key?: string;
  scheduled_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface NotificationPreferences {
  in_app: boolean;
  web_push: boolean;
  email: boolean;
  muted_categories: NotificationCategory[];
  email_address?: string;
  updated_at?: string;
}

// ============================================================================
// 6. FIRESTORE HOOKS & FUNCTIONS
// ============================================================================

// --- INSTITUTIONS ---
export function useInstitutions() {
  const [items, setItems] = useState<Institution[]>(() => {
    try {
      const cached = localStorage.getItem("sn_institutions_cache");
      return cached ? JSON.parse(cached) : DEFAULT_INSTITUTIONS;
    } catch {
      return DEFAULT_INSTITUTIONS;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "institutions"),
      (snap) => {
        if (!snap.empty) {
          const list: Institution[] = [];
          snap.forEach((d) => {
            const data = d.data();
            list.push({
              id: d.id,
              name: String(data.name || ""),
              en_name: data.en_name ? String(data.en_name) : undefined,
              category: (data.category as InstitutionCategory) || "shop_business",
              type: data.type ? String(data.type) : undefined,
              description: String(data.description || ""),
              address: String(data.address || ""),
              upazila: String(data.upazila || "নোয়াখালী সদর (মাইজদী)"),
              union: data.union ? String(data.union) : undefined,
              phone: String(data.phone || ""),
              alternate_phone: data.alternate_phone ? String(data.alternate_phone) : undefined,
              email: data.email ? String(data.email) : undefined,
              website: data.website ? String(data.website) : undefined,
              google_maps_url: data.google_maps_url ? String(data.google_maps_url) : undefined,
              lat: typeof data.lat === "number" ? data.lat : undefined,
              lng: typeof data.lng === "number" ? data.lng : undefined,
              opening_hours: data.opening_hours ? String(data.opening_hours) : undefined,
              verified: Boolean(data.verified),
              featured: Boolean(data.featured),
              logo_url: data.logo_url ? String(data.logo_url) : undefined,
              cover_url: data.cover_url ? String(data.cover_url) : undefined,
              gallery_urls: Array.isArray(data.gallery_urls) ? data.gallery_urls : [],
              status: (data.status as Institution["status"]) || "approved",
              submitted_by_uid: data.submitted_by_uid ? String(data.submitted_by_uid) : undefined,
              created_at: String(data.created_at || new Date().toISOString()),
              updated_at: data.updated_at ? String(data.updated_at) : undefined,
              view_count: typeof data.view_count === "number" ? data.view_count : 0,
            });
          });

          // Merge with built-in seeds if not present
          const existingIds = new Set(list.map((i) => i.id));
          for (const seed of DEFAULT_INSTITUTIONS) {
            if (!existingIds.has(seed.id)) {
              list.push(seed);
            }
          }
          setItems(list);
          try {
            localStorage.setItem("sn_institutions_cache", JSON.stringify(list));
          } catch {}
        } else {
          setItems(DEFAULT_INSTITUTIONS);
        }
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const createInstitution = useCallback(async (data: Omit<Institution, "id" | "created_at">) => {
    const id = "inst-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
    const docRef = doc(db, "institutions", id);
    const now = new Date().toISOString();
    const payload = sanitizeFirestorePayload({
      ...data,
      id,
      created_at: now,
      updated_at: now,
      view_count: 0,
    });
    await setDoc(docRef, payload);
    return id;
  }, []);

  const updateInstitution = useCallback(async (id: string, patch: Partial<Institution>) => {
    const docRef = doc(db, "institutions", id);
    const cleanPatch = sanitizeFirestorePayload({
      ...patch,
      updated_at: new Date().toISOString(),
    });
    await setDoc(docRef, cleanPatch, { merge: true });
  }, []);

  const deleteInstitution = useCallback(async (id: string) => {
    const docRef = doc(db, "institutions", id);
    await deleteDoc(docRef);
  }, []);

  return {
    institutions: items,
    approvedInstitutions: useMemo(() => items.filter((i) => i.status === "approved"), [items]),
    loading,
    createInstitution,
    updateInstitution,
    deleteInstitution,
  };
}

// --- JOB CIRCULARS ---
export function useJobCirculars() {
  const [items, setItems] = useState<JobCircular[]>(() => {
    try {
      const cached = localStorage.getItem("sn_jobs_cache");
      return cached ? JSON.parse(cached) : DEFAULT_JOB_CIRCULARS;
    } catch {
      return DEFAULT_JOB_CIRCULARS;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "job_circulars"),
      (snap) => {
        if (!snap.empty) {
          const list: JobCircular[] = [];
          snap.forEach((d) => {
            const data = d.data();
            list.push({
              id: d.id,
              title: String(data.title || ""),
              organization: String(data.organization || ""),
              job_type: (data.job_type as JobType) || "private",
              location: String(data.location || "নোয়াখালী"),
              upazila: String(data.upazila || "নোয়াখালী সদর (মাইজদী)"),
              qualification: String(data.qualification || ""),
              salary: data.salary ? String(data.salary) : undefined,
              deadline: String(data.deadline || ""),
              application_link: data.application_link ? String(data.application_link) : undefined,
              attachment_url: data.attachment_url ? String(data.attachment_url) : undefined,
              description: String(data.description || ""),
              how_to_apply: data.how_to_apply ? String(data.how_to_apply) : undefined,
              verified: Boolean(data.verified),
              status: (data.status as JobCircular["status"]) || "approved",
              created_at: String(data.created_at || new Date().toISOString()),
              updated_at: data.updated_at ? String(data.updated_at) : undefined,
            });
          });

          // Merge with built-in seeds if not in Firestore
          const existingIds = new Set(list.map((j) => j.id));
          for (const seed of DEFAULT_JOB_CIRCULARS) {
            if (!existingIds.has(seed.id)) {
              list.push(seed);
            }
          }
          setItems(list);
          try {
            localStorage.setItem("sn_jobs_cache", JSON.stringify(list));
          } catch {}
        } else {
          setItems(DEFAULT_JOB_CIRCULARS);
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const createJobCircular = useCallback(async (data: Omit<JobCircular, "id" | "created_at">) => {
    const id = "job-" + Date.now();
    const docRef = doc(db, "job_circulars", id);
    const now = new Date().toISOString();
    const payload = sanitizeFirestorePayload({
      ...data,
      id,
      created_at: now,
      updated_at: now,
    });
    await setDoc(docRef, payload);
    return id;
  }, []);

  const updateJobCircular = useCallback(async (id: string, patch: Partial<JobCircular>) => {
    const docRef = doc(db, "job_circulars", id);
    const cleanPatch = sanitizeFirestorePayload({
      ...patch,
      updated_at: new Date().toISOString(),
    });
    await setDoc(docRef, cleanPatch, { merge: true });
  }, []);

  const deleteJobCircular = useCallback(async (id: string) => {
    const docRef = doc(db, "job_circulars", id);
    await deleteDoc(docRef);
  }, []);

  return {
    jobCirculars: items,
    approvedJobs: useMemo(() => items.filter((j) => j.status === "approved"), [items]),
    loading,
    createJobCircular,
    updateJobCircular,
    deleteJobCircular,
  };
}

// --- COMPLAINTS TRACKING ---
export function useComplaints() {
  const [complaints, setComplaints] = useState<ComplaintTrackingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "complaint_tracking"), orderBy("created_at", "desc"), limit(200)),
      (snap) => {
        const list: ComplaintTrackingItem[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            tracking_number: String(data.tracking_number || d.id),
            category: String(data.category || "সাধারণ"),
            subject: String(data.subject || ""),
            description: String(data.description || ""),
            upazila: String(data.upazila || "নোয়াখালী সদর (মাইজদী)"),
            location: data.location ? String(data.location) : undefined,
            attachment_url: data.attachment_url ? String(data.attachment_url) : undefined,
            status: (data.status as ComplaintStatus) || "submitted",
            status_history: Array.isArray(data.status_history) ? data.status_history : [],
            admin_remarks: data.admin_remarks ? String(data.admin_remarks) : undefined,
            resolution_details: data.resolution_details ? String(data.resolution_details) : undefined,
            user_id: data.user_id ? String(data.user_id) : undefined,
            user_name: data.user_name ? String(data.user_name) : undefined,
            contact_phone: data.contact_phone ? String(data.contact_phone) : undefined,
            created_at: String(data.created_at || new Date().toISOString()),
            updated_at: data.updated_at ? String(data.updated_at) : undefined,
          });
        });
        setComplaints(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const createComplaint = useCallback(async (data: {
    category: string;
    subject: string;
    description: string;
    upazila: string;
    location?: string;
    attachment_url?: string;
    contact_phone?: string;
    user_id?: string;
    user_name?: string;
  }): Promise<string> => {
    // Generate clean unique tracking number e.g. SNK-CMP-7A29
    const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const datePart = new Date().toISOString().slice(2, 4) + (new Date().getMonth() + 1).toString().padStart(2, "0");
    const trackingNumber = `SNK-${datePart}-${randPart}`;

    const docRef = doc(db, "complaint_tracking", trackingNumber);
    const now = new Date().toISOString();

    const payload = sanitizeFirestorePayload({
      id: trackingNumber,
      tracking_number: trackingNumber,
      category: data.category,
      subject: data.subject,
      description: data.description,
      upazila: data.upazila,
      location: data.location || "",
      attachment_url: data.attachment_url || "",
      contact_phone: data.contact_phone || "",
      user_id: data.user_id || "",
      user_name: data.user_name || "",
      status: "submitted",
      status_history: [
        {
          status: "submitted",
          updated_at: now,
          note: "অভিযোগ সফলভাবে দাখিল হয়েছে। প্রাথমিক পর্যালোচনার অপেক্ষায় আছে।",
        },
      ],
      created_at: now,
      updated_at: now,
    });

    await setDoc(docRef, payload);
    return trackingNumber;
  }, []);

  const updateComplaintStatus = useCallback(async (
    trackingNumber: string,
    nextStatus: ComplaintStatus,
    adminRemarks?: string,
    resolutionDetails?: string
  ) => {
    const docRef = doc(db, "complaint_tracking", trackingNumber);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error("অভিযোগ পাওয়া যায়নি।");

    const currentData = snap.data();
    const history = Array.isArray(currentData.status_history) ? [...currentData.status_history] : [];
    const now = new Date().toISOString();

    history.push({
      status: nextStatus,
      updated_at: now,
      note: adminRemarks || COMPLAINT_STATUS_MAP[nextStatus]?.label || "অবস্থা পরিবর্তন করা হয়েছে।",
    });

    const patch: Record<string, any> = {
      status: nextStatus,
      status_history: history,
      updated_at: now,
    };
    if (adminRemarks !== undefined) patch.admin_remarks = adminRemarks;
    if (resolutionDetails !== undefined) patch.resolution_details = resolutionDetails;

    await setDoc(docRef, sanitizeFirestorePayload(patch), { merge: true });
  }, []);

  return {
    complaints,
    loading,
    createComplaint,
    updateComplaintStatus,
  };
}

// Direct lookup by tracking number (secure for public tracker)
export async function lookupComplaintByTrackingNumber(trackingNumber: string): Promise<ComplaintTrackingItem | null> {
  const clean = trackingNumber.trim().toUpperCase();
  if (!clean) return null;

  try {
    const docRef = doc(db, "complaint_tracking", clean);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        id: snap.id,
        tracking_number: String(data.tracking_number || snap.id),
        category: String(data.category || "সাধারণ"),
        subject: String(data.subject || ""),
        description: String(data.description || ""),
        upazila: String(data.upazila || "নোয়াখালী সদর (মাইজদী)"),
        location: data.location ? String(data.location) : undefined,
        status: (data.status as ComplaintStatus) || "submitted",
        status_history: Array.isArray(data.status_history) ? data.status_history : [],
        admin_remarks: data.admin_remarks ? String(data.admin_remarks) : undefined,
        resolution_details: data.resolution_details ? String(data.resolution_details) : undefined,
        created_at: String(data.created_at || new Date().toISOString()),
        updated_at: data.updated_at ? String(data.updated_at) : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// --- USER FAVORITES (BOOKMARKS) ---
export function useUserFavorites(userId?: string) {
  const [favorites, setFavorites] = useState<UserFavoriteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const firebaseAuthUid = useFirebaseAuthUid();
  const effectiveAuthUid = userId && firebaseAuthUid === userId ? firebaseAuthUid : null;

  useEffect(() => {
    if (!effectiveAuthUid) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, "user_favorites"), where("user_id", "==", effectiveAuthUid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: UserFavoriteItem[] = [];
        snap.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            user_id: data.user_id,
            target_id: data.target_id,
            target_type: data.target_type,
            title: data.title,
            subtitle: data.subtitle,
            link: data.link,
            created_at: data.created_at,
          });
        });
        setFavorites(list);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [effectiveAuthUid]);

  const toggleFavorite = useCallback(
    async (item: { target_id: string; target_type: "institution" | "job" | "service"; title: string; subtitle?: string; link: string }) => {
      const liveUid = auth.currentUser?.uid;
      if (!userId || !liveUid || liveUid !== userId) {
        throw new Error("প্রিয় তালিকায় যোগ করতে দয়া করে আপনার অ্যাকাউন্টে পুনরায় লগইন করুন।");
      }
      const existing = favorites.find((f) => f.target_id === item.target_id);
      if (existing) {
        await deleteDoc(doc(db, "user_favorites", existing.id));
      } else {
        const safeTargetId = String(item.target_id || "item").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
        const id = `fav-${liveUid}-${safeTargetId}`.slice(0, 128);
        await setDoc(
          doc(db, "user_favorites", id),
          sanitizeFirestorePayload({
            id,
            user_id: liveUid,
            target_id: item.target_id,
            target_type: item.target_type,
            title: item.title,
            subtitle: item.subtitle || "",
            link: item.link,
            created_at: new Date().toISOString(),
          })
        );
      }
    },
    [userId, favorites]
  );

  const isFavorite = useCallback(
    (targetId: string) => favorites.some((f) => f.target_id === targetId),
    [favorites]
  );

  return {
    favorites,
    loading,
    toggleFavorite,
    isFavorite,
  };
}

// --- USER NOTIFICATIONS ---
function mapNotificationPermissionError(err: any): string {
  const code = String(err?.code || "");
  const msg = String(err?.message || "");
  if (code.includes("permission-denied") || msg.toLowerCase().includes("insufficient permissions")) {
    return "বিজ্ঞপ্তি অ্যাক্সেসে অনুমতি সমস্যা হয়েছে। পেজ রিলোড বা পুনরায় লগইন করে চেষ্টা করুন।";
  }
  return msg || "বিজ্ঞপ্তি লোড করতে সমস্যা হয়েছে";
}

function getLocalReadStorageKey(userId?: string): string {
  return `sn_read_notif_ids_${userId || "guest"}`;
}

function readLocalReadIds(userId?: string): string[] {
  try {
    const key = getLocalReadStorageKey(userId);
    const raw = localStorage.getItem(key) || (!userId ? localStorage.getItem("sn_guest_read_notif_ids") : null);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function normalizeNotificationCategory(raw: unknown): NotificationCategory {
  if (typeof raw === "string" && (NOTIFICATION_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as NotificationCategory;
  }
  return "সিস্টেম বিজ্ঞপ্তি";
}

function normalizeNotificationPriority(raw: unknown): NotificationPriority {
  if (raw === "urgent" || raw === "high" || raw === "normal") return raw;
  return "normal";
}

function normalizeNotificationAudience(raw: unknown, isGlobal: boolean): NotificationAudience {
  if (
    raw === "all_users" ||
    raw === "specific_users" ||
    raw === "all_admins" ||
    raw === "ordinary_admins" ||
    raw === "staff_editors"
  ) {
    return raw;
  }
  return isGlobal ? "all_users" : "specific_users";
}

function mapDocToNotificationItem(id: string, data: Record<string, any>, fallbackRead = false): UserNotificationItem {
  const isGlobal = Boolean(data.is_global);
  return {
    id,
    user_id: data.user_id ? String(data.user_id) : undefined,
    is_global: isGlobal,
    title: String(data.title || ""),
    message: String(data.message || ""),
    type: (data.type as UserNotificationItem["type"]) || "info",
    category: normalizeNotificationCategory(data.category),
    priority: normalizeNotificationPriority(data.priority),
    audience: normalizeNotificationAudience(data.audience, isGlobal),
    target_roles: Array.isArray(data.target_roles) ? data.target_roles.map(String) : undefined,
    scheduled_at: typeof data.scheduled_at === "string" && data.scheduled_at ? data.scheduled_at : undefined,
    status: (data.status as NotificationStatus) || "sent",
    idempotency_key: typeof data.idempotency_key === "string" ? data.idempotency_key : undefined,
    channels: Array.isArray(data.channels) ? data.channels : ["in_app"],
    created_by: typeof data.created_by === "string" ? data.created_by : undefined,
    link: data.link ? String(data.link) : undefined,
    read: Boolean(data.read) || fallbackRead,
    created_at: String(data.created_at || new Date().toISOString()),
    updated_at: typeof data.updated_at === "string" ? data.updated_at : undefined,
  };
}

export interface NotificationRoleContext {
  isMainAdmin?: boolean;
  isAdmin?: boolean;
  isStaff?: boolean;
}

function matchesNotificationAudience(
  item: UserNotificationItem,
  userId?: string,
  roleContext?: NotificationRoleContext
): boolean {
  // Scheduled notifications stay hidden for regular recipients until their scheduled time arrives
  if (item.scheduled_at) {
    const schedMs = new Date(item.scheduled_at).getTime();
    if (!Number.isNaN(schedMs) && schedMs > Date.now() && !roleContext?.isMainAdmin) {
      return false;
    }
  }

  const audience = item.audience || (item.is_global ? "all_users" : "specific_users");
  if (audience === "all_users") return true;
  if (audience === "specific_users") {
    return Boolean(userId && item.user_id === userId);
  }
  if (audience === "all_admins") {
    return Boolean(roleContext?.isMainAdmin || roleContext?.isAdmin || (userId && item.user_id === userId));
  }
  if (audience === "ordinary_admins") {
    return Boolean(
      (roleContext?.isAdmin && !roleContext?.isMainAdmin) ||
        roleContext?.isMainAdmin ||
        (userId && item.user_id === userId)
    );
  }
  if (audience === "staff_editors") {
    return Boolean(
      roleContext?.isStaff ||
        roleContext?.isAdmin ||
        roleContext?.isMainAdmin ||
        (userId && item.user_id === userId)
    );
  }
  return true;
}

export function useUserNotifications(userId?: string, roleContext?: NotificationRoleContext) {
  const firebaseAuthUid = useFirebaseAuthUid();
  // Only run user-scoped Firestore listeners when real Firebase Auth UID matches userId
  const effectiveAuthUid = userId && firebaseAuthUid === userId ? firebaseAuthUid : null;
  const isMainAdmin = Boolean(roleContext?.isMainAdmin);
  const isAdmin = Boolean(roleContext?.isAdmin);
  const isStaff = Boolean(roleContext?.isStaff);

  const [globalItems, setGlobalItems] = useState<UserNotificationItem[]>([]);
  const [userItems, setUserItems] = useState<UserNotificationItem[]>([]);
  const [cloudReadIds, setCloudReadIds] = useState<string[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(true);
  const [loadingUser, setLoadingUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localReadIds, setLocalReadIds] = useState<string[]>(() => readLocalReadIds(userId));

  useEffect(() => {
    setLocalReadIds(readLocalReadIds(userId));
  }, [userId]);

  useEffect(() => {
    setLoadingGlobal(true);
    setError(null);
    const qGlobal = query(
      collection(db, "user_notifications"),
      where("is_global", "==", true),
      limit(60)
    );
    const unsubGlobal = onSnapshot(
      qGlobal,
      (snap) => {
        const list: UserNotificationItem[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const readBy: string[] = Array.isArray(data.read_by) ? data.read_by : [];
          const isReadLegacy = Boolean(data.read) || (userId ? readBy.includes(userId) : false);
          list.push(mapDocToNotificationItem(d.id, data, isReadLegacy));
        });
        setGlobalItems(list);
        setLoadingGlobal(false);
      },
      (err) => {
        setError(mapNotificationPermissionError(err));
        setLoadingGlobal(false);
      }
    );

    let unsubUser: (() => void) | null = null;
    let unsubReceipts: (() => void) | null = null;

    if (effectiveAuthUid) {
      setLoadingUser(true);
      const qUser = query(
        collection(db, "user_notifications"),
        where("user_id", "==", effectiveAuthUid),
        limit(60)
      );
      unsubUser = onSnapshot(
        qUser,
        (snap) => {
          const list: UserNotificationItem[] = [];
          snap.forEach((d) => {
            list.push(mapDocToNotificationItem(d.id, d.data()));
          });
          setUserItems(list);
          setLoadingUser(false);
        },
        (err) => {
          setError(mapNotificationPermissionError(err));
          setLoadingUser(false);
        }
      );

      // Per-user read receipts for global notifications (/users/{uid}/notification_reads)
      const qReceipts = query(
        collection(db, "users", effectiveAuthUid, "notification_reads"),
        limit(120)
      );
      unsubReceipts = onSnapshot(
        qReceipts,
        (snap) => {
          setCloudReadIds(snap.docs.map((d) => d.id));
        },
        () => {
          // Silently rely on local read cache if subcollection has no rules yet
        }
      );
    } else {
      setUserItems([]);
      setCloudReadIds([]);
      setLoadingUser(false);
    }

    return () => {
      unsubGlobal();
      if (unsubUser) unsubUser();
      if (unsubReceipts) unsubReceipts();
    };
  }, [userId, effectiveAuthUid]);

  const notifications = useMemo(() => {
    const merged = new Map<string, UserNotificationItem>();
    const ctx: NotificationRoleContext = { isMainAdmin, isAdmin, isStaff };
    for (const item of [...globalItems, ...userItems]) {
      if (!matchesNotificationAudience(item, userId, ctx)) continue;
      const effectiveRead =
        item.read ||
        cloudReadIds.includes(item.id) ||
        localReadIds.includes(item.id);
      merged.set(item.id, { ...item, read: effectiveRead });
    }
    return Array.from(merged.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [globalItems, userItems, cloudReadIds, localReadIds, userId, isMainAdmin, isAdmin, isStaff]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const persistLocalRead = useCallback(
    (ids: string[]) => {
      setLocalReadIds((prev) => {
        const next = Array.from(new Set([...prev, ...ids]));
        try {
          localStorage.setItem(getLocalReadStorageKey(userId), JSON.stringify(next));
          if (!userId) {
            localStorage.setItem("sn_guest_read_notif_ids", JSON.stringify(next));
          }
        } catch {}
        return next;
      });
    },
    [userId]
  );

  const markAsRead = useCallback(
    async (id: string) => {
      const target = notifications.find((n) => n.id === id);
      persistLocalRead([id]);

      if (!effectiveAuthUid) {
        return;
      }

      if (target && !target.is_global && target.user_id === effectiveAuthUid) {
        await updateDoc(doc(db, "user_notifications", id), {
          read: true,
          updated_at: new Date().toISOString(),
        }).catch(() => {});
      } else {
        // Least-privilege: record read state inside user's own notification_reads subcollection
        await setDoc(
          doc(db, "users", effectiveAuthUid, "notification_reads", id),
          {
            notif_id: id,
            user_id: effectiveAuthUid,
            read_at: new Date().toISOString(),
          },
          { merge: true }
        ).catch(() => {});
      }
    },
    [effectiveAuthUid, notifications, persistLocalRead]
  );

  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    persistLocalRead(unread.map((u) => u.id));
    if (!effectiveAuthUid) return;

    await Promise.all(unread.map((n) => markAsRead(n.id)));
  }, [notifications, effectiveAuthUid, persistLocalRead, markAsRead]);

  return {
    notifications,
    unreadCount,
    loading: loadingGlobal || loadingUser,
    error,
    markAsRead,
    markAllAsRead,
  };
}

// --- NOTIFICATION PREFERENCES & DEVICE PUSH TOKENS ---
const DEFAULT_PREFERENCES: NotificationPreferences = {
  in_app: true,
  web_push: false,
  email: false,
  muted_categories: [],
};

function getPrefStorageKey(userId?: string): string {
  return `sn_notif_prefs_${userId || "guest"}`;
}

function readLocalPrefs(userId?: string): NotificationPreferences {
  try {
    const raw = localStorage.getItem(getPrefStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
      const muted = Array.isArray(parsed.muted_categories)
        ? parsed.muted_categories.filter(
            (c): c is NotificationCategory =>
              (NOTIFICATION_CATEGORIES as readonly string[]).includes(c) &&
              !ESSENTIAL_NOTIFICATION_CATEGORIES.includes(c as NotificationCategory)
          )
        : [];
      return {
        in_app: parsed.in_app !== false,
        web_push: Boolean(parsed.web_push),
        email: Boolean(parsed.email),
        muted_categories: muted,
        email_address: typeof parsed.email_address === "string" ? parsed.email_address : undefined,
        updated_at: parsed.updated_at,
      };
    }
  } catch {}
  return { ...DEFAULT_PREFERENCES };
}

export function useNotificationPreferences(userId?: string) {
  const firebaseAuthUid = useFirebaseAuthUid();
  const effectiveAuthUid = userId && firebaseAuthUid === userId ? firebaseAuthUid : null;
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => readLocalPrefs(userId));
  const [loading, setLoading] = useState(Boolean(effectiveAuthUid));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPreferences(readLocalPrefs(userId));
  }, [userId]);

  useEffect(() => {
    if (!effectiveAuthUid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = doc(db, "users", effectiveAuthUid, "notification_preferences", "default");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const muted = Array.isArray(d.muted_categories)
            ? d.muted_categories.filter(
                (c: unknown): c is NotificationCategory =>
                  typeof c === "string" &&
                  (NOTIFICATION_CATEGORIES as readonly string[]).includes(c) &&
                  !ESSENTIAL_NOTIFICATION_CATEGORIES.includes(c as NotificationCategory)
              )
            : [];
          const next: NotificationPreferences = {
            in_app: d.in_app !== false,
            web_push: Boolean(d.web_push),
            email: Boolean(d.email),
            muted_categories: muted,
            email_address: typeof d.email_address === "string" ? d.email_address : undefined,
            updated_at: typeof d.updated_at === "string" ? d.updated_at : undefined,
          };
          setPreferences(next);
          try {
            localStorage.setItem(getPrefStorageKey(userId), JSON.stringify(next));
          } catch {}
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [effectiveAuthUid, userId]);

  const updatePreferences = useCallback(
    async (patch: Partial<NotificationPreferences>) => {
      setSaving(true);
      try {
        const cleanMuted = Array.isArray(patch.muted_categories ?? preferences.muted_categories)
          ? (patch.muted_categories ?? preferences.muted_categories).filter(
              (c) => !ESSENTIAL_NOTIFICATION_CATEGORIES.includes(c)
            )
          : [];
        const next: NotificationPreferences = {
          ...preferences,
          ...patch,
          in_app: true, // In-app essential delivery always enabled
          muted_categories: cleanMuted,
          updated_at: new Date().toISOString(),
        };
        setPreferences(next);
        try {
          localStorage.setItem(getPrefStorageKey(userId), JSON.stringify(next));
        } catch {}

        if (effectiveAuthUid) {
          await setDoc(
            doc(db, "users", effectiveAuthUid, "notification_preferences", "default"),
            sanitizeFirestorePayload({
              user_id: effectiveAuthUid,
              in_app: next.in_app,
              web_push: next.web_push,
              email: next.email,
              muted_categories: next.muted_categories,
              ...(next.email_address ? { email_address: next.email_address } : {}),
              updated_at: next.updated_at,
            }),
            { merge: true }
          );
        }
      } finally {
        setSaving(false);
      }
    },
    [effectiveAuthUid, preferences, userId]
  );

  return { preferences, loading, saving, updatePreferences };
}

const DEVICE_TOKEN_ID_KEY = "sn_device_push_token_id_v1";

function getOrCreateDeviceTokenId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_TOKEN_ID_KEY);
    if (existing && /^[a-zA-Z0-9_\-]+$/.test(existing)) return existing;
    const created = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(DEVICE_TOKEN_ID_KEY, created);
    return created;
  } catch {
    return `dev_${Date.now()}`;
  }
}

export async function registerDevicePushToken(
  uid: string,
  vapidPublicKey?: string
): Promise<{ ok: boolean; tokenId: string; hasPushSubscription: boolean; reason?: string }> {
  const tokenId = getOrCreateDeviceTokenId();
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { ok: false, tokenId, hasPushSubscription: false, reason: "এই ব্রাউজারে Notification API সাপোর্ট করে না।" };
  }
  if (Notification.permission !== "granted") {
    return { ok: false, tokenId, hasPushSubscription: false, reason: "নোটিফিকেশন অনুমতি (Permission) দেওয়া হয়নি।" };
  }

  let subscriptionJson: Record<string, unknown> | null = null;
  if ("serviceWorker" in navigator && "PushManager" in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub && vapidPublicKey && vapidPublicKey.trim()) {
        sub = await reg.pushManager
          .subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidPublicKey.trim(),
          })
          .catch(() => null);
      }
      if (sub) {
        subscriptionJson = sub.toJSON() as Record<string, unknown>;
      }
    } catch {
      // Service worker push subscription unavailable (e.g. without VAPID public key)
    }
  }

  const liveUid = auth.currentUser?.uid;
  if (liveUid && liveUid === uid) {
    await setDoc(
      doc(db, "users", uid, "device_tokens", tokenId),
      sanitizeFirestorePayload({
        id: tokenId,
        user_id: uid,
        platform: "web",
        permission: Notification.permission,
        endpoint: subscriptionJson?.endpoint ? String(subscriptionJson.endpoint).slice(0, 500) : "",
        subscription_json: subscriptionJson ? JSON.stringify(subscriptionJson).slice(0, 1500) : "",
        user_agent: (navigator.userAgent || "").slice(0, 200),
        active: true,
        updated_at: new Date().toISOString(),
      }),
      { merge: true }
    ).catch(() => {});
  }

  return {
    ok: true,
    tokenId,
    hasPushSubscription: Boolean(subscriptionJson?.endpoint),
  };
}

export async function unregisterDevicePushToken(uid: string): Promise<void> {
  if (!uid) return;
  let tokenId = "";
  try {
    tokenId = localStorage.getItem(DEVICE_TOKEN_ID_KEY) || "";
  } catch {
    return;
  }
  if (!tokenId || !/^[a-zA-Z0-9_\-]+$/.test(tokenId)) return;

  const liveUid = auth.currentUser?.uid;
  if (liveUid && liveUid === uid) {
    await deleteDoc(doc(db, "users", uid, "device_tokens", tokenId)).catch(() => {});
  }
}

// --- MAIN ADMIN NOTIFICATIONS & MULTI-CHANNEL DISPATCH ---
export function useAdminNotifications(enabled: boolean) {
  const firebaseAuthUid = useFirebaseAuthUid();
  const [items, setItems] = useState<UserNotificationItem[]>([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !firebaseAuthUid) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const q = query(collection(db, "user_notifications"), limit(120));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: UserNotificationItem[] = snap.docs.map((d) =>
          mapDocToNotificationItem(d.id, d.data())
        );
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setItems(list);
        setLoading(false);
      },
      (err) => {
        setError(mapNotificationPermissionError(err));
        setLoading(false);
      }
    );

    return () => unsub();
  }, [enabled, firebaseAuthUid]);

  return { items, loading, error };
}

const LOCAL_DELIVERIES_CACHE = "sn_notif_deliveries_v1";

function readLocalDeliveries(): NotificationDeliveryRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_DELIVERIES_CACHE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function writeLocalDeliveries(list: NotificationDeliveryRecord[]) {
  try {
    localStorage.setItem(LOCAL_DELIVERIES_CACHE, JSON.stringify(list.slice(0, 120)));
  } catch {}
}

export function useNotificationDeliveries(enabled: boolean) {
  const firebaseAuthUid = useFirebaseAuthUid();
  const [deliveries, setDeliveries] = useState<NotificationDeliveryRecord[]>(() =>
    readLocalDeliveries()
  );
  const [loading, setLoading] = useState(Boolean(enabled));

  useEffect(() => {
    if (!enabled || !firebaseAuthUid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, "notification_deliveries"), limit(120));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: NotificationDeliveryRecord[] = snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            notification_id: String(x.notification_id || ""),
            title: String(x.title || ""),
            category: normalizeNotificationCategory(x.category),
            priority: normalizeNotificationPriority(x.priority),
            audience: normalizeNotificationAudience(x.audience, true),
            channel:
              x.channel === "web_push" || x.channel === "email" ? x.channel : "in_app",
            recipient: String(x.recipient || ""),
            status:
              x.status === "sent" || x.status === "failed" ? x.status : "queued",
            error_message: typeof x.error_message === "string" ? x.error_message : undefined,
            idempotency_key: typeof x.idempotency_key === "string" ? x.idempotency_key : undefined,
            scheduled_at: typeof x.scheduled_at === "string" ? x.scheduled_at : undefined,
            created_at: String(x.created_at || new Date().toISOString()),
            updated_at: typeof x.updated_at === "string" ? x.updated_at : undefined,
          };
        });
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setDeliveries(list);
        writeLocalDeliveries(list);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return () => unsub();
  }, [enabled, firebaseAuthUid]);

  return { deliveries, loading };
}

async function logNotificationDelivery(rec: NotificationDeliveryRecord) {
  const local = readLocalDeliveries();
  writeLocalDeliveries([rec, ...local.filter((x) => x.id !== rec.id)]);
  if (auth.currentUser) {
    await setDoc(
      doc(db, "notification_deliveries", rec.id),
      sanitizeFirestorePayload(rec)
    ).catch(() => {});
  }
}

export async function dispatchNotification(input: {
  title: string;
  message: string;
  type: UserNotificationItem["type"];
  category?: NotificationCategory;
  priority?: NotificationPriority;
  audience?: NotificationAudience;
  user_id?: string;
  target_user_ids?: string[];
  target_email?: string;
  link?: string;
  scheduled_at?: string;
  channels?: {
    in_app?: boolean;
    web_push?: boolean;
    email?: boolean;
  };
  idempotency_key?: string;
}): Promise<{
  notifId: string;
  deliveries: NotificationDeliveryRecord[];
  duplicate?: boolean;
}> {
  if (!auth.currentUser) {
    throw new Error("অনুগ্রহ করে প্রধান এডমিন হিসেবে Firebase Auth সেশনে লগইন করুন।");
  }
  const title = input.title.trim();
  const message = input.message.trim();
  if (!title || !message) {
    throw new Error("বিজ্ঞপ্তির শিরোনাম ও বিস্তারিত বার্তা আবশ্যক।");
  }

  const category = normalizeNotificationCategory(input.category);
  const priority = normalizeNotificationPriority(input.priority);
  const audience: NotificationAudience = input.audience || (input.user_id ? "specific_users" : "all_users");

  // Idempotency guard against accidental double-submission
  const idemKey = (input.idempotency_key || "").trim();
  if (idemKey) {
    try {
      const seenRaw = localStorage.getItem("sn_notif_idem_keys");
      const seen: Record<string, string> = seenRaw ? JSON.parse(seenRaw) : {};
      if (seen[idemKey]) {
        return { notifId: seen[idemKey], deliveries: [], duplicate: true };
      }
    } catch {}
  }

  const specificTargets = Array.from(
    new Set(
      [
        ...(input.target_user_ids || []),
        ...(input.user_id ? input.user_id.split(/[\s,]+/) : []),
      ]
        .map((x) => x.trim())
        .filter(Boolean)
    )
  );

  if (audience === "specific_users" && specificTargets.length === 0) {
    throw new Error("নির্দিষ্ট ব্যবহারকারীর কমপক্ষে একটি UID লিখুন।");
  }

  const useInApp = input.channels?.in_app !== false;
  const useWebPush = Boolean(input.channels?.web_push);
  const useEmail = Boolean(input.channels?.email);

  const nowIso = new Date().toISOString();
  const isFutureScheduled = Boolean(
    input.scheduled_at && new Date(input.scheduled_at).getTime() > Date.now()
  );
  const status: NotificationStatus = isFutureScheduled ? "queued" : "sent";
  const selectedChannels: Array<"in_app" | "web_push" | "email"> = [
    ...(useInApp ? (["in_app"] as const) : []),
    ...(useWebPush ? (["web_push"] as const) : []),
    ...(useEmail ? (["email"] as const) : []),
  ];

  const baseId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const isGlobalBroadcast = audience !== "specific_users";

  const createdDeliveries: NotificationDeliveryRecord[] = [];

  if (useInApp) {
    if (isGlobalBroadcast) {
      const cleanPayload = sanitizeFirestorePayload({
        id: baseId,
        is_global: true,
        title: title.slice(0, 200),
        message: message.slice(0, 1500),
        type: input.type || "info",
        category,
        priority,
        audience,
        ...(input.scheduled_at ? { scheduled_at: input.scheduled_at } : {}),
        status,
        ...(idemKey ? { idempotency_key: idemKey.slice(0, 100) } : {}),
        channels: selectedChannels,
        created_by: auth.currentUser.email || auth.currentUser.uid,
        ...(input.link?.trim() ? { link: input.link.trim().slice(0, 500) } : {}),
        read: false,
        created_at: nowIso,
      });
      await setDoc(doc(db, "user_notifications", baseId), cleanPayload);
      const rec: NotificationDeliveryRecord = {
        id: `del_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        notification_id: baseId,
        title: title.slice(0, 150),
        category,
        priority,
        audience,
        channel: "in_app",
        recipient: audience,
        status: isFutureScheduled ? "queued" : "sent",
        ...(idemKey ? { idempotency_key: idemKey } : {}),
        ...(input.scheduled_at ? { scheduled_at: input.scheduled_at } : {}),
        created_at: nowIso,
      };
      await logNotificationDelivery(rec);
      createdDeliveries.push(rec);
    } else {
      for (const uid of specificTargets) {
        const safeSub = uid.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32);
        const docId = specificTargets.length === 1 ? baseId : `${baseId}_${safeSub}`;
        const cleanPayload = sanitizeFirestorePayload({
          id: docId,
          is_global: false,
          user_id: uid,
          title: title.slice(0, 200),
          message: message.slice(0, 1500),
          type: input.type || "info",
          category,
          priority,
          audience: "specific_users",
          ...(input.scheduled_at ? { scheduled_at: input.scheduled_at } : {}),
          status,
          ...(idemKey ? { idempotency_key: idemKey.slice(0, 100) } : {}),
          channels: selectedChannels,
          created_by: auth.currentUser.email || auth.currentUser.uid,
          ...(input.link?.trim() ? { link: input.link.trim().slice(0, 500) } : {}),
          read: false,
          created_at: nowIso,
        });
        await setDoc(doc(db, "user_notifications", docId), cleanPayload);
        const rec: NotificationDeliveryRecord = {
          id: `del_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          notification_id: docId,
          title: title.slice(0, 150),
          category,
          priority,
          audience: "specific_users",
          channel: "in_app",
          recipient: uid,
          status: isFutureScheduled ? "queued" : "sent",
          ...(idemKey ? { idempotency_key: idemKey } : {}),
          ...(input.scheduled_at ? { scheduled_at: input.scheduled_at } : {}),
          created_at: nowIso,
        };
        await logNotificationDelivery(rec);
        createdDeliveries.push(rec);
      }
    }
  }

  // Honest Web Push logging (client browser cannot push to remote sleeping browsers without a VAPID server push key)
  if (useWebPush) {
    const pushRec: NotificationDeliveryRecord = {
      id: `del_push_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      notification_id: baseId,
      title: title.slice(0, 150),
      category,
      priority,
      audience,
      channel: "web_push",
      recipient: audience === "specific_users" ? specificTargets.join(", ") : audience,
      status: isFutureScheduled ? "queued" : "failed",
      error_message: isFutureScheduled
        ? undefined
        : "সার্ভার Web Push (VAPID Private Key) কনফিগার করা নেই — শুধুমাত্র সক্রিয় ইন-অ্যাপ ব্রাউজার সেশনে নোটিফিকেশন পৌঁছাবে।",
      ...(idemKey ? { idempotency_key: idemKey } : {}),
      ...(input.scheduled_at ? { scheduled_at: input.scheduled_at } : {}),
      created_at: nowIso,
    };
    await logNotificationDelivery(pushRec);
    createdDeliveries.push(pushRec);
  }

  // Honest Email delivery via /api/notifications/send-email
  if (useEmail) {
    const emailTargets = (input.target_email || "")
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    if (emailTargets.length === 0) {
      const failRec: NotificationDeliveryRecord = {
        id: `del_mail_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        notification_id: baseId,
        title: title.slice(0, 150),
        category,
        priority,
        audience,
        channel: "email",
        recipient: "উল্লেখ করা হয়নি",
        status: "failed",
        error_message: "ইমেইল পাঠানোর জন্য সঠিক প্রাপক ইমেইল ঠিকানা দেওয়া হয়নি।",
        created_at: nowIso,
      };
      await logNotificationDelivery(failRec);
      createdDeliveries.push(failRec);
    } else if (isFutureScheduled) {
      for (const toEmail of emailTargets) {
        const qRec: NotificationDeliveryRecord = {
          id: `del_mail_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          notification_id: baseId,
          title: title.slice(0, 150),
          category,
          priority,
          audience,
          channel: "email",
          recipient: toEmail,
          status: "queued",
          scheduled_at: input.scheduled_at,
          created_at: nowIso,
        };
        await logNotificationDelivery(qRec);
        createdDeliveries.push(qRec);
      }
    } else {
      for (const toEmail of emailTargets) {
        let emailStatus: "sent" | "failed" = "failed";
        let emailErr: string | undefined;
        try {
          const resp = await fetch("/api/notifications/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: toEmail,
              subject: `[${category}] ${title}`,
              text: `${message}${input.link ? `\n\nবিস্তারিত: ${input.link}` : ""}`,
              category,
              priority,
              link: input.link,
            }),
          });
          const data = (await resp.json().catch(() => ({}))) as {
            ok?: boolean;
            delivered?: boolean;
            reason?: string;
            error?: string;
          };
          if (resp.ok && data.ok && data.delivered) {
            emailStatus = "sent";
          } else {
            emailErr =
              data.reason ||
              data.error ||
              "ইমেইল গেটওয়ে (SMTP/Resend API) কনফিগার করা নেই";
          }
        } catch (err: any) {
          emailErr = err?.message || "ইমেইল সার্ভার সংযোগ ব্যর্থ হয়েছে";
        }
        const mRec: NotificationDeliveryRecord = {
          id: `del_mail_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          notification_id: baseId,
          title: title.slice(0, 150),
          category,
          priority,
          audience,
          channel: "email",
          recipient: toEmail,
          status: emailStatus,
          ...(emailErr ? { error_message: emailErr } : {}),
          created_at: nowIso,
        };
        await logNotificationDelivery(mRec);
        createdDeliveries.push(mRec);
      }
    }
  }

  if (idemKey) {
    try {
      const seenRaw = localStorage.getItem("sn_notif_idem_keys");
      const seen: Record<string, string> = seenRaw ? JSON.parse(seenRaw) : {};
      seen[idemKey] = baseId;
      localStorage.setItem("sn_notif_idem_keys", JSON.stringify(seen));
    } catch {}
  }

  return { notifId: baseId, deliveries: createdDeliveries };
}

export async function retryNotificationDelivery(
  rec: NotificationDeliveryRecord,
  messageBody?: string
): Promise<{ ok: boolean; error?: string }> {
  if (rec.channel !== "email") {
    return {
      ok: false,
      error: "শুধুমাত্র ইমেইল ডেলিভারি পুনরায় চেষ্টা (Retry) করা সম্ভব।",
    };
  }
  const resp = await fetch("/api/notifications/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: rec.recipient,
      subject: `[${rec.category}] ${rec.title}`,
      text: messageBody || rec.title,
      category: rec.category,
      priority: rec.priority,
    }),
  });
  const data = (await resp.json().catch(() => ({}))) as {
    ok?: boolean;
    delivered?: boolean;
    reason?: string;
    error?: string;
  };
  const updated: NotificationDeliveryRecord = {
    ...rec,
    status: resp.ok && data.ok && data.delivered ? "sent" : "failed",
    error_message:
      resp.ok && data.ok && data.delivered
        ? undefined
        : data.reason || data.error || "ইমেইল গেটওয়ে কনফিগার করা নেই",
    updated_at: new Date().toISOString(),
  };
  await logNotificationDelivery(updated);
  return {
    ok: updated.status === "sent",
    error: updated.error_message,
  };
}

export async function createAdminNotification(input: {
  title: string;
  message: string;
  type: UserNotificationItem["type"];
  is_global: boolean;
  user_id?: string;
  link?: string;
  category?: NotificationCategory;
  priority?: NotificationPriority;
}) {
  const res = await dispatchNotification({
    title: input.title,
    message: input.message,
    type: input.type,
    category: input.category,
    priority: input.priority,
    audience: input.is_global ? "all_users" : "specific_users",
    user_id: input.user_id,
    link: input.link,
    channels: { in_app: true },
  });
  return res.notifId;
}

export async function deleteAdminNotification(notifId: string) {
  if (!auth.currentUser) {
    throw new Error("অনুমতি নেই।");
  }
  await deleteDoc(doc(db, "user_notifications", notifId));
}

// Standalone Helper Functions & Aliases
export type ComplaintItem = ComplaintTrackingItem;

export async function updateInstitution(id: string, patch: Partial<Institution>) {
  const docRef = doc(db, "institutions", id);
  const cleanPatch = sanitizeFirestorePayload({
    ...patch,
    updated_at: new Date().toISOString(),
  });
  await setDoc(docRef, cleanPatch, { merge: true });
}

export async function deleteInstitution(id: string) {
  const docRef = doc(db, "institutions", id);
  await deleteDoc(docRef);
}

export async function updateJobCircular(id: string, patch: Partial<JobCircular>) {
  const docRef = doc(db, "job_circulars", id);
  const cleanPatch = sanitizeFirestorePayload({
    ...patch,
    updated_at: new Date().toISOString(),
  });
  await setDoc(docRef, cleanPatch, { merge: true });
}

export async function deleteJobCircular(id: string) {
  const docRef = doc(db, "job_circulars", id);
  await deleteDoc(docRef);
}

export async function updateComplaintStatus(
  id: string,
  newStatus: ComplaintStatus,
  adminRemarks?: string,
  adminName?: string
) {
  const docRef = doc(db, "complaint_tracking", id);
  const snap = await getDoc(docRef);
  const now = new Date().toISOString();
  const existingHistory = snap.exists() ? (snap.data().status_history || []) : [];
  const cleanPatch = sanitizeFirestorePayload({
    status: newStatus,
    admin_remarks: adminRemarks || undefined,
    updated_at: now,
    status_history: [
      ...existingHistory,
      {
        status: newStatus,
        updated_at: now,
        note: adminRemarks
          ? `${adminName ? `[${adminName}] ` : ""}${adminRemarks}`
          : `স্ট্যাটাস হালনাগাদ: ${newStatus}`,
      },
    ],
  });
  await setDoc(docRef, cleanPatch, { merge: true });
}

export async function toggleUserFavorite(
  userId: string,
  item: {
    targetId?: string;
    target_id?: string;
    targetType?: "institution" | "job" | "service";
    target_type?: "institution" | "job" | "service";
    title?: string;
    subtitle?: string;
    link?: string;
  }
) {
  const liveUid = auth.currentUser?.uid;
  if (!liveUid || liveUid !== userId) {
    throw new Error("প্রিয় তালিকায় যোগ করতে দয়া করে আপনার অ্যাকাউন্টে পুনরায় লগইন করুন।");
  }
  const targetId = String(item.targetId || item.target_id || "fav_item")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 60);
  const favDocId = `${liveUid}_${targetId}`.slice(0, 128);
  const docRef = doc(db, "user_favorites", favDocId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    await deleteDoc(docRef);
  } else {
    await setDoc(
      docRef,
      sanitizeFirestorePayload({
        id: favDocId,
        user_id: liveUid,
        target_id: item.targetId || item.target_id || "fav_item",
        target_type: item.targetType || item.target_type || "service",
        title: item.title || "সংরক্ষিত আইটেম",
        subtitle: item.subtitle || undefined,
        link: item.link || "/directory",
        created_at: new Date().toISOString(),
      })
    );
  }
}

export async function markNotificationRead(userId: string, notifId: string) {
  const existingLocal = readLocalReadIds(userId);
  if (!existingLocal.includes(notifId)) {
    try {
      localStorage.setItem(
        getLocalReadStorageKey(userId),
        JSON.stringify([...existingLocal, notifId])
      );
    } catch {}
  }

  const liveUid = auth.currentUser?.uid;
  if (!liveUid || liveUid !== userId) return;

  const docRef = doc(db, "user_notifications", notifId);
  const snap = await getDoc(docRef).catch(() => null);
  if (!snap?.exists()) return;
  const data = snap.data();
  if (!data.is_global && data.user_id === liveUid) {
    await updateDoc(docRef, { read: true, updated_at: new Date().toISOString() }).catch(() => {});
  } else if (data.is_global) {
    await setDoc(
      doc(db, "users", liveUid, "notification_reads", notifId),
      {
        notif_id: notifId,
        user_id: liveUid,
        read_at: new Date().toISOString(),
      },
      { merge: true }
    ).catch(() => {});
  }
}

export async function markAllNotificationsRead(userId: string) {
  const liveUid = auth.currentUser?.uid;
  if (!liveUid || liveUid !== userId) return;
  try {
    const qUser = query(collection(db, "user_notifications"), where("user_id", "==", liveUid));
    const snapUser = await getDocs(qUser);
    const userPromises = snapUser.docs.map((d) =>
      updateDoc(d.ref, { read: true, updated_at: new Date().toISOString() }).catch(() => {})
    );
    const qGlobal = query(collection(db, "user_notifications"), where("is_global", "==", true), limit(30));
    const snapGlobal = await getDocs(qGlobal);
    const globalPromises = snapGlobal.docs.map((d) =>
      setDoc(
        doc(db, "users", liveUid, "notification_reads", d.id),
        {
          notif_id: d.id,
          user_id: liveUid,
          read_at: new Date().toISOString(),
        },
        { merge: true }
      ).catch(() => {})
    );
    await Promise.all([...userPromises, ...globalPromises]);
  } catch {}
}


