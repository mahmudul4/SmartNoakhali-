import { useState, useMemo } from "react";
import {
  MapPin,
  Navigation,
  Phone,
  Building2,
  Hospital,
  GraduationCap,
  Store,
  Layers,
  Sparkles,
  ExternalLink,
  LocateFixed,
  Info,
  CheckCircle,
} from "lucide-react";
import {
  NOAKHALI_UPAZILAS,
  UPAZILA_GEO_LIST,
  useInstitutions,
  type Institution,
  type UpazilaGeoInfo,
} from "@/lib/district-platform";

// Haversine distance calculator in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function InteractiveNoakhaliMap() {
  const [selectedUpazila, setSelectedUpazila] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activePin, setActivePin] = useState<Institution | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  const { approvedInstitutions } = useInstitutions();

  // Filter institutions that have valid lat/lng
  const institutionsWithLocation = useMemo(() => {
    return approvedInstitutions.filter((item) => typeof item.lat === "number" && typeof item.lng === "number");
  }, [approvedInstitutions]);

  const filteredPins = useMemo(() => {
    return institutionsWithLocation.filter((item) => {
      const matchUpazila = selectedUpazila === "all" || item.upazila === selectedUpazila;
      const matchCategory =
        selectedCategory === "all" ||
        (selectedCategory === "hospital" && (item.category === "hospital_clinic" || item.category === "diagnostic_center")) ||
        (selectedCategory === "education" && (item.category === "education" || item.category === "training_center")) ||
        (selectedCategory === "govt" && (item.category === "office_govt" || item.category === "transport_utility")) ||
        (selectedCategory === "business" && (item.category === "shop_business" || item.category === "restaurant_hotel")) ||
        (selectedCategory === "tourist" && item.category === "tourist_spot");

      return matchUpazila && matchCategory;
    });
  }, [institutionsWithLocation, selectedUpazila, selectedCategory]);

  // Nearest services if user shared location
  const nearestServices = useMemo(() => {
    if (!userLocation) return [];
    return [...institutionsWithLocation]
      .map((item) => ({
        ...item,
        distance: calculateDistance(userLocation.lat, userLocation.lng, item.lat!, item.lng!),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  }, [institutionsWithLocation, userLocation]);

  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("আপনার ব্রাউজারে লোকেশন সুবিধা সমর্থিত নয়।");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError("লোকেশন ব্যবহারের অনুমতি প্রয়োজন। অনুগ্রহ করে ব্রাউজার সেটিংসে অনুমতি দিন।");
        } else {
          setLocationError("আপনার অবস্থান নির্ণয় করা যায়নি।");
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-primary-deep">
              <MapPin className="h-5 w-5 text-primary" /> নোয়াখালী জেলা ডিজিটাল ইন্টারেক্টিভ ম্যাপ
            </h3>
            <p className="text-xs text-muted-foreground">
              উপজেলা ও ক্যাটাগরি ফিল্টার করে গুরুত্বপূর্ণ হাসপাতাল, শিক্ষা প্রতিষ্ঠান ও সরকারি সেবা খুঁজুন।
            </p>
          </div>

          <button
            type="button"
            onClick={handleRequestLocation}
            disabled={locating}
            className="inline-flex items-center gap-1.5 self-start rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 active:scale-95 transition"
          >
            <LocateFixed className={`h-4 w-4 ${locating ? "animate-spin" : ""}`} />
            <span>{locating ? "অবস্থান যাচাই হচ্ছে..." : userLocation ? "আমার অবস্থান সক্রিয়" : "নিকটবর্তী সেবা দেখুন"}</span>
          </button>
        </div>

        {locationError && (
          <p className="mt-2 text-[11px] font-medium text-destructive">{locationError}</p>
        )}

        {/* Upazila Selector Pills */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedUpazila("all")}
            className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              selectedUpazila === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "border border-border bg-muted/40 text-foreground hover:bg-muted"
            }`}
          >
            সকল উপজেলা ({institutionsWithLocation.length})
          </button>
          {NOAKHALI_UPAZILAS.map((upz) => {
            const count = institutionsWithLocation.filter((i) => i.upazila === upz).length;
            return (
              <button
                key={upz}
                type="button"
                onClick={() => setSelectedUpazila(upz)}
                className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  selectedUpazila === upz
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "border border-border bg-muted/40 text-foreground hover:bg-muted"
                }`}
              >
                {upz} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>

        {/* Category Filter Buttons */}
        <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs">
          {[
            { id: "all", label: "সকল সেবা", icon: Layers },
            { id: "hospital", label: "হাসপাতাল ও স্বাস্থ্য", icon: Hospital },
            { id: "education", label: "শিক্ষা প্রতিষ্ঠান", icon: GraduationCap },
            { id: "govt", label: "সরকারি অফিস ও জরুরি", icon: Building2 },
            { id: "business", label: "ব্যবসা ও বাণিজ্য", icon: Store },
            { id: "tourist", label: "দর্শনীয় স্থান", icon: Sparkles },
          ].map((cat) => {
            const Icon = cat.icon;
            const isSel = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition ${
                  isSel
                    ? "bg-primary-deep text-primary-foreground font-bold"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual Vector District Map Display */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-emerald-950 via-teal-900 to-primary-deep p-4 sm:p-6 text-white shadow-elevated">
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold tracking-wide text-emerald-200">
              নোয়াখালী জেলা ম্যাপ গ্রিড • ৯টি উপজেলা
            </span>
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-mono font-medium backdrop-blur">
            {filteredPins.length} টি পয়েন্ট প্রদর্শিত
          </span>
        </div>

        {/* 9 Upazila Interactive Grid Visualizer */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 pt-2">
          {UPAZILA_GEO_LIST.map((geo) => {
            const isSelected = selectedUpazila === geo.nameBn;
            const upazilaPins = institutionsWithLocation.filter((p) => p.upazila === geo.nameBn);

            return (
              <div
                key={geo.id}
                onClick={() => {
                  setSelectedUpazila(isSelected ? "all" : geo.nameBn);
                  if (upazilaPins.length > 0) {
                    setActivePin(upazilaPins[0]);
                  }
                }}
                className={`cursor-pointer rounded-2xl p-3 border transition-all duration-200 ${
                  isSelected
                    ? "bg-white/20 border-emerald-400 ring-2 ring-emerald-400/50 scale-102 shadow-lg"
                    : "bg-white/10 border-white/15 hover:bg-white/15 hover:border-white/30"
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="font-display text-xs sm:text-sm font-bold text-white line-clamp-1">
                    {geo.nameBn}
                  </span>
                  <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-emerald-300">
                    {upazilaPins.length}টি
                  </span>
                </div>
                <p className="mt-1 text-[10.5px] text-emerald-100/80 line-clamp-1">
                  কেন্দ্র: {geo.headquarters}
                </p>

                {/* Sub pins in this Upazila */}
                {upazilaPins.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {upazilaPins.slice(0, 3).map((pin) => (
                      <button
                        key={pin.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePin(pin);
                        }}
                        className={`rounded-md px-1.5 py-0.5 text-[9.5px] truncate max-w-full font-medium transition ${
                          activePin?.id === pin.id
                            ? "bg-gold text-primary-deep font-bold"
                            : "bg-white/15 text-white hover:bg-white/25"
                        }`}
                      >
                        {pin.name}
                      </button>
                    ))}
                    {upazilaPins.length > 3 && (
                      <span className="text-[9.5px] text-emerald-200/70">
                        +{upazilaPins.length - 3} আরও
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected Pin Details Overlay Card */}
        {activePin && (
          <div className="mt-4 rounded-2xl border border-white/20 bg-black/40 p-3.5 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="font-display text-sm sm:text-base font-bold text-gold">
                    {activePin.name}
                  </h4>
                  {activePin.verified && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/20 px-2 py-0.2 text-[10px] text-emerald-300 font-bold border border-emerald-400/30">
                      <CheckCircle className="h-2.5 w-2.5" /> ভেরিফায়েড
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-white/90">{activePin.description}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-white/80">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-emerald-400" /> {activePin.address} ({activePin.upazila})
                  </span>
                  {activePin.opening_hours && (
                    <span className="text-emerald-200">সময়: {activePin.opening_hours}</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActivePin(null)}
                className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`tel:${activePin.phone}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-gold px-3.5 py-1.5 text-xs font-bold text-primary-deep shadow-sm hover:opacity-90 active:scale-95 transition"
              >
                <Phone className="h-3.5 w-3.5" /> কল করুন: {activePin.phone}
              </a>

              {activePin.lat && activePin.lng && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${activePin.lat},${activePin.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/25 active:scale-95 transition"
                >
                  <Navigation className="h-3.5 w-3.5" /> Google Maps নেভিগেশন <ExternalLink className="h-3 w-3 opacity-70" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Nearest Services (if location is active) */}
      {userLocation && nearestServices.length > 0 && (
        <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <h4 className="flex items-center gap-1.5 font-display text-xs font-bold text-emerald-800">
            <LocateFixed className="h-4 w-4 text-emerald-600" /> আপনার বর্তমান অবস্থান থেকে নিকটতম সেবা
          </h4>
          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {nearestServices.map((item) => (
              <div
                key={item.id}
                onClick={() => setActivePin(item)}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-card p-2.5 shadow-2xs hover:border-primary/40 transition"
              >
                <div className="min-w-0 pr-2">
                  <p className="font-display text-xs font-bold text-foreground truncate">{item.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{item.upazila}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10.5px] font-bold text-primary">
                    {item.distance} কিমি
                  </span>
                  <a
                    href={`tel:${item.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-full p-1.5 text-primary hover:bg-muted"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
