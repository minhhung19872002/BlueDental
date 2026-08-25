import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";

export interface AbpProfileDto {
  userName: string;
  name: string;
  surName: string;
  email: string;
  phoneNumber: string | null;
  [key: string]: unknown;
}

export interface UpdateProfileInput {
  name: string;
  email: string;
  phoneNumber?: string;
}

export function useMyProfile() {
  return useQuery({
    queryKey: ["my-profile"],
    queryFn: () => api.get<AbpProfileDto>("/account/my-profile").then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

async function updateMyProfile(input: UpdateProfileInput): Promise<AbpProfileDto> {
  const current = await api.get<AbpProfileDto>("/account/my-profile");
  const res = await api.put<AbpProfileDto>("/account/my-profile", {
    ...current.data,
    name: input.name,
    email: input.email,
    phoneNumber: input.phoneNumber ?? current.data.phoneNumber,
  });
  return res.data;
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateMyProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-profile"] }),
  });
}

const STAFF_BASE = "/v1/app/staff";

export async function uploadProfileAvatar(userId: string, file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await api.post<{ url: string }>(`${STAFF_BASE}/${userId}/avatar`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function deleteProfileAvatar(userId: string): Promise<void> {
  await api.delete(`${STAFF_BASE}/${userId}/avatar`);
}
