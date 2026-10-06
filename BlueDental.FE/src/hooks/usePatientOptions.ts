import { useCallback, useMemo, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { api } from "@/lib/axios";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import type { PagedResult } from "@/types";

/**
 * Patient lookups shared by feature folders.
 *
 * Reception, the appointment editor, CSKH and Labo all need to pick an existing
 * patient, but features do not import each other, so the read-only lookup lives
 * here.
 */
export interface PatientOption {
  id: string;
  name: string;
  code: string;
  phone: string;
}

/**
 * The three fields a picker needs out of
 * `BlueDental.PatientManagement.PatientListItemDto`. The name arrives already
 * composed in Vietnamese order — this used to rebuild it from `lastName` and
 * `firstName`, which the list stopped sending, and every picker in the app
 * quietly went blank.
 */
interface PatientRow {
  id: string;
  patientCode: string;
  fullName: string;
  phoneNumber: string | null;
}

export const patientOptionKeys = {
  all: ["patient-options"] as const,
};

const PAGE_SIZE = 30;

interface PatientOptionPage {
  items: PatientOption[];
  totalCount: number;
}

/**
 * Which branch a picker searches. Omitted, it is the header's branch; a scope
 * whose `branchId` is undefined means every branch the account may see.
 */
export interface PatientScope {
  branchId: string | undefined;
}

/**
 * Patients a page at a time, for pickers that load more as they are scrolled.
 *
 * @param keyword server-side search over name, code and phone; empty for the
 * most recent patients.
 */
function usePatientOptionPages(keyword: string, scope?: PatientScope) {
  const currentBranchId = useCurrentBranchId();
  const branchId = scope ? scope.branchId : currentBranchId;

  return useInfiniteQuery({
    queryKey: [...patientOptionKeys.all, "pages", branchId ?? "all", keyword],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<PatientOptionPage> => {
      const page = await api
        .get<PagedResult<PatientRow>>("/v1/app/patients", {
          params: { branchId, filter: keyword || undefined, skipCount: pageParam, maxResultCount: PAGE_SIZE },
        })
        .then((r) => r.data);

      return { items: page.items.map(toOption), totalCount: page.totalCount };
    },
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded < last.totalCount ? loaded : undefined;
    },
    // A new keyword keeps the old rows up until its first page lands.
    placeholderData: keepPreviousData,
  });
}

function toOption(row: PatientRow): PatientOption {
  return {
    id: row.id,
    name: row.fullName,
    code: row.patientCode,
    phone: row.phoneNumber ?? "",
  };
}

/**
 * One patient by id, for a picker whose value is not on the page
 * the picker has loaded — the list starts at the most recent patients, so an
 * older record's booking would otherwise open with a blank picker.
 *
 * @param enabled pass false while the id is already among the loaded options.
 */
export function usePatientOption(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...patientOptionKeys.all, "by-id", id],
    queryFn: async (): Promise<PatientOption> => {
      const row = await api.get<PatientRow>(`/v1/app/patients/${id}`).then((r) => r.data);
      return toOption(row);
    },
    enabled: Boolean(id) && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * `list` with the selected patient pinned to the front when the loaded rows do
 * not hold it. Every patient picker shows only what it has paged in — the most
 * recent patients or the last search's hits — so without this an older
 * patient, or one picked before the keyword changed, renders as a blank picker.
 */
export function usePinnedPatientOptions(
  list: PatientOption[] | undefined,
  selectedId: string | undefined,
): PatientOption[] {
  const listed = (list ?? []).some((p) => p.id === selectedId);
  const { data: selected } = usePatientOption(selectedId, !listed);

  return useMemo(() => {
    const rows = list ?? [];
    return selected && !rows.some((p) => p.id === selected.id) ? [selected, ...rows] : rows;
  }, [list, selected]);
}

/**
 * Everything a server-searched patient picker needs: a debounced keyword, the
 * pages loaded so far, the selected patient pinned in, and `loadMore` for when
 * the list is scrolled to its end.
 */
export function usePatientPicker(selectedId: string | undefined, scope?: PatientScope) {
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebounce(keyword, 300);
  const { data, isFetching, isFetchingNextPage, isPlaceholderData, hasNextPage, fetchNextPage } =
    usePatientOptionPages(debouncedKeyword, scope);
  const listed = useMemo(() => data?.pages.flatMap((p) => p.items), [data]);
  const patients = usePinnedPatientOptions(listed, selectedId);
  const resetSearch = useCallback(() => setKeyword(""), []);

  // Placeholder rows belong to the previous keyword; paging them would mix two searches.
  const hasMore = hasNextPage && !isPlaceholderData;
  const loadMore = useCallback(() => {
    if (hasMore && !isFetchingNextPage) void fetchNextPage();
  }, [hasMore, isFetchingNextPage, fetchNextPage]);

  return {
    patients,
    search: setKeyword,
    resetSearch,
    loading: isFetching,
    hasMore,
    loadingMore: isFetchingNextPage,
    loadMore,
  };
}
