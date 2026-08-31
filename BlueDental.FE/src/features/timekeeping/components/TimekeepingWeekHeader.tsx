import type { Dayjs } from "dayjs";

interface Props {
  currentDate: Dayjs;
  onDayClick: (day: Dayjs) => void;
}

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export function TimekeepingWeekHeader({ currentDate, onDayClick }: Props) {
  const weekStart = currentDate.startOf("week");

  return (
    <div className="tk-week-header">
      {WEEKDAY_LABELS.map((label, i) => {
        const day = weekStart.add(i, "day");
        const isActive = day.isSame(currentDate, "day");

        return (
          <button
            key={i}
            type="button"
            className={[
              "tk-week-header-cell",
              isActive && "tk-week-header-cell--active",
            ].filter(Boolean).join(" ")}
            onClick={() => onDayClick(day)}
          >
            <span className="tk-week-header-label">{label}</span>
            <span className="tk-week-header-date">{day.format("DD/MM")}</span>
          </button>
        );
      })}
    </div>
  );
}
