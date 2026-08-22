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
  filter?: string;
  isActive?: boolean;
  sorting?: string;
}

export interface CreateStaffInput {
  userName: string;
  name: string;
  email: string;
  phoneNumber?: string;
  password: string;
  roleNames?: string[];
}

export interface UpdateStaffInput {
  name: string;
  email: string;
  phoneNumber?: string;
  roleNames?: string[];
  isActive?: boolean;
}

interface IdentityUserDto {
  id: string;
  userName: string;
  name: string;
  email: string;
  phoneNumber: string;
  isActive: boolean;
  roleNames: string[];
  [key: string]: unknown;
}

function mapToStaffDto(u: IdentityUserDto): StaffDto {
  return {
    id: u.id,
    userName: u.userName,
    name: u.name || u.userName,
    email: u.email || "",
    phoneNumber: u.phoneNumber || "",
    isActive: u.isActive,
    roleNames: u.roleNames ?? [],
  };
}

export const staffApi = {
  list: async (params: GetStaffListInput): Promise<PagedResult<StaffDto>> => {
    const res = await api.get<PagedResult<StaffDto>>("/v1/app/staff", {
      params: {
        filter: params.filter,
        skipCount: params.skipCount,
        maxResultCount: params.maxResultCount ?? 50,
        sorting: params.sorting,
      },
    });
    const items = (res.data.items ?? []).map((u) => ({
      ...u,
      name: u.name || (u as unknown as { surname?: string; firstName?: string }).surname || u.userName,
    }));
    const filtered =
      params.isActive !== undefined ? items.filter((u) => u.isActive === params.isActive) : items;
    return { items: filtered, totalCount: filtered.length };
  },

  get: async (id: string): Promise<StaffDto> => {
    const res = await api.get<StaffDto>(`/v1/app/staff/${id}`);
    return res.data;
  },

  create: async (input: CreateStaffInput): Promise<StaffDto> => {
    const res = await api.post<IdentityUserDto>("/identity/users", {
      userName: input.userName,
      name: input.name,
      email: input.email,
      phoneNumber: input.phoneNumber,
      password: input.password,
      roleNames: input.roleNames ?? [],
      isActive: true,
    });
    return mapToStaffDto(res.data);
  },

  update: async (id: string, input: UpdateStaffInput): Promise<StaffDto> => {
    const current = await api.get<IdentityUserDto>(`/identity/users/${id}`);
    const res = await api.put<IdentityUserDto>(`/identity/users/${id}`, {
      ...current.data,
      name: input.name,
      email: input.email,
      phoneNumber: input.phoneNumber,
      roleNames: input.roleNames ?? current.data.roleNames,
      isActive: input.isActive ?? current.data.isActive,
    });
    return mapToStaffDto(res.data);
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/identity/users/${id}`);
  },
};
