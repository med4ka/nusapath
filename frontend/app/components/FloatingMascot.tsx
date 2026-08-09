"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X, Sparkles, Send, Route, Compass, Bird } from "lucide-react";
import { toast } from "../lib/toast";
import { useAuth } from "../lib/AuthContext";
import { useLanguage } from "../lib/LanguageContext";

// CRITICAL (AGENTS.md §4): position:fixed MUST use portal to document.body
// + mounted guard — ancestor transform/backdrop-filter changes containing
// block for fixed.
//
// GARI — Full chatbot connected to POST /api/gari/chat.
// - Rate limit 5/day WIB (backend); 402 → show verbatim + disable input for
//   rest of day (local state, re-checked naturally on page reload).
// - Latency ±24s → typing bubble + progressive status text (LoadingSteps
//   smartrip / pullSmartTrip pattern) so user knows it's still processing.
// - User can close widget / navigate away while waiting; if reopened
//   before reply arrives, shows "still waiting" state.
// - Chat history stored in React state (lost on page refresh),
//   NOT persisted to DB.

type Suggested = { id: number; name: string; image_url: string; price: number };

type ItineraryDay = { day: number; theme?: string; activities?: string[] };

type GariMsg =
  | { kind: "user"; text: string }
  | {
      kind: "ai";
      text: string;
      suggested?: Suggested[];
      itinerary?: ItineraryDay[];
    };

const GARI_LOADING_STEP_KEYS = [
  "gari.typing1",
  "gari.typing2",
  "gari.typing3",
  "gari.typing4",
];

export default function FloatingMascot() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const [messages, setMessages] = useState<GariMsg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Ref holding "there's an active Gari request" so state persists
  // when widget is closed/reopened (not lost).
  const pendingRef = useRef(false);

  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, typing, isOpen]);

  useEffect(() => {
    if (!typing) return;
    const id = setInterval(() => {
      setLoadingStep((i) => (i + 1) % GARI_LOADING_STEP_KEYS.length);
    }, 3200);
    return () => clearInterval(id);
  }, [typing]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;

    if (!user) {
      toast.info(t("gari.loginToast"));
      router.push("/account");
      return;
    }
    if (rateLimited || pendingRef.current) return;

    setMessages((m) => [...m, { kind: "user", text }]);
    setInput("");
    setTyping(true);
    setLoadingStep(0);
    pendingRef.current = true;

    try {
      const res = await fetch("/api/gari/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      let payload:
        | { reply?: string; suggested_destinations?: Suggested[]; itinerary?: string; error?: string }
        | null = null;
      const raw = await res.text();
      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        payload = null;
      }

      if (res.status === 402) {
        const msg = payload?.error ?? t("gari.rateLimitDefault");
        toast.error(msg);
        setRateLimited(true);
        setMessages((m) => [...m, { kind: "ai", text: msg }]);
        return;
      }
      if (res.status === 401) {
        toast.error(t("gari.sessionExpired"));
        setMessages((m) => [...m, { kind: "ai", text: t("gari.loginPromptMsg") }]);
        return;
      }
      if (!res.ok) {
        toast.error(payload?.error || t("gari.connectionError"));
        return;
      }

      let parsedItinerary: ItineraryDay[] | undefined;
      if (payload?.itinerary) {
        try {
          const arr = JSON.parse(payload.itinerary);
          if (Array.isArray(arr)) parsedItinerary = arr;
        } catch {
          parsedItinerary = undefined;
        }
      }

      setMessages((m) => [
        ...m,
        {
          kind: "ai",
          text: payload?.reply || t("gari.noAnswer"),
          suggested: payload?.suggested_destinations ?? undefined,
          itinerary: parsedItinerary,
        },
      ]);
    } catch (err) {
      toast.error(t("gari.connectionLost"));
      console.error(err);
    } finally {
      pendingRef.current = false;
      setTyping(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed bottom-24 md:bottom-10 right-4 md:right-8 z-[90] flex flex-col items-end">
      {isOpen && (
        <div className="bg-canvas dark:bg-canvas-dark w-[300px] md:w-96 rounded-3xl rounded-br-none shadow-2xl border border-orange-100 dark:border-white/10 mb-4 overflow-hidden animate-in slide-in-from-bottom-4 zoom-in duration-300 flex flex-col max-h-[70dvh]">
          <div className="bg-gradient-to-r from-orange-600 to-orange-800 p-3 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20">
                <Bird className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-[13px] tracking-wide leading-none">Gari</h4>
                <p className="text-[10px] opacity-90 flex items-center gap-1 font-medium mt-0.5">
                  <Sparkles className="w-3 h-3 text-yellow-300" /> {t("gari.status")}
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors active:scale-95">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={bodyRef} className="bg-orange-50/40 dark:bg-white/5 p-3 space-y-2.5 flex-1 overflow-y-auto no-scrollbar">
            <Bubble>
              {t("gari.intro")}
            </Bubble>
            <QuickActions router={router} t={t} />

            {messages.map((m, i) =>
              m.kind === "user" ? (
                <Bubble key={i}>{m.text}</Bubble>
              ) : (
                <AiResult key={i} msg={m} router={router} t={t} />
              )
            )}

            {typing && <TypingBadge stepText={t(GARI_LOADING_STEP_KEYS[loadingStep])} />}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="bg-white dark:bg-surface-dark border-t border-gray-100 dark:border-white/10 p-2 flex items-center gap-2 shrink-0"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={rateLimited ? t("gari.placeholderLimited") : t("gari.placeholder")}
              disabled={rateLimited || typing}
              className="flex-1 min-w-0 bg-orange-50/60 dark:bg-white/10 border border-orange-100 dark:border-white/20 rounded-full px-3.5 py-2 text-xs font-medium outline-none focus:bg-white dark:focus:bg-surface-dark focus:border-brand-orange/50 focus:ring-2 focus:ring-brand-orange/10 transition-all text-ink dark:text-ink-dark placeholder:text-ink-muted dark:placeholder:text-ink-muted-dark disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || rateLimited || typing}
              className="w-9 h-9 shrink-0 bg-brand-orange text-white rounded-full flex items-center justify-center shadow-md shadow-brand-orange/25 hover:bg-brand-orange/90 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-tr from-orange-700 to-orange-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-orange-700/30 hover:scale-110 active:scale-95 transition-all relative border-2 border-white"
      >
        <Bird className="w-7 h-7 md:w-8 md:h-8" />
      </button>
    </div>,
    document.body
  );
}

function TypingBadge({ stepText }: { stepText: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] bg-surface dark:bg-surface-dark border border-orange-100 dark:border-white/10 rounded-2xl rounded-tl-none px-3.5 py-2.5 shadow-sm space-y-1.5">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange/50 animate-bounce" />
          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange/50 animate-bounce [animation-delay:120ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange/50 animate-bounce [animation-delay:240ms]" />
        </div>
        <p className="font-mono text-[10px] text-brand-orange/80">{stepText}</p>
      </div>
    </div>
  );
}

function AiResult({ msg, router, t }: { msg: Extract<GariMsg, { kind: "ai" }>; router: ReturnType<typeof useRouter>; t: (key: string, params?: Record<string, string | number>) => string }) {
  return (
    <div className="space-y-2">
      <Bubble>{msg.text}</Bubble>

      {msg.suggested && msg.suggested.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pl-1 pb-1">
          {msg.suggested.map((d) => (
            <button
              key={d.id}
              onClick={() => router.push(`/destinations/${d.id}`)}
              className="shrink-0 w-36 bg-surface dark:bg-surface-dark border border-orange-100 dark:border-white/10 rounded-2xl overflow-hidden text-left shadow-sm hover:border-brand-orange/50 hover:scale-[1.02] transition-all active:scale-95"
            >
              <div className="relative aspect-[16/10] bg-ink/5 dark:bg-white/5">
                <Image
                  src={d.image_url}
                  alt={d.name}
                  fill
                  sizes="144px"
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="p-2.5">
                <p className="text-[10px] font-bold text-ink dark:text-ink-dark leading-snug line-clamp-2">{d.name}</p>
                <p className="mt-1 font-mono text-[10px] text-brand-orange dark:text-brand-orange-dark">{d.price > 0 ? `Rp ${new Intl.NumberFormat("id-ID").format(d.price)}` : t("common.free")}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {msg.itinerary && msg.itinerary.length > 0 && (
            <div className="bg-surface dark:bg-surface-dark border border-orange-100 dark:border-white/10 rounded-2xl p-3 shadow-sm space-y-2.5">
          <div className="flex items-center gap-1.5 text-brand-orange">
            <Route className="w-3 h-3" />
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] font-semibold">
              {t("gari.itineraryTitle")}
            </span>
          </div>
          {msg.itinerary.map((d) => (
            <div key={d.day} className="pl-3 border-l-2 border-brand-orange/30 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full border border-brand-orange dark:border-brand-orange-dark flex items-center justify-center font-mono text-[9px] text-brand-orange dark:text-brand-orange-dark bg-canvas dark:bg-canvas-dark">
                  {d.day}
                </span>
                <span className="font-mono text-[10px] font-semibold text-ink dark:text-ink-dark">
                  {t("gari.dayN", { day: d.day })}
                  {d.theme ? ` · ${d.theme}` : ""}
                </span>
              </div>
              {(d.activities || []).map((a, i) => (
                <p key={i} className="flex items-start gap-1.5 text-[10px] text-ink-muted dark:text-ink-muted-dark leading-relaxed">
                  <span className="w-1 h-1 rounded-full bg-brand-orange/50 mt-1.5 shrink-0" />
                  <span className="flex-1">{a}</span>
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] bg-surface dark:bg-surface-dark border border-orange-100 dark:border-white/10 rounded-2xl rounded-tl-none px-3.5 py-2.5 text-[11px] text-ink dark:text-ink-dark leading-relaxed shadow-sm whitespace-pre-wrap break-words">
      {children}
      </div>
    </div>
  );
}

function QuickActions({ router, t }: { router: ReturnType<typeof useRouter>; t: (key: string, params?: Record<string, string | number>) => string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 pl-1">
      <button
        onClick={() => router.push("/smartrip")}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-orange/10 text-brand-orange border border-brand-orange/25 rounded-full text-[10px] font-bold hover:bg-brand-orange hover:text-white transition-colors active:scale-95"
      >
        <Route className="w-3 h-3" /> {t("gari.quickItinerary")}
      </button>
      <button
        onClick={() => router.push("/destinations")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark border border-ink/10 dark:border-white/20 rounded-full text-[10px] font-bold hover:border-brand-orange/50 hover:text-brand-orange dark:hover:text-brand-orange-dark transition-colors active:scale-95"
      >
        <Compass className="w-3 h-3" /> {t("gari.quickExplore")}
      </button>
    </div>
  );
}