"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ShieldAlert,
  CloudRain,
  PhoneCall,
  AlertTriangle,
  BellRing,
} from "lucide-react";
import { useLanguage } from "../lib/LanguageContext";

const BMKG_ADM4 = "33.08.02.2001"; // Desa Giripurno, Kec. Borobudur, Kab. Magelang
const BMKG_URL = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${BMKG_ADM4}`;

type Weather = {
  temp: string;
  desc: string;
  humidity: string;
  updatedAt: string;
  location: string;
};

export default function TripAssist() {
  const { t } = useLanguage();
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<"loading" | "ok" | "unavailable">("loading");

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(BMKG_URL, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`bmkg http ${res.status}`);
        return res.json();
      })
      .then((raw: unknown) => {
        if (ctrl.signal.aborted) return;
        const root = raw as {
          lokasi?: { desa?: string; kecamatan?: string };
          data?: { cuaca?: unknown[][] }[];
        };
        const entry = root?.data?.[0]?.cuaca?.[0]?.[0] as
          | { t?: string | number; hu?: string | number; weather_desc?: string; datetime?: string; local_datetime?: string }
          | undefined;
        if (!entry || entry.t == null) throw new Error("bmkg no entry");
        setWeather({
          temp: String(entry.t),
          desc: entry.weather_desc ?? "-",
          humidity: entry.hu == null ? "-" : String(entry.hu),
          updatedAt: entry.datetime ?? entry.local_datetime ?? "",
          location: root.lokasi
            ? `${root.lokasi.desa}, Kec. ${root.lokasi.kecamatan}`
            : "",
        });
        setWeatherStatus("ok");
      })
      .catch(() => {
        if (ctrl.signal.aborted) return;
        setWeatherStatus("unavailable");
      });
    return () => ctrl.abort();
  }, []);

  return (
    <div className="bg-canvas dark:bg-canvas-dark min-h-screen pb-20">
      <header className="sticky top-0 z-50 bg-canvas/80 dark:bg-canvas-dark/80 backdrop-blur-lg border-b border-gray-100 dark:border-white/10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-ink-muted-dark" />
          </Link>
          <h1 className="font-bold text-lg text-gray-800 dark:text-ink-dark flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" /> {t("tripassist.title")}
          </h1>
          <div className="w-10"></div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-10">
        <div className="flex flex-col md:flex-row gap-8">

          <div className="w-full md:w-1/3 space-y-6">

            <div className="bg-white dark:bg-surface-dark p-6 rounded-[2.5rem] border border-red-100 dark:border-red-500/30 shadow-xl shadow-red-100/50 text-center animate-in zoom-in duration-500">
              <h2 className="text-sm font-bold text-gray-800 dark:text-ink-dark mb-2">{t("tripassist.emergencyHub")}</h2>
              <p className="text-[10px] text-gray-400 dark:text-ink-muted-dark mb-6">
                {t("tripassist.emergencyDesc")}
              </p>

              <a
                href="tel:110"
                aria-label={t("tripassist.callNow")}
                className="w-32 h-32 mx-auto bg-gradient-to-b from-red-500 to-red-700 rounded-full flex flex-col items-center justify-center text-white shadow-2xl shadow-red-500/40 border-4 border-red-100 dark:border-red-500/30 hover:scale-105 active:scale-95 transition-all relative overflow-hidden"
              >
                <BellRing className="w-7 h-7 mb-1 z-10" />
                <span className="font-extrabold tracking-widest text-sm z-10">{t("tripassist.callNow")}</span>
                <span className="font-black text-3xl leading-none z-10">110</span>
              </a>

              <p className="mt-4 text-[10px] font-bold text-gray-500 dark:text-ink-muted-dark">
                {t("tripassist.callHint")}
              </p>
            </div>

            <div className="bg-white dark:bg-surface-dark p-6 rounded-[2rem] border border-gray-100 dark:border-white/10 shadow-sm space-y-4 animate-in slide-in-from-left-4 duration-500 delay-150">
              <h3 className="text-xs font-bold text-gray-400 dark:text-ink-muted-dark uppercase tracking-widest mb-4">{t("tripassist.emergencyContacts")}</h3>

              <button className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-2xl hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white dark:bg-white/10 rounded-lg flex items-center justify-center shadow-sm text-gray-600 dark:text-ink-muted-dark group-hover:text-red-600">
                    <PhoneCall className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-gray-700 dark:text-ink-dark group-hover:text-red-600">{t("tripassist.tourismPolice")}</span>
                </div>
                <span className="text-[10px] font-bold opacity-50">110</span>
              </button>

              <button className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-white/5 rounded-2xl hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white dark:bg-white/10 rounded-lg flex items-center justify-center shadow-sm text-gray-600 dark:text-ink-muted-dark group-hover:text-red-600">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-gray-700 dark:text-ink-dark group-hover:text-red-600">{t("tripassist.ambulance")}</span>
                </div>
                <span className="text-[10px] font-bold opacity-50">118</span>
              </button>
            </div>
          </div>

          <div className="w-full md:w-2/3 space-y-6 animate-in slide-in-from-bottom-8 duration-700">

            <div className="bg-white dark:bg-surface-dark p-6 rounded-[2rem] border border-blue-100 dark:border-blue-500/30 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-gray-800 dark:text-ink-dark flex items-center gap-2">
                  <CloudRain className="w-4 h-4 text-blue-500" /> {t("tripassist.weatherTitle")}
                </h3>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/15 px-2 py-1 rounded-full">
                  {t("tripassist.bmkgBadge")}
                </span>
              </div>

              {weatherStatus === "loading" && (
                <div className="space-y-3">
                  <div className="h-10 w-24 bg-gray-100 dark:bg-white/10 rounded-lg animate-pulse" />
                  <div className="h-3 w-48 bg-gray-100 dark:bg-white/10 rounded animate-pulse" />
                  <div className="h-3 w-64 bg-gray-100 dark:bg-white/10 rounded animate-pulse" />
                </div>
              )}

              {weatherStatus === "unavailable" && (
                <div>
                  <p className="text-sm font-bold text-gray-700 dark:text-ink-dark">{t("tripassist.weatherUnavailableTitle")}</p>
                  <p className="text-[10px] text-gray-400 dark:text-ink-muted-dark mt-1">
                    {t("tripassist.weatherUnavailableDesc")}
                  </p>
                </div>
              )}

              {weatherStatus === "ok" && weather && (
                <>
                  <div className="flex items-end gap-4 mb-4">
                    <div className="text-4xl font-black text-gray-900 dark:text-ink-dark">
                      {weather.temp}°<span className="text-xl text-gray-400 dark:text-ink-muted-dark font-medium">C</span>
                    </div>
                    <div className="pb-1">
                      <p className="text-sm font-bold text-gray-700 dark:text-ink-dark">{weather.desc}</p>
                      <p className="text-[10px] text-gray-400 dark:text-ink-muted-dark">{t("tripassist.humidity", { humidity: weather.humidity })}</p>
                    </div>
                  </div>

                  {weather.desc.toLowerCase().includes("hujan") ? (
                    <div className="p-3 bg-blue-50 dark:bg-blue-500/15 rounded-xl border border-blue-100 dark:border-blue-500/30">
                      <p className="text-[10px] text-blue-800 dark:text-blue-300 font-medium">
                        💡 <b>{t("tripassist.tipPrefix")}</b> {t("tripassist.rainTip")}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-blue-50 dark:bg-blue-500/15 rounded-xl border border-blue-100 dark:border-blue-500/30">
                      <p className="text-[10px] text-blue-800 dark:text-blue-300 font-medium">
                        💡 <b>{t("tripassist.tipPrefix")}</b> {t("tripassist.sunTip")}
                      </p>
                    </div>
                  )}

                  <p className="mt-4 text-[10px] text-gray-400 dark:text-ink-muted-dark leading-relaxed">
                    {t("tripassist.every3Hours")}
                    {weather.updatedAt ? ` • ${t("tripassist.updated", { time: weather.updatedAt.slice(0, 16).replace("T", " ") })}` : ""}
                    {" • "}
                    {weather.location || t("tripassist.fallbackLocation")}
                    <br />
                    {t("tripassist.source")}
                  </p>
                </>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
