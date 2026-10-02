import dayjs from "dayjs";

/** Today as "YYYY-MM-DD" — the day key Chấm công records a day off under. */
export function todayIsoDate(): string {
  return dayjs().format("YYYY-MM-DD");
}
