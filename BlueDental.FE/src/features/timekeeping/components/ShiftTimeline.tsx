import type { WorkShiftDto, WorkShiftKind } from "../api/timekeepingApi";
import { WORK_SHIFT_KIND } from "../api/timekeepingApi";
import { t } from "@/lib/i18n";

interface Props {
  morningShift: WorkShiftDto;
  afternoonShift: WorkShiftDto;
  disabled?: boolean;
  onCheckIn: (kind: WorkShiftKind) => void;
  onCheckOut: (kind: WorkShiftKind) => void;
}

function formatStamp(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const LogInIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m10 17 5-5-5-5" /><path d="M15 12H3" /><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
  </svg>
);

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

const LogOutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m16 17 5-5-5-5" /><path d="M21 12H9" /><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
  </svg>
);

interface StepConfig {
  id: string;
  icon: React.FC;
  label: string;
  circleClass: string;
  lineColor: string;
}

const STEPS: StepConfig[] = [
  { id: "checkin", icon: LogInIcon, label: "Vào ca", circleClass: "tk-timeline-circle--checkin", lineColor: "rgb(217, 149, 36)" },
  { id: "morning", icon: SunIcon, label: "Ca sáng", circleClass: "tk-timeline-circle--morning", lineColor: "rgb(53, 168, 115)" },
  { id: "afternoon", icon: LogOutIcon, label: "Vào ca chiều", circleClass: "tk-timeline-circle--afternoon", lineColor: "rgb(118, 87, 223)" },
  { id: "end", icon: MoonIcon, label: "Kết ca", circleClass: "tk-timeline-circle--end", lineColor: "" },
];

export function ShiftTimeline({ morningShift, afternoonShift, disabled, onCheckIn, onCheckOut }: Props) {
  const morningCheckedIn = Boolean(morningShift.checkedInAt);
  const morningCheckedOut = Boolean(morningShift.checkedOutAt);
  const afternoonCheckedIn = Boolean(afternoonShift.checkedInAt);
  const afternoonCheckedOut = Boolean(afternoonShift.checkedOutAt);

  const stepStates = [
    { active: morningCheckedIn, time: formatStamp(morningShift.checkedInAt), timeColor: "rgb(63, 123, 232)" },
    { active: morningCheckedOut, time: formatStamp(morningShift.checkedOutAt), timeColor: "rgb(217, 149, 36)" },
    { active: afternoonCheckedIn, time: formatStamp(afternoonShift.checkedInAt), timeColor: "rgb(53, 168, 115)" },
    { active: afternoonCheckedOut, time: formatStamp(afternoonShift.checkedOutAt), timeColor: "rgb(118, 87, 223)" },
  ];

  const stepDisabled = [
    disabled ?? false,
    disabled || !morningCheckedIn,
    disabled || !morningCheckedOut,
    disabled || !afternoonCheckedIn,
  ];

  const handleClick = (idx: number) => {
    switch (idx) {
      case 0: onCheckIn(WORK_SHIFT_KIND.Morning); break;
      case 1: onCheckOut(WORK_SHIFT_KIND.Morning); break;
      case 2: onCheckIn(WORK_SHIFT_KIND.Afternoon); break;
      case 3: onCheckOut(WORK_SHIFT_KIND.Afternoon); break;
    }
  };

  return (
    <div className="tk-timeline">
      {STEPS.map((step, idx) => {
        const state = stepStates[idx];
        const Icon = step.icon;
        const isDisabled = stepDisabled[idx] || state.active;

        return (
          <div key={step.id} className="tk-timeline-step">
            {idx > 0 && (
              <span className="tk-timeline-line">
                <span
                  className={[
                    "tk-timeline-line-fill",
                    state.active && "tk-timeline-line-fill--active",
                  ].filter(Boolean).join(" ")}
                  style={{ backgroundColor: STEPS[idx].lineColor || stepStates[idx].timeColor }}
                />
              </span>
            )}
            <div className="tk-timeline-node">
              <button
                type="button"
                className={[
                  "tk-timeline-circle",
                  step.circleClass,
                  state.active && "tk-timeline-circle--active",
                ].filter(Boolean).join(" ")}
                disabled={isDisabled}
                aria-label={t(step.label)}
                onClick={() => handleClick(idx)}
              >
                <Icon />
              </button>
              <span
                className={[
                  "tk-timeline-time",
                  state.time && "tk-timeline-time--visible",
                ].filter(Boolean).join(" ")}
                style={{ color: state.timeColor }}
              >
                {state.time}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
