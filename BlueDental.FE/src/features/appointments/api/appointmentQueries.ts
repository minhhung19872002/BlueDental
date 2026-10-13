import { useQuery } from "@tanstack/react-query";
import { appointmentApi } from "./appointmentApi";
import type { AppointmentListQuery } from "../types/appointment";

export const appointmentKeys = {
  all: ["appointments"] as const,
  lists: () => [...appointmentKeys.all, "list"] as const,
  list: (params: AppointmentListQuery) =>
    [...appointmentKeys.lists(), params] as const,
  stats: (params: AppointmentListQuery) =>
    [...appointmentKeys.all, "stats", params] as const,
  details: () => [...appointmentKeys.all, "detail"] as const,
  detail: (id: string) => [...appointmentKeys.details(), id] as const,
};

export function useAppointmentList(params: AppointmentListQuery) {
  return useQuery({
    queryKey: appointmentKeys.list(params),
    queryFn: () => appointmentApi.list(params),
  });
}

export function useAppointmentStats(params: AppointmentListQuery) {
  return useQuery({
    queryKey: appointmentKeys.stats(params),
    queryFn: () => appointmentApi.stats(params),
  });
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: appointmentKeys.detail(id),
    queryFn: () => appointmentApi.get(id),
    enabled: Boolean(id),
  });
}
