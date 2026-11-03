import dayjs, { type Dayjs } from "dayjs";
import {
  LABO_STATUS,
  LABO_TOOTH_RESULT,
  type LaboOrderDto,
  type LaboOrderToothDto,
} from "@/features/labo/api/laboApi";
import { LABO_PILL_TONE, type LaboPill } from "@/features/labo/api/laboStatus";
import type { WarrantyCardUrls } from "@/components/WarrantyCardPhotos";
import { t } from "@/lib/i18n";
import type { LaboWarrantyCardValues } from "./useLaboWarrantyForm";

/** Thời hạn bảo hành chips, in months; "Khác" takes any whole number. */
export const WARRANTY_DURATIONS = [6, 12, 24, 36, 60, 120] as const;

/** The server's cap (LaboOrder.MaxWarrantyMonths). */
export const MAX_WARRANTY_MONTHS = 600;

/** "Theo danh mục": the card runs the catalog's days, not a number of months (P3110 REQ-B5). */
export const CATALOG_DURATION = 0;

export type LaboWarrantyState = "inactive" | "active" | "expired";

export const LABO_WARRANTY_STATE_PILL: Record<LaboWarrantyState, LaboPill> = {
  inactive: { label: "Labo:Warranty:State:Inactive", ...LABO_PILL_TONE.muted },
  active: { label: "Labo:Warranty:State:Active", ...LABO_PILL_TONE.success },
  expired: { label: "Labo:Warranty:State:Expired", ...LABO_PILL_TONE.danger },
};

/** Cards are only issued once the whole order passed: Hoàn thành or already Bảo hành. */
export function isWarrantyOpen(order: Pick<LaboOrderDto, "status">): boolean {
  return order.status === LABO_STATUS.Completed || order.status === LABO_STATUS.Warranty;
}

/** The teeth tab 3 is about: every Đạt tooth, activated or not. */
export function warrantyTeeth(order: LaboOrderDto): LaboOrderToothDto[] {
  return order.teeth.filter((tooth) => tooth.checkResult === LABO_TOOTH_RESULT.Passed);
}

/** The Ảnh thẻ bảo hành of one tooth, by face. */
export function cardPhotoUrls(order: LaboOrderDto, toothNumber: number): WarrantyCardUrls {
  return Object.fromEntries(
    order.images
      .filter((image) => image.toothNumber === toothNumber && image.warrantyCardSide != null)
      .map((image) => [image.warrantyCardSide, image.url]),
  );
}

/** The DOM id of a tooth's card form, for its row in 1. Chọn răng kích hoạt to jump to. */
export function warrantyToothFormId(toothNumber: number): string {
  return `labo-warranty-tooth-${toothNumber}`;
}

export function isActivated(tooth: LaboOrderToothDto): boolean {
  return Boolean(tooth.warrantyActivatedAt);
}

export function warrantyState(tooth: LaboOrderToothDto): LaboWarrantyState {
  if (!isActivated(tooth)) return "inactive";
  return tooth.isWarrantyExpired ? "expired" : "active";
}

/**
 * Mã thẻ: the stored one once activated, "—" before. The server numbers it
 * on activation — BH-{mã dòng dịch vụ}-{ddMMyyyy}-{xx}, xx shared with the
 * line's other cards of that day (R-1090) — so no number can be foretold.
 */
export function warrantyCardCode(tooth: LaboOrderToothDto): string {
  return tooth.warrantyCardCode ?? "—";
}

/** A `YYYY-MM-DD` card date as DD/MM/YYYY, read as a calendar day (no time zone shift). */
export function formatCardDate(value: string | null | undefined): string {
  return value ? dayjs(value).format("DD/MM/YYYY") : "—";
}

/** Ngày hết hạn: start + months, as the server stores it. */
export function warrantyEndDate(start: Dayjs | null | undefined, months: number | null | undefined): Dayjs | null {
  return start && months && months > 0 ? start.add(months, "month") : null;
}

/**
 * A typed card's Ngày hết hạn: start + months — or, on "Theo danh mục" of a
 * dental card, start + the catalog's days.
 */
export function cardEndDate(
  card: { startDate?: Dayjs; months?: number } | undefined,
  catalogDays?: number,
): Dayjs | null {
  if (card?.months === CATALOG_DURATION && catalogDays) return card.startDate?.add(catalogDays, "day") ?? null;
  return warrantyEndDate(card?.startDate, card?.months);
}

/** "5 năm", "Theo danh mục · 90 ngày", or Chưa nhập before a duration is picked. */
export function typedDurationText(months: number | undefined, catalogDays?: number): string {
  if (months === CATALOG_DURATION && catalogDays) return t("Treatment:Warranty:ByCatalog", catalogDays);
  if (!months) return t("Labo:Warranty:NotEntered");
  const label = durationLabel(months);
  return t(label.key, label.value);
}

/** "Sứ Zirconia" — what the card says was made. */
export function restorationName(order: LaboOrderDto): string {
  return order.materialName ?? order.laboServiceName ?? "";
}

/** A duration as the chips read it: whole years in năm, the rest in tháng. */
export function durationLabel(months: number): { key: string; value: number } {
  return months % 12 === 0
    ? { key: "Labo:Warranty:Years", value: months / 12 }
    : { key: "Labo:Warranty:Months", value: months };
}

/** Còn lại: years and months left, days in the last month, or run out. */
export function remainingLabel(endDate: string, today: Dayjs = dayjs()): { key: string; args: number[] } {
  const end = dayjs(endDate);
  const from = today.startOf("day");
  if (end.isBefore(from)) return { key: "Labo:Warranty:Left:Expired", args: [] };
  const months = end.diff(from, "month");
  if (months === 0) return { key: "Labo:Warranty:Left:Days", args: [end.diff(from, "day")] };
  const years = Math.floor(months / 12);
  if (years === 0) return { key: "Labo:Warranty:Left:Months", args: [months] };
  if (months % 12 === 0) return { key: "Labo:Warranty:Left:Years", args: [years] };
  return { key: "Labo:Warranty:Left:YearsMonths", args: [years, months % 12] };
}

/** How much of the card's life has gone, 0..1, for the bar on the card. */
export function elapsedShare(tooth: LaboOrderToothDto, today: Dayjs = dayjs()): number {
  if (!tooth.warrantyStartDate || !tooth.warrantyEndDate) return 0;
  const start = dayjs(tooth.warrantyStartDate);
  const total = dayjs(tooth.warrantyEndDate).diff(start, "day");
  if (total <= 0) return 1;
  return Math.min(1, Math.max(0, today.diff(start, "day") / total));
}

/**
 * The photo drafts' key of the shared card (Dùng chung 1 thông số): no tooth
 * is numbered 0, so it never meets a tooth's own drafts.
 */
export const SHARED_CARD = 0;

/** What Dùng chung gives every picked tooth; the serial stays each tooth's own. */
export interface WarrantySharedValues {
  startDate?: Dayjs;
  months?: number;
  conditions?: string;
}

/** The shared fields of a tooth's card, e.g. to start the shared card from. */
export function sharedPart(card: WarrantySharedValues | undefined): WarrantySharedValues {
  return { startDate: card?.startDate, months: card?.months, conditions: card?.conditions };
}

/** A tooth's card while shared: its own serial, the shared rest as they stand. */
export function withShared(
  own: LaboWarrantyCardValues | undefined,
  shared: WarrantySharedValues | undefined,
): LaboWarrantyCardValues {
  return { ...own, ...sharedPart(shared) };
}

/** The shared card's fields that are filled, laid over a tooth's own when sharing ends. */
export function filledShared(shared: WarrantySharedValues | undefined): WarrantySharedValues {
  return {
    ...(shared?.startDate && { startDate: shared.startDate }),
    ...(shared?.months != null && { months: shared.months }),
    ...(shared?.conditions && { conditions: shared.conditions }),
  };
}

/** The latest day a picked tooth passed: the shared card cannot start before it. */
export function latestPassedDay(teeth: Pick<LaboOrderToothDto, "passedAt">[]): Dayjs | null {
  return teeth.reduce<Dayjs | null>((latest, tooth) => {
    if (!tooth.passedAt) return latest;
    const day = dayjs(tooth.passedAt).startOf("day");
    return latest && latest.isAfter(day) ? latest : day;
  }, null);
}
