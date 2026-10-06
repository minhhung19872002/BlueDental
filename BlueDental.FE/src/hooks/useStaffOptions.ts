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

/**
 * Matches BlueDental.Staff.StaffPickerRole: the server keeps only staff whose
 * Bác sĩ (Dentist) or Phụ tá / Y sĩ (Assistant) box is ticked. Staff with no
 * box ticked are offered by neither picker (owner, 2026-10-05).
 */
export const STAFF_ROLE = { Dentist: 1, Assistant: 2 } as const;
export type StaffRole = (typeof STAFF_ROLE)[keyof typeof STAFF_ROLE];

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
 * Prefetched list of staff ticked "Bác sĩ"; with `availableOn` ("YYYY-MM-DD")
 * doctors registered OFF that day are left out.
 */
export function useDentistStaffOptions(availableOn?: string) {
  return useQuery({
    queryKey: [...staffOptionKeys.all, "dentist", availableOn ?? null],
    staleTime: availabilityStaleTime(availableOn) ?? 5 * 60 * 1000,
    queryFn: async (): Promise<StaffOption[]> => {
      const response = await api.get("/v1/app/staff", {
        params: { MaxResultCount: 200, AvailableOn: availableOn, Role: STAFF_ROLE.Dentist },
      });

      const items: StaffRow[] = response.data?.items ?? [];
      return items.map((row) => ({
        value: row.id,
        label: buildLabel(row),
      }));
    },
  });
}

/**
 * Ids of every active member of staff who fills `role` — for checking a
 * name a form starts with before it is put in a picker that would not offer
 * it. Undefined until loaded.
 */
export function useStaffRoleIds(role: StaffRole, availableOn?: string, enabled = true) {
  return useQuery({
    queryKey: [...staffOptionKeys.all, "role-ids", role, availableOn ?? null] as const,
    staleTime: availabilityStaleTime(availableOn) ?? 5 * 60 * 1000,
    queryFn: async (): Promise<ReadonlySet<string>> => {
      const response = await api.get("/v1/app/staff", {
        params: { MaxResultCount: 1000, IsActive: true, AvailableOn: availableOn, Role: role },
      });
      const items: StaffRow[] = response.data?.items ?? [];
      return new Set(items.map((row) => row.id));
    },
    enabled,
  }).data;
}

interface StaffSearchRow extends StaffRow {
  fullName?: string | null;
  roleNames?: string[];
  isDentist?: boolean;
  isAssistant?: boolean;
  isHygienist?: boolean;
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
function searchParams(term: string, availableOn: string | undefined, role: StaffRole) {
  return { MaxResultCount: 20, IsActive: true, Filter: term || undefined, AvailableOn: availableOn, Role: role };
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
 * The same search, narrowed on the server to staff ticked "Bác sĩ". Filtering a
 * 20-row page in the browser, with every name as a fallback, offered untagged
 * staff whenever the page held no dentist (owner, 2026-10-05).
 */
export function useDentistSearch(search: string, enabled = true, availableOn?: string) {
  const term = search.trim();

  return useQuery({
    queryKey: [...staffOptionKeys.all, "dentists", "search", term, availableOn ?? null] as const,
    staleTime: availabilityStaleTime(availableOn),
    queryFn: async (): Promise<StaffOption[]> => {
      const response = await api.get("/v1/app/staff", {
        params: searchParams(term, availableOn, STAFF_ROLE.Dentist),
      });
      const items: StaffSearchRow[] = response.data?.items ?? [];
      return items.map((row) => ({ value: row.id, label: displayName(row) }));
    },
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * Server-searched staff, narrowed to the "Phụ tá" picker's people: staff ticked
 * "Phụ tá" or "Y sĩ" (owner, 2026-10-05). No one ticked means no one offered.
 */
export function useAssistantSearch(search: string, enabled = true, availableOn?: string) {
  const term = search.trim();

  return useQuery({
    queryKey: [...staffOptionKeys.all, "assistants", "search", term, availableOn ?? null] as const,
    staleTime: availabilityStaleTime(availableOn),
    queryFn: async (): Promise<StaffOption[]> => {
      const response = await api.get("/v1/app/staff", {
        params: searchParams(term, availableOn, STAFF_ROLE.Assistant),
      });
      const items: StaffSearchRow[] = response.data?.items ?? [];
      return items.map((row) => ({ value: row.id, label: displayName(row) }));
    },
    placeholderData: keepPreviousData,
    enabled,
  });
}
