import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";

/**
 * Whether the branch has an X-ray PC paired (Cài đặt → Máy X-quang, F-95):
 * only then does the Hình ảnh tab offer "Mở EzDent-i".
 */
export function useXrayStationAvailable(clinicBranchId: string) {
  return useQuery({
    queryKey: ["xray-devices", "has-active", clinicBranchId] as const,
    queryFn: () =>
      api
        .get<boolean>("/v1/app/xray-devices/has-active", { params: { clinicBranchId } })
        .then((r) => r.data),
    enabled: Boolean(clinicBranchId),
    staleTime: 5 * 60_000,
  });
}

/**
 * The link BlueDental.XrayAgent answers on the X-ray PC: it opens the record
 * in EzDent-i. Only the code travels, never a name.
 */
export function ezdentLinkOf(patientCode: string): string {
  return `bluedental-xray://open?code=${encodeURIComponent(patientCode)}`;
}
