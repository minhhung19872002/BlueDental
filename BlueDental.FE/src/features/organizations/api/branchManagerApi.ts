import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

export interface BranchManagerDto {
  id: string;
  userName: string;
  name: string | null;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  roleNames: string[];
  branchIds: string[];

  address: string | null;
  provinceId: string | null;
  wardId: string | null;

  avatarUrl: string | null;
}

export interface GetBranchManagerListInput {
  skipCount?: number;
  maxResultCount?: number;
  filter?: string;
  sorting?: string;
  branchId?: string;
}

export interface CreateBranchManagerInput {
  password: string;
  name: string;
  email: string;
  phoneNumber: string;
  branchIds: string[];
  address?: string;
  provinceId?: string;
  wardId?: string;
}

export interface UpdateBranchManagerInput {
  name: string;
  email: string;
  phoneNumber: string;
  branchIds: string[];
  address?: string;
  provinceId?: string;
  wardId?: string;
}

const BASE = "/v1/app/branch-managers";

export const branchManagerApi = {
  list: (params: GetBranchManagerListInput): Promise<PagedResult<BranchManagerDto>> =>
    api.get<PagedResult<BranchManagerDto>>(BASE, { params }).then((r) => r.data),

  get: (id: string): Promise<BranchManagerDto> =>
    api.get<BranchManagerDto>(`${BASE}/${id}`).then((r) => r.data),

  create: (input: CreateBranchManagerInput): Promise<BranchManagerDto> =>
    api.post<BranchManagerDto>(BASE, input).then((r) => r.data),

  update: (id: string, input: UpdateBranchManagerInput): Promise<BranchManagerDto> =>
    api.put<BranchManagerDto>(`${BASE}/${id}`, input).then((r) => r.data),

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
