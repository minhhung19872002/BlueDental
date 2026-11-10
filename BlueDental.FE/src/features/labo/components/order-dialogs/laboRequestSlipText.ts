import { t } from "@/lib/i18n";
import type { LaboOrderDto, LaboShadeZonesDto } from "@/features/labo/api/laboApi";

/** Cổ / Thân / Rìa cắn, each with its Gần and Xa cell, as the Phiếu yêu cầu lays them out. */
export const SHADE_ROWS = [
  ["Labo:Slip:Zone:Cervical", "cervicalMesial", "cervicalDistal"],
  ["Labo:Slip:Zone:Body", "bodyMesial", "bodyDistal"],
  ["Labo:Slip:Zone:Incisal", "incisalMesial", "incisalDistal"],
] as const satisfies readonly (readonly [string, keyof LaboShadeZonesDto, keyof LaboShadeZonesDto])[];

const cell = (value: string | null | undefined) => value?.trim() || "—";

/**
 * What the order makes: the Phiếu yêu cầu's Loại phục hình ("Sứ Lava, Zirconia
 * (trên implant)"), else the old form's Vật liệu. Every tooth carries the same
 * picks, so the first one speaks for the order.
 */
export function laboWorkOf(order: Pick<LaboOrderDto, "teeth" | "materialName">): string | undefined {
  const restorations = order.teeth[0]?.restorations ?? [];
  if (restorations.length === 0) return order.materialName;
  return restorations
    .map((pick) => (pick.onImplant ? t("Labo:Slip:OnImplantName", pick.materialName ?? "") : (pick.materialName ?? "")))
    .join(", ");
}

/** "Cổ A1 / A2, Thân A2 / —" — the rows with any colour in them, Gần before Xa. */
export function laboShadeZonesText(zones: LaboShadeZonesDto | null | undefined): string {
  if (!zones) return "";
  return SHADE_ROWS.filter(([, mesial, distal]) => zones[mesial]?.trim() || zones[distal]?.trim())
    .map(([label, mesial, distal]) => `${t(label)} ${cell(zones[mesial])} / ${cell(zones[distal])}`)
    .join(", ");
}

/** The ticked Đường hoàn tất names. */
export const laboFinishLinesText = (order: Pick<LaboOrderDto, "teeth">): string =>
  (order.teeth[0]?.finishLineNames ?? []).join(", ");
