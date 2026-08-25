import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { useAppointmentList } from "../api/appointmentQueries";
import { t } from "@/lib/i18n";

const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

interface Props {
  currentDate: Dayjs;
  onDayClick?: (day: Dayjs) => void;
}

/**
 * The month grid as the design draws it: separate rounded cells with a gap
 * between them, each carrying its date and — the part that was missing — how
 * many appointments fall on it. Without the count the month view only told you
 * what the calendar on the wall already does.
 */
export function MonthViewCalendar({ currentDate, onDayClick }: Props) {
  const monthStart = currentDate.startOf("month");
  const monthEnd = currentDate.endOf("month");
  const calStart = monthStart.startOf("week");
  const calEnd = monthEnd.endOf("week");
  const today = dayjs();

  // One request for the whole grid, including the trailing days of the
  // neighbouring months the grid shows.
  const { data } = useAppointmentList({
    fromDate: calStart.format("YYYY-MM-DD"),
    toDate: calEnd.format("YYYY-MM-DD"),
    maxResultCount: 1000,
  });

  const countByDay = new Map<string, number>();
  for (const appointment of data?.items ?? []) {
    if (!appointment.startTime) continue;
    const key = dayjs(appointment.startTime).format("YYYY-MM-DD");
    countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
  }

  const days: Dayjs[] = [];
  let current = calStart;
  while (current.isBefore(calEnd) || current.isSame(calEnd, "day")) {
    days.push(current);
    current = current.add(1, "day");
  }

  return (
    <div className="month-grid-card">
      <div className="month-grid-head">
        {DAY_LABELS.map((label) => (
          <span key={label} className="month-grid-weekday">
            {label}
          </span>
        ))}
      </div>

      <div className="month-grid">
        {days.map((day) => {
          const key = day.format("YYYY-MM-DD");
          const count = countByDay.get(key) ?? 0;
          const classes = [
            "month-cell",
            day.month() === currentDate.month() ? "" : "month-cell--outside",
            day.isSame(today, "day") ? "month-cell--today" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={key}
              type="button"
              className={classes}
              onClick={() => onDayClick?.(day)}
              aria-label={t("{0} — {1} lịch hẹn", day.format("DD/MM/YYYY"), count)}
            >
              <span className="month-cell-date">{day.date()}</span>
              {count > 0 && <span className="month-cell-count">{count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
