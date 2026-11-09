import dayjs from "dayjs";
import { t } from "@/lib/i18n";

/** The three "Chọn nhanh" tabs, in their order on screen. */
export type QuickPickUnit = "day" | "week" | "month";

/** One "Chọn nhanh" chip under Ghi chú lịch hẹn — so many days, weeks or months on. */
export interface QuickPick {
  count: number;
  unit: QuickPickUnit;
}

export const QUICK_PICK_UNITS: readonly QuickPickUnit[] = ["day", "week", "month"];

/**
 * How many chips each tab holds — owner 2026-11-09 (R-1175): Ngày 1 → 7,
 * Tuần 1 → 4, Tháng 1 → 12. Before that, one strip of nine (R-1056, R-1128).
 */
const PICKS_PER_UNIT: Record<QuickPickUnit, number> = { day: 7, week: 4, month: 12 };

/** Every chip: days first, then weeks, then months — the order {@link pickedOf} leans on. */
export const QUICK_PICKS: readonly QuickPick[] = QUICK_PICK_UNITS.flatMap((unit) =>
  Array.from({ length: PICKS_PER_UNIT[unit] }, (_, at): QuickPick => ({ count: at + 1, unit })),
);

/** The chips of one tab. */
export const picksOf = (unit: QuickPickUnit): QuickPick[] => QUICK_PICKS.filter((pick) => pick.unit === unit);

const STEP_KEYS: Record<QuickPickUnit, string> = {
  day: "Patient:Stage:PlusDays",
  week: "Patient:Stage:PlusWeeks",
  month: "Patient:Stage:PlusMonths",
};

const dayOf = (treatmentDate: string, pick: QuickPick) => dayjs(treatmentDate).add(pick.count, pick.unit);

/**
 * "+1 tuần" and "03/11" — the chip reads "+1 tuần · 03/11", the day counted
 * from Ngày điều trị, not from today. With the picker cleared there is no day
 * to show, only the step. Two parts so a narrow chip breaks between them.
 */
export function quickPickLabel(treatmentDate: string, pick: QuickPick): { step: string; day?: string } {
  const step = t(STEP_KEYS[pick.unit], pick.count);
  return treatmentDate ? { step, day: dayOf(treatmentDate, pick).format("DD/MM") } : { step };
}

/** The line a chip writes into the note: "Hẹn tái khám: 03/11/2026". */
function lineOf(treatmentDate: string, pick: QuickPick): string {
  return t("Patient:Stage:AppointmentNoteLine", dayOf(treatmentDate, pick).format("DD/MM/YYYY"));
}

const linesOf = (note: string) => note.split("\n");

/**
 * The chip whose line the note holds. Read off the text itself, so a line the
 * user deletes by hand unticks its chip too.
 *
 * Two chips can land on the same day — +7 ngày always is +1 tuần, and +4 tuần
 * is +1 tháng from a February day of a common year. The open tab's chip wins
 * (`prefer`); otherwise the coarsest, the last of {@link QUICK_PICKS}.
 */
export function pickedOf(note: string, treatmentDate: string, prefer?: QuickPickUnit): QuickPick | undefined {
  if (!treatmentDate) return undefined;
  const lines = linesOf(note).map((line) => line.trim());
  const matches = QUICK_PICKS.filter((pick) => lines.includes(lineOf(treatmentDate, pick)));
  return matches.find((pick) => pick.unit === prefer) ?? matches.at(-1);
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
