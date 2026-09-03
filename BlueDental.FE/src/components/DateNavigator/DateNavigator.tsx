import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "antd";
import { LeftOutlined, RightOutlined, CalendarOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import "./DateNavigator.css";

export type DateNavigatorMode = "day" | "week" | "month";

interface DateNavigatorProps {
  value: Dayjs;
  mode: DateNavigatorMode;
  onChange: (date: Dayjs) => void;
  className?: string;
  style?: React.CSSProperties;
}

function stepDate(date: Dayjs, mode: DateNavigatorMode, dir: 1 | -1): Dayjs {
  const unit = mode === "day" ? "day" : mode === "week" ? "week" : "month";
  return dir === 1 ? date.add(1, unit) : date.subtract(1, unit);
}

function formatDisplay(date: Dayjs, mode: DateNavigatorMode): string {
  if (mode === "day") return date.format("DD/MM/YYYY");
  if (mode === "week") {
    return `${date.startOf("week").format("DD/MM")} - ${date.endOf("week").format("DD/MM/YYYY")}`;
  }
  return date.format("MM/YYYY");
}

const WEEKDAYS = ["Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7", "CN"];

const MONTH_NAMES = [
  "Tháng Một", "Tháng Hai", "Tháng Ba", "Tháng Tư",
  "Tháng Năm", "Tháng Sáu", "Tháng Bảy", "Tháng Tám",
  "Tháng Chín", "Tháng Mười", "Tháng Mười Một", "Tháng Mười Hai",
];

const MONTHS_SHORT = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4",
  "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8",
  "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

function getCalendarDays(year: number, month: number) {
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

function CalendarPanel({
  value,
  mode,
  onSelect,
  onReset,
}: {
  value: Dayjs;
  mode: "day" | "week";
  onSelect: (d: Dayjs) => void;
  onReset: () => void;
}) {
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
          <LeftOutlined />
        </button>
        <span className="date-nav-panel-title">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button type="button" className="date-nav-panel-nav" onClick={handleNext}>
          <RightOutlined />
        </button>
      </div>

      <div className="date-nav-weekdays">
        {WEEKDAYS.map((wd) => (
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

          if (mode === "week") {
            const inSelectedWeek =
              (d.isAfter(selectedWeekStart, "day") || d.isSame(selectedWeekStart, "day")) &&
              (d.isBefore(selectedWeekEnd, "day") || d.isSame(selectedWeekEnd, "day"));

            const weekStartKey = d.startOf("week").format("YYYY-MM-DD");
            const inHoveredWeek = hoveredWeekStart === weekStartKey && !inSelectedWeek;
            const isHoveredDay = hoveredDay === d.format("YYYY-MM-DD") && !inSelectedWeek;

            let cls = "date-nav-day";
            if (!isCurrentMonth) cls += " outside";
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
          if (isSelected) cls += " selected";
          if (isToday && !isSelected) cls += " today";

          return (
            <button
              key={i}
              type="button"
              className={cls}
              onClick={() => onSelect(d)}
            >
              {d.date()}
            </button>
          );
        })}
      </div>

      <div className="date-nav-panel-footer">
        <button type="button" className="date-nav-reset" onClick={onReset}>
          {mode === "week" ? "Tuần này" : "Đặt lại"}
        </button>
      </div>
    </div>
  );
}

function MonthPickerPanel({
  value,
  onSelect,
}: {
  value: Dayjs;
  onSelect: (d: Dayjs) => void;
}) {
  const [viewYear, setViewYear] = useState(value.year());

  return (
    <div className="date-nav-panel">
      <div className="date-nav-panel-header">
        <button
          type="button"
          className="date-nav-panel-nav"
          onClick={() => setViewYear((y) => y - 1)}
        >
          <LeftOutlined />
        </button>
        <span className="date-nav-panel-title">{viewYear}</span>
        <button
          type="button"
          className="date-nav-panel-nav"
          onClick={() => setViewYear((y) => y + 1)}
        >
          <RightOutlined />
        </button>
      </div>
      <div className="date-nav-month-grid">
        {MONTHS_SHORT.map((label, i) => {
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

export const DateNavigator: React.FC<DateNavigatorProps> = ({
  value,
  mode,
  onChange,
  className,
  style,
}) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const rafRef = useRef(0);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !dropdownRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropRect = dropdownRef.current.getBoundingClientRect();
    const dropW = dropRect.width || 296;
    const dropH = dropRect.height || 340;
    const gap = 4;

    let top = rect.bottom + gap;
    if (top + dropH > window.innerHeight) {
      top = rect.top - dropH - gap;
    }
    if (top < 8) top = 8;

    let left = rect.left + rect.width / 2 - dropW / 2;
    if (left + dropW > window.innerWidth - 8) left = window.innerWidth - dropW - 8;
    if (left < 8) left = 8;

    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    rafRef.current = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(rafRef.current);
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open || !dropdownRef.current) return;
    const ro = new ResizeObserver(() => updatePosition());
    ro.observe(dropdownRef.current);
    return () => ro.disconnect();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const scheduleUpdate = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updatePosition);
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", scheduleUpdate, true);
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", scheduleUpdate, true);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [open, updatePosition]);

  const handleSelect = (d: Dayjs) => {
    onChange(d);
    setOpen(false);
  };

  const handleReset = () => {
    onChange(dayjs());
    setOpen(false);
  };

  return (
    <div className={`date-navigator ${className ?? ""}`} style={style}>
      <Button
        className="date-navigator-arrow"
        icon={<LeftOutlined />}
        onClick={() => onChange(stepDate(value, mode, -1))}
      />

      <div
        ref={triggerRef}
        className="date-navigator-display-wrapper"
        onClick={() => setOpen((v) => !v)}
      >
        <CalendarOutlined className="date-navigator-icon" />
        <span className="date-navigator-label">
          {formatDisplay(value, mode)}
        </span>
      </div>

      {open && createPortal(
        <div ref={dropdownRef} className="date-nav-dropdown" style={{ top: pos.top, left: pos.left }}>
          {mode === "month" ? (
            <MonthPickerPanel value={value} onSelect={handleSelect} />
          ) : (
            <CalendarPanel
              value={value}
              mode={mode}
              onSelect={handleSelect}
              onReset={handleReset}
            />
          )}
        </div>,
        document.body,
      )}

      <Button
        className="date-navigator-arrow"
        icon={<RightOutlined />}
        onClick={() => onChange(stepDate(value, mode, 1))}
      />
    </div>
  );
};
