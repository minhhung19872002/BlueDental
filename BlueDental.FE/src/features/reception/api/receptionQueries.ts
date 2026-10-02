import { keepPreviousData, useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import { receptionApi } from "./receptionApi";
import { staffApi } from "@/features/staff/api/staffApi";
import { t } from "@/lib/i18n";
import type { ReceptionFilter } from "../types/reception";

const PAGE_SIZE = 20;

export function useReceptionList(filter: ReceptionFilter = {}) {
  return useInfiniteQuery({
    queryKey: ["receptions", filter],
    queryFn: ({ pageParam = 0 }) =>
      receptionApi.getList(filter, pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });
}

export function useReceptionMetrics(filter: ReceptionFilter = {}) {
  return useQuery({
    queryKey: ["receptionMetrics", filter],
    queryFn: () => receptionApi.getMetrics(filter),
  });
}

/** A doctor's booked spans for one week (Monday → Sunday); idle without a doctor. */
export function useDentistBusySpans(dentistId: string | undefined, weekStart: string, weekEnd: string) {
  return useQuery({
    queryKey: ["receptions", "busy", dentistId, weekStart, weekEnd],
    queryFn: () => receptionApi.getDentistBusySpans(dentistId ?? "", weekStart, weekEnd),
    enabled: !!dentistId,
  });
}

interface ReceptionDoctor {
  id: string;
  name: string;
  title: string;
  branchIds?: string[];
}

async function fetchReceptionDoctors(branchId?: string, availableOn?: string): Promise<ReceptionDoctor[]> {
  const result = await staffApi.list({ maxResultCount: 50, isActive: true, branchId, availableOn });
  return result.items.map((s) => ({
    id: s.id,
    name: s.name ?? s.userName ?? "",
    title: s.roleNames[0] ?? t("Reception:Doctor"),
    branchIds: s.branchIds,
  }));
}

/** Every doctor at the branch — the board's filters, whoever is off today. */
export function useReceptionDoctors(branchId?: string) {
  return useQuery({
    queryKey: ["receptionDoctors", branchId],
    queryFn: () => fetchReceptionDoctors(branchId),
  });
}

function availableDoctorsQuery(branchId: string | undefined, day: string) {
  return {
    queryKey: ["receptionDoctors", branchId, { availableOn: day }],
    queryFn: () => fetchReceptionDoctors(branchId, day),
    // The OFF toggle is pressed on Chấm công, often by someone else.
    staleTime: 0,
  };
}

/**
 * Doctors a visit on `day` ("YYYY-MM-DD") can go to: those registered OFF
 * that day on Chấm công are left out. Idle without a day.
 */
export function useAvailableReceptionDoctors(branchId: string | undefined, day: string | undefined) {
  return useQuery({
    ...availableDoctorsQuery(branchId, day ?? ""),
    enabled: Boolean(day),
    placeholderData: keepPreviousData,
  });
}

/** The same list for each day the board is showing, keyed by day. */
export function useAvailableReceptionDoctorsByDay(branchId: string | undefined, days: string[]) {
  return useQueries({
    queries: days.map((day) => availableDoctorsQuery(branchId, day)),
    combine: (results) => {
      const byDay = new Map<string, ReceptionDoctor[]>();
      results.forEach((r, i) => {
        if (r.data) byDay.set(days[i], r.data);
      });
      return byDay;
    },
  });
}
