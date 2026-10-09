import { t } from "@/lib/i18n";
import type { SessionDose } from "./types";

/** The four sessions of a day, in the order the line table shows them. */
export const RX_SESSIONS = ["morning", "noon", "afternoon", "evening"] as const;
export type RxSession = (typeof RX_SESSIONS)[number];

const SESSION_LABEL_KEYS: Record<RxSession, string> = {
  morning: "Common:Rx:Morning",
  noon: "Common:Rx:Noon",
  afternoon: "Common:Rx:Afternoon",
  evening: "Common:Rx:Evening",
};

export function sessionLabel(session: RxSession): string {
  return t(SESSION_LABEL_KEYS[session]);
}

/** "Sáng — thuốc 2": names one box of one line for screen readers and tests. */
export function lineFieldLabel(field: string, lineNumber: number): string {
  return t("Common:Rx:SessionOfLine", field, lineNumber);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A session dose as typed: half tablets are common, trailing zeros are not worth showing. */
export function plainDose(value: number | string | undefined): string {
  return value != null && value !== "" ? String(Number(value)) : "";
}

/** "Số lượng" — never typed: (sáng + trưa + chiều + tối) × số ngày. */
export function doseQuantity(dose: SessionDose): number {
  const daily = RX_SESSIONS.reduce((sum, session) => sum + dose[session], 0);
  return round2(daily * dose.days);
}
