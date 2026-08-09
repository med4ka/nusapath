"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  MapPin,
  Star,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  SlidersHorizontal,
  X,
  Compass,
} from "lucide-react";
import BackgroundMotif from "../components/BackgroundMotif";
import DestTypeToggle from "../components/DestTypeToggle";
import WishlistButton from "../components/WishlistButton";
import { useLanguage } from "../lib/LanguageContext";

type Destination = {
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

type Meta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

const formatPrice = (price: number) => new Intl.NumberFormat("id-ID").format(price);

const PAGE_SIZE = 12;

const CARD_SKELETONS = Array.from({ length: 6 });

function pageWindow(current: number, total: number): (number | "…")[] {
  const set = new Set<number>([1, 2, current - 1, current, current + 1, total - 1, total]);
  const sorted = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

export default function DestinationsPage() {
  const { t } = useLanguage();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<Destination[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Category catalog fetched ONCE from full array mode (no page/limit),
  // so filter dropdown reflects actual data, not hardcoded list.
  useEffect(() => {
    fetch("/api/destinations")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: Destination[]) => {
        const set = new Set(data.map((d) => d.category).filter(Boolean));
        setCategories([...set].sort());
      })
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (search) params.set("search", search);
    if (category) params.set("category", category);
    if (minPrice) params.set("min_price", minPrice);
    if (maxPrice) params.set("max_price", maxPrice);

    fetch(`/api/destinations?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((body) => {
        setDestinations(body?.data ?? []);
        setMeta(body?.meta ?? null);
        setHasLoaded(true);
      })
      .catch(() => {
        setError(true);
        setDestinations(null);
        setMeta(null);
      })
      .finally(() => setLoading(false));
  }, [page, search, category, minPrice, maxPrice]);

  useEffect(() => {
    load();
  }, [load]);

  const retry = () => {
    setError(false);
    setLoading(true);
    load();
  };

  const resetFilters = () => {
    setLoading(true);
    setSearchInput("");
    setSearch("");
    setCategory("");
    setMinPrice("");
    setMaxPrice("");
    setPage(1);
  };

  const hasActiveFilter = !!(searchInput || category || minPrice || maxPrice);
  const resultLabel =
    meta && hasLoaded
      ? t(hasActiveFilter ? "destinations.resultFiltered" : "destinations.resultCount", { total: meta.total })
      : "";

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
            <Compass className="w-4 h-4" />
            <span>{t("destinations.eyebrow")}</span>
          </div>
          <h1 className="mt-3 font-display font-semibold text-3xl md:text-5xl text-ink dark:text-ink-dark tracking-tight">
            {t("destinations.title")}
          </h1>
          <p className="mt-3 max-w-xl text-ink-muted dark:text-ink-muted-dark text-sm md:text-base leading-relaxed">
            {t("destinations.subtitle")}
          </p>
        </header>

        <div className="mb-6">
          <DestTypeToggle />
        </div>

        <section className="bg-surface dark:bg-surface-dark ticket-card border border-ink/10 dark:border-white/10 p-5 md:p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted dark:text-ink-muted-dark" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("destinations.searchPlaceholder")}
                className="w-full pl-11 pr-4 py-3 bg-canvas/60 dark:bg-white/5 border border-ink/10 dark:border-white/10 rounded-xl text-sm text-ink dark:text-ink-dark placeholder:text-ink-muted/70 outline-none focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 transition-all"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="relative min-w-[180px] flex-1 lg:flex-none">
                <select
                  value={category}
                  onChange={(e) => {
                    setLoading(true);
                    setCategory(e.target.value);
                    setPage(1);
                  }}
                  className="w-full appearance-none pl-11 pr-10 py-3 bg-canvas/60 dark:bg-white/5 border border-ink/10 dark:border-white/10 rounded-xl text-sm text-ink dark:text-ink-dark outline-none focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 transition-all cursor-pointer"
                >
                  <option value="">{t("destinations.allCategories")}</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <SlidersHorizontal className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted dark:text-ink-muted-dark pointer-events-none" />
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-ink-muted dark:text-ink-muted-dark">Rp</span>
                <input
                  type="number"
                  min={0}
                  value={minPrice}
                  onChange={(e) => {
                    setLoading(true);
                    setMinPrice(e.target.value);
                    setPage(1);
                  }}
                  placeholder={t("destinations.min")}
                  className="w-28 px-3 py-3 bg-canvas/60 dark:bg-white/5 border border-ink/10 dark:border-white/10 rounded-xl text-sm font-mono text-ink dark:text-ink-dark placeholder:text-ink-muted/70 outline-none focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 transition-all"
                />
                <span className="text-ink-muted dark:text-ink-muted-dark">—</span>
                <input
                  type="number"
                  min={0}
                  value={maxPrice}
                  onChange={(e) => {
                    setLoading(true);
                    setMaxPrice(e.target.value);
                    setPage(1);
                  }}
                  placeholder={t("destinations.max")}
                  className="w-28 px-3 py-3 bg-canvas/60 dark:bg-white/5 border border-ink/10 dark:border-white/10 rounded-xl text-sm font-mono text-ink dark:text-ink-dark placeholder:text-ink-muted/70 outline-none focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 transition-all"
                />
              </div>

              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl border border-ink/15 dark:border-white/15 text-ink-muted dark:text-ink-muted-dark text-xs font-bold hover:border-status-failed/40 hover:text-status-failed transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> {t("destinations.reset")}
                </button>
              )}
            </div>
          </div>
        </section>

        <div className="mt-8 mb-6 flex items-center justify-between">
          <p className="font-mono text-xs text-ink-muted dark:text-ink-muted-dark">{resultLabel}</p>
          {loading && destinations && (
            <span className="font-mono text-xs text-brand-orange dark:text-brand-orange-dark animate-pulse">{t("common.loading")}</span>
          )}
        </div>

        {error ? (
          <div className="rounded-2xl border border-status-failed/30 bg-status-failed/5 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <p className="text-sm font-semibold text-status-failed">{t("destinations.errorTitle")}</p>
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
            <MapPin className="w-8 h-8 text-ink-muted dark:text-ink-muted-dark mx-auto" />
            <p className="mt-4 font-display text-xl text-ink dark:text-ink-dark">{t("destinations.emptyTitle")}</p>
            <p className="mt-2 text-sm text-ink-muted dark:text-ink-muted-dark">
              {t("destinations.emptyDesc")}
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 border-2 border-brand-orange text-brand-orange dark:text-brand-orange-dark text-xs font-semibold rounded-xl hover:bg-brand-orange hover:text-white transition-all"
            >
              <X className="w-3.5 h-3.5" /> {t("destinations.clearFilter")}
            </button>
          </div>
        )}

        {meta && meta.total_pages > 1 && (
          <nav className="mt-12 flex items-center justify-center gap-2" aria-label={t("destinations.pagination")}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl border border-ink/15 dark:border-white/15 text-ink dark:text-ink-dark text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:border-brand-orange hover:text-brand-orange dark:hover:text-brand-orange-dark transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> {t("destinations.previous")}
            </button>

            {pageWindow(page, meta.total_pages).map((p, i) =>
              p === "…" ? (
                <span key={`e-${i}`} className="px-1 text-ink-muted dark:text-ink-muted-dark font-mono text-xs">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  aria-current={p === page ? "page" : undefined}
                  className={`w-10 h-10 rounded-xl font-mono text-xs font-bold transition-colors ${
                    p === page
                      ? "bg-brand-orange text-white shadow-lg shadow-brand-orange/25"
                      : "border border-ink/15 dark:border-white/15 text-ink dark:text-ink-dark hover:border-brand-orange hover:text-brand-orange dark:hover:text-brand-orange-dark"
                  }`}
                >
                  {p}
                </button>
              )
            )}

            <button
              type="button"
              disabled={page >= meta.total_pages}
              onClick={() => setPage((p) => Math.min(meta.total_pages, p + 1))}
              className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl border border-ink/15 dark:border-white/15 text-ink dark:text-ink-dark text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:border-brand-orange hover:text-brand-orange dark:hover:text-brand-orange-dark transition-colors"
            >
              {t("destinations.next")} <ChevronRight className="w-4 h-4" />
            </button>
          </nav>
        )}
      </div>
    </main>
  );
}
