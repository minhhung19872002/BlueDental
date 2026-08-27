import { api } from "@/lib/axios";
import { downloadFile } from "@/lib/download";
import type {
  PagedResult,
  PatientCodeEstimate,
  PatientDto,
  PatientListItem,
  PatientListQuery,
  PhoneAvailability,
  RegisterPatientRequest,
  UpdatePatientRequest,
} from "../types/patient";

const BASE = "/v1/app/patients";

export const patientApi = {
  list: (params: PatientListQuery): Promise<PagedResult<PatientListItem>> =>
    api.get<PagedResult<PatientListItem>>(BASE, { params }).then((r) => r.data),

  get: (id: string): Promise<PatientDto> =>
    api.get<PatientDto>(`${BASE}/${id}`).then((r) => r.data),

  /** The code the "Tạo hồ sơ" dialog opens with. */
  codeEstimate: (): Promise<PatientCodeEstimate> =>
    api.get<PatientCodeEstimate>(`${BASE}/code-estimate`).then((r) => r.data),

  /** Duplicate check behind the dialog's Điện thoại field. */
  checkPhone: (phone: string, excludeId?: string): Promise<PhoneAvailability> =>
    api
      .get<PhoneAvailability>(`${BASE}/check-phone`, { params: { phone, excludeId } })
      .then((r) => r.data),

  create: (data: RegisterPatientRequest): Promise<PatientDto> =>
    api.post<PatientDto>(BASE, data).then((r) => r.data),

  update: (id: string, data: UpdatePatientRequest): Promise<PatientDto> =>
    api.put<PatientDto>(`${BASE}/${id}`, data).then((r) => r.data),

  delete: (id: string): Promise<void> =>
    api.post(`${BASE}/${id}/deactivate`).then(() => undefined),

  /**
   * "Xuất file". The workbook is built server side so the export carries every
   * matching row, not just the page the table happens to be showing.
   */
  exportExcel: (params: PatientListQuery): Promise<void> =>
    downloadFile(`${BASE}/excel`, "danh-sach-benh-nhan.xlsx", { ...params }),
};
