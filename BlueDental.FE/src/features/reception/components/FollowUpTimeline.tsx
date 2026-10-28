import { t } from "@/lib/i18n";
import type { SessionKey } from "../utils/followUpSlots";
import type { FollowUpPicker } from "../hooks/useFollowUpPicker";
import { FollowUpRangeControls } from "./FollowUpRangeControls";
import { FollowUpStepHead } from "./FollowUpStepHead";
import { FollowUpTrack } from "./FollowUpTrack";

interface FollowUpTimelineProps {
  picker: FollowUpPicker;
}

const SESSIONS: { key: SessionKey; label: string }[] = [
  { key: "morning", label: "Reception:FollowUpMorning" },
  { key: "afternoon", label: "Reception:FollowUpAfternoon" },
];

const LEGEND = [
  { swatch: "free", label: "Reception:FollowUpLegendFree" },
  { swatch: "selected", label: "Reception:FollowUpLegendSelected" },
  { swatch: "busy", label: "Reception:FollowUpLegendBusy" },
  { swatch: "off", label: "Reception:FollowUpLegendOff" },
] as const;

/** What the bars say before they can be drawn. */
function emptyText(picker: FollowUpPicker): string {
  if (!picker.selectedDay) return t("Reception:FollowUpSessionPickDay");
  if (!picker.doctorId) return t("Reception:FollowUpSessionPickDoctor");
  return t("Common:Loading");
}

/** Step 3: the picked day's morning and afternoon, the range controls and the legend. */
export function FollowUpTimeline({ picker }: FollowUpTimelineProps) {
  const empty = emptyText(picker);

  return (
    <div className="fu-section fu-section--time">
      <FollowUpStepHead index={3} title={t("Reception:FollowUpStepTime")} hint={t("Reception:FollowUpStepTimeHint")} />
      {SESSIONS.map((s) => (
        <FollowUpTrack
          key={s.key}
          label={t(s.label)}
          track={picker.tracks?.find((tr) => tr.key === s.key) ?? null}
          emptyText={empty}
          selected={picker.selectedRange}
          onRange={picker.handleRangeChange}
        />
      ))}
      <div className="fu-under-track">
        <FollowUpRangeControls picker={picker} />
        <div className="fu-legend">
          {LEGEND.map((l) => (
            <span key={l.swatch} className="fu-legend-item">
              <i className={`fu-swatch fu-swatch--${l.swatch}`} />
              {t(l.label)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
