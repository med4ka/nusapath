"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { m, useReducedMotion } from "framer-motion";
import { Clock, CheckCircle2, Stamp, XCircle, Copy, Box, X, Plane, Train, Bus, MapPin, ArrowRight, Ban } from "lucide-react";
import { toast } from "../lib/toast";
import { useAuth } from "../lib/AuthContext";
import { useLanguage } from "../lib/LanguageContext";
import { formatDate, formatTime } from "../lib/formatDate";
import BackgroundMotif from "../components/BackgroundMotif";

type TransportType = "flight" | "train" | "bus";

type HistoryItem = {
  id: number;
  type?: "destination" | "transport" | "hotel";
  destination_id?: number;
  destination_name?: string;
  destination_image?: string;
  transport_route_id?: number;
  transport_type?: TransportType;
  operator_name?: string;
  origin_city?: string;
  dest_city?: string;
  departure_time?: string;
  arrival_time?: string;
  seat_class?: string;
  hotel_id?: number;
  hotel_name?: string;
  hotel_city?: string;
  hotel_image?: string;
  check_in_date?: string;
  check_out_date?: string;
  night_count?: number;
  star_rating?: number;
  quantity?: number;
  status: "PENDING_PAYMENT" | "PAID" | "TICKET_ISSUED" | "FAILED" | "CANCELLED" | string;
  ticket_hash?: string;
  amount_paid: number;
  booking_date: string;
};

const STATUS_META: Record<string, { labelKey: string; color: string; icon: typeof Clock }> = {
  PENDING_PAYMENT: { labelKey: "booking.statusPending", color: "text-status-pending dark:text-status-pending-dark border-status-pending/40 dark:border-status-pending-dark/50 bg-status-pending/10", icon: Clock },
  PAID: { labelKey: "booking.statusPaid", color: "text-status-paid dark:text-status-paid-dark border-status-paid/40 dark:border-status-paid-dark/50 bg-status-paid/10", icon: CheckCircle2 },
  TICKET_ISSUED: { labelKey: "booking.statusIssued", color: "text-stamp-red dark:text-stamp-red border-stamp-red/40 dark:border-stamp-red/50 bg-stamp-red/10", icon: Stamp },
  FAILED: { labelKey: "booking.statusFailed", color: "text-status-failed dark:text-status-failed-dark border-status-failed/40 dark:border-status-failed-dark/50 bg-status-failed/10", icon: XCircle },
  CANCELLED: { labelKey: "booking.statusCancelled", color: "text-ink-muted dark:text-ink-muted-dark border-ink/20 dark:border-white/20 bg-ink/5 dark:bg-white/5", icon: Ban },
};

const FILTERS: { key: "all" | "PENDING_PAYMENT" | "TICKET_ISSUED" | "CANCELLED"; labelKey: string }[] = [
  { key: "all", labelKey: "booking.filterAll" },
  { key: "PENDING_PAYMENT", labelKey: "booking.filterPending" },
  { key: "TICKET_ISSUED", labelKey: "booking.filterIssued" },
  { key: "CANCELLED", labelKey: "booking.filterCancelled" },
];

const formatRupiah = (n: number) => new Intl.NumberFormat("id-ID").format(n);

export default function Booking() {
  const { user } = useAuth();
  const { locale, t } = useLanguage();
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [detail, setDetail] = useState<HistoryItem | null>(null);
  const [mounted, setMounted] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<HistoryItem | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/bookings/me")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setHistory(data);
          setHistoryError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setHistoryError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filtered =
    filter === "all" ? history : history?.filter((item) => item.status === filter) ?? null;

  const isTransport = (item: HistoryItem) => item.type === "transport";
  const isHotel = (item: HistoryItem) => item.type === "hotel";
  const isCancelled = (item: HistoryItem) => item.status === "CANCELLED";
  const isPending = (item: HistoryItem) => item.status === "PENDING_PAYMENT";

  const glyphElement = (item: HistoryItem, size: string) =>
    item.transport_type === "train" ? (
      <Train className={size} />
    ) : item.transport_type === "bus" ? (
      <Bus className={size} />
    ) : (
      <Plane className={size} />
    );

  const modalTitle = detail
    ? isTransport(detail)
      ? `${detail.operator_name ?? ""} — ${detail.origin_city ?? ""} → ${detail.dest_city ?? ""}`
      : isHotel(detail)
      ? detail.hotel_name
      : detail.destination_name
    : "";

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/booking/${cancelTarget.id}/cancel`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? t("booking.cancelFail"));
      }
      setHistory((prev) =>
        prev?.map((item) =>
          item.id === cancelTarget.id ? { ...item, status: "CANCELLED" as const } : item
        ) ?? null
      );
      toast.success(t("booking.cancelSuccess"));
      setCancelTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("booking.cancelFail"));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="relative isolate bg-canvas dark:bg-canvas-dark min-h-screen pb-20">
      <BackgroundMotif dense={false} />

      <main className="max-w-6xl mx-auto px-6 pt-8 md:pt-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-ink-dark tracking-tight">{t("booking.title")}</h2>
            <p className="text-sm text-gray-400 dark:text-ink-muted-dark mt-1 font-medium">
              {t("booking.subtitle")}
            </p>
          </div>
        </div>

        {user && (
          <div className="flex gap-2 bg-white dark:bg-surface-dark p-1 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm w-fit mb-6">
            {FILTERS.map((f) => {
              const count =
                f.key === "all"
                  ? history?.length
                  : history?.filter((i) => i.status === f.key).length;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all ${
                    filter === f.key
                      ? "bg-orange-700 text-white shadow-lg shadow-orange-100 dark:shadow-brand-orange/30"
                      : "text-gray-400 dark:text-ink-muted-dark hover:text-orange-700 dark:hover:text-brand-orange-dark"
                  }`}
                >
                  {t(f.labelKey)}
                  {count !== undefined ? (
                    <span className={`ml-1.5 ${filter === f.key ? "text-orange-100" : "text-gray-300 dark:text-ink-muted-dark"}`}>
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {!user ? (
            <div className="bg-white dark:bg-surface-dark p-10 rounded-[2rem] border border-dashed border-ink/20 dark:border-white/15 text-center">
              <p className="text-sm font-bold text-ink dark:text-ink-dark">{t("booking.notLoggedTitle")}</p>
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">{t("booking.notLoggedDesc")}</p>
              <Link
                href="/"
                className="inline-block mt-5 px-6 py-3 bg-brand-orange text-white text-xs font-bold rounded-xl hover:bg-brand-orange/90 transition-colors"
              >
                {t("common.backHome")}
              </Link>
            </div>
          ) : historyError ? (
            <div className="bg-white dark:bg-surface-dark p-10 rounded-[2rem] border border-status-failed/30 text-center">
              <p className="text-sm font-bold text-status-failed dark:text-status-failed-dark">{t("booking.errorTitle")}</p>
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">{t("common.goBackendError")}</p>
            </div>
          ) : history === null ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-surface-dark p-6 rounded-[2rem] border border-ink/10 dark:border-white/10 flex items-center gap-4">
                  <div className="w-24 h-24 rounded-xl bg-ink/5 dark:bg-white/5 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                    <div className="h-3 w-1/3 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                    <div className="h-3 w-1/4 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered && filtered.length === 0 ? (
            <div className="bg-white dark:bg-surface-dark p-10 rounded-[2rem] border border-dashed border-ink/20 dark:border-white/15 text-center">
              <Stamp className="w-8 h-8 text-ink-muted dark:text-ink-muted-dark mx-auto mb-3" />
              <p className="text-sm font-bold text-ink dark:text-ink-dark">{t("booking.emptyTitle")}</p>
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">
                {filter === "all" ? t("booking.emptyAll") : t("booking.emptyFiltered")}
              </p>
            </div>
          ) : filtered ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filtered.map((item) => {
                const meta = STATUS_META[item.status] ?? STATUS_META.FAILED;
                const StatusIcon = meta.icon;
                const canDetail = item.status === "TICKET_ISSUED" && !!item.ticket_hash;
                const cancelled = isCancelled(item);
                const transport = isTransport(item);
                const hotel = isHotel(item);
                const title = transport
                  ? `${item.operator_name ?? ""} — ${item.origin_city ?? ""} → ${item.dest_city ?? ""}`
                  : hotel
                  ? item.hotel_name
                  : item.destination_name;
                return (
                  <div
                    key={item.id}
                    onClick={() => canDetail && setDetail(item)}
                    className={`bg-white dark:bg-surface-dark p-6 rounded-[2rem] border flex items-center gap-4 transition-all ${cancelled ? "border-ink/5 dark:border-white/5 opacity-60" : "border-ink/10 dark:border-white/10"} ${canDetail ? "cursor-pointer hover:border-brand-orange/50 dark:hover:border-brand-orange-dark/60 hover:shadow-md" : ""}`}
                  >
                    <div className={`w-24 h-24 rounded-xl overflow-hidden shrink-0 border flex items-center justify-center ${cancelled ? "bg-ink/5 dark:bg-white/5 border-ink/5 dark:border-white/5" : "bg-ink/5 dark:bg-white/5 border-ink/10 dark:border-white/10"}`}>
                      {transport ? (
                        <div className={`w-full h-full flex items-center justify-center ${cancelled ? "text-ink-muted/40 dark:text-ink-muted-dark/40" : "bg-brand-orange/10 text-brand-orange dark:text-brand-orange-dark"}`}>
                          {glyphElement(item, "w-9 h-9")}
                        </div>
                      ) : hotel ? (
                        item.hotel_image ? (
                          <Image src={item.hotel_image} alt={title ?? "hotel"} width={96} height={96} quality={85} className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${cancelled ? "text-ink-muted/40 dark:text-ink-muted-dark/40" : "bg-brand-orange/10 text-brand-orange dark:text-brand-orange-dark"}`}>
                            <MapPin className="w-8 h-8" />
                          </div>
                        )
                      ) : item.destination_image ? (
                        <Image src={item.destination_image} alt={title ?? "booking"} width={96} height={96} quality={85} className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-bold text-sm truncate ${cancelled ? "text-ink-muted dark:text-ink-muted-dark" : "text-gray-800 dark:text-ink-dark"}`}>{title}</h4>
                      {transport ? (
                        <p className="text-[10px] text-gray-400 dark:text-ink-muted-dark font-bold mt-0.5 truncate">
                          {item.origin_city} → {item.dest_city} · {formatTime(item.departure_time, locale)} – {formatTime(item.arrival_time, locale)} · {item.seat_class || "—"}
                        </p>
                      ) : hotel ? (
                        <p className="text-[10px] text-gray-400 dark:text-ink-muted-dark font-bold mt-0.5 truncate">
                          {item.hotel_city} · {"★".repeat(item.star_rating ?? 0)}
                        </p>
                      ) : null}
                      <p className="text-[10px] text-gray-400 dark:text-ink-muted-dark uppercase font-bold mt-0.5">{formatDate(item.booking_date, locale)}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-bold uppercase tracking-wider ${meta.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {t(meta.labelKey)}
                        </span>
                        {canDetail && <span className="text-[9px] font-bold text-brand-orange dark:text-brand-orange-dark uppercase">{t("booking.viewTicket")}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-2">
                      <p className={`font-mono text-sm font-bold ${cancelled ? "text-ink-muted/50 dark:text-ink-muted-dark/50" : "text-ink dark:text-ink-dark"}`}>Rp {formatRupiah(item.amount_paid)}</p>
                      {hotel ? (
                        <p className="text-[9px] text-gray-400 dark:text-ink-muted-dark">{t("hotels.nights", { n: item.night_count ?? 1 })}</p>
                      ) : transport ? (
                        <p className="text-[9px] text-gray-400 dark:text-ink-muted-dark">{t("transport.seatsCount", { available: item.quantity ?? 0, total: item.quantity ?? 0 })}</p>
                      ) : null}
                      {isPending(item) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setCancelTarget(item); }}
                          className="text-[9px] font-bold text-ink-muted dark:text-ink-muted-dark hover:text-status-failed dark:hover:text-status-failed-dark border border-ink/20 dark:border-white/20 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          {t("booking.cancelButton")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      </main>

      {cancelTarget && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => !cancelling && setCancelTarget(null)}></div>
          <div className="relative w-full max-w-sm bg-white dark:bg-surface-dark rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in duration-300">
            <div className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-2xl border-2 border-status-failed/30 text-status-failed flex items-center justify-center">
                <Ban className="w-7 h-7" />
              </div>
              <h3 className="font-display font-semibold text-lg text-ink dark:text-ink-dark">{t("booking.cancelConfirmTitle")}</h3>
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-2">{t("booking.cancelConfirmDesc")}</p>
              <p className="text-sm font-bold text-ink dark:text-ink-dark mt-4 truncate font-mono">
                {cancelTarget.type === "transport"
                  ? `${cancelTarget.operator_name ?? ""} — ${cancelTarget.origin_city ?? ""} → ${cancelTarget.dest_city ?? ""}`
                  : cancelTarget.type === "hotel"
                  ? cancelTarget.hotel_name
                  : cancelTarget.destination_name}
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
                className="flex-1 py-3 border border-ink/15 dark:border-white/20 text-ink dark:text-ink-dark text-xs font-bold rounded-xl hover:bg-ink/5 dark:hover:bg-white/10 transition-colors disabled:opacity-40"
              >
                {t("booking.cancelConfirmNo")}
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 py-3 bg-status-failed text-white text-xs font-bold rounded-xl hover:bg-status-failed/90 transition-colors disabled:opacity-40"
              >
                {cancelling ? t("common.loading") : t("booking.cancelConfirmYes")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {detail && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setDetail(null)}></div>
          <div className="relative w-full max-w-sm bg-white dark:bg-surface-dark rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in duration-300 overflow-hidden">
            <button onClick={() => setDetail(null)} className="absolute top-5 right-5 p-2 bg-gray-50 dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 rounded-full transition-colors">
              <X className="w-4 h-4 text-gray-500 dark:text-ink-muted-dark" />
            </button>

            <div className="text-center pt-2">
              <m.div
                initial={reduce ? false : { scale: 1.4, rotate: -8, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="mx-auto mb-5 w-24 h-24 rounded-2xl border-[3px] border-stamp-red text-stamp-red flex flex-col items-center justify-center gap-1 rotate-[-4deg]"
              >
                <Stamp className="w-6 h-6" />
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] leading-tight">
                  {t("booking.modalStamp1")}
                  <br />
                  {t("booking.modalStamp2")}
                </span>
              </m.div>
              <h2 className="font-display font-semibold text-xl text-ink dark:text-ink-dark tracking-tight">
                {modalTitle}
              </h2>
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1 font-mono">{formatDate(detail.booking_date, locale)}</p>
            </div>

            <div className="mt-6 ticket-card bg-canvas/60 dark:bg-canvas-dark/80 border border-ink/10 dark:border-white/10 p-5 space-y-4">
              {isTransport(detail) && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-orange/10 text-brand-orange dark:text-brand-orange-dark flex items-center justify-center border border-brand-orange/25">
                      {glyphElement(detail, "w-5 h-5")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest">{t("booking.modalOperator")}</p>
                      <p className="text-sm font-bold text-ink dark:text-ink-dark truncate">{detail.operator_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest">{t("booking.modalSeatClass")}</p>
                      <p className="text-sm font-bold text-ink dark:text-ink-dark">{detail.seat_class || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-surface dark:bg-white/5 border border-ink/10 dark:border-white/10 p-4">
                    <div className="text-left">
                      <p className="font-mono text-base font-bold text-ink dark:text-ink-dark">{formatTime(detail.departure_time, locale)}</p>
                      <p className="text-[10px] text-ink-muted dark:text-ink-muted-dark flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {detail.origin_city}
                      </p>
                    </div>
                    <div className="flex-1 flex items-center px-2">
                      <div className="w-full flex items-center gap-1">
                        <span className="h-px flex-1 border-t border-dashed border-ink/25 dark:border-white/25" />
                        <ArrowRight className="w-3.5 h-3.5 text-brand-orange dark:text-brand-orange-dark" />
                        <span className="h-px flex-1 border-t border-dashed border-ink/25 dark:border-white/25" />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-base font-bold text-ink dark:text-ink-dark">{formatTime(detail.arrival_time, locale)}</p>
                      <p className="text-[10px] text-ink-muted dark:text-ink-muted-dark flex items-center gap-1 justify-end mt-0.5">
                        {detail.dest_city} <MapPin className="w-3 h-3" />
                      </p>
                    </div>
                  </div>
                </>
              )}
              {isHotel(detail) && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-orange/10 text-brand-orange dark:text-brand-orange-dark flex items-center justify-center border border-brand-orange/25">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest">{t("hotels.modalCity")}</p>
                    <p className="text-sm font-bold text-ink dark:text-ink-dark truncate">{detail.hotel_city}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest">{t("hotels.modalStarRating")}</p>
                    <p className="text-sm font-bold text-ink dark:text-ink-dark">{"★".repeat(detail.star_rating ?? 0)}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest">{t("booking.modalTotal")}</span>
                <span className="font-mono text-sm font-bold text-ink dark:text-ink-dark">Rp {formatRupiah(detail.amount_paid)}</span>
              </div>
              {isHotel(detail) && detail.check_in_date && detail.check_out_date && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest">
                    {formatDate(detail.check_in_date, locale)} — {formatDate(detail.check_out_date, locale)}
                  </span>
                  <span className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark">
                    {t("hotels.nights", { n: detail.night_count ?? 1 })}
                  </span>
                </div>
              )}
              <div className="border-t border-dashed border-ink/15 dark:border-white/20 pt-4">
                <p className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest mb-1 flex items-center gap-1">
                  <Box className="w-3 h-3" /> {t("booking.modalCode")}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 bg-surface dark:bg-white/10 text-ink-muted dark:text-ink-muted-dark text-[10px] px-3 py-2 rounded-lg truncate font-mono border border-ink/10 dark:border-white/10">
                    {detail.ticket_hash}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(detail.ticket_hash ?? "");
                      toast.info(t("booking.copyCopied"));
                    }}
                    className="p-2 bg-surface dark:bg-white/10 rounded-lg border border-ink/10 dark:border-white/10 hover:border-brand-orange dark:hover:border-brand-orange-dark hover:text-brand-orange dark:hover:text-brand-orange-dark transition-colors text-ink-muted dark:text-ink-muted-dark"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-stamp-red">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em]">
                  {t("booking.modalStatus")}
                </span>
              </div>
            </div>

            <button
              onClick={() => setDetail(null)}
              className="w-full mt-6 py-3.5 bg-ink text-white font-bold text-xs rounded-xl hover:bg-black transition-colors"
            >
              {t("booking.close")}
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
