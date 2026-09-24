import { useMemo } from "react";
import { useAssistantSearch, useDentistSearch, useStaffSearch } from "./useStaffOptions";
import { CATALOG_GROUP, useCatalogOptionSearch } from "./useCatalogOptions";
import type { ServerSearchOption } from "@/components/ServerSearchSelect";

/**
 * The option sources the plan dialogs hand to {@link ServerSearchSelect}.
 *
 * Each sends the typed term to its own endpoint rather than matching a
 * prefetched page in the browser, so a clinic whose staff or catalog outgrows
 * one page can still be searched.
 */

interface OptionSource {
  options: ServerSearchOption[];
  loading: boolean;
}

export function useDentistOptions(search: string, enabled: boolean): OptionSource {
  const query = useDentistSearch(search, enabled);
  return { options: query.data ?? [], loading: query.isFetching };
}

/** Any member of staff, for the consulting and diagnosing columns. */
export function useStaffOptionsSearch(search: string, enabled: boolean): OptionSource {
  const query = useStaffSearch(search, enabled);
  return { options: query.data ?? [], loading: query.isFetching };
}

/** Staff filtered to assistants only (`isAssistant === true`). */
export function useAssistantOptionsSearch(search: string, enabled: boolean): OptionSource {
  const query = useAssistantSearch(search, enabled);
  return { options: query.data ?? [], loading: query.isFetching };
}

export function useDiagnosisOptions(search: string, enabled: boolean): OptionSource {
  const query = useCatalogOptionSearch(CATALOG_GROUP.Diagnosis, { search, enabled });
  const options = useMemo(
    () =>
      (query.data?.pages ?? [])
        .flatMap((page) => page.items)
        .map((entry) => ({ value: entry.id, label: entry.name })),
    [query.data],
  );
  return { options, loading: query.isFetching };
}
