"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, Plane } from "lucide-react";
import { useLanguage } from "../lib/LanguageContext";

// Toggle "Destinasi Wisata" vs "Transportasi" — entry ke /transport TANPA
// nambah tab BottomNav (tetap 3 tab final, keputusan Ghif).
// Dipasang di atas grid /destinations dan di atas search /transport.
export default function DestTypeToggle() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const isTransport = pathname.startsWith("/transport");

  return (
    <div className="inline-flex items-center gap-1 bg-surface dark:bg-surface-dark p-1 rounded-2xl border border-ink/10 dark:border-white/10 shadow-sm">
      <Link
        href="/destinations"
        aria-current={!isTransport ? "page" : undefined}
        className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all ${
          !isTransport
            ? "bg-brand-orange text-white shadow-lg shadow-brand-orange/25"
            : "text-ink-muted dark:text-ink-muted-dark hover:text-brand-orange dark:hover:text-brand-orange-dark"
        }`}
      >
        <MapPin className="w-4 h-4" />
        {t("transport.toggleDestinations")}
      </Link>
      <Link
        href="/transport"
        aria-current={isTransport ? "page" : undefined}
        className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all ${
          isTransport
            ? "bg-brand-orange text-white shadow-lg shadow-brand-orange/25"
            : "text-ink-muted dark:text-ink-muted-dark hover:text-brand-orange dark:hover:text-brand-orange-dark"
        }`}
      >
        <Plane className="w-4 h-4" />
        {t("transport.toggleTransport")}
      </Link>
    </div>
  );
}
