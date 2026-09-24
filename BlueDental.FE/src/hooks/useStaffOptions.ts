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

export function useStaffOptions() {
  return useQuery({
    queryKey: ["staff-options"],
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

/** Prefetched list filtered to staff where `isDentist === true`. */
export function useDentistStaffOptions() {
  return useQuery({
    queryKey: ["staff-options", "dentist"],
    queryFn: async (): Promise<StaffOption[]> => {
      const response = await api.get("/v1/app/staff", {
        params: { MaxResultCount: 200 },
      });

      const items: StaffRow[] = response.data?.items ?? [];
      const dentists = items.filter((row) => row.isDentist);
      const chosen = dentists.length > 0 ? dentists : items;

      return chosen.map((row) => ({
        value: row.id,
        label: buildLabel(row),
      }));
    },
    staleTime: 5 * 60 * 1000,
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
    queryKey: ["staff-options", "search", term] as const,
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
 * The same search, narrowed to dentists. Prefers the `isDentist` boolean; a
 * clinic that has not tagged its dentists still gets all names.
 */
export function useDentistSearch(search: string, enabled = true) {
  const term = search.trim();

  return useQuery({
    queryKey: ["staff-options", "dentists", "search", term] as const,
    queryFn: async (): Promise<StaffOption[]> => {
      const response = await api.get("/v1/app/staff", {
        params: { MaxResultCount: 20, IsActive: true, Filter: term || undefined },
      });
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
export function useAssistantSearch(search: string, enabled = true) {
  const term = search.trim();

  return useQuery({
    queryKey: ["staff-options", "assistants", "search", term] as const,
    queryFn: async (): Promise<StaffOption[]> => {
      const response = await api.get("/v1/app/staff", {
        params: { MaxResultCount: 20, IsActive: true, Filter: term || undefined },
      });
      const items: StaffSearchRow[] = response.data?.items ?? [];
      const assistants = items.filter((row) => row.isAssistant);
      const chosen = assistants.length > 0 ? assistants : items;
      return chosen.map((row) => ({ value: row.id, label: displayName(row) }));
    },
    placeholderData: keepPreviousData,
    enabled,
  });
}
