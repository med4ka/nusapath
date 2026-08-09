"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useReducedMotion, motion } from "framer-motion";
import { Compass, Star, RefreshCw, MapPin, Flame, ShieldCheck } from "lucide-react";
import BackgroundMotif from "./components/BackgroundMotif";
import SearchWidget from "./components/SearchWidget";
import WishlistButton from "./components/WishlistButton";
import { useLanguage } from "./lib/LanguageContext";

type Destination = {
  id: number;
  name: string;
  category: string;
  description: string;
  price: number;
  rating: number;
  image_url: string;
  is_wishlisted?: boolean;
};

const formatPrice = (price: number) => new Intl.NumberFormat("id-ID").format(price);

const GRID_VARIANTS = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export default function Home() {
  const reduce = useReducedMotion();
  const { t } = useLanguage();

  const [featured, setFeatured] = useState<Destination | null>(null);
  const [trending, setTrending] = useState<Destination[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    Promise.resolve().then(() => setError(false));
    fetch("/api/destinations")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: Destination[]) => {
        const best = data.reduce(
          (b, d) => (d.rating > (b?.rating ?? 0) ? d : b),
          null as Destination | null
        );
        setFeatured(best);
      })
      .catch(() => setError(true));
  }, []);

  const loadTrending = useCallback(() => {
    fetch("/api/destinations/trending")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: Destination[]) => setTrending(data ?? []))
      .catch(() => setTrending(null));
  }, []);

  useEffect(() => {
    load();
    loadTrending();
  }, [load, loadTrending]);

  return (
    <main className="relative isolate bg-canvas dark:bg-canvas-dark text-ink dark:text-ink-dark min-h-screen">
      <BackgroundMotif dense={false} />
      <section className="relative overflow-hidden pt-12 md:pt-20">
        <svg
          className="pointer-events-none absolute left-[2%] md:left-[8%] top-[44%] md:top-[46%] w-56 h-48 md:w-[360px] md:h-[250px] opacity-[0.13]"
          viewBox="0 0 460 320"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M24 44 C 120 40, 140 130, 240 150 S 380 240, 436 292"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray="5 7"
            strokeLinecap="round"
            className="route-line-draw text-brand-orange"
          />
          <circle cx="24" cy="44" r="5" stroke="currentColor" strokeWidth="2.5" className="text-brand-orange" />
          <circle cx="240" cy="150" r="5" fill="currentColor" className="text-brand-orange" />
          <circle cx="436" cy="292" r="7" fill="currentColor" className="text-brand-orange" />
          <circle cx="436" cy="292" r="12" stroke="currentColor" strokeWidth="1.5" className="text-brand-orange" />
        </svg>
        <div className="relative max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.25em] text-brand-orange dark:text-brand-orange-dark">
            <Compass className="w-4 h-4 text-brand-orange dark:text-brand-orange-dark" />
            <span className="text-brand-orange dark:text-brand-orange-dark">{t("hero.eyebrow")}</span>
          </div>

          <h1 className="mt-7 font-display font-semibold text-4xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight max-w-4xl">
            {t("hero.title1")}
            <br />
            <span className="text-brand-orange dark:text-brand-orange-dark">{t("hero.title2")}</span>
          </h1>

          <p className="mt-7 max-w-xl text-ink-muted dark:text-ink-muted-dark text-base md:text-lg leading-relaxed">
            {t("hero.subtitle")}
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/smartrip"
              className="cta-cut inline-flex items-center gap-2.5 px-7 py-3.5 border-2 border-brand-orange dark:border-brand-orange-dark text-brand-orange dark:text-brand-orange-dark text-sm font-semibold bg-transparent hover:bg-brand-orange hover:text-white hover:scale-[1.02] active:scale-95 transition-all duration-200"
            >
              <Compass className="w-4 h-4" /> {t("hero.cta1")}
            </Link>
            <a
              href="#destinasi"
              className="px-7 py-3.5 border border-ink/15 dark:border-white/20 text-ink dark:text-ink-dark text-sm font-semibold rounded-xl hover:border-ink/40 dark:hover:border-white/40 hover:bg-ink/5 dark:hover:bg-white/10 active:scale-95 transition-all duration-200"
            >
              {t("hero.cta2")}
            </a>
          </div>
        </div>

        <div className="relative mt-6 md:mt-8">
          {featured ? (
            <div className="max-w-7xl mx-auto px-4 md:px-8">
              <div className="relative">
                <Link href={`/destinations/${featured.id}`} className="group block">
                  <figure>
                    <div className="relative aspect-[16/10] md:aspect-[21/9] w-full overflow-hidden ticket-card border border-ink/10 dark:border-white/10 bg-ink/5 dark:bg-white/5">
                      <Image
                        src={featured.image_url}
                        alt={featured.name}
                        fill
                        sizes="100vw"
                        priority
                        quality={90}
                        className="object-cover group-hover:scale-[1.02] transition-transform duration-700"
                      />
                    </div>
                    <figcaption className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-dashed border-ink/15 dark:border-white/20 pt-5">
                      <div>
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand-orange dark:text-brand-orange-dark">
                          {featured.category} — {t("hero.featuredLabel")}
                        </span>
                        <h2 className="mt-1.5 font-display text-2xl md:text-3xl text-ink dark:text-ink-dark leading-snug group-hover:text-brand-orange dark:group-hover:text-brand-orange-dark transition-colors">
                          {featured.name}
                        </h2>
                      </div>
                      <div className="flex items-center gap-5">
                        <span className="font-mono text-lg font-medium text-ink dark:text-ink-dark">
                          Rp {formatPrice(featured.price)}
                        </span>
                        <span className="flex items-center gap-1.5 font-mono text-sm text-ink-muted dark:text-ink-muted-dark">
                          <Star className="w-4 h-4 fill-brand-orange dark:fill-brand-orange-dark text-brand-orange dark:text-brand-orange-dark" />
                          {featured.rating.toFixed(1)}
                        </span>
                      </div>
                    </figcaption>
                  </figure>
                </Link>
                <WishlistButton
                  destinationId={featured.id}
                  initialWishlisted={featured.is_wishlisted ?? false}
                />
              </div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto px-4 md:px-8">
              <div className="aspect-[16/10] md:aspect-[21/9] rounded-3xl bg-ink/5 dark:bg-white/5 animate-pulse" />
              <div className="mt-5 h-8 w-1/3 rounded-md bg-ink/5 dark:bg-white/5 animate-pulse" />
            </div>
          )}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-8 mt-10 md:mt-12 mb-14 md:mb-16">
        <div className="bg-surface dark:bg-surface-dark border border-ink/10 dark:border-white/10 rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-status-paid/10 text-status-paid dark:text-status-paid-dark flex items-center justify-center shrink-0 border border-status-paid/20 dark:border-status-paid-dark/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-lg text-ink dark:text-ink-dark">{t("hero.title2")}</h3>
              <p className="text-sm text-ink-muted dark:text-ink-muted-dark mt-1 max-w-lg">
                {t("verify.subtitle")}
              </p>
            </div>
          </div>
          <Link
            href="/verify"
            className="shrink-0 px-6 py-3 bg-brand-orange text-white text-xs font-bold rounded-xl hover:bg-brand-orange/90 transition-colors text-center inline-flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" /> {t("verify.button")}
          </Link>
        </div>
      </section>

      <SearchWidget />

      <section id="destinasi" className="scroll-mt-24 pb-24 md:pb-28">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-brand-orange dark:text-brand-orange-dark">
                <Flame className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                {t("grid.eyebrow")}
              </span>
              <h2 className="mt-3 font-display text-3xl md:text-4xl text-ink dark:text-ink-dark">{t("grid.title")}</h2>
            </div>
            <p className="text-sm text-ink-muted dark:text-ink-muted-dark max-w-sm leading-relaxed">
              {t("grid.subtitle")}
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-status-failed/30 bg-status-failed/5 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div>
                <p className="text-sm font-semibold text-status-failed dark:text-status-failed-dark">{t("grid.errorTitle")}</p>
                <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">
                  {t("grid.errorDesc")}
                </p>
              </div>
              <button
                onClick={loadTrending}
                className="sm:ml-auto px-4 py-2.5 rounded-xl border border-status-failed/40 text-status-failed dark:text-status-failed-dark text-xs font-bold hover:bg-status-failed/10 transition-colors flex items-center gap-2 w-fit"
              >
                <RefreshCw className="w-3.5 h-3.5" /> {t("grid.retry")}
              </button>
            </div>
          ) : trending ? (
            trending.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-ink/20 dark:border-white/20 p-8 text-center">
                <p className="text-sm font-semibold text-ink-muted dark:text-ink-muted-dark">{t("grid.emptyTitle")}</p>
                <p className="text-xs text-ink-muted/60 dark:text-ink-muted-dark/60 mt-1">{t("grid.emptyDesc")}</p>
              </div>
            ) : (
              <motion.div
                className="grid gap-8 sm:grid-cols-2"
                initial={reduce ? false : "hidden"}
                whileInView="show"
                viewport={{ once: true, margin: "-80px" }}
                variants={reduce ? undefined : GRID_VARIANTS}
              >
                {trending.map((d) => (
                  <div key={d.id} className="relative h-full">
                    <Link
                      href={`/destinations/${d.id}`}
                      className="group block h-full"
                      aria-label={t("grid.viewDetail", { name: d.name })}
                    >
                      <motion.article
                        variants={reduce ? undefined : CARD_VARIANTS}
                        className="relative bg-surface dark:bg-surface-dark ticket-card border border-ink/10 dark:border-white/10 hover:border-ink/30 dark:hover:border-white/30 hover:scale-[1.01] transition-all duration-300 overflow-hidden h-full"
                      >
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
                          <span className="absolute top-3 left-3 font-mono text-[9px] uppercase tracking-[0.15em] bg-brand-orange text-white px-2 py-1 rounded-md shadow-lg">
                            {t("grid.badge")}
                          </span>
                        </div>
                        <div className="p-6">
                          <span className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full border border-brand-orange/70 dark:border-brand-orange-dark/70 text-brand-orange dark:text-brand-orange-dark flex items-center justify-center">
                              <MapPin className="w-3 h-3" />
                            </span>
                            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand-orange dark:text-brand-orange-dark">
                              {d.category}
                            </span>
                          </span>
                          <h3 className="mt-2 font-display text-2xl text-ink dark:text-ink-dark leading-snug group-hover:text-brand-orange dark:group-hover:text-brand-orange-dark transition-colors">
                            {d.name}
                          </h3>
                          <p className="mt-2 text-sm text-ink-muted dark:text-ink-muted-dark leading-relaxed line-clamp-2 md:text-base">
                            {d.description}
                          </p>
                          <div className="mt-5 pt-4 border-t border-dashed border-ink/15 dark:border-white/20 flex items-center justify-between">
                            <span className="font-mono text-base font-medium text-ink dark:text-ink-dark">
                              {d.price > 0 ? `Rp ${formatPrice(d.price)}` : t("grid.free")}
                            </span>
                            <span className="flex items-center gap-1.5 font-mono text-sm text-ink-muted dark:text-ink-muted-dark">
                              <Star className="w-4 h-4 fill-brand-orange dark:fill-brand-orange-dark text-brand-orange dark:text-brand-orange-dark" />
                              {d.rating.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </motion.article>
                    </Link>
                    <WishlistButton
                      destinationId={d.id}
                      initialWishlisted={d.is_wishlisted ?? false}
                    />
                  </div>
                ))}
              </motion.div>
            )
          ) : (
            <div className="grid gap-8 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
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
          )}
        </div>
      </section>
    </main>
  );
}
