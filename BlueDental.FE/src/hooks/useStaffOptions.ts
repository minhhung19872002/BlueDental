import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";

/**
 * Staff, as options for a picker.
 *
 * Lives here rather than in the staff feature because more than one feature
 * needs it — Vận hành filters several of its reports by who did the work — and
 * a feature may not reach into another feature's folder.
 */
export interface StaffOption {
  value: string;
  label: string;
}

interface StaffRow {
  id: string;
  name: string | null;
  surname: string | null;
  userName: string;
  isDentist?: boolean;
  isAssistant?: boolean;
}

function buildLabel(row: StaffRow): string {
  return [row.surname, row.name].filter(Boolean).join(" ").trim() || row.userName;
}

export const staffOptionKeys = {
  all: ["staff-options"] as const,
};

export function useStaffOptions() {
  return useQuery({
    queryKey: staffOptionKeys.all,
    queryFn: async (): Promise<StaffOption[]> => {
      const response = await api.get("/v1/app/staff", {
        params: { MaxResultCount: 200 },
      });

      const items: StaffRow[] = response.data?.items ?? [];

      return items.map((row) => ({
        value: row.id,
        label: buildLabel(row),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Prefetched list filtered to staff where `isDentist === true`; with
 * `availableOn` ("YYYY-MM-DD") doctors registered OFF that day are left out.
 */
export function useDentistStaffOptions(availableOn?: string) {
  return useQuery({
    queryKey: [...staffOptionKeys.all, "dentist", availableOn ?? null],
    staleTime: availabilityStaleTime(availableOn) ?? 5 * 60 * 1000,
    queryFn: async (): Promise<StaffOption[]> => {
      const response = await api.get("/v1/app/staff", {
        params: { MaxResultCount: 200, AvailableOn: availableOn },
      });

      const items: StaffRow[] = response.data?.items ?? [];
      const dentists = items.filter((row) => row.isDentist);
      const chosen = dentists.length > 0 ? dentists : items;

      return chosen.map((row) => ({
        value: row.id,
        label: buildLabel(row),
      }));
    },
  });
}

interface StaffSearchRow extends StaffRow {
  fullName?: string | null;
  roleNames?: string[];
  isDentist?: boolean;
  isAssistant?: boolean;
}

function displayName(row: StaffSearchRow): string {
  return (
    row.fullName?.trim() ||
    [row.surname, row.name].filter(Boolean).join(" ").trim() ||
    row.userName
  );
}

/**
 * Staff, **searched on the server** — one page per term, not a prefetched list
 * matched in the browser. A clinic whose staff outgrows one page cannot be
 * searched any other way.
 */
export function useStaffSearch(search: string, enabled = true) {
  const term = search.trim();

  return useQuery({
    queryKey: [...staffOptionKeys.all, "search", term] as const,
    queryFn: async (): Promise<StaffOption[]> => {
      const response = await api.get("/v1/app/staff", {
        params: { MaxResultCount: 20, IsActive: true, Filter: term || undefined },
      });
      const items: StaffSearchRow[] = response.data?.items ?? [];
      return items.map((row) => ({ value: row.id, label: displayName(row) }));
    },
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * Query params for a server-side staff search. `availableOn` ("YYYY-MM-DD")
 * leaves out staff registered OFF that day on Chấm công.
 */
function searchParams(term: string, availableOn?: string) {
  return { MaxResultCount: 20, IsActive: true, Filter: term || undefined, AvailableOn: availableOn };
}

/**
 * A day-filtered picker is always re-read on mount: the OFF toggle is pressed
 * on another screen, often by someone else, so a cached list would still offer
 * a doctor who has just gone off.
 */
function availabilityStaleTime(availableOn?: string) {
  return availableOn ? 0 : undefined;
}

/**
 * The same search, narrowed to dentists. Prefers the `isDentist` boolean; a
 * clinic that has not tagged its dentists still gets all names.
 */
export function useDentistSearch(search: string, enabled = true, availableOn?: string) {
  const term = search.trim();

  return useQuery({
    queryKey: [...staffOptionKeys.all, "dentists", "search", term, availableOn ?? null] as const,
    staleTime: availabilityStaleTime(availableOn),
    queryFn: async (): Promise<StaffOption[]> => {
      const response = await api.get("/v1/app/staff", { params: searchParams(term, availableOn) });
      const items: StaffSearchRow[] = response.data?.items ?? [];
      const dentists = items.filter((row) => row.isDentist);
      const chosen = dentists.length > 0 ? dentists : items;
      return chosen.map((row) => ({ value: row.id, label: displayName(row) }));
    },
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * Server-searched staff, narrowed to assistants via the `isAssistant` boolean.
 * Falls back to all staff if no one is tagged.
 */
export function useAssistantSearch(search: string, enabled = true, availableOn?: string) {
  const term = search.trim();

  return useQuery({
    queryKey: [...staffOptionKeys.all, "assistants", "search", term, availableOn ?? null] as const,
    staleTime: availabilityStaleTime(availableOn),
    queryFn: async (): Promise<StaffOption[]> => {
      const response = await api.get("/v1/app/staff", { params: searchParams(term, availableOn) });
      const items: StaffSearchRow[] = response.data?.items ?? [];
      const assistants = items.filter((row) => row.isAssistant);
      const chosen = assistants.length > 0 ? assistants : items;
      return chosen.map((row) => ({ value: row.id, label: displayName(row) }));
    },
    placeholderData: keepPreviousData,
    enabled,
  });
}
