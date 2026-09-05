import type { Dayjs } from "dayjs";

/** 0 = Sunday, 1 = Monday, the two week openings the reference uses. */
export type WeekStart = 0 | 1;

/**
 * The first day of the week `date` falls in.
 *
 * With `weekStartsOn` the answer is fixed whatever language the app is in;
 * without it the dayjs locale decides (Monday in vi, Sunday in en), which is
 * what the older screens rely on.
 */
export function startOfWeek(date: Dayjs, weekStartsOn?: WeekStart): Dayjs {
  if (weekStartsOn === undefined) return date.startOf("week");
  const offset = (date.day() - weekStartsOn + 7) % 7;
  return date.subtract(offset, "day").startOf("day");
}

export function endOfWeek(date: Dayjs, weekStartsOn?: WeekStart): Dayjs {
  if (weekStartsOn === undefined) return date.endOf("week");
  return startOfWeek(date, weekStartsOn).add(6, "day").endOf("day");
}
