import { Spin, Tooltip } from "antd";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import type { SeriesSession } from "../types/appointmentSeries";
import { REASON_LABEL_KEY, sessionDayLabel, STATE_LABEL_KEY } from "./recurrenceLabels";

interface Props {
  sessions: SeriesSession[];
  loading: boolean;
  /** Creating, before patient, dentist, date and time are all picked. */
  waitingForBooking: boolean;
  errorMessage: string | null;
  /** The session being edited, marked in the list. */
  currentAppointmentId: string | null;
  onSelect: (session: SeriesSession) => void;
}

/** "Danh sách buổi hẹn": one row per session; a click shows it in Lịch đã hẹn. */
export function RecurrenceSessionList({
  sessions,
  loading,
  waitingForBooking,
  errorMessage,
  currentAppointmentId,
  onSelect,
}: Props) {
  return (
    <section className="appt-series" aria-label={t("Appointment:Series:Sessions")}>
      <header className="appt-series-head">
        <span className="appt-series-title">{t("Appointment:Series:Sessions")}</span>
        {sessions.length > 0 && (
          <span className="appt-series-count">{t("Appointment:Series:SessionCount", sessions.length)}</span>
        )}
      </header>
      <Spin spinning={loading} className="appt-series-body">
        <SessionRows
          sessions={sessions}
          waitingForBooking={waitingForBooking}
          errorMessage={errorMessage}
          currentAppointmentId={currentAppointmentId}
          onSelect={onSelect}
        />
      </Spin>
    </section>
  );
}

type RowsProps = Omit<Props, "loading">;

function SessionRows({ sessions, waitingForBooking, errorMessage, currentAppointmentId, onSelect }: RowsProps) {
  if (errorMessage) return <p className="appt-series-note appt-series-note--error">{errorMessage}</p>;
  if (waitingForBooking) return <p className="appt-series-note">{t("Appointment:Series:PickFirst")}</p>;
  if (sessions.length === 0) return <p className="appt-series-note">{t("Appointment:Series:NoSessions")}</p>;

  return (
    <ol className="appt-series-list">
      {sessions.map((session) => (
        <SessionRow
          key={`${session.index}-${session.start}`}
          session={session}
          current={session.appointmentId !== null && session.appointmentId === currentAppointmentId}
          onSelect={onSelect}
        />
      ))}
    </ol>
  );
}

interface RowProps {
  session: SeriesSession;
  current: boolean;
  onSelect: (session: SeriesSession) => void;
}

/** "→ 15:30", plus the day when the follow-up landed on another one. */
function MovedTo({ start, movedTo }: { start: string; movedTo: string }) {
  const to = dayjs(movedTo);
  const sameDay = to.isSame(dayjs(start), "day");
  return (
    <span className="appt-series-moved" title={t("Appointment:Series:MovedTo", to.format("HH:mm DD/MM/YYYY"))}>
      → {to.format(sameDay ? "HH:mm" : "HH:mm DD/MM")}
    </span>
  );
}

function SessionRow({ session, current, onSelect }: RowProps) {
  const className = [
    "appt-series-row",
    `appt-series-row--${session.state}`,
    current && "appt-series-row--current",
  ].filter(Boolean).join(" ");
  const label = <span className={`appt-series-state appt-series-state--${session.state}`}>{t(STATE_LABEL_KEY[session.state])}</span>;

  return (
    <li>
      <button type="button" className={className} aria-current={current || undefined} onClick={() => onSelect(session)}>
        <span className="appt-series-index">{session.index}</span>
        <span className="appt-series-day">{sessionDayLabel(session.start)}</span>
        <span className="appt-series-time">
          {dayjs(session.start).format("HH:mm")} – {dayjs(session.end).format("HH:mm")}
          {session.movedTo && <MovedTo start={session.start} movedTo={session.movedTo} />}
        </span>
        {session.conflictReason ? <Tooltip title={t(REASON_LABEL_KEY[session.conflictReason])}>{label}</Tooltip> : label}
      </button>
    </li>
  );
}
