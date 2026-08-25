import { getAllProvince, getWardsByProvinceId } from "new-vn-provinces/provinces";

export interface LocationOption {
  code: string;
  name: string;
}

let cachedProvinces: LocationOption[] | null = null;
const cachedWardsMap = new Map<string, LocationOption[]>();

export async function getAllProvinces(): Promise<LocationOption[]> {
  if (cachedProvinces) return cachedProvinces;

  const raw = await getAllProvince();
  cachedProvinces = raw.map((p) => ({ code: p.idProvince, name: p.name }));
  return cachedProvinces;
}

export async function getWardsByProvince(provinceCode: string): Promise<LocationOption[]> {
  if (!provinceCode) return [];
  if (cachedWardsMap.has(provinceCode)) return cachedWardsMap.get(provinceCode)!;

  const raw = await getWardsByProvinceId(provinceCode);
  const wards = raw.map((w) => ({ code: w.idWard, name: w.name }));
  cachedWardsMap.set(provinceCode, wards);
  return wards;
}
