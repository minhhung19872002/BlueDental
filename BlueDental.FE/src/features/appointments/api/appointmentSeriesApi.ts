import dayjs from "dayjs";
import { api } from "@/lib/axios";
import type { CreateAppointmentRequest } from "../types/appointment";
import type { AppointmentSeriesView, RecurrenceRequest, SeriesPreviewRequest } from "../types/appointmentSeries";
import { toCreateRequest } from "./appointmentAdapters";
import { adaptSeries, type ServerSeriesDto } from "./appointmentSeriesAdapters";

const BASE = "/v1/app/appointment-series";

export interface CreateSeriesRequest extends CreateAppointmentRequest {
  recurrence: RecurrenceRequest;
}

/** The server lays the dates out from the rule; the client never sends them. */
export const appointmentSeriesApi = {
  preview: (input: SeriesPreviewRequest): Promise<AppointmentSeriesView> =>
    api
      .post<ServerSeriesDto>(`${BASE}/preview`, {
        patientId: input.patientId,
        dentistId: input.doctorId,
        slotStart: dayjs(input.startTime).toISOString(),
        slotEnd: dayjs(input.endTime).toISOString(),
        recurrence: input.recurrence,
      })
      .then((r) => adaptSeries(r.data)),

  create: ({ recurrence, ...booking }: CreateSeriesRequest): Promise<AppointmentSeriesView> =>
    api
      .post<ServerSeriesDto>(BASE, { ...toCreateRequest(booking), recurrence })
      .then((r) => adaptSeries(r.data)),

  byAppointment: (appointmentId: string): Promise<AppointmentSeriesView> =>
    api.get<ServerSeriesDto>(`${BASE}/by-appointment/${appointmentId}`).then((r) => adaptSeries(r.data)),
};
