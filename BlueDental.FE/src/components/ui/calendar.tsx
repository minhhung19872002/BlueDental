import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import dayjs, { type Dayjs } from "dayjs";
import { t } from "@/lib/i18n";

function getWeekdays() {
  return [t("Th 2"), t("Th 3"), t("Th 4"), t("Th 5"), t("Th 6"), t("Th 7"), t("CN")];
}

function getMonthNames() {
  return [
    t("Tháng Một"), t("Tháng Hai"), t("Tháng Ba"), t("Tháng Tư"),
    t("Tháng Năm"), t("Tháng Sáu"), t("Tháng Bảy"), t("Tháng Tám"),
    t("Tháng Chín"), t("Tháng Mười"), t("Tháng Mười Một"), t("Tháng Mười Hai"),
  ];
}

function getMonthsShort() {
  return [
    t("Tháng 1"), t("Tháng 2"), t("Tháng 3"), t("Tháng 4"),
    t("Tháng 5"), t("Tháng 6"), t("Tháng 7"), t("Tháng 8"),
    t("Tháng 9"), t("Tháng 10"), t("Tháng 11"), t("Tháng 12"),
  ];
}

export function getCalendarDays(year: number, month: number): Dayjs[] {
  const firstDay = dayjs().year(year).month(month).startOf("month");
  const startOfWeek = firstDay.startOf("week");
  const days: Dayjs[] = [];
  let current = startOfWeek;
  for (let i = 0; i < 42; i++) {
    days.push(current);
    current = current.add(1, "day");
  }
  return days;
}

interface CalendarPanelProps {
  value: Dayjs;
  mode?: "day" | "week";
  onSelect: (d: Dayjs) => void;
  onReset?: () => void;
  resetLabel?: string;
  minDate?: Dayjs;
  maxDate?: Dayjs;
}

export function CalendarPanel({
  value,
  mode = "day",
  onSelect,
  onReset,
  resetLabel,
  minDate,
  maxDate,
}: CalendarPanelProps) {
  const [viewYear, setViewYear] = useState(value.year());
  const [viewMonth, setViewMonth] = useState(value.month());
  const [hoveredWeekStart, setHoveredWeekStart] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const days = getCalendarDays(viewYear, viewMonth);
  const today = dayjs().startOf("day");

  const selectedWeekStart = value.startOf("week");
  const selectedWeekEnd = value.endOf("week");

  const handlePrev = () => {
    const d = dayjs().year(viewYear).month(viewMonth).subtract(1, "month");
    setViewYear(d.year());
    setViewMonth(d.month());
  };

  const handleNext = () => {
    const d = dayjs().year(viewYear).month(viewMonth).add(1, "month");
    setViewYear(d.year());
    setViewMonth(d.month());
  };

  return (
    <div className="date-nav-panel">
      <div className="date-nav-panel-header">
        <button type="button" className="date-nav-panel-nav" onClick={handlePrev}>
          <ChevronLeft className="size-4" />
        </button>
        <span className="date-nav-panel-title">
          {getMonthNames()[viewMonth]} {viewYear}
        </span>
        <button type="button" className="date-nav-panel-nav" onClick={handleNext}>
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="date-nav-weekdays">
        {getWeekdays().map((wd) => (
          <div key={wd} className="date-nav-weekday">{wd}</div>
        ))}
      </div>

      <div
        className="date-nav-days"
        onMouseLeave={() => { if (mode === "week") { setHoveredWeekStart(null); setHoveredDay(null); } }}
      >
        {days.map((d, i) => {
          const isCurrentMonth = d.month() === viewMonth;
          const isToday = d.isSame(today, "day");
          const colIndex = i % 7;
          const isDisabled =
            (minDate && d.isBefore(minDate, "day")) ||
            (maxDate && d.isAfter(maxDate, "day"));

          if (mode === "week") {
            const inSelectedWeek =
              (d.isAfter(selectedWeekStart, "day") || d.isSame(selectedWeekStart, "day")) &&
              (d.isBefore(selectedWeekEnd, "day") || d.isSame(selectedWeekEnd, "day"));

            const weekStartKey = d.startOf("week").format("YYYY-MM-DD");
            const inHoveredWeek = hoveredWeekStart === weekStartKey && !inSelectedWeek;
            const isHoveredDay = hoveredDay === d.format("YYYY-MM-DD") && !inSelectedWeek;

            let cls = "date-nav-day";
            if (!isCurrentMonth) cls += " outside";
            if (isDisabled) cls += " disabled";
            if (inSelectedWeek) {
              cls += " week-selected";
              if (colIndex === 0) cls += " week-start";
              if (colIndex === 6) cls += " week-end";
            } else if (inHoveredWeek) {
              cls += " week-hovered";
              if (colIndex === 0) cls += " week-start";
              if (colIndex === 6) cls += " week-end";
              if (isHoveredDay) cls += " day-hovered";
            }
            if (isToday && !inSelectedWeek) cls += " today";

            return (
              <button
                key={i}
                type="button"
                className={cls}
                disabled={isDisabled}
                onClick={() => onSelect(d)}
                onMouseEnter={() => {
                  setHoveredWeekStart(weekStartKey);
                  setHoveredDay(d.format("YYYY-MM-DD"));
                }}
              >
                {d.date()}
              </button>
            );
          }

          const isSelected = d.isSame(value, "day");
          let cls = "date-nav-day";
          if (!isCurrentMonth) cls += " outside";
          if (isDisabled) cls += " disabled";
          if (isSelected) cls += " selected";
          if (isToday && !isSelected) cls += " today";

          return (
            <button
              key={i}
              type="button"
              className={cls}
              disabled={isDisabled}
              onClick={() => onSelect(d)}
            >
              {d.date()}
            </button>
          );
        })}
      </div>

      {onReset && (
        <div className="date-nav-panel-footer">
          <button type="button" className="date-nav-reset" onClick={onReset}>
            {resetLabel ?? (mode === "week" ? t("Tuần này") : t("Hôm nay"))}
          </button>
        </div>
      )}
    </div>
  );
}

interface MonthPickerPanelProps {
  value: Dayjs;
  onSelect: (d: Dayjs) => void;
}

interface YearPickerPanelProps {
  value: Dayjs;
  onSelect: (d: Dayjs) => void;
}

export function YearPickerPanel({ value, onSelect }: YearPickerPanelProps) {
  const startYear = Math.floor(value.year() / 12) * 12;
  const [rangeStart, setRangeStart] = useState(startYear);

  const years = Array.from({ length: 12 }, (_, i) => rangeStart + i);

  return (
    <div className="date-nav-panel">
      <div className="date-nav-panel-header">
        <button
          type="button"
          className="date-nav-panel-nav"
          onClick={() => setRangeStart((y) => y - 12)}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="date-nav-panel-title">
          {rangeStart} – {rangeStart + 11}
        </span>
        <button
          type="button"
          className="date-nav-panel-nav"
          onClick={() => setRangeStart((y) => y + 12)}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="date-nav-month-grid">
        {years.map((y) => {
          const isActive = value.year() === y;
          return (
            <button
              key={y}
              type="button"
              className={`date-nav-month-cell ${isActive ? "active" : ""}`}
              onClick={() => onSelect(dayjs().year(y).startOf("year"))}
            >
              {y}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MonthPickerPanel({ value, onSelect }: MonthPickerPanelProps) {
  const [viewYear, setViewYear] = useState(value.year());

  return (
    <div className="date-nav-panel">
      <div className="date-nav-panel-header">
        <button
          type="button"
          className="date-nav-panel-nav"
          onClick={() => setViewYear((y) => y - 1)}
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="date-nav-panel-title">{viewYear}</span>
        <button
          type="button"
          className="date-nav-panel-nav"
          onClick={() => setViewYear((y) => y + 1)}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="date-nav-month-grid">
        {getMonthsShort().map((label, i) => {
          const isActive = value.year() === viewYear && value.month() === i;
          return (
            <button
              key={i}
              type="button"
              className={`date-nav-month-cell ${isActive ? "active" : ""}`}
              onClick={() =>
                onSelect(dayjs().year(viewYear).month(i).startOf("month"))
              }
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
