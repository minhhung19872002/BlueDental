import { useQuery } from "@tanstack/react-query";
import { appointmentApi } from "./appointmentApi";
import { adaptAppointment } from "./appointmentAdapters";
import type { AppointmentListQuery } from "../types/appointment";

export const appointmentKeys = {
  all: ["appointments"] as const,
  lists: () => [...appointmentKeys.all, "list"] as const,
  list: (params: AppointmentListQuery) =>
    [...appointmentKeys.lists(), params] as const,
  details: () => [...appointmentKeys.all, "detail"] as const,
  detail: (id: string) => [...appointmentKeys.details(), id] as const,
};

export function useAppointmentList(params: AppointmentListQuery) {
  return useQuery({
    queryKey: appointmentKeys.list(params),
    queryFn: () => appointmentApi.list(params),
  });
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: appointmentKeys.detail(id),
    queryFn: async () => {
      const dto = await appointmentApi.get(id);
      return adaptAppointment(dto);
    },
    enabled: Boolean(id),
  });
}
