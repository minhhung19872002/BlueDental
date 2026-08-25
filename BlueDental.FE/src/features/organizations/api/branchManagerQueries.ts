import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  branchManagerApi,
  type CreateBranchManagerInput,
  type GetBranchManagerListInput,
  type UpdateBranchManagerInput,
} from "./branchManagerApi";

export const branchManagerKeys = {
  all: ["branch-managers"] as const,
  lists: () => [...branchManagerKeys.all, "list"] as const,
  list: (params: GetBranchManagerListInput) => [...branchManagerKeys.lists(), params] as const,
  detail: (id: string) => [...branchManagerKeys.all, "detail", id] as const,
};

export function useBranchManagerList(params: GetBranchManagerListInput = {}) {
  return useQuery({
    queryKey: branchManagerKeys.list(params),
    queryFn: () => branchManagerApi.list(params),
  });
}

function useBranchManagerMutation<TVariables, TData>(
  fn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: branchManagerKeys.all });
    },
  });
}

export function useCreateBranchManager() {
  return useBranchManagerMutation((input: CreateBranchManagerInput) =>
    branchManagerApi.create(input),
  );
}

export function useUpdateBranchManager() {
  return useBranchManagerMutation((input: { id: string; data: UpdateBranchManagerInput }) =>
    branchManagerApi.update(input.id, input.data),
  );
}

export function useDeleteBranchManager() {
  return useBranchManagerMutation((id: string) => branchManagerApi.remove(id));
}
