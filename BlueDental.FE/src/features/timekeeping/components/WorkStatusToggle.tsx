import type { WorkRegistration } from "../api/timekeepingApi";
import { WORK_REGISTRATION } from "../api/timekeepingApi";
import { t } from "@/lib/i18n";

interface Props {
  value: WorkRegistration;
  disabled?: boolean;
  onChange: (reg: WorkRegistration) => void;
}

const THUMB_POSITIONS: Record<WorkRegistration, number> = {
  [WORK_REGISTRATION.DayOff]: 0,
  [WORK_REGISTRATION.NotRegistered]: 1,
  [WORK_REGISTRATION.Working]: 2,
};

function thumbLeft(position: number): string {
  return `calc(${(position * 100) / 3 + 100 / 6}% - 16px)`;
}

export function WorkStatusToggle({ value, disabled, onChange }: Props) {
  const pos = THUMB_POSITIONS[value] ?? 1;
  const modClass =
    value === WORK_REGISTRATION.DayOff
      ? "tk-toggle--off"
      : value === WORK_REGISTRATION.Working
        ? "tk-toggle--on"
        : "";

  return (
    <div className={["tk-toggle", modClass].filter(Boolean).join(" ")}>
      <span
        className="tk-toggle-thumb"
        style={{ left: thumbLeft(pos) }}
      />
      <button
        type="button"
        className="tk-toggle-btn tk-toggle-btn--off"
        title={t("Nghỉ hôm nay")}
        aria-label={t("Nghỉ hôm nay")}
        disabled={disabled}
        onClick={() => onChange(WORK_REGISTRATION.DayOff)}
      >
        OFF
      </button>
      <button
        type="button"
        className="tk-toggle-btn tk-toggle-btn--neutral"
        title={t("Chưa chọn")}
        aria-label={t("Chưa chọn")}
        disabled={disabled}
        onClick={() => onChange(WORK_REGISTRATION.NotRegistered)}
      >
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
      </button>
      <button
        type="button"
        className="tk-toggle-btn tk-toggle-btn--on"
        title={t("Làm việc hôm nay")}
        aria-label={t("Làm việc hôm nay")}
        disabled={disabled}
        onClick={() => onChange(WORK_REGISTRATION.Working)}
      >
        ON
      </button>
    </div>
  );
}
