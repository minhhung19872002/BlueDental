import { Button, Input, Tooltip } from "antd";
import { CalendarDays, Loader2 } from "lucide-react";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import { useFollowUpActions } from "../hooks/useFollowUpActions";
import { useFollowUpDoctors } from "../hooks/useFollowUpDoctors";
import { useFollowUpPicker } from "../hooks/useFollowUpPicker";
import { QUICK_PICKS, quickPickDate } from "../utils/followUpSlots";
import { FollowUpWeekStrip } from "./FollowUpWeekStrip";
import { FollowUpSlotGrid } from "./FollowUpSlotGrid";
import { REBOOK_NOTE_MAX, type BookedOutcome } from "../types/reception";

interface FollowUpSchedulerProps {
  appointmentId: string;
  /** Which option opened the picker; it is saved with the booking. */
  outcome: BookedOutcome;
  defaultDoctorId?: string;
  branchId?: string;
  onClose: () => void;
}

const QUICK_PICK_LABEL = {
  "1w": "Reception:FollowUpQuick1w",
  "2w": "Reception:FollowUpQuick2w",
  "1m": "Reception:FollowUpQuick1m",
} as const;

const OUTCOME_TEXT: Record<BookedOutcome, { hint: string; confirm: string }> = {
  FollowUp: { hint: "Reception:FollowUpHint", confirm: "Reception:FollowUpConfirm" },
  Revisit: { hint: "Reception:RevisitHint", confirm: "Reception:RevisitConfirm" },
};

/**
 * "Đã hẹn tiếp" and "Hẹn tái khám" open this under the card: the next
 * appointment must have a date before the outcome can be saved. The doctor is optional — left empty,
 * the follow-up goes to the card's doctor and no busy slots are shown.
 * "Hẹn lại - Chưa chốt ngày" saves the outcome without the date and hands the
 * patient to CSKH to fix one (owner, 2026-10-09).
 */
export function FollowUpScheduler({ appointmentId, outcome, defaultDoctorId, branchId, onClose }: FollowUpSchedulerProps) {
  const text = OUTCOME_TEXT[outcome];
  const picker = useFollowUpPicker(defaultDoctorId);
  const doctors = useFollowUpDoctors(picker, branchId);
  const actions = useFollowUpActions(appointmentId, outcome, picker, onClose);

  return (
    <section className="fu-panel" aria-label={t("Reception:FollowUpTitle")}>
      <header className="fu-head">
        <span className="fu-head-icon"><CalendarDays size={16} aria-hidden /></span>
        <div className="fu-head-text">
          <h4 className="fu-title">
            {t("Reception:FollowUpTitle")} <span className="fu-required">*</span>
          </h4>
          <p className="fu-hint">{t(text.hint)}</p>
        </div>
        <div className="fu-doctor">
          <span className="fu-doctor-label">{t("Reception:Doctor")}</span>
          <SearchSelect
            value={picker.doctorId}
            placeholder={t("Reception:SelectDoctor")}
            allowClear
            options={doctors.options}
            onChange={picker.setDoctorId}
            status={doctors.offError ? "error" : ""}
          />
        </div>
      </header>
      {doctors.offError && <p className="fu-doctor-error" role="alert">{doctors.offError}</p>}

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

      <FollowUpWeekStrip picker={picker} />
      <FollowUpSlotGrid picker={picker} />

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

      <footer className="fu-foot">
        <Button onClick={onClose} disabled={actions.pending}>{t("Common:Cancel")}</Button>
        <Tooltip title={picker.undatedNoteTooLong ? t("Reception:RebookUndatedNoteTooLong", REBOOK_NOTE_MAX) : undefined}>
          <Button
            disabled={actions.pending || picker.undatedNoteTooLong}
            icon={actions.rebooking ? <Loader2 size={14} className="fu-spin" /> : undefined}
            onClick={actions.handleRebookUndated}
          >
            {t("Reception:RebookUndated")}
          </Button>
        </Tooltip>
        <Button
          type="primary"
          disabled={!picker.canConfirm || actions.pending}
          icon={actions.confirming ? <Loader2 size={14} className="fu-spin" /> : undefined}
          onClick={actions.handleConfirm}
        >
          {t(text.confirm)}
        </Button>
      </footer>
    </section>
  );
}
