import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";
import { usePrescriptions } from "./prescriptionApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";

export interface TreatmentPlanDto {
  id: string;
  patientId: string;
  patientName: string;
  title: string;
  status: string;
  estimatedCost: number;
  notes?: string;
  creationTime: string;
}

export interface CreateTreatmentPlanDto {
  patientId: string;
  branchId: string;
  title: string;
  notes?: string;
  estimatedCost?: number;
}

const treatmentPlanApi = {
  list: (params: { patientId?: string; skipCount?: number; maxResultCount?: number }): Promise<PagedResult<TreatmentPlanDto>> =>
    api.get("/v1/app/treatment-plans", { params }).then((r) => r.data),

  get: (id: string): Promise<TreatmentPlanDto> =>
    api.get(`/v1/app/treatment-plans/${id}`).then((r) => r.data),

  create: (data: CreateTreatmentPlanDto): Promise<TreatmentPlanDto> =>
    api.post("/v1/app/treatment-plans", data).then((r) => r.data),
};

export function useTreatmentPlanList(params: { patientId?: string; skipCount?: number; maxResultCount?: number } = {}) {
  return useQuery({
    queryKey: ["treatment-plans", params],
    queryFn: () => treatmentPlanApi.list(params),
    enabled: Boolean(params.patientId) || !params.patientId,
  });
}

export function useTreatmentPlan(id: string) {
  return useQuery({
    queryKey: ["treatment-plans", id],
    queryFn: () => treatmentPlanApi.get(id),
    enabled: Boolean(id),
  });
}

export function useCreateTreatmentPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTreatmentPlanDto) => treatmentPlanApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["treatment-plans"] }),
  });
}

/**
 * The patient tab asks for a patient's slips without naming a branch; the list
 * hook takes one, so this passes the branch the header is on.
 */
export function usePatientPrescriptions(patientId: string) {
  const branchId = useCurrentBranchId();
  const query = usePrescriptions(patientId, branchId);
  return { ...query, data: query.data?.items };
}
