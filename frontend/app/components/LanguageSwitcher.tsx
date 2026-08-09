"use client";

import { useEffect, useRef, useState } from "react";
import { Languages, ChevronDown, Check } from "lucide-react";
import { useLanguage } from "../lib/LanguageContext";

const LOCALES = [
  { code: "id", label: "ID" },
  { code: "en", label: "EN" },
  { code: "de", label: "DE" },
] as const;

export default function LanguageSwitcher({ inverted = false }: { inverted?: boolean }) {
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Klik di luar dropdown → tutup (pola sama seperti dropdown avatar Navbar).
  useEffect(() => {
    if (!open) return;
    const onClick = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("touchstart", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("touchstart", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Ganti Bahasa"
        title="Ganti Bahasa"
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-colors ${
          inverted
            ? "text-white/70 hover:text-white hover:bg-white/10"
            : "text-gray-500 dark:text-ink-muted-dark hover:text-brand-orange dark:hover:text-brand-orange-dark hover:bg-brand-orange/10"
        }`}
      >
        <Languages className="w-4 h-4" />
        {current.label}
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute right-0 top-full mt-2 w-24 rounded-xl shadow-xl overflow-hidden z-20 animate-in fade-in zoom-in duration-150 origin-top-right ${
            inverted
              ? "bg-gray-800 border border-white/10"
              : "bg-surface dark:bg-surface-dark border border-ink/10 dark:border-white/10"
          }`}
        >
          {LOCALES.map((l) => (
            <button
              key={l.code}
              role="menuitem"
              onClick={() => {
                setLocale(l.code);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold transition-colors ${
                l.code === locale
                  ? "text-brand-orange dark:text-brand-orange-dark"
                  : inverted
                    ? "text-white/80 hover:bg-white/10"
                    : "text-ink dark:text-ink-dark hover:bg-brand-orange/10"
              }`}
            >
              {l.label}
              {l.code === locale && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}