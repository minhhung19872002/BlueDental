import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

// ── Patient Source ──────────────────────────────────────────────────────

export interface PatientSourceDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreatePatientSourceDto {
  code: string;
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdatePatientSourceDto {
  name: string;
  description?: string;
  sortOrder?: number;
}

const patientSourceApi = {
  list: (params?: { filter?: string; isActive?: boolean; skipCount?: number; maxResultCount?: number }): Promise<PagedResult<PatientSourceDto>> =>
    api.get("/v1/app/patient-sources", { params }).then((r) => r.data),
  create: (data: CreatePatientSourceDto): Promise<PatientSourceDto> =>
    api.post("/v1/app/patient-sources", data).then((r) => r.data),
  update: (id: string, data: UpdatePatientSourceDto): Promise<PatientSourceDto> =>
    api.put(`/v1/app/patient-sources/${id}`, data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/patient-sources/${id}`).then((r) => r.data),
};

export function usePatientSourceList() {
  return useQuery({
    queryKey: ["patient-sources"],
    queryFn: () => patientSourceApi.list({ maxResultCount: 200 }),
  });
}

export function useCreatePatientSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePatientSourceDto) => patientSourceApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patient-sources"] }),
  });
}

export function useUpdatePatientSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePatientSourceDto }) => patientSourceApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patient-sources"] }),
  });
}

export function useDeletePatientSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => patientSourceApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patient-sources"] }),
  });
}

// ── Occupation ──────────────────────────────────────────────────────────

export interface OccupationDto {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreateOccupationDto {
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateOccupationDto {
  name: string;
  description?: string;
  sortOrder?: number;
}

const occupationApi = {
  list: (params?: { filter?: string; isActive?: boolean; skipCount?: number; maxResultCount?: number }): Promise<PagedResult<OccupationDto>> =>
    api.get("/v1/app/occupations", { params }).then((r) => r.data),
  create: (data: CreateOccupationDto): Promise<OccupationDto> =>
    api.post("/v1/app/occupations", data).then((r) => r.data),
  update: (id: string, data: UpdateOccupationDto): Promise<OccupationDto> =>
    api.put(`/v1/app/occupations/${id}`, data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/occupations/${id}`).then((r) => r.data),
};

export function useOccupationList() {
  return useQuery({
    queryKey: ["occupations"],
    queryFn: () => occupationApi.list({ maxResultCount: 200 }),
  });
}

export function useCreateOccupation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateOccupationDto) => occupationApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["occupations"] }),
  });
}

export function useUpdateOccupation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOccupationDto }) => occupationApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["occupations"] }),
  });
}

export function useDeleteOccupation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => occupationApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["occupations"] }),
  });
}

// ── Payment Method ──────────────────────────────────────────────────────

export interface PaymentMethodDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreatePaymentMethodDto {
  code: string;
  name: string;
  description?: string;
}

export interface UpdatePaymentMethodDto {
  name: string;
  description?: string;
}

const paymentMethodApi = {
  list: (params?: { filter?: string; isActive?: boolean; skipCount?: number; maxResultCount?: number }): Promise<PagedResult<PaymentMethodDto>> =>
    api.get("/v1/app/payment-method-options", { params }).then((r) => r.data),
  create: (data: CreatePaymentMethodDto): Promise<PaymentMethodDto> =>
    api.post("/v1/app/payment-method-options", data).then((r) => r.data),
  update: (id: string, data: UpdatePaymentMethodDto): Promise<PaymentMethodDto> =>
    api.put(`/v1/app/payment-method-options/${id}`, data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/payment-method-options/${id}`).then((r) => r.data),
};

export function usePaymentMethodList() {
  return useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => paymentMethodApi.list({ maxResultCount: 200 }),
  });
}

export function useCreatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePaymentMethodDto) => paymentMethodApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment-methods"] }),
  });
}

export function useUpdatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePaymentMethodDto }) => paymentMethodApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment-methods"] }),
  });
}

export function useDeletePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => paymentMethodApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment-methods"] }),
  });
}

// ── Patient Tag ─────────────────────────────────────────────────────────

export interface PatientTagDto {
  id: string;
  name: string;
  color?: string;
  description?: string;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreatePatientTagDto {
  name: string;
  color?: string;
  description?: string;
}

export interface UpdatePatientTagDto {
  name: string;
  color?: string;
  description?: string;
}

const patientTagApi = {
  list: (params?: { filter?: string; isActive?: boolean; skipCount?: number; maxResultCount?: number }): Promise<PagedResult<PatientTagDto>> =>
    api.get("/v1/app/patient-tags", { params }).then((r) => r.data),
  create: (data: CreatePatientTagDto): Promise<PatientTagDto> =>
    api.post("/v1/app/patient-tags", data).then((r) => r.data),
  update: (id: string, data: UpdatePatientTagDto): Promise<PatientTagDto> =>
    api.put(`/v1/app/patient-tags/${id}`, data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/patient-tags/${id}`).then((r) => r.data),
};

export function usePatientTagList() {
  return useQuery({
    queryKey: ["patient-tags"],
    queryFn: () => patientTagApi.list({ maxResultCount: 200 }),
  });
}

export function useCreatePatientTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePatientTagDto) => patientTagApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patient-tags"] }),
  });
}

export function useUpdatePatientTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePatientTagDto }) => patientTagApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patient-tags"] }),
  });
}

export function useDeletePatientTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => patientTagApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patient-tags"] }),
  });
}
