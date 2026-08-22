import { useMutation, useQueryClient } from "@tanstack/react-query";
import { staffApi, type CreateStaffInput, type UpdateStaffInput } from "./staffApi";
import { staffKeys } from "./staffQueries";

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStaffInput) => staffApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staffKeys.all }),
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateStaffInput }) =>
      staffApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staffKeys.all }),
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => staffApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staffKeys.all }),
  });
}
