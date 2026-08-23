import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  consultingApi,
  type CreatePatientAdviseDto,
  type CreatePatientDiagnosisDto,
  type ListByPatientInput,
} from "./consultingApi";

export const consultingKeys = {
  all: ["consulting"] as const,
  diagnoses: (params: ListByPatientInput) => [...consultingKeys.all, "diagnoses", params] as const,
  advises: (params: ListByPatientInput) => [...consultingKeys.all, "advises", params] as const,
  adviseSummary: (params: ListByPatientInput) =>
    [...consultingKeys.all, "advise-summary", params] as const,
  adviseGroups: (params: ListByPatientInput) =>
    [...consultingKeys.all, "advise-groups", params] as const,
};

export function usePatientDiagnoses(params: ListByPatientInput) {
  return useQuery({
    queryKey: consultingKeys.diagnoses(params),
    queryFn: () => consultingApi.diagnoses(params),
    enabled: Boolean(params.patientId),
  });
}

export function usePatientAdvises(params: ListByPatientInput) {
  return useQuery({
    queryKey: consultingKeys.advises(params),
    queryFn: () => consultingApi.advises(params),
    enabled: Boolean(params.patientId),
  });
}

export function usePatientAdviseSummary(params: ListByPatientInput) {
  return useQuery({
    queryKey: consultingKeys.adviseSummary(params),
    queryFn: () => consultingApi.adviseSummary(params),
    enabled: Boolean(params.patientId),
  });
}

export function useAdviseGroups(params: ListByPatientInput) {
  return useQuery({
    queryKey: consultingKeys.adviseGroups(params),
    queryFn: () => consultingApi.adviseGroups(params),
    enabled: Boolean(params.patientId),
  });
}

/** Every consulting mutation invalidates the whole consulting tree — diagnoses,
 *  advises and the summary all move together. */
function useConsultingMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: consultingKeys.all });
    },
  });
}

export function useCreateDiagnosis() {
  return useConsultingMutation((input: CreatePatientDiagnosisDto) =>
    consultingApi.createDiagnosis(input),
  );
}

export function useCancelDiagnosis() {
  return useConsultingMutation((id: string) => consultingApi.cancelDiagnosis(id));
}

export function useCreateAdvise() {
  return useConsultingMutation((input: CreatePatientAdviseDto) =>
    consultingApi.createAdvise(input),
  );
}

export function useAcceptAdvise() {
  return useConsultingMutation((id: string) => consultingApi.acceptAdvise(id));
}

export function useRejectAdvise() {
  return useConsultingMutation((id: string) => consultingApi.rejectAdvise(id));
}
