"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Compass, Ticket, CircleUserRound, ShieldCheck, Heart, ChevronDown, LogOut } from "lucide-react";
import { toast } from "../lib/toast";
import { useAuth } from "../lib/AuthContext";
import { useLanguage } from "../lib/LanguageContext";
import LoginModal from "./LoginModal";
import LanguageSwitcher from "./LanguageSwitcher";
import NotificationsBell from "./NotificationsBell";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const { t } = useLanguage();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click outside dropdown -> close. This is an ABSOLUTE element inside a
  // relative wrapper (not a fixed modal) so it doesn't need a portal —
  // portal is only required for position:fixed components.
  useEffect(() => {
    if (!isMenuOpen) return;
    const onClick = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("touchstart", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("touchstart", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [isMenuOpen]);

  const handleLogout = async () => {
    setIsMenuOpen(false);
    await logout();
    toast.success(t("nav.logoutSuccess"));
    router.push("/");
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-canvas/70 dark:bg-canvas-dark/80 backdrop-blur-lg border-b border-gray-100 dark:border-white/10 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
            <Link href="/" className="flex items-center gap-2 md:gap-3 group">
              <div className="w-9 h-9 md:w-11 md:h-11 rounded-[0.8rem] bg-gradient-to-br from-orange-600 to-yellow-500 flex items-center justify-center shadow-lg shadow-orange-200 transition-transform group-hover:scale-105 group-hover:rotate-3">
                  <svg viewBox="0 0 100 100" className="w-5 h-5 md:w-6 md:h-6 transform -rotate-12 translate-x-0.5">
                      <path d="M10 90 L90 50 L10 10 L30 50 Z" fill="white" stroke="white" strokeWidth="5" strokeLinejoin="round" />
                        </svg>
                         </div>
                          {/* SEMANTIC RULE: logo uses <span>,
                              NOT <h1> - heading level 1 can only be 1 per page
                              (page's real heading). Previously logo <h1> + page heading
                              = 2 h1 per route (duplicated semantics/SEO). */}
                          <div className="flex flex-col">
                            <span className="font-bold text-lg md:text-xl tracking-tight text-brand-orange leading-none">NusaPath</span>
                            <span className="hidden sm:block text-[9px] text-gray-400 dark:text-ink-muted-dark font-medium tracking-wider uppercase opacity-70 mt-0.5">{t("nav.brandSub")}</span>
                        </div>
                      </Link>

          <div className="hidden md:flex items-center gap-1">
            <Link 
              href="/" 
              className={`nav-link flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${pathname === '/' ? 'text-brand-orange bg-brand-orange/10 font-bold' : 'text-gray-500 dark:text-ink-muted-dark hover:text-brand-orange hover:bg-brand-orange/10'}`}
            >
              <Compass className="w-4 h-4" /> {t("nav.home")}
            </Link>
            <Link 
              href="/booking" 
              className={`nav-link flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${pathname === '/booking' ? 'text-brand-orange bg-brand-orange/10 font-bold' : 'text-gray-500 dark:text-ink-muted-dark hover:text-brand-orange hover:bg-brand-orange/10'}`}
            >
              <Ticket className="w-4 h-4" /> {t("nav.booking")}
            </Link>
            <Link 
              href="/account" 
              className={`nav-link flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${pathname === '/account' ? 'text-brand-orange bg-brand-orange/10 font-bold' : 'text-gray-500 dark:text-ink-muted-dark hover:text-brand-orange hover:bg-brand-orange/10'}`}
            >
              <CircleUserRound className="w-4 h-4" /> {t("nav.account")}
            </Link>
            <Link 
              href="/wishlist" 
              className={`nav-link flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${pathname === '/wishlist' ? 'text-brand-orange bg-brand-orange/10 font-bold' : 'text-gray-500 dark:text-ink-muted-dark hover:text-brand-orange hover:bg-brand-orange/10'}`}
            >
              <Heart className="w-4 h-4" /> {t("nav.wishlist")}
            </Link>
            {user?.role === "admin" && (
              <Link 
                href="/admin" 
                className={`nav-link flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${pathname === '/admin' ? 'text-brand-orange bg-brand-orange/10 font-bold' : 'text-gray-500 dark:text-ink-muted-dark hover:text-brand-orange hover:bg-brand-orange/10'}`}
              >
                <ShieldCheck className="w-4 h-4" /> {t("nav.admin")}
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3" ref={menuRef}>
            <div className="hidden md:block"><LanguageSwitcher /></div>
            {isLoading ? (
              <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
            ) : user ? (
              <>
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-[10px] text-gray-400 dark:text-ink-muted-dark leading-none">{t("nav.welcomeBack")}</span>
                  <span className="text-xs font-bold text-gray-800 dark:text-ink-dark">{user.name}</span>
                </div>
                <NotificationsBell />
                {/* Avatar = dropdown button: click -> small menu "Account" + "Logout".
                    Absolute from relative wrapper (not fixed), so no portal needed —
                    portal is only required for position:fixed components. */}
                <div className="relative">
                  <button
                    onClick={() => setIsMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={isMenuOpen}
                    title={t("nav.menuAccount")}
                    className="flex items-center gap-1 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-orange/40"
                  >
                    <div className="w-10 h-10 rounded-full bg-brand-orange text-white flex items-center justify-center text-sm font-bold shadow-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-ink-muted-dark shrink-0 transition-transform duration-200 ${isMenuOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-2 w-56 bg-surface dark:bg-surface-dark border border-ink/10 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden z-20 animate-in fade-in zoom-in duration-150 origin-top-right"
                    >
                      <div className="px-4 py-3 border-b border-ink/10">
                        <p className="text-xs font-mono text-[10px] uppercase tracking-wider text-ink-muted dark:text-ink-muted-dark">{t("nav.hello")}</p>
                        <p className="text-sm font-bold text-ink dark:text-ink-dark truncate">{user.name}</p>
                      </div>
                      <Link
                        href="/account"
                        role="menuitem"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-ink dark:text-ink-dark hover:bg-brand-orange/10 hover:text-brand-orange transition-colors"
                      >
                        <CircleUserRound className="w-4 h-4" /> {t("nav.accountMenu")}
                      </Link>
                      <button
                        onClick={handleLogout}
                        role="menuitem"
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-ink dark:text-ink-dark hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-status-failed dark:hover:text-status-failed-dark transition-colors"
                      >
                        <LogOut className="w-4 h-4" /> {t("nav.logout")}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={() => setIsLoginOpen(true)}
                className="px-4 py-2 sm:px-5 sm:py-2.5 bg-brand-orange text-white text-xs font-bold rounded-xl shadow-md hover:bg-brand-orange/90 hover:scale-[1.03] hover:shadow-lg hover:shadow-brand-orange/25 active:scale-95 transition-all duration-200"
              >
                {t("nav.login")}
              </button>
            )}
          </div>

        </div>
      </div>
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </nav>
  );
}
