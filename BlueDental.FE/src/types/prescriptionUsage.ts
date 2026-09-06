/**
 * Flags of BlueDental.Catalogs.PrescriptionUsage — "Sử dụng" on a medicine
 * line. Shared by the Đơn thuốc mẫu catalog and the patient's Đơn thuốc, which
 * edit the same kind of line with the same picker.
 */
export const PRESCRIPTION_USAGE = {
  AfterMeal: 1,
  BeforeMeal: 2,
  DuringMeal: 4,
  AfterWakingUp: 8,
  BeforeSleep: 16,
  Other: 32,
} as const;

export type PrescriptionUsageFlag = (typeof PRESCRIPTION_USAGE)[keyof typeof PRESCRIPTION_USAGE];
