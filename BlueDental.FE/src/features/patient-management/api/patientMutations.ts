import { useMutation, useQueryClient } from "@tanstack/react-query";
import { patientApi } from "./patientApi";
import { patientKeys } from "./patientQueries";
import type { RegisterPatientRequest, UpdatePatientRequest } from "../types/patient";

export function useRegisterPatient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["patients", "create"],
    mutationFn: (data: RegisterPatientRequest) => patientApi.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientKeys.lists() });
      // The next dialog must not reopen on the code this one just used.
      void queryClient.invalidateQueries({ queryKey: patientKeys.codeEstimate() });
    },
  });
}

export function useUpdatePatient(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["patients", "update", id],
    mutationFn: (data: UpdatePatientRequest) => patientApi.update(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: patientKeys.lists() });
    },
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["patients", "delete"],
    mutationFn: (id: string) => patientApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: patientKeys.lists() });
    },
  });
}
