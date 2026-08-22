import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

export interface DiagnosticRecordDto {
  id: string;
  code: string;
  patientId: string;
  dentistId: string;
  dentistName?: string;
  appointmentId?: string;
  teethNumbers?: string;
  diagnosis?: string;
  notes?: string;
  creationTime: string;
}

export interface CreateDiagnosticRecordDto {
  patientId: string;
  dentistId: string;
  appointmentId?: string;
  teethNumbers?: string;
  diagnosis?: string;
  notes?: string;
}

const diagnosticApi = {
  list: (params?: { patientId?: string; filter?: string; maxResultCount?: number }): Promise<PagedResult<DiagnosticRecordDto>> =>
    api.get("/v1/app/diagnostic-records", { params }).then((r) => r.data),
  create: (data: CreateDiagnosticRecordDto): Promise<DiagnosticRecordDto> =>
    api.post("/v1/app/diagnostic-records", data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/diagnostic-records/${id}`).then((r) => r.data),
};

export function usePatientDiagnosticRecords(patientId: string) {
  return useQuery({
    queryKey: ["diagnostic-records", patientId],
    queryFn: () => diagnosticApi.list({ patientId, maxResultCount: 100 }),
    enabled: Boolean(patientId),
    select: (d) => d.items,
  });
}

export function useCreateDiagnosticRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDiagnosticRecordDto) => diagnosticApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diagnostic-records"] }),
  });
}

export function useDeleteDiagnosticRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => diagnosticApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["diagnostic-records"] }),
  });
}
