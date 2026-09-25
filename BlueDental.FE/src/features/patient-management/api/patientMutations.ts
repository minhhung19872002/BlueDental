import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { patientApi } from "./patientApi";
import { patientKeys } from "./patientQueries";
import type { RegisterPatientRequest, UpdatePatientRequest } from "../types/patient";

/**
 * The whole patient namespace plus the shared pickers. On a register that
 * includes the code estimate, so the next dialog does not reopen on the code
 * this one just used.
 */
const INVALIDATES_PATIENTS = { invalidates: ["patient"] } as const;

export function useRegisterPatient() {
  return useMutation({
    mutationKey: ["patients", "create"],
    mutationFn: (data: RegisterPatientRequest) => patientApi.create(data),
    meta: INVALIDATES_PATIENTS,
  });
}

export function useUpdatePatient(id: string) {
  return useMutation({
    mutationKey: ["patients", "update", id],
    mutationFn: (data: UpdatePatientRequest) => patientApi.update(id, data),
    meta: INVALIDATES_PATIENTS,
  });
}

/** The + beside "Lý do đến khám" — appends one dated line to the card's list. */
export function useAddExaminationReason(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["patients", "examination-reason", id],
    mutationFn: (content: string) => patientApi.addExaminationReason(id, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientKeys.detail(id) });
    },
  });
}

export function useDeletePatient() {
  return useMutation({
    mutationKey: ["patients", "delete"],
    mutationFn: (id: string) => patientApi.delete(id),
    meta: INVALIDATES_PATIENTS,
  });
}

/** The three steps of Tiếp nhận on the record's appointment card. */
export type ReceptionStep = "check-in" | "start" | "complete";

/**
 * Walks an appointment one step along Tiếp nhận. `complete` binds a body —
 * [FromBody] CompleteAppointmentDto — while check-in and start take none, and
 * the note goes back as it stands because Appointment.Complete assigns Notes
 * unconditionally: leaving it out would erase it.
 */
export function useAdvanceReception() {
  return useMutation({
    mutationFn: (input: { appointmentId: string; step: ReceptionStep; notes: string | null }) =>
      api
        .post(
          `/v1/app/appointments/${input.appointmentId}/${input.step}`,
          input.step === "complete" ? { notes: input.notes } : undefined,
        )
        .then(() => undefined),
    // The status moves on the calendar, Tiếp nhận, the editor's detail and the
    // patient list's visit rollup, not only on this card.
    meta: { invalidates: ["appointment"] },
  });
}
