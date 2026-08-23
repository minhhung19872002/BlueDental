import { api } from "@/lib/axios";
import { adaptPatientListItem } from "./patientAdapters";
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
  list: async (params: PatientListQuery): Promise<PagedResult<PatientListItem>> => {
    // The server contract is GetPatientListInput: the search term is "filter".
    // The status tabs (Đang điều trị / Điều trị hoàn tất / Chưa phát sinh) are a
    // treatment-activity notion the API does not derive yet, so they are applied to
    // the loaded rows instead of being sent — see adaptPatientListItem.
    const query = {
      filter: params.keyword,
      skipCount: params.skipCount,
      maxResultCount: params.maxResultCount,
    };

    const page = await api
      .get<PagedResult<PatientDto>>(BASE, { params: query })
      .then((r) => r.data);

    return {
      totalCount: page.totalCount,
      items: page.items.map(adaptPatientListItem),
    };
  },

  get: (id: string): Promise<PatientDto> =>
    api.get<PatientDto>(`${BASE}/${id}`).then((r) => r.data),

  create: (data: RegisterPatientRequest): Promise<PatientDto> =>
    api.post<PatientDto>(BASE, data).then((r) => r.data),

  update: (id: string, data: UpdatePatientRequest): Promise<PatientDto> =>
    api.put<PatientDto>(`${BASE}/${id}`, data).then((r) => r.data),

  delete: (id: string): Promise<void> =>
    api.delete(`${BASE}/${id}`).then(() => undefined),
};
