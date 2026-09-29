import { ChevronLeft, ChevronRight } from "lucide-react";
import { t } from "@/lib/i18n";
import { dayState, weekDays, type DayState } from "../utils/followUpSlots";
import type { FollowUpPicker } from "../hooks/useFollowUpPicker";

interface FollowUpWeekStripProps {
  picker: FollowUpPicker;
}

const DAY_STATE_LABEL: Record<DayState, string> = {
  free: "Reception:FollowUpDayFree",
  full: "Reception:FollowUpDayFull",
  past: "Reception:FollowUpDayPast",
};

/** Month label, week arrows and the seven days Monday → Sunday. */
export function FollowUpWeekStrip({ picker }: FollowUpWeekStripProps) {
  const { weekStart, selectedDay, busy, now } = picker;
  const monthOf = selectedDay ?? weekStart;

  return (
    <div className="fu-week">
      <div className="fu-week-head">
        <span className="fu-week-month">{t("Reception:FollowUpMonth", monthOf.format("MM/YYYY"))}</span>
        <div className="fu-week-nav">
          <button
            type="button"
            className="fu-nav-btn"
            aria-label={t("Common:PrevWeek")}
            disabled={!picker.canGoBack}
            onClick={picker.handlePrevWeek}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            className="fu-nav-btn"
            aria-label={t("Common:NextWeek")}
            onClick={picker.handleNextWeek}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="fu-days">
        {weekDays(weekStart).map((day, i) => {
          const state = dayState(day, busy, now);
          const selected = !!selectedDay && day.isSame(selectedDay, "day");
          const className = ["fu-day", `fu-day--${state}`, selected && "fu-day--selected"]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={day.valueOf()}
              type="button"
              className={className}
              disabled={state !== "free"}
              aria-pressed={selected}
              aria-label={t("Reception:FollowUpPickDay", day.format("DD/MM/YYYY"))}
              onClick={() => picker.handleDaySelect(day)}
            >
              <span className="fu-day-name">{t(`Reception:Weekday${i + 1}`)}</span>
              <span className="fu-day-num">{day.format("DD")}</span>
              <span className="fu-day-state">{t(DAY_STATE_LABEL[state])}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
