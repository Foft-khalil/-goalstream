'use client';

import { useState, useCallback, useEffect, useSyncExternalStore } from 'react';
import { type Language, t as translate, getLocale, isRTL } from '@/lib/i18n/translations';

const LANGUAGE_STORAGE_KEY = 'goalstream_language';
const DEFAULT_LANGUAGE: Language = 'fr';

// External store for language (similar to useFavorites pattern)
let listeners: Array<() => void> = [];
let currentLanguage: Language = DEFAULT_LANGUAGE;
let languageInitialized = false;

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getLanguageSnapshot(): Language {
  // During the initial hydration render, return the same value as
  // getServerLanguageSnapshot so React doesn't detect a mismatch.
  // Once initializeLanguageSnapshot() is called from useEffect, the
  // real localStorage data will be loaded and subscribers notified.
  if (!languageInitialized) {
    return DEFAULT_LANGUAGE;
  }
  return currentLanguage;
}

function getServerLanguageSnapshot(): Language {
  return DEFAULT_LANGUAGE;
}

/**
 * Must be called once on the client (e.g. in a useEffect) to
 * trigger the first snapshot load and notify subscribers.
 * This is called AFTER hydration, so reading localStorage is safe.
 */
function initializeLanguageSnapshot() {
  if (!languageInitialized) {
    languageInitialized = true;
    currentLanguage = loadLanguageFromStorage();
    // Apply to DOM immediately
    if (typeof document !== 'undefined') {
      document.documentElement.lang = currentLanguage;
      document.documentElement.dir = isRTL(currentLanguage) ? 'rtl' : 'ltr';
    }
    // Notify so useSyncExternalStore picks up the real value
    for (const listener of listeners) {
      listener();
    }
  }
}

function loadLanguageFromStorage(): Language {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  try {
    const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (raw && ['fr', 'en', 'ar', 'es'].includes(raw)) {
      return raw as Language;
    }
  } catch(_e) {
    // ignore
  }
  return DEFAULT_LANGUAGE;
}

function saveLanguage(lang: Language) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch(_e) {
    // ignore
  }
}

function setLanguageInternal(lang: Language) {
  currentLanguage = lang;
  saveLanguage(lang);

  // Update HTML lang and dir attributes for RTL support
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRTL(lang) ? 'rtl' : 'ltr';
  }

  for (const listener of listeners) {
    listener();
  }
}

/**
 * Hook to access the current language and translation function.
 * Usage:
 *   const { language, setLanguage, t, locale } = useLanguage();
 *   <span>{t('nav.matches')}</span>
 */
export function useLanguage() {
  const language = useSyncExternalStore(subscribe, getLanguageSnapshot, getServerLanguageSnapshot);

  // Kick off the localStorage load after hydration so that
  // getLanguageSnapshot() returns the real value on subsequent renders.
  useEffect(() => {
    initializeLanguageSnapshot();
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageInternal(lang);
  }, []);

  const t = useCallback((key: string): string => {
    return translate(language, key);
  }, [language]);

  return {
    language,
    setLanguage,
    t,
    locale: getLocale(language),
    isRTL: isRTL(language),
  };
}
