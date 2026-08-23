import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

export interface StaffDto {
  id: string;
  userName: string;
  name: string | null;
  surname: string | null;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  isActive: boolean;
  roleNames: string[];
  /** Empty means the staff member is clinic-wide, not limited to a branch. */
  branchIds: string[];
}

export interface GetStaffListInput {
  skipCount?: number;
  maxResultCount?: number;
  filter?: string;
  isActive?: boolean;
  sorting?: string;
}

export interface CreateStaffInput {
  userName: string;
  password: string;
  name?: string;
  surname?: string;
  email: string;
  phoneNumber?: string;
  roleNames: string[];
  branchIds: string[];
}

export interface UpdateStaffInput {
  name?: string;
  surname?: string;
  email: string;
  phoneNumber?: string;
  isActive: boolean;
  roleNames: string[];
  branchIds: string[];
}

const BASE = "/v1/app/staff";

export const staffApi = {
  list: (params: GetStaffListInput): Promise<PagedResult<StaffDto>> =>
    api.get<PagedResult<StaffDto>>(BASE, { params }).then((r) => r.data),

  get: (id: string): Promise<StaffDto> =>
    api.get<StaffDto>(`${BASE}/${id}`).then((r) => r.data),

  roleNames: (): Promise<string[]> =>
    api.get<string[]>(`${BASE}/roles`).then((r) => r.data),

  create: (input: CreateStaffInput): Promise<StaffDto> =>
    api.post<StaffDto>(BASE, input).then((r) => r.data),

  update: (id: string, input: UpdateStaffInput): Promise<StaffDto> =>
    api.put<StaffDto>(`${BASE}/${id}`, input).then((r) => r.data),

  remove: (id: string): Promise<void> => api.delete(`${BASE}/${id}`).then(() => undefined),
};
