import { t } from "@/lib/i18n";

/** Matches the board legend: 🟢 Làm việc · ⚪ Không điểm danh · 🔴 Vắng / Nghỉ. */
export type WorkStatus = "working" | "notCheckedIn" | "absent" | "dayOff";

interface Props {
  status: WorkStatus;
}

/** Thumb slot (0 = OFF, 1 = neutral dot, 2 = ON), tint and label per status. */
const STATUS_CONFIG: Record<WorkStatus, { slot: number; modClass: string; labelKey: string }> = {
  working: { slot: 2, modClass: "tk-toggle--on", labelKey: "Timekeeping:Working" },
  notCheckedIn: { slot: 1, modClass: "", labelKey: "Timekeeping:NotCheckedIn" },
  absent: { slot: 0, modClass: "tk-toggle--off", labelKey: "Timekeeping:Absent" },
  dayOff: { slot: 0, modClass: "tk-toggle--off", labelKey: "Timekeeping:DayOff" },
};

function thumbLeft(position: number): string {
  return `calc(${(position * 100) / 3 + 100 / 6}% - 16px)`;
}

/**
 * The OFF/ON pill on a timekeeping card. Read-only (BA 2026-10-02): nobody
 * flips it by hand any more — it reads ON once a shift has been checked in on
 * the progress bar, OFF on today or a past day without one, and stays neutral
 * on a day that has not come yet. A day registered off (X on the Lịch làm việc
 * grid, whole day) reads OFF whatever the date.
 */
export function WorkStatusToggle({ status }: Props) {
  const { slot, modClass, labelKey } = STATUS_CONFIG[status];
  const label = t(labelKey);

  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={["tk-toggle", modClass].filter(Boolean).join(" ")}
    >
      <span className="tk-toggle-thumb" style={{ left: thumbLeft(slot) }} />
      <span className="tk-toggle-btn tk-toggle-btn--off" aria-hidden="true">
        OFF
      </span>
      <span className="tk-toggle-btn tk-toggle-btn--neutral" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
        </svg>
      </span>
      <span className="tk-toggle-btn tk-toggle-btn--on" aria-hidden="true">
        ON
      </span>
    </div>
  );
}
