import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import type { SeriesPreviewRequest } from "../types/appointmentSeries";
import { appointmentKeys } from "./appointmentQueries";
import { appointmentSeriesApi, type CreateSeriesRequest } from "./appointmentSeriesApi";

/** Under "appointments", so every appointment write refreshes the list too. */
const seriesKeys = {
  preview: (input: SeriesPreviewRequest) => [...appointmentKeys.all, "series", "preview", input] as const,
  byAppointment: (id: string) => [...appointmentKeys.all, "series", "by-appointment", id] as const,
};

const EMPTY_PREVIEW: SeriesPreviewRequest = {
  patientId: "",
  doctorId: "",
  startTime: "",
  endTime: "",
  recurrence: { frequency: 1, interval: 1, weekDays: [], end: 1, count: 1, until: null },
};

/**
 * "Danh sách buổi hẹn" while creating. Null input = not enough picked yet.
 * A refused rule (e.g. Đến ngày before Ngày hẹn) shows on the list itself,
 * so it is not toasted on top.
 */
export function useSeriesPreview(input: SeriesPreviewRequest | null) {
  return useQuery({
    queryKey: seriesKeys.preview(input ?? EMPTY_PREVIEW),
    queryFn: () => appointmentSeriesApi.preview(input ?? EMPTY_PREVIEW),
    enabled: input !== null,
    // Who is busy changes under the dialog; the list is read fresh each time.
    staleTime: 0,
    retry: false,
    placeholderData: keepPreviousData,
    meta: { skipGlobalErrorToast: true },
  });
}

/** The series an edited booking belongs to; only asked for when it has one. */
export function useAppointmentSeries(appointmentId: string, inSeries: boolean) {
  return useQuery({
    queryKey: seriesKeys.byAppointment(appointmentId),
    queryFn: () => appointmentSeriesApi.byAppointment(appointmentId),
    enabled: Boolean(appointmentId) && inSeries,
    staleTime: 0,
  });
}

export function useCreateAppointmentSeries() {
  return useMutation({
    mutationKey: ["appointments", "createSeries"],
    mutationFn: (data: CreateSeriesRequest) => appointmentSeriesApi.create(data),
    meta: { invalidates: ["appointment"] } as const,
  });
}
