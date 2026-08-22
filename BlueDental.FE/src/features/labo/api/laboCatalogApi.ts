import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

// ── Labo Supplier ──────────────────────────────────────────────────────

export interface LaboSupplierDto {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreateLaboSupplierDto { name: string; phone?: string; email?: string; address?: string; }
export interface UpdateLaboSupplierDto { name: string; phone?: string; email?: string; address?: string; }

const laboSupplierApi = {
  list: (params?: { filter?: string; maxResultCount?: number }): Promise<PagedResult<LaboSupplierDto>> =>
    api.get("/v1/app/labo-suppliers", { params }).then((r) => r.data),
  create: (data: CreateLaboSupplierDto): Promise<LaboSupplierDto> =>
    api.post("/v1/app/labo-suppliers", data).then((r) => r.data),
  update: (id: string, data: UpdateLaboSupplierDto): Promise<LaboSupplierDto> =>
    api.put(`/v1/app/labo-suppliers/${id}`, data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/labo-suppliers/${id}`).then((r) => r.data),
};

export function useLaboSupplierList() {
  return useQuery({ queryKey: ["labo-suppliers"], queryFn: () => laboSupplierApi.list({ maxResultCount: 200 }) });
}
export function useCreateLaboSupplier() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: CreateLaboSupplierDto) => laboSupplierApi.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ["labo-suppliers"] }) });
}
export function useUpdateLaboSupplier() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdateLaboSupplierDto }) => laboSupplierApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["labo-suppliers"] }) });
}
export function useDeleteLaboSupplier() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => laboSupplierApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["labo-suppliers"] }) });
}

// ── Labo Bite Type ─────────────────────────────────────────────────────

export interface LaboBiteTypeDto {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreateLaboBiteTypeDto { name: string; description?: string; }
export interface UpdateLaboBiteTypeDto { name: string; description?: string; }

const laboBiteTypeApi = {
  list: (params?: { filter?: string; maxResultCount?: number }): Promise<PagedResult<LaboBiteTypeDto>> =>
    api.get("/v1/app/labo-bite-types", { params }).then((r) => r.data),
  create: (data: CreateLaboBiteTypeDto): Promise<LaboBiteTypeDto> =>
    api.post("/v1/app/labo-bite-types", data).then((r) => r.data),
  update: (id: string, data: UpdateLaboBiteTypeDto): Promise<LaboBiteTypeDto> =>
    api.put(`/v1/app/labo-bite-types/${id}`, data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/labo-bite-types/${id}`).then((r) => r.data),
};

export function useLaboBiteTypeList() {
  return useQuery({ queryKey: ["labo-bite-types"], queryFn: () => laboBiteTypeApi.list({ maxResultCount: 200 }) });
}
export function useCreateLaboBiteType() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: CreateLaboBiteTypeDto) => laboBiteTypeApi.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ["labo-bite-types"] }) });
}
export function useUpdateLaboBiteType() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdateLaboBiteTypeDto }) => laboBiteTypeApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["labo-bite-types"] }) });
}
export function useDeleteLaboBiteType() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => laboBiteTypeApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["labo-bite-types"] }) });
}

// ── Labo Finish Line ───────────────────────────────────────────────────

export interface LaboFinishLineDto {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreateLaboFinishLineDto { name: string; description?: string; }
export interface UpdateLaboFinishLineDto { name: string; description?: string; }

const laboFinishLineApi = {
  list: (params?: { filter?: string; maxResultCount?: number }): Promise<PagedResult<LaboFinishLineDto>> =>
    api.get("/v1/app/labo-finish-lines", { params }).then((r) => r.data),
  create: (data: CreateLaboFinishLineDto): Promise<LaboFinishLineDto> =>
    api.post("/v1/app/labo-finish-lines", data).then((r) => r.data),
  update: (id: string, data: UpdateLaboFinishLineDto): Promise<LaboFinishLineDto> =>
    api.put(`/v1/app/labo-finish-lines/${id}`, data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/labo-finish-lines/${id}`).then((r) => r.data),
};

export function useLaboFinishLineList() {
  return useQuery({ queryKey: ["labo-finish-lines"], queryFn: () => laboFinishLineApi.list({ maxResultCount: 200 }) });
}
export function useCreateLaboFinishLine() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: CreateLaboFinishLineDto) => laboFinishLineApi.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ["labo-finish-lines"] }) });
}
export function useUpdateLaboFinishLine() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdateLaboFinishLineDto }) => laboFinishLineApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["labo-finish-lines"] }) });
}
export function useDeleteLaboFinishLine() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => laboFinishLineApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["labo-finish-lines"] }) });
}

// ── Labo Rhythm Type ───────────────────────────────────────────────────

export interface LaboRhythmTypeDto {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreateLaboRhythmTypeDto { name: string; description?: string; }
export interface UpdateLaboRhythmTypeDto { name: string; description?: string; }

const laboRhythmTypeApi = {
  list: (params?: { filter?: string; maxResultCount?: number }): Promise<PagedResult<LaboRhythmTypeDto>> =>
    api.get("/v1/app/labo-rhythm-types", { params }).then((r) => r.data),
  create: (data: CreateLaboRhythmTypeDto): Promise<LaboRhythmTypeDto> =>
    api.post("/v1/app/labo-rhythm-types", data).then((r) => r.data),
  update: (id: string, data: UpdateLaboRhythmTypeDto): Promise<LaboRhythmTypeDto> =>
    api.put(`/v1/app/labo-rhythm-types/${id}`, data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/labo-rhythm-types/${id}`).then((r) => r.data),
};

export function useLaboRhythmTypeList() {
  return useQuery({ queryKey: ["labo-rhythm-types"], queryFn: () => laboRhythmTypeApi.list({ maxResultCount: 200 }) });
}
export function useCreateLaboRhythmType() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: CreateLaboRhythmTypeDto) => laboRhythmTypeApi.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ["labo-rhythm-types"] }) });
}
export function useUpdateLaboRhythmType() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdateLaboRhythmTypeDto }) => laboRhythmTypeApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["labo-rhythm-types"] }) });
}
export function useDeleteLaboRhythmType() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => laboRhythmTypeApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["labo-rhythm-types"] }) });
}
