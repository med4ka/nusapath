"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "../lib/toast";
import { useAuth } from "../lib/AuthContext";
import { useLanguage } from "../lib/LanguageContext";
import {
  Camera, Moon, Bell, User, ShieldCheck, 
  CreditCard, Languages, ChevronRight, X, 
  Mail, Phone, KeyRound, Lock, Eye, Laptop, Heart
} from "lucide-react";
import BackgroundMotif from "../components/BackgroundMotif";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function Account() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { resolvedTheme, setTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const [isNotifOn, setIsNotifOn] = useState(true);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [tripsCount, setTripsCount] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/bookings/me")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const bookings = Array.isArray(data) ? data : [];
        setTripsCount(bookings.filter((b: { status?: string }) => b.status === "TICKET_ISSUED").length);
      })
      .catch(() => {
        if (!cancelled) setTripsCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSimulateSave = (e: React.FormEvent, message: string) => {
    e.preventDefault();
    setActiveModal(null);
    toast.success(message);
  };

  return (
    <div className="relative isolate bg-canvas dark:bg-canvas-dark min-h-screen pb-24">
      <BackgroundMotif random />

      <main className="max-w-6xl mx-auto px-6 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white dark:bg-surface-dark p-8 rounded-[3rem] border border-gray-100 dark:border-white/10 shadow-sm text-center relative overflow-hidden">
              <div className="absolute -top-10 -left-10 w-32 h-32 bg-orange-100/50 dark:bg-brand-orange/20 rounded-full blur-3xl"></div>
              <div className="relative">
                <div className="relative w-32 h-32 mx-auto mb-6">
                  <div className="w-full h-full rounded-full bg-brand-orange text-white flex items-center justify-center text-5xl font-bold shadow-xl border-4 border-white">
                    {(user?.name ?? t("account.explorer")).charAt(0).toUpperCase()}
                  </div>
                  <button className="absolute bottom-1 right-1 w-10 h-10 bg-orange-700 text-white rounded-full flex items-center justify-center border-4 border-white shadow-lg hover:scale-105 active:scale-95 transition-all">
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-ink-dark">{user?.name ?? "—"}</h2>
                <p className="text-sm text-gray-400 dark:text-ink-muted-dark font-medium mt-1">{user?.email ?? t("account.notLoggedIn")}</p>
                <div className="mt-8 flex justify-center gap-4">
                  <div className="px-4 py-2 bg-orange-50 dark:bg-brand-orange/15 rounded-2xl">
                    <p className="text-[10px] font-bold text-orange-700 dark:text-brand-orange-dark uppercase tracking-wider">{t("account.trips")}</p>
                    <p className="text-lg font-bold text-orange-950 dark:text-brand-orange-dark">{tripsCount ?? "—"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white shadow-xl">
              <h4 className="text-xs font-bold opacity-50 uppercase tracking-widest mb-6">{t("account.appSettings")}</h4>
              <div className="space-y-5">
                <div className="flex items-center justify-between cursor-pointer group" onClick={() => setTheme(isDarkMode ? "light" : "dark")}>
                  <div className="flex items-center gap-3">
                    <Moon className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                    <span className="text-sm font-medium">{t("account.appearance")}</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${isDarkMode ? 'bg-orange-600' : 'bg-gray-700'}`}>
                    <div className={`absolute top-1 w-3 h-3 rounded-full transition-all ${isDarkMode ? 'right-1 bg-white' : 'left-1 bg-white/20'}`}></div>
                  </div>
                </div>
                <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <Languages className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                    <span className="text-sm font-medium">{t("account.language")}</span>
                  </div>
                  <LanguageSwitcher inverted />
                </div>
                <div className="flex items-center justify-between cursor-pointer group" onClick={() => setIsNotifOn(!isNotifOn)}>
                  <div className="flex items-center gap-3">
                    <Bell className="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity" />
                    <span className="text-sm font-medium">{t("account.notifications")}</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${isNotifOn ? 'bg-orange-600' : 'bg-gray-700'}`}>
                    <div className={`absolute top-1 w-3 h-3 rounded-full transition-all ${isNotifOn ? 'right-1 bg-white' : 'left-1 bg-white/20'}`}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-10">
            <div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-ink-dark mb-6">{t("account.settingsTitle")}</h3>
              <div className="grid gap-4">
                
                <button onClick={() => setActiveModal('personal')} className="w-full flex items-center justify-between p-6 bg-white dark:bg-surface-dark border border-gray-100 dark:border-white/10 rounded-3xl transition-all duration-300 hover:border-orange-200 dark:hover:border-brand-orange-dark/50 shadow-sm group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-50 dark:bg-brand-orange/15 text-orange-700 dark:text-brand-orange-dark rounded-2xl flex items-center justify-center">
                      <User className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-gray-800 dark:text-ink-dark">{t("account.personalInfo")}</p>
                      <p className="text-xs text-gray-400 dark:text-ink-muted-dark">{t("account.personalInfoDesc")}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 dark:text-ink-muted-dark group-hover:text-orange-700 dark:group-hover:text-brand-orange-dark transition-colors" />
                </button>

                <button onClick={() => setActiveModal('security')} className="w-full flex items-center justify-between p-6 bg-white dark:bg-surface-dark border border-gray-100 dark:border-white/10 rounded-3xl transition-all duration-300 hover:border-orange-200 dark:hover:border-brand-orange-dark/50 shadow-sm group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-50 dark:bg-brand-orange/15 text-orange-700 dark:text-brand-orange-dark rounded-2xl flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-gray-800 dark:text-ink-dark">{t("account.security")}</p>
                      <p className="text-xs text-gray-400 dark:text-ink-muted-dark">{t("account.securityDesc")}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 dark:text-ink-muted-dark group-hover:text-orange-700 dark:group-hover:text-brand-orange-dark transition-colors" />
                </button>

                <button onClick={() => setActiveModal('payment')} className="w-full flex items-center justify-between p-6 bg-white dark:bg-surface-dark border border-gray-100 dark:border-white/10 rounded-3xl transition-all duration-300 hover:border-orange-200 dark:hover:border-brand-orange-dark/50 shadow-sm group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-50 dark:bg-brand-orange/15 text-orange-700 dark:text-brand-orange-dark rounded-2xl flex items-center justify-center">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-gray-800 dark:text-ink-dark">{t("account.paymentMethod")}</p>
                      <p className="text-xs text-gray-400 dark:text-ink-muted-dark">{t("account.paymentMethodDesc")}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 dark:text-ink-muted-dark group-hover:text-orange-700 dark:group-hover:text-brand-orange-dark transition-colors" />
                </button>

              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-ink-dark mb-6">{t("account.others")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => router.push("/wishlist")}
                  className="flex items-center gap-4 p-6 bg-gray-50 dark:bg-surface-dark rounded-3xl hover:bg-white dark:hover:bg-surface-dark/70 border border-gray-200 dark:border-white/10 hover:border-orange-300 dark:hover:border-brand-orange-dark/50 hover:shadow-sm transition-all group"
                >
                  <Heart className="w-5 h-5 text-gray-400 dark:text-ink-muted-dark group-hover:text-brand-orange dark:group-hover:text-brand-orange-dark transition-colors" />
                  <span className="text-sm font-bold text-gray-600 dark:text-ink-dark group-hover:text-gray-800 dark:group-hover:text-ink-dark transition-colors">
                    {t("account.myWishlist")}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {activeModal === 'personal' && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setActiveModal(null)}></div>
          <div className="relative bg-white dark:bg-surface-dark w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto no-scrollbar">
            <button onClick={() => setActiveModal(null)} className="absolute top-6 right-6 p-2 bg-gray-50 dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500 dark:text-ink-muted-dark" /></button>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-ink-dark mb-8 text-center">{t("account.personalModalTitle")}</h2>
            
            <form onSubmit={(e) => handleSimulateSave(e, t("account.savedToast"))} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 dark:text-ink-muted-dark uppercase tracking-widest ml-1">{t("account.fullName")}</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-ink-muted-dark group-focus-within:text-orange-600 dark:group-focus-within:text-brand-orange-dark" />
                  <input type="text" defaultValue={user?.name ?? ""} className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-white/5 border border-transparent rounded-2xl text-sm font-bold text-gray-800 dark:text-ink-dark outline-none focus:bg-white dark:focus:bg-white/10 focus:border-orange-200 dark:focus:border-brand-orange-dark focus:ring-4 focus:ring-orange-500/10 transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 dark:text-ink-muted-dark uppercase tracking-widest ml-1">{t("account.email")}</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-ink-muted-dark group-focus-within:text-orange-600 dark:group-focus-within:text-brand-orange-dark" />
                  <input type="email" defaultValue={user?.email ?? ""} className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-white/5 border border-transparent rounded-2xl text-sm font-bold text-gray-800 dark:text-ink-dark outline-none focus:bg-white dark:focus:bg-white/10 focus:border-orange-200 dark:focus:border-brand-orange-dark focus:ring-4 focus:ring-orange-500/10 transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 dark:text-ink-muted-dark uppercase tracking-widest ml-1">{t("account.phone")}</label>
                <div className="flex gap-3">
                  <div className="flex items-center gap-2 px-4 bg-gray-50 dark:bg-white/5 rounded-2xl"><span className="text-sm font-bold text-gray-800 dark:text-ink-dark">+62</span></div>
                  <div className="relative flex-1 group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-ink-muted-dark group-focus-within:text-orange-600 dark:group-focus-within:text-brand-orange-dark" />
                    <input type="tel" defaultValue="" placeholder={t("account.phonePlaceholder")} className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-white/5 border border-transparent rounded-2xl text-sm font-bold text-gray-800 dark:text-ink-dark outline-none focus:bg-white dark:focus:bg-white/10 focus:border-orange-200 dark:focus:border-brand-orange-dark focus:ring-4 focus:ring-orange-500/10 transition-all" />
                  </div>
                </div>
              </div>
              
              <button type="submit" className="w-full py-4 bg-orange-700 text-white text-sm font-bold rounded-2xl shadow-lg shadow-orange-200 dark:shadow-brand-orange/30 hover:bg-orange-800 active:scale-95 transition-all mt-4">
                {t("account.saveChanges")}
              </button>
            </form>

            <div className="mt-8 p-6 border-2 border-dashed border-red-100 dark:border-red-900/50 rounded-[2rem] flex items-center justify-between">
              <div><h4 className="text-sm font-bold text-gray-800 dark:text-ink-dark">{t("account.deleteAccount")}</h4><p className="text-[10px] text-gray-400 dark:text-ink-muted-dark">{t("account.deleteAccountDesc")}</p></div>
              <button className="px-6 py-2.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-xl hover:bg-red-600 hover:text-white transition-all">{t("account.delete")}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {activeModal === 'security' && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setActiveModal(null)}></div>
          <div className="relative bg-white dark:bg-surface-dark w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto no-scrollbar">
            <button onClick={() => setActiveModal(null)} className="absolute top-6 right-6 p-2 bg-gray-50 dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500 dark:text-ink-muted-dark" /></button>
            
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-orange-50 dark:bg-brand-orange/15 text-orange-700 dark:text-brand-orange-dark rounded-xl flex items-center justify-center"><KeyRound className="w-5 h-5" /></div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-ink-dark">{t("account.changePassword")}</h2>
            </div>
            
            <form onSubmit={(e) => handleSimulateSave(e, t("account.passwordSaved"))} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 dark:text-ink-muted-dark uppercase tracking-widest ml-1">{t("account.currentPassword")}</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 dark:text-ink-muted-dark group-focus-within:text-brand-orange dark:group-focus-within:text-brand-orange-dark" />
                  <input required type="password" placeholder="••••••••" className="w-full pl-12 pr-12 py-4 bg-gray-50 dark:bg-white/5 border border-transparent rounded-2xl text-sm font-bold text-gray-800 dark:text-ink-dark outline-none focus:bg-white dark:focus:bg-white/10 focus:border-orange-200 dark:focus:border-brand-orange-dark/50 focus:ring-4 focus:ring-brand-orange/10 dark:focus:ring-brand-orange-dark/10 transition-all" />
                  <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 dark:text-ink-muted-dark hover:text-brand-orange dark:hover:text-brand-orange-dark"><Eye className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 dark:text-ink-muted-dark uppercase tracking-widest ml-1">{t("account.newPassword")}</label>
                <div className="relative group">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 dark:text-ink-muted-dark group-focus-within:text-brand-orange dark:group-focus-within:text-brand-orange-dark" />
                  <input required type="password" placeholder={t("account.minChars")} className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-white/5 border border-transparent rounded-2xl text-sm font-bold text-gray-800 dark:text-ink-dark outline-none focus:bg-white dark:focus:bg-white/10 focus:border-orange-200 dark:focus:border-brand-orange-dark/50 focus:ring-4 focus:ring-brand-orange/10 dark:focus:ring-brand-orange-dark/10 transition-all" />
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-brand-orange text-white text-sm font-bold rounded-2xl shadow-lg shadow-brand-orange/30 hover:bg-brand-orange/90 active:scale-95 transition-all">
                {t("account.updatePassword")}
              </button>
            </form>

            <div className="mt-8 pt-8 border-t border-gray-100 dark:border-white/10">
              <h4 className="text-[10px] font-bold text-gray-400 dark:text-ink-muted-dark uppercase tracking-widest mb-4">{t("account.activeDevices")}</h4>
              <div className="flex flex-col items-center justify-center text-center py-10 px-6 border-2 border-dashed border-gray-200 dark:border-white/15 rounded-[1.5rem]">
                <div className="w-14 h-14 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-5">
                  <Laptop className="w-6 h-6 text-gray-300 dark:text-ink-muted-dark" />
                </div>
                <h4 className="text-sm font-bold text-gray-700 dark:text-ink-dark">{t("account.noActiveDevices")}</h4>
                <p className="text-xs text-gray-400 dark:text-ink-muted-dark font-medium mt-2 max-w-[240px] leading-relaxed">
                  {t("account.deviceTrackingSoon")}
                </p>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {activeModal === 'payment' && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setActiveModal(null)}></div>
          <div className="relative bg-white dark:bg-surface-dark w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto no-scrollbar">
            <button onClick={() => setActiveModal(null)} className="absolute top-6 right-6 p-2 bg-gray-50 dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 rounded-full transition-colors"><X className="w-5 h-5 text-gray-500 dark:text-ink-muted-dark" /></button>

            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-ink-dark">{t("account.paymentMethod")}</h2>
            </div>

            <div className="flex flex-col items-center justify-center text-center py-12 px-6 border-2 border-dashed border-gray-200 dark:border-white/15 rounded-[2rem]">
              <div className="w-14 h-14 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-5">
                <CreditCard className="w-6 h-6 text-gray-300 dark:text-ink-muted-dark" />
              </div>
              <h4 className="text-sm font-bold text-gray-700 dark:text-ink-dark">{t("account.noPaymentMethod")}</h4>
              <p className="text-xs text-gray-400 dark:text-ink-muted-dark font-medium mt-2 max-w-[240px] leading-relaxed">
                {t("account.paymentSoon")}
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}