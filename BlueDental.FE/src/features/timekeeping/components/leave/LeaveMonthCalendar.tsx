import { useMemo } from "react";
import type { Dayjs } from "dayjs";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";

import { LEAVE_SHIFT, type LeaveShift } from "../../api/timekeepingApi";
import { t } from "@/lib/i18n";

/** Monday-first, as the design draws it. */
const WEEKDAY_KEYS = [
  "Common:Monday",
  "Common:Tuesday",
  "Common:Wednesday",
  "Common:Thursday",
  "Common:Friday",
  "Common:Saturday",
  "Common:Sunday",
] as const;

const MONTH_KEYS = [
  "Common:January", "Common:February", "Common:March", "Common:April",
  "Common:May", "Common:June", "Common:July", "Common:August",
  "Common:September", "Common:October", "Common:November", "Common:December",
] as const;

interface CalendarCell {
  date: Dayjs;
  key: string;
  inMonth: boolean;
}

function buildCells(month: Dayjs): CalendarCell[] {
  const first = month.startOf("month");
  const leading = (first.day() + 6) % 7;
  const start = first.subtract(leading, "day");
  const weeks = Math.ceil((leading + month.daysInMonth()) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const date = start.add(i, "day");
    return { date, key: date.format("YYYY-MM-DD"), inMonth: date.month() === month.month() };
  });
}

function ShiftMarks({ shift }: { shift: LeaveShift | null }) {
  if (shift === null) return <span className="lv-mark lv-mark--none" />;
  return (
    <span className="lv-marks">
      {shift !== LEAVE_SHIFT.Afternoon && <span className="lv-mark lv-mark--morning" />}
      {shift !== LEAVE_SHIFT.Morning && <span className="lv-mark lv-mark--afternoon" />}
    </span>
  );
}

interface Props {
  month: Dayjs;
  today: string;
  /** Picked days and the shift chosen for each, null while none is. */
  selected: ReadonlyMap<string, LeaveShift | null>;
  isLocked: (date: string) => boolean;
  onMonthChange: (month: Dayjs) => void;
  onToggle: (date: string) => void;
}

export function LeaveMonthCalendar({ month, today, selected, isLocked, onMonthChange, onToggle }: Props) {
  const cells = useMemo(() => buildCells(month), [month]);

  return (
    <div className="lv-cal">
      <div className="lv-cal-head">
        <button
          type="button"
          className="lv-cal-nav"
          aria-label={t("Timekeeping:Leave:PrevMonth")}
          onClick={() => onMonthChange(month.subtract(1, "month"))}
        >
          <LeftOutlined />
        </button>
        <span className="lv-cal-title">
          {t(MONTH_KEYS[month.month()])} {month.year()}
        </span>
        <button
          type="button"
          className="lv-cal-nav"
          aria-label={t("Timekeeping:Leave:NextMonth")}
          onClick={() => onMonthChange(month.add(1, "month"))}
        >
          <RightOutlined />
        </button>
      </div>

      <div className="lv-cal-grid">
        {WEEKDAY_KEYS.map((key) => (
          <span key={key} className="lv-cal-weekday">
            {t(key)}
          </span>
        ))}
        {cells.map((cell) => {
          const isSelected = selected.has(cell.key);
          const disabled = !cell.inMonth || isLocked(cell.key);
          const className = [
            "lv-cal-day",
            !cell.inMonth && "lv-cal-day--outside",
            cell.key === today && "lv-cal-day--today",
            isSelected && "lv-cal-day--selected",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={cell.key}
              type="button"
              className={className}
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={cell.date.format("DD/MM/YYYY")}
              onClick={() => onToggle(cell.key)}
            >
              <span>{cell.date.date()}</span>
              {isSelected && <ShiftMarks shift={selected.get(cell.key) ?? null} />}
            </button>
          );
        })}
      </div>

      <div className="lv-cal-legend">
        <span><span className="lv-mark lv-mark--morning" />{t("Timekeeping:Leave:MorningShift")}</span>
        <span><span className="lv-mark lv-mark--afternoon" />{t("Timekeeping:Leave:AfternoonShift")}</span>
        <span><span className="lv-mark lv-mark--none" />{t("Timekeeping:Leave:NoShift")}</span>
      </div>
    </div>
  );
}
