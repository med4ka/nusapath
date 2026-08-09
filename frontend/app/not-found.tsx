"use client";

import Link from "next/link";
import { Compass, ArrowLeft, Map } from "lucide-react";
import { useLanguage } from "./lib/LanguageContext";

export default function NotFound() {
  const { t } = useLanguage();
  return (
    <main className="min-h-screen bg-canvas dark:bg-canvas-dark flex items-center justify-center px-6">
      <div className="text-center space-y-8 animate-in fade-in zoom-in duration-700">
        
        <div className="relative inline-block">
          <div className="w-40 h-40 bg-orange-50 dark:bg-white/5 rounded-[3rem] flex items-center justify-center mx-auto shadow-inner">
            <Compass className="w-20 h-20 text-orange-700 dark:text-brand-orange-dark animate-spin-slow" />
          </div>
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-4 py-1.5 rounded-full shadow-lg border-4 border-white dark:border-canvas-dark">
            404 ERROR
          </div>
          <Map className="absolute -bottom-4 -left-4 w-12 h-12 text-orange-200 dark:text-brand-orange-dark/30 -rotate-12" />
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-ink-dark tracking-tight">{t("notFound.title")}</h1>
          <p className="text-gray-500 dark:text-ink-muted-dark max-w-xs mx-auto text-sm leading-relaxed font-medium">
            {t("notFound.desc")}
          </p>
        </div>

        <div className="pt-4">
          <Link 
            href="/" 
            className="inline-flex items-center gap-3 bg-gray-900 dark:bg-brand-orange text-white px-8 py-4 rounded-[2rem] font-bold text-sm hover:bg-orange-700 transition-all shadow-2xl shadow-orange-100 dark:shadow-none hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("notFound.backBasecamp")}
          </Link>
        </div>

      </div>
    </main>
  );
}