import { useMemo } from "react";
import { Button } from "antd";
import type { Dayjs } from "dayjs";

const VI_WEEKDAYS_FULL = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

interface Props {
  currentDate: Dayjs;
  onCreateAppointment?: () => void;
  onDayClick?: (date: Dayjs) => void;
}

export function MonthViewCalendar({ currentDate, onCreateAppointment, onDayClick }: Props) {
  const monthStart = currentDate.startOf("month");
  const monthEnd = currentDate.endOf("month");
  const calStart = monthStart.startOf("week");
  const totalDays = calStart.daysInMonth();
  const weeksNeeded = Math.ceil((monthEnd.diff(calStart, "day") + 1) / 7);
  const today = currentDate.format("YYYY-MM-DD");

  const weeks = useMemo(() => {
    return Array.from({ length: weeksNeeded }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => calStart.add(w * 7 + d, "day")),
    );
  }, [calStart, weeksNeeded]);

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 16px", background: "#fff", borderBottom: "1px solid #E5E7EB",
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#1B2A41" }}>
          Tháng {currentDate.format("M")} / {currentDate.format("YYYY")}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <Button size="small">Xuất File</Button>
          <Button type="primary" size="small" style={{ background: "#2671D8" }} onClick={onCreateAppointment}>
            Tạo lịch hẹn mới
          </Button>
        </div>
      </div>

      {/* Month grid */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700, tableLayout: "fixed" }}>
          <thead>
            <tr>
              {VI_WEEKDAYS_FULL.map((d) => (
                <th key={d} style={{
                  padding: "8px 4px",
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#6B7280",
                  background: "#F8FAFC",
                  borderBottom: "2px solid #E5E7EB",
                }}>
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((day, di) => {
                  const isCurrentMonth = day.month() === currentDate.month();
                  const isToday = day.format("YYYY-MM-DD") === today;
                  return (
                    <td
                      key={di}
                      onClick={() => onDayClick?.(day)}
                      style={{
                        height: 100,
                        verticalAlign: "top",
                        padding: "6px 8px",
                        border: "1px solid #E5E7EB",
                        background: isToday ? "#EBF3FE" : isCurrentMonth ? "#fff" : "#F9FAFB",
                        cursor: "pointer",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#DBEAFE"; }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = isToday
                          ? "#EBF3FE"
                          : isCurrentMonth ? "#fff" : "#F9FAFB";
                      }}
                    >
                      <div style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 28, height: 28,
                        borderRadius: "50%",
                        background: isToday ? "#1E70E6" : "none",
                        color: isToday ? "#fff" : isCurrentMonth ? "#1B2A41" : "#D1D5DB",
                        fontSize: 13,
                        fontWeight: isToday ? 700 : isCurrentMonth ? 500 : 400,
                      }}>
                        {day.format("D")}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
