import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

export type LaboStatus = "New" | "InProgress" | "Completed" | "Rejected" | "Warranty";

export interface LaboOrderDto {
  id: string;
  orderCode: string;
  patientId: string;
  patientName?: string;
  dentistId?: string;
  labProviderName: string;
  status: LaboStatus;
  toothNumbers?: string;
  workDescription?: string;
  notes?: string;
  dueDate?: string;
  sentAt?: string;
  receivedAt?: string;
  estimatedCost: number;
  rejectionReason?: string;
  creationTime: string;
}

const laboApi = {
  list: (params: {
    patientId?: string;
    skipCount?: number;
    maxResultCount?: number;
  }): Promise<PagedResult<LaboOrderDto>> =>
    api.get("/v1/app/labo-orders", { params }).then((r) => r.data),
};

export function usePatientLaboOrders(patientId: string) {
  return useQuery({
    queryKey: ["labo-orders", { patientId }],
    queryFn: () => laboApi.list({ patientId, maxResultCount: 50 }),
    enabled: Boolean(patientId),
    select: (d) => d.items,
  });
}

export function useLaboOrderList(params: { patientId?: string; skipCount?: number; maxResultCount?: number } = {}) {
  return useQuery({
    queryKey: ["labo-orders", params],
    queryFn: () => laboApi.list(params),
  });
}
