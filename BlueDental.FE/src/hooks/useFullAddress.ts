import { useQuery } from "@tanstack/react-query";
import { getProvinceName, getWardName } from "@/utils/vietnamLocations";

interface AddressParts {
  street: string | null | undefined;
  provinceCode: string | null | undefined;
  wardCode: string | null | undefined;
}

/**
 * "12 Lê Lợi, Phường Bến Thành, TP Hồ Chí Minh" — the street, then the ward and
 * province names looked up from their codes. Empty when none of them is known.
 */
export function useFullAddress({ street, provinceCode, wardCode }: AddressParts): string {
  const province = provinceCode || null;
  const ward = wardCode || null;
  const names = useQuery({
    queryKey: ["vn-location-names", province, ward],
    queryFn: async () => [await getWardName(province, ward), await getProvinceName(province)],
    enabled: Boolean(province),
    staleTime: Infinity,
  }).data;
  return [street?.trim(), ...(province ? names ?? [] : [])].filter(Boolean).join(", ");
}
