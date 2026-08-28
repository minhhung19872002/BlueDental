import { useMemo } from "react";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { useAppointmentList } from "../api/appointmentQueries";
import type { AppointmentDto, AppointmentStatus } from "../types/appointment";
import { t } from "@/lib/i18n";

const WEEKDAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

interface StatusRowConfig {
  key: string;
  label: () => string;
  statuses: AppointmentStatus[];
  icon: React.ReactNode;
}

const STATUS_ROWS: StatusRowConfig[] = [
  {
    key: "completed",
    label: () => t("Hoàn tất"),
    statuses: ["completed"],
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(22,163,74)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    key: "cancelled",
    label: () => t("Huỷ hẹn"),
    statuses: ["cancelled"],
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(239,68,68)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="m4.9 4.9 14.2 14.2" />
      </svg>
    ),
  },
  {
    key: "late",
    label: () => t("Trễ hẹn"),
    statuses: ["noShow"],
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(59,130,246)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  {
    key: "scheduled",
    label: () => t("Đã hẹn"),
    statuses: ["scheduled", "confirmed"],
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(59,130,246)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
];

interface Props {
  currentDate: Dayjs;
  keyword: string;
  doctorIds?: string[];
  statusFilter?: string;
  onDayClick?: (day: Dayjs) => void;
}

export function MonthViewCalendar({
  currentDate,
  keyword,
  doctorIds,
  statusFilter: _statusFilter,
  onDayClick,
}: Props) {
  const monthStart = currentDate.startOf("month");
  const monthEnd = currentDate.endOf("month");
  const calStart = monthStart.startOf("week");
  const calEnd = monthEnd.endOf("week");
  const today = dayjs();

  const { data } = useAppointmentList({
    fromDate: calStart.format("YYYY-MM-DD"),
    toDate: calEnd.format("YYYY-MM-DD"),
    maxResultCount: 1000,
  });

  const statusCountsByDay = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    const items = data?.items ?? [];
    const needle = keyword.trim().toLowerCase();

    for (const appt of items) {
      if (!appt.startTime) continue;
      if (doctorIds && doctorIds.length > 0 && !doctorIds.includes(appt.doctorId)) continue;
      if (needle && !(
        (appt as AppointmentDto).patientName?.toLowerCase().includes(needle) ||
        (appt as AppointmentDto).reason?.toLowerCase().includes(needle) ||
        (appt as AppointmentDto).doctorName?.toLowerCase().includes(needle)
      )) continue;

      const dayKey = dayjs(appt.startTime).format("YYYY-MM-DD");
      let dayCounts = map.get(dayKey);
      if (!dayCounts) {
        dayCounts = new Map();
        map.set(dayKey, dayCounts);
      }

      for (const row of STATUS_ROWS) {
        if (row.statuses.includes(appt.status)) {
          dayCounts.set(row.key, (dayCounts.get(row.key) ?? 0) + 1);
        }
      }
    }

    return map;
  }, [data, keyword, doctorIds]);

  const days: Dayjs[] = useMemo(() => {
    const result: Dayjs[] = [];
    let current = calStart;
    while (current.isBefore(calEnd) || current.isSame(calEnd, "day")) {
      result.push(current);
      current = current.add(1, "day");
    }
    return result;
  }, [calStart, calEnd]);

  return (
    <div>
      <div className="cal-month-grid">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="cal-month-weekday">{label}</div>
        ))}

        {days.map((day) => {
          const key = day.format("YYYY-MM-DD");
          const dayCounts = statusCountsByDay.get(key);
          const isOutside = day.month() !== currentDate.month();
          const isToday = day.isSame(today, "day");

          return (
            <button
              key={key}
              type="button"
              className={[
                "cal-month-cell",
                isOutside && "cal-month-cell--outside",
                isToday && "cal-month-cell--today",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onDayClick?.(day)}
            >
              <span className="cal-month-date">{day.date()}</span>
              {STATUS_ROWS.map((row) => {
                const count = dayCounts?.get(row.key) ?? 0;
                return (
                  <div key={row.key} className="cal-month-status-row">
                    <span className="cal-month-status-icon">{row.icon}</span>
                    <span className="cal-month-status-label">{row.label()}</span>
                    <span className="cal-month-status-count">({count})</span>
                  </div>
                );
              })}
            </button>
          );
        })}
      </div>
    </div>
  );
}
