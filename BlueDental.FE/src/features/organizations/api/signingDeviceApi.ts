import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";

/** Matches SigningDeviceDto: an iPad paired with a branch (P2610). */
export interface SigningDeviceDto {
  id: string;
  clinicBranchId: string;
  name: string;
  creationTime: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
  isActive: boolean;
}

/** Matches PairedSigningDeviceDto: the token comes back this once, to build the link. */
export interface PairedSigningDeviceDto extends SigningDeviceDto {
  token: string;
}

const BASE = "/v1/app/signing-devices";

export const signingDeviceKeys = {
  all: ["signing-devices"] as const,
  list: (clinicBranchId: string) => [...signingDeviceKeys.all, clinicBranchId] as const,
};

const signingDeviceHttp = {
  list: (clinicBranchId: string) =>
    api.get<SigningDeviceDto[]>(BASE, { params: { clinicBranchId } }).then((r) => r.data),
  create: (input: { clinicBranchId: string; name: string }) =>
    api.post<PairedSigningDeviceDto>(BASE, input).then((r) => r.data),
  revoke: (id: string) => api.post(`${BASE}/${id}/revoke`).then(() => undefined),
};

/** Cài đặt → Kết nối iPad: the branch's iPads, active ones first. */
export function useSigningDevices(clinicBranchId: string) {
  return useQuery({
    queryKey: signingDeviceKeys.list(clinicBranchId),
    queryFn: () => signingDeviceHttp.list(clinicBranchId),
    enabled: Boolean(clinicBranchId),
  });
}

function useSigningDeviceMutation<TInput, TData>(run: (input: TInput) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    // The cashier's "Gửi tới iPad" reads whether the branch has a device.
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: signingDeviceKeys.all }),
  });
}

/** "Tạo đường dẫn kết nối". */
export const usePairSigningDevice = () => useSigningDeviceMutation(signingDeviceHttp.create);
/** "Thu hồi": the iPad is refused from its next request on. */
export const useRevokeSigningDevice = () => useSigningDeviceMutation(signingDeviceHttp.revoke);

/**
 * The link to open once on the iPad. The token sits after `#`, which the
 * browser never sends, so it stays out of the web server's access log.
 */
export function pairingLinkOf(token: string): string {
  return `${window.location.origin}/sign/pair#${token}`;
}
