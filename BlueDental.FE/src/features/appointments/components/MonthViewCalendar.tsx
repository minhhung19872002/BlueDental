import type { Dayjs } from "dayjs";
import dayjs from "dayjs";

const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

interface Props {
  currentDate: Dayjs;
  onDayClick?: (day: Dayjs) => void;
  onCreateAppointment?: () => void;
}

export function MonthViewCalendar({ currentDate, onDayClick, onCreateAppointment: _onCreateAppointment }: Props) {
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
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
