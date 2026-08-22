import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

export interface ConsultationRecordDto {
  id: string;
  patientId: string;
  procedureId?: string;
  serviceName: string;
  unitPrice: number;
  quantity: number;
  totalAmount: number;
  notes?: string;
  creationTime: string;
}

export interface CreateConsultationRecordDto {
  patientId: string;
  procedureId?: string;
  serviceName: string;
  unitPrice: number;
  quantity?: number;
  notes?: string;
}

const consultationApi = {
  list: (params?: { patientId?: string; filter?: string; maxResultCount?: number }): Promise<PagedResult<ConsultationRecordDto>> =>
    api.get("/v1/app/consultation-records", { params }).then((r) => r.data),
  create: (data: CreateConsultationRecordDto): Promise<ConsultationRecordDto> =>
    api.post("/v1/app/consultation-records", data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/consultation-records/${id}`).then((r) => r.data),
};

export function usePatientConsultationRecords(patientId: string) {
  return useQuery({
    queryKey: ["consultation-records", patientId],
    queryFn: () => consultationApi.list({ patientId, maxResultCount: 100 }),
    enabled: Boolean(patientId),
    select: (d) => d.items,
  });
}

export function useCreateConsultationRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateConsultationRecordDto) => consultationApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consultation-records"] }),
  });
}

export function useDeleteConsultationRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => consultationApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consultation-records"] }),
  });
}
