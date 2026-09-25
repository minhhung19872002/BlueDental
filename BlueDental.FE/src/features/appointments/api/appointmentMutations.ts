import { CANCELLATION_REASON, type CancellationReason } from "../types/appointment";
import { useMutation } from "@tanstack/react-query";
import { appointmentApi } from "./appointmentApi";
import type {
  CreateAppointmentRequest,
  CreateTempAppointmentRequest,
  UpdateAppointmentRequest,
} from "../types/appointment";

/**
 * Every appointment write refreshes the lists, the details (the editor seeds
 * its form from one), Tiếp nhận and the patient list's visit rollup — all
 * declared once, as the "appointment" entity.
 */
const INVALIDATES_APPOINTMENTS = { invalidates: ["appointment"] } as const;

export function useCreateAppointment() {
  return useMutation({
    mutationKey: ["appointments", "create"],
    mutationFn: (data: CreateAppointmentRequest) =>
      appointmentApi.create(data),
    meta: INVALIDATES_APPOINTMENTS,
  });
}

export function useCreateTempAppointment() {
  return useMutation({
    mutationKey: ["appointments", "createTemp"],
    mutationFn: (data: CreateTempAppointmentRequest) =>
      appointmentApi.createTemp(data),
    meta: INVALIDATES_APPOINTMENTS,
  });
}

export function useUpdateAppointment(id: string) {
  return useMutation({
    mutationKey: ["appointments", "update", id],
    mutationFn: (data: UpdateAppointmentRequest) =>
      appointmentApi.update(id, data),
    meta: INVALIDATES_APPOINTMENTS,
  });
}

export function useDeleteAppointment() {
  return useMutation({
    mutationKey: ["appointments", "delete"],
    mutationFn: (id: string) => appointmentApi.delete(id),
    meta: INVALIDATES_APPOINTMENTS,
  });
}

export function useDeleteManyAppointments() {
  return useMutation({
    mutationKey: ["appointments", "deleteMany"],
    mutationFn: (ids: string[]) => appointmentApi.deleteMany(ids),
    meta: INVALIDATES_APPOINTMENTS,
  });
}

export function useCancelAppointment() {
  return useMutation({
    mutationKey: ["appointments", "cancel"],
    // The server needs a CancellationReason; "khách yêu cầu" is the everyday one.
    mutationFn: (input: { id: string; reason?: CancellationReason; note?: string }) =>
      appointmentApi.cancel(
        input.id,
        input.reason ?? CANCELLATION_REASON.PatientRequest,
        input.note,
      ),
    meta: INVALIDATES_APPOINTMENTS,
  });
}
