import {
  laboMaterialGroupRank,
  type LaboMaterialOption,
  type LaboServiceOption,
} from "@/hooks/useLaboPickers";

/**
 * Dịch vụ & vật liệu of the Phiếu yêu cầu (P1311): one Dịch vụ — a group of
 * Dịch vụ Labo — then any of its Vật liệu. No "Trên implant".
 */

export interface SlipServiceItem {
  value: string;
  label: string;
}

const rankOf = (service: LaboServiceOption) =>
  service.code ? laboMaterialGroupRank(service.code) : Number.MAX_SAFE_INTEGER;

/**
 * The materials a slip may pick from: active ones, and those it already holds
 * even if they were switched off in Danh mục since.
 */
const usable = (materials: LaboMaterialOption[], held: readonly string[]) =>
  materials.filter((material) => material.isActive || held.includes(material.value));

/** The Dịch vụ the held materials belong to — the first one's, as a slip holds one. */
export const serviceOfMaterials = (
  materials: LaboMaterialOption[],
  held: readonly string[],
): string | undefined => materials.find((material) => held.includes(material.value))?.serviceId;

/**
 * The Dịch vụ rows: the three fixed groups in their order, then the ones the
 * branch added (P1311) in the catalog's order. A group made before P1011
 * shows only while the slip already holds one of its materials, so an old
 * order still reads as written.
 */
export function slipServices(
  services: LaboServiceOption[],
  materials: LaboMaterialOption[],
  held: readonly string[],
): SlipServiceItem[] {
  const heldService = serviceOfMaterials(materials, held);
  return [...services]
    .sort((a, b) => rankOf(a) - rankOf(b))
    .filter((service) => service.code !== undefined || service.added || service.value === heldService)
    .map(({ value, label }) => ({ value, label }));
}

/** The Vật liệu of one Dịch vụ, in the catalog's order. */
export function slipMaterials(
  materials: LaboMaterialOption[],
  serviceId: string | undefined,
  held: readonly string[],
): LaboMaterialOption[] {
  if (!serviceId) return [];
  return usable(materials, held).filter((material) => material.serviceId === serviceId);
}

/** The names of the held materials, in the order they were picked; unknown ids are left out. */
export function pickedNames(materials: LaboMaterialOption[], held: readonly string[]): string[] {
  return held.flatMap((id) => materials.filter((material) => material.value === id).map((material) => material.label));
}
