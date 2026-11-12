import { t } from "@/lib/i18n";
import {
  LABO_MATERIAL_GROUP,
  laboMaterialGroupRank,
  type LaboMaterialGroupCode,
  type LaboMaterialOption,
  type LaboServiceOption,
} from "@/hooks/useLaboPickers";
import { LABO_BLOCK_KIND } from "@/features/labo/api/laboFormTemplateApi";
import { sameRestoration, type RestorationPick } from "./requestSlipModel";
import type { RestorationCardKind } from "./slipLayout";

/** One Vật liệu as a row of Loại phục hình. */
export interface RestorationItem {
  id: string;
  name: string;
  /** Offers the "Trên implant" column (a "pair" group, or an older group's flag). */
  onImplant: boolean;
}

/**
 * How a group's rows are ticked (BA P1011):
 * - "pair": its own column and "Trên implant" — Toàn sứ, Hợp kim, and an
 *   older group with any material that allowed an implant;
 * - "implantOnly": one column whose tick is on an implant — Phục hình khác trên implant;
 * - "plain": one plain column — an older group with no implant option.
 */
export type RestorationKind = "pair" | "implantOnly" | "plain";

/** One group of Loại phục hình: a labo_material row and its Vật liệu. */
export interface RestorationGroup {
  id: string;
  name: string;
  code?: LaboMaterialGroupCode;
  kind: RestorationKind;
  items: RestorationItem[];
}

const PAIR_CODES: readonly string[] = [LABO_MATERIAL_GROUP.AllCeramic, LABO_MATERIAL_GROUP.Alloy];

function kindOf(code: LaboMaterialGroupCode | undefined, own: LaboMaterialOption[]): RestorationKind {
  if (code === LABO_MATERIAL_GROUP.OtherOnImplant) return "implantOnly";
  if (code && PAIR_CODES.includes(code)) return "pair";
  return own.some((m) => m.allowOnImplant) ? "pair" : "plain";
}

/**
 * The three fixed groups in their order, each with its materials in the
 * catalog's order. A material switched off in Danh mục drops out unless the
 * order already ticks it. A group made before P1011 is shown only while the
 * order ticks one of its materials, so an old order still reads as written.
 */
export function restorationGroups(
  services: LaboServiceOption[],
  materials: LaboMaterialOption[],
  picked: RestorationPick[],
): RestorationGroup[] {
  const isPicked = (id: string) => picked.some((pick) => pick.materialId === id);
  const ordered = [...services].sort(
    (a, b) => (a.code ? laboMaterialGroupRank(a.code) : 99) - (b.code ? laboMaterialGroupRank(b.code) : 99),
  );
  return ordered
    .map((service) => {
      const own = materials.filter((m) => m.serviceId === service.value);
      const kind = kindOf(service.code, own);
      const shown = service.code
        ? own.filter((m) => m.isActive || isPicked(m.value))
        : own.filter((m) => isPicked(m.value));
      return {
        id: service.value,
        name: service.label,
        code: service.code,
        kind,
        items: shown.map((m) => ({
          id: m.value,
          name: m.label,
          onImplant: kind === "pair" && (service.code !== undefined || m.allowOnImplant),
        })),
      };
    })
    .filter((group) => group.items.length > 0);
}

/**
 * The card a group sits on (R-1202), as the server files it: Toàn sứ and Hợp
 * kim their own, Phục hình khác trên implant also every group made before P1011.
 */
export function cardOf(group: Pick<RestorationGroup, "code">): RestorationCardKind {
  if (group.code === LABO_MATERIAL_GROUP.AllCeramic) return LABO_BLOCK_KIND.AllCeramic;
  if (group.code === LABO_MATERIAL_GROUP.Alloy) return LABO_BLOCK_KIND.Alloy;
  return LABO_BLOCK_KIND.OtherOnImplant;
}

export const isTicked = (picked: RestorationPick[], pick: RestorationPick): boolean =>
  picked.some((one) => sameRestoration(one, pick));

/** Ticks or unticks one cell. */
export function toggleRestoration(picked: RestorationPick[], pick: RestorationPick): RestorationPick[] {
  return isTicked(picked, pick)
    ? picked.filter((one) => !sameRestoration(one, pick))
    : [...picked, pick];
}

/**
 * "Sứ Lava, Sứ Titan (trên implant)" — the ticked cells in the catalog's order,
 * as "Đã chọn" lists them; a Phục hình khác trên implant tick carries the
 * suffix too, as the print and the lists name it from the stored pick.
 */
export function pickedNames(groups: RestorationGroup[], picked: RestorationPick[]): string[] {
  return groups.flatMap((group) =>
    group.items.flatMap((item) => [
      ...(isTicked(picked, { materialId: item.id, onImplant: false }) ? [item.name] : []),
      ...(isTicked(picked, { materialId: item.id, onImplant: true }) ? [t("Labo:Slip:OnImplantName", item.name)] : []),
    ]),
  );
}
