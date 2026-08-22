import { useMutation, useQueryClient } from "@tanstack/react-query";
import { receptionApi } from "./receptionApi";
import type { CreateReceptionInput, ReceptionStatus, AppointmentOutcome } from "../types/reception";

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

export function useUpdateReceptionOutcome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: AppointmentOutcome }) =>
      receptionApi.updateOutcome(id, outcome ?? ""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receptions"] });
    },
  });
}

export function useUpdateReceptionDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, doctorId }: { id: string; doctorId: string }) =>
      receptionApi.updateDoctor(id, doctorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receptions"] });
    },
  });
}
