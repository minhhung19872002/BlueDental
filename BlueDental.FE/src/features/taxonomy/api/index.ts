import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

// ── Enums ─────────────────────────────────────────────────────────────────

export type ProcedureCategory =
  | "General"
  | "Surgery"
  | "Cosmetic"
  | "Orthodontics"
  | "Implant";

export const PROCEDURE_CATEGORY_LABELS: Record<ProcedureCategory, string> = {
  General: "Nha khoa tổng quát",
  Surgery: "Phẫu thuật nha chu",
  Cosmetic: "Nha khoa thẩm mỹ",
  Orthodontics: "Chỉnh nha",
  Implant: "Cấy ghép implant",
};

// ── DTOs ──────────────────────────────────────────────────────────────────

export interface DentalProcedureDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: ProcedureCategory;
  basePrice: number;
  estimatedDurationMinutes: number;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreateDentalProcedureDto {
  code: string;
  name: string;
  description?: string;
  category: ProcedureCategory;
  basePrice: number;
  estimatedDurationMinutes?: number;
}

export interface UpdateDentalProcedureDto {
  name: string;
  description?: string;
  category: ProcedureCategory;
  basePrice: number;
  estimatedDurationMinutes?: number;
}

// ── API ───────────────────────────────────────────────────────────────────

const dentalProcedureApi = {
  list: (params?: {
    filter?: string;
    category?: ProcedureCategory;
    isActive?: boolean;
    skipCount?: number;
    maxResultCount?: number;
  }): Promise<PagedResult<DentalProcedureDto>> =>
    api.get("/v1/app/dental-procedures", { params }).then((r) => r.data),

  get: (id: string): Promise<DentalProcedureDto> =>
    api.get(`/v1/app/dental-procedures/${id}`).then((r) => r.data),

  create: (data: CreateDentalProcedureDto): Promise<DentalProcedureDto> =>
    api.post("/v1/app/dental-procedures", data).then((r) => r.data),

  update: (id: string, data: UpdateDentalProcedureDto): Promise<DentalProcedureDto> =>
    api.put(`/v1/app/dental-procedures/${id}`, data).then((r) => r.data),

  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/dental-procedures/${id}`).then((r) => r.data),
};

// ── Hooks ─────────────────────────────────────────────────────────────────

export function useDentalProcedureList(params?: {
  filter?: string;
  category?: ProcedureCategory;
  isActive?: boolean;
}) {
  return useQuery({
    queryKey: ["dental-procedures", params],
    queryFn: () =>
      dentalProcedureApi.list({ ...params, maxResultCount: 200 }),
  });
}

export function useCreateDentalProcedure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDentalProcedureDto) =>
      dentalProcedureApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dental-procedures"] }),
  });
}

export function useUpdateDentalProcedure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDentalProcedureDto }) =>
      dentalProcedureApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dental-procedures"] }),
  });
}

export function useDeleteDentalProcedure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dentalProcedureApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dental-procedures"] }),
  });
}
