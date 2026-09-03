import { useMemo } from "react";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { Spin } from "antd";

import { useAppointmentList } from "../api/appointmentQueries";
import type { AppointmentDto } from "../types/appointment";
import { EventCard } from "./EventCard";
import { STATUS_GROUPS } from "../hooks/useStatusCounts";

const DAY_START_H = 6;
const DAY_END_H = 22;
const SLOT_H_30 = 25;
const SLOT_H_15 = 38;

const DAY_NAMES = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

function getSlotH(slotMinutes: 15 | 30): number {
  return slotMinutes === 15 ? SLOT_H_15 : SLOT_H_30;
}

function slotTime(slotIndex: number, slotMinutes: number): string {
  const totalMinutes = DAY_START_H * 60 + slotIndex * slotMinutes;
  const h = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (totalMinutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function minutesToPx(minutes: number, slotMinutes: number, slotH: number): number {
  return (minutes / slotMinutes) * slotH;
}

interface Props {
  currentDate: Dayjs;
  slotMinutes?: 15 | 30;
  keyword: string;
  doctorIds?: string[];
  statusFilter?: string;
  selectedIds?: Set<string>;
  onCellClick?: (dayOffset: number, slotIndex: number) => void;
  onCardAction?: (action: string, id: string) => void;
}

export function WeekViewCalendar({
  currentDate,
  slotMinutes = 30,
  keyword,
  doctorIds,
  statusFilter,
  selectedIds,
  onCellClick,
  onCardAction,
}: Props) {
  const weekStart = currentDate.startOf("week");
  const today = dayjs();
  const slotH = getSlotH(slotMinutes);
  const totalSlots = ((DAY_END_H - DAY_START_H) * 60) / slotMinutes;
  const totalHeight = totalSlots * slotH;

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day")),
    [weekStart],
  );

  const slots = useMemo(() => Array.from({ length: totalSlots }, (_, i) => i), [totalSlots]);

  const { data: appointments, isFetching } = useAppointmentList({
    fromDate: weekStart.format("YYYY-MM-DD"),
    toDate: weekStart.add(6, "day").format("YYYY-MM-DD"),
    maxResultCount: 500,
  });

  const allBookings = useMemo(() => appointments?.items ?? [], [appointments]);

  const visibleBookings = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    const chipGroup = STATUS_GROUPS.find((g) => g.key === statusFilter);

    return allBookings.filter((a: AppointmentDto) => {
      if (doctorIds && doctorIds.length > 0 && !doctorIds.includes(a.doctorId)) return false;
      if (chipGroup && chipGroup.statuses.length > 0 && !chipGroup.statuses.includes(a.status))
        return false;
      if (!needle) return true;
      return (
        a.patientName?.toLowerCase().includes(needle) ||
        a.reason?.toLowerCase().includes(needle) ||
        a.doctorName?.toLowerCase().includes(needle)
      );
    });
  }, [allBookings, doctorIds, statusFilter, keyword]);

  const countByDay = useMemo(() => {
    const counts = new Map<number, number>();
    for (const appt of visibleBookings) {
      const dayIdx = dayjs(appt.startTime).diff(weekStart.startOf("day"), "day");
      if (dayIdx >= 0 && dayIdx < 7) counts.set(dayIdx, (counts.get(dayIdx) ?? 0) + 1);
    }
    return counts;
  }, [visibleBookings, weekStart]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<number, AppointmentDto[]>();
    for (const appt of visibleBookings) {
      const dayIdx = dayjs(appt.startTime).diff(weekStart.startOf("day"), "day");
      if (dayIdx < 0 || dayIdx >= 7) continue;
      const bucket = map.get(dayIdx);
      if (bucket) bucket.push(appt);
      else map.set(dayIdx, [appt]);
    }
    return map;
  }, [visibleBookings, weekStart]);

  const slotsPerHour = 60 / slotMinutes;
  const isHourStart = (idx: number) => idx % slotsPerHour === 0;

  return (
    <Spin spinning={isFetching} wrapperClassName="cal-spin-wrap">
    <div className="cal-week-scroll">
      <div className="cal-week-grid">
        {/* Header row */}
        <div className="cal-week-time-header">
          <div className="cal-week-time-header-label">Giờ/Ngày</div>
        </div>
        {days.map((day, i) => {
          const isToday = day.isSame(today, "day");
          return (
            <div
              key={i}
              className={["cal-week-day-header", isToday && "cal-week-day-header--today"]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="cal-week-day-date">{day.format("DD/MM")}</div>
              <div className="cal-week-day-name">
                {DAY_NAMES[day.day()]} ({countByDay.get(i) ?? 0})
              </div>
            </div>
          );
        })}

        {/* Time labels column */}
        <div className="cal-week-time-col">
          {slots.map((slotIdx) => {
            const showLabel = slotMinutes === 15 || isHourStart(slotIdx);
            return (
              <div
                key={slotIdx}
                className={["cal-week-time-cell-abs", !showLabel && "cal-week-time-cell-abs--half"]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  height: slotH,
                  borderBottom: isHourStart(slotIdx) ? "1px solid #e7eaf6" : "1px dashed #f7f8fd",
                }}
              >
                {showLabel ? slotTime(slotIdx, slotMinutes) : ""}
              </div>
            );
          })}
        </div>

        {/* Day columns with absolute-positioned cards */}
        {days.map((day, dayIdx) => {
          const isToday = day.isSame(today, "day");
          const dayBookings = bookingsByDay.get(dayIdx) ?? [];
          return (
            <div
              key={dayIdx}
              className={["cal-week-day-col", isToday && "cal-week-day-col--today"]
                .filter(Boolean)
                .join(" ")}
              style={{ height: totalHeight }}
            >
              {/* Background slot lines */}
              {slots.map((slotIdx) => (
                <div
                  key={slotIdx}
                  className={[
                    "cal-day-slot-bg",
                    isHourStart(slotIdx) ? "cal-day-cell--hour" : "cal-day-cell--half",
                  ].join(" ")}
                  style={{ height: slotH }}
                  onClick={() => onCellClick?.(dayIdx, slotIdx)}
                />
              ))}
              {/* Appointment cards overlay */}
              {dayBookings.map((appt) => {
                const s = dayjs(appt.startTime);
                const e = dayjs(appt.endTime);
                const startMin = s.hour() * 60 + s.minute() - DAY_START_H * 60;
                const endMin = e.hour() * 60 + e.minute() - DAY_START_H * 60;
                const top = minutesToPx(Math.max(startMin, 0), slotMinutes, slotH);
                const height = minutesToPx(
                  Math.min(endMin, (DAY_END_H - DAY_START_H) * 60) - Math.max(startMin, 0),
                  slotMinutes,
                  slotH,
                );
                if (height <= 0) return null;
                return (
                  <div key={appt.id} className="cal-day-card-positioner" style={{ top, height }}>
                    <EventCard
                      appointment={appt}
                      selected={selectedIds?.has(appt.id)}
                      onAction={onCardAction}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
    </Spin>
  );
}
