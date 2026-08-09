"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, MapPin, Star, Heart, RefreshCw, Compass } from "lucide-react";
import BackgroundMotif from "../components/BackgroundMotif";
import WishlistButton from "../components/WishlistButton";
import LoginModal from "../components/LoginModal";
import { useAuth } from "../lib/AuthContext";
import { useLanguage } from "../lib/LanguageContext";

type WishlistItem = {
  id: number;
  name: string;
  category: string;
  description: string;
  price: number;
  rating: number;
  image_url: string;
  images_count: number;
  wishlist_id: number;
  wishlist_created_at: string;
};

const formatPrice = (price: number) => new Intl.NumberFormat("id-ID").format(price);

export default function WishlistPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useLanguage();

  const [items, setItems] = useState<WishlistItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const load = useCallback(() => {
    fetch("/api/wishlist/me")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data: WishlistItem[]) => {
        setItems(Array.isArray(data) ? data : []);
        setError(false);
      })
      .catch(() => {
        setError(true);
        setItems(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // setState di-schedule microtask (pola AGENTS.md §4) supaya
    // react-hooks/set-state-in-effect bersih.
    if (user) {
      Promise.resolve().then(() => load());
    } else if (!authLoading) {
      Promise.resolve().then(() => {
        setItems(null);
        setLoading(false);
      });
    }
  }, [user, authLoading, load]);

  const retry = () => {
    setError(false);
    setLoading(true);
    load();
  };

  return (
    <main className="relative isolate bg-canvas dark:bg-canvas-dark min-h-screen pb-24">
      <BackgroundMotif />
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <header className="pt-6 pb-6">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-muted dark:text-ink-muted-dark hover:text-brand-orange dark:hover:text-brand-orange-dark transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> {t("common.backAccount")}
          </Link>
          <div className="mt-4 flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.25em] text-brand-orange dark:text-brand-orange-dark">
            <Compass className="w-4 h-4 dark:text-brand-orange-dark" />
            <span>{t("wishlist.eyebrow")}</span>
          </div>
          <h1 className="mt-2 font-display font-semibold text-2xl md:text-5xl text-ink dark:text-ink-dark tracking-tight">
            {t("wishlist.title")}
          </h1>
          <p className="mt-2 max-w-xl text-ink-muted dark:text-ink-muted-dark text-sm md:text-base leading-relaxed">
            {t("wishlist.subtitle")}
          </p>
        </header>

        {authLoading ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-surface dark:bg-surface-dark rounded-3xl border border-ink/10 dark:border-white/10 overflow-hidden">
                <div className="aspect-[4/3] bg-ink/5 dark:bg-white/5 animate-pulse" />
                <div className="p-6 space-y-3">
                  <div className="h-3 w-16 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                  <div className="h-5 w-3/4 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                  <div className="h-3 w-full rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : !user ? (
          <div className="rounded-2xl border border-dashed border-ink/20 dark:border-white/15 p-12 text-center">
            <Heart className="w-8 h-8 text-ink-muted dark:text-ink-muted-dark mx-auto" />
            <p className="mt-4 font-display text-xl text-ink dark:text-ink-dark">{t("wishlist.needAccount")}</p>
            <p className="mt-2 text-sm text-ink-muted dark:text-ink-muted-dark max-w-sm mx-auto">
              {t("wishlist.needAccountDesc")}
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-brand-orange dark:border-brand-orange-dark text-brand-orange dark:text-brand-orange-dark text-xs font-semibold rounded-xl hover:bg-brand-orange hover:text-white transition-all"
              >
                {t("wishlist.loginRegister")}
              </button>
              <button
                type="button"
                onClick={() => router.push("/destinations")}
                className="px-5 py-2.5 border border-ink/15 dark:border-white/20 text-ink dark:text-ink-dark text-xs font-bold rounded-xl hover:border-ink/40 dark:hover:border-white/40 hover:bg-ink/5 dark:hover:bg-white/10 transition-colors"
              >
                {t("wishlist.browseDestinations")}
              </button>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-status-failed/30 dark:border-status-failed-dark/30 bg-status-failed/5 dark:bg-status-failed-dark/10 p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <p className="text-sm font-semibold text-status-failed dark:text-status-failed-dark">{t("wishlist.errorTitle")}</p>
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">
                {t("common.goBackendError")}
              </p>
            </div>
            <button
              type="button"
              onClick={retry}
              className="sm:ml-auto px-4 py-2.5 rounded-xl border border-status-failed/40 dark:border-status-failed-dark/40 text-status-failed dark:text-status-failed-dark text-xs font-bold hover:bg-status-failed/10 dark:hover:bg-status-failed-dark/20 transition-colors flex items-center gap-2 w-fit"
            >
              <RefreshCw className="w-3.5 h-3.5" /> {t("common.retry")}
            </button>
          </div>
        ) : loading && !items ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-surface dark:bg-surface-dark rounded-3xl border border-ink/10 dark:border-white/10 overflow-hidden">
                <div className="aspect-[4/3] bg-ink/5 dark:bg-white/5 animate-pulse" />
                <div className="p-6 space-y-3">
                  <div className="h-3 w-16 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                  <div className="h-5 w-3/4 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                  <div className="h-3 w-full rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : items && items.length > 0 ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((d) => (
              <div key={d.id} className="relative h-full">
                <Link
                  href={`/destinations/${d.id}`}
                  className="group block h-full"
                  aria-label={t("grid.viewDetail", { name: d.name })}
                >
                  <article className="relative bg-surface dark:bg-surface-dark ticket-card border border-ink/10 dark:border-white/10 hover:border-ink/30 dark:hover:border-white/30 hover:scale-[1.01] transition-all duration-300 overflow-hidden h-full">
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand-orange dark:bg-brand-orange-dark scale-y-0 group-hover:scale-y-100 origin-top transition-transform duration-300" />
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
                        <span className="w-6 h-6 rounded-full border border-brand-orange/70 dark:border-brand-orange-dark/70 text-brand-orange dark:text-brand-orange-dark flex items-center justify-center">
                          <MapPin className="w-3 h-3" />
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand-orange dark:text-brand-orange-dark">
                          {d.category}
                        </span>
                      </span>
                      <h3 className="mt-2 font-display text-xl text-ink dark:text-ink-dark leading-snug group-hover:text-brand-orange dark:group-hover:text-brand-orange-dark transition-colors">
                        {d.name}
                      </h3>
                      <p className="mt-2 text-sm text-ink-muted dark:text-ink-muted-dark leading-relaxed line-clamp-2">
                        {d.description}
                      </p>
                      <div className="mt-5 pt-4 border-t border-dashed border-ink/15 dark:border-white/20 flex items-center justify-between">
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
                  initialWishlisted={true}
                  onToggle={(wishlisted) => {
                    if (!wishlisted) {
                      setItems((prev) => (prev ?? []).filter((it) => it.id !== d.id));
                    }
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-ink/20 dark:border-white/15 p-12 text-center">
            <Heart className="w-8 h-8 text-ink-muted dark:text-ink-muted-dark mx-auto" />
            <p className="mt-4 font-display text-xl text-ink dark:text-ink-dark">{t("wishlist.emptyTitle")}</p>
            <p className="mt-2 text-sm text-ink-muted dark:text-ink-muted-dark max-w-sm mx-auto">
              {t("wishlist.emptyDesc")}
            </p>
            <Link
              href="/destinations"
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 border-2 border-brand-orange dark:border-brand-orange-dark text-brand-orange dark:text-brand-orange-dark text-xs font-semibold rounded-xl hover:bg-brand-orange hover:text-white transition-all"
            >
              <Compass className="w-4 h-4 dark:text-brand-orange-dark" /> {t("wishlist.viewAll")}
            </Link>
          </div>
        )}
      </div>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </main>
  );
}
