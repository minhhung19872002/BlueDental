import { useMemo } from "react";
import { Button, Input } from "antd";
import { SearchOutlined, PlusOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import type { AppointmentDto, AppointmentStatus } from "../types/appointment";

const SLOT_MINUTES = 30;
const DAY_START_H = 6;
const DAY_END_H = 22;
const TOTAL_SLOTS = ((DAY_END_H - DAY_START_H) * 60) / SLOT_MINUTES;
const SLOT_H = 28;
const TIME_COL_W = 52;
const HEADER_H = 60;

function slotTime(slotIndex: number): string {
  const totalMinutes = DAY_START_H * 60 + slotIndex * SLOT_MINUTES;
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const m = (totalMinutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

const APPT_COLORS: Record<AppointmentStatus, { bg: string; border: string; text: string }> = {
  scheduled:  { bg: "#EBF3FE", border: "#1E70E6", text: "#1E70E6" },
  confirmed:  { bg: "#E0F2FE", border: "#2671D8", text: "#2671D8" },
  inProgress: { bg: "#FFEDD5", border: "#F97316", text: "#F97316" },
  completed:  { bg: "#E6F4EA", border: "#10B981", text: "#10B981" },
  cancelled:  { bg: "#FCE8E6", border: "#EF4444", text: "#EF4444" },
  noShow:     { bg: "#F3F4F6", border: "#9CA3AF", text: "#9CA3AF" },
};

const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

interface Props {
  currentDate: Dayjs;
  doctors?: { id: string; name: string }[];
  appointments?: AppointmentDto[];
  keyword?: string;
  onKeywordChange?: (v: string) => void;
  onCreateAppointment?: () => void;
  onCellClick?: (dayOffset: number, slotIndex: number) => void;
  onAppointmentClick?: (appt: AppointmentDto) => void;
}

export function WeekViewCalendar({
  currentDate,
  appointments = [],
  keyword = "",
  onKeywordChange,
  onCreateAppointment,
  onCellClick,
  onAppointmentClick,
}: Props) {
  const weekStart = currentDate.startOf("week");

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day")),
    [weekStart],
  );

  const slots = useMemo(() => Array.from({ length: TOTAL_SLOTS }, (_, i) => i), []);
  const isHourStart = (slotIdx: number) => slotIdx % 2 === 0;
  const today = dayjs();

  // Map dayKey → appointments for each day column
  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, AppointmentDto[]>();
    for (const appt of appointments) {
      const key = dayjs(appt.startTime).format("YYYY-MM-DD");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(appt);
    }
    return map;
  }, [appointments]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, padding: "10px 16px", borderBottom: "1px solid #E5E7EB", background: "#fff" }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Tìm bệnh nhân..."
          value={keyword}
          onChange={(e) => onKeywordChange?.(e.target.value)}
          style={{ width: 220 }}
          allowClear
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreateAppointment}>
          Tạo lịch hẹn
        </Button>
      </div>

      {/* Day header row */}
      <div
        style={{
          display: "flex",
          borderBottom: "2px solid #E5E7EB",
          background: "#fff",
          position: "sticky",
          top: 0,
          zIndex: 10,
          height: HEADER_H,
        }}
      >
        <div style={{ width: TIME_COL_W, flexShrink: 0, background: "#F9FAFB" }} />
        {days.map((day, i) => {
          const isToday = day.isSame(today, "day");
          const dayAppts = appointmentsByDay.get(day.format("YYYY-MM-DD")) ?? [];
          return (
            <div
              key={i}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "6px 4px",
                borderLeft: "1px solid #E5E7EB",
                background: isToday ? "#EBF3FE" : "#fff",
              }}
            >
              <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>{DAY_LABELS[day.day()]}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: isToday ? "#1677ff" : "#1B2A41", lineHeight: 1.2 }}>
                {day.format("DD")}
              </div>
              {dayAppts.length > 0 && (
                <div style={{ fontSize: 10, color: "#1E70E6", fontWeight: 600 }}>{dayAppts.length} lịch</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Grid body */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div style={{ display: "flex", minHeight: TOTAL_SLOTS * SLOT_H }}>
          {/* Time column */}
          <div style={{ width: TIME_COL_W, flexShrink: 0, background: "#F9FAFB", borderRight: "1px solid #E5E7EB" }}>
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
                  borderBottom: isHourStart(slotIdx) ? "1px solid #E5E7EB" : "1px dashed #F3F4F6",
                  boxSizing: "border-box",
                }}
              >
                {isHourStart(slotIdx) && (
                  <span style={{ fontSize: 10, color: "#9CA3AF", fontVariantNumeric: "tabular-nums" }}>
                    {slotTime(slotIdx)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIdx) => {
            const isToday = day.isSame(today, "day");
            const dayKey = day.format("YYYY-MM-DD");
            const dayAppts = appointmentsByDay.get(dayKey) ?? [];

            return (
              <div
                key={dayIdx}
                style={{
                  flex: 1,
                  borderLeft: "1px solid #E5E7EB",
                  background: isToday ? "#FAFBFF" : "#fff",
                  position: "relative",
                }}
              >
                {slots.map((slotIdx) => (
                  <div
                    key={slotIdx}
                    onClick={() => onCellClick?.(dayIdx, slotIdx)}
                    style={{
                      height: SLOT_H,
                      borderBottom: isHourStart(slotIdx) ? "1px solid #E5E7EB" : "1px dashed #F3F4F6",
                      cursor: "pointer",
                      transition: "background 0.1s",
                      boxSizing: "border-box",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = "#EBF3FE";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = "transparent";
                    }}
                  />
                ))}

                {/* Appointment chips for this day */}
                {dayAppts.map((appt) => {
                  const startDjs = dayjs(appt.startTime);
                  const startMinutes = (startDjs.hour() - DAY_START_H) * 60 + startDjs.minute();
                  if (startMinutes < 0) return null;
                  const durationMins = Math.max(30, dayjs(appt.endTime).diff(startDjs, "minute"));
                  const top = (startMinutes / 30) * SLOT_H + 1;
                  const height = Math.max(SLOT_H - 2, (durationMins / 30) * SLOT_H - 2);
                  const colors = APPT_COLORS[appt.status] ?? APPT_COLORS.scheduled;

                  return (
                    <div
                      key={appt.id}
                      onClick={(e) => { e.stopPropagation(); onAppointmentClick?.(appt); }}
                      style={{
                        position: "absolute",
                        top,
                        left: 1,
                        right: 1,
                        height,
                        background: colors.bg,
                        border: `1px solid ${colors.border}`,
                        borderLeft: `3px solid ${colors.border}`,
                        borderRadius: 3,
                        padding: "1px 3px",
                        overflow: "hidden",
                        zIndex: 6,
                        cursor: "pointer",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                      }}
                      title={`${appt.patientName} — ${startDjs.format("HH:mm")}`}
                    >
                      <div style={{ fontSize: 9, fontWeight: 700, color: colors.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {startDjs.format("HH:mm")} {appt.patientName}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
