import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, setAcceptLanguage } from "./axios";

export type Language = "vi" | "en";

const STORAGE_KEY = "bluedental.language";

/**
 * Vietnamese is the source language: the text in the code IS the key, and the
 * server resource holds the English overlay. A string nobody has translated yet
 * still renders correctly instead of showing a key, and adding a screen never
 * requires touching the resource first.
 *
 * The overlay is ABP's own localization resource (BlueDental), fetched from
 * /api/abp/application-localization, so the browser and the server share one
 * source of truth — that file already carries the business error messages.
 */
let overlay: Record<string, string> = {};

/**
 * Translates one piece of visible text.
 *
 * Module-level on purpose: labels live in constant maps as often as in JSX, and
 * a map cannot call a hook. Switching language remounts the router, so every
 * screen re-reads the overlay.
 *
 * Sentences that embed values take {0}, {1}… placeholders rather than being
 * assembled from fragments — word order differs between the two languages, so
 * "Hiển thị {0} trên {1}" has to become "Showing {0} of {1}" as a whole.
 */
export function t(vietnamese: string, ...params: (string | number)[]): string {
  const template = overlay[vietnamese] ?? vietnamese;
  if (params.length === 0) return template;
  return template.replace(/\{(\d+)\}/g, (match, index: string) => {
    const value = params[Number(index)];
    return value === undefined ? match : String(value);
  });
}

/**
 * Same contract as {@link t}, but the placeholders are filled with React nodes
 * instead of strings, so a sentence can carry emphasis (a bold record count, a
 * highlighted group name) while still being translated as one whole sentence.
 */
export function tRich(vietnamese: string, ...params: ReactNode[]): ReactNode {
  const template = overlay[vietnamese] ?? vietnamese;

  return template.split(/(\{\d+\})/).map((chunk, index) => {
    const placeholder = /^\{(\d+)\}$/.exec(chunk);
    const value = placeholder ? params[Number(placeholder[1])] : chunk;
    return <Fragment key={index}>{value}</Fragment>;
  });
}

interface I18nValue {
  language: Language;
  setLanguage: (language: Language) => void;
}

const I18nContext = createContext<I18nValue | undefined>(undefined);

function readStoredLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "en" ? "en" : "vi";
}

interface AbpLocalizationResponse {
  resources?: Record<string, { texts?: Record<string, string> }>;
}

async function fetchOverlay(language: Language): Promise<Record<string, string>> {
  if (language === "vi") {
    // The code is already Vietnamese; there is nothing to overlay.
    return {};
  }

  const response = await api.get<AbpLocalizationResponse>("/abp/application-localization", {
    params: { cultureName: language, onlyDynamics: false },
  });

  return response.data.resources?.BlueDental?.texts ?? {};
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAcceptLanguage(language);
    setReady(false);

    let cancelled = false;
    void fetchOverlay(language).then((texts) => {
      if (cancelled) return;
      overlay = texts;
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLanguageState(next);
  }, []);

  const value = useMemo<I18nValue>(() => ({ language, setLanguage }), [language, setLanguage]);

  // Nothing renders until the overlay is in place, so no screen flashes the
  // Vietnamese source before switching to English.
  return (
    <I18nContext.Provider value={value}>{ready ? children : null}</I18nContext.Provider>
  );
}

function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useLanguage must be used inside I18nProvider");
  }
  return value;
}

export function useLanguage(): [Language, (language: Language) => void] {
  const { language, setLanguage } = useI18n();
  return [language, setLanguage];
}

/** For components that prefer a hook; it returns the same translator. */
export function useT(): typeof t {
  useI18n();
  return t;
}
