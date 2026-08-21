import { api } from "@/lib/axios";
import type {
  PagedResult,
  PatientDto,
  PatientListItem,
  PatientListQuery,
  RegisterPatientRequest,
  UpdatePatientRequest,
} from "../types/patient";

const BASE = "/v1/app/patients";

export const patientApi = {
  list: (params: PatientListQuery): Promise<PagedResult<PatientListItem>> =>
    api.get<PagedResult<PatientListItem>>(BASE, { params }).then((r) => r.data),

  get: (id: string): Promise<PatientDto> =>
    api.get<PatientDto>(`${BASE}/${id}`).then((r) => r.data),

  create: (data: RegisterPatientRequest): Promise<PatientDto> =>
    api.post<PatientDto>(BASE, data).then((r) => r.data),

  update: (id: string, data: UpdatePatientRequest): Promise<PatientDto> =>
    api.put<PatientDto>(`${BASE}/${id}`, data).then((r) => r.data),

  delete: (id: string): Promise<void> =>
    api.delete(`${BASE}/${id}`).then(() => undefined),
};
