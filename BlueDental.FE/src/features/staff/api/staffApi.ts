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
  branchIds: string[];

  address: string | null;
  provinceId: string | null;
  wardId: string | null;

  isDentist: boolean;
  isAssistant: boolean;
  isHygienist: boolean;

  morningStartTime: string | null;
  morningEndTime: string | null;
  afternoonStartTime: string | null;
  afternoonEndTime: string | null;

  avatarUrl: string | null;
}

export interface GetStaffListInput {
  skipCount?: number;
  maxResultCount?: number;
  filter?: string;
  isActive?: boolean;
  sorting?: string;
  branchId?: string;
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

  address?: string;
  provinceId?: string;
  wardId?: string;

  isDentist?: boolean;
  isAssistant?: boolean;
  isHygienist?: boolean;

  morningStartTime?: string;
  morningEndTime?: string;
  afternoonStartTime?: string;
  afternoonEndTime?: string;
}

export interface UpdateStaffInput {
  name?: string;
  surname?: string;
  email: string;
  phoneNumber?: string;
  isActive: boolean;
  roleNames: string[];
  branchIds: string[];

  address?: string;
  provinceId?: string;
  wardId?: string;

  isDentist?: boolean;
  isAssistant?: boolean;
  isHygienist?: boolean;

  morningStartTime?: string;
  morningEndTime?: string;
  afternoonStartTime?: string;
  afternoonEndTime?: string;
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

  uploadAvatar: (id: string, file: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<{ url: string }>(`${BASE}/${id}/avatar`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  deleteAvatar: (id: string): Promise<void> =>
    api.delete(`${BASE}/${id}/avatar`).then(() => undefined),
};
