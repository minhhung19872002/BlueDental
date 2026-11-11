import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";

/** Matches XrayDeviceDto: a PC by the X-ray machine paired with a branch (F-95). */
export interface XrayDeviceDto {
  id: string;
  clinicBranchId: string;
  name: string;
  creationTime: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
  isActive: boolean;
}

/** Matches PairedXrayDeviceDto: the token comes back this once, to paste into the agent. */
export interface PairedXrayDeviceDto extends XrayDeviceDto {
  token: string;
}

const BASE = "/v1/app/xray-devices";

/** Shared with the Hình ảnh tab's "Mở EzDent-i", which reads `[...all, "has-active", id]`. */
export const xrayDeviceKeys = {
  all: ["xray-devices"] as const,
  list: (clinicBranchId: string) => [...xrayDeviceKeys.all, "list", clinicBranchId] as const,
};

const xrayDeviceHttp = {
  list: (clinicBranchId: string) =>
    api.get<XrayDeviceDto[]>(BASE, { params: { clinicBranchId } }).then((r) => r.data),
  create: (input: { clinicBranchId: string; name: string }) =>
    api.post<PairedXrayDeviceDto>(BASE, input).then((r) => r.data),
  revoke: (id: string) => api.post(`${BASE}/${id}/revoke`).then(() => undefined),
};

/** Cài đặt → Máy X-quang: the branch's paired PCs, active ones first. */
export function useXrayDevices(clinicBranchId: string) {
  return useQuery({
    queryKey: xrayDeviceKeys.list(clinicBranchId),
    queryFn: () => xrayDeviceHttp.list(clinicBranchId),
    enabled: Boolean(clinicBranchId),
  });
}

function useXrayDeviceMutation<TInput, TData>(run: (input: TInput) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: xrayDeviceKeys.all }),
  });
}

/** "Thêm máy": the token is shown once. */
export const usePairXrayDevice = () => useXrayDeviceMutation(xrayDeviceHttp.create);
/** "Thu hồi": the agent is refused from its next call on. */
export const useRevokeXrayDevice = () => useXrayDeviceMutation(xrayDeviceHttp.revoke);

/** What the agent's "Địa chỉ máy chủ" field takes: this site, which proxies /api. */
export function xrayServerUrl(): string {
  return window.location.origin;
}
