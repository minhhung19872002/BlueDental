import { CANCELLATION_REASON, type CancellationReason } from "../types/appointment";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { appointmentApi } from "./appointmentApi";
import { appointmentKeys } from "./appointmentQueries";
import type {
  CreateAppointmentRequest,
  CreateTempAppointmentRequest,
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

export function useCreateTempAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["appointments", "createTemp"],
    mutationFn: (data: CreateTempAppointmentRequest) =>
      appointmentApi.createTemp(data),
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

export function useDeleteAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["appointments", "delete"],
    mutationFn: (id: string) => appointmentApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: appointmentKeys.lists(),
      });
    },
  });
}

export function useDeleteManyAppointments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["appointments", "deleteMany"],
    mutationFn: (ids: string[]) => appointmentApi.deleteMany(ids),
    onSuccess: () => {
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
