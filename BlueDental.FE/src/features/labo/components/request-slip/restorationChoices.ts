import { t } from "@/lib/i18n";
import {
  laboMaterialGroupRank,
  type LaboMaterialOption,
  type LaboServiceOption,
} from "@/hooks/useLaboPickers";
import type { LaboChoiceItem } from "../order-dialogs/laboChoice";

/**
 * Loại phục hình of the Phiếu yêu cầu as the classic Đặt hàng tab picks it
 * (R-1216): one Dịch vụ — a group of Vật liệu & loại phục hình — then one of
 * its Vật liệu. No "Trên implant".
 */

const rankOf = (service: LaboServiceOption) => (service.code ? laboMaterialGroupRank(service.code) : 99);

/**
 * The materials a slip may pick from: active ones, and the one it already
 * holds even if it was switched off in Danh mục since.
 */
const usable = (materials: LaboMaterialOption[], materialId: string | undefined) =>
  materials.filter((material) => material.isActive || material.value === materialId);

/** The Dịch vụ the picked material belongs to. */
export const serviceOfMaterial = (
  materials: LaboMaterialOption[],
  materialId: string | undefined,
): string | undefined => materials.find((material) => material.value === materialId)?.serviceId;

/**
 * The Dịch vụ chips: the three fixed groups in their order, each with a
 * material to pick, counted and searchable by its materials' names. A group
 * made before P1011 shows only while the slip already holds one of its
 * materials, so an old order still reads as written.
 */
export function restorationServices(
  services: LaboServiceOption[],
  materials: LaboMaterialOption[],
  materialId: string | undefined,
): LaboChoiceItem[] {
  const shown = usable(materials, materialId);
  const held = serviceOfMaterial(materials, materialId);
  return [...services]
    .sort((a, b) => rankOf(a) - rankOf(b))
    .filter((service) => service.code !== undefined || service.value === held)
    .map((service) => ({ service, own: shown.filter((material) => material.serviceId === service.value) }))
    .filter(({ service, own }) => own.length > 0 || service.value === held)
    .map(({ service, own }) => ({
      value: service.value,
      label: service.label,
      description: service.description,
      extra: t("Labo:Choice:MaterialCount", own.length),
      keywords: own.map((material) => material.label),
    }));
}

/** The Vật liệu chips of the picked Dịch vụ, in the catalog's order. */
export function restorationMaterials(
  materials: LaboMaterialOption[],
  serviceId: string | undefined,
  materialId: string | undefined,
): LaboChoiceItem[] {
  if (!serviceId) return [];
  return usable(materials, materialId)
    .filter((material) => material.serviceId === serviceId)
    .map(({ value, label }) => ({ value, label }));
}
