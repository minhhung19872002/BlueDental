import dayjs, { type Dayjs } from "dayjs";
import {
  LABO_STATUS,
  LABO_TOOTH_RESULT,
  type LaboOrderDto,
  type LaboOrderToothDto,
} from "@/features/labo/api/laboApi";
import { LABO_PILL_TONE, type LaboPill } from "@/features/labo/api/laboStatus";

/** Thời hạn bảo hành chips, in months; "Khác" takes any whole number. */
export const WARRANTY_DURATIONS = [6, 12, 24, 36, 60, 120] as const;

/** The server's cap (LaboOrder.MaxWarrantyMonths). */
export const MAX_WARRANTY_MONTHS = 600;

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

export function isActivated(tooth: LaboOrderToothDto): boolean {
  return Boolean(tooth.warrantyActivatedAt);
}

export function warrantyState(tooth: LaboOrderToothDto): LaboWarrantyState {
  if (!isActivated(tooth)) return "inactive";
  return tooth.isWarrantyExpired ? "expired" : "active";
}

/**
 * Mã thẻ: the stored one once activated; before that the code the server
 * will give it if activated this month — BH-{yyMM}-{last 4 of the order}-{tooth}.
 */
export function warrantyCardCode(order: LaboOrderDto, tooth: LaboOrderToothDto, today: Dayjs = dayjs()): string {
  if (tooth.warrantyCardCode) return tooth.warrantyCardCode;
  return `BH-${today.format("YYMM")}-${order.orderCode.slice(-4)}-${tooth.toothNumber}`;
}

/** A `YYYY-MM-DD` card date as DD/MM/YYYY, read as a calendar day (no time zone shift). */
export function formatCardDate(value: string | null | undefined): string {
  return value ? dayjs(value).format("DD/MM/YYYY") : "—";
}

/** Ngày hết hạn: start + months, as the server stores it. */
export function warrantyEndDate(start: Dayjs | null | undefined, months: number | null | undefined): Dayjs | null {
  return start && months && months > 0 ? start.add(months, "month") : null;
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
