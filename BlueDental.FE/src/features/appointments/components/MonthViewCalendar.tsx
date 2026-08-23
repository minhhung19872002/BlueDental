import { useMemo } from "react";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import type { AppointmentDto } from "../types/appointment";


const STATUS_DOT_COLOR: Record<string, string> = {
  scheduled:  "#1677ff",
  confirmed:  "#0ea5e9",
  inProgress: "#f97316",
  completed:  "#22c55e",
  cancelled:  "#ef4444",
  noShow:     "#9ca3af",
};

interface Props {
  currentDate: Dayjs;
  appointments?: AppointmentDto[];
  onDayClick?: (day: Dayjs) => void;
  onAppointmentClick?: (appt: AppointmentDto) => void;
  onCreateAppointment?: () => void;
}

export function MonthViewCalendar({ currentDate, appointments = [], onDayClick, onAppointmentClick: _onAppointmentClick, onCreateAppointment: _onCreateAppointment }: Props) {
  const { t } = useTranslation();
  const DAY_LABELS = [
    t("calendar.sun"), t("calendar.mon"), t("calendar.tue"), t("calendar.wed"),
    t("calendar.thu"), t("calendar.fri"), t("calendar.sat"),
  ];
  const monthStart = currentDate.startOf("month");
  const monthEnd = currentDate.endOf("month");
  const calStart = monthStart.startOf("week");
  const calEnd = monthEnd.endOf("week");
  const today = dayjs();

  const weeks: Dayjs[][] = [];
  let current = calStart;
  while (current.isBefore(calEnd) || current.isSame(calEnd, "day")) {
    const week: Dayjs[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(current);
      current = current.add(1, "day");
    }
    weeks.push(week);
  }

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, AppointmentDto[]>();
    for (const appt of appointments) {
      const key = dayjs(appt.startTime).format("YYYY-MM-DD");
      const list = map.get(key) ?? [];
      list.push(appt);
      map.set(key, list);
    }
    return map;
  }, [appointments]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "auto" }}>
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "2px solid #E5E7EB", background: "#F9FAFB" }}>
        {DAY_LABELS.map((d) => (
          <div
            key={d}
            style={{
              padding: "8px 0",
              textAlign: "center",
              fontSize: 12,
              fontWeight: 600,
              color: d === "CN" ? "#EF4444" : "#5A6B82",
              borderRight: "1px solid #E5E7EB",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {weeks.map((week, wi) => (
        <div
          key={wi}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            flex: 1,
            minHeight: 90,
          }}
        >
          {week.map((day, di) => {
            const isCurrentMonth = day.month() === currentDate.month();
            const isToday = day.isSame(today, "day");
            const isSunday = day.day() === 0;
            const dayKey = day.format("YYYY-MM-DD");
            const dayAppts = appointmentsByDay.get(dayKey) ?? [];
            const MAX_DOTS = 5;
            return (
              <div
                key={di}
                onClick={() => onDayClick?.(day)}
                style={{
                  borderRight: "1px solid #E5E7EB",
                  borderBottom: "1px solid #E5E7EB",
                  padding: "6px 8px",
                  background: isToday ? "#EBF3FE" : "#fff",
                  cursor: "pointer",
                  transition: "background 0.1s",
                  opacity: isCurrentMonth ? 1 : 0.4,
                }}
                onMouseEnter={(e) => {
                  if (!isToday) (e.currentTarget as HTMLDivElement).style.background = "#F3F8FF";
                }}
                onMouseLeave={(e) => {
                  if (!isToday) (e.currentTarget as HTMLDivElement).style.background = "#fff";
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: isToday ? "#1677ff" : "transparent",
                    color: isToday ? "#fff" : isSunday ? "#EF4444" : "#1B2A41",
                    fontWeight: isToday ? 700 : 400,
                    fontSize: 13,
                  }}
                >
                  {day.date()}
                </div>
                {dayAppts.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 2, marginTop: 3 }}>
                    {dayAppts.slice(0, MAX_DOTS).map((appt) => (
                      <span
                        key={appt.id}
                        style={{
                          display: "inline-block",
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: STATUS_DOT_COLOR[appt.status] ?? "#9ca3af",
                          flexShrink: 0,
                        }}
                        title={appt.patientName}
                      />
                    ))}
                    {dayAppts.length > MAX_DOTS && (
                      <span style={{ fontSize: 10, color: "#6B7280", lineHeight: "7px" }}>
                        +{dayAppts.length - MAX_DOTS}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
