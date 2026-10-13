import { api } from "@/lib/axios";
import type {
  Appointment,
  AppointmentListQuery,
  AppointmentStatusCounts,
  CreateAppointmentRequest,
  CreateTempAppointmentRequest,
  PagedResult,
  UpdateAppointmentRequest,
} from "../types/appointment";
import {
  adaptAppointment,
  adaptStatusCounts,
  toCreateRequest,
  toCreateTempRequest,
  toServerQuery,
  toUpdateRequest,
  type ServerAppointmentDto,
  type ServerAppointmentStatsDto,
} from "./appointmentAdapters";
import type { CancellationReason } from "../types/appointment";

const BASE = "/v1/app/appointments";

/**
 * The server speaks its own shape (DentistId / SlotStart / numeric status); the
 * screens work with the view model. Every translation happens here.
 */
export const appointmentApi = {
  list: async (params: AppointmentListQuery): Promise<PagedResult<Appointment>> => {
    const page = await api
      .get<PagedResult<ServerAppointmentDto>>(BASE, { params: toServerQuery(params) })
      .then((r) => r.data);

    return { totalCount: page.totalCount, items: page.items.map(adaptAppointment) };
  },

  /** Counts per status over the same filter as the list, without paging. */
  stats: (params: AppointmentListQuery): Promise<AppointmentStatusCounts> =>
    api
      .get<ServerAppointmentStatsDto>(`${BASE}/stats`, { params: toServerQuery(params) })
      .then((r) => adaptStatusCounts(r.data)),

  get: (id: string): Promise<Appointment> =>
    api.get<ServerAppointmentDto>(`${BASE}/${id}`).then((r) => adaptAppointment(r.data)),

  create: (data: CreateAppointmentRequest): Promise<Appointment> =>
    api
      .post<ServerAppointmentDto>(BASE, toCreateRequest(data))
      .then((r) => adaptAppointment(r.data)),

  createTemp: (data: CreateTempAppointmentRequest): Promise<Appointment> =>
    api
      .post<ServerAppointmentDto>(`${BASE}/temp`, toCreateTempRequest(data))
      .then((r) => adaptAppointment(r.data)),

  update: (id: string, data: UpdateAppointmentRequest): Promise<Appointment> =>
    api
      .put<ServerAppointmentDto>(`${BASE}/${id}`, toUpdateRequest(data))
      .then((r) => adaptAppointment(r.data)),

  cancel: (id: string, reason: CancellationReason, note?: string): Promise<void> =>
    api.post(`${BASE}/${id}/cancel`, { reason, note }).then(() => undefined),

  delete: (id: string): Promise<void> =>
    api.delete(`${BASE}/${id}`).then(() => undefined),

  deleteMany: (ids: string[]): Promise<void> =>
    api.delete(BASE, { data: ids }).then(() => undefined),
};
