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

export async function getProvinceName(code: string | undefined | null): Promise<string | null> {
  if (!code) return null;
  const provinces = await getAllProvinces();
  return provinces.find((p) => p.code === code)?.name ?? null;
}

export async function getWardName(provinceCode: string | undefined | null, wardCode: string | undefined | null): Promise<string | null> {
  if (!provinceCode || !wardCode) return null;
  const wards = await getWardsByProvince(provinceCode);
  return wards.find((w) => w.code === wardCode)?.name ?? null;
}
