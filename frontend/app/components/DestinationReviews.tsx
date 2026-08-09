"use client";

import { useCallback, useEffect, useState } from "react";
import { Star, MessageSquare, PenLine, Loader2 } from "lucide-react";
import { toast } from "../lib/toast";
import { useAuth } from "../lib/AuthContext";
import { useLanguage } from "../lib/LanguageContext";
import { formatDate } from "../lib/formatDate";
import LoginModal from "./LoginModal";

type Review = {
  id: number;
  user_id: number;
  destination_id: number;
  rating: number;
  comment: string;
  created_at: string;
  user_name: string;
};

type ReviewsResponse = {
  destination_id: number;
  average_rating?: number | null;
  rating_count: number;
  reviews: Review[];
};

function StarRow({ value, size = "sm", ariaLabel }: { value: number; size?: "sm" | "lg"; ariaLabel?: string }) {
  const cls = size === "lg" ? "w-6 h-6" : "w-4 h-4";
  return (
    <span className="flex items-center gap-0.5" aria-label={ariaLabel ?? `Rating ${value} dari 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${cls} ${
            i <= Math.round(value) ? "fill-brand-orange text-brand-orange dark:text-brand-orange-dark" : "text-ink/20"
          }`}
        />
      ))}
    </span>
  );
}

export default function DestinationReviews({
  destinationId,
  onSubmitted,
}: {
  destinationId: number;
  onSubmitted?: () => void;
}) {
  const { user, isLoading } = useAuth();
  const { locale, t } = useLanguage();
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/destinations/${destinationId}/reviews`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((body: ReviewsResponse) => {
        setData(body);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [destinationId]);

  useEffect(() => {
    Promise.resolve().then(() => load());
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setLoginOpen(true);
      return;
    }
    if (rating < 1) {
      toast.error(t("reviews.pickRating"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/destinations/${destinationId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? t("reviews.submitFail"));

      toast.success(t("reviews.submitSuccess"));
      setRating(0);
      setComment("");
      load();
      onSubmitted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("reviews.submitFail"));
    } finally {
      setSubmitting(false);
    }
  };

  const hasReviews = (data?.reviews?.length ?? 0) > 0;

  return (
    <section className="mt-16 md:mt-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-brand-orange dark:text-brand-orange-dark">
            {t("reviews.eyebrow")}
          </span>
          <h2 className="mt-3 font-display text-3xl md:text-4xl text-ink dark:text-ink-dark">{t("reviews.title")}</h2>
        </div>

        {!loading && !error && data && (
          <div className="flex items-center gap-4">
            {hasReviews && data.average_rating != null ? (
              <>
                <span className="font-mono text-4xl md:text-5xl font-medium text-ink dark:text-ink-dark leading-none">
                  {data.average_rating.toFixed(1)}
                </span>
                <div>
                  <StarRow value={data.average_rating} ariaLabel={t("reviews.ratingOutOf5", { value: data.average_rating.toFixed(1) })} />
                  <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-muted dark:text-ink-muted-dark">
                    {t("reviews.count", { count: data.rating_count })}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-muted dark:text-ink-muted-dark italic font-medium">
                {t("reviews.noReviewsFallback")}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        <div className="lg:col-span-5">
          <div className="bg-surface dark:bg-surface-dark ticket-card border border-ink/10 dark:border-white/10 p-6 md:p-7">
            <div className="flex items-center gap-2.5 mb-5">
              <PenLine className="w-4 h-4 text-brand-orange dark:text-brand-orange-dark" />
              <h3 className="font-display text-lg text-ink dark:text-ink-dark">{t("reviews.writeTitle")}</h3>
            </div>

            {isLoading ? (
              <p className="text-sm text-ink-muted dark:text-ink-muted-dark">{t("reviews.checkingSession")}</p>
            ) : user ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <p className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest mb-2.5">
                    {t("reviews.rating")}
                  </p>
                  <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRating(i)}
                        onMouseEnter={() => setHoverRating(i)}
                        aria-label={t("reviews.starsN", { i })}
                        className="p-1 -m-1 transition-transform hover:scale-110 active:scale-90"
                      >
                        <Star
                          className={`w-7 h-7 transition-colors ${
                            i <= (hoverRating || rating)
                              ? "fill-brand-orange text-brand-orange dark:text-brand-orange-dark"
                              : "text-ink/25"
                          }`}
                        />
                      </button>
                    ))}
                    {rating > 0 && (
                      <span className="ml-3 font-mono text-sm text-brand-orange dark:text-brand-orange-dark">{rating}/5</span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold text-ink-muted dark:text-ink-muted-dark uppercase tracking-widest mb-2.5">
                    {t("reviews.comment")} <span className="normal-case font-medium opacity-70">{t("reviews.optional")}</span>
                  </p>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={2000}
                    rows={4}
                    placeholder={t("reviews.commentPlaceholder")}
                    className="w-full px-4 py-3 bg-canvas/60 dark:bg-white/5 border border-ink/10 dark:border-white/10 rounded-xl text-sm text-ink dark:text-ink-dark placeholder:text-ink-muted/70 outline-none focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 border-2 border-brand-orange text-brand-orange dark:text-brand-orange-dark text-xs font-semibold rounded-xl hover:bg-brand-orange hover:text-white transition-all disabled:opacity-60 disabled:cursor-wait"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> {t("reviews.submitting")}
                    </>
                  ) : (
                    t("reviews.submit")
                  )}
                </button>

                <p className="text-[10px] text-ink-muted dark:text-ink-muted-dark italic leading-relaxed">
                  {t("reviews.eligibilityNote")}
                </p>
              </form>
            ) : (
              <div className="text-center py-6">
                <MessageSquare className="w-8 h-8 text-ink-muted dark:text-ink-muted-dark mx-auto" />
                <p className="mt-4 text-sm text-ink-muted dark:text-ink-muted-dark font-medium">
                  {t("reviews.loginPrompt")}
                </p>
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 border-2 border-brand-orange text-brand-orange dark:text-brand-orange-dark text-xs font-semibold rounded-xl hover:bg-brand-orange hover:text-white transition-all"
                >
                  {t("reviews.loginRegister")}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-7">
          {error ? (
            <div className="rounded-2xl border border-status-failed/30 bg-status-failed/5 p-6">
              <p className="text-sm font-semibold text-status-failed">{t("reviews.loadErrorTitle")}</p>
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">{t("reviews.loadErrorDesc")}</p>
            </div>
          ) : loading && !data ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="bg-surface dark:bg-surface-dark rounded-2xl border border-ink/10 dark:border-white/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-ink/5 dark:bg-white/5 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-1/3 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                      <div className="h-3 w-1/4 rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                    </div>
                  </div>
                  <div className="mt-4 h-3 w-full rounded bg-ink/5 dark:bg-white/5 animate-pulse" />
                </div>
              ))}
            </div>
          ) : hasReviews ? (
            <ul className="space-y-4">
              {data!.reviews.map((r) => (
                <li key={r.id} className="bg-surface dark:bg-surface-dark rounded-2xl border border-ink/10 dark:border-white/10 p-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-orange/10 text-brand-orange dark:text-brand-orange-dark flex items-center justify-center text-sm font-bold shrink-0">
                      {(r.user_name ?? "P").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink dark:text-ink-dark truncate">
                        {r.user_name ?? t("reviews.anonymousUser")}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-muted dark:text-ink-muted-dark mt-0.5">
                        {formatDate(r.created_at, locale)}
                      </p>
                    </div>
                    <div className="ml-auto">
                      <StarRow value={r.rating} />
                    </div>
                  </div>
                  {r.comment ? (
                    <p className="mt-4 text-sm text-ink-muted dark:text-ink-muted-dark leading-relaxed whitespace-pre-line">
                      {r.comment}
                    </p>
                  ) : (
                    <p className="mt-4 text-xs text-ink-muted/60 italic font-medium">
                      {t("reviews.noComment")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-ink/20 dark:border-white/20 p-10 text-center">
              <Star className="w-8 h-8 text-ink-muted dark:text-ink-muted-dark mx-auto" />
              <p className="mt-4 font-display text-xl text-ink dark:text-ink-dark">{t("reviews.emptyTitle")}</p>
              <p className="mt-2 text-sm text-ink-muted dark:text-ink-muted-dark max-w-sm mx-auto">
                {t("reviews.emptyDesc")}
              </p>
            </div>
          )}
        </div>
      </div>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </section>
  );
}
