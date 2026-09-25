import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useCurrentBranchId } from "@/lib/clinicBranch";

export interface ClinicInfoDto {
  id: string;
  code: string;
  name: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
  status: string;
}

export interface UpdateClinicInfoDto {
  name: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
}

const settingsApi = {
  getClinicInfo: (branchId: string): Promise<ClinicInfoDto> =>
    api.get(`/v1/app/clinic-branches/${branchId}`).then((r) => r.data),

  updateClinicInfo: (branchId: string, data: UpdateClinicInfoDto): Promise<ClinicInfoDto> =>
    api.put(`/v1/app/clinic-branches/${branchId}`, data).then((r) => r.data),
};

export function useClinicInfo() {
  const branchId = useCurrentBranchId();
  return useQuery({
    queryKey: ["clinic-info", branchId],
    queryFn: () => settingsApi.getClinicInfo(branchId),
    enabled: Boolean(branchId),
    staleTime: 5 * 60_000,
  });
}

export function useUpdateClinicInfo() {
  const branchId = useCurrentBranchId();
  return useMutation({
    mutationFn: (data: UpdateClinicInfoDto) => settingsApi.updateClinicInfo(branchId, data),
    // Clinic info, the branch lists and the printed letterheads.
    meta: { invalidates: ["branch"] },
  });
}
