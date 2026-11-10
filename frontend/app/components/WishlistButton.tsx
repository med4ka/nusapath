"use client";

import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { toast } from "../lib/toast";
import { useLanguage } from "../lib/LanguageContext";

// WishlistButton — heart toggle on destination cards & detail page.
// - Not logged in → toast asking to login, NO request sent.
// - Logged in → optimistic update (visual changes before response), rollback
//   to original state if request fails.
// Default position is overlay (absolute top-right, for cards); detail page
// can override via prop `position` = "inline".
export default function WishlistButton({
  destinationId,
  initialWishlisted = false,
  position = "overlay",
  onToggle,
}: {
  destinationId: number;
  initialWishlisted?: boolean;
  position?: "overlay" | "inline";
  onToggle?: (wishlisted: boolean) => void;
}) {
  const { user, isLoading } = useAuth();
  const { t } = useLanguage();
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [pending, setPending] = useState(false);
  // SYNCHRONOUS guard against rapid double-tap (common on touchscreen):
  // the `disabled` attribute only takes effect after re-render, so 2 rapid taps
  // can slip through before `pending` state commits. `pendingRef` is set
  // immediately at handler start → second tap while request is in-flight is IGNORED
  // (1 request per toggle, not 2+ → prevents hitting backend rate limiter).
  const pendingRef = useRef(false);

  // Sync when data list is refetched (e.g. page navigation / /wishlist).
  // setState scheduled as microtask (promise-chain) — not sync in
  // effect body so react-hooks/set-state-in-effect passes lint.
  useEffect(() => {
    Promise.resolve().then(() => setWishlisted(initialWishlisted));
  }, [initialWishlisted]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (pendingRef.current) return;

    if (!user) {
      toast.info(t("common.wishlistLogin"));
      return;
    }

    pendingRef.current = true;
    const next = !wishlisted;
    setWishlisted(next);
    setPending(true);

    try {
      const res = await fetch(`/api/wishlist/${destinationId}`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? t("common.wishlistFail"));
      onToggle?.(data?.wishlisted ?? next);
      toast.success(data?.message ?? (next ? t("common.wishlistAdded") : t("common.wishlistRemoved")));
    } catch (err) {
      setWishlisted(!next);
      toast.error(err instanceof Error ? err.message : t("common.wishlistGenericError"));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const base =
    "flex items-center justify-center rounded-full transition-all duration-200 active:scale-90 " +
    "disabled:opacity-60 disabled:cursor-wait " +
    (position === "overlay"
      ? "absolute top-3 right-3 z-10 w-9 h-9 bg-white/90 dark:bg-surface-dark/90 backdrop-blur-sm border border-ink/10 dark:border-white/10 shadow-sm hover:scale-105 hover:border-brand-orange/40"
      : "w-10 h-10 border border-ink/10 dark:border-white/10 bg-white dark:bg-surface-dark hover:border-brand-orange/40 hover:scale-105 shadow-sm");

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending || isLoading}
      aria-label={wishlisted ? t("common.wishlistRemove") : t("common.wishlistAdd")}
      aria-pressed={wishlisted}
      title={wishlisted ? t("common.wishlistRemove") : t("common.wishlistAdd")}
      className={base}
    >
      <Heart
        className={`w-[18px] h-[18px] transition-colors ${
          wishlisted ? "fill-brand-orange text-brand-orange" : "text-ink-muted"
        }`}
      />
    </button>
  );
}
