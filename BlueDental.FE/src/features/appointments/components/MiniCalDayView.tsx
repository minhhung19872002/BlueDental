import { useEffect, useMemo, useRef } from "react";
import { Tooltip } from "antd";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import type { Appointment } from "../types/appointment";
import type { CalendarFocus } from "../types/appointmentSeries";
import { clipToGrid, gridEdges, useCalendarWindowStore } from "../store/calendarWindowStore";
import type { DaySubMode } from "./AppointmentMiniCalendar";
import type { PickedDoctor } from "../types/slotPick";

/** BA 2026-10-16: 15-minute slots; R-977: over the viewer's shown hours. */
const SLOT_MIN = 15;
const COL_W = 60;

interface Grid {
  startMinute: number;
  endMinute: number;
}

interface Props {
  appointments: Appointment[];
  date: string;
  subMode: DaySubMode;
  /** A session picked in "Danh sách buổi hẹn"; marked when it falls on this day. */
  focus?: CalendarFocus | null;
  /** Clicking a slot hands its start ("HH:mm") and, on a doctor's row, that doctor to the form. */
  onSlotPick?: (time: string, doctor?: PickedDoctor) => void;
}

function buildSlots(grid: Grid): string[] {
  const result: string[] = [];
  for (let minute = grid.startMinute; minute < grid.endMinute; minute += SLOT_MIN) {
    const h = Math.floor(minute / 60).toString().padStart(2, "0");
    const m = (minute % 60).toString().padStart(2, "0");
    result.push(`${h}:${m}`);
  }
  return result;
}

/**
 * Where a booking sits on the axis, cut to the hours shown, or null when it
 * falls wholly outside them (R-977: the viewer widens the hours to see it).
 */
function calcPosition(appt: Pick<Appointment, "startTime" | "endTime">, grid: Grid) {
  const start = dayjs(appt.startTime);
  const end = dayjs(appt.endTime);
  const startMin = start.hour() * 60 + start.minute();
  const endMin = end.isSame(start, "day") ? end.hour() * 60 + end.minute() : 24 * 60;
  const shown = clipToGrid(startMin, Math.max(endMin, startMin + 1), grid);
  if (!shown) return null;
  const left = ((shown.startMinute - grid.startMinute) / SLOT_MIN) * COL_W;
  const width = ((shown.endMinute - shown.startMinute) / SLOT_MIN) * COL_W;
  const room = ((grid.endMinute - shown.startMinute) / SLOT_MIN) * COL_W;
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

function EvtBlock({ appt, label, grid }: { appt: Appointment; label: string; grid: Grid }) {
  const position = calcPosition(appt, grid);
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
function FocusMarker({ focus, grid }: { focus: CalendarFocus; grid: Grid }) {
  const ref = useRef<HTMLDivElement>(null);
  const position = calcPosition({ startTime: focus.start, endTime: focus.end }, grid);

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
  grid: Grid;
  focus: CalendarFocus | null;
  onSlotPick?: (time: string, doctor?: PickedDoctor) => void;
}

interface SlotCellsProps extends Pick<ViewProps, "slots" | "onSlotPick"> {
  /** The doctor whose row these slots are on; picked along with the time. */
  doctor?: PickedDoctor;
}

/** The empty slots of one row; buttons when the form takes the picked time. */
function SlotCells({ slots, onSlotPick, doctor }: SlotCellsProps) {
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
          aria-label={
            doctor ? t("Appointment:MiniCal:PickDoctorSlot", s, doctor.name) : t("Appointment:MiniCal:PickSlot", s)
          }
          onClick={() => onSlotPick(s, doctor)}
        />
      ))}
    </>
  );
}

function TimeView({ appointments, slots, grid, focus, onSlotPick }: ViewProps) {
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
          {focus && <FocusMarker focus={focus} grid={grid} />}
          {appointments.map((appt) => {
            const patientLabel = appt.patientCode ? `[${appt.patientCode}] - ${appt.patientName}` : appt.patientName;
            const label = `${appt.doctorName} — ${patientLabel}`;
            return <EvtBlock key={appt.id} appt={appt} label={label} grid={grid} />;
          })}
        </div>
      </div>
    </>
  );
}

function DoctorView({ appointments, slots, grid, focus, onSlotPick }: ViewProps) {
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
            <SlotCells slots={slots} onSlotPick={onSlotPick} doctor={doc} />
            {focus && row === 0 && <FocusMarker focus={focus} grid={grid} />}
            {doc.appts.map((appt) => {
              const patientLabel = appt.patientCode ? `[${appt.patientCode}] - ${appt.patientName}` : appt.patientName;
              const label = `${patientLabel} ${appt.reason || ""}`;
              return <EvtBlock key={appt.id} appt={appt} label={label} grid={grid} />;
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
  const shownHours = useCalendarWindowStore((s) => s.range);
  const grid = useMemo(() => gridEdges(shownHours, SLOT_MIN), [shownHours]);
  const slots = useMemo(() => buildSlots(grid), [grid]);
  const dayFocus = focus && dayjs(focus.start).format("YYYY-MM-DD") === date ? focus : null;
  const view = { appointments, slots, grid, focus: dayFocus, onSlotPick };

  return (
    <div className="mcal-day">
      {subMode === "time" ? <TimeView {...view} /> : <DoctorView {...view} />}
      <DayNote date={date} isEmpty={appointments.length === 0} focus={dayFocus} />
    </div>
  );
}
