import { useMemo } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { EllipsisOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { Appointment } from "../types/appointment";

const WEEKDAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

interface Props {
  appointments: Appointment[];
  weekStart: Dayjs;
}

export function MiniCalWeekView({ appointments, weekStart }: Props) {
  const days = useMemo(() => {
    const result: Dayjs[] = [];
    for (let i = 0; i < 7; i++) result.push(weekStart.add(i, "day"));
    return result;
  }, [weekStart]);

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const d of days) map.set(d.format("YYYY-MM-DD"), []);
    for (const a of appointments) {
      const key = dayjs(a.startTime).format("YYYY-MM-DD");
      map.get(key)?.push(a);
    }
    return map;
  }, [appointments, days]);

  return (
    <div className="mcal-week">
      <div className="mcal-week-header">
        {days.map((d, i) => (
          <div key={i} className="mcal-week-day-header">
            <span className="mcal-week-day-num">{d.date()}</span>
            <span className="mcal-week-day-name">{WEEKDAY_LABELS[i]}</span>
          </div>
        ))}
      </div>
      <div className="mcal-week-body">
        {days.map((d, i) => {
          const appts = byDay.get(d.format("YYYY-MM-DD")) ?? [];
          return (
            <div key={i} className="mcal-week-col">
              {appts.map((a) => (
                <MiniWeekCard key={a.id} appointment={a} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniWeekCard({ appointment: a }: { appointment: Appointment }) {
  const start = dayjs(a.startTime);
  const end = dayjs(a.endTime);
  return (
    <div className="mcal-week-card" style={{ borderLeftColor: a.color || a.statusColor }}>
      <div className="mcal-week-card-row1">
        <span className="mcal-week-card-title">{a.patientCode ? `[${a.patientCode}] - ${a.patientName}` : a.patientName}</span>
        <button type="button" className="mcal-week-card-menu"><EllipsisOutlined /></button>
      </div>
      {a.patientPhone && <div className="mcal-week-card-phone">{a.patientPhone}</div>}
      {a.reason && <div className="mcal-week-card-reason">{a.reason}</div>}
      <div className="mcal-week-card-footer">
        <span className="mcal-week-card-time">
          {start.format("DD.MM.YY")} - {end.format("HH:mm")}
        </span>
        <span className="mcal-week-card-status" style={{ color: a.statusColor }}>
          {a.statusLabel}
        </span>
      </div>
    </div>
  );
}
