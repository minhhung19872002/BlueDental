import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

export interface StaffDto {
  id: string;
  userName: string;
  name: string;
  email: string;
  phoneNumber: string;
  isActive: boolean;
  roleNames: string[];
}

export interface GetStaffListInput {
  skipCount?: number;
  maxResultCount?: number;
  keyword?: string;
  isActive?: boolean;
}

export const staffApi = {
  list: (params: GetStaffListInput): Promise<PagedResult<StaffDto>> =>
    api.get<PagedResult<StaffDto>>("/v1/app/staff", { params }).then((r) => r.data),

  get: (id: string): Promise<StaffDto> =>
    api.get<StaffDto>(`/v1/app/staff/${id}`).then((r) => r.data),
};
