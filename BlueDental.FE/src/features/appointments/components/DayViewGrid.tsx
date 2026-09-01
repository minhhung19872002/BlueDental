import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import dayjs from "dayjs";
import { useAppointmentList } from "../api/appointmentQueries";
import type { AppointmentDto } from "../types/appointment";
import type { Dayjs } from "dayjs";
import { DayViewHeader, type DayViewDoctor } from "./DayViewHeader";
import { EventCard } from "./EventCard";
import { STATUS_GROUPS } from "../hooks/useStatusCounts";

const DAY_START_H = 6;
const DAY_END_H = 24;
const TIME_COL_W = 119;
const DOCTOR_COL_W = 206;
const SLOT_H_30 = 25;
const SLOT_H_15 = 38;

function getSlotH(slotMinutes: 15 | 30): number {
  return slotMinutes === 15 ? SLOT_H_15 : SLOT_H_30;
}

function getSlotTime(slotIndex: number, slotMinutes: number): string {
  const totalMinutes = DAY_START_H * 60 + slotIndex * slotMinutes;
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const m = (totalMinutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function minutesToPx(minutes: number, slotMinutes: number, slotH: number): number {
  return (minutes / slotMinutes) * slotH;
}

interface Props {
  currentDate: Dayjs;
  doctors: DayViewDoctor[];
  slotMinutes: 15 | 30;
  keyword: string;
  doctorIds?: string[];
  statusFilter?: string;
  selectedIds?: Set<string>;
  onCellClick: (doctorId: string, slotIndex: number) => void;
  onCardAction?: (action: string, id: string) => void;
}

export function DayViewGrid({
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
  const slotH = getSlotH(slotMinutes);
  const totalSlots = ((DAY_END_H - DAY_START_H) * 60) / slotMinutes;
  const totalHeight = totalSlots * slotH;

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { data: appointments } = useAppointmentList({
    date: currentDate.format("YYYY-MM-DD"),
    maxResultCount: 500,
  });

  const allBookings = useMemo(() => appointments?.items ?? [], [appointments]);

  const visibleDoctors = useMemo(() => {
    if (!doctorIds || doctorIds.length === 0) return doctors;
    const set = new Set(doctorIds);
    return doctors.filter((d) => set.has(d.id));
  }, [doctors, doctorIds]);

  const doctorsPerPage = useMemo(() => {
    if (containerWidth <= 0) return visibleDoctors.length || 1;
    const available = containerWidth - TIME_COL_W;
    return Math.max(1, Math.floor(available / DOCTOR_COL_W));
  }, [containerWidth, visibleDoctors.length]);

  const totalPages = Math.max(1, Math.ceil(visibleDoctors.length / doctorsPerPage));

  const safePage = Math.min(page, totalPages - 1);
  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  useEffect(() => {
    setPage(0);
  }, [doctorIds, doctors]);

  const pageDoctors = useMemo(() => {
    const start = safePage * doctorsPerPage;
    return visibleDoctors.slice(start, start + doctorsPerPage);
  }, [visibleDoctors, safePage, doctorsPerPage]);

  const handlePrev = useCallback(() => setPage((p) => Math.max(0, p - 1)), []);
  const handleNext = useCallback(() => setPage((p) => Math.min(totalPages - 1, p + 1)), [totalPages]);

  const visibleBookings = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    const chipGroup = STATUS_GROUPS.find((g) => g.key === statusFilter);

    return allBookings.filter((a: AppointmentDto) => {
      if (doctorIds && doctorIds.length > 0 && !doctorIds.includes(a.doctorId)) return false;
      if (chipGroup && chipGroup.statuses.length > 0 && !chipGroup.statuses.includes(a.status)) return false;
      if (!needle) return true;
      return (
        a.patientName?.toLowerCase().includes(needle) ||
        a.reason?.toLowerCase().includes(needle) ||
        a.doctorName?.toLowerCase().includes(needle)
      );
    });
  }, [allBookings, doctorIds, statusFilter, keyword]);

  const bookingsByDoctor = useMemo(() => {
    const map = new Map<string, AppointmentDto[]>();
    for (const appt of visibleBookings) {
      const bucket = map.get(appt.doctorId);
      if (bucket) bucket.push(appt);
      else map.set(appt.doctorId, [appt]);
    }
    return map;
  }, [visibleBookings]);

  const countsByDoctor = useMemo(() => {
    const counts = new Map<string, number>();
    for (const appt of visibleBookings) {
      counts.set(appt.doctorId, (counts.get(appt.doctorId) ?? 0) + 1);
    }
    return counts;
  }, [visibleBookings]);

  const slots = useMemo(
    () => Array.from({ length: totalSlots }, (_, i) => i),
    [totalSlots],
  );

  const colCount = Math.max(pageDoctors.length, 1);
  const gridCols = `${TIME_COL_W}px repeat(${colCount}, 1fr)`;

  return (
    <div className="cal-day-scroll" ref={containerRef}>
      <div
        className="cal-day-grid"
        style={{ gridTemplateColumns: gridCols }}
      >
        <DayViewHeader
          doctors={pageDoctors}
          countsByDoctor={countsByDoctor}
          timeColWidth={TIME_COL_W}
          canPrev={safePage > 0}
          canNext={safePage < totalPages - 1}
          onPrev={handlePrev}
          onNext={handleNext}
        />

        {/* Time labels column */}
        <div className="cal-day-time-col">
          {slots.map((slotIdx) => {
            const isHour = slotMinutes === 30 ? slotIdx % 2 === 0 : slotIdx % 4 === 0;
            const showLabel = slotMinutes === 15 || isHour;
            return (
              <div
                key={slotIdx}
                className={[
                  "cal-day-time-cell",
                  !showLabel && "cal-day-time-cell--half",
                ].filter(Boolean).join(" ")}
                style={{
                  height: slotH,
                  borderBottom: isHour ? "1px solid #e7eaf6" : "1px dashed #f7f8fd",
                }}
              >
                {showLabel ? getSlotTime(slotIdx, slotMinutes) : ""}
              </div>
            );
          })}
        </div>

        {/* Doctor columns with absolute-positioned cards */}
        {pageDoctors.map((doc) => {
          const docBookings = bookingsByDoctor.get(doc.id) ?? [];
          return (
            <div key={doc.id} className="cal-day-doctor-col" style={{ height: totalHeight }}>
              {/* Background slot lines */}
              {slots.map((slotIdx) => {
                const isHour = slotMinutes === 30 ? slotIdx % 2 === 0 : slotIdx % 4 === 0;
                const bgClass = slotIdx % 4 < 2 ? "cal-day-cell--even" : "cal-day-cell--odd";
                return (
                  <div
                    key={slotIdx}
                    className={[
                      "cal-day-slot-bg",
                      isHour ? "cal-day-cell--hour" : "cal-day-cell--half",
                      bgClass,
                    ].join(" ")}
                    style={{ height: slotH }}
                    onClick={() => onCellClick(doc.id, slotIdx)}
                  />
                );
              })}
              {/* Appointment cards overlay */}
              {docBookings.map((appt) => {
                const start = dayjs(appt.startTime);
                const end = dayjs(appt.endTime);
                const startMin = start.hour() * 60 + start.minute() - DAY_START_H * 60;
                const endMin = end.hour() * 60 + end.minute() - DAY_START_H * 60;
                const top = minutesToPx(Math.max(startMin, 0), slotMinutes, slotH);
                const height = minutesToPx(
                  Math.min(endMin, (DAY_END_H - DAY_START_H) * 60) - Math.max(startMin, 0),
                  slotMinutes, slotH,
                );
                if (height <= 0) return null;
                return (
                  <div
                    key={appt.id}
                    className="cal-day-card-positioner"
                    style={{ top, height }}
                  >
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

        {/* Empty column if no doctors */}
        {pageDoctors.length === 0 && (
          <div className="cal-day-doctor-col" style={{ height: totalHeight }}>
            {slots.map((slotIdx) => {
              const isHour = slotMinutes === 30 ? slotIdx % 2 === 0 : slotIdx % 4 === 0;
              return (
                <div
                  key={slotIdx}
                  className={[
                    "cal-day-slot-bg",
                    isHour ? "cal-day-cell--hour" : "cal-day-cell--half",
                  ].join(" ")}
                  style={{ height: slotH }}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export type { DayViewDoctor };
