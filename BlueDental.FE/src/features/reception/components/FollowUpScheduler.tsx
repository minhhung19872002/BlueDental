import { toast } from "sonner";
import { Button, Input } from "antd";
import dayjs from "dayjs";
import { CalendarDays, Loader2 } from "lucide-react";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import { useBookFollowUp } from "../api/receptionMutations";
import { useFollowUpPicker } from "../hooks/useFollowUpPicker";
import { QUICK_PICKS, quickPickDate } from "../utils/followUpSlots";
import { FollowUpWeekStrip } from "./FollowUpWeekStrip";
import { FollowUpSlotGrid } from "./FollowUpSlotGrid";

interface FollowUpSchedulerProps {
  appointmentId: string;
  defaultDoctorId?: string;
  doctors: { id: string; name: string }[];
  onClose: () => void;
}

const QUICK_PICK_LABEL = {
  "1w": "Reception:FollowUpQuick1w",
  "2w": "Reception:FollowUpQuick2w",
  "1m": "Reception:FollowUpQuick1m",
} as const;

/**
 * "Đã hẹn tiếp" opens this under the card: the next appointment must have a
 * date before the outcome can be saved. The doctor is optional — left empty,
 * the follow-up goes to the card's doctor and no busy slots are shown.
 */
export function FollowUpScheduler({ appointmentId, defaultDoctorId, doctors, onClose }: FollowUpSchedulerProps) {
  const picker = useFollowUpPicker(defaultDoctorId);
  const bookMutation = useBookFollowUp();

  const handleConfirm = () => {
    const input = picker.buildInput();
    if (!input) return;
    bookMutation.mutate(
      { id: appointmentId, input },
      {
        onSuccess: () => {
          toast.success(t("Reception:FollowUpSuccess", dayjs(input.slotStart).format("HH:mm DD/MM/YYYY")));
          onClose();
        },
      },
    );
  };

  return (
    <section className="fu-panel" aria-label={t("Reception:FollowUpTitle")}>
      <header className="fu-head">
        <span className="fu-head-icon"><CalendarDays size={16} aria-hidden /></span>
        <div className="fu-head-text">
          <h4 className="fu-title">
            {t("Reception:FollowUpTitle")} <span className="fu-required">*</span>
          </h4>
          <p className="fu-hint">{t("Reception:FollowUpHint")}</p>
        </div>
        <div className="fu-doctor">
          <span className="fu-doctor-label">{t("Reception:Doctor")}</span>
          <SearchSelect
            value={picker.doctorId}
            placeholder={t("Reception:SelectDoctor")}
            allowClear
            options={doctors.map((d) => ({ value: d.id, label: d.name }))}
            onChange={picker.setDoctorId}
          />
        </div>
      </header>

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
        <Button onClick={onClose} disabled={bookMutation.isPending}>{t("Common:Cancel")}</Button>
        <Button
          type="primary"
          disabled={!picker.canConfirm || bookMutation.isPending}
          icon={bookMutation.isPending ? <Loader2 size={14} className="fu-spin" /> : undefined}
          onClick={handleConfirm}
        >
          {t("Reception:FollowUpConfirm")}
        </Button>
      </footer>
    </section>
  );
}
