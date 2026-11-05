import { t } from "@/lib/i18n";
import { LABO_PILL_TONE, type LaboPill } from "@/features/labo/api/laboStatus";
import { cardEndDate, typedDurationText } from "./laboWarrantyRules";
import { isWarrantyCardReady, type LaboWarrantyCardValues } from "./useLaboWarrantyForm";
import type { WarrantyFace } from "./WarrantyCardFace";

/** A tooth not yet activated, as typed so far in Kích hoạt bảo hành (R-1152). */
export interface LaboWarrantyDraft {
  card: LaboWarrantyCardValues | undefined;
  /** Ticked in 1. Chọn răng kích hoạt — left unticked, it is not activated this time. */
  picked: boolean;
}

/** "Thiếu ngày bắt đầu, thời hạn", or "" once both are in. */
export function missingText(card: LaboWarrantyCardValues | undefined): string {
  const missing = [
    !card?.startDate && t("Labo:Warranty:StartDateShort"),
    card?.months == null && t("Labo:Warranty:DurationShort"),
  ].filter((part): part is string => Boolean(part));
  return missing.length > 0 ? t("Labo:Warranty:Missing", missing.join(", ")) : "";
}

/** Trạng thái of a draft row in Tổng quan (BA mock): Sẵn sàng · Thiếu … · Không kích hoạt. */
export function draftPill(draft: LaboWarrantyDraft): LaboPill {
  if (!draft.picked) return { label: t("Labo:Warranty:Skipped"), ...LABO_PILL_TONE.muted };
  const missing = missingText(draft.card);
  return missing
    ? { label: missing, ...LABO_PILL_TONE.warning }
    : { label: t("Labo:Warranty:ReadyShort"), ...LABO_PILL_TONE.success };
}

/**
 * The card a tooth will get, as typed so far (BA mock BaoHanhV2): purple once
 * Ngày bắt đầu and Thời hạn are in — "Sẵn sàng kích hoạt" — else slate. The
 * code line carries the serial: the BH number is only given on activation.
 */
export function draftFace(toothNumber: number, card: LaboWarrantyCardValues | undefined, what: string): WarrantyFace {
  const ready = isWarrantyCardReady(card);
  return {
    heading: t("Labo:Check:ToothLabel", toothNumber),
    code: card?.manufacturerSerial?.trim() || "—",
    what,
    startDate: card?.startDate?.format("YYYY-MM-DD"),
    endDate: cardEndDate(card)?.format("YYYY-MM-DD"),
    state: ready ? "active" : "inactive",
    elapsed: 0,
    left: typedDurationText(card?.months),
    note: t("Labo:Warranty:ClaimCount", 0),
    pill: t(ready ? "Labo:Warranty:ReadyToActivate" : "Labo:Warranty:State:Inactive"),
  };
}
