import { t } from "@/lib/i18n";
import { SLOT_SESSIONS, slotState, type SlotSession } from "../utils/followUpSlots";
import type { FollowUpPicker } from "../hooks/useFollowUpPicker";

interface FollowUpSlotGridProps {
  picker: FollowUpPicker;
}

const SESSION_LABEL: Record<SlotSession["key"], string> = {
  morning: "Reception:FollowUpMorning",
  afternoon: "Reception:FollowUpAfternoon",
};

/**
 * The half-hour slots of the picked day. Past slots and, when a doctor is
 * chosen, the ones that doctor is already booked for cannot be picked.
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
              const className = ["fu-slot", state !== "free" && "fu-slot--off", selected && "fu-slot--selected"]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={time}
                  type="button"
                  className={className}
                  disabled={state !== "free"}
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
        <span className="fu-legend-item"><i className="fu-swatch fu-swatch--off" />{t("Reception:FollowUpLegendBusy")}</span>
      </div>
    </div>
  );
}
