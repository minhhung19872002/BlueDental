import { t } from "@/lib/i18n";
import { PRESCRIPTION_USAGE } from "@/types/prescriptionUsage";

/**
 * One medicine line as the editor holds it — the same shape the server takes
 * for a template line and for a slip line, minus what it computes itself.
 */
export interface PrescriptionLine {
  id?: string;
  medicineEntryId: string;
  timesPerDay: number;
  amountPerTime: number;
  days: number;
  /** Flags of PRESCRIPTION_USAGE. */
  usage: number;
  /** What the user wrote for "Khác"; null unless that flag is set. */
  otherUsage: string | null;
}

export const EMPTY_PRESCRIPTION_LINE: PrescriptionLine = {
  medicineEntryId: "",
  timesPerDay: 1,
  amountPerTime: 1,
  days: 1,
  usage: 0,
  otherUsage: null,
};

/** What the medicine picker needs to know about a thuốc catalog entry. */
export interface MedicineOption {
  id: string;
  name: string;
}

/** "Số lượng" — never typed, always Ngày uống × Mỗi lần × Số ngày. */
export function lineQuantity(line: PrescriptionLine): number {
  return line.timesPerDay * line.amountPerTime * line.days;
}

/** The six choices the reference lists, in its order. */
export function usageOptions(): { flag: number; label: string }[] {
  return [
    { flag: PRESCRIPTION_USAGE.AfterMeal, label: t("Sau khi ăn") },
    { flag: PRESCRIPTION_USAGE.BeforeMeal, label: t("Trước khi ăn") },
    { flag: PRESCRIPTION_USAGE.DuringMeal, label: t("Trong khi ăn") },
    { flag: PRESCRIPTION_USAGE.AfterWakingUp, label: t("Sau khi thức dậy") },
    { flag: PRESCRIPTION_USAGE.BeforeSleep, label: t("Trước khi ngủ") },
    { flag: PRESCRIPTION_USAGE.Other, label: t("Khác") },
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

  return picked.length === 0 ? t("Sử dụng") : picked.join(", ");
}
