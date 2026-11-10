import { t } from "@/lib/i18n";
import type { LaboMaterialOption, PickerOption } from "@/hooks/useLaboPickers";
import { sameRestoration, type RestorationPick } from "./requestSlipModel";

/** One Vật liệu as a row of Loại phục hình. */
export interface RestorationItem {
  id: string;
  name: string;
  /** Offers the "Trên implant" column. */
  onImplant: boolean;
}

/** One group of Loại phục hình: a labo_material row and its Vật liệu. */
export interface RestorationGroup {
  id: string;
  name: string;
  /** Any of its materials offers "Trên implant": the group shows as a two-column table. */
  implant: boolean;
  items: RestorationItem[];
}

/**
 * The groups in the catalog's order, each with its materials in theirs. A
 * material switched off in Danh mục drops out unless the order already ticks
 * it; a group left with nothing is not shown.
 */
export function restorationGroups(
  services: PickerOption[],
  materials: LaboMaterialOption[],
  picked: RestorationPick[],
): RestorationGroup[] {
  const isPicked = (id: string) => picked.some((pick) => pick.materialId === id);
  return services
    .map((service) => {
      const own = materials.filter((m) => m.serviceId === service.value && (m.isActive || isPicked(m.value)));
      return {
        id: service.value,
        name: service.label,
        implant: own.some((m) => m.allowOnImplant),
        items: own.map((m) => ({ id: m.value, name: m.label, onImplant: m.allowOnImplant })),
      };
    })
    .filter((group) => group.items.length > 0);
}

export const isTicked = (picked: RestorationPick[], pick: RestorationPick): boolean =>
  picked.some((one) => sameRestoration(one, pick));

/** Ticks or unticks one cell. */
export function toggleRestoration(picked: RestorationPick[], pick: RestorationPick): RestorationPick[] {
  return isTicked(picked, pick)
    ? picked.filter((one) => !sameRestoration(one, pick))
    : [...picked, pick];
}

/** "Sứ Lava, Sứ Titan (trên implant)" — the ticked cells in the catalog's order, as "Đã chọn" lists them. */
export function pickedNames(groups: RestorationGroup[], picked: RestorationPick[]): string[] {
  return groups.flatMap((group) =>
    group.items.flatMap((item) => [
      ...(isTicked(picked, { materialId: item.id, onImplant: false }) ? [item.name] : []),
      ...(isTicked(picked, { materialId: item.id, onImplant: true }) ? [t("Labo:Slip:OnImplantName", item.name)] : []),
    ]),
  );
}
