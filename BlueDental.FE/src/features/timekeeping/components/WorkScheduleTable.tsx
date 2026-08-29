import { useMemo } from "react";
import dayjs, { type Dayjs } from "dayjs";
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
  onCellClick: (staffId: string, dateStr: string) => void;
  dayOffCount: number;
  selectedStaff: Set<string>;
  allSelected: boolean;
  onStaffSelect: (staffId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onDayOffClick: () => void;
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

export function WorkScheduleTable({
  month,
  staff,
  getCellKind,
  onCellClick,
  dayOffCount,
  selectedStaff,
  allSelected,
  onStaffSelect,
  onSelectAll,
  onDayOffClick,
}: Props) {
  const days = useMemo(() => buildDays(month), [month]);
  const today = dayjs().format("YYYY-MM-DD");
  const monthLabel = `${t("Tháng")} ${month.month() + 1} / ${month.year()}`;
  const hasSelection = selectedStaff.size > 0;

  return (
    <div className="wsb-table-outer">
      <div className="wsb-subheader">
        <h3 className="wsb-subheader-title">{monthLabel}</h3>
        <Button
          size="small"
          disabled={!hasSelection}
          onClick={onDayOffClick}
        >
          {t("Nghỉ")} ({selectedStaff.size})
        </Button>
      </div>

      <div className="wsb-table-scroll">
      <table className="wsb-table">
        <thead>
          <tr>
            <th className="wsb-th-check" style={{ top: 0 }}>
              <input
                type="checkbox"
                className="wsb-checkbox"
                aria-label={t("Chọn tất cả nhân viên")}
                checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
              />
            </th>
            <th className="wsb-th-name" style={{ top: 0 }}>
              {t("Nhân viên")}
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
                  aria-label={`${t("Chọn")} ${s.name}`}
                  checked={selectedStaff.has(s.id)}
                  onChange={(e) => onStaffSelect(s.id, e.target.checked)}
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
                    aria-label={`${t("Đăng ký nghỉ nhiều ngày cho")} ${s.name}`}
                    disabled
                  >
                    <CalendarPlusIcon />
                  </button>
                </div>
              </td>
              {days.map((d) => {
                const dateStr = d.date.format("YYYY-MM-DD");
                const kind = getCellKind(s.id, dateStr);
                const isPast = dateStr < today;
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
                      disabled={isPast}
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
