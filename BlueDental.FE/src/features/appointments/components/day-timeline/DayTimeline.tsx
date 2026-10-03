import React, { useLayoutEffect, useMemo, useRef } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { Spin } from "antd";
import { useNow } from "@/hooks/useNow";
import { t } from "@/lib/i18n";
import { useAppointmentList } from "../../api/appointmentQueries";
import type { AppointmentDto } from "../../types/appointment";
import { TimelineAxis } from "./TimelineAxis";
import { TimelineLegend } from "./TimelineLegend";
import { TimelineRow } from "./TimelineRow";
import { buildTimeScale, minuteToX, NAME_COL_WIDTH_PX, slotStarts, trackWidth, type TimeScale } from "./timelineLayout";
import { buildDoctorRows, filterBookings, groupByDoctor, type TimelineDoctor } from "./timelineRows";

const NOW_REFRESH_MS = 30_000;
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
 * Opens a day at "now" (a third in from the left) when it is today, otherwise
 * at the start of the working hours.
 */
function useInitialScroll(ref: React.RefObject<HTMLDivElement | null>, dayKey: string, scale: TimeScale, nowMinute: number | null) {
  const nowRef = useRef(nowMinute);
  nowRef.current = nowMinute;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const trackViewport = el.clientWidth - NAME_COL_WIDTH_PX;
    const now = nowRef.current;
    el.scrollLeft = now === null ? 0 : Math.max(0, minuteToX(scale, now) - trackViewport / 3);
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
  const now = useNow(isToday, NOW_REFRESH_MS);

  const { data, isFetching } = useAppointmentList({ date: dayKey, maxResultCount: 500 });
  const dayBookings = useMemo(() => data?.items ?? NO_BOOKINGS, [data]);

  const bookingsByDoctor = useMemo(
    () => groupByDoctor(filterBookings(dayBookings, { keyword, doctorIds, statusFilter })),
    [dayBookings, keyword, doctorIds, statusFilter],
  );
  const rows = useMemo(() => buildDoctorRows(doctors, dayBookings, doctorIds), [doctors, dayBookings, doctorIds]);
  const scale = useMemo(() => buildTimeScale(dayBookings, slotMinutes), [dayBookings, slotMinutes]);
  const slots = useMemo(() => slotStarts(scale), [scale]);

  const nowOfDay = dayjs(now).hour() * 60 + dayjs(now).minute();
  const nowMinute = isToday && nowOfDay >= scale.startMinute && nowOfDay <= scale.endMinute ? nowOfDay : null;
  useInitialScroll(scrollRef, dayKey, scale, nowMinute);

  const canvasStyle = {
    "--dtl-track-w": `${trackWidth(scale)}px`,
    "--dtl-slot-w": `${scale.slotMinutes * scale.pxPerMinute}px`,
  } as React.CSSProperties;

  return (
    <Spin spinning={isFetching} wrapperClassName="cal-spin-wrap">
      <div className="dtl">
        <TimelineLegend />
        <div className="dtl-scroll" ref={scrollRef}>
          <div className="dtl-canvas" style={canvasStyle}>
            <TimelineAxis scale={scale} slots={slots} nowMinute={nowMinute} />
            <div className="dtl-body">
              {rows.length === 0 && <div className="dtl-empty">{t("Appointment:DayView:NoDoctor")}</div>}
              {rows.map((doctor) => (
                <TimelineRow
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
                  style={{ "--dtl-x": `${minuteToX(scale, nowMinute)}px` } as React.CSSProperties}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Spin>
  );
}
