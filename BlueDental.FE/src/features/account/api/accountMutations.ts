import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/axios";

export interface UpdateProfileInput {
  name: string;
  email: string;
}

interface AbpProfileDto {
  id: string;
  userName: string;
  name: string;
  email: string;
  [key: string]: unknown;
}

async function updateMyProfile(input: UpdateProfileInput): Promise<AbpProfileDto> {
  const current = await api.get<AbpProfileDto>("/identity/my-profile");
  const res = await api.put<AbpProfileDto>("/identity/my-profile", {
    ...current.data,
    name: input.name,
    email: input.email,
  });
  return res.data;
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: updateMyProfile,
  });
}
