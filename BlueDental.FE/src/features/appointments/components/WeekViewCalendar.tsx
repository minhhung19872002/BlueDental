import { useMemo } from "react";
import { Button, Input, Select } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import type { DayViewDoctor } from "./DayViewCalendar";

const SLOT_MINUTES = 30;
const DAY_START_H = 6;
const DAY_END_H = 24;
const TOTAL_SLOTS = ((DAY_END_H - DAY_START_H) * 60) / SLOT_MINUTES;
const SLOT_H = 32;
const TIME_COL_W = 56;
const DAY_COL_W = 110;

const VI_WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function slotTime(slotIndex: number): string {
  const totalMinutes = DAY_START_H * 60 + slotIndex * SLOT_MINUTES;
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const m = (totalMinutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

const STATUS_FILTER_BUTTONS = [
  { key: "scheduled",  label: "Đã hẹn",     borderColor: "#1E70E6", bgColor: "#EBF3FE", textColor: "#1E70E6" },
  { key: "arrived",    label: "Đã đến",     borderColor: "#10B981", bgColor: "#E6F4EA", textColor: "#10B981" },
  { key: "cancelled",  label: "Huỷ hẹn",    borderColor: "#EF4444", bgColor: "#FCE8E6", textColor: "#EF4444" },
  { key: "late",       label: "Trễ hẹn",    borderColor: "#F59E0B", bgColor: "#FEF3C7", textColor: "#F59E0B" },
  { key: "temporary",  label: "Lịch tạm",   borderColor: "#F97316", bgColor: "#FFEDD5", textColor: "#F97316" },
  { key: "converted",  label: "Chuyển đổi", borderColor: "#06B6D4", bgColor: "#CFFAFE", textColor: "#06B6D4" },
];

interface Props {
  currentDate: Dayjs;
  doctors?: DayViewDoctor[];
  keyword?: string;
  onKeywordChange?: (v: string) => void;
  onCreateAppointment?: () => void;
  onCellClick?: (dayIndex: number, slotIndex: number) => void;
}

export function WeekViewCalendar({
  currentDate,
  doctors = [],
  keyword = "",
  onKeywordChange,
  onCreateAppointment,
  onCellClick,
}: Props) {
  const weekStart = currentDate.startOf("week");

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day")),
    [weekStart],
  );

  const slots = useMemo(() => Array.from({ length: TOTAL_SLOTS }, (_, i) => i), []);
  const isHourStart = (idx: number) => idx % 2 === 0;
  const today = currentDate.format("YYYY-MM-DD");

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Status filter row */}
      <div style={{ display: "flex", gap: 6, padding: "10px 16px", background: "#fff", borderBottom: "1px solid #E5E7EB", flexWrap: "wrap" }}>
        {STATUS_FILTER_BUTTONS.map((btn) => (
          <button key={btn.key} type="button" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 12px", borderRadius: 20,
            border: `1px solid ${btn.borderColor}`,
            backgroundColor: btn.bgColor, color: btn.textColor,
            fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap",
          }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 18, height: 18, borderRadius: "50%",
              backgroundColor: btn.borderColor, color: "#fff", fontSize: 11, fontWeight: 700,
            }}>0</span>
            {btn.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "#fff", borderBottom: "1px solid #E5E7EB", flexWrap: "wrap" }}>
        <Input
          prefix={<SearchOutlined style={{ color: "#9CA3AF" }} />}
          placeholder="Tìm kiếm"
          value={keyword}
          onChange={(e) => onKeywordChange?.(e.target.value)}
          allowClear
          style={{ maxWidth: 200 }}
        />
        <Select
          placeholder="Chọn bác sĩ"
          allowClear
          style={{ minWidth: 160 }}
          options={doctors.map((d) => ({ value: d.id, label: d.name }))}
        />
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <Button size="small">Xuất File</Button>
          <Button type="primary" size="small" style={{ background: "#2671D8" }} onClick={onCreateAppointment}>
            Tạo lịch hẹn mới
          </Button>
          <Button size="small">Tạo lịch tạm</Button>
        </div>
      </div>

      {/* Week grid */}
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 320px)" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `${TIME_COL_W}px repeat(7, ${DAY_COL_W}px)`,
          minWidth: TIME_COL_W + 7 * DAY_COL_W,
        }}>
          {/* Header */}
          <div style={{
            position: "sticky", top: 0, zIndex: 10,
            background: "#F8FAFC", borderBottom: "2px solid #E5E7EB",
            borderRight: "1px solid #E5E7EB",
            padding: "8px 4px", fontSize: 11, color: "#9CA3AF",
            textAlign: "center", fontWeight: 600,
          }}>
            Giờ
          </div>
          {weekDays.map((day, i) => {
            const isToday = day.format("YYYY-MM-DD") === today;
            return (
              <div key={i} style={{
                position: "sticky", top: 0, zIndex: 10,
                background: isToday ? "#EBF3FE" : "#F8FAFC",
                borderBottom: "2px solid #E5E7EB",
                borderLeft: "1px solid #E5E7EB",
                padding: "6px 4px", textAlign: "center",
              }}>
                <div style={{ fontSize: 11, color: isToday ? "#1E70E6" : "#6B7280", fontWeight: 600 }}>
                  {VI_WEEKDAYS[day.day()]}
                </div>
                <div style={{
                  fontSize: 16, fontWeight: 700,
                  color: isToday ? "#1E70E6" : "#1B2A41",
                  lineHeight: 1.2,
                }}>
                  {day.format("DD")}
                </div>
                <div style={{ fontSize: 10, color: "#9CA3AF" }}>{day.format("MM/YYYY")}</div>
              </div>
            );
          })}

          {/* Slots */}
          {slots.map((slotIdx) => (
            <>
              <div key={`t-${slotIdx}`} style={{
                borderBottom: isHourStart(slotIdx + 1) ? "1px solid #E5E7EB" : "1px dashed #F3F4F6",
                borderRight: "1px solid #E5E7EB",
                height: SLOT_H,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11,
                color: isHourStart(slotIdx) ? "#374151" : "#D1D5DB",
                fontWeight: isHourStart(slotIdx) ? 500 : 400,
                background: "#FAFAFA",
              }}>
                {isHourStart(slotIdx) ? slotTime(slotIdx) : ""}
              </div>
              {weekDays.map((day, dayIdx) => {
                const isToday = day.format("YYYY-MM-DD") === today;
                return (
                  <div
                    key={`c-${slotIdx}-${dayIdx}`}
                    onClick={() => onCellClick?.(dayIdx, slotIdx)}
                    style={{
                      borderBottom: isHourStart(slotIdx + 1) ? "1px solid #E5E7EB" : "1px dashed #F3F4F6",
                      borderLeft: "1px solid #E5E7EB",
                      height: SLOT_H,
                      background: isToday
                        ? (slotIdx % 4 < 2 ? "#F0F7FF" : "#EBF3FE")
                        : (slotIdx % 4 < 2 ? "#FAFAFA" : "#fff"),
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#DBEAFE"; }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = isToday
                        ? (slotIdx % 4 < 2 ? "#F0F7FF" : "#EBF3FE")
                        : (slotIdx % 4 < 2 ? "#FAFAFA" : "#fff");
                    }}
                  />
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}
