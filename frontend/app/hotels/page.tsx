"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, MapPin, Search, X, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "../lib/LanguageContext";
import BackgroundMotif from "../components/BackgroundMotif";
import CheckoutModal, { Product } from "../components/CheckoutModal";

type Hotel = {
  id: number;
  name: string;
  city: string;
  price_per_night: number;
  star_rating: number;
  description: string;
  image_url: string;
  amenities: string;
};

type Meta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

const formatRupiah = (n: number) => new Intl.NumberFormat("id-ID").format(n);

export default function Hotels() {
  const { locale, t } = useLanguage();
  const [cities, setCities] = useState<string[]>([]);
  const [hotels, setHotels] = useState<Hotel[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);

  const [filterCity, setFilterCity] = useState("");
  const [filterStar, setFilterStar] = useState(0);
  const [filterMin, setFilterMin] = useState("");
  const [filterMax, setFilterMax] = useState("");

  const [checkoutProduct, setCheckoutProduct] = useState<Product | undefined>();
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const limit = 10;

  useEffect(() => {
    fetch("/api/hotels/cities")
      .then((r) => r.json())
      .then((data: string[]) => setCities(Array.isArray(data) ? data : []))
      .catch(() => setCities([]));
  }, []);

  const fetchHotels = useCallback(async (p: number) => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      params.set("page", String(p));
      params.set("limit", String(limit));
      if (filterCity) params.set("city", filterCity);
      if (filterStar > 0) params.set("star_rating", String(filterStar));
      if (filterMin) params.set("min_price", filterMin);
      if (filterMax) params.set("max_price", filterMax);

      const res = await fetch(`/api/hotels?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.data) {
        setHotels(data.data);
        setMeta(data.meta);
      } else {
        setHotels(data);
        setMeta(null);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [filterCity, filterStar, filterMin, filterMax]);

  useEffect(() => {
    fetchHotels(page);
  }, [page, fetchHotels]);

  useEffect(() => {
    setPage(1);
  }, [filterCity, filterStar, filterMin, filterMax]);

  const handleReset = () => {
    setFilterCity("");
    setFilterStar(0);
    setFilterMin("");
    setFilterMax("");
  };

  const handleBook = (hotel: Hotel) => {
    setCheckoutProduct({
      id: hotel.id,
      name: hotel.name,
      price: `Rp ${formatRupiah(hotel.price_per_night)} / ${t("hotels.perNight")}`,
      priceValue: hotel.price_per_night,
      image: hotel.image_url || undefined,
      kind: "hotel",
      store: `${hotel.city} · ${hotel.star_rating}★`,
    });
    setCheckoutOpen(true);
  };

  const amenitiesList = (amenities: string) =>
    amenities.split(",").map((a) => a.trim()).filter(Boolean);

  return (
    <div className="relative isolate bg-canvas dark:bg-canvas-dark min-h-screen pb-20">
      <BackgroundMotif />

      <main className="max-w-6xl mx-auto px-6 pt-4">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-ink-dark tracking-tight">{t("hotels.title")}</h2>
          <p className="text-sm text-gray-400 dark:text-ink-muted-dark mt-1 font-medium">{t("hotels.subtitle")}</p>
        </div>

        <div className="bg-surface dark:bg-surface-dark p-5 rounded-[2rem] border border-ink/10 dark:border-white/10 mb-8 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[160px]">
              <p className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest mb-1.5">{t("hotels.cityLabel")}</p>
              <select
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                className="w-full bg-canvas dark:bg-canvas-dark text-ink dark:text-ink-dark border border-ink/15 dark:border-white/15 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-orange"
              >
                <option value="">{t("hotels.allCities")}</option>
                {cities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="w-[140px]">
              <p className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest mb-1.5">{t("hotels.starRating")}</p>
              <select
                value={filterStar}
                onChange={(e) => setFilterStar(Number(e.target.value))}
                className="w-full bg-canvas dark:bg-canvas-dark text-ink dark:text-ink-dark border border-ink/15 dark:border-white/15 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-orange"
              >
                <option value={0}>{t("hotels.allStars")}</option>
                {[1, 2, 3, 4, 5].map((s) => (
                  <option key={s} value={s}>{t("hotels.star", { n: s })}</option>
                ))}
              </select>
            </div>

            <div className="w-[120px]">
              <p className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest mb-1.5">{t("hotels.minPrice")}</p>
              <input
                type="number"
                value={filterMin}
                onChange={(e) => setFilterMin(e.target.value)}
                placeholder="0"
                className="w-full bg-canvas dark:bg-canvas-dark text-ink dark:text-ink-dark border border-ink/15 dark:border-white/15 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-orange [appearance:textfield]"
              />
            </div>

            <div className="w-[120px]">
              <p className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest mb-1.5">{t("hotels.maxPrice")}</p>
              <input
                type="number"
                value={filterMax}
                onChange={(e) => setFilterMax(e.target.value)}
                placeholder="999999"
                className="w-full bg-canvas dark:bg-canvas-dark text-ink dark:text-ink-dark border border-ink/15 dark:border-white/15 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-orange [appearance:textfield]"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={handleReset}
                className="px-4 py-2.5 bg-canvas dark:bg-canvas-dark border border-ink/15 dark:border-white/15 rounded-xl text-xs font-bold text-ink-muted dark:text-ink-muted-dark hover:text-brand-orange dark:hover:text-brand-orange-dark transition-colors flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" /> {t("hotels.reset")}
              </button>
            </div>
          </div>
        </div>

        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {error ? (
            <div className="bg-surface dark:bg-surface-dark p-10 rounded-[2rem] border border-status-failed/30 text-center">
              <p className="text-sm font-bold text-status-failed dark:text-status-failed-dark">{t("hotels.errorTitle")}</p>
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">{t("common.goBackendError")}</p>
              <button onClick={() => fetchHotels(1)} className="mt-5 px-6 py-3 bg-brand-orange text-white text-xs font-bold rounded-xl hover:bg-brand-orange/90 transition-colors">
                {t("common.retry")}
              </button>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-surface dark:bg-surface-dark rounded-[2rem] border border-ink/10 dark:border-white/10 overflow-hidden">
                  <div className="aspect-[4/3] bg-ink/5 dark:bg-white/5 animate-pulse" />
                  <div className="p-5 space-y-2">
                    <div className="h-4 w-2/3 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                    <div className="h-3 w-1/4 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : hotels && hotels.length === 0 ? (
            <div className="bg-surface dark:bg-surface-dark p-10 rounded-[2rem] border border-dashed border-ink/20 dark:border-white/15 text-center">
              <MapPin className="w-8 h-8 text-ink-muted dark:text-ink-muted-dark mx-auto mb-3" />
              <p className="text-sm font-bold text-ink dark:text-ink-dark">{t("hotels.emptyTitle")}</p>
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">{t("hotels.emptyDesc")}</p>
              <button onClick={handleReset} className="mt-5 px-6 py-3 bg-brand-orange text-white text-xs font-bold rounded-xl hover:bg-brand-orange/90 transition-colors">
                {t("hotels.clearFilter")}
              </button>
            </div>
          ) : hotels ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-ink-muted dark:text-ink-muted-dark font-medium">
                  {meta ? t("hotels.resultFiltered", { total: meta.total }) : t("hotels.resultCount", { total: hotels.length })}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {hotels.map((hotel) => (
                  <div key={hotel.id} className="bg-surface dark:bg-surface-dark rounded-[2rem] border border-ink/10 dark:border-white/10 overflow-hidden hover:border-brand-orange/50 dark:hover:border-brand-orange-dark/60 hover:shadow-md transition-all group">
                    <Link href={`/hotels/${hotel.id}`} className="block">
                      <div className="relative aspect-[4/3] overflow-hidden bg-ink/5 dark:bg-white/5">
                        {hotel.image_url ? (
                          <Image src={hotel.image_url} alt={hotel.name} fill className="object-cover group-hover:scale-[1.02] transition-transform duration-500" sizes="(max-width: 768px) 100vw, 50vw" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-ink-muted dark:text-ink-muted-dark">
                            <MapPin className="w-12 h-12" />
                          </div>
                        )}
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-surface/80 dark:bg-surface-dark/80 backdrop-blur-sm rounded-full px-2.5 py-1 border border-ink/10 dark:border-white/10">
                          <Star className="w-3 h-3 text-brand-orange dark:text-brand-orange-dark fill-brand-orange dark:fill-brand-orange-dark" />
                          <span className="text-[10px] font-bold text-ink dark:text-ink-dark">{hotel.star_rating}</span>
                        </div>
                      </div>
                    </Link>
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <Link href={`/hotels/${hotel.id}`}>
                            <h3 className="font-bold text-ink dark:text-ink-dark text-sm truncate group-hover:text-brand-orange dark:group-hover:text-brand-orange-dark transition-colors">{hotel.name}</h3>
                          </Link>
                          <p className="text-[10px] text-ink-muted dark:text-ink-muted-dark font-bold mt-0.5 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {hotel.city}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-sm font-bold text-brand-orange dark:text-brand-orange-dark">Rp {formatRupiah(hotel.price_per_night)}</p>
                          <p className="text-[9px] text-ink-muted dark:text-ink-muted-dark">{t("hotels.perNight")}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {amenitiesList(hotel.amenities).slice(0, 4).map((a) => (
                          <span key={a} className="text-[9px] bg-brand-orange/10 text-brand-orange dark:text-brand-orange-dark px-2 py-0.5 rounded-full font-bold truncate max-w-[100px]">{a}</span>
                        ))}
                        {amenitiesList(hotel.amenities).length > 4 && (
                          <span className="text-[9px] text-ink-muted dark:text-ink-muted-dark px-2 py-0.5 font-bold">+{amenitiesList(hotel.amenities).length - 4}</span>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.preventDefault(); handleBook(hotel); }}
                        className="mt-4 w-full py-2.5 bg-brand-orange text-white text-xs font-bold rounded-xl hover:bg-brand-orange/90 transition-colors active:scale-[0.98]"
                      >
                        {t("hotels.bookNow")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {meta && meta.total_pages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-10">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-2.5 bg-surface dark:bg-surface-dark border border-ink/10 dark:border-white/10 rounded-xl disabled:opacity-40 hover:border-brand-orange dark:hover:border-brand-orange-dark transition-colors"
                    aria-label={t("hotels.previous")}
                  >
                    <ChevronLeft className="w-4 h-4 text-ink dark:text-ink-dark" />
                  </button>
                  <span className="text-xs font-mono text-ink-muted dark:text-ink-muted-dark" aria-label={t("hotels.pagination")}>
                    {meta.page} / {meta.total_pages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
                    disabled={page >= meta.total_pages}
                    className="p-2.5 bg-surface dark:bg-surface-dark border border-ink/10 dark:border-white/10 rounded-xl disabled:opacity-40 hover:border-brand-orange dark:hover:border-brand-orange-dark transition-colors"
                    aria-label={t("hotels.next")}
                  >
                    <ChevronRight className="w-4 h-4 text-ink dark:text-ink-dark" />
                  </button>
                </div>
              )}
            </>
          ) : null}
        </section>
      </main>

      <CheckoutModal isOpen={checkoutOpen} onClose={() => setCheckoutOpen(false)} product={checkoutProduct} />
    </div>
  );
}
