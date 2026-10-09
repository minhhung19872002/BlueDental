import { useMutation } from "@tanstack/react-query";
import { receptionApi } from "./receptionApi";
import type {
  AppointmentOutcome,
  BookFollowUpInput,
  BookedOutcome,
  CreateReceptionInput,
  RebookUndatedInput,
} from "../types/reception";
import { useCurrentBranchId } from "@/lib/clinicBranch";

/**
 * A reception is an appointment, so each write refreshes whatever reads
 * appointments — this screen, the calendar, the editor's detail and the
 * patient list's rollup.
 */
const INVALIDATES_APPOINTMENTS = { invalidates: ["appointment"] } as const;

export function useCreateReception() {
  const branchId = useCurrentBranchId();

  return useMutation({
    mutationFn: (input: CreateReceptionInput) =>
      receptionApi.create({ ...input, branchId: input.overrideBranchId ?? branchId }),
    meta: INVALIDATES_APPOINTMENTS,
  });
}

export function useUpdateReceptionStatus() {
  return useMutation({
    mutationFn: ({ id, action, outcome }: {
      id: string;
      action: "check-in" | "start" | "complete";
      outcome?: NonNullable<AppointmentOutcome>;
    }) => receptionApi.updateStatus(id, action, outcome),
    meta: INVALIDATES_APPOINTMENTS,
  });
}

export function useCancelReception() {
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      receptionApi.cancel(id, reason),
    meta: INVALIDATES_APPOINTMENTS,
  });
}

export function useAssignReceptionDentist() {
  return useMutation({
    mutationFn: ({ id, dentistId }: { id: string; dentistId: string }) =>
      receptionApi.assignDentist(id, dentistId),
    meta: INVALIDATES_APPOINTMENTS,
  });
}

export function useAttachReceptionPatient() {
  return useMutation({
    mutationFn: ({ id, patientId }: { id: string; patientId: string }) =>
      receptionApi.attachPatient(id, patientId),
    meta: INVALIDATES_APPOINTMENTS,
  });
}

export function useBookFollowUp() {
  return useMutation({
    mutationFn: ({ id, input, outcome }: { id: string; input: BookFollowUpInput; outcome: BookedOutcome }) =>
      receptionApi.bookFollowUp(id, input, outcome),
    meta: INVALIDATES_APPOINTMENTS,
  });
}

export function useRebookUndated() {
  return useMutation({
    mutationFn: ({ id, input, outcome }: { id: string; input: RebookUndatedInput; outcome: BookedOutcome }) =>
      receptionApi.rebookUndated(id, input, outcome),
    meta: INVALIDATES_APPOINTMENTS,
  });
}

export function useSetReceptionOutcome() {
  return useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: NonNullable<AppointmentOutcome> }) =>
      receptionApi.setOutcome(id, outcome),
    meta: INVALIDATES_APPOINTMENTS,
  });
}
