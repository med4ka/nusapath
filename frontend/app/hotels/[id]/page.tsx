"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Star, MapPin } from "lucide-react";
import { useLanguage } from "../../lib/LanguageContext";
import BackgroundMotif from "../../components/BackgroundMotif";
import CheckoutModal, { Product } from "../../components/CheckoutModal";

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

const formatRupiah = (n: number) => new Intl.NumberFormat("id-ID").format(n);

export default function HotelDetail() {
  const { id } = useParams<{ id: string }>();
  const { locale, t } = useLanguage();
  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(false);
    setNotFound(false);
    fetch(`/api/hotels/${id}`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        if (data) setHotel(data);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const today = new Date().toISOString().split("T")[0];

  const checkInDate = checkIn ? new Date(checkIn) : null;
  const checkOutDate = checkOut ? new Date(checkOut) : null;
  let nights = 0;
  if (checkInDate && checkOutDate && checkOutDate > checkInDate) {
    nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
  }
  const total = hotel && nights > 0 ? hotel.price_per_night * nights : 0;

  const handleBook = () => {
    if (!hotel || !checkIn || !checkOut || nights < 1) return;
    setCheckoutOpen(true);
  };

  const checkoutProduct: Product | undefined = hotel ? {
    id: hotel.id,
    name: hotel.name,
    price: `Rp ${formatRupiah(hotel.price_per_night)} / ${t("hotels.perNight")}`,
    priceValue: hotel.price_per_night,
    image: hotel.image_url || undefined,
    kind: "hotel",
    store: `${hotel.city} · ${hotel.star_rating}★`,
  } : undefined;

  const amenitiesList = hotel?.amenities.split(",").map((a) => a.trim()).filter(Boolean) ?? [];

  return (
    <div className="relative isolate bg-canvas dark:bg-canvas-dark min-h-screen pb-20">
      <BackgroundMotif />

      <main className="max-w-4xl mx-auto px-6 pt-4">
        <Link
          href="/hotels"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-muted dark:text-ink-muted-dark hover:text-brand-orange dark:hover:text-brand-orange-dark transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {t("hotels.backList")}
        </Link>

        {loading ? (
          <div className="space-y-6">
            <div className="aspect-[16/9] rounded-[2rem] bg-ink/5 dark:bg-white/5 animate-pulse" />
            <div className="space-y-3">
              <div className="h-6 w-1/2 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
              <div className="h-4 w-1/3 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
              <div className="h-20 w-full rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
            </div>
          </div>
        ) : error ? (
          <div className="bg-surface dark:bg-surface-dark p-10 rounded-[2rem] border border-status-failed/30 text-center">
            <p className="text-sm font-bold text-status-failed dark:text-status-failed-dark">{t("hotels.errorTitle")}</p>
          </div>
        ) : notFound || !hotel ? (
          <div className="bg-surface dark:bg-surface-dark p-10 rounded-[2rem] border border-dashed border-ink/20 dark:border-white/15 text-center">
            <p className="text-sm font-bold text-ink dark:text-ink-dark">{t("hotels.notFoundTitle")}</p>
            <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">{t("hotels.notFoundDesc")}</p>
            <Link href="/hotels" className="inline-block mt-5 px-6 py-3 bg-brand-orange text-white text-xs font-bold rounded-xl hover:bg-brand-orange/90 transition-colors">
              {t("hotels.backList")}
            </Link>
          </div>
        ) : (
          <>
            <div className="relative aspect-[16/9] rounded-[2rem] overflow-hidden bg-ink/5 dark:bg-white/5 mb-8">
              {hotel.image_url ? (
                <Image src={hotel.image_url} alt={hotel.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 900px" priority />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-ink-muted dark:text-ink-muted-dark">
                  <MapPin className="w-16 h-16" />
                </div>
              )}
              <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-surface/80 dark:bg-surface-dark/80 backdrop-blur-sm rounded-full px-3 py-1.5 border border-ink/10 dark:border-white/10">
                <Star className="w-4 h-4 text-brand-orange dark:text-brand-orange-dark fill-brand-orange dark:fill-brand-orange-dark" />
                <span className="text-xs font-bold text-ink dark:text-ink-dark">{hotel.star_rating}</span>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
              <div>
                <h1 className="font-display font-semibold text-3xl text-ink dark:text-ink-dark tracking-tight">{hotel.name}</h1>
                <p className="text-sm text-ink-muted dark:text-ink-muted-dark mt-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {hotel.city}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-2xl font-bold text-brand-orange dark:text-brand-orange-dark">Rp {formatRupiah(hotel.price_per_night)}</p>
                <p className="text-xs text-ink-muted dark:text-ink-muted-dark">{t("hotels.perNight")}</p>
              </div>
            </div>

            {hotel.description && (
              <div className="mb-8">
                <p className="text-sm text-ink dark:text-ink-dark leading-relaxed whitespace-pre-line">{hotel.description}</p>
              </div>
            )}

            <div className="mb-8">
              <h3 className="text-xs font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest mb-3">{t("hotels.amenities")}</h3>
              <div className="flex flex-wrap gap-2">
                {amenitiesList.map((a) => (
                  <span key={a} className="text-[10px] bg-brand-orange/10 text-brand-orange dark:text-brand-orange-dark px-3 py-1.5 rounded-full font-bold">{a}</span>
                ))}
              </div>
            </div>

            <div className="bg-surface dark:bg-surface-dark p-6 rounded-[2rem] border border-ink/10 dark:border-white/10 mb-8">
              <h3 className="text-xs font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest mb-4">{t("hotels.checkin")} — {t("hotels.checkout")}</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark mb-1">{t("hotels.checkin")}</p>
                  <input
                    type="date"
                    value={checkIn}
                    min={today}
                    onChange={(e) => {
                      setCheckIn(e.target.value);
                      if (checkOut && e.target.value >= checkOut) setCheckOut("");
                    }}
                    className="w-full bg-canvas dark:bg-canvas-dark text-ink dark:text-ink-dark border border-ink/15 dark:border-white/15 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark mb-1">{t("hotels.checkout")}</p>
                  <input
                    type="date"
                    value={checkOut}
                    min={checkIn || today}
                    onChange={(e) => setCheckOut(e.target.value)}
                    disabled={!checkIn}
                    className="w-full bg-canvas dark:bg-canvas-dark text-ink dark:text-ink-dark border border-ink/15 dark:border-white/15 rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-orange disabled:opacity-40"
                  />
                </div>
              </div>
              {nights > 0 && (
                <div className="border-t border-dashed border-ink/15 dark:border-white/20 pt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-muted dark:text-ink-muted-dark">Rp {formatRupiah(hotel.price_per_night)} x {nights} {t("hotels.nights", { n: nights })}</span>
                    <span className="font-mono font-bold text-ink dark:text-ink-dark">Rp {formatRupiah(total)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm border-t border-ink/10 dark:border-white/10 pt-2">
                    <span className="font-bold text-ink dark:text-ink-dark">{t("hotels.totalPay")}</span>
                    <span className="font-mono text-lg font-bold text-brand-orange dark:text-brand-orange-dark">Rp {formatRupiah(total)}</span>
                  </div>
                </div>
              )}
              <button
                onClick={handleBook}
                disabled={nights < 1}
                className="w-full mt-5 py-3.5 bg-brand-orange text-white text-xs font-bold rounded-xl hover:bg-brand-orange/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {t("hotels.bookNow")}
              </button>
              <p className="mt-2 text-[9px] text-ink-muted dark:text-ink-muted-dark italic text-center">{t("hotels.simulateNote")}</p>
            </div>
          </>
        )}
      </main>

      <CheckoutModal isOpen={checkoutOpen} onClose={() => setCheckoutOpen(false)} product={checkoutProduct} />
    </div>
  );
}
