import { api } from "@/lib/axios";
import type {
  AppointmentDto,
  AppointmentListQuery,
  CreateAppointmentRequest,
  PagedResult,
  UpdateAppointmentRequest,
} from "../types/appointment";

const BASE = "/v1/app/appointments";

export const appointmentApi = {
  list: (
    params: AppointmentListQuery,
  ): Promise<PagedResult<AppointmentDto>> =>
    api
      .get<PagedResult<AppointmentDto>>(BASE, { params })
      .then((r) => r.data),

  get: (id: string): Promise<AppointmentDto> =>
    api.get<AppointmentDto>(`${BASE}/${id}`).then((r) => r.data),

  create: (data: CreateAppointmentRequest): Promise<AppointmentDto> =>
    api.post<AppointmentDto>(BASE, data).then((r) => r.data),

  update: (
    id: string,
    data: UpdateAppointmentRequest,
  ): Promise<AppointmentDto> =>
    api.put<AppointmentDto>(`${BASE}/${id}`, data).then((r) => r.data),

  cancel: (id: string): Promise<void> =>
    api.post(`${BASE}/${id}/cancel`).then(() => undefined),
};
