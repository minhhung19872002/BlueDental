import type { Dayjs } from "dayjs";
import { t } from "@/lib/i18n";

interface Props {
  currentDate: Dayjs;
  onDayClick: (day: Dayjs) => void;
}

const WEEKDAY_KEYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;

export function TimekeepingWeekHeader({ currentDate, onDayClick }: Props) {
  const weekStart = currentDate.startOf("week");

  return (
    <div className="tk-week-header">
      {WEEKDAY_KEYS.map((key, i) => {
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
            <span className="tk-week-header-label">{t(key)}</span>
            <span className="tk-week-header-date">{day.format("DD/MM")}</span>
          </button>
        );
      })}
    </div>
  );
}
