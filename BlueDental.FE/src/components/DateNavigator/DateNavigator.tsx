import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { CalendarPanel, MonthPickerPanel, YearPickerPanel } from "@/components/ui/calendar";
import { t } from "@/lib/i18n";
import "./DateNavigator.css";

export type DateNavigatorMode = "day" | "week" | "month" | "year";

interface DateNavigatorProps {
  value: Dayjs;
  mode: DateNavigatorMode;
  onChange: (date: Dayjs) => void;
  className?: string;
  style?: React.CSSProperties;
}

function stepDate(date: Dayjs, mode: DateNavigatorMode, dir: 1 | -1): Dayjs {
  const unit = mode === "day" ? "day" : mode === "week" ? "week" : mode === "month" ? "month" : "year";
  return dir === 1 ? date.add(1, unit) : date.subtract(1, unit);
}

function formatDisplay(date: Dayjs, mode: DateNavigatorMode): string {
  if (mode === "day") return date.format("DD/MM/YYYY");
  if (mode === "week") {
    return `${date.startOf("week").format("DD/MM")} - ${date.endOf("week").format("DD/MM/YYYY")}`;
  }
  if (mode === "month") return date.format("MM/YYYY");
  return date.format("YYYY");
}

export const DateNavigator: React.FC<DateNavigatorProps> = ({
  value,
  mode,
  onChange,
  className,
  style,
}) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

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
      <button
        type="button"
        className="date-navigator-arrow"
        onClick={() => onChange(stepDate(value, mode, -1))}
      >
        <ChevronLeft className="size-4" />
      </button>

      <div
        ref={triggerRef}
        className="date-navigator-display-wrapper"
        onClick={() => setOpen((v) => !v)}
      >
        <Calendar className="date-navigator-icon size-4" />
        <span className="date-navigator-label">
          {formatDisplay(value, mode)}
        </span>
      </div>

      {open && (
        <div ref={dropdownRef} className="date-nav-dropdown">
          {mode === "year" ? (
            <YearPickerPanel value={value} onSelect={handleSelect} />
          ) : mode === "month" ? (
            <MonthPickerPanel value={value} onSelect={handleSelect} />
          ) : (
            <CalendarPanel
              value={value}
              mode={mode}
              onSelect={handleSelect}
              onReset={handleReset}
              resetLabel={mode === "week" ? t("Tuần này") : t("Đặt lại")}
            />
          )}
        </div>
      )}

      <button
        type="button"
        className="date-navigator-arrow"
        onClick={() => onChange(stepDate(value, mode, 1))}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
};
