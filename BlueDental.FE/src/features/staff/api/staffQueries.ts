import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { STAFF_ROLE } from "@/hooks/useStaffOptions";
import {
  staffApi,
  type CreateStaffInput,
  type GetStaffListInput,
  type UpdateStaffInput,
} from "./staffApi";

export const staffKeys = {
  all: ["staff"] as const,
  lists: () => [...staffKeys.all, "list"] as const,
  list: (params: GetStaffListInput) => [...staffKeys.lists(), params] as const,
  detail: (id: string) => [...staffKeys.all, "detail", id] as const,
};

export function useStaffList(params: GetStaffListInput = {}) {
  return useQuery({
    queryKey: staffKeys.list(params),
    queryFn: () => staffApi.list(params),
  });
}

export function useStaff(id: string) {
  return useQuery({
    queryKey: staffKeys.detail(id),
    queryFn: () => staffApi.get(id),
    enabled: Boolean(id),
  });
}

export function useStaffRoleNames() {
  return useQuery({
    queryKey: [...staffKeys.all, "roles"],
    queryFn: () => staffApi.roleNames(),
  });
}

/**
 * Staff are read well beyond this screen — every doctor and staff picker,
 * Tiếp nhận's doctors, the signed-in account's own permissions.
 */
function useStaffMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  return useMutation({
    mutationFn: fn,
    meta: { invalidates: ["staff"] },
  });
}

export function useCreateStaff() {
  return useStaffMutation((input: CreateStaffInput) => staffApi.create(input));
}

export function useUpdateStaff() {
  return useStaffMutation((input: { id: string; data: UpdateStaffInput }) =>
    staffApi.update(input.id, input.data),
  );
}

export function useDeleteStaff() {
  return useStaffMutation((id: string) => staffApi.remove(id));
}

/**
 * Returns only dentists (`isDentist === true`) for calendar doctor columns.
 *
 * With `availableOn` ("YYYY-MM-DD") it is a booking picker instead: doctors
 * registered OFF that day are left out, under a key of its own so the calendar
 * columns and filters keep everyone. Always re-read on mount — the OFF toggle
 * is pressed on another screen, often by someone else.
 */
export function useDentistList(availableOn?: string) {
  return useQuery({
    queryKey: availableOn
      ? [...staffKeys.lists(), "dentists", { availableOn }]
      : [...staffKeys.lists(), "dentists"],
    staleTime: availableOn ? 0 : undefined,
    // Changing the day keeps the old list (and the chosen name) on screen
    // until the new day's list replaces it.
    placeholderData: availableOn ? keepPreviousData : undefined,
    queryFn: async () => {
      // Staff ticked "Bác sĩ", filtered on the server. Filtering a 50-row page
      // here, with eight of anyone as a fallback, offered untagged staff as
      // doctors (owner, 2026-10-05).
      const result = await staffApi.list({
        maxResultCount: 1000,
        isActive: true,
        availableOn,
        role: STAFF_ROLE.Dentist,
      });

      return result.items.map((s) => ({
        ...s,
        name: s.fullName || s.userName,
      }));
    },
  });
}
