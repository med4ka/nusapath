"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, Wallet, Map, Calendar, CheckCircle2 } from "lucide-react";
import { toast } from "../lib/toast";
import { useLanguage } from "../lib/LanguageContext";

type ItineraryDay = {
  day: number;
  theme: string;
  activities: string[];
};

const LOADING_STEP_KEYS = [
  "smartrip.loadingStep1",
  "smartrip.loadingStep2",
  "smartrip.loadingStep3",
  "smartrip.loadingStep4",
];

const DAY_CARD_VARIANTS = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
};

export default function SmartTrip() {
  const reduce = useReducedMotion();
  const { t } = useLanguage();

  const [budget, setBudget] = useState("Menengah");
  const [style, setStyle] = useState("Budaya & Sejarah");
  const [days, setDays] = useState(3);

  const [isLoading, setIsLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [itinerary, setItinerary] = useState<ItineraryDay[] | null>(null);

  useEffect(() => {
    if (!isLoading) return;
    const id = setInterval(() => {
      setStepIndex((i) => (i + 1) % LOADING_STEP_KEYS.length);
    }, 2400);
    return () => clearInterval(id);
  }, [isLoading]);

  const generateTrip = async () => {
    setIsLoading(true);
    setItinerary(null);
    toast.loading(t("smartrip.loadingToast"));

    try {
      const res = await fetch("/api/smart-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget, style, days: Number(days) }),
      });

      if (!res.ok) throw new Error(t("smartrip.errorBackend"));

      const rawText = await res.text();

      try {
        const data = JSON.parse(rawText);
        setItinerary(data);
        toast.dismiss();
        toast.success(t("smartrip.successToast"));
      } catch {
        console.error("Bukan JSON murni:", rawText);
        toast.dismiss();
        toast.error(t("smartrip.errorFormat"));
      }
    } catch (err) {
      toast.dismiss();
      toast.error(t("smartrip.errorConnection"));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="bg-canvas dark:bg-canvas-dark text-ink dark:text-ink-dark min-h-screen pb-24">
      <section className="pt-14 md:pt-24 pb-10 md:pb-14">
        <div className="max-w-4xl mx-auto px-4 md:px-8">
          <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-brand-orange dark:text-brand-orange-dark">
            {t("smartrip.eyebrow")}
          </span>
          <h1 className="mt-6 font-display font-semibold text-4xl md:text-6xl leading-[1.05] tracking-tight max-w-3xl">
            {t("smartrip.title1")}
            <br />
            <span className="text-brand-orange dark:text-brand-orange-dark">{t("smartrip.title2")}</span>
          </h1>
          <p className="mt-6 max-w-xl text-ink-muted dark:text-ink-muted-dark text-base md:text-lg leading-relaxed">
            {t("smartrip.subtitle")}
          </p>
        </div>
      </section>

      <section>
        <div className="max-w-4xl mx-auto px-4 md:px-8">
          <div className="bg-surface dark:bg-surface-dark rounded-3xl border border-ink/10 dark:border-white/10 shadow-sm p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-2.5">
                <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted dark:text-ink-muted-dark flex items-center gap-2">
                  <Wallet className="w-3.5 h-3.5" /> {t("smartrip.budget")}
                </label>
                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full p-3.5 bg-ink/5 dark:bg-white/5 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-orange/40 cursor-pointer"
                >
                  <option value="Hemat">{t("smartrip.budgetHemat")}</option>
                  <option value="Menengah">{t("smartrip.budgetMenengah")}</option>
                  <option value="Mewah">{t("smartrip.budgetMewah")}</option>
                </select>
              </div>

              <div className="space-y-2.5">
                <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted dark:text-ink-muted-dark flex items-center gap-2">
                  <Map className="w-3.5 h-3.5" /> {t("smartrip.style")}
                </label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full p-3.5 bg-ink/5 dark:bg-white/5 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-orange/40 cursor-pointer"
                >
                  <option value="Budaya & Sejarah">{t("smartrip.styleBudaya")}</option>
                  <option value="Alam & Petualangan">{t("smartrip.styleAlam")}</option>
                  <option value="Kuliner & Santai">{t("smartrip.styleKuliner")}</option>
                </select>
              </div>

              <div className="space-y-2.5">
                <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted dark:text-ink-muted-dark flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" /> {t("smartrip.duration")}
                </label>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="w-full p-3.5 bg-ink/5 dark:bg-white/5 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-orange/40"
                />
              </div>
            </div>

            <button
              onClick={generateTrip}
              disabled={isLoading}
              className="mt-7 w-full py-4 bg-brand-orange text-white text-sm font-semibold rounded-2xl shadow-lg shadow-brand-orange/25 hover:bg-brand-orange/90 hover:scale-[1.02] active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
            >
              <Sparkles className="w-4.5 h-4.5" />
              {isLoading ? t("smartrip.generating") : t("smartrip.generate")}
            </button>

            {isLoading && (
              <div className="mt-5 flex items-center gap-3 text-sm text-ink-muted dark:text-ink-muted-dark">
                {reduce ? (
                  <span className="w-2 h-2 rounded-full bg-brand-orange/40" />
                ) : (
                  <motion.span
                    className="w-2 h-2 rounded-full bg-brand-orange"
                    animate={{ opacity: [1, 0.25, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                )}
                <span className="font-mono text-xs">{t(LOADING_STEP_KEYS[stepIndex])}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== Hasil itinerary — timeline vertikal + garis rute (§5.1) ===== */}
      {itinerary && (
        <section className="mt-14 md:mt-20">
          <div className="max-w-4xl mx-auto px-4 md:px-8">
            <div className="flex items-center gap-2.5 mb-10">
              <CheckCircle2 className="w-5 h-5 text-brand-orange dark:text-brand-orange-dark" />
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-brand-orange dark:text-brand-orange-dark">
                {t("smartrip.resultEyebrow")}
              </span>
            </div>

            <motion.div
              className="relative"
              initial={reduce ? false : "hidden"}
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              variants={reduce ? undefined : { hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}
            >
              <svg
                className="route-line-draw absolute left-5 top-5 bottom-5 w-px overflow-visible"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <line x1="0" y1="0" x2="0" y2="100%" className="stroke-ink-muted" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 6" />
              </svg>

              {itinerary.map((dayPlan) => (
                <motion.div
                  key={dayPlan.day}
                  variants={reduce ? undefined : DAY_CARD_VARIANTS}
                  className="relative pl-16 pb-12 last:pb-0"
                >
                  <div className="absolute left-0 top-0 w-10 h-10 rounded-full border-2 border-brand-orange bg-canvas dark:bg-canvas-dark flex items-center justify-center font-mono text-xs font-medium text-brand-orange dark:text-brand-orange-dark z-10">
                    {dayPlan.day}
                  </div>

                  <div className="bg-surface dark:bg-surface-dark rounded-3xl border border-ink/10 dark:border-white/10 shadow-sm p-6 md:p-7">
                    <span className="inline-block px-2.5 py-1 rounded-full bg-brand-orange/10 text-brand-orange dark:text-brand-orange-dark font-mono text-[10px] uppercase tracking-[0.2em]">
                      {dayPlan.theme}
                    </span>
                    <h3 className="mt-1.5 font-display text-2xl text-ink dark:text-ink-dark leading-snug">
                      {t("smartrip.day", { day: dayPlan.day })}
                    </h3>

                    <ul className="mt-4 space-y-2.5">
                      {dayPlan.activities.map((act, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-ink-muted dark:text-ink-muted-dark leading-relaxed">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange/40 mt-2 shrink-0" />
                          <span>{act}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>
      )}
    </main>
  );
}
