import { translations, Language } from '@/lib/i18n';

/**
 * Deterministic short date format (timezone-independent).
 * Returns e.g. "sam. 2" in French, "Sat 2" in English — same result on server and client.
 */
export function formatShort(date: Date, lang: Language = 'fr'): string {
  const weekdays = translations[lang].dates.weekdaysShort;
  const day = weekdays[date.getDay()];
  const num = date.getDate();
  return `${day} ${num}`;
}

/**
 * Deterministic long date format (timezone-independent).
 * Returns e.g. "samedi 2 mai" in French, "Saturday 2 May" in English — same result on server and client.
 */
export function formatLong(date: Date, lang: Language = 'fr'): string {
  const weekdays = translations[lang].dates.weekdaysLong;
  const months = translations[lang].dates.monthsLong;
  const weekday = weekdays[date.getDay()];
  const num = date.getDate();
  const month = months[date.getMonth()];
  return `${weekday} ${num} ${month}`;
}

/**
 * Backward-compatible French-only short format.
 * @deprecated Use formatShort(date, lang) instead
 */
export function formatFrShort(date: Date): string {
  return formatShort(date, 'fr');
}

/**
 * Backward-compatible French-only long format.
 * @deprecated Use formatLong(date, lang) instead
 */
export function formatFrLong(date: Date): string {
  return formatLong(date, 'fr');
}
