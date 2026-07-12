import { translations, Language, Translations } from './translations';

export type { Language, Translations };
export { translations };

const STORAGE_KEY = 'goalstream_language';

export function getSavedLanguage(): Language {
  // Always return 'fr' for SSR/client consistency —
  // actual language is loaded from localStorage in useEffect after hydration
  return 'fr';
}

export function saveLanguage(lang: Language): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch(_e) {
    // localStorage not available
  }
}

/**
 * Get a translated string by dot-notation key.
 * Falls back to French if key not found in current language.
 * Supports {0}, {1} placeholders for interpolation.
 */
export function t(lang: Language, key: string, ...args: (string | number)[]): string {
  const keys = key.split('.');
  let result: unknown = translations[lang];
  for (const k of keys) {
    if (result && typeof result === 'object' && k in (result as Record<string, unknown>)) {
      result = (result as Record<string, unknown>)[k];
    } else {
      // Fallback to French
      let fallback: unknown = translations['fr'];
      for (const fk of keys) {
        if (fallback && typeof fallback === 'object' && fk in (fallback as Record<string, unknown>)) {
          fallback = (fallback as Record<string, unknown>)[fk];
        } else {
          return key;
        }
      }
      if (typeof fallback === 'string') {
        return interpolate(fallback, args);
      }
      return key;
    }
  }
  if (typeof result === 'string') {
    return interpolate(result, args);
  }
  return key;
}

function interpolate(template: string, args: (string | number)[]): string {
  return template.replace(/\{(\d+)\}/g, (_, idx) => {
    const i = parseInt(idx, 10);
    return i < args.length ? String(args[i]) : `{${idx}}`;
  });
}

/**
 * Available languages with their display info.
 */
export const availableLanguages: Array<{ code: Language; flag: string; label: string }> = [
  { code: 'fr', flag: '🇫🇷', label: 'Français' },
  { code: 'en', flag: '🇬🇧', label: 'English' },
  { code: 'ar', flag: '🇸🇦', label: 'العربية' },
  { code: 'es', flag: '🇪🇸', label: 'Español' },
  { code: 'pt', flag: '🇵🇹', label: 'Português' },
];
