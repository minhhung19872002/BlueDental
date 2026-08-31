import { useMemo } from "react";
import { Tooltip } from "antd";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import type { Appointment } from "../types/appointment";
import type { DaySubMode } from "./AppointmentMiniCalendar";

const HOUR_START = 6;
const HOUR_END = 24;
const SLOT_MIN = 30;
const COL_W = 60;

interface Props {
  appointments: Appointment[];
  date: string;
  subMode: DaySubMode;
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

function calcPosition(appt: Appointment) {
  const start = dayjs(appt.startTime);
  const end = dayjs(appt.endTime);
  const startMin = start.hour() * 60 + start.minute();
  const endMin = end.hour() * 60 + end.minute();
  const baseMin = HOUR_START * 60;
  const left = ((startMin - baseMin) / SLOT_MIN) * COL_W;
  const width = Math.max(((endMin - startMin) / SLOT_MIN) * COL_W, COL_W);
  return { left, width, start, end };
}

function EvtTooltipContent({ appt }: { appt: Appointment }) {
  const start = dayjs(appt.startTime);
  const end = dayjs(appt.endTime);
  const dur = end.diff(start, "minute");
  return (
    <div className="mcal-tooltip">
      <div className="mcal-tooltip-doctor">{appt.doctorName}</div>
      <div>{t("Khách hàng")}: {appt.patientCode ? `[${appt.patientCode}] - ${appt.patientName}` : appt.patientName}</div>
      <div>{start.format("DD/MM/YYYY HH:mm")} – {end.format("HH:mm")} ({dur} {t("phút")})</div>
      <div>{t("Trạng thái")}: {appt.statusLabel}</div>
      {appt.reason && <div>"{appt.reason}"</div>}
    </div>
  );
}

function EvtBlock({ appt, label }: { appt: Appointment; label: string }) {
  const { left, width } = calcPosition(appt);
  if (left < 0) return null;
  const evtStyle: React.CSSProperties = { left, width };
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

function TimeView({ appointments, slots }: { appointments: Appointment[]; slots: string[] }) {
  return (
    <>
      <div className="mcal-day-header">
        {slots.map((s) => (
          <div key={s} className="mcal-day-time-cell">{s}</div>
        ))}
      </div>
      <div className="mcal-day-row mcal-day-row--time">
        <div className="mcal-day-slots">
          {slots.map((s) => (
            <div key={s} className="mcal-day-slot" />
          ))}
          {appointments.map((appt) => {
            const start = dayjs(appt.startTime);
            const end = dayjs(appt.endTime);
            const patientLabel = appt.patientCode ? `[${appt.patientCode}] - ${appt.patientName}` : appt.patientName;
            const label = `${appt.doctorName} — ${patientLabel}`;
            return <EvtBlock key={appt.id} appt={appt} label={label} />;
          })}
        </div>
      </div>
    </>
  );
}

function DoctorView({ appointments, slots }: { appointments: Appointment[]; slots: string[] }) {
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
      {doctors.map((doc) => (
        <div key={doc.id} className="mcal-day-row">
          <div className="mcal-day-doctor">{doc.name}</div>
          <div className="mcal-day-slots">
            {slots.map((s) => (
              <div key={s} className="mcal-day-slot" />
            ))}
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

export function MiniCalDayView({ appointments, date, subMode }: Props) {
  const slots = useMemo(buildSlots, []);
  const isEmpty = appointments.length === 0;

  return (
    <div className="mcal-day">
      {subMode === "time"
        ? <TimeView appointments={appointments} slots={slots} />
        : <DoctorView appointments={appointments} slots={slots} />}
      {isEmpty && (
        <div className="mcal-empty">
          {t("Chưa có lịch hẹn ngày")} {dayjs(date).format("DD/MM/")}
        </div>
      )}
    </div>
  );
}
