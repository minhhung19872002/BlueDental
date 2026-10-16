import { useEffect, useMemo, useRef } from "react";
import { Tooltip } from "antd";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import type { Appointment } from "../types/appointment";
import type { CalendarFocus } from "../types/appointmentSeries";
import type { DaySubMode } from "./AppointmentMiniCalendar";

/** BA 2026-10-16: 15-minute slots from 07:00 to the end of the day (last one 23:45). */
const HOUR_START = 7;
const HOUR_END = 24;
const SLOT_MIN = 15;
const COL_W = 60;
const DAY_START_MIN = HOUR_START * 60;
const DAY_END_MIN = HOUR_END * 60;

interface Props {
  appointments: Appointment[];
  date: string;
  subMode: DaySubMode;
  /** A session picked in "Danh sách buổi hẹn"; marked when it falls on this day. */
  focus?: CalendarFocus | null;
  /** Clicking a slot hands its start ("HH:mm") to the form's Giờ hẹn. */
  onSlotPick?: (time: string) => void;
}

function buildSlots(): string[] {
  const result: string[] = [];
  for (let h = HOUR_START; h < HOUR_END; h++) {
    for (let m = 0; m < 60; m += SLOT_MIN) {
      result.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    }
  }
  return result;
}

/**
 * Where a booking sits on the axis, or null when it starts outside
 * 07:00–24:00 (BA: those are not shown here). One running past midnight is cut
 * at the edge.
 */
function calcPosition(appt: Pick<Appointment, "startTime" | "endTime">) {
  const start = dayjs(appt.startTime);
  const end = dayjs(appt.endTime);
  const startMin = start.hour() * 60 + start.minute();
  if (startMin < DAY_START_MIN || startMin >= DAY_END_MIN) return null;
  const endMin = end.isSame(start, "day") ? end.hour() * 60 + end.minute() : DAY_END_MIN;
  const left = ((startMin - DAY_START_MIN) / SLOT_MIN) * COL_W;
  const width = ((Math.min(endMin, DAY_END_MIN) - startMin) / SLOT_MIN) * COL_W;
  const room = ((DAY_END_MIN - startMin) / SLOT_MIN) * COL_W;
  return { left, width: Math.min(Math.max(width, COL_W), room) };
}

function EvtTooltipContent({ appt }: { appt: Appointment }) {
  const start = dayjs(appt.startTime);
  const end = dayjs(appt.endTime);
  const dur = end.diff(start, "minute");
  return (
    <div className="mcal-tooltip">
      <div className="mcal-tooltip-doctor">{appt.doctorName}</div>
      <div>{t("Appointment:MiniCal:Customer")}: {appt.patientCode ? `[${appt.patientCode}] - ${appt.patientName}` : appt.patientName}</div>
      <div>{start.format("DD/MM/YYYY HH:mm")} – {end.format("HH:mm")} ({dur} {t("Patient:Misc:Minutes")})</div>
      <div>{t("Common:Status")}: {appt.statusLabel}</div>
      {appt.reason && <div>"{appt.reason}"</div>}
    </div>
  );
}

function EvtBlock({ appt, label }: { appt: Appointment; label: string }) {
  const position = calcPosition(appt);
  if (!position) return null;
  const evtStyle: React.CSSProperties = { left: position.left, width: position.width };
  if (appt.color) {
    evtStyle.background = `${appt.color}28`;
    evtStyle.borderLeft = `3px solid ${appt.color}`;
  }
  return (
    <Tooltip title={<EvtTooltipContent appt={appt} />} placement="top" classNames={{ root: "mcal-tooltip-overlay" }}>
      <div className="mcal-day-evt" style={evtStyle}>
        <span className="mcal-day-evt-text" style={appt.color ? { color: appt.color } : undefined}>{label}</span>
      </div>
    </Tooltip>
  );
}

/**
 * Outlines the picked session's slot and scrolls the diary to it. Laid over
 * the slot row, so it sits beside any booking already there instead of
 * hiding it.
 */
function FocusMarker({ focus }: { focus: CalendarFocus }) {
  const ref = useRef<HTMLDivElement>(null);
  const position = calcPosition({ startTime: focus.start, endTime: focus.end });

  useEffect(() => {
    const marker = ref.current;
    const box = marker?.closest(".appt-mini-cal-content");
    if (!marker || !box) return;
    const offset = marker.getBoundingClientRect().left - box.getBoundingClientRect().left;
    box.scrollLeft += offset - box.clientWidth / 2 + marker.offsetWidth / 2;
  }, [focus]);

  if (!position) return null;
  const vars = { "--mcal-focus-left": `${position.left}px`, "--mcal-focus-width": `${position.width}px` } as React.CSSProperties;
  return <div ref={ref} className="mcal-day-focus" style={vars} aria-hidden />;
}

interface ViewProps {
  appointments: Appointment[];
  slots: string[];
  focus: CalendarFocus | null;
  onSlotPick?: (time: string) => void;
}

/** The empty slots of one row; buttons when the form takes the picked time. */
function SlotCells({ slots, onSlotPick }: Pick<ViewProps, "slots" | "onSlotPick">) {
  if (!onSlotPick) {
    return <>{slots.map((s) => <div key={s} className="mcal-day-slot" />)}</>;
  }
  return (
    <>
      {slots.map((s) => (
        <button
          key={s}
          type="button"
          className="mcal-day-slot mcal-day-slot--pick"
          aria-label={t("Appointment:MiniCal:PickSlot", s)}
          onClick={() => onSlotPick(s)}
        />
      ))}
    </>
  );
}

function TimeView({ appointments, slots, focus, onSlotPick }: ViewProps) {
  return (
    <>
      <div className="mcal-day-header">
        {slots.map((s) => (
          <div key={s} className="mcal-day-time-cell">{s}</div>
        ))}
      </div>
      <div className="mcal-day-row mcal-day-row--time">
        <div className="mcal-day-slots">
          <SlotCells slots={slots} onSlotPick={onSlotPick} />
          {focus && <FocusMarker focus={focus} />}
          {appointments.map((appt) => {
            const patientLabel = appt.patientCode ? `[${appt.patientCode}] - ${appt.patientName}` : appt.patientName;
            const label = `${appt.doctorName} — ${patientLabel}`;
            return <EvtBlock key={appt.id} appt={appt} label={label} />;
          })}
        </div>
      </div>
    </>
  );
}

function DoctorView({ appointments, slots, focus, onSlotPick }: ViewProps) {
  const doctors = useMemo(() => {
    const map = new Map<string, { id: string; name: string; appts: Appointment[] }>();
    for (const a of appointments) {
      let entry = map.get(a.doctorId);
      if (!entry) {
        entry = { id: a.doctorId, name: a.doctorName, appts: [] };
        map.set(a.doctorId, entry);
      }
      entry.appts.push(a);
    }
    return Array.from(map.values());
  }, [appointments]);

  return (
    <>
      <div className="mcal-day-header">
        <div className="mcal-day-corner" />
        {slots.map((s) => (
          <div key={s} className="mcal-day-time-cell">{s}</div>
        ))}
      </div>
      {doctors.map((doc, row) => (
        <div key={doc.id} className="mcal-day-row">
          <div className="mcal-day-doctor">{doc.name}</div>
          <div className="mcal-day-slots">
            <SlotCells slots={slots} onSlotPick={onSlotPick} />
            {focus && row === 0 && <FocusMarker focus={focus} />}
            {doc.appts.map((appt) => {
              const patientLabel = appt.patientCode ? `[${appt.patientCode}] - ${appt.patientName}` : appt.patientName;
              const label = `${patientLabel} ${appt.reason || ""}`;
              return <EvtBlock key={appt.id} appt={appt} label={label} />;
            })}
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Under the diary: a preview session is not on the book yet, so say what the
 * dashed slot is; otherwise an empty day says so — but never while a picked
 * session sits on it.
 */
function DayNote({ date, isEmpty, focus }: { date: string; isEmpty: boolean; focus: CalendarFocus | null }) {
  if (focus?.planned) {
    const when = `${dayjs(focus.start).format("HH:mm")} – ${dayjs(focus.end).format("HH:mm")} ${dayjs(focus.start).format("DD/MM/YYYY")}`;
    return <div className="mcal-empty mcal-empty--planned">{t("Appointment:MiniCal:PlannedSession", when)}</div>;
  }
  if (!isEmpty || focus) return null;
  return (
    <div className="mcal-empty">
      {t("Appointment:MiniCal:NoAppointmentsDay")} {dayjs(date).format("DD/MM/YYYY")}
    </div>
  );
}

export function MiniCalDayView({ appointments, date, subMode, focus = null, onSlotPick }: Props) {
  const slots = useMemo(buildSlots, []);
  const dayFocus = focus && dayjs(focus.start).format("YYYY-MM-DD") === date ? focus : null;

  return (
    <div className="mcal-day">
      {subMode === "time"
        ? <TimeView appointments={appointments} slots={slots} focus={dayFocus} onSlotPick={onSlotPick} />
        : <DoctorView appointments={appointments} slots={slots} focus={dayFocus} onSlotPick={onSlotPick} />}
      <DayNote date={date} isEmpty={appointments.length === 0} focus={dayFocus} />
    </div>
  );
}
