import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import type { Period, PeriodMode } from "@/components/PeriodPicker";
import type { PatientListQuery, TreatmentTab } from "../types/patient";

/**
 * URL keys the reference keeps. Only the period and the page live in the
 * address bar there — a status tab or a picker is not something you send
 * someone a link to, and the reference does not put them in the URL either.
 */
const PARAM = {
  mode: "patient_dateMode",
  date: "patient_date",
  page: "page",
  perPage: "perPage",
} as const;

const MODES: PeriodMode[] = ["day", "week", "month"];
const DEFAULT_PAGE_SIZE = 20;

export interface PatientFilters {
  keyword: string;
  tab: TreatmentTab;
  staffId?: string;
  serviceTaxonomyId?: string;
  tagId?: string;
}

const EMPTY: PatientFilters = { keyword: "", tab: "All" };

export interface PatientListFilters {
  filters: PatientFilters;
  period: Period;
  page: number;
  pageSize: number;
  /** True when anything other than the period is narrowing the list. */
  isNarrowed: boolean;
  setFilters: (next: Partial<PatientFilters>) => void;
  clearFilters: () => void;
  setPeriod: (next: Period) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  /** The filters as the list endpoint takes them. */
  toQuery: (overrides?: { skipCount?: number; maxResultCount?: number }) => PatientListQuery;
}

/**
 * Everything the patient list is currently narrowed by.
 *
 * The period and the page are mirrored into the URL so a reload — and the
 * browser's back button — land on the same view, which is what the reference
 * does; the rest is ordinary state.
 */
export function usePatientListFilters(): PatientListFilters {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFiltersState] = useState<PatientFilters>(EMPTY);

  const mode = readMode(searchParams.get(PARAM.mode));
  const dateParam = searchParams.get(PARAM.date);
  const page = readPositive(searchParams.get(PARAM.page), 1);
  const pageSize = readPositive(searchParams.get(PARAM.perPage), DEFAULT_PAGE_SIZE);

  // Memoised on the raw parameter: without a date in the URL this falls back to
  // `new Date()`, and a fresh instance every render would rewrite the query key
  // on every render and refetch the list forever.
  const period = useMemo<Period>(() => ({ mode, anchor: readDate(dateParam) }), [mode, dateParam]);

  const writeParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          mutate(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      writeParams((params) => {
        if (nextPage <= 1) params.delete(PARAM.page);
        else params.set(PARAM.page, String(nextPage));
      });
    },
    [writeParams],
  );

  const setPageSize = useCallback(
    (size: number) => {
      writeParams((params) => {
        // A different page size renumbers the pages, so it starts over.
        params.delete(PARAM.page);
        if (size === DEFAULT_PAGE_SIZE) params.delete(PARAM.perPage);
        else params.set(PARAM.perPage, String(size));
      });
    },
    [writeParams],
  );

  const setPeriod = useCallback(
    (next: Period) => {
      writeParams((params) => {
        params.delete(PARAM.page);

        if (next.mode === null) {
          params.delete(PARAM.mode);
          params.delete(PARAM.date);
          return;
        }

        params.set(PARAM.mode, next.mode);
        params.set(PARAM.date, dayjs(startOf(next)).format("YYYY-MM-DD"));
      });
    },
    [writeParams],
  );

  const setFilters = useCallback(
    (next: Partial<PatientFilters>) => {
      setFiltersState((current) => ({ ...current, ...next }));
      // Any narrowing shortens the list, so the page it was on may not exist.
      setPage(1);
    },
    [setPage],
  );

  const clearFilters = useCallback(() => {
    setFiltersState(EMPTY);
    setPage(1);
  }, [setPage]);

  const toQuery = useCallback<PatientListFilters["toQuery"]>(
    (overrides) => {
      const window = periodWindow(period);

      return {
        filter: filters.keyword.trim() || undefined,
        treatmentStatus: filters.tab === "All" ? undefined : filters.tab,
        staffId: filters.staffId,
        serviceTaxonomyId: filters.serviceTaxonomyId,
        tagId: filters.tagId,
        fromDate: window?.from,
        toDate: window?.to,
        ...overrides,
      };
    },
    [filters, period],
  );

  return {
    filters,
    period,
    page,
    pageSize,
    isNarrowed:
      filters.keyword.trim() !== "" ||
      filters.tab !== "All" ||
      Boolean(filters.staffId || filters.serviceTaxonomyId || filters.tagId),
    setFilters,
    clearFilters,
    setPeriod,
    setPage,
    setPageSize,
    toQuery,
  };
}

/** The instant the chosen period opens at, in the browser's own zone. */
function startOf(period: Period): Date {
  const at = dayjs(period.anchor);
  if (period.mode === "week") return at.startOf("week").add(1, "day").toDate();
  if (period.mode === "month") return at.startOf("month").toDate();
  return at.startOf("day").toDate();
}

/**
 * The window a period covers, as instants.
 *
 * Sent as full ISO strings with the browser's offset: the clinic's "today" is
 * a local day, and cutting it on UTC midnight would file the evening's
 * registrations under tomorrow.
 */
function periodWindow(period: Period): { from: string; to: string } | undefined {
  if (!period.mode) return undefined;

  const start = dayjs(startOf(period));
  const unit = period.mode === "day" ? "day" : period.mode;
  const end = period.mode === "week" ? start.add(6, "day").endOf("day") : start.endOf(unit);

  return { from: start.toISOString(), to: end.toISOString() };
}

function readMode(value: string | null): PeriodMode | null {
  return MODES.includes(value as PeriodMode) ? (value as PeriodMode) : null;
}

/** Only the YYYY-MM-DD the picker writes is honoured; anything else is today. */
function readDate(value: string | null): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.toDate() : new Date();
}

function readPositive(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
