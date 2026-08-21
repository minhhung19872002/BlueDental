import { useQuery } from "@tanstack/react-query";
import { receptionApi, MOCK_DOCTORS } from "./receptionApi";
import type { ReceptionFilter } from "../types/reception";

export function useReceptionList(filter: ReceptionFilter = {}) {
  return useQuery({
    queryKey: ["receptions", filter],
    queryFn: () => receptionApi.getList(filter),
  });
}

export function useReceptionMetrics() {
  return useQuery({
    queryKey: ["receptionMetrics"],
    queryFn: () => receptionApi.getMetrics(),
  });
}

export function useReceptionDoctors() {
  return useQuery({
    queryKey: ["receptionDoctors"],
    queryFn: async () => MOCK_DOCTORS,
  });
}
