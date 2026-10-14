import { useMemo } from "react";

import { useLanguage } from "@/lib/i18n";
import { foldForSearch } from "@/utils/foldForSearch";

import { COUNTRY_CODES, PREFERRED_COUNTRIES, dialCodeOf } from "./countries";

export interface CountryOption {
  value: string;
  label: string;
  dial: string;
  /** Folded name, ISO code and calling code — what the search box matches. */
  search: string;
}

function regionNames(language: string): (iso: string) => string {
  try {
    const names = new Intl.DisplayNames([language], { type: "region" });
    return (iso) => names.of(iso) ?? iso;
  } catch {
    return (iso) => iso;
  }
}

/**
 * Every country in the UI language: the preferred ones first in their fixed
 * order, then the rest alphabetically. Rebuilt only when the language changes.
 */
export function useCountryOptions(): CountryOption[] {
  const [language] = useLanguage();

  return useMemo(() => {
    const nameOf = regionNames(language);
    const toOption = (iso: string): CountryOption => {
      const label = nameOf(iso);
      const dial = dialCodeOf(iso);
      return { value: iso, label, dial, search: foldForSearch(`${label} ${iso} +${dial}`) };
    };

    const preferred = new Set<string>(PREFERRED_COUNTRIES);
    const collator = new Intl.Collator(language);
    const rest = COUNTRY_CODES.filter((iso) => !preferred.has(iso))
      .map(toOption)
      .sort((a, b) => collator.compare(a.label, b.label));

    return [...PREFERRED_COUNTRIES.map(toOption), ...rest];
  }, [language]);
}
