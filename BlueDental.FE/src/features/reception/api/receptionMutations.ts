import { useMutation, useQueryClient } from "@tanstack/react-query";
import { receptionApi } from "./receptionApi";
import type { CreateReceptionInput, AppointmentOutcome } from "../types/reception";
import { useCurrentBranchId } from "@/lib/clinicBranch";

export function useCreateReception() {
  const queryClient = useQueryClient();
  const branchId = useCurrentBranchId();

  return useMutation({
    mutationFn: (input: CreateReceptionInput) =>
      receptionApi.create({ ...input, branchId: input.overrideBranchId ?? branchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receptions"] });
      queryClient.invalidateQueries({ queryKey: ["receptionMetrics"] });
    },
  });
}

export function useUpdateReceptionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "check-in" | "start" | "complete" }) =>
      receptionApi.updateStatus(id, action),
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

export function useCancelReception() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      receptionApi.cancel(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receptions"] });
      queryClient.invalidateQueries({ queryKey: ["receptionMetrics"] });
    },
  });
}
