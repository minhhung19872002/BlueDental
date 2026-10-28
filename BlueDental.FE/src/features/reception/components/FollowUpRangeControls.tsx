import { t } from "@/lib/i18n";
import { DURATIONS, STEP_MINUTES, hhmm } from "../utils/followUpSlots";
import type { FollowUpPicker } from "../hooks/useFollowUpPicker";
import type { MinuteSpan } from "../types/reception";

interface FollowUpRangeControlsProps {
  picker: FollowUpPicker;
}

type Edge = keyof MinuteSpan;

const STEPPERS: { edge: Edge; label: string; earlier: string; later: string }[] = [
  { edge: "start", label: "Reception:FollowUpFrom", earlier: "Reception:FollowUpStartEarlier", later: "Reception:FollowUpStartLater" },
  { edge: "end", label: "Reception:FollowUpTo", earlier: "Reception:FollowUpEndEarlier", later: "Reception:FollowUpEndLater" },
];

/**
 * Under the timeline: Từ / Đến move either end by a quarter hour, and the
 * length chips stretch the range from its start. A move that would leave the
 * doctor's hours is off.
 */
export function FollowUpRangeControls({ picker }: FollowUpRangeControlsProps) {
  const range = picker.selectedRange;

  const renderNudge = (edge: Edge, by: number, label: string, symbol: string) => {
    const next = range && { ...range, [edge]: range[edge] + by };
    return (
      <button
        type="button"
        className="fu-nudge"
        aria-label={t(label)}
        disabled={!next || !picker.canFit(next)}
        onClick={() => next && picker.handleRangeChange(next)}
      >
        {symbol}
      </button>
    );
  };

  return (
    <div className="fu-range">
      {STEPPERS.map((s) => (
        <div key={s.edge} className="fu-stepper">
          <span className="fu-stepper-label">{t(s.label)}</span>
          {renderNudge(s.edge, -STEP_MINUTES, s.earlier, "−")}
          <span className={`fu-time fu-time--${s.edge}`}>{range ? hhmm(range[s.edge]) : "--:--"}</span>
          {renderNudge(s.edge, STEP_MINUTES, s.later, "+")}
        </div>
      ))}
      <div className="fu-durations">
        {DURATIONS.map((minutes) => {
          const next = range && { start: range.start, end: range.start + minutes };
          const on = !!range && range.end - range.start === minutes;
          return (
            <button
              key={minutes}
              type="button"
              className={`fu-duration${on ? " fu-duration--on" : ""}`}
              aria-pressed={on}
              disabled={!next || !picker.canFit(next)}
              onClick={() => next && picker.handleRangeChange(next)}
            >
              {t("Reception:FollowUpMinutes", minutes)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
