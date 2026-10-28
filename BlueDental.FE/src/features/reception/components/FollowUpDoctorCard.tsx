import { useState } from "react";
import { Popover } from "antd";
import { ChevronDown } from "lucide-react";
import type { SearchSelectOption } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import { hhmm, shiftRuns, weekDays, type ShiftRun } from "../utils/followUpSlots";
import type { FollowUpPicker } from "../hooks/useFollowUpPicker";
import { FollowUpDoctorList } from "./FollowUpDoctorList";
import { FollowUpStepHead } from "./FollowUpStepHead";

interface FollowUpDoctorCardProps {
  picker: FollowUpPicker;
  options: SearchSelectOption[];
  offError: string | null;
}

const TITLE_PREFIX = /^(BS|ThS|TS|PGS)\.?\s+/i;

/** "BS. Lê Thu Hà" → "LH": the first and last word, past the title. */
function initials(name: string): string {
  const words = name.replace(TITLE_PREFIX, "").split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return `${words[0][0]}${last}`.toUpperCase();
}

const weekdayShort = (index: number) => t(`Reception:Weekday${index + 1}`);

/** "T2–T6 08:00–12:00, 13:00–17:00 · T7 08:00–12:00 · CN nghỉ". */
function describeRuns(runs: ShiftRun[]): string {
  return runs
    .map(({ first, last, windows }) => {
      const days = first === last ? weekdayShort(first) : `${weekdayShort(first)}–${weekdayShort(last)}`;
      const hours = windows.length
        ? windows.map((w) => `${hhmm(w.start)}–${hhmm(w.end)}`).join(", ")
        : t("Reception:FollowUpShiftOff");
      return `${days} ${hours}`;
    })
    .join(" · ");
}

/**
 * Step 1: the doctor the follow-up goes to, with their hours for the week on
 * screen. "Đổi bác sĩ" offers only the doctors not off on the picked day.
 */
export function FollowUpDoctorCard({ picker, options, offError }: FollowUpDoctorCardProps) {
  const [open, setOpen] = useState(false);
  const name = options.find((o) => o.value === picker.doctorId)?.label;
  const runs = shiftRuns(weekDays(picker.weekStart).map(picker.shownWeek.workDayOf));
  const shiftLine = runs.length
    ? t("Reception:FollowUpShifts", describeRuns(runs))
    : picker.doctorId && t("Reception:FollowUpShiftsLoading");

  const handlePick = (doctorId: string) => {
    picker.setDoctorId(doctorId);
    setOpen(false);
  };

  return (
    <div className="fu-section">
      <FollowUpStepHead index={1} title={t("Reception:FollowUpStepDoctor")} />
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger="click"
        placement="bottomRight"
        arrow={false}
        destroyOnHidden
        rootClassName="fu-doctor-popover"
        content={<FollowUpDoctorList options={options} value={picker.doctorId} onPick={handlePick} />}
      >
        <button
          type="button"
          className={`fu-doctor-card${offError ? " fu-doctor-card--error" : ""}`}
          aria-expanded={open}
          aria-label={`${name ?? t("Reception:SelectDoctor")} · ${t("Reception:FollowUpChangeDoctor")}`}
        >
          <span className="fu-avatar" aria-hidden>{name ? initials(name) : "BS"}</span>
          <span className="fu-doctor-text">
            <span className="fu-doctor-name">{name ?? t("Reception:SelectDoctor")}</span>
            {shiftLine && <span className="fu-doctor-shift">{shiftLine}</span>}
          </span>
          <span className="fu-doctor-change">{t("Reception:FollowUpChangeDoctor")}</span>
          <ChevronDown size={16} className="fu-doctor-chevron" aria-hidden />
        </button>
      </Popover>
      {offError && <p className="fu-doctor-error" role="alert">{offError}</p>}
    </div>
  );
}
