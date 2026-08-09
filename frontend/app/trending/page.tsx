"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Flame, MapPin, Star, ChevronLeft, RefreshCw, Compass } from "lucide-react";
import BackgroundMotif from "../components/BackgroundMotif";
import WishlistButton from "../components/WishlistButton";
import { useLanguage } from "../lib/LanguageContext";

type TrendingDestination = {
  id: number;
  name: string;
  category: string;
  description: string;
  price: number;
  rating: number;
  image_url: string;
  images_count: number;
  is_wishlisted?: boolean;
};

const formatPrice = (price: number) => new Intl.NumberFormat("id-ID").format(price);

const CARD_SKELETONS = Array.from({ length: 6 });

export default function TrendingPage() {
  const { t } = useLanguage();
  const [destinations, setDestinations] = useState<TrendingDestination[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    Promise.resolve().then(() => setLoading(true));
    Promise.resolve().then(() => setError(false));
    fetch("/api/destinations/trending")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: TrendingDestination[]) => setDestinations(data ?? []))
      .catch(() => {
        setError(true);
        setDestinations(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="relative isolate bg-canvas dark:bg-canvas-dark min-h-screen pb-24">
      <BackgroundMotif />
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <header className="pt-12 pb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted dark:text-ink-muted-dark hover:text-brand-orange dark:hover:text-brand-orange-dark transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> {t("common.backHome")}
          </Link>
          <div className="mt-6 flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.25em] text-brand-orange dark:text-brand-orange-dark">
            <Flame className="w-4 h-4" />
            <span>{t("trending.eyebrow")}</span>
          </div>
          <h1 className="mt-3 font-display font-semibold text-3xl md:text-5xl text-ink dark:text-ink-dark tracking-tight">
            {t("trending.title")}
          </h1>
          <p className="mt-3 max-w-xl text-ink-muted dark:text-ink-muted-dark text-sm md:text-base leading-relaxed">
            {t("trending.subtitle")}
          </p>
        </header>

        <div className="mt-8 mb-6 flex items-center justify-between">
          <p className="font-mono text-xs text-ink-muted dark:text-ink-muted-dark">{t("trending.rankNote")}</p>
          {loading && destinations && (
            <span className="font-mono text-xs text-brand-orange dark:text-brand-orange-dark animate-pulse">{t("common.loading")}</span>
          )}
        </div>

        {error ? (
          <div className="rounded-2xl border border-status-failed/30 bg-status-failed/5 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <p className="text-sm font-semibold text-status-failed">{t("trending.errorTitle")}</p>
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">
                {t("common.goBackendError")}
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              className="sm:ml-auto px-4 py-2.5 rounded-xl border border-status-failed/40 text-status-failed text-xs font-bold hover:bg-status-failed/10 transition-colors flex items-center gap-2 w-fit"
            >
              <RefreshCw className="w-3.5 h-3.5" /> {t("common.retry")}
            </button>
          </div>
        ) : loading && !destinations ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {CARD_SKELETONS.map((_, i) => (
              <div key={i} className="bg-surface dark:bg-surface-dark rounded-3xl border border-ink/10 dark:border-white/10 overflow-hidden">
                <div className="aspect-[4/3] bg-ink/5 dark:bg-white/5 animate-pulse" />
                <div className="p-6 space-y-3">
                  <div className="h-3 w-16 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                  <div className="h-5 w-3/4 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                  <div className="h-3 w-full rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                  <div className="h-3 w-2/3 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : destinations && destinations.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {destinations.map((d) => (
              <div key={d.id} className="relative h-full">
                <Link
                  href={`/destinations/${d.id}`}
                  className="group block h-full"
                  aria-label={t("grid.viewDetail", { name: d.name })}
                >
                  <article className="relative bg-surface dark:bg-surface-dark ticket-card border border-ink/10 dark:border-white/10 hover:border-ink/30 dark:hover:border-white/30 hover:scale-[1.01] transition-all duration-300 overflow-hidden h-full">
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand-orange scale-y-0 group-hover:scale-y-100 origin-top transition-transform duration-300" />
                    <div className="relative aspect-[4/3] overflow-hidden bg-ink/5 dark:bg-white/5">
                      <Image
                        src={d.image_url}
                        alt={d.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        quality={85}
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/45 backdrop-blur-md px-2.5 py-1 rounded-full">
                        <Flame className="w-3 h-3 text-brand-orange dark:text-brand-orange-dark" />
                        <span className="font-mono text-[10px] font-bold text-white">{t("trending.badge")}</span>
                      </div>
                    </div>
                    <div className="p-6">
                      <span className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full border border-brand-orange/70 text-brand-orange dark:text-brand-orange-dark flex items-center justify-center">
                          <MapPin className="w-3 h-3" />
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand-orange dark:text-brand-orange-dark">
                          {d.category}
                        </span>
                      </span>
                      <h3 className="mt-2 font-display text-xl text-ink dark:text-ink-dark leading-snug group-hover:text-brand-orange dark:group-hover:text-brand-orange-dark dark:hover:text-brand-orange-dark transition-colors">
                        {d.name}
                      </h3>
                      <p className="mt-2 text-sm text-ink-muted dark:text-ink-muted-dark leading-relaxed line-clamp-2">
                        {d.description}
                      </p>
                      <div className="mt-5 pt-4 border-t border-dashed border-ink/15 dark:border-white/15 flex items-center justify-between">
                        <span className="font-mono text-base font-medium text-ink dark:text-ink-dark">
                          {d.price > 0 ? `Rp ${formatPrice(d.price)}` : t("common.free")}
                        </span>
                        <span className="flex items-center gap-1.5 font-mono text-sm text-ink-muted dark:text-ink-muted-dark">
                          <Star className="w-4 h-4 fill-brand-orange dark:fill-brand-orange-dark text-brand-orange dark:text-brand-orange-dark" />
                          {d.rating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
                <WishlistButton
                  destinationId={d.id}
                  initialWishlisted={d.is_wishlisted ?? false}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-ink/20 dark:border-white/20 p-12 text-center">
            <Compass className="w-8 h-8 text-ink-muted dark:text-ink-muted-dark mx-auto" />
            <p className="mt-4 font-display text-xl text-ink dark:text-ink-dark">{t("trending.emptyTitle")}</p>
            <p className="mt-2 text-sm text-ink-muted dark:text-ink-muted-dark">
              {t("trending.emptyDesc")}
            </p>
            <Link
              href="/destinations"
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 border-2 border-brand-orange text-brand-orange dark:text-brand-orange-dark text-xs font-semibold rounded-xl hover:bg-brand-orange hover:text-white transition-all"
            >
              <Compass className="w-3.5 h-3.5" /> {t("trending.browse")}
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}