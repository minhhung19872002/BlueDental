import { useMemo } from "react";
import { Button, Input } from "antd";
import { SearchOutlined, PlusOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";

import { useAppointmentList } from "../api/appointmentQueries";
import { t } from "@/lib/i18n";

const SLOT_MINUTES = 30;
const DAY_START_H = 6;
const DAY_END_H = 22;
const TOTAL_SLOTS = ((DAY_END_H - DAY_START_H) * 60) / SLOT_MINUTES;
const SLOT_H = 28;
const TIME_COL_W = 52;

function slotTime(slotIndex: number): string {
  const totalMinutes = DAY_START_H * 60 + slotIndex * SLOT_MINUTES;
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const m = (totalMinutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

interface Props {
  currentDate: Dayjs;
  doctors?: { id: string; name: string }[];
  keyword?: string;
  onKeywordChange?: (v: string) => void;
  onCreateAppointment?: () => void;
  onCellClick?: (dayOffset: number, slotIndex: number) => void;
}

export function WeekViewCalendar({ currentDate, keyword = "", onKeywordChange, onCreateAppointment, onCellClick }: Props) {
  const weekStart = currentDate.startOf("week");

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day")),
    [weekStart],
  );

  const slots = useMemo(() => Array.from({ length: TOTAL_SLOTS }, (_, i) => i), []);

  const { data: appointments } = useAppointmentList({
    fromDate: weekStart.format("YYYY-MM-DD"),
    toDate: weekStart.add(6, "day").format("YYYY-MM-DD"),
    maxResultCount: 500,
  });

  /** One booking per day column and half-hour slot. */
  const bookingsByCell = useMemo(() => {
    const map = new Map<string, string>();

    for (const appointment of appointments?.items ?? []) {
      const start = dayjs(appointment.startTime);
      const dayIndex = start.diff(weekStart.startOf("day"), "day");
      const slotIndex = Math.floor(
        (start.hour() * 60 + start.minute() - DAY_START_H * 60) / SLOT_MINUTES,
      );

      if (dayIndex >= 0 && dayIndex < 7 && slotIndex >= 0 && slotIndex < TOTAL_SLOTS) {
        map.set(`${dayIndex}-${slotIndex}`, appointment.patientName);
      }
    }

    return map;
  }, [appointments, weekStart]);
  const isHourStart = (slotIdx: number) => slotIdx % 2 === 0;
  const today = dayjs();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px", borderBottom: "1px solid #e2e8f0", background: "#fff" }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder={t("Tìm bệnh nhân...")}
          value={keyword}
          onChange={(e) => onKeywordChange?.(e.target.value)}
          style={{ width: 220 }}
          allowClear
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreateAppointment}>
          {t("Tạo lịch hẹn")}
        </Button>
      </div>

      {/* Day header row */}
      <div
        style={{
          display: "flex",
          borderBottom: "2px solid #e2e8f0",
          background: "#fff",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        {/* Time gutter */}
        <div style={{ width: TIME_COL_W, flexShrink: 0, background: "#F9FAFB" }} />
        {days.map((day, i) => {
          const isToday = day.isSame(today, "day");
          return (
            <div
              key={i}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "8px 4px",
                borderLeft: "1px solid #e2e8f0",
                background: isToday ? "#eaf0fa" : "#fff",
              }}
            >
              <div style={{ fontSize: 11, color: "#98a4b4", fontWeight: 500 }}>{DAY_LABELS[day.day()]}</div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: isToday ? "#1c3566" : "#101c2c",
                  lineHeight: 1.2,
                }}
              >
                {day.format("DD")}
              </div>
              <div style={{ fontSize: 11, color: "#98a4b4" }}>{day.format("MM/YYYY")}</div>
            </div>
          );
        })}
      </div>

      {/* Grid body */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div style={{ display: "flex", minHeight: TOTAL_SLOTS * SLOT_H }}>
          {/* Time column */}
          <div style={{ width: TIME_COL_W, flexShrink: 0, background: "#F9FAFB", borderRight: "1px solid #e2e8f0" }}>
            {slots.map((slotIdx) => (
              <div
                key={slotIdx}
                style={{
                  height: SLOT_H,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "flex-end",
                  paddingRight: 6,
                  paddingTop: 2,
                  borderBottom: isHourStart(slotIdx) ? "1px solid #e2e8f0" : "1px dashed #f4f6fa",
                  boxSizing: "border-box",
                }}
              >
                {isHourStart(slotIdx) && (
                  <span style={{ fontSize: 10, color: "#98a4b4", fontVariantNumeric: "tabular-nums" }}>
                    {slotTime(slotIdx)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIdx) => {
            const isToday = day.isSame(today, "day");
            return (
              <div
                key={dayIdx}
                style={{
                  flex: 1,
                  borderLeft: "1px solid #e2e8f0",
                  background: isToday ? "#FAFBFF" : "#fff",
                  position: "relative",
                }}
              >
                {slots.map((slotIdx) => (
                  <div
                    key={slotIdx}
                    onClick={() => onCellClick?.(dayIdx, slotIdx)}
                    data-testid={
                      bookingsByCell.has(`${dayIdx}-${slotIdx}`) ? "calendar-booking" : undefined
                    }
                    style={{
                      height: SLOT_H,
                      borderBottom: isHourStart(slotIdx) ? "1px solid #e2e8f0" : "1px dashed #f4f6fa",
                      cursor: "pointer",
                      transition: "background 0.1s",
                      boxSizing: "border-box",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = "#eaf0fa";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = "transparent";
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
