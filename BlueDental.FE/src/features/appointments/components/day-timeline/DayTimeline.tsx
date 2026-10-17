import React, { useLayoutEffect, useMemo, useRef } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { Spin } from "antd";
import { useMinuteNow } from "@/hooks/useNow";
import { t } from "@/lib/i18n";
import { useAppointmentList } from "../../api/appointmentQueries";
import { useCalendarWindowStore } from "../../store/calendarWindowStore";
import type { AppointmentDto } from "../../types/appointment";
import { TimelineAxis } from "./TimelineAxis";
import { TimelineColumn } from "./TimelineColumn";
import { TimelineLegend } from "./TimelineLegend";
import { buildTimeScale, HEAD_HEIGHT_PX, minuteToY, slotStarts, trackHeight, type TimeScale } from "./timelineLayout";
import { buildDoctorRows, filterBookings, groupByDoctor, timelineBookings, type TimelineDoctor } from "./timelineRows";

const NO_BOOKINGS: AppointmentDto[] = [];

interface Props {
  currentDate: Dayjs;
  /** Doctors working on `currentDate` — those registered OFF already left out. */
  doctors: TimelineDoctor[];
  slotMinutes: 15 | 30;
  keyword: string;
  doctorIds?: string[];
  statusFilter?: string;
  selectedIds?: Set<string>;
  onCellClick: (doctorId: string, time: string) => void;
  onCardAction?: (action: string, id: string) => void;
}

/**
 * Opens a day at "now" (a third down from the header) when it is today,
 * otherwise at the first hour shown.
 */
function useInitialScroll(ref: React.RefObject<HTMLDivElement | null>, dayKey: string, scale: TimeScale, nowMinute: number | null) {
  const nowRef = useRef(nowMinute);
  nowRef.current = nowMinute;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const trackViewport = el.clientHeight - HEAD_HEIGHT_PX;
    const now = nowRef.current;
    el.scrollTop = now === null ? 0 : Math.max(0, minuteToY(scale, now) - trackViewport / 3);
  }, [ref, dayKey, scale]);
}

export function DayTimeline({
  currentDate,
  doctors,
  slotMinutes,
  keyword,
  doctorIds,
  statusFilter,
  selectedIds,
  onCellClick,
  onCardAction,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const dayKey = currentDate.format("YYYY-MM-DD");
  const isToday = currentDate.isSame(dayjs(), "day");
  // The now line and its HH:mm badge move as the clock turns a minute, not on a poll.
  const now = useMinuteNow(isToday);

  const { data, isFetching } = useAppointmentList({ date: dayKey, maxResultCount: 500 });
  const dayBookings = useMemo(() => (data ? timelineBookings(data.items) : NO_BOOKINGS), [data]);

  const bookingsByDoctor = useMemo(
    () => groupByDoctor(filterBookings(dayBookings, { keyword, doctorIds, statusFilter })),
    [dayBookings, keyword, doctorIds, statusFilter],
  );
  const rows = useMemo(() => buildDoctorRows(doctors, dayBookings, doctorIds), [doctors, dayBookings, doctorIds]);
  const shownHours = useCalendarWindowStore((s) => s.range);
  const scale = useMemo(() => buildTimeScale(shownHours, slotMinutes), [shownHours, slotMinutes]);
  const slots = useMemo(() => slotStarts(scale), [scale]);

  const clock = dayjs(now);
  const nowOfDay = clock.hour() * 60 + clock.minute();
  const nowMinute = isToday && nowOfDay >= scale.startMinute && nowOfDay <= scale.endMinute ? nowOfDay : null;
  useInitialScroll(scrollRef, dayKey, scale, nowMinute);

  const canvasStyle = {
    "--dtl-head-h": `${HEAD_HEIGHT_PX}px`,
    "--dtl-track-h": `${trackHeight(scale)}px`,
    "--dtl-slot-h": `${scale.slotMinutes * scale.pxPerMinute}px`,
  } as React.CSSProperties;

  return (
    <Spin spinning={isFetching} wrapperClassName="cal-spin-wrap">
      <div className="dtl">
        <TimelineLegend />
        <div className="dtl-scroll" ref={scrollRef}>
          <div className="dtl-canvas" style={canvasStyle}>
            <TimelineAxis scale={scale} slots={slots} nowMinute={nowMinute} />
            {rows.length === 0 && <div className="dtl-empty">{t("Appointment:DayView:NoDoctor")}</div>}
            {rows.map((doctor) => (
              <TimelineColumn
                key={doctor.id}
                doctorId={doctor.id}
                doctorName={doctor.name}
                appointments={bookingsByDoctor.get(doctor.id) ?? NO_BOOKINGS}
                scale={scale}
                slots={slots}
                now={now}
                selectedIds={selectedIds}
                onCellClick={onCellClick}
                onCardAction={onCardAction}
              />
            ))}
            {nowMinute !== null && rows.length > 0 && (
              <div
                className="dtl-now-line"
                style={{ "--dtl-y": `${minuteToY(scale, nowMinute)}px` } as React.CSSProperties}
              />
            )}
          </div>
        </div>
      </div>
    </Spin>
  );
}
