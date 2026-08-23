import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

export type CareStatus = "Pending" | "InProgress" | "Completed" | "Cancelled";
export type CareType = "AfterTreatment" | "Birthday" | "AppointmentReminder" | "Periodic" | "Special";

export interface CareRecordDto {
  id: string;
  patientId: string;
  patientName?: string;
  assignedStaffId?: string;
  type: CareType;
  status: CareStatus;
  subject: string;
  description?: string;
  resolution?: string;
  dueAt?: string;
  completedAt?: string;
  creationTime: string;
}

export interface GetCareRecordListInput {
  skipCount?: number;
  maxResultCount?: number;
  patientId?: string;
  status?: CareStatus;
  type?: CareType;
  filter?: string;
}

const careApi = {
  list: (params: GetCareRecordListInput): Promise<PagedResult<CareRecordDto>> =>
    api.get("/v1/app/care-records", { params }).then((r) => r.data),
};

export function useCareRecordList(params: GetCareRecordListInput = {}) {
  return useQuery({
    queryKey: ["care-records", params],
    queryFn: () => careApi.list(params),
  });
}
