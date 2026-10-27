import dayjs from "dayjs";
import { t } from "@/lib/i18n";

/** One "Chọn nhanh" chip under Ghi chú lịch hẹn — so many days or weeks on. */
export interface QuickPick {
  count: number;
  unit: "day" | "week";
}

/** The BA's six, in the order they asked for (2026-10-27). */
export const QUICK_PICKS: readonly QuickPick[] = [
  { count: 1, unit: "day" },
  { count: 2, unit: "day" },
  { count: 3, unit: "day" },
  { count: 1, unit: "week" },
  { count: 2, unit: "week" },
  { count: 3, unit: "week" },
];

const dayOf = (treatmentDate: string, pick: QuickPick) => dayjs(treatmentDate).add(pick.count, pick.unit);

/**
 * "+1 tuần · 03/11" — counted from Ngày điều trị, not from today. With the
 * picker cleared there is no day to show, only the step.
 */
export function quickPickLabel(treatmentDate: string, pick: QuickPick): string {
  const step = t(pick.unit === "day" ? "Patient:Stage:PlusDays" : "Patient:Stage:PlusWeeks", pick.count);
  return treatmentDate ? `${step} · ${dayOf(treatmentDate, pick).format("DD/MM")}` : step;
}

/** The line a chip writes into the note: "Hẹn tái khám: 03/11/2026". */
function lineOf(treatmentDate: string, pick: QuickPick): string {
  return t("Patient:Stage:AppointmentNoteLine", dayOf(treatmentDate, pick).format("DD/MM/YYYY"));
}

const linesOf = (note: string) => note.split("\n");

/**
 * The chip whose line the note holds. Read off the text itself, so a line the
 * user deletes by hand unticks its chip too.
 */
export function pickedOf(note: string, treatmentDate: string): QuickPick | undefined {
  if (!treatmentDate) return undefined;
  const lines = linesOf(note).map((line) => line.trim());
  return QUICK_PICKS.find((pick) => lines.includes(lineOf(treatmentDate, pick)));
}

/**
 * Ticks `pick` (or nothing): one chip at a time, so any other chip's line goes
 * first. What the user typed around it is kept.
 */
export function withPick(note: string, treatmentDate: string, pick: QuickPick | undefined): string {
  const chipLines = QUICK_PICKS.map((each) => lineOf(treatmentDate, each));
  const typed = linesOf(note)
    .filter((line) => !chipLines.includes(line.trim()))
    .join("\n")
    .trimEnd();
  if (!pick) return typed;
  const line = lineOf(treatmentDate, pick);
  return typed ? `${typed}\n${line}` : line;
}

/** A new Ngày điều trị moves the ticked chip's date with it. */
export function rebasePick(note: string, fromDate: string, toDate: string): string {
  if (!fromDate || !toDate || fromDate === toDate) return note;
  const pick = pickedOf(note, fromDate);
  if (!pick) return note;
  const from = lineOf(fromDate, pick);
  const to = lineOf(toDate, pick);
  return linesOf(note)
    .map((line) => (line.trim() === from ? to : line))
    .join("\n");
}
