import { useMutation, useQueryClient } from "@tanstack/react-query";
import { receptionApi } from "./receptionApi";
import type { AppointmentOutcome, CreateReceptionInput } from "../types/reception";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { appointmentKeys } from "@/features/appointments/api/appointmentQueries";

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["receptions"] });
  void queryClient.invalidateQueries({ queryKey: ["receptionMetrics"] });
  void queryClient.invalidateQueries({ queryKey: appointmentKeys.lists() });
}

export function useCreateReception() {
  const queryClient = useQueryClient();
  const branchId = useCurrentBranchId();

  return useMutation({
    mutationFn: (input: CreateReceptionInput) =>
      receptionApi.create({ ...input, branchId: input.overrideBranchId ?? branchId }),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useUpdateReceptionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "check-in" | "start" | "complete" }) =>
      receptionApi.updateStatus(id, action),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useCancelReception() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      receptionApi.cancel(id, reason),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useAssignReceptionDentist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dentistId }: { id: string; dentistId: string }) =>
      receptionApi.assignDentist(id, dentistId),
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useSetReceptionOutcome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: NonNullable<AppointmentOutcome> }) =>
      receptionApi.setOutcome(id, outcome),
    onSuccess: () => invalidateAll(queryClient),
  });
}
