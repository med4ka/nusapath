"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  ChevronLeft,
  MapPin,
  Star,
  RefreshCw,
  Image as ImageIcon,
  CalendarDays,
  Stamp,
} from "lucide-react";
import CheckoutModal from "../../components/CheckoutModal";
import DestinationReviews from "../../components/DestinationReviews";
import WishlistButton from "../../components/WishlistButton";
import BackgroundMotif from "../../components/BackgroundMotif";
import { useLanguage } from "../../lib/LanguageContext";

type DestImage = {
  id: number;
  destination_id: number;
  image_url: string;
  sort_order: number;
  is_primary: boolean;
};

type DestinationDetail = {
  id: number;
  name: string;
  category: string;
  description: string;
  price: number;
  rating: number;
  image_url: string;
  images: DestImage[];
  is_wishlisted?: boolean;
};

const formatPrice = (price: number) => new Intl.NumberFormat("id-ID").format(price);

class HttpError extends Error {
  status: number;
  constructor(status: number) {
    super();
    this.status = status;
  }
}

export default function DestinationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const { t } = useLanguage();

  const [detail, setDetail] = useState<DestinationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [bookingOpen, setBookingOpen] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    fetch(`/api/destinations/${id}`)
      .then((res) => {
        if (!res.ok) throw new HttpError(res.status);
        return res.json();
      })
      .then((body: DestinationDetail) => setDetail(body))
      .catch((err) => {
        if (err instanceof HttpError && err.status === 404) setNotFound(true);
        else setError(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const retry = () => {
    setError(false);
    setNotFound(false);
    setLoading(true);
    load();
  };

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const gallery = detail
    ? detail.images && detail.images.length > 0
      ? detail.images.map((img) => img.image_url)
      : detail.image_url
        ? [detail.image_url]
        : []
    : [];

  const activeImage = gallery[activeIndex] ?? "";
  const mainImage = gallery[0] ?? detail?.image_url ?? "";

  const handleBooking = () => {
    if (!detail) return;
    setBookingOpen(true);
  };

  const checkoutProduct = detail
    ? {
        id: detail.id,
        name: detail.name,
        price: detail.price > 0 ? `Rp ${formatPrice(detail.price)}` : t("common.free"),
        priceValue: detail.price,
        store: detail.category,
        image: mainImage,
      }
    : undefined;

  return (
    <main className="relative isolate bg-canvas dark:bg-canvas-dark min-h-screen pb-24">
      <BackgroundMotif />
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <header className="pt-12 pb-8">
          <Link
            href="/destinations"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted dark:text-ink-muted-dark hover:text-brand-orange dark:hover:text-brand-orange-dark transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> {t("detail.backLink")}
          </Link>

          {notFound ? (
            <div className="mt-10 rounded-2xl border border-dashed border-ink/20 dark:border-white/20 p-12 text-center">
              <MapPin className="w-8 h-8 text-ink-muted dark:text-ink-muted-dark mx-auto" />
              <h1 className="mt-4 font-display font-semibold text-2xl md:text-3xl text-ink dark:text-ink-dark">
                {t("detail.notFoundTitle")}
              </h1>
              <p className="mt-2 text-sm text-ink-muted dark:text-ink-muted-dark max-w-md mx-auto">
                {t("detail.notFoundDesc")}
              </p>
              <Link
                href="/destinations"
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 border-2 border-brand-orange text-brand-orange dark:text-brand-orange-dark text-xs font-semibold rounded-xl hover:bg-brand-orange hover:text-white transition-all"
              >
                <ChevronLeft className="w-4 h-4" /> {t("detail.backToList")}
              </Link>
            </div>
          ) : error ? (
            <div className="mt-10 rounded-2xl border border-status-failed/30 bg-status-failed/5 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div>
                <p className="text-sm font-semibold text-status-failed">{t("detail.errorTitle")}</p>
                <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">
                  {t("common.goBackendError")}
                </p>
              </div>
              <button
                type="button"
                onClick={retry}
                className="sm:ml-auto px-4 py-2.5 rounded-xl border border-status-failed/40 text-status-failed text-xs font-bold hover:bg-status-failed/10 transition-colors flex items-center gap-2 w-fit"
              >
                <RefreshCw className="w-3.5 h-3.5" /> {t("common.retry")}
              </button>
            </div>
          ) : loading || !detail ? (
            <div className="mt-6 grid gap-8 lg:grid-cols-2">
              <div className="aspect-[4/3] rounded-3xl bg-ink/5 dark:bg-white/5 animate-pulse" />
              <div className="space-y-4 pt-2">
                <div className="h-4 w-32 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                <div className="h-10 w-3/4 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                <div className="h-4 w-full rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                <div className="h-4 w-2/3 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                <div className="h-4 w-5/6 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
              </div>
            </div>
          ) : (
            <div className="mt-6 grid gap-10 lg:grid-cols-2 items-start">
              <div>
                {activeImage ? (
                  <div className="relative aspect-[4/3] w-full overflow-hidden ticket-card border border-ink/10 dark:border-white/10 bg-ink/5 dark:bg-white/5">
                    <Image
                      src={activeImage}
                      alt={detail.name}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      priority
                      quality={90}
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="relative aspect-[4/3] w-full overflow-hidden ticket-card border border-ink/10 dark:border-white/10 bg-ink/5 dark:bg-white/5 flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-ink-muted dark:text-ink-muted-dark" />
                  </div>
                )}

                {gallery.length > 1 && (
                  <div className="mt-4 grid grid-cols-4 gap-3">
                    {gallery.map((src, i) => (
                      <button
                        key={`${src}-${i}`}
                        type="button"
                        onClick={() => setActiveIndex(i)}
                        aria-label={t("detail.viewPhoto", { n: i + 1 })}
                        className={`relative aspect-[4/3] overflow-hidden rounded-xl border-2 transition-all ${
                          activeIndex === i
                            ? "border-brand-orange ring-4 ring-brand-orange/15"
                            : "border-transparent opacity-70 hover:opacity-100"
                        }`}
                      >
                        <Image
                          src={src}
                          alt={t("detail.photoAlt", { name: detail.name, n: i + 1 })}
                          fill
                          sizes="(max-width: 1024px) 25vw, 12vw"
                          quality={80}
                          className="object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:sticky lg:top-24">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full border border-brand-orange/70 text-brand-orange dark:text-brand-orange-dark flex items-center justify-center">
                      <MapPin className="w-3 h-3" />
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand-orange dark:text-brand-orange-dark">
                      {detail.category}
                    </span>
                  </span>
                  <span className="h-px flex-1 bg-ink/10 dark:bg-white/10" />
                  <span className="flex items-center gap-1.5 font-mono text-sm text-ink-muted dark:text-ink-muted-dark">
                    <Star className="w-4 h-4 fill-brand-orange dark:fill-brand-orange-dark text-brand-orange dark:text-brand-orange-dark" />
                    {detail.rating.toFixed(1)}
                  </span>
                </div>

                <h1 className="mt-4 font-display font-semibold text-3xl md:text-5xl text-ink dark:text-ink-dark tracking-tight leading-[1.08]">
                  {detail.name}
                </h1>

                <div className="mt-6 flex items-center gap-3">
                  <WishlistButton
                    destinationId={detail.id}
                    initialWishlisted={detail.is_wishlisted ?? false}
                    position="inline"
                  />
                  <p className="text-xs text-ink-muted dark:text-ink-muted-dark font-medium">
                    {detail.is_wishlisted ? t("detail.wishlistSaved") : t("detail.wishlistSave")}
                  </p>
                </div>

                <p className="mt-6 text-ink-muted dark:text-ink-muted-dark text-base md:text-lg leading-relaxed text-justify whitespace-pre-line">
                  {detail.description}
                </p>

                <div className="mt-8 bg-surface dark:bg-surface-dark rounded-2xl border border-ink/10 dark:border-white/10 p-6 flex flex-col sm:flex-row sm:items-center gap-5">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted dark:text-ink-muted-dark">
                      {t("detail.ticketPrice")}
                    </p>
                    <p className="mt-1.5 font-mono text-2xl md:text-3xl font-medium text-ink dark:text-ink-dark">
                      {detail.price > 0 ? `Rp ${formatPrice(detail.price)}` : t("common.free")}
                    </p>
                  </div>
                  <div className="sm:ml-auto flex items-center gap-2 font-mono text-xs text-ink-muted dark:text-ink-muted-dark">
                    <CalendarDays className="w-4 h-4" />
                    <span>{t("detail.bookingPerDate")}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleBooking}
                  className="mt-6 cta-cut inline-flex w-full items-center justify-center gap-2.5 px-7 py-4 border-2 border-brand-orange text-brand-orange dark:text-brand-orange-dark text-sm font-semibold bg-transparent hover:bg-brand-orange hover:text-white hover:scale-[1.01] active:scale-95 transition-all duration-200"
                >
                  <Stamp className="w-4 h-4" /> {t("detail.bookingNow")}
                </button>
                <p className="mt-3 flex items-center gap-2 text-[10px] text-ink-muted dark:text-ink-muted-dark italic font-medium">
                  <Stamp className="w-3.5 h-3.5 shrink-0" />
                  {t("detail.simulateNote")}
                </p>
              </div>
            </div>
          )}

          {/* ===== ULASAN & RATING — review asli (Batch 2), rata-rata + jumlah
              dihitung backend; form submit menampilkan pesan error backend
              apa adanya (403/409 eligibility, dll). onSubmitted → refetch
              detail supaya rating di header ikut ter-update. ===== */}
          {detail && (
            <DestinationReviews destinationId={detail.id} onSubmitted={load} />
          )}
        </header>
      </div>

      <CheckoutModal
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
        product={checkoutProduct}
      />
    </main>
  );
}