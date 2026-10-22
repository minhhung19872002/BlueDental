import dayjs, { type Dayjs } from "dayjs";
import { t } from "@/lib/i18n";
import { rangeCellClass } from "./rangeCell";

interface Props {
  /** Any day of the month shown. */
  view: Dayjs;
  from: Dayjs;
  to: Dayjs;
  onPick: (date: Dayjs) => void;
  onHover: (date: Dayjs | null) => void;
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Six Monday-first weeks around the month, so the grid never changes height. */
function monthCells(view: Dayjs): Dayjs[] {
  const first = view.startOf("month");
  // Monday first whatever the dayjs locale says a week starts on.
  const start = first.subtract((first.day() + 6) % 7, "day");
  return Array.from({ length: 42 }, (_, index) => start.add(index, "day"));
}

/** The Ngày grid: a month of days, the picked range filled between solid ends. */
export function PeriodGridDays({ view, from, to, onPick, onHover }: Props) {
  const today = dayjs().startOf("day");
  const month = view.month();

  return (
    <div className="bd-prp-grid bd-prp-grid--days" role="grid" onMouseLeave={() => onHover(null)}>
      {WEEKDAYS.map((weekday) => (
        <span key={weekday} className="bd-prp-weekday" role="columnheader">
          {t(`Appointment:Series:WeekdayShort:${weekday}`)}
        </span>
      ))}
      {monthCells(view).map((day) => (
        <button
          key={day.valueOf()}
          type="button"
          role="gridcell"
          aria-label={day.format("DD/MM/YYYY")}
          className={rangeCellClass({ start: day, end: day }, from, to, {
            outside: day.month() !== month,
            current: day.isSame(today, "day"),
          })}
          onClick={() => onPick(day)}
          onMouseEnter={() => onHover(day)}
        >
          {day.date()}
        </button>
      ))}
    </div>
  );
}
