import dayjs, { type Dayjs } from "dayjs";
import type { MedicalRecordFormSpec } from "../medicalRecordForms";
import type { FieldValues } from "./fieldValues";

/** How a whole day is printed in a date blank. */
const WHOLE_DAY = "DD/MM/YYYY";

type DatedSpec = Pick<MedicalRecordFormSpec, "dateFieldKeys" | "datePartKeys">;

/**
 * The day picked above a sheet, in the blanks that print it: whole where the
 * form has one blank for it, and split over "Ngày … tháng … năm 20…" where the
 * paper writes it so — the year after the printed "20" (mẫu 11, 2026-11-16).
 */
export function dayFieldValues(spec: DatedSpec, day: Dayjs): FieldValues {
  const whole = day.format(WHOLE_DAY);
  const values: FieldValues = Object.fromEntries((spec.dateFieldKeys ?? []).map((key) => [key, whole]));
  const parts = spec.datePartKeys;
  if (parts) {
    values[parts.day] = day.format("DD");
    values[parts.month] = day.format("MM");
    values[parts.year] = day.format("YY");
  }
  return values;
}

/** The day already printed on a sheet, read back from either kind of blank. */
export function printedDayOf(spec: DatedSpec, values: FieldValues): Dayjs | undefined {
  const [key] = spec.dateFieldKeys ?? [];
  const whole = key ? values[key] : undefined;
  if (typeof whole === "string" && whole) {
    const parsed = dayjs(whole, WHOLE_DAY, true);
    if (parsed.isValid()) return parsed;
  }

  const parts = spec.datePartKeys;
  if (!parts) return undefined;
  const [day, month, year] = [parts.day, parts.month, parts.year].map((part) => values[part]);
  if (typeof day !== "string" || typeof month !== "string" || typeof year !== "string") return undefined;
  const parsed = dayjs(`${day.trim()}/${month.trim()}/20${year.trim()}`, WHOLE_DAY, true);
  return parsed.isValid() ? parsed : undefined;
}
