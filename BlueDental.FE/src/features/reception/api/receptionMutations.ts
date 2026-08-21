import { useMutation, useQueryClient } from "@tanstack/react-query";
import { receptionApi } from "./receptionApi";
import type { CreateReceptionInput, ReceptionStatus } from "../types/reception";

export function useCreateReception() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateReceptionInput) => receptionApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receptions"] });
      queryClient.invalidateQueries({ queryKey: ["receptionMetrics"] });
    },
  });
}

export function useUpdateReceptionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReceptionStatus }) =>
      receptionApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receptions"] });
      queryClient.invalidateQueries({ queryKey: ["receptionMetrics"] });
    },
  });
}
