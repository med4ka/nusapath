"use client";

import { useState } from "react";
import { Search, Stamp, CheckCircle2, XCircle, ShieldCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { m, useReducedMotion } from "framer-motion";
import { useLanguage } from "../lib/LanguageContext";
import BackgroundMotif from "../components/BackgroundMotif";

type VerifyResult = {
  valid: boolean;
  item_type: string;
  item_name: string;
  amount_paid: number;
  booking_date: string;
  ticket_hash: string;
  user_initial: string;
};

const formatRupiah = (n: number) => new Intl.NumberFormat("id-ID").format(n);

export default function Verify() {
  const { locale, t } = useLanguage();
  const reduce = useReducedMotion();
  const [hash, setHash] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handleVerify = async () => {
    const trimmed = hash.trim();
    if (!trimmed) return;
    setLoading(true);
    setResult(null);
    setNotFound(false);
    setError(false);
    try {
      const res = await fetch(`/api/tickets/verify/${encodeURIComponent(trimmed)}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResult(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "destination": return t("verify.typeDestination");
      case "transport": return t("verify.typeTransport");
      case "hotel": return t("verify.typeHotel");
      default: return type;
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(locale === "en" ? "en-US" : locale === "de" ? "de-DE" : "id-ID", {
        year: "numeric", month: "short", day: "numeric",
      }).format(new Date(iso));
    } catch { return iso; }
  };

  return (
    <div className="relative isolate bg-canvas dark:bg-canvas-dark min-h-screen pb-20">
      <BackgroundMotif />

      <main className="max-w-2xl mx-auto px-6 pt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-muted dark:text-ink-muted-dark hover:text-brand-orange dark:hover:text-brand-orange-dark transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {t("common.backHome")}
        </Link>

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-orange/10 text-brand-orange flex items-center justify-center mx-auto mb-4 border border-brand-orange/25">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="font-display font-semibold text-3xl text-ink dark:text-ink-dark tracking-tight">{t("verify.title")}</h1>
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark mt-2">{t("verify.subtitle")}</p>
        </div>

        <div className="bg-surface dark:bg-surface-dark p-6 rounded-[2rem] border border-ink/10 dark:border-white/10 mb-8">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              placeholder={t("verify.inputPlaceholder")}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              className="flex-1 bg-canvas dark:bg-canvas-dark text-ink dark:text-ink-dark border border-ink/15 dark:border-white/15 rounded-xl px-4 py-3 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-brand-orange placeholder:text-ink-muted/60"
            />
            <button
              onClick={handleVerify}
              disabled={loading || !hash.trim()}
              className="px-5 py-3 bg-brand-orange text-white text-xs font-bold rounded-xl hover:bg-brand-orange/90 transition-colors disabled:opacity-40 flex items-center gap-1.5"
            >
              {loading ? (
                <><Search className="w-3.5 h-3.5 animate-spin" /> {t("common.loading")}</>
              ) : (
                <><Search className="w-3.5 h-3.5" /> {t("verify.button")}</>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-surface dark:bg-surface-dark p-8 rounded-[2rem] border border-status-failed/30 text-center">
            <XCircle className="w-10 h-10 text-status-failed mx-auto mb-3" />
            <p className="text-sm font-bold text-status-failed dark:text-status-failed-dark">{t("verify.errorTitle")}</p>
            <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">{t("verify.errorDesc")}</p>
          </div>
        )}

        {notFound && (
          <div className="bg-surface dark:bg-surface-dark p-8 rounded-[2rem] border border-dashed border-ink/20 dark:border-white/15 text-center">
            <XCircle className="w-10 h-10 text-ink-muted mx-auto mb-3" />
            <p className="text-sm font-bold text-ink dark:text-ink-dark">{t("verify.invalidTitle")}</p>
            <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">{t("verify.invalidDesc")}</p>
          </div>
        )}

        {result && (
          <div className="bg-surface dark:bg-surface-dark rounded-[2rem] border border-status-paid/40 dark:border-status-paid-dark/40 overflow-hidden">
            <div className="bg-status-paid/10 dark:bg-status-paid-dark/10 p-6 text-center border-b border-status-paid/20 dark:border-status-paid-dark/20">
              <m.div
                initial={reduce ? false : { scale: 1.4, rotate: -8, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="mx-auto mb-4 w-24 h-24 rounded-2xl border-[3px] border-status-paid dark:border-status-paid-dark text-status-paid dark:text-status-paid-dark flex flex-col items-center justify-center gap-1 rotate-[-4deg]"
              >
                <Stamp className="w-6 h-6" />
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] leading-tight">
                  {t("checkout.stampLine1")}
                  <br />
                  {t("checkout.stampLine2")}
                </span>
              </m.div>
              <h2 className="font-display font-semibold text-xl text-status-paid dark:text-status-paid-dark">{t("verify.validTitle")}</h2>
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">{t("verify.validDesc")}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest">{t("verify.itemType")}</p>
                  <p className="text-sm font-bold text-ink dark:text-ink-dark mt-0.5">{typeLabel(result.item_type)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest">{t("verify.itemName")}</p>
                  <p className="text-sm font-bold text-ink dark:text-ink-dark mt-0.5 truncate">{result.item_name}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest">{t("verify.amountPaid")}</p>
                  <p className="text-sm font-bold text-ink dark:text-ink-dark mt-0.5 font-mono">Rp {formatRupiah(result.amount_paid)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest">{t("verify.bookingDate")}</p>
                  <p className="text-sm font-bold text-ink dark:text-ink-dark mt-0.5 font-mono">{formatDate(result.booking_date)}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest">{t("verify.userInitial")}</p>
                <p className="text-sm font-bold text-ink dark:text-ink-dark mt-0.5">{result.user_initial || "—"}</p>
              </div>
              <div className="border-t border-dashed border-ink/15 dark:border-white/20 pt-4">
                <p className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest mb-1">{t("verify.ticketHash")}</p>
                <code className="block bg-canvas dark:bg-canvas-dark text-ink-muted dark:text-ink-muted-dark text-[10px] px-3 py-2 rounded-lg font-mono border border-ink/10 dark:border-white/10 break-all">
                  {result.ticket_hash}
                </code>
              </div>
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={() => { setResult(null); setNotFound(false); setHash(""); }}
                className="w-full py-3 bg-ink text-white text-xs font-bold rounded-xl hover:bg-black transition-colors"
              >
                {t("verify.searchAnother")}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
