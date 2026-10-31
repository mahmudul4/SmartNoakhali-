export interface CategoryFormField {
  key: string;
  label: string;
  placeholder?: string;
  type: "text" | "number" | "select" | "textarea";
  options?: string[];
  required?: boolean;
  help?: string;
}

export interface CategoryFormSchema {
  formType: string;
  nameLabel: string;
  namePlaceholder: string;
  fields: CategoryFormField[];
}

export const CATEGORY_FORM_SCHEMAS: Record<string, CategoryFormSchema> = {
  // ২. কেনাকাটা ও অনলাইন শপ
  shopping: {
    formType: "shopping",
    nameLabel: "দোকান বা ব্যবসা প্রতিষ্ঠানের নাম *",
    namePlaceholder: "যেমন: নোয়াখালী ফ্যাশন গ্যালারি",
    fields: [
      { key: "product_name", label: "প্রধান পণ্যের নাম / ধরন", placeholder: "যেমন: সুতি শাড়ি, থ্রি-পিস, জুতা", type: "text", required: true },
      { key: "brand", label: "ব্র্যান্ড বা প্রস্তুতকারক", placeholder: "যেমন: নিজস্ব ব্র্যান্ড / বাটা / স্যামসাং", type: "text" },
      { key: "price", label: "মূল্য বা মূল্যসীমা (টাকা)", placeholder: "যেমন: ৫০০ - ২০০০ টাকা", type: "text" },
      { key: "stock_status", label: "স্টক ও প্রাপ্যতা", type: "select", options: ["স্টকে আছে (In Stock)", "অর্ডার সাপেক্ষে প্রস্তুত", "সীমিত স্টক"], required: true },
      { key: "home_delivery", label: "হোম ডেলিভারি সুবিধা", type: "select", options: ["হ্যাঁ — সমগ্র নোয়াখালী", "হ্যাঁ — সারা বাংলাদেশ", "না — শুধু শোরুম থেকে সংগ্রহ"] },
      { key: "market_address", label: "মার্কেট বা দোকানের পূর্ণ ঠিকানা", placeholder: "যেমন: টাউন হল মোড়, প্রধান সড়ক, মাইজদী", type: "text", required: true },
    ],
  },

  // ৩. খাবার ও রেস্টুরেন্ট
  food: {
    formType: "food",
    nameLabel: "রেস্টুরেন্ট বা খাবারের প্রতিষ্ঠানের নাম *",
    namePlaceholder: "যেমন: ফুড প্যালেস রেস্তোরাঁ",
    fields: [
      { key: "cuisine_type", label: "খাবারের ধরন / স্পেশালিটি", placeholder: "যেমন: ঐতিহ্যবাহী বিরিয়ানি, বাংলা খাবার, ফাস্টফুড", type: "text", required: true },
      { key: "popular_items", label: "জনপ্রিয় বা প্রধান মেনু তালিকা", placeholder: "যেমন: কাচ্চি বিরিয়ানি, গ্রিল চিকেন, দই", type: "textarea", required: true },
      { key: "price_range", label: "গড় খরচ / মূল্যসীমা", placeholder: "যেমন: ১৫০ - ৫০০ টাকা প্রতি জন", type: "text" },
      { key: "opening_hours", label: "খোলার সময়সূচি", placeholder: "যেমন: সকাল ১০টা থেকে রাত ১১টা", type: "text", required: true },
      { key: "delivery_facility", label: "হোম ডেলিভারি সুবিধা", type: "select", options: ["হ্যাঁ — হোম ডেলিভারি আছে", "না — শুধুমাত্র ডাইন-ইন ও টেক-অ্যাওয়ে"] },
    ],
  },

  // ৪. স্বাস্থ্য ও চিকিৎসা — ডাক্তার
  doctor: {
    formType: "doctor",
    nameLabel: "চিকিৎসক / বিশেষজ্ঞের পূর্ণ নাম *",
    namePlaceholder: "যেমন: ডা. মোঃ রফিকুল ইসলাম",
    fields: [
      { key: "degrees", label: "ডিগ্রি ও শিক্ষাগত যোগ্যতা", placeholder: "যেমন: এমবিবিএস, এফসিপিএস (মেডিসিন)", type: "text", required: true },
      { key: "specialization", label: "বিশেষজ্ঞতা / বিভাগ", placeholder: "যেমন: হৃদরোগ, শিশু বিশেষজ্ঞ, চর্ম ও যৌন", type: "text", required: true },
      { key: "hospital_attached", label: "বর্তমান কর্মস্থল বা হাসপাতাল", placeholder: "যেমন: নোয়াখালী ২৫০ শয্যা জেনারেল হাসপাতাল", type: "text" },
      { key: "chamber_address", label: "চেম্বার / রোগী দেখার স্থান", placeholder: "যেমন: পপুলার ডায়াগনস্টিক সেন্টার, মাইজদী", type: "text", required: true },
      { key: "visiting_schedule", label: "রোগী দেখার সময়সূচি", placeholder: "যেমন: শনি থেকে বৃহস্পতি (বিকাল ৪টা - রাত ৯টা)", type: "text", required: true },
      { key: "consultation_fee", label: "পরামর্শ ফি (টাকা)", placeholder: "যেমন: ৫০০ টাকা (নতুন), ৩০০ টাকা (পুরাতন)", type: "text" },
      { key: "serial_phone", label: "সিরিয়াল বা অ্যাপয়েন্টমেন্টের ফোন নম্বর", placeholder: "যেমন: 018XXXXXXXX", type: "text", required: true },
    ],
  },

  // ৪. স্বাস্থ্য ও চিকিৎসা — হাসপাতাল ও ক্লিনিক
  hospital: {
    formType: "hospital",
    nameLabel: "হাসপাতাল বা ক্লিনিকের নাম *",
    namePlaceholder: "যেমন: নোয়াখালী প্রাইম হাসপাতাল",
    fields: [
      { key: "facility_type", label: "প্রতিষ্ঠানের ধরন", type: "select", options: ["সরকারি হাসপাতাল", "বেসরকারি হাসপাতাল", "ক্লিনিক ও নার্সিং হোম", "ডেন্টাল ক্লিনিক", "আই হসপিটাল"], required: true },
      { key: "emergency_service", label: "জরুরি সেবা (২৪ ঘণ্টা)", type: "select", options: ["হ্যাঁ — ২৪ ঘণ্টা চালু", "না — নির্দিষ্ট সময়"], required: true },
      { key: "icu_ambulance", label: "আইসিইউ ও অ্যাম্বুলেন্স সুবিধা", type: "select", options: ["আইসিইউ ও অ্যাম্বুলেন্স দুটোই আছে", "শুধু অ্যাম্বুলেন্স আছে", "কোনোটিই নেই"] },
      { key: "specialties", label: "প্রধান বিভাগসমূহ ও বিশেষ সেবা", placeholder: "যেমন: গাইনি, সার্জারি, মেডিসিন, ল্যাবরেটরি", type: "textarea" },
    ],
  },

  // ৪. স্বাস্থ্য ও চিকিৎসা — ডায়াগনস্টিক ও পরীক্ষা
  medical: {
    formType: "medical",
    nameLabel: "ডায়াগনস্টিক বা স্বাস্থ্যসেবা কেন্দ্রের নাম *",
    namePlaceholder: "যেমন: নোয়াখালী ডিজিটাল প্যাথলজি",
    fields: [
      { key: "test_facilities", label: "উপলব্ধ টেস্ট ও পরীক্ষা-নিরীক্ষা", placeholder: "যেমন: রক্ত পরীক্ষা, এক্স-রে, আল্ট্রাসনোগ্রাম, সিটি স্ক্যান", type: "textarea", required: true },
      { key: "report_delivery", label: "রিপোর্ট পাওয়ার সময়", placeholder: "যেমন: একই দিনে সন্ধ্যায় / ২৪ ঘণ্টার মধ্যে", type: "text" },
      { key: "sample_collection", label: "হোম স্যাম্পল কালেকশন সুবিধা", type: "select", options: ["হ্যাঁ — বাসায় গিয়ে স্যাম্পল নেওয়া হয়", "না — সেন্টারে আসতে হবে"] },
    ],
  },

  // ৫. শিক্ষা ও প্রশিক্ষণ
  education: {
    formType: "education",
    nameLabel: "শিক্ষা বা প্রশিক্ষণ প্রতিষ্ঠানের নাম *",
    namePlaceholder: "যেমন: নোয়াখালী বিজ্ঞান ও প্রযুক্তি একাডেমি",
    fields: [
      { key: "institution_type", label: "প্রতিষ্ঠানের ধরন", type: "select", options: ["স্কুল", "কলেজ", "মাদ্রাসা", "কোচিং সেন্টার", "কারিগরি ও আইটি", "ভাষা শিক্ষা", "লাইব্রেরি"], required: true },
      { key: "course_class", label: "শ্রেণি বা কোর্সের বিবরণ", placeholder: "যেমন: ষষ্ঠ-দ্বাদশ শ্রেণি / গ্রাফিক্স ডিজাইন / স্পোকেন ইংলিশ", type: "text", required: true },
      { key: "admission_eligibility", label: "ভর্তির যোগ্যতা ও মেয়াদ", placeholder: "যেমন: এসএসসির পর / ৩ মাসের কোর্স", type: "text" },
      { key: "fees_structure", label: "কোর্স ফি / বেতন", placeholder: "যেমন: মাসিক ১০০০ টাকা / সম্পূর্ণ কোর্স ৩০০০ টাকা", type: "text" },
      { key: "class_timing", label: "ক্লাসের সময়সূচি", placeholder: "যেমন: সকাল ৯টা - দুপুর ১টা / সান্ধ্যকালীন ব্যাচ", type: "text" },
    ],
  },

  // ৬. চাকরি ও ক্যারিয়ার
  job: {
    formType: "job",
    nameLabel: "নিয়োগকারী প্রতিষ্ঠান বা কোম্পানির নাম *",
    namePlaceholder: "যেমন: নোয়াখালী এগ্রো লিমিটেড",
    fields: [
      { key: "job_title", label: "পদের নাম / পদবি *", placeholder: "যেমন: সেলস এক্সিকিউটিভ / কম্পিউটার অপারেটর", type: "text", required: true },
      { key: "employment_type", label: "চাকরির ধরন", type: "select", options: ["ফুল-টাইম", "পার্ট-টাইম", "সরকারি", "চুক্তিভিত্তিক", "ইন্টার্নশিপ", "রিমোট / বাসা থেকে"], required: true },
      { key: "educational_req", label: "শিক্ষাগত যোগ্যতা ও অভিজ্ঞতা", placeholder: "যেমন: এইচএসসি / স্নাতক পাস, ১ বছরের অভিজ্ঞতা", type: "text", required: true },
      { key: "salary_range", label: "বেতন / সম্মানী (টাকা)", placeholder: "যেমন: ১৫,০০০ - ২০,০০০ টাকা", type: "text", required: true },
      { key: "job_location", label: "কর্মস্থল / ডিউটি এলাকা", placeholder: "যেমন: মাইজদী কোর্ট, সদর, নোয়াখালী", type: "text", required: true },
      { key: "deadline", label: "আবেদনের শেষ তারিখ", placeholder: "যেমন: ১৫ নভেম্বর ২০২৬", type: "text", required: true },
      { key: "apply_instruction", label: "আবেদনের মাধ্যম / সিভি পাঠানোর ঠিকানা", placeholder: "যেমন: সরাসরি যোগাযোগ করুন অথবা cv@company.com এ পাঠান", type: "textarea", required: true },
    ],
  },

  // ৮. বাসা, জমি ও আবাসন
  realestate: {
    formType: "realestate",
    nameLabel: "বিজ্ঞাপন বা প্রপার্টির শিরোনাম *",
    namePlaceholder: "যেমন: ৩ রুমের নতুন ফ্ল্যাট ভাড়া দেওয়া হবে",
    fields: [
      { key: "property_category", label: "বিজ্ঞাপনের ধরন", type: "select", options: ["বাসা / ফ্ল্যাট ভাড়া", "বাড়ি বিক্রি", "জমি বিক্রি", "দোকান / অফিস ভাড়া", "হোস্টেল / মেস সিট", "নির্মাণ ও সংস্কার সেবা"], required: true },
      { key: "property_size", label: "আয়তন / সাইজ", placeholder: "যেমন: ১২৫০ বর্গফুট / ৫ শতক জমি / ৩ রুমের বাসা", type: "text", required: true },
      { key: "price_rent", label: "ভাড়া বা বিক্রয় মূল্য (টাকা)", placeholder: "যেমন: মাসিক ১২,০০০ টাকা / মোট ৫০ লাখ টাকা", type: "text", required: true },
      { key: "floor_facilities", label: "তলা ও সুযোগ-সুবিধা", placeholder: "যেমন: ৩য় তলা, গ্যাস, বিদ্যুৎ, সার্বক্ষণিক পানি, লিফট ও গ্যারেজ", type: "textarea", required: true },
      { key: "availability_date", label: "কবে থেকে পাওয়া যাবে", placeholder: "যেমন: চলতি মাস থেকে / আগামী ১ তারিখ থেকে", type: "text" },
    ],
  },

  // ৯. পরিবহন ও যানবাহন
  transport: {
    formType: "transport",
    nameLabel: "যানবাহন বা পরিবহন সার্ভিসের নাম *",
    namePlaceholder: "যেমন: হিমাচল এক্সপ্রেস / আল-বারাকা রেন্ট-এ-কার",
    fields: [
      { key: "vehicle_type", label: "যানবাহনের ধরন", type: "select", options: ["বাস সার্ভিস ও কাউন্টার", "রেন্ট-এ-কার / মাইক্রোবাস", "প্রাইভেট কার", "ট্রাক ও পিকআপ", "মোটরসাইকেল সেবা", "সিএনজি ও অটোরিকশা", "অ্যাম্বুলেন্স", "কুরিয়ার ও পার্সেল"], required: true },
      { key: "travel_route", label: "চলাচলের রুট / সেবা এলাকা", placeholder: "যেমন: নোয়াখালী - ঢাকা / নোয়াখালী - চট্টগ্রাম / স্থানীয় রুট", type: "text", required: true },
      { key: "fare_cost", label: "ভাড়া বা বুকিং খরচ", placeholder: "যেমন: টিকিট ৫৫০ টাকা / দৈনিক ভাড়া ৩৫০০ টাকা", type: "text" },
      { key: "departure_schedule", label: "ছাড়ার সময় ও কাউন্টার", placeholder: "যেমন: সকাল ৬টা থেকে রাত ১২টা পর্যন্ত প্রতি ঘণ্টায়", type: "text" },
      { key: "contact_driver", label: "ড্রাইভার বা কাউন্টারের সরাসরি ফোন", placeholder: "যেমন: 018XXXXXXXX", type: "text", required: true },
    ],
  },

  // ১০. পর্যটন ও ভ্রমণ
  tourism: {
    formType: "tourism",
    nameLabel: "দর্শনীয় স্থান, হোটেল বা ট্যুর এজেন্সির নাম *",
    namePlaceholder: "যেমন: নিঝুম দ্বীপ রিসোর্ট / বজরা শাহী মসজিদ",
    fields: [
      { key: "tourism_type", label: "ক্যাটাগরি", type: "select", options: ["দর্শনীয় স্থান ও পার্ক", "আবাসিক হোটেল ও রিসোর্ট", "ভ্রমণ প্যাকেজ ও ট্যুর গাইড", "ঐতিহাসিক স্থান ও ঐতিহ্য"], required: true },
      { key: "location_spot", label: "সঠিক অবস্থান ও যাওয়ার উপায়", placeholder: "যেমন: হাতিয়া, নিঝুম দ্বীপ (মাইজদী থেকে বাস ও ট্রলারে)", type: "text", required: true },
      { key: "attractions_facilities", label: "প্রধান আকর্ষণ ও সুযোগ-সুবিধা", placeholder: "যেমন: চিত্রা হরিণ, সূর্যাস্ত, এসি/নন-এসি রুম, সার্বক্ষণিক গাইড", type: "textarea", required: true },
      { key: "ticket_room_cost", label: "প্রবেশ ফি / রুম ভাড়া / প্যাকেজ খরচ", placeholder: "যেমন: জনপ্রতি ২০ টাকা / রুম ১৫০০-৩০০০ টাকা", type: "text" },
    ],
  },

  // ১১. কৃষি, মৎস্য ও প্রাণিসম্পদ
  agriculture: {
    formType: "agriculture",
    nameLabel: "ফার্ম, দোকান বা কৃষিপণ্যের নাম *",
    namePlaceholder: "যেমন: গ্রীন এগ্রো নার্সারি ও ফিশারিজ",
    fields: [
      { key: "agri_sector", label: "কৃষি খাত", type: "select", options: ["উন্নত বীজ ও চারা", "সার ও কীটনাশক", "কৃষি যন্ত্রপাতি", "মাছের পোনা ও চাষ", "গবাদিপশু ও পোল্ট্রি", "পশু চিকিৎসা ও ঔষধ", "দুগ্ধজাত পণ্য ও মিষ্টি"], required: true },
      { key: "product_variety", label: "পণ্যের জাত ও বিবরণ", placeholder: "যেমন: কলম চারা, রুই-কাতলার পোনা, উন্নত জাতের গাভী", type: "text", required: true },
      { key: "unit_price", label: "মূল্য ও একক", placeholder: "যেমন: ৫০ টাকা কেজি / ২০০ টাকা প্রতি পিস", type: "text", required: true },
      { key: "supply_capacity", label: "সরবরাহ ক্ষমতা ও ডেলিভারি", placeholder: "যেমন: পাইকারি ও খুচরা সরবরাহ সম্ভব", type: "text" },
    ],
  },

  // ১২. সরকারি ও নাগরিক সেবা
  govt: {
    formType: "govt",
    nameLabel: "সরকারি দপ্তর বা সেবা কেন্দ্রের নাম *",
    namePlaceholder: "যেমন: নোয়াখালী জেলা প্রশাসক কার্যালয় / ইউনিয়ন পরিষদ",
    fields: [
      { key: "service_title", label: "প্রদত্ত প্রধান সেবাসমূহ", placeholder: "যেমন: জন্মনিবন্ধন, নাগরিক সনদ, ভূমি খারিজ, পাসপোর্ট তথ্য", type: "textarea", required: true },
      { key: "process_steps", label: "সেবা পাওয়ার নিয়ম ও কাগজপত্র", placeholder: "যেমন: এনআইডি কপি, ছবি ও অনলাইন আবেদনপত্র জমা দিতে হবে", type: "textarea" },
      { key: "official_fee", label: "সরকারি ফি (যদি প্রযোজ্য হয়)", placeholder: "যেমন: সরকারি নির্ধারিত ফি ৫০ টাকা / বিনামূল্যে", type: "text" },
      { key: "official_website", label: "অফিসিয়াল ওয়েবসাইট / অনলাইন লিংক", placeholder: "যেমন: https://noakhali.gov.bd", type: "text" },
      { key: "officer_in_charge", label: "দায়িত্বপ্রাপ্ত কর্মকর্তা / পদবি", placeholder: "যেমন: উপজেলা নির্বাহী কর্মকর্তা (ইউএনও)", type: "text" },
    ],
  },

  // ১৩. ধর্মীয় ও সামাজিক প্রতিষ্ঠান
  religious_social: {
    formType: "religious_social",
    nameLabel: "মসজিদ, প্রতিষ্ঠান বা সংগঠনের নাম *",
    namePlaceholder: "যেমন: বজরা শাহী মসজিদ কমপ্লেক্স / যুব কল্যাণ ফাউন্ডেশন",
    fields: [
      { key: "org_type", label: "প্রতিষ্ঠানের ধরন", type: "select", options: ["ঐতিহাসিক বা কেন্দ্রীয় মসজিদ", "মাদ্রাসা ও এতিমখানা", "মন্দির ও উপাসনালয়", "স্বেচ্ছাসেবী ও মানবিক সংগঠন", "বৃদ্ধাশ্রম ও সেবা প্রতিষ্ঠান", "কমিউনিটি সেন্টার"], required: true },
      { key: "activities_summary", label: "প্রধান কার্যক্রম ও সেবাসমূহ", placeholder: "যেমন: ৫ ওয়াক্ত নামাজ ও হেফজখানা / রক্তদান ও অসহায়দের আর্থিক সহায়তা", type: "textarea", required: true },
      { key: "leader_contact", label: "ইমাম, খতিব বা দায়িত্বশীল ব্যক্তির নাম", placeholder: "যেমন: সভাপতি / সাধারণ সম্পাদক / খতিব", type: "text" },
    ],
  },

  // ১৪. ইভেন্ট ও অনুষ্ঠান
  events: {
    formType: "events",
    nameLabel: "ইভেন্ট, স্টুডিও বা সেবা প্রদানকারীর নাম *",
    namePlaceholder: "যেমন: ড্রিম ওয়েডিং ইভেন্ট ম্যানেজমেন্ট",
    fields: [
      { key: "service_kind", label: "সেবার ধরন", type: "select", options: ["বিবাহ ও রিসেপশন আয়োজন", "জন্মদিন ও পারিবারিক অনুষ্ঠান", "স্টেজ ও লাইটিং ডেকোরেশন", "ওয়েডিং ও সিনেমাটোগ্রাফি", "সাংস্কৃতিক অনুষ্ঠান ও সাউন্ড সিস্টেম", "খেলাধুলা ও টুর্নামেন্ট"], required: true },
      { key: "package_details", label: "প্যাকেজ ও মূল্যের বিবরণ", placeholder: "যেমন: সম্পূর্ণ স্টেজ ডেকোরেশন ১৫,০০০ টাকা থেকে শুরু", type: "textarea", required: true },
      { key: "booking_lead_time", label: "বুকিং প্রক্রিয়া ও সময়", placeholder: "যেমন: কমপক্ষে ৭ দিন আগে অগ্রিম বুকিং করতে হবে", type: "text" },
    ],
  },

  // ১৫. বাড়ি ও ব্যক্তিগত সেবা
  home_services: {
    formType: "home_services",
    nameLabel: "মিস্ত্রি বা কারিগরের পূর্ণ নাম *",
    namePlaceholder: "যেমন: মোঃ কামাল হোসেন (ইলেকট্রিশিয়ান)",
    fields: [
      { key: "craft_trade", label: "পেশা বা কাজের ধরন", type: "select", options: ["ইলেকট্রিশিয়ান", "প্লাম্বার ও স্যানিটারি মিস্ত্রি", "এসি ও ফ্রিজ মেরামত", "কাঠমিস্ত্রি ও ফার্নিচার", "রাজমিস্ত্রি ও টাইলস", "বাড়ি ও অফিস পরিচ্ছন্নতা", "লন্ড্রি ও ড্রাইওয়াশ", "সেলুন ও হোম পার্লার", "দর্জি ও সেলাই সেবা"], required: true },
      { key: "experience_years", label: "কাজের অভিজ্ঞতা", placeholder: "যেমন: ৮ বছরের বাস্তব অভিজ্ঞতা", type: "text", required: true },
      { key: "work_area", label: "কাজের এলাকা / কাভারেজ", placeholder: "যেমন: মাইজদী, সোনাপুর ও নোয়াখালী সদর এলাকা", type: "text", required: true },
      { key: "visiting_charge", label: "ভিজিট ফি / মজুরি", placeholder: "যেমন: ভিজিট ফি ৩০০ টাকা / কাজ অনুযায়ী আলোচনা সাপেক্ষে", type: "text" },
    ],
  },

  // ১৬. প্রযুক্তি ও ডিজিটাল সেবা
  tech_digital: {
    formType: "tech_digital",
    nameLabel: "আইটি প্রতিষ্ঠান বা ফ্রিল্যান্সারের নাম *",
    namePlaceholder: "যেমন: নোয়াখালী টেক সলিউশন",
    fields: [
      { key: "tech_sector", label: "সেবার খাত", type: "select", options: ["ইন্টারনেট ও ব্রডব্যান্ড", "ওয়েবসাইট ও সফটওয়্যার তৈরি", "মোবাইল অ্যাপস ডেভেলপমেন্ট", "ডিজিটাল মার্কেটিং ও এসইও", "কম্পিউটার ও অনলাইন আবেদন", "প্রিন্ট, ফটোকপি ও স্ক্যান", "আইটি প্রশিক্ষণ ও মেন্টরিং"], required: true },
      { key: "service_features", label: "সেবা ও প্যাকেজের বিবরণ", placeholder: "যেমন: মাত্র ৭ দিনে রেসপন্সিভ ই-কমার্স ওয়েবসাইট তৈরি", type: "textarea", required: true },
      { key: "portfolio_url", label: "ওয়েবসাইট বা পোর্টফোলিও লিংক", placeholder: "যেমন: https://myportfolio.com", type: "text" },
      { key: "starting_price", label: "প্রারম্ভিক মূল্য (টাকা)", placeholder: "যেমন: প্যাকেজ ৫,০০০ টাকা থেকে শুরু", type: "text" },
    ],
  },

  // ১৭. খেলাধুলা ও বিনোদন
  sports_entertainment: {
    formType: "sports_entertainment",
    nameLabel: "ক্লাব, একাডেমি বা বিনোদন কেন্দ্রের নাম *",
    namePlaceholder: "যেমন: নোয়াখালী ক্রিকেট একাডেমি / ফিটনেস প্লাস জিম",
    fields: [
      { key: "sports_kind", label: "খেলার ধরন বা বিনোদন", type: "select", options: ["ক্রিকেট ক্লাব ও একাডেমি", "ফুটবল একাডেমি", "ব্যাডমিন্টন কোর্ট", "ফিটনেস জিম সেন্টার", "স্পোর্টস ক্লাব", "বিনোদন পার্ক ও প্লেগ্রাউন্ড"], required: true },
      { key: "coaching_schedule", label: "প্রশিক্ষণ সময়সূচি ও ব্যাচ", placeholder: "যেমন: শুক্র ও শনিবার সকাল ৭টা - ৯টা", type: "text", required: true },
      { key: "membership_fee", label: "ভর্তি ও মাসিক ফি", placeholder: "যেমন: ভর্তি ফি ১০০০ টাকা, মাসিক ৫০০ টাকা", type: "text" },
    ],
  },

  // ১৮. সংবাদ, তথ্য ও কমিউনিটি
  news_community: {
    formType: "news_community",
    nameLabel: "সংবাদ পোর্টাল, সংবাদকর্মী বা নোটিশের শিরোনাম *",
    namePlaceholder: "যেমন: নোয়াখালী প্রতিদিন / মাইজদীতে জরুরি গণবিজ্ঞপ্তি",
    fields: [
      { key: "news_category", label: "সংবাদ বা বিজ্ঞপ্তির ধরন", type: "select", options: ["স্থানীয় তাজা সংবাদ", "জরুরি ঘোষণা বা নোটিশ", "হারানো ও প্রাপ্তি বিজ্ঞপ্তি", "জরুরি রক্ত অনুসন্ধান বুলেটিন", "স্বেচ্ছাসেবক আহ্বান", "কমিউনিটি উন্নয়ন উদ্যোগ"], required: true },
      { key: "area_location", label: "ঘটনা বা সেবার এলাকা", placeholder: "যেমন: বেগমগঞ্জ, চৌমুহনী, নোয়াখালী", type: "text", required: true },
      { key: "news_details", label: "বিস্তারিত বিবরণ ও তথ্যসূত্র", placeholder: "ঘটনা বা বিজ্ঞপ্তির সম্পূর্ণ বিবরণ লিখুন...", type: "textarea", required: true },
    ],
  },

  // ১৯. নারী, শিশু ও পরিবার
  women_child: {
    formType: "women_child",
    nameLabel: "উদ্যোগ, সেবাদাতা বা প্রতিষ্ঠানের নাম *",
    namePlaceholder: "যেমন: নোয়াখালী নারী উদ্যোক্তা ফোরাম / শিশু বিকাশ কেন্দ্র",
    fields: [
      { key: "initiative_focus", label: "কার্যক্রমের মূল ক্ষেত্র", type: "select", options: ["নারী উদ্যোক্তা ও হোমমেড ব্যবসা", "নারীদের সেলাই ও কারিগরি প্রশিক্ষণ", "শিশুদের প্রাথমিক শিক্ষা ও স্বাস্থ্য", "পারিবারিক ও মানসিক কাউন্সেলিং", "মাতৃত্বকালীন ও প্রসূতি সহায়তা", "শিশু অধিকার ও সুরক্ষা কার্যক্রম"], required: true },
      { key: "services_offered", label: "সুবিধা ও সেবার বিস্তারিত বিবরণ", placeholder: "যেমন: ঘরে বসে আয়ের প্রশিক্ষণ, বিনামূল্যে প্রাথমিক চিকিৎসা পরামর্শ", type: "textarea", required: true },
      { key: "confidentiality", label: "গোপনীয়তা ও নিরাপত্তা নিশ্চয়তা", type: "select", options: ["সম্পূর্ণ গোপনীয়তা ও নিরাপদ সহায়তা", "সাধারণ উন্মুক্ত সেবা"] },
    ],
  },

  // ২০. পরিবেশ ও জনকল্যাণ
  environment_welfare: {
    formType: "environment_welfare",
    nameLabel: "প্রকল্প, সংগঠন বা অভিযানের নাম *",
    namePlaceholder: "যেমন: সবুজ নোয়াখালী বৃক্ষরোপণ কর্মসূচি",
    fields: [
      { key: "welfare_goal", label: "কর্মসূচির ধরন", type: "select", options: ["বৃক্ষরোপণ ও বনায়ন", "পরিচ্ছন্নতা অভিযান ও বর্জ্য অপসারণ", "পরিবেশ ও নদী দূষণ রোধ", "দুর্যোগকালীন প্রস্তুতি ও ত্রাণ", "স্থানীয় জনকল্যাণ প্রকল্প"], required: true },
      { key: "organizer_team", label: "পরিচালনাকারী সংগঠন বা টিম", placeholder: "যেমন: নোয়াখালী ইয়ুথ ক্লাইমেট অ্যাকশন", type: "text", required: true },
      { key: "target_outcome", label: "লক্ষ্য ও বিস্তারিত কার্যক্রম", placeholder: "যেমন: এ মৌসুমে ১০,০০০ ফলদ ও বনজ গাছ রোপণের লক্ষ্য", type: "textarea", required: true },
    ],
  },

  // ২১. পেশাজীবী ও বিশেষজ্ঞ
  professionals: {
    formType: "professionals",
    nameLabel: "পেশাজীবী বা বিশেষজ্ঞের পূর্ণ নাম *",
    namePlaceholder: "যেমন: ব্যারিস্টার তানভীর আহমেদ / প্রকৌশলী শফিকুর রহমান",
    fields: [
      { key: "profession_field", label: "পেশার ক্ষেত্র", type: "select", options: ["আইনজীবী ও অ্যাডভোকেট (জজ কোর্ট)", "চার্টার্ড অ্যাকাউন্ট্যান্ট ও অডিটর", "সিভিল ও আর্কিটেকচার ইঞ্জিনিয়ার", "শিক্ষক ও ক্যারিয়ার মেন্টর", "ব্যবসায়িক ও ট্যাক্স পরামর্শক", "আইটি বিশেষজ্ঞ"], required: true },
      { key: "qualifications", label: "শিক্ষাগত ও পেশাগত যোগ্যতা", placeholder: "যেমন: এলএলবি (অনার্স), এলএলএম (ঢাকা বিশ্ববিদ্যালয়)", type: "text", required: true },
      { key: "office_chamber", label: "চেম্বার বা অফিসের ঠিকানা", placeholder: "যেমন: জেলা আইনজীবী সমিতি ভবন, মাইজদী কোর্ট", type: "text", required: true },
      { key: "consultation_fee", label: "পরামর্শ ফি / শর্তাবলি", placeholder: "যেমন: প্রাথমিক পরামর্শ ৫০০ টাকা / আলোচনা সাপেক্ষে", type: "text" },
    ],
  },

  // ২২. অন্যান্য সেবা
  other_services: {
    formType: "other_services",
    nameLabel: "সেবা বা প্রস্তাবের নাম *",
    namePlaceholder: "যেমন: ভ্রাম্যমাণ বইমেলা / স্থানীয় বিশেষায়িত সেবা",
    fields: [
      { key: "proposed_category", label: "প্রস্তাবিত বিভাগ বা ধরন", placeholder: "যেমন: হস্তশিল্প / কমিউনিটি কার্যক্রম", type: "text", required: true },
      { key: "purpose_reason", label: "এই সেবার উদ্দেশ্য ও সুবিধা", placeholder: "নাগরিকরা কীভাবে এই সেবা থেকে উপকৃত হবেন বিস্তারিত লিখুন...", type: "textarea", required: true },
    ],
  },

  // রক্তদান সেবা (বিভাগ ৪-এর রক্তদাতা ক্যাটাগরি — সম্পূর্ণ অক্ষত)
  blood: {
    formType: "blood",
    nameLabel: "রক্তদাতার পূর্ণ নাম *",
    namePlaceholder: "যেমন: মোঃ আব্দুল্লাহ",
    fields: [
      { key: "blood_group", label: "রক্তের গ্রুপ *", type: "select", options: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"], required: true },
      { key: "last_donation_date", label: "সর্বশেষ রক্তদানের তারিখ", placeholder: "যেমন: ২০২৬-০১-১৫", type: "text" },
      { key: "total_donations", label: "মোট রক্তদানের সংখ্যা", placeholder: "যেমন: ৫", type: "number" },
    ],
  },

  // অনুদান ক্যাম্পেইন (সাধারণ, চিকিৎসা, শিক্ষা ও যাকাত)
  donation_campaign: {
    formType: "donation_campaign",
    nameLabel: "ক্যাম্পেইনের শিরোনাম *",
    namePlaceholder: "যেমন: অসহায় বৃদ্ধের জীবন রক্ষাকারী ওপেন হার্ট সার্জারি চিকিৎসা তহবিল",
    fields: [
      { key: "campaign_purpose", label: "অনুদানের মূল উদ্দেশ্য *", placeholder: "যেমন: চিকিৎসা সহায়তা / দরিদ্র মেধাবীদের ভর্তি ফি", type: "text", required: true },
      { key: "target_amount", label: "প্রয়োজনীয় অর্থ (টাকা) *", placeholder: "যেমন: ৫০,০০০", type: "number", required: true },
      { key: "campaign_dates", label: "ক্যাম্পেইনের সময়সীমা", placeholder: "যেমন: ০১ মার্চ ২০২৬ - ৩০ মার্চ ২০২৬", type: "text" },
      { key: "responsible_person", label: "দায়িত্বপ্রাপ্ত ব্যক্তির নাম ও পদবি *", placeholder: "যেমন: ডা. মিজানুর রহমান / সমন্বয়ক", type: "text", required: true },
      { key: "campaign_details", label: "বিস্তারিত বিবরণ ও পরিস্থিতি *", placeholder: "রোগীর অবস্থা বা প্রকল্পের সম্পূর্ণ বিবরণ বিস্তারিত লিখুন...", type: "textarea", required: true },
    ],
  },

  // মানবিক ও সামাজিক সহায়তা (এতিম, ত্রাণ, খাদ্য/বস্ত্র, পরিবারভিত্তিক, ধর্মীয়, সামাজিক প্রকল্প)
  humanitarian_aid: {
    formType: "humanitarian_aid",
    nameLabel: "প্রকল্প বা মানবিক কাজের নাম *",
    namePlaceholder: "যেমন: বন্যায় ক্ষতিগ্রস্ত পরিবারের মাঝে শুকনো খাবার ও বিশুদ্ধ পানি বিতরণ",
    fields: [
      { key: "aid_purpose", label: "সহায়তার উদ্দেশ্য *", placeholder: "যেমন: জরুরি ত্রাণ সহায়তা / গৃহহীন পরিবারকে ঘর নির্মাণ", type: "text", required: true },
      { key: "target_amount", label: "প্রয়োজনীয় বরাদ্দ / বাজেট (টাকা) *", placeholder: "যেমন: ১,০০,০০০", type: "number", required: true },
      { key: "quantity_unit", label: "পরিমাণ ও একক (যদি প্রযোজ্য)", placeholder: "যেমন: ৫০০ প্যাকেট / ২৫টি পরিবার", type: "text" },
      { key: "aid_date", label: "বাস্তবায়ন বা বিতরণের তারিখ", placeholder: "যেমন: ২০২৬-০৩-১৫", type: "text" },
      { key: "responsible_person", label: "দায়িত্বপ্রাপ্ত সমন্বয়কের নাম *", placeholder: "যেমন: মোঃ সাজ্জাদ হোসেন", type: "text", required: true },
      { key: "project_details", label: "প্রকল্পের বিস্তারিত বিবরণ *", placeholder: "কাজের ক্ষেত্র, উপকারভোগীদের অবস্থা ও সামগ্রিক বিবরণ লিখুন...", type: "textarea", required: true },
    ],
  },

  // সাধারণ ডিফল্ট
  general: {
    formType: "general",
    nameLabel: "নাম বা প্রতিষ্ঠানের শিরোনাম *",
    namePlaceholder: "যেমন: সেবা কেন্দ্রের নাম",
    fields: [
      { key: "service_details", label: "সেবার বিস্তারিত বিবরণ *", placeholder: "সেবা, পণ্যের বিবরণ, সুবিধা ও শর্তাবলি লিখুন...", type: "textarea", required: true },
    ],
  },
};

export function getFormSchemaForCategory(formType?: string): CategoryFormSchema {
  if (formType && CATEGORY_FORM_SCHEMAS[formType]) {
    return CATEGORY_FORM_SCHEMAS[formType];
  }
  return CATEGORY_FORM_SCHEMAS.general;
}
