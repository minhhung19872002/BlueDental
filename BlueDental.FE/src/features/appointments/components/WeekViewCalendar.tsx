import { useMemo } from "react";
import { Button, Input } from "antd";
import { SearchOutlined, PlusOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";

import { useAppointmentList } from "../api/appointmentQueries";
import type { AppointmentDto, AppointmentStatus } from "../types/appointment";
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
  onSelectAppointment?: (id: string) => void;
}

/** Same card colours as the day grid, so a status reads identically in both. */
const WEEK_CARD_LOOK: Record<AppointmentStatus, { bg: string; border: string; text: string }> = {
  scheduled:  { bg: "#eaf0fa", border: "#1c3566", text: "#1c3566" },
  confirmed:  { bg: "#e6f5ef", border: "#1f8a63", text: "#166848" },
  inProgress: { bg: "#fdf3e2", border: "#dd9426", text: "#9a6412" },
  completed:  { bg: "#e6f5ef", border: "#25a97a", text: "#166848" },
  cancelled:  { bg: "#fdeeee", border: "#ef4d4d", text: "#c33" },
  noShow:     { bg: "#efedf6", border: "#6f63a3", text: "#544a80" },
};

export function WeekViewCalendar({
  currentDate,
  keyword = "",
  onKeywordChange,
  onCreateAppointment,
  onCellClick,
  onSelectAppointment,
}: Props) {
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

  /** Bookings per day column and half-hour slot; a slot can hold several. */
  const bookingsByCell = useMemo(() => {
    const map = new Map<string, AppointmentDto[]>();

    for (const appointment of appointments?.items ?? []) {
      const start = dayjs(appointment.startTime);
      const dayIndex = start.diff(weekStart.startOf("day"), "day");
      const slotIndex = Math.floor(
        (start.hour() * 60 + start.minute() - DAY_START_H * 60) / SLOT_MINUTES,
      );

      if (dayIndex < 0 || dayIndex >= 7 || slotIndex < 0 || slotIndex >= TOTAL_SLOTS) {
        continue;
      }

      const key = `${dayIndex}-${slotIndex}`;
      const bucket = map.get(key);
      if (bucket) bucket.push(appointment);
      else map.set(key, [appointment]);
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
                      overflow: "hidden",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = "#eaf0fa";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = "transparent";
                    }}
                  >
                    {(() => {
                      const inSlot = bookingsByCell.get(`${dayIdx}-${slotIdx}`) ?? [];
                      // The row is one slot tall, so cards share its width rather
                      // than stacking on top of each other; the tail collapses.
                      const shown = inSlot.slice(0, 2);
                      const hidden = inSlot.length - shown.length;

                      if (inSlot.length === 0) return null;

                      return (
                        <div style={{ display: "flex", alignItems: "stretch", height: "100%" }}>
                          {shown.map((booking) => {
                            const look = WEEK_CARD_LOOK[booking.status];
                            const title =
                              booking.patientName?.trim() ||
                              booking.reason?.trim() ||
                              t("Lịch hẹn");

                            return (
                              <div
                                key={booking.id}
                                role="button"
                                tabIndex={0}
                                title={`${dayjs(booking.startTime).format("HH:mm")} · ${title}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onSelectAppointment?.(booking.id);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    onSelectAppointment?.(booking.id);
                                  }
                                }}
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  margin: "1px 2px",
                                  padding: "1px 4px",
                                  borderRadius: 4,
                                  borderLeft: `3px solid ${look.border}`,
                                  background: look.bg,
                                  color: look.text,
                                  fontSize: 10,
                                  lineHeight: "12px",
                                  fontWeight: 600,
                                  overflow: "hidden",
                                  whiteSpace: "nowrap",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {title}
                              </div>
                            );
                          })}
                          {hidden > 0 && (
                            <span
                              title={inSlot
                                .slice(2)
                                .map((b) => b.patientName || t("Lịch hẹn"))
                                .join(", ")}
                              style={{
                                alignSelf: "center",
                                margin: "0 3px 0 1px",
                                padding: "0 4px",
                                borderRadius: 8,
                                background: "#e2e8f0",
                                color: "#41505f",
                                fontSize: 9,
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                              }}
                            >
                              +{hidden}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
