"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  SlidersHorizontal,
  X,
  Search,
  Plane,
  Train,
  Bus,
  Clock,
  UserRound,
  ArrowRight,
} from "lucide-react";
import BackgroundMotif from "../components/BackgroundMotif";
import CheckoutModal from "../components/CheckoutModal";
import DestTypeToggle from "../components/DestTypeToggle";
import { useLanguage } from "../lib/LanguageContext";
import { formatDate, formatTime } from "../lib/formatDate";

type RouteType = "flight" | "train" | "bus";

type TransportRoute = {
  id: number;
  type: RouteType;
  operator_name: string;
  origin_city: string;
  dest_city: string;
  departure_time: string;
  arrival_time: string;
  price: number;
  seat_class: string;
  total_seats: number;
  available_seats: number;
};

type Meta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

const TYPES: { key: RouteType; labelKey: string; icon: typeof Plane }[] = [
  { key: "flight", labelKey: "transport.tabFlight", icon: Plane },
  { key: "train", labelKey: "transport.tabTrain", icon: Train },
  { key: "bus", labelKey: "transport.tabBus", icon: Bus },
];

const PAGE_SIZE = 10;
// Low seats threshold → visual indicator using status-pending color.
const LOW_SEATS_THRESHOLD = 10;

const CARD_SKELETONS = Array.from({ length: 4 });

const formatPrice = (n: number) => new Intl.NumberFormat("id-ID").format(n);

const formatDuration = (dep: string, arr: string, t: (key: string) => string) => {
  const a = new Date(dep).getTime();
  const b = new Date(arr).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return "—";
  const mins = Math.round((b - a) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}${t("transport.durationMinutes")}`;
  if (m === 0) return `${h}${t("transport.durationHours")}`;
  return `${h}${t("transport.durationHours")} ${m}${t("transport.durationMinutes")}`;
};

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

export default function TransportPage() {
  const { locale, t } = useLanguage();

  // Search state. Type defaults to "flight" — first tab active immediately.
  const [type, setType] = useState<RouteType>("flight");
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);

  const [cities, setCities] = useState<string[]>([]);
  const [routes, setRoutes] = useState<TransportRoute[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [bookRoute, setBookRoute] = useState<TransportRoute | null>(null);

  // City catalog fetched ONCE from /transport-routes/cities for dropdown.
  useEffect(() => {
    fetch("/api/transport-routes/cities")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: string[]) => setCities(Array.isArray(data) ? data : []))
      .catch(() => setCities([]));
  }, []);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    params.set("type", type);
    if (origin) params.set("origin_city", origin);
    if (dest) params.set("dest_city", dest);
    if (date) params.set("date", date);

    fetch(`/api/transport-routes?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((body) => {
        setRoutes(body?.data ?? []);
        setMeta(body?.meta ?? null);
        setHasLoaded(true);
        setError(false);
      })
      .catch(() => {
        setError(true);
        setRoutes(null);
        setMeta(null);
      })
      .finally(() => setLoading(false));
  }, [page, type, origin, dest, date]);

  useEffect(() => {
    load();
  }, [load]);

  const resetFilters = () => {
    setLoading(true);
    setOrigin("");
    setDest("");
    setDate("");
    setPage(1);
  };

  const hasActiveFilter = !!(origin || dest || date);
  const resultLabel =
    meta && hasLoaded
      ? t(hasActiveFilter ? "transport.resultFiltered" : "transport.resultCount", { total: meta.total })
      : "";

  const typeLabel = (r: RouteType) => {
    const found = TYPES.find((x) => x.key === r);
    return found ? t(found.labelKey) : r;
  };

  return (
    <main className="relative isolate bg-canvas dark:bg-canvas-dark min-h-screen pb-24">
      <BackgroundMotif dense={false} />
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <header className="pt-12 pb-8">
          <Link
            href="/destinations"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted dark:text-ink-muted-dark hover:text-brand-orange dark:hover:text-brand-orange-dark transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> {t("common.backDestinations")}
          </Link>
          <div className="mt-6 flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.25em] text-brand-orange dark:text-brand-orange-dark">
            <Plane className="w-4 h-4" />
            <span>{t("transport.eyebrow")}</span>
          </div>
          <h1 className="mt-3 font-display font-semibold text-3xl md:text-5xl text-ink dark:text-ink-dark tracking-tight">
            {t("transport.title")}
          </h1>
          <p className="mt-3 max-w-xl text-ink-muted dark:text-ink-muted-dark text-sm md:text-base leading-relaxed">
            {t("transport.subtitle")}
          </p>
        </header>

        <div className="mb-6">
          <DestTypeToggle />
        </div>

        <section className="bg-surface dark:bg-surface-dark ticket-card border border-ink/10 dark:border-white/10 p-5 md:p-6">
          <div className="flex gap-2 mb-5">
            {TYPES.map((tp) => {
              const Icon = tp.icon;
              const active = type === tp.key;
              return (
                <button
                  key={tp.key}
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    setType(tp.key);
                    setPage(1);
                  }}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    active
                      ? "bg-brand-orange text-white shadow-lg shadow-brand-orange/25"
                      : "bg-canvas/60 dark:bg-white/5 border border-ink/10 dark:border-white/10 text-ink-muted dark:text-ink-muted-dark hover:text-brand-orange dark:hover:text-brand-orange-dark hover:border-brand-orange/40"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t(tp.labelKey)}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
              <label htmlFor="transport-origin" className="sr-only">{t("transport.originLabel")}</label>
              <select
                id="transport-origin"
                value={origin}
                onChange={(e) => {
                  setLoading(true);
                  setOrigin(e.target.value);
                  setPage(1);
                }}
                className="w-full appearance-none pl-11 pr-10 py-3 bg-canvas/60 dark:bg-white/5 border border-ink/10 dark:border-white/10 rounded-xl text-sm text-ink dark:text-ink-dark outline-none focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 transition-all cursor-pointer"
              >
                <option value="">{t("transport.allCities")}</option>
                {cities.map((c) => (
                  <option key={`o-${c}`} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <SlidersHorizontal className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
            </div>

            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
              <label htmlFor="transport-dest" className="sr-only">{t("transport.destLabel")}</label>
              <select
                id="transport-dest"
                value={dest}
                onChange={(e) => {
                  setLoading(true);
                  setDest(e.target.value);
                  setPage(1);
                }}
                className="w-full appearance-none pl-11 pr-10 py-3 bg-canvas/60 dark:bg-white/5 border border-ink/10 dark:border-white/10 rounded-xl text-sm text-ink dark:text-ink-dark outline-none focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 transition-all cursor-pointer"
              >
                <option value="">{t("transport.allCities")}</option>
                {cities.map((c) => (
                  <option key={`d-${c}`} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <SlidersHorizontal className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
            </div>

            <div className="relative flex-1">
              <label htmlFor="transport-date" className="sr-only">{t("transport.dateLabel")}</label>
              <input
                id="transport-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setLoading(true);
                  setDate(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-3 bg-canvas/60 dark:bg-white/5 border border-ink/10 dark:border-white/10 rounded-xl text-sm text-ink dark:text-ink-dark outline-none focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 transition-all"
              />
            </div>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-ink/15 dark:border-white/15 text-ink-muted dark:text-ink-muted-dark text-xs font-bold hover:border-status-failed/40 hover:text-status-failed transition-colors"
              >
                <X className="w-3.5 h-3.5" /> {t("transport.reset")}
              </button>
            )}
          </div>
        </section>

        <div className="mt-8 mb-6 flex items-center justify-between">
          <p className="font-mono text-xs text-ink-muted dark:text-ink-muted-dark">{resultLabel}</p>
          {loading && routes && (
            <span className="font-mono text-xs text-brand-orange animate-pulse">{t("common.loading")}</span>
          )}
        </div>

        {error ? (
          <div className="rounded-2xl border border-status-failed/30 bg-status-failed/5 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <p className="text-sm font-semibold text-status-failed">{t("transport.errorTitle")}</p>
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">
                {t("common.goBackendError")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setError(false);
                setLoading(true);
                load();
              }}
              className="sm:ml-auto px-4 py-2.5 rounded-xl border border-status-failed/40 text-status-failed text-xs font-bold hover:bg-status-failed/10 transition-colors flex items-center gap-2 w-fit"
            >
              <RefreshCw className="w-3.5 h-3.5" /> {t("common.retry")}
            </button>
          </div>
        ) : loading && !routes ? (
          <div className="space-y-4">
            {CARD_SKELETONS.map((_, i) => (
              <div key={i} className="bg-surface dark:bg-surface-dark rounded-3xl border border-ink/10 dark:border-white/10 p-5 flex gap-5">
                <div className="w-14 h-14 rounded-2xl bg-ink/5 dark:bg-white/5 animate-pulse shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-1/3 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                  <div className="h-3 w-1/4 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : routes && routes.length > 0 ? (
          <div className="space-y-4">
            {routes.map((r) => {
              const soldOut = r.available_seats <= 0;
              const lowSeats = !soldOut && r.available_seats <= LOW_SEATS_THRESHOLD;
              const TypeIcon = TYPES.find((x) => x.key === r.type)?.icon ?? Plane;
              return (
                <article
                  key={r.id}
                  onClick={() => !soldOut && setBookRoute(r)}
                  aria-label={t("transport.viewDetail", {
                    name: `${r.operator_name} ${r.origin_city} ${r.dest_city}`,
                  })}
                  className={`group bg-surface dark:bg-surface-dark ticket-card border border-ink/10 dark:border-white/10 hover:border-brand-orange/60 dark:hover:border-brand-orange-dark/60 hover:scale-[1.005] transition-all duration-300 rounded-3xl p-5 md:p-6 flex flex-col md:flex-row gap-5 ${
                    soldOut ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  <div className="flex items-start gap-4 md:w-44 shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-brand-orange/10 text-brand-orange dark:text-brand-orange-dark flex items-center justify-center border border-brand-orange/25">
                      <TypeIcon className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-ink dark:text-ink-dark text-sm leading-snug">{r.operator_name}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand-orange dark:text-brand-orange-dark mt-1">
                        {typeLabel(r.type)} · {r.seat_class || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-lg font-bold text-ink dark:text-ink-dark">{formatTime(r.departure_time, locale)}</p>
                        <p className="text-xs text-ink-muted dark:text-ink-muted-dark truncate">{r.origin_city}</p>
                      </div>
                      <div className="flex-1 flex flex-col items-center px-1">
                        <span className="font-mono text-[9px] text-ink-muted dark:text-ink-muted-dark uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {formatDuration(r.departure_time, r.arrival_time, t)}
                        </span>
                        <div className="w-full flex items-center gap-1 mt-1">
                          <span className="h-px flex-1 border-t border-dashed border-ink/25 dark:border-white/25" />
                          <ArrowRight className="w-3.5 h-3.5 text-brand-orange dark:text-brand-orange-dark" />
                        </div>
                        <span className="font-mono text-[9px] text-ink-muted dark:text-ink-muted-dark mt-0.5">
                          {formatDate(r.departure_time, locale)}
                        </span>
                      </div>
                      <div className="min-w-0 text-right">
                        <p className="font-mono text-lg font-bold text-ink dark:text-ink-dark">{formatTime(r.arrival_time, locale)}</p>
                        <p className="text-xs text-ink-muted dark:text-ink-muted-dark truncate">{r.dest_city}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end sm:text-right">
                      <div className="sm:hidden">
                        {lowSeats && (
                          <span className="text-[10px] font-bold text-status-pending dark:text-status-pending-dark uppercase tracking-wider">
                            {t("transport.seatsLeft", { n: r.available_seats })}
                          </span>
                        )}
                        {soldOut && (
                          <span className="text-[10px] font-bold text-status-failed dark:text-status-failed-dark uppercase tracking-wider">
                            {t("transport.seatsSoldOut")}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-mono text-base md:text-lg font-bold text-ink dark:text-ink-dark">
                          Rp {formatPrice(r.price)}
                        </p>
                        <p className="text-[10px] text-ink-muted dark:text-ink-muted-dark mt-1 flex items-center justify-end gap-1">
                          <UserRound className="w-3 h-3" />
                          {t("transport.seatsCount", { available: r.available_seats, total: r.total_seats })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex md:flex-col items-center justify-between md:justify-center gap-3 md:w-28 shrink-0">
                    {lowSeats && (
                      <span className="hidden md:inline-flex px-2.5 py-1 rounded-full border border-status-pending/40 bg-status-pending/10 text-status-pending dark:text-status-pending-dark text-[9px] font-bold uppercase tracking-wider">
                        {t("transport.seatsLeft", { n: r.available_seats })}
                      </span>
                    )}
                    {soldOut && (
                      <span className="hidden md:inline-flex px-2.5 py-1 rounded-full border border-status-failed/40 bg-status-failed/10 text-status-failed dark:text-status-failed-dark text-[9px] font-bold uppercase tracking-wider">
                        {t("transport.seatsSoldOut")}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        soldOut
                          ? "bg-ink/5 dark:bg-white/5 text-ink-muted/50 dark:text-ink-muted-dark/50 cursor-not-allowed"
                          : "bg-brand-orange text-white shadow-lg shadow-brand-orange/25 group-hover:bg-brand-orange/90"
                      }`}
                    >
                      {t("transport.book")}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-ink/20 dark:border-white/15 p-12 text-center">
            <Plane className="w-8 h-8 text-ink-muted dark:text-ink-muted-dark mx-auto" />
            <p className="mt-4 font-display text-xl text-ink dark:text-ink-dark">{t("transport.emptyTitle")}</p>
            <p className="mt-2 text-sm text-ink-muted dark:text-ink-muted-dark">
              {t("transport.emptyDesc")}
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 border-2 border-brand-orange text-brand-orange dark:text-brand-orange-dark text-xs font-semibold rounded-xl hover:bg-brand-orange hover:text-white transition-all"
            >
              <X className="w-3.5 h-3.5" /> {t("transport.clearFilter")}
            </button>
          </div>
        )}
        {meta && meta.total_pages > 1 && (
          <nav className="mt-12 flex items-center justify-center gap-2" aria-label={t("transport.pagination")}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl border border-ink/15 dark:border-white/15 text-ink dark:text-ink-dark text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:border-brand-orange dark:hover:border-brand-orange-dark hover:text-brand-orange dark:hover:text-brand-orange-dark transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> {t("transport.previous")}
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
                      : "border border-ink/15 dark:border-white/15 text-ink dark:text-ink-dark hover:border-brand-orange dark:hover:border-brand-orange-dark hover:text-brand-orange dark:hover:text-brand-orange-dark"
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
              className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl border border-ink/15 dark:border-white/15 text-ink dark:text-ink-dark text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:border-brand-orange dark:hover:border-brand-orange-dark hover:text-brand-orange dark:hover:text-brand-orange-dark transition-colors"
            >
              {t("transport.next")} <ChevronRight className="w-4 h-4" />
            </button>
          </nav>
        )}
      </div>

      <CheckoutModal
        isOpen={!!bookRoute}
        onClose={() => setBookRoute(null)}
        product={
          bookRoute
            ? {
                id: bookRoute.id,
                name: `${bookRoute.operator_name} — ${bookRoute.origin_city} → ${bookRoute.dest_city}`,
                price: `Rp ${formatPrice(bookRoute.price)}`,
                priceValue: bookRoute.price,
                store: `${typeLabel(bookRoute.type)} · ${bookRoute.seat_class || "—"}`,
                kind: "transport",
                transportType: bookRoute.type,
                maxQuantity: bookRoute.available_seats,
              }
            : undefined
        }
      />
    </main>
  );
}
