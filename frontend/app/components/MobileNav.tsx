"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Ticket, CircleUserRound } from "lucide-react";
import { useLanguage } from "../lib/LanguageContext";

// CRITICAL (see AGENTS.md §4): components with
// position:fixed MUST render via portal to document.body. Any ancestor
// with transform/backdrop-filter/will-change (e.g. motion wrapper from
// page-transition or other animation) changes the containing block for
// position:fixed → nav "floats" at scroll position / overlaps content.
// Portal breaks that dependency permanently — same pattern as LoginModal.
//
// NAVBAR CONTENT: only 3 tabs — Home/Booking/Account. Initial
// avatar on left REMOVED — profile still
// accessible via Account tab; no other decorative elements on this row.
// Each tab uses a fixed-height icon slot `h-[18px] flex items-center
// justify-center` so icon center-lines align (maintained across icons).
export default function MobileNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);

  // setMounted intentionally scheduled as microtask (promise-chain, same pattern
  // as AuthContext & new pages) — setState NOT called synchronously in effect
  // body, so react-hooks/set-state-in-effect stays clean without comment.
  // Behavior remains guard: SSR & first hydration render null, after mount
  // portal to document.body appears. Must be preserved — without this guard
  // createPortal crashes on SSR (document undefined).
  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
  }, []);

  if (!mounted) return null;

  const iconSlot = "h-[18px] flex items-center justify-center";
  const tabCls = (active: boolean) =>
    `w-16 flex flex-col items-center justify-center gap-0.5 ${active ? "text-brand-orange" : "text-gray-400 dark:text-ink-muted-dark hover:text-gray-600 dark:hover:text-ink-dark"}`;

  return createPortal(
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-canvas/80 dark:bg-canvas-dark/85 backdrop-blur-xl border-t border-gray-100 dark:border-white/10 flex items-center justify-around pt-2 pb-4 z-50">
      <Link href="/" className={tabCls(pathname === "/")}>
        <span className={iconSlot}>
          <Compass className="w-[18px] h-[18px]" />
        </span>
        <span className="text-[10px] font-bold">{t("nav.home")}</span>
      </Link>
      <Link href="/booking" className={tabCls(pathname === "/booking")}>
        <span className={iconSlot}>
          <Ticket className="w-[18px] h-[18px]" />
        </span>
        <span className="text-[10px] font-bold">{t("nav.booking")}</span>
      </Link>
      <Link href="/account" className={tabCls(pathname === "/account")}>
        <span className={iconSlot}>
          <CircleUserRound className="w-[18px] h-[18px]" />
        </span>
        <span className="text-[10px] font-bold">{t("nav.account")}</span>
      </Link>
    </nav>,
    document.body
  );
}