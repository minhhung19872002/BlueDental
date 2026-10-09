import { t } from "@/lib/i18n";
import { PRESCRIPTION_USAGE } from "@/types/prescriptionUsage";

/** The dose of one line by session — 0 when the session is skipped. */
export interface SessionDose {
  morning: number;
  noon: number;
  afternoon: number;
  evening: number;
  days: number;
}

/**
 * One medicine line as the editor holds it — the same shape the server takes
 * for a template line and for a slip line, minus what it computes itself.
 * Both dose by session of the day (F-58, R-884).
 */
export interface PrescriptionLine extends SessionDose {
  id?: string;
  medicineEntryId: string;
  /** Flags of PRESCRIPTION_USAGE. */
  usage: number;
  /** What the user wrote for "Khác"; null unless that flag is set. */
  otherUsage: string | null;
}

/** A new line: one in the morning for one day. */
export const EMPTY_PRESCRIPTION_LINE: PrescriptionLine = {
  medicineEntryId: "",
  morning: 1,
  noon: 0,
  afternoon: 0,
  evening: 0,
  days: 1,
  usage: 0,
  otherUsage: null,
};

/** What the medicine picker needs to know about a thuốc catalog entry. */
export interface MedicineOption {
  id: string;
  name: string;
}

/** The six choices the reference lists, in its order. */
export function usageOptions(): { flag: number; label: string }[] {
  return [
    { flag: PRESCRIPTION_USAGE.AfterMeal, label: t("Common:Rx:AfterMeal") },
    { flag: PRESCRIPTION_USAGE.BeforeMeal, label: t("Common:Rx:BeforeMeal") },
    { flag: PRESCRIPTION_USAGE.DuringMeal, label: t("Common:Rx:DuringMeal") },
    { flag: PRESCRIPTION_USAGE.AfterWakingUp, label: t("Common:Rx:AfterWakeup") },
    { flag: PRESCRIPTION_USAGE.BeforeSleep, label: t("Common:Rx:BeforeSleep") },
    { flag: PRESCRIPTION_USAGE.Other, label: t("Common:Rx:Other") },
  ];
}

/** What one line stores for "Sử dụng": the chosen flags, plus the written-out
 * text when "Khác" is among them. */
export interface UsageValue {
  usage: number;
  otherUsage: string | null;
}

export function usageLabel({ usage, otherUsage }: UsageValue): string {
  const picked = usageOptions()
    .filter((option) => (usage & option.flag) !== 0)
    .map((option) =>
      // "Khác" reads as whatever was written for it.
      option.flag === PRESCRIPTION_USAGE.Other && otherUsage ? otherUsage : option.label,
    );

  return picked.length === 0 ? t("Common:Rx:Usage") : picked.join(", ");
}
