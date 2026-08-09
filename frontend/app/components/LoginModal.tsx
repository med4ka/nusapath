"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Mail, Lock, User as UserIcon, ArrowRight, Compass } from "lucide-react";
import { toast } from "../lib/toast";
import { useAuth } from "../lib/AuthContext";
import { useLanguage } from "../lib/LanguageContext";

export default function LoginModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { login, register } = useAuth();
  const { t } = useLanguage();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // createPortal needs document.body which only exists on client — SSR must render null first
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setIsMounted(true), []);

  if (!isOpen || !isMounted) return null;

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setPassword("");
    setPasswordError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "register" && password.length < 8) {
      setPasswordError(t("login.passwordShort"));
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "register") {
        await register(name, email, password);
        toast.success(t("login.welcomeToast", { name }));
      } else {
        await login(email, password);
        toast.success(t("login.loginSuccessToast"));
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("login.genericError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    "w-full pl-11 pr-4 py-3 bg-canvas dark:bg-canvas-dark border border-transparent rounded-2xl text-sm font-medium text-ink dark:text-ink-dark outline-none placeholder:text-ink/40 focus:bg-white dark:focus:bg-surface-dark focus:border-brand-orange/30 focus:ring-4 focus:ring-brand-orange/10 transition-all";

  const iconClass = "absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40 dark:text-ink-dark/40";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative bg-white dark:bg-surface-dark w-full max-w-[400px] rounded-[2rem] p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 bg-canvas dark:bg-canvas-dark hover:bg-ink/10 dark:hover:bg-white/10 rounded-full transition-colors"
          aria-label={t("login.close")}
        >
          <X className="w-4 h-4 text-ink dark:text-ink-dark" />
        </button>

        <div className="text-center mb-7 pt-4">
          <div className="w-14 h-14 bg-brand-orange text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
            <Compass className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-ink dark:text-ink-dark tracking-tight">
            {mode === "login" ? t("login.titleLogin") : t("login.titleRegister")}
          </h2>
          <p className="text-xs text-ink/50 dark:text-ink-dark/50 font-medium mt-2">
            {mode === "login"
              ? t("login.subLogin")
              : t("login.subRegister")}
          </p>
        </div>

        <div className="flex gap-1 p-1 bg-canvas dark:bg-canvas-dark rounded-2xl mb-6">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                mode === m
                  ? "bg-brand-orange text-white shadow-md"
                  : "text-ink/50 hover:text-ink"
              }`}
            >
              {m === "login" ? t("login.tabLogin") : t("login.tabRegister")}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <div className="relative">
              <UserIcon className={iconClass} />
              <input
                type="text"
                placeholder={t("login.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={3}
                maxLength={100}
                className={fieldClass}
              />
            </div>
          )}

          <div className="relative">
            <Mail className={iconClass} />
            <input
              type="email"
              placeholder={t("login.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={fieldClass}
            />
          </div>

          <div>
            <div className="relative">
              <Lock className={iconClass} />
              <input
                type="password"
                placeholder={t("login.passwordPlaceholder")}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError && e.target.value.length >= 8) setPasswordError("");
                }}
                required
                minLength={8}
                maxLength={72}
                className={`${fieldClass} ${
                  passwordError ? "border-red-400 focus:border-red-400 focus:ring-red-500/10" : ""
                }`}
              />
            </div>
            {passwordError && (
              <p className="mt-1.5 pl-1 text-[11px] font-medium text-red-600">{passwordError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3.5 bg-brand-orange text-white rounded-2xl font-bold text-sm hover:bg-brand-orange/90 transition-all shadow-lg shadow-brand-orange/25 active:scale-95 flex items-center justify-center gap-2 ${
              isSubmitting ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {isSubmitting ? (
              t("login.processing")
            ) : (
              <>
                {mode === "login" ? t("login.submitLogin") : t("login.submitRegister")}{" "}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-[10px] text-ink/40 mt-7 leading-relaxed font-medium">
          {t("login.termsPrefix", { verb: mode === "login" ? t("login.termsVerbLogin") : t("login.termsVerbRegister") })}{" "}
          <span className="text-brand-orange font-bold cursor-pointer">{t("login.termsLink")}</span>
          {t("login.termsAnd")}
          <span className="text-brand-orange font-bold cursor-pointer">{t("login.privacyLink")}</span>.
        </p>
      </div>
    </div>,
    document.body
  );
}
