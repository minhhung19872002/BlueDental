import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Dayjs } from "dayjs";
import { t } from "@/lib/i18n";
import {
  QUICK_PICKS,
  bookedOn,
  dayState,
  freeMinutes,
  freeStretches,
  isPickable,
  openWindows,
  quickPickDate,
  weekDays,
  type DayState,
} from "../utils/followUpSlots";
import type { FollowUpPicker } from "../hooks/useFollowUpPicker";
import { FollowUpStepHead } from "./FollowUpStepHead";

interface FollowUpWeekStripProps {
  picker: FollowUpPicker;
}

const QUICK_PICK_LABEL = {
  "1w": "Reception:FollowUpQuick1w",
  "2w": "Reception:FollowUpQuick2w",
  "3w": "Reception:FollowUpQuick3w",
  "1m": "Reception:FollowUpQuick1m",
} as const;

/** "5h15" — what is left to book that day. */
const hoursText = (minutes: number) =>
  `${Math.floor(minutes / 60)}h${minutes % 60 ? String(minutes % 60).padStart(2, "0") : ""}`;

const DAY_STATUS: Record<Exclude<DayState, "free" | "unknown">, string> = {
  past: "Reception:FollowUpDayPast",
  off: "Reception:FollowUpDayOff",
  full: "Reception:FollowUpDayFull",
};

function dayStatus(state: DayState, free: number): string {
  if (state === "free") return t("Reception:FollowUpDayFreeHours", hoursText(free));
  if (state === "unknown") return "";
  return t(DAY_STATUS[state]);
}

/** Step 2: the month, the week arrows, the quick picks and the seven days Monday → Sunday. */
export function FollowUpWeekStrip({ picker }: FollowUpWeekStripProps) {
  const { weekStart, selectedDay, shownWeek, now } = picker;
  const days = weekDays(weekStart);
  const inWeek = !!selectedDay && days.some((d) => d.isSame(selectedDay, "day"));
  const monthOf = inWeek && selectedDay ? selectedDay : weekStart;

  const nav = (
    <div className="fu-week-nav">
      <span className="fu-week-month">{t("Reception:FollowUpMonth", monthOf.format("MM/YYYY"))}</span>
      <button
        type="button"
        className="fu-nav-btn"
        aria-label={t("Common:PrevWeek")}
        disabled={!picker.canGoBack}
        onClick={picker.handlePrevWeek}
      >
        <ChevronLeft size={14} />
      </button>
      <button type="button" className="fu-nav-btn" aria-label={t("Common:NextWeek")} onClick={picker.handleNextWeek}>
        <ChevronRight size={14} />
      </button>
    </div>
  );

  const renderDay = (day: Dayjs, i: number) => {
    const workDay = shownWeek.workDayOf(day);
    const open = workDay ? openWindows(day, workDay, now) : [];
    const free = freeMinutes(freeStretches(open, bookedOn(day, shownWeek.busy)));
    const state = dayState(day, workDay, open, free, now);
    const status = dayStatus(state, free);
    const selected = !!selectedDay && day.isSame(selectedDay, "day");
    const className = ["fu-day", `fu-day--${state}`, selected && "fu-day--selected"].filter(Boolean).join(" ");
    const label = t("Reception:FollowUpPickDay", day.format("DD/MM/YYYY"));
    return (
      <button
        key={day.valueOf()}
        type="button"
        className={className}
        disabled={!isPickable(state)}
        aria-pressed={selected}
        aria-label={status ? `${label} · ${status}` : label}
        title={status || undefined}
        onClick={() => picker.handleDaySelect(day)}
      >
        <span className="fu-day-name">{t(`Reception:Weekday${i + 1}`)}</span>
        <span className="fu-day-num">{day.format("DD")}</span>
        <span className="fu-day-dot" aria-hidden />
      </button>
    );
  };

  return (
    <div className="fu-section">
      <FollowUpStepHead index={2} title={t("Reception:FollowUpStepDay")} aside={nav} />
      <div className="fu-quick">
        <span className="fu-quick-label">{t("Reception:FollowUpQuickPick")}</span>
        {QUICK_PICKS.map(({ key }) => (
          <button
            key={key}
            type="button"
            className={`fu-chip${picker.quickPick === key ? " fu-chip--on" : ""}`}
            aria-pressed={picker.quickPick === key}
            onClick={() => picker.handleQuickPick(key)}
          >
            {t(QUICK_PICK_LABEL[key], quickPickDate(picker.today, key).format("DD/MM"))}
          </button>
        ))}
      </div>
      <div className="fu-days">{days.map(renderDay)}</div>
    </div>
  );
}
