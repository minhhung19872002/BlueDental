// AppointmentCalendar — week-view grid showing daily appointment slots.
// Each column is a day; each row is a 30-minute slot from 08:00–18:00.
// Appointments are rendered as colored blocks spanning their time range.

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import dayjs from "dayjs";
import type { Appointment } from "../types/appointment";
import { t } from "@/lib/i18n";

const SLOT_MINUTES = 30;
const DAY_START = 8 * 60; // 08:00 in minutes
const DAY_END = 18 * 60; // 18:00 in minutes
const SLOTS = (DAY_END - DAY_START) / SLOT_MINUTES;

const dayNames = () => [t("Thứ 2"), t("Thứ 3"), t("Thứ 4"), t("Thứ 5"), t("Thứ 6"), t("Thứ 7"), "CN"];

function formatSlotTime(slotIndex: number): string {
  const totalMinutes = DAY_START + slotIndex * SLOT_MINUTES;
  const h = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (totalMinutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

interface Props {
  weekStart: dayjs.Dayjs;
  appointments?: Appointment[];
  onWeekChange: (direction: -1 | 1) => void;
  onSlotClick?: (date: string, slotStart: string) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
}

export function AppointmentCalendar({
  weekStart,
  appointments = [],
  onWeekChange,
  onSlotClick,
  onAppointmentClick,
}: Props) {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day")),
    [weekStart],
  );

  const today = dayjs().format("YYYY-MM-DD");
  const SLOT_H = 40; // px per 30-min slot

  function getAppointmentsForDayAndSlot(
    day: dayjs.Dayjs,
    slotIndex: number,
  ): Appointment[] {
    const slotStartMinutes = DAY_START + slotIndex * SLOT_MINUTES;
    return appointments.filter((appt) => {
      const apptDay = dayjs(appt.startTime).format("YYYY-MM-DD");
      if (apptDay !== day.format("YYYY-MM-DD")) return false;
      const apptStartMinutes =
        dayjs(appt.startTime).hour() * 60 + dayjs(appt.startTime).minute();
      // Show appointment in the slot where it starts
      return apptStartMinutes >= slotStartMinutes &&
        apptStartMinutes < slotStartMinutes + SLOT_MINUTES;
    });
  }

  return (
    <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #e2e8f0" }}>
      {/* Week navigation header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onWeekChange(-1)}
        >
          <ChevronLeft size={14} />
        </Button>
        <span style={{ fontWeight: 700, fontSize: 14 }}>
          {weekStart.format("DD/MM/YYYY")} –{" "}
          {weekStart.add(6, "day").format("DD/MM/YYYY")}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onWeekChange(1)}
        >
          <ChevronRight size={14} />
        </Button>
      </div>

      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: "60px repeat(7, 1fr)" }}>
        <div style={{ borderRight: "1px solid #eef2f7" }} />
        {days.map((day, i) => {
          const isToday = day.format("YYYY-MM-DD") === today;
          return (
            <div
              key={i}
              style={{
                padding: "10px 8px",
                textAlign: "center",
                borderRight: "1px solid #eef2f7",
                borderBottom: "1px solid #e2e8f0",
                background: isToday ? "#eaf0fa" : "#f4f6fa",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#6f7c90",
                  textTransform: "uppercase",
                }}
              >
                {dayNames()[i]}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: isToday ? "#1c3566" : "#101c2c",
                }}
              >
                {day.format("D")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time slots */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "60px repeat(7, 1fr)",
          overflowY: "auto",
          maxHeight: 480,
        }}
      >
        {Array.from({ length: SLOTS }, (_, slotIndex) => (
          <>
            {/* Time label */}
            <div
              key={`label-${slotIndex}`}
              style={{
                height: SLOT_H,
                borderRight: "1px solid #eef2f7",
                borderBottom: "1px solid #eef2f7",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                paddingTop: 4,
                fontSize: 10,
                color: "#98a4b4",
                flexShrink: 0,
              }}
            >
              {slotIndex % 2 === 0 ? formatSlotTime(slotIndex) : ""}
            </div>

            {/* Day cells */}
            {days.map((day, dayIndex) => {
              const slotAppts = getAppointmentsForDayAndSlot(day, slotIndex);
              return (
                <div
                  key={`cell-${slotIndex}-${dayIndex}`}
                  onClick={() =>
                    onSlotClick?.(
                      day.format("YYYY-MM-DD"),
                      formatSlotTime(slotIndex),
                    )
                  }
                  style={{
                    height: SLOT_H,
                    borderRight: "1px solid #eef2f7",
                    borderBottom: "1px solid #eef2f7",
                    position: "relative",
                    cursor: "pointer",
                    background:
                      day.format("YYYY-MM-DD") === today
                        ? "#F0F7FF"
                        : "transparent",
                    padding: 2,
                  }}
                >
                  {slotAppts.map((appt) => (
                    <div
                      key={appt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAppointmentClick?.(appt);
                      }}
                      style={{
                        background: appt.statusColor + "22",
                        border: `1.5px solid ${appt.statusColor}`,
                        borderRadius: 6,
                        padding: "2px 6px",
                        fontSize: 10,
                        fontWeight: 600,
                        color: appt.statusColor,
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        cursor: "pointer",
                        marginBottom: 2,
                      }}
                      title={`${appt.patientName} — ${appt.reason ?? t("Khám định kỳ")}`}
                    >
                      {appt.patientName}
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
