import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

function useStaffMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffKeys.all });
    },
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

/** Returns only dentists (staff with "Dentist" role) for calendar doctor columns */
export function useDentistList() {
  return useQuery({
    queryKey: [...staffKeys.lists(), "dentists"],
    queryFn: async () => {
      const result = await staffApi.list({ maxResultCount: 50, isActive: true });
      const dentists = result.items.filter((s) =>
        s.roleNames.some(
          (r) => r.toLowerCase().includes("dentist") || r.toLowerCase().includes("bác sĩ"),
        ),
      );

      // A clinic that has not tagged its dentists yet still needs doctor columns.
      const chosen = dentists.length > 0 ? dentists : result.items.slice(0, 8);

      // Identity may hold no display name, so fall back to the login name.
      return chosen.map((s) => ({
        ...s,
        name: s.fullName || s.userName,
      }));
    },
  });
}
