import { useMemo, useRef, useEffect, useState } from "react";
import type { Dayjs } from "dayjs";
import { Button } from "antd";

import { WorkScheduleCell, type CellKind } from "./WorkScheduleCell";
import { t } from "@/lib/i18n";

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

interface DayInfo {
  date: Dayjs;
  dayOfMonth: number;
  weekdayLabel: string;
  isWeekend: boolean;
}

interface StaffRow {
  id: string;
  name: string;
  position: string;
}

interface Props {
  month: Dayjs;
  staff: StaffRow[];
  getCellKind: (staffId: string, dateStr: string) => CellKind;
  isCellEditable: (staffId: string, dateStr: string) => boolean;
  onCellClick: (staffId: string, dateStr: string) => void;
  /** Opens "Đăng ký nghỉ"; given only for the rows the user may register leave on. */
  onLeaveClick: (staffId: string) => void;
  canRegisterLeave: (staffId: string) => boolean;
}

function buildDays(month: Dayjs): DayInfo[] {
  const daysInMonth = month.daysInMonth();
  const result: DayInfo[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = month.date(d);
    const dow = date.day();
    result.push({
      date,
      dayOfMonth: d,
      weekdayLabel: WEEKDAY_LABELS[dow],
      isWeekend: dow === 0 || dow === 6,
    });
  }
  return result;
}

const CalendarPlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" /><path d="M12 14v4" /><path d="M10 16h4" />
  </svg>
);

/**
 * Only the caller's own empty / X cells are clickable (BA 2026-10-02). Row
 * checkboxes and the bulk day-off button act on other staff, so they stay on
 * screen but locked for every role.
 */
export function WorkScheduleTable({
  month,
  staff,
  getCellKind,
  isCellEditable,
  onCellClick,
  onLeaveClick,
  canRegisterLeave,
}: Props) {
  const days = useMemo(() => buildDays(month), [month]);
  const monthLabel = `${t("Common:Month")} ${month.month() + 1} / ${month.year()}`;

  const checkThRef = useRef<HTMLTableCellElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [checkW, setCheckW] = useState(49);

  useEffect(() => {
    const el = checkThRef.current;
    if (!el) return;
    const measure = () => setCheckW(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="wsb-table-outer">
      <div className="wsb-subheader">
        <h3 className="wsb-subheader-title">{monthLabel}</h3>
        <Button size="small" disabled>
          {t("Timekeeping:DayOff")} (0)
        </Button>
      </div>

      <div className="wsb-table-scroll">
      <table className="wsb-table" ref={tableRef} style={{ "--wsb-check-w": `${checkW}px` } as React.CSSProperties}>
        <thead>
          <tr>
            <th ref={checkThRef} className="wsb-th-check" style={{ top: 0 }}>
              <input
                type="checkbox"
                className="wsb-checkbox"
                aria-label={t("Timekeeping:SelectAll")}
                disabled
              />
            </th>
            <th className="wsb-th-name" style={{ top: 0 }}>
              {t("Common:Staff")}
            </th>
            {days.map((d) => (
              <th
                key={d.dayOfMonth}
                className={[
                  "wsb-th-day",
                  d.isWeekend ? "wsb-th-day--weekend" : "wsb-th-day--weekday",
                ].join(" ")}
                style={{ top: 0 }}
              >
                <span className="wsb-th-day-label">{d.weekdayLabel}</span>
                <span className="wsb-th-day-num">{d.dayOfMonth}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id} className="group">
              <td className="wsb-td-check">
                <input
                  type="checkbox"
                  className="wsb-checkbox"
                  aria-label={`${t("Timekeeping:Select")} ${s.name}`}
                  disabled
                />
              </td>
              <td className="wsb-td-name">
                <div className="wsb-td-name-inner">
                  <div style={{ minWidth: 0 }}>
                    <span className="wsb-staff-name">{s.name}</span>
                    <span className="wsb-staff-pos">{s.position}</span>
                  </div>
                  <button
                    type="button"
                    className="wsb-cal-plus-btn"
                    aria-label={`${t("Timekeeping:BulkDayOff")} ${s.name}`}
                    title={t("Timekeeping:Leave:Title")}
                    disabled={!canRegisterLeave(s.id)}
                    onClick={() => onLeaveClick(s.id)}
                  >
                    <CalendarPlusIcon />
                  </button>
                </div>
              </td>
              {days.map((d) => {
                const dateStr = d.date.format("YYYY-MM-DD");
                const kind = getCellKind(s.id, dateStr);
                return (
                  <td
                    key={d.dayOfMonth}
                    className={[
                      "wsb-td-day",
                      d.isWeekend ? "wsb-td-day--weekend" : "wsb-td-day--weekday",
                    ].join(" ")}
                  >
                    <WorkScheduleCell
                      kind={kind}
                      disabled={!isCellEditable(s.id, dateStr)}
                      onClick={() => onCellClick(s.id, dateStr)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
