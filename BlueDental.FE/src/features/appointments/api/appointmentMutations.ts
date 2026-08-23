import { CANCELLATION_REASON, type CancellationReason } from "../types/appointment";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { appointmentApi } from "./appointmentApi";
import { appointmentKeys } from "./appointmentQueries";
import type {
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
} from "../types/appointment";

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["appointments", "create"],
    mutationFn: (data: CreateAppointmentRequest) =>
      appointmentApi.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: appointmentKeys.lists(),
      });
    },
  });
}

export function useUpdateAppointment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["appointments", "update", id],
    mutationFn: (data: UpdateAppointmentRequest) =>
      appointmentApi.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: appointmentKeys.detail(id),
      });
      void queryClient.invalidateQueries({
        queryKey: appointmentKeys.lists(),
      });
    },
  });
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["appointments", "cancel"],
    // The server needs a CancellationReason; "khách yêu cầu" is the everyday one.
    mutationFn: (input: { id: string; reason?: CancellationReason; note?: string }) =>
      appointmentApi.cancel(
        input.id,
        input.reason ?? CANCELLATION_REASON.PatientRequest,
        input.note,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: appointmentKeys.lists(),
      });
    },
  });
}
