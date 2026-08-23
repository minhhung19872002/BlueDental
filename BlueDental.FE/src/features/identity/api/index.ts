import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

// ── DTOs ──────────────────────────────────────────────────────────────────

export interface IdentityUserDto {
  id: string;
  userName: string;
  name: string;
  email: string;
  phoneNumber?: string;
  isActive: boolean;
  roleNames: string[];
  creationTime: string;
}

export interface IdentityRoleDto {
  id: string;
  name: string;
  isDefault: boolean;
  isStatic: boolean;
  isPublic: boolean;
}

export interface CreateIdentityUserDto {
  userName: string;
  name: string;
  email: string;
  phoneNumber?: string;
  password: string;
  roleNames?: string[];
  isActive?: boolean;
}

export interface UpdateIdentityUserDto {
  userName: string;
  name: string;
  email: string;
  phoneNumber?: string;
  roleNames?: string[];
  isActive?: boolean;
}

export interface CreateIdentityRoleDto {
  name: string;
  isDefault?: boolean;
  isPublic?: boolean;
}

// ── API ───────────────────────────────────────────────────────────────────

const identityApi = {
  users: {
    list: (params?: { filter?: string; skipCount?: number; maxResultCount?: number }): Promise<PagedResult<IdentityUserDto>> =>
      api.get("/identity/users", { params }).then((r) => r.data),
    get: (id: string): Promise<IdentityUserDto> =>
      api.get(`/identity/users/${id}`).then((r) => r.data),
    create: (data: CreateIdentityUserDto): Promise<IdentityUserDto> =>
      api.post("/identity/users", data).then((r) => r.data),
    update: (id: string, data: UpdateIdentityUserDto): Promise<IdentityUserDto> =>
      api.put(`/identity/users/${id}`, data).then((r) => r.data),
    delete: (id: string): Promise<void> =>
      api.delete(`/identity/users/${id}`).then((r) => r.data),
  },
  roles: {
    list: (params?: { filter?: string; skipCount?: number; maxResultCount?: number }): Promise<PagedResult<IdentityRoleDto>> =>
      api.get("/identity/roles", { params }).then((r) => r.data),
    create: (data: CreateIdentityRoleDto): Promise<IdentityRoleDto> =>
      api.post("/identity/roles", data).then((r) => r.data),
    delete: (id: string): Promise<void> =>
      api.delete(`/identity/roles/${id}`).then((r) => r.data),
  },
};

// ── Hooks — Users ──────────────────────────────────────────────────────────

export function useIdentityUserList(params?: { filter?: string }) {
  return useQuery({
    queryKey: ["identity-users", params],
    queryFn: () => identityApi.users.list({ ...params, maxResultCount: 100 }),
  });
}

export function useCreateIdentityUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateIdentityUserDto) => identityApi.users.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["identity-users"] }),
  });
}

export function useUpdateIdentityUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateIdentityUserDto }) =>
      identityApi.users.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["identity-users"] }),
  });
}

export function useDeleteIdentityUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => identityApi.users.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["identity-users"] }),
  });
}

// ── Hooks — Roles ──────────────────────────────────────────────────────────

export function useIdentityRoleList() {
  return useQuery({
    queryKey: ["identity-roles"],
    queryFn: () => identityApi.roles.list({ maxResultCount: 100 }),
  });
}

export function useCreateIdentityRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateIdentityRoleDto) => identityApi.roles.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["identity-roles"] }),
  });
}

export function useDeleteIdentityRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => identityApi.roles.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["identity-roles"] }),
  });
}
