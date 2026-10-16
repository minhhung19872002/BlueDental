import { t } from "@/lib/i18n";
import { SLOT_SESSIONS, isPickable, slotState, type SlotSession, type SlotState } from "../utils/followUpSlots";
import type { FollowUpPicker } from "../hooks/useFollowUpPicker";

interface FollowUpSlotGridProps {
  picker: FollowUpPicker;
}

const SESSION_LABEL: Record<SlotSession["key"], string> = {
  morning: "Reception:FollowUpMorning",
  afternoon: "Reception:FollowUpAfternoon",
};

const SLOT_STATE_CLASS: Record<SlotState, string | false> = {
  free: false,
  busy: "fu-slot--busy",
  past: "fu-slot--off",
};

/**
 * The half-hour slots of the picked day. Past slots cannot be picked; when a
 * doctor is chosen, the ones that doctor is already booked for are marked but
 * stay pickable — booking one asks the user to confirm the overlap.
 */
export function FollowUpSlotGrid({ picker }: FollowUpSlotGridProps) {
  const { selectedDay, selectedTime, busy, now } = picker;

  return (
    <div className="fu-slots">
      {SLOT_SESSIONS.map((session) => (
        <div key={session.key} className="fu-session">
          <span className="fu-session-label">{t(SESSION_LABEL[session.key])}</span>
          <div className="fu-slot-row">
            {session.times.map((time) => {
              const state = selectedDay ? slotState(selectedDay, time, busy, now) : "past";
              const selected = time === selectedTime;
              const className = ["fu-slot", SLOT_STATE_CLASS[state], selected && "fu-slot--selected"]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={time}
                  type="button"
                  className={className}
                  disabled={!isPickable(state)}
                  aria-pressed={selected}
                  onClick={() => picker.handleTimeSelect(time)}
                >
                  {time}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="fu-legend">
        <span className="fu-legend-item"><i className="fu-swatch" />{t("Reception:FollowUpLegendFree")}</span>
        <span className="fu-legend-item"><i className="fu-swatch fu-swatch--selected" />{t("Reception:FollowUpLegendSelected")}</span>
        <span className="fu-legend-item"><i className="fu-swatch fu-swatch--busy" />{t("Reception:FollowUpLegendBusy")}</span>
      </div>
    </div>
  );
}
