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
import { db, auth } from "@/lib/firebase";
import { sanitizeFirestorePayload } from "@/lib/store";

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

export interface UserNotificationItem {
  id: string;
  user_id?: string; // empty means global broadcast
  is_global: boolean;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "status_update";
  link?: string;
  read: boolean;
  created_at: string;
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

  useEffect(() => {
    if (!userId) {
      setFavorites([]);
      return;
    }

    setLoading(true);
    const q = query(collection(db, "user_favorites"), where("user_id", "==", userId));
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
  }, [userId]);

  const toggleFavorite = useCallback(
    async (item: { target_id: string; target_type: "institution" | "job" | "service"; title: string; subtitle?: string; link: string }) => {
      if (!userId) {
        throw new Error("প্রিয় তালিকায় যোগ করতে দয়া করে লগইন করুন।");
      }
      const existing = favorites.find((f) => f.target_id === item.target_id);
      if (existing) {
        await deleteDoc(doc(db, "user_favorites", existing.id));
      } else {
        const id = `fav-${userId}-${item.target_id}`;
        await setDoc(
          doc(db, "user_favorites", id),
          sanitizeFirestorePayload({
            id,
            user_id: userId,
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
export function useUserNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<UserNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Listen to global notifications and user specific
    const q = query(collection(db, "user_notifications"), orderBy("created_at", "desc"), limit(50));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: UserNotificationItem[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (data.is_global || (userId && data.user_id === userId)) {
            list.push({
              id: d.id,
              user_id: data.user_id,
              is_global: Boolean(data.is_global),
              title: String(data.title || ""),
              message: String(data.message || ""),
              type: data.type || "info",
              link: data.link,
              read: Boolean(data.read),
              created_at: String(data.created_at || new Date().toISOString()),
            });
          }
        });
        setNotifications(list);
        setUnreadCount(list.filter((n) => !n.read).length);
      },
      () => {}
    );
    return () => unsub();
  }, [userId]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await updateDoc(doc(db, "user_notifications", id), { read: true });
    } catch {}
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead,
  };
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
  const targetId = item.targetId || item.target_id || "fav_item";
  const favDocId = `${userId}_${targetId}`;
  const docRef = doc(db, "user_favorites", favDocId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    await deleteDoc(docRef);
  } else {
    await setDoc(
      docRef,
      sanitizeFirestorePayload({
        id: favDocId,
        user_id: userId,
        target_id: targetId,
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
  const docRef = doc(db, "user_notifications", notifId);
  await setDoc(docRef, { read: true, updated_at: new Date().toISOString() }, { merge: true });
}

export async function markAllNotificationsRead(userId: string) {
  try {
    const q = query(collection(db, "user_notifications"));
    const snap = await getDocs(q);
    const batchPromises = snap.docs.map((d) =>
      setDoc(d.ref, { read: true, updated_at: new Date().toISOString() }, { merge: true })
    );
    await Promise.all(batchPromises);
  } catch {}
}

