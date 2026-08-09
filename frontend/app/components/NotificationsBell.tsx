"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X, CheckCheck, ExternalLink, Loader2 } from "lucide-react";
import { useAuth } from "../lib/AuthContext";
import { useLanguage } from "../lib/LanguageContext";
import { toast } from "../lib/toast";

type NotificationItem = {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  related_transaction_id?: number;
  created_at: string;
};

type NotifMeta = { page: number; limit: number; total: number; total_pages: number };

function timeAgo(iso: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("notifications.justNow");
  if (mins < 60) return t("notifications.minutesAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("notifications.hoursAgo", { n: hours });
  return t("notifications.daysAgo", { n: Math.floor(hours / 24) });
}

export default function NotificationsBell() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [meta, setMeta] = useState<NotifMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
  }, []);

  const fetchUnread = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (res.ok) {
        const data = await res.json();
        setUnread(data.unread_count ?? 0);
      }
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    Promise.resolve().then(fetchUnread);
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  const fetchNotifs = useCallback(async (p: number) => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications/me?page=${p}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        if (p === 1) {
          setNotifs(data.data ?? []);
        } else {
          setNotifs((prev) => [...prev, ...(data.data ?? [])]);
        }
        setMeta(data.meta ?? null);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (isOpen && notifs.length === 0) {
      Promise.resolve().then(() => {
        setPage(1);
        fetchNotifs(1);
      });
    }
  }, [isOpen, fetchNotifs, notifs.length]);

  const handleOpen = () => {
    setIsOpen((v) => !v);
    if (!isOpen) {
      setPage(1);
      setNotifs([]);
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnread((prev) => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
      toast.success(t("notifications.allRead"));
    } catch { /* ignore */ }
  };

  const handleLoadMore = async () => {
    if (!meta || page >= meta.total_pages || loadingMore) return;
    setLoadingMore(true);
    const next = page + 1;
    setPage(next);
    await fetchNotifs(next);
    setLoadingMore(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: Event) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("touchstart", onClick);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("touchstart", onClick);
    };
  }, [isOpen]);

  if (!mounted || !user) return null;

  const trigger = (
    <button
      onClick={handleOpen}
      aria-label={t("nav.notifications")}
      className="relative p-2 rounded-xl text-gray-500 dark:text-ink-muted-dark hover:text-brand-orange hover:bg-brand-orange/10 transition-all active:scale-95"
    >
      <Bell className="w-5 h-5" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none shadow-sm">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );

  const panel = isOpen && (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-surface dark:bg-surface-dark border border-ink/10 dark:border-white/10 rounded-2xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in duration-150 origin-top-right"
      style={{ maxHeight: "70dvh" }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink/10 dark:border-white/10">
        <h3 className="text-sm font-bold text-ink dark:text-ink-dark">{t("notifications.title")}</h3>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-[11px] font-semibold text-brand-orange hover:underline flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              {t("notifications.markAllRead")}
            </button>
          )}
          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-ink/10 rounded-lg transition-colors">
            <X className="w-4 h-4 text-ink-muted dark:text-ink-muted-dark" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: "calc(70dvh - 52px)" }}>
        {loading && notifs.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-ink-muted" />
          </div>
        ) : notifs.length === 0 ? (
          <div className="text-center py-8 px-4">
            <p className="text-sm text-ink-muted dark:text-ink-muted-dark">{t("notifications.empty")}</p>
          </div>
        ) : (
          <>
            {notifs.map((n) => (
              <div
                key={n.id}
                className={`px-4 py-3 border-b border-ink/5 dark:border-white/5 hover:bg-brand-orange/5 transition-colors cursor-pointer ${
                  !n.is_read ? "bg-brand-orange/[0.03] dark:bg-brand-orange/5" : ""
                }`}
                onClick={() => {
                  if (!n.is_read) handleMarkRead(n.id);
                  setIsOpen(false);
                  if (n.related_transaction_id) {
                    window.location.href = "/booking";
                  }
                }}
              >
                <div className="flex items-start gap-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-brand-orange shrink-0 mt-0.5" />
                      )}
                      <p className={`text-[13px] leading-tight truncate ${!n.is_read ? "font-bold text-ink dark:text-ink-dark" : "font-medium text-ink/80 dark:text-ink-dark/80"}`}>
                        {n.title}
                      </p>
                    </div>
                    <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5 line-clamp-2">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-400 dark:text-ink-muted-dark">{timeAgo(n.created_at, t)}</span>
                      {n.related_transaction_id && (
                        <span className="text-[10px] text-brand-orange flex items-center gap-0.5">
                          <ExternalLink className="w-2.5 h-2.5" />
                          {t("notifications.viewBooking")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {meta && page < meta.total_pages && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full py-3 text-xs font-semibold text-brand-orange hover:bg-brand-orange/10 transition-colors"
              >
                {loadingMore ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : (
                  `Load more (${meta.total - notifs.length} left)`
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative">
      {trigger}
      {panel}
    </div>
  );
}
