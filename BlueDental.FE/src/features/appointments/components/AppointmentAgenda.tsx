import { useState, type CSSProperties } from "react";
import { Button, Tooltip } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  MenuOutlined,
  TableOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { DateNavigator, type DateNavigatorMode } from "@/components/DateNavigator";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { t } from "@/lib/i18n";
import { useAppointmentList } from "../api/appointmentQueries";
import type { Appointment, AppointmentColor } from "../types/appointment";

/**
 * "Lịch đã hẹn" — the clinic's own diary, shown under the booking form so the
 * slot being chosen can be seen against everything already in the day.
 *
 * It is deliberately *not* filtered to the patient: the reference asks for the
 * whole branch (`GET /schedules?branchId&startTime&toTime`), because the point
 * is to spot a clash. See docs/clone/pages/patient-detail.md §Tạo lịch hẹn.
 */

/** The reference's day axis: 06:00 to midnight, one column per half hour. */
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 24;
const MINUTES_PER_TICK = 30;
const PIXELS_PER_TICK = 60;
const TICK_COUNT = ((DAY_END_HOUR - DAY_START_HOUR) * 60) / MINUTES_PER_TICK;
const LANE_WIDTH = TICK_COUNT * PIXELS_PER_TICK;
const LANE_GUTTER = 180;

const WEEKDAY_LABELS = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];

/** How the day is drawn: one shared lane, or one lane per doctor. */
type DayLayout = "timeline" | "byDoctor";

/** The three tallies the reference prints inside a month cell. */
const MONTH_COUNTS = [
  { key: "arrived", label: "Đã đến", icon: <CheckCircleOutlined /> },
  { key: "cancelled", label: "Đã huỷ", icon: <CloseCircleOutlined /> },
  { key: "booked", label: "Đã hẹn", icon: <ClockCircleOutlined /> },
] as const;

type MonthCountKey = (typeof MONTH_COUNTS)[number]["key"];

function countKeyOf(appointment: Appointment): MonthCountKey | null {
  if (appointment.status === "cancelled") return "cancelled";
  if (appointment.status === "inProgress" || appointment.status === "completed") return "arrived";
  if (appointment.status === "scheduled" || appointment.status === "confirmed") return "booked";
  return null;
}

/** Minutes from the axis origin, clamped so a card never leaves the lane. */
function offsetMinutes(at: Dayjs, day: Dayjs): number {
  const origin = day.startOf("day").add(DAY_START_HOUR, "hour");
  return Math.min(Math.max(at.diff(origin, "minute"), 0), TICK_COUNT * MINUTES_PER_TICK);
}

function cardBounds(start: Dayjs, end: Dayjs, day: Dayjs) {
  const from = offsetMinutes(start, day);
  const to = Math.max(offsetMinutes(end, day), from + MINUTES_PER_TICK / 2);
  const scale = PIXELS_PER_TICK / MINUTES_PER_TICK;
  return { left: from * scale, width: (to - from) * scale };
}

/** What the agenda asks the server for, given the mode it is showing. */
function rangeOf(anchor: Dayjs, mode: DateNavigatorMode) {
  if (mode === "day") return { from: anchor, to: anchor };
  if (mode === "week") return { from: anchor.startOf("week"), to: anchor.endOf("week") };
  return { from: anchor.startOf("month").startOf("week"), to: anchor.endOf("month").endOf("week") };
}

interface AgendaProps {
  /** The date the form is booking; the agenda opens on it. */
  date: string;
  /** The slot being booked, drawn hatched over the lane it lands on. */
  draft?: { start: string; end: string; color: AppointmentColor } | null;
  /** Picking a date in the agenda moves the form's own "Ngày hẹn". */
  onPickDate: (date: string) => void;
}

export function AppointmentAgenda({ date, draft, onPickDate }: AgendaProps) {
  const [mode, setMode] = useState<DateNavigatorMode>("day");
  const [layout, setLayout] = useState<DayLayout>("timeline");

  const anchor = dayjs(date, "YYYY-MM-DD", true).isValid() ? dayjs(date) : dayjs();
  const range = rangeOf(anchor, mode);

  const query = useAppointmentList({
    fromDate: range.from.format("YYYY-MM-DD"),
    toDate: range.to.format("YYYY-MM-DD"),
    maxResultCount: 200,
  });
  const appointments = query.data?.items ?? [];

  const modeTabs = [
    { key: "day" as const, label: t("Ngày") },
    { key: "week" as const, label: t("Tuần") },
    { key: "month" as const, label: t("Tháng") },
  ];

  return (
    <section className="bd-appt-agenda">
      <header className="bd-appt-agenda-head">
        <div className="bd-appt-agenda-title">
          <h3>{t("Lịch đã hẹn")}</h3>
          {mode === "day" && (
            <Tooltip title={t("Đổi cách xem")}>
              <Button
                shape="circle"
                aria-label={t("Đổi cách xem")}
                aria-pressed={layout === "byDoctor"}
                icon={layout === "timeline" ? <MenuOutlined /> : <TableOutlined />}
                onClick={() => setLayout((value) => (value === "timeline" ? "byDoctor" : "timeline"))}
              />
            </Tooltip>
          )}
        </div>

        <div className="bd-appt-agenda-tools">
          <SegmentedTabs items={modeTabs} activeKey={mode} onChange={setMode} />
          <DateNavigator
            value={anchor}
            mode={mode}
            onChange={(next) => onPickDate(next.format("YYYY-MM-DD"))}
          />
        </div>
      </header>

      <div className="bd-appt-agenda-body">
        {mode === "day" && (
          <DayAgenda day={anchor} layout={layout} appointments={appointments} draft={draft} />
        )}
        {mode === "week" && <WeekAgenda from={range.from} appointments={appointments} />}
        {mode === "month" && <MonthAgenda anchor={anchor} appointments={appointments} />}
      </div>
    </section>
  );
}

interface DayProps {
  day: Dayjs;
  layout: DayLayout;
  appointments: Appointment[];
  draft?: { start: string; end: string; color: AppointmentColor } | null;
}

function DayAgenda({ day, layout, appointments, draft }: DayProps) {
  const onThisDay = appointments.filter((item) => dayjs(item.startTime).isSame(day, "day"));

  // One lane, or one per doctor with a label gutter — the two the reference's
  // "Đổi cách xem" flips between.
  const lanes =
    layout === "byDoctor"
      ? [...new Map(onThisDay.map((item) => [item.doctorId, item.doctorName])).entries()].map(
          ([id, name]) => ({ id, name, rows: onThisDay.filter((item) => item.doctorId === id) }),
        )
      : [{ id: "all", name: "", rows: onThisDay }];

  const laned = layout === "byDoctor" && lanes.length > 0;

  return (
    <div
      className={["bd-appt-day", laned && "bd-appt-day--laned"].filter(Boolean).join(" ")}
      style={
        {
          "--lane-width": `${LANE_WIDTH + (laned ? LANE_GUTTER : 0)}px`,
          "--lane-gutter": `${LANE_GUTTER}px`,
        } as CSSProperties
      }
    >
      <div className="bd-appt-ticks" style={{ width: LANE_WIDTH }}>
        {Array.from({ length: TICK_COUNT }, (_, index) => (
          <span
            key={index}
            className={["bd-appt-tick", index === 0 && "bd-appt-tick--first"]
              .filter(Boolean)
              .join(" ")}
            style={{ left: index * PIXELS_PER_TICK }}
          >
            {day
              .startOf("day")
              .add(DAY_START_HOUR * 60 + index * MINUTES_PER_TICK, "minute")
              .format("HH:mm")}
          </span>
        ))}
      </div>

      <div className="bd-appt-lanes" style={{ width: LANE_WIDTH }}>
        {Array.from({ length: TICK_COUNT }, (_, index) => (
          <span
            key={index}
            className="bd-appt-gridline"
            style={{ left: index * PIXELS_PER_TICK }}
            aria-hidden="true"
          />
        ))}

        {lanes.map((lane) => (
          <div className="bd-appt-lane" key={lane.id}>
            {lane.name ? <span className="bd-appt-lane-label">{lane.name}</span> : null}
            {lane.rows.map((item) => {
              const bounds = cardBounds(dayjs(item.startTime), dayjs(item.endTime), day);
              return (
                <div
                  key={item.id}
                  className={`bd-appt-card bd-appt-card--${item.color}`}
                  style={{ left: bounds.left, width: bounds.width }}
                  title={`${dayjs(item.startTime).format("HH:mm")} · ${item.patientName}`}
                >
                  <strong>{item.patientName}</strong>
                  <span>
                    {dayjs(item.startTime).format("HH:mm")} · {item.doctorName}
                  </span>
                </div>
              );
            })}
          </div>
        ))}

        {draft && dayjs(draft.start).isSame(day, "day") ? (
          <div className="bd-appt-lane">
            {(() => {
              const bounds = cardBounds(dayjs(draft.start), dayjs(draft.end), day);
              return (
                <div
                  className={`bd-appt-card bd-appt-card--draft bd-appt-card--${draft.color}`}
                  style={{ left: bounds.left, width: bounds.width }}
                >
                  <strong>{t("Lịch hẹn đang tạo")}</strong>
                  <span>
                    {dayjs(draft.start).format("HH:mm")} – {dayjs(draft.end).format("HH:mm")}
                  </span>
                </div>
              );
            })()}
          </div>
        ) : null}
      </div>

      {onThisDay.length === 0 && !draft ? (
        <p className="bd-appt-empty">
          {t("Chưa có lịch hẹn ngày {0}", day.format("DD/MM/YYYY"))}
        </p>
      ) : null}
    </div>
  );
}

function WeekAgenda({ from, appointments }: { from: Dayjs; appointments: Appointment[] }) {
  const today = dayjs().startOf("day");

  return (
    <div className="bd-appt-week">
      {Array.from({ length: 7 }, (_, index) => {
        const day = from.add(index, "day");
        const rows = appointments.filter((item) => dayjs(item.startTime).isSame(day, "day"));
        const isToday = day.isSame(today, "day");

        return (
          <div
            key={day.format("YYYY-MM-DD")}
            className={["bd-appt-weekday", isToday && "bd-appt-weekday--today"]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="bd-appt-weekday-head">
              <b>{day.format("DD")}</b>
              <span>{t(WEEKDAY_LABELS[index])}</span>
            </div>

            {rows.length === 0 ? (
              <div className="bd-appt-slot" />
            ) : (
              rows.map((item) => (
                <div key={item.id} className={`bd-appt-chip bd-appt-chip--${item.color}`}>
                  <b>{item.patientName}</b>
                  <span>
                    {dayjs(item.startTime).format("HH:mm")} · {item.doctorName}
                  </span>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

function MonthAgenda({ anchor, appointments }: { anchor: Dayjs; appointments: Appointment[] }) {
  const first = anchor.startOf("month").startOf("week");
  const weeks = Math.ceil(anchor.endOf("month").endOf("week").diff(first, "day") / 7);

  return (
    <div className="bd-appt-month">
      {WEEKDAY_LABELS.map((label) => (
        <div className="bd-appt-month-head" key={label}>
          {t(label)}
        </div>
      ))}

      {Array.from({ length: weeks * 7 }, (_, index) => {
        const day = first.add(index, "day");
        const outside = !day.isSame(anchor, "month");
        const rows = appointments.filter((item) => dayjs(item.startTime).isSame(day, "day"));

        return (
          <div
            key={day.format("YYYY-MM-DD")}
            className={["bd-appt-month-cell", outside && "bd-appt-month-cell--outside"]
              .filter(Boolean)
              .join(" ")}
          >
            <b>{day.format("D")}</b>
            {rows.length > 0
              ? MONTH_COUNTS.map((count) => (
                  <span className={`bd-appt-count bd-appt-count--${count.key}`} key={count.key}>
                    {count.icon}
                    {t(count.label)}
                    <em>({rows.filter((item) => countKeyOf(item) === count.key).length})</em>
                  </span>
                ))
              : null}
          </div>
        );
      })}
    </div>
  );
}
