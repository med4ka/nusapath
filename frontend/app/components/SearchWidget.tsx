"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, Plane, Building2, ArrowRight } from "lucide-react";
import { useLanguage } from "../lib/LanguageContext";

type Tab = "destinasi" | "transportasi" | "hotel";

const TABS: { key: Tab; icon: typeof MapPin }[] = [
  { key: "destinasi", icon: MapPin },
  { key: "transportasi", icon: Plane },
  { key: "hotel", icon: Building2 },
];

export default function SearchWidget() {
  const { t } = useLanguage();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("destinasi");
  const [destName, setDestName] = useState("");
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [date, setDate] = useState("");
  const [hotelCity, setHotelCity] = useState("");
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");

  // City catalog for transport & hotel
  const [cities, setCities] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/transport-routes/cities")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: string[]) => setCities(Array.isArray(data) ? data : []))
      .catch(() => setCities([]));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();

    if (tab === "destinasi") {
      if (destName.trim()) params.set("search", destName.trim());
      router.push(`/destinations?${params.toString()}`);
    } else if (tab === "transportasi") {
      if (origin) params.set("origin_city", origin);
      if (dest) params.set("dest_city", dest);
      if (date) params.set("date", date);
      router.push(`/transport?${params.toString()}`);
    } else if (tab === "hotel") {
      if (hotelCity) params.set("city", hotelCity);
      if (checkin) params.set("checkin", checkin);
      if (checkout) params.set("checkout", checkout);
      router.push(`/hotels?${params.toString()}`);
    }
  };

  const inputClass =
    "w-full px-4 py-3 bg-canvas/60 dark:bg-white/5 border border-ink/10 dark:border-white/10 rounded-xl text-sm text-ink dark:text-ink-dark outline-none focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 transition-all";
  const selectClass =
    "w-full appearance-none px-4 py-3 bg-canvas/60 dark:bg-white/5 border border-ink/10 dark:border-white/10 rounded-xl text-sm text-ink dark:text-ink-dark outline-none focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 transition-all cursor-pointer";

  return (
    <section className="max-w-7xl mx-auto px-4 md:px-8 mb-14 md:mb-16">
      <div className="bg-surface dark:bg-surface-dark ticket-card border border-ink/10 dark:border-white/10 p-5 md:p-6">
        <div className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.25em] text-brand-orange dark:text-brand-orange-dark mb-5">
          <Search className="w-4 h-4" />
          <span>{t("homeSearch.eyebrow")}</span>
        </div>

        <h3 className="font-display text-2xl md:text-3xl text-ink dark:text-ink-dark mb-5">
          {t("homeSearch.title")}
        </h3>

        <div className="inline-flex items-center gap-1 bg-canvas/60 dark:bg-white/5 p-1 rounded-2xl border border-ink/10 dark:border-white/10 shadow-sm mb-6">
          {TABS.map((tp) => {
            const Icon = tp.icon;
            const active = tab === tp.key;
            return (
              <button
                key={tp.key}
                type="button"
                onClick={() => setTab(tp.key)}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all ${
                  active
                    ? "bg-brand-orange text-white shadow-lg shadow-brand-orange/25"
                    : "text-ink-muted dark:text-ink-muted-dark hover:text-brand-orange dark:hover:text-brand-orange-dark"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t(`homeSearch.${tp.key}`)}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit}>
          {tab === "destinasi" && (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                <label htmlFor="search-dest-name" className="sr-only">{t("homeSearch.destNameLabel")}</label>
                <input
                  id="search-dest-name"
                  type="text"
                  value={destName}
                  onChange={(e) => setDestName(e.target.value)}
                  placeholder={t("homeSearch.destNamePlaceholder")}
                  className={inputClass + " pl-11"}
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-orange text-white text-sm font-bold rounded-xl hover:scale-[1.02] active:scale-95 transition-all duration-200 shadow-lg shadow-brand-orange/25"
              >
                {t("homeSearch.submitDest")}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {tab === "transportasi" && (
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1">
                <label htmlFor="search-transport-origin" className="sr-only">{t("homeSearch.originLabel")}</label>
                <select
                  id="search-transport-origin"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className={selectClass}
                >
                  <option value="">{t("homeSearch.allCities")}</option>
                  {cities.map((c) => (
                    <option key={`o-${c}`} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="relative flex-1">
                <label htmlFor="search-transport-dest" className="sr-only">{t("homeSearch.destLabel")}</label>
                <select
                  id="search-transport-dest"
                  value={dest}
                  onChange={(e) => setDest(e.target.value)}
                  className={selectClass}
                >
                  <option value="">{t("homeSearch.allCities")}</option>
                  {cities.map((c) => (
                    <option key={`d-${c}`} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="relative flex-1">
                <label htmlFor="search-transport-date" className="sr-only">{t("homeSearch.dateLabel")}</label>
                <input
                  id="search-transport-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-orange text-white text-sm font-bold rounded-xl hover:scale-[1.02] active:scale-95 transition-all duration-200 shadow-lg shadow-brand-orange/25"
              >
                {t("homeSearch.submitTransport")}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {tab === "hotel" && (
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1">
                <label htmlFor="search-hotel-city" className="sr-only">{t("homeSearch.hotelCityLabel")}</label>
                <select
                  id="search-hotel-city"
                  value={hotelCity}
                  onChange={(e) => setHotelCity(e.target.value)}
                  className={selectClass}
                >
                  <option value="">{t("homeSearch.hotelCityPlaceholder")}</option>
                  {cities.map((c) => (
                    <option key={`h-${c}`} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="relative flex-1">
                <label htmlFor="search-hotel-checkin" className="sr-only">{t("homeSearch.checkinLabel")}</label>
                <input
                  id="search-hotel-checkin"
                  type="date"
                  value={checkin}
                  onChange={(e) => setCheckin(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="relative flex-1">
                <label htmlFor="search-hotel-checkout" className="sr-only">{t("homeSearch.checkoutLabel")}</label>
                <input
                  id="search-hotel-checkout"
                  type="date"
                  value={checkout}
                  onChange={(e) => setCheckout(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-orange text-white text-sm font-bold rounded-xl hover:scale-[1.02] active:scale-95 transition-all duration-200 shadow-lg shadow-brand-orange/25"
              >
                {t("homeSearch.submitHotel")}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
