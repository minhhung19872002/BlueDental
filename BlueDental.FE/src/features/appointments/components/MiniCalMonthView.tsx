import { useMemo } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { Appointment, AppointmentStatus } from "../types/appointment";

const WEEKDAY_KEYS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"] as const;

const STATUS_GROUPS: {
  key: string;
  labelKey: string;
  icon: React.ReactNode;
  color: string;
  match: (s: AppointmentStatus) => boolean;
}[] = [
  {
    key: "arrived",
    labelKey: "Đã đến",
    icon: <CheckCircleOutlined />,
    color: "#0e9f6e",
    match: (s) => s === "inProgress" || s === "completed",
  },
  {
    key: "cancelled",
    labelKey: "Đã huỷ",
    icon: <CloseCircleOutlined />,
    color: "#e5484d",
    match: (s) => s === "cancelled" || s === "noShow",
  },
  {
    key: "scheduled",
    labelKey: "Đã hẹn",
    icon: <ClockCircleOutlined />,
    color: "#6366f1",
    match: (s) => s === "scheduled" || s === "confirmed",
  },
];

interface Props {
  appointments: Appointment[];
  monthStart: Dayjs;
}

export function MiniCalMonthView({ appointments, monthStart }: Props) {
  const weeks = useMemo(() => {
    const first = monthStart.startOf("month").startOf("week");
    const last = monthStart.endOf("month").endOf("week");
    const days: Dayjs[] = [];
    let cur = first;
    while (cur.isBefore(last) || cur.isSame(last, "day")) {
      days.push(cur);
      cur = cur.add(1, "day");
    }
    const rows: Dayjs[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [monthStart]);

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const key = dayjs(a.startTime).format("YYYY-MM-DD");
      const list = map.get(key);
      if (list) list.push(a);
      else map.set(key, [a]);
    }
    return map;
  }, [appointments]);

  const currentMonth = monthStart.month();

  return (
    <div className="mcal-month">
      <div className="mcal-month-header">
        {WEEKDAY_KEYS.map((wd) => (
          <div key={wd} className="mcal-month-weekday">{t(wd)}</div>
        ))}
      </div>
      <div className="mcal-month-body">
        {weeks.map((week, wi) => (
          <div key={wi} className="mcal-month-row">
            {week.map((d, di) => {
              const key = d.format("YYYY-MM-DD");
              const appts = byDay.get(key) ?? [];
              const outside = d.month() !== currentMonth;
              return (
                <div
                  key={di}
                  className={["mcal-month-cell", outside && "mcal-month-cell--outside"]
                    .filter(Boolean).join(" ")}
                >
                  <span className="mcal-month-date">{d.date()}</span>
                  {appts.length > 0 && (
                    <div className="mcal-month-stats">
                      {STATUS_GROUPS.map((g) => {
                        const count = appts.filter((a) => g.match(a.status)).length;
                        return (
                          <div key={g.key} className="mcal-month-stat" style={{ color: g.color }}>
                            {g.icon}
                            <span className="mcal-month-stat-label">{t(g.labelKey)}</span>
                            <span className="mcal-month-stat-count">({count})</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
