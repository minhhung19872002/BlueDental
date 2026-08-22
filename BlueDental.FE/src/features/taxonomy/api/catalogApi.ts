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

// ── Diagnosis ──────────────────────────────────────────────────────────

export interface DiagnosisDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreateDiagnosisDto { code: string; name: string; description?: string; sortOrder?: number; }
export interface UpdateDiagnosisDto { name: string; description?: string; sortOrder?: number; }

const diagnosisApi = {
  list: (params?: { filter?: string; maxResultCount?: number }): Promise<PagedResult<DiagnosisDto>> =>
    api.get("/v1/app/diagnosis", { params }).then((r) => r.data),
  create: (data: CreateDiagnosisDto): Promise<DiagnosisDto> =>
    api.post("/v1/app/diagnosis", data).then((r) => r.data),
  update: (id: string, data: UpdateDiagnosisDto): Promise<DiagnosisDto> =>
    api.put(`/v1/app/diagnosis/${id}`, data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/diagnosis/${id}`).then((r) => r.data),
};

export function useDiagnosisList() {
  return useQuery({ queryKey: ["diagnoses"], queryFn: () => diagnosisApi.list({ maxResultCount: 200 }) });
}
export function useCreateDiagnosis() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: CreateDiagnosisDto) => diagnosisApi.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ["diagnoses"] }) });
}
export function useUpdateDiagnosis() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdateDiagnosisDto }) => diagnosisApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["diagnoses"] }) });
}
export function useDeleteDiagnosis() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => diagnosisApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["diagnoses"] }) });
}

// ── Medication Type ────────────────────────────────────────────────────

export interface MedicationTypeDto {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreateMedicationTypeDto { name: string; description?: string; sortOrder?: number; }
export interface UpdateMedicationTypeDto { name: string; description?: string; sortOrder?: number; }

const medicationTypeApi = {
  list: (params?: { filter?: string; maxResultCount?: number }): Promise<PagedResult<MedicationTypeDto>> =>
    api.get("/v1/app/medication-types", { params }).then((r) => r.data),
  create: (data: CreateMedicationTypeDto): Promise<MedicationTypeDto> =>
    api.post("/v1/app/medication-types", data).then((r) => r.data),
  update: (id: string, data: UpdateMedicationTypeDto): Promise<MedicationTypeDto> =>
    api.put(`/v1/app/medication-types/${id}`, data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/medication-types/${id}`).then((r) => r.data),
};

export function useMedicationTypeList() {
  return useQuery({ queryKey: ["medication-types"], queryFn: () => medicationTypeApi.list({ maxResultCount: 200 }) });
}
export function useCreateMedicationType() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: CreateMedicationTypeDto) => medicationTypeApi.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ["medication-types"] }) });
}
export function useUpdateMedicationType() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdateMedicationTypeDto }) => medicationTypeApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["medication-types"] }) });
}
export function useDeleteMedicationType() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => medicationTypeApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["medication-types"] }) });
}

// ── Consulting Data ────────────────────────────────────────────────────

export interface ConsultingDataDto {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreateConsultingDataDto { name: string; description?: string; sortOrder?: number; }
export interface UpdateConsultingDataDto { name: string; description?: string; sortOrder?: number; }

const consultingDataApi = {
  list: (params?: { filter?: string; maxResultCount?: number }): Promise<PagedResult<ConsultingDataDto>> =>
    api.get("/v1/app/consulting-data", { params }).then((r) => r.data),
  create: (data: CreateConsultingDataDto): Promise<ConsultingDataDto> =>
    api.post("/v1/app/consulting-data", data).then((r) => r.data),
  update: (id: string, data: UpdateConsultingDataDto): Promise<ConsultingDataDto> =>
    api.put(`/v1/app/consulting-data/${id}`, data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/consulting-data/${id}`).then((r) => r.data),
};

export function useConsultingDataList() {
  return useQuery({ queryKey: ["consulting-data"], queryFn: () => consultingDataApi.list({ maxResultCount: 200 }) });
}
export function useCreateConsultingData() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: CreateConsultingDataDto) => consultingDataApi.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ["consulting-data"] }) });
}
export function useUpdateConsultingData() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdateConsultingDataDto }) => consultingDataApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["consulting-data"] }) });
}
export function useDeleteConsultingData() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => consultingDataApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["consulting-data"] }) });
}

// ── Medical History Type ───────────────────────────────────────────────

export interface MedicalHistoryTypeDto {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreateMedicalHistoryTypeDto { name: string; description?: string; sortOrder?: number; }
export interface UpdateMedicalHistoryTypeDto { name: string; description?: string; sortOrder?: number; }

const medicalHistoryTypeApi = {
  list: (params?: { filter?: string; maxResultCount?: number }): Promise<PagedResult<MedicalHistoryTypeDto>> =>
    api.get("/v1/app/medical-history-types", { params }).then((r) => r.data),
  create: (data: CreateMedicalHistoryTypeDto): Promise<MedicalHistoryTypeDto> =>
    api.post("/v1/app/medical-history-types", data).then((r) => r.data),
  update: (id: string, data: UpdateMedicalHistoryTypeDto): Promise<MedicalHistoryTypeDto> =>
    api.put(`/v1/app/medical-history-types/${id}`, data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/medical-history-types/${id}`).then((r) => r.data),
};

export function useMedicalHistoryTypeList() {
  return useQuery({ queryKey: ["medical-history-types"], queryFn: () => medicalHistoryTypeApi.list({ maxResultCount: 200 }) });
}
export function useCreateMedicalHistoryType() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: CreateMedicalHistoryTypeDto) => medicalHistoryTypeApi.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ["medical-history-types"] }) });
}
export function useUpdateMedicalHistoryType() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdateMedicalHistoryTypeDto }) => medicalHistoryTypeApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["medical-history-types"] }) });
}
export function useDeleteMedicalHistoryType() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => medicalHistoryTypeApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["medical-history-types"] }) });
}

// ── Prescription Template ──────────────────────────────────────────────

export interface PrescriptionTemplateDto {
  id: string;
  name: string;
  content?: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreatePrescriptionTemplateDto { name: string; content?: string; description?: string; sortOrder?: number; }
export interface UpdatePrescriptionTemplateDto { name: string; content?: string; description?: string; sortOrder?: number; }

const prescriptionTemplateApi = {
  list: (params?: { filter?: string; maxResultCount?: number }): Promise<PagedResult<PrescriptionTemplateDto>> =>
    api.get("/v1/app/prescription-templates", { params }).then((r) => r.data),
  create: (data: CreatePrescriptionTemplateDto): Promise<PrescriptionTemplateDto> =>
    api.post("/v1/app/prescription-templates", data).then((r) => r.data),
  update: (id: string, data: UpdatePrescriptionTemplateDto): Promise<PrescriptionTemplateDto> =>
    api.put(`/v1/app/prescription-templates/${id}`, data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/prescription-templates/${id}`).then((r) => r.data),
};

export function usePrescriptionTemplateList() {
  return useQuery({ queryKey: ["prescription-templates"], queryFn: () => prescriptionTemplateApi.list({ maxResultCount: 200 }) });
}
export function useCreatePrescriptionTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: CreatePrescriptionTemplateDto) => prescriptionTemplateApi.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ["prescription-templates"] }) });
}
export function useUpdatePrescriptionTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdatePrescriptionTemplateDto }) => prescriptionTemplateApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["prescription-templates"] }) });
}
export function useDeletePrescriptionTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => prescriptionTemplateApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["prescription-templates"] }) });
}

// ── Medical Record Template ────────────────────────────────────────────

export interface MedicalRecordTemplateDto {
  id: string;
  name: string;
  content?: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string;
}

export interface CreateMedicalRecordTemplateDto { name: string; content?: string; description?: string; sortOrder?: number; }
export interface UpdateMedicalRecordTemplateDto { name: string; content?: string; description?: string; sortOrder?: number; }

const medicalRecordTemplateApi = {
  list: (params?: { filter?: string; maxResultCount?: number }): Promise<PagedResult<MedicalRecordTemplateDto>> =>
    api.get("/v1/app/medical-record-templates", { params }).then((r) => r.data),
  create: (data: CreateMedicalRecordTemplateDto): Promise<MedicalRecordTemplateDto> =>
    api.post("/v1/app/medical-record-templates", data).then((r) => r.data),
  update: (id: string, data: UpdateMedicalRecordTemplateDto): Promise<MedicalRecordTemplateDto> =>
    api.put(`/v1/app/medical-record-templates/${id}`, data).then((r) => r.data),
  delete: (id: string): Promise<void> =>
    api.delete(`/v1/app/medical-record-templates/${id}`).then((r) => r.data),
};

export function useMedicalRecordTemplateList() {
  return useQuery({ queryKey: ["medical-record-templates"], queryFn: () => medicalRecordTemplateApi.list({ maxResultCount: 200 }) });
}
export function useCreateMedicalRecordTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: CreateMedicalRecordTemplateDto) => medicalRecordTemplateApi.create(data), onSuccess: () => qc.invalidateQueries({ queryKey: ["medical-record-templates"] }) });
}
export function useUpdateMedicalRecordTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: UpdateMedicalRecordTemplateDto }) => medicalRecordTemplateApi.update(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ["medical-record-templates"] }) });
}
export function useDeleteMedicalRecordTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => medicalRecordTemplateApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["medical-record-templates"] }) });
}
