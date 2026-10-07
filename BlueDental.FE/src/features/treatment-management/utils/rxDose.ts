import { t } from "@/lib/i18n";
import type { PrescriptionSessionDose } from "../api/prescriptionApi";
import type { RxMedicineLine } from "../types/prescription";

/** The four sessions of a day, in the order the line table shows them. */
export const RX_SESSIONS = ["morning", "noon", "afternoon", "evening"] as const;
export type RxSession = (typeof RX_SESSIONS)[number];

const SESSION_LABEL_KEYS: Record<RxSession, string> = {
  morning: "Treatment:Rx:Morning",
  noon: "Treatment:Rx:Noon",
  afternoon: "Treatment:Rx:Afternoon",
  evening: "Treatment:Rx:Evening",
};

export function sessionLabel(session: RxSession): string {
  return t(SESSION_LABEL_KEYS[session]);
}

/** A new line: one in the morning for one day — the old "1 lần × 1" default. */
export const EMPTY_RX_LINE: RxMedicineLine = {
  medicineEntryId: "",
  morning: 1,
  noon: 0,
  afternoon: 0,
  evening: 0,
  days: 1,
  usage: 0,
  otherUsage: null,
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A session dose as typed: half tablets are common, trailing zeros are not worth showing. */
export function plainDose(value: number | string | undefined): string {
  return value != null && value !== "" ? String(Number(value)) : "";
}

/** "Số lượng" — never typed: (sáng + trưa + chiều + tối) × số ngày. */
export function doseQuantity(dose: PrescriptionSessionDose): number {
  const daily = RX_SESSIONS.reduce((sum, session) => sum + dose[session], 0);
  return round2(daily * dose.days);
}

/**
 * A Đơn thuốc mẫu line still doses as "n lần × mỗi lần"; spread it over the
 * sessions the way the F-58 migration spread the old slips, so the quantity
 * stays the same: 1 → sáng; 2 → sáng, tối; 3 → sáng, trưa, tối; 4 → all four;
 * every dose beyond four goes to sáng.
 */
export function doseFromTemplate(
  timesPerDay: number,
  amountPerTime: number,
): Pick<RxMedicineLine, RxSession> {
  const at = (minimum: number) => (timesPerDay >= minimum ? amountPerTime : 0);
  return {
    morning: timesPerDay >= 1 ? amountPerTime * (1 + Math.max(timesPerDay - 4, 0)) : 0,
    noon: at(3),
    afternoon: at(4),
    evening: at(2),
  };
}

/** "Sáng 1 · Tối 1 · 5 ngày" — the sessions in use, then the days. */
export function doseText(dose: PrescriptionSessionDose): string {
  const sessions = RX_SESSIONS.filter((session) => dose[session] > 0).map(
    (session) => `${sessionLabel(session)} ${dose[session]}`,
  );
  return [...sessions, t("Treatment:RxPrint:DoseDays", dose.days)].join(" · ");
}
