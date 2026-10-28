import { Input, Tooltip } from "antd";
import { CalendarDays, Loader2 } from "lucide-react";
import { DentistOverlapDialog } from "@/components/DentistOverlapDialog";
import { t } from "@/lib/i18n";
import { useFollowUpActions } from "../hooks/useFollowUpActions";
import { useFollowUpDoctors } from "../hooks/useFollowUpDoctors";
import { useFollowUpPicker } from "../hooks/useFollowUpPicker";
import { FollowUpDoctorCard } from "./FollowUpDoctorCard";
import { FollowUpWeekStrip } from "./FollowUpWeekStrip";
import { FollowUpTimeline } from "./FollowUpTimeline";
import { FollowUpSummary } from "./FollowUpSummary";
import { REBOOK_NOTE_MAX, type BookedOutcome } from "../types/reception";

interface FollowUpSchedulerProps {
  appointmentId: string;
  /** Which option opened the picker; it is saved with the booking. */
  outcome: BookedOutcome;
  defaultDoctorId?: string;
  branchId?: string;
  onClose: () => void;
}

const OUTCOME_TEXT: Record<BookedOutcome, { hint: string; confirm: string }> = {
  FollowUp: { hint: "Reception:FollowUpHint", confirm: "Reception:FollowUpConfirm" },
  Revisit: { hint: "Reception:RevisitHint", confirm: "Reception:RevisitConfirm" },
};

/**
 * "Đổi lịch hẹn" and "Hẹn tái khám" open this under the card: the next
 * appointment must have a date before the outcome can be saved. Three steps —
 * the doctor (the card's own to begin with), the day, and a time range dragged
 * on the doctor's working hours.
 * "Hẹn lại - Chưa chốt ngày" saves the outcome without the date and hands the
 * patient to CSKH to fix one (owner, 2026-10-09).
 */
export function FollowUpScheduler({ appointmentId, outcome, defaultDoctorId, branchId, onClose }: FollowUpSchedulerProps) {
  const text = OUTCOME_TEXT[outcome];
  const picker = useFollowUpPicker(defaultDoctorId);
  const doctors = useFollowUpDoctors(picker, branchId);
  const actions = useFollowUpActions(appointmentId, outcome, picker, onClose);
  const doctorName = doctors.options.find((o) => o.value === picker.doctorId)?.label;

  return (
    <section className="fu-panel" aria-label={t("Reception:FollowUpTitle")}>
      <header className="fu-head">
        <span className="fu-head-icon"><CalendarDays size={22} strokeWidth={1.8} aria-hidden /></span>
        <div className="fu-head-text">
          <h4 className="fu-title">
            {t("Reception:FollowUpTitle")} <span className="fu-required">*</span>
          </h4>
          <p className="fu-hint">{t(text.hint)}</p>
        </div>
      </header>

      <FollowUpDoctorCard picker={picker} options={doctors.options} offError={doctors.offError} />
      <hr className="fu-divider" />
      <FollowUpWeekStrip picker={picker} />
      <hr className="fu-divider" />
      <FollowUpTimeline picker={picker} />

      <label className="fu-notes">
        <span className="fu-notes-label">{t("Reception:FollowUpNotes")}</span>
        <Input.TextArea
          rows={2}
          maxLength={500}
          value={picker.notes}
          placeholder={t("Reception:FollowUpNotesPlaceholder")}
          onChange={(e) => picker.setNotes(e.target.value)}
        />
      </label>

      <FollowUpSummary day={picker.selectedDay} range={picker.selectedRange} doctorName={doctorName} />

      <footer className="fu-foot">
        <button type="button" className="fu-btn" onClick={onClose} disabled={actions.pending}>
          {t("Common:Cancel")}
        </button>
        <Tooltip title={picker.undatedNoteTooLong ? t("Reception:RebookUndatedNoteTooLong", REBOOK_NOTE_MAX) : undefined}>
          <span className="fu-btn-wrap">
            <button
              type="button"
              className="fu-btn"
              disabled={actions.pending || picker.undatedNoteTooLong}
              onClick={actions.handleRebookUndated}
            >
              {actions.rebooking && <Loader2 size={14} className="fu-spin" aria-hidden />}
              {t("Reception:RebookUndated")}
            </button>
          </span>
        </Tooltip>
        <button
          type="button"
          className="fu-btn fu-btn--primary"
          disabled={!picker.canConfirm || actions.pending}
          onClick={actions.handleConfirm}
        >
          {actions.confirming && <Loader2 size={14} className="fu-spin" aria-hidden />}
          {t(text.confirm)}
        </button>
      </footer>
      <DentistOverlapDialog {...actions.overlapDialog} />
    </section>
  );
}
