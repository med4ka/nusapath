export function formatDate(iso: string | Date | undefined, locale: string): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";

  const localeMap: Record<string, string> = {
    id: "id-ID",
    en: "en-US",
    de: "de-DE",
  };

  const sysLocale = localeMap[locale] || "id-ID";
  return new Intl.DateTimeFormat(sysLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatTime(iso: string | Date | undefined, locale: string): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";

  const localeMap: Record<string, string> = {
    id: "id-ID",
    en: "en-US",
    de: "de-DE",
  };

  const sysLocale = localeMap[locale] || "id-ID";
  return new Intl.DateTimeFormat(sysLocale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
