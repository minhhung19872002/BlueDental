import { Input } from "antd";
import { FloatingLabel } from "@/components/FloatingLabel";
import { t } from "@/lib/i18n";
import { pickedOf, QUICK_PICKS, quickPickLabel, withPick, type QuickPick } from "./appointmentNote";
import { REMARK_LIMIT } from "./StageRemarkCell";

interface Props {
  value: string;
  /** Ngày điều trị, "YYYY-MM-DD" — what the chips count from; empty turns them off. */
  treatmentDate: string;
  onChange: (value: string) => void;
}

/**
 * Ghi chú lịch hẹn — the form's last column (BA, 2026-10-27). It saves as the
 * new công đoạn's Ghi chú, the column of Lịch sử điều trị. The "Chọn nhanh"
 * chips fill in the next visit's date; one at a time.
 */
export function StageAppointmentNote({ value, treatmentDate, onChange }: Props) {
  const picked = pickedOf(value, treatmentDate);

  const handlePick = (pick: QuickPick) => {
    const next = withPick(value, treatmentDate, pick === picked ? undefined : pick);
    if (next.length <= REMARK_LIMIT) onChange(next);
  };

  return (
    <>
      <FloatingLabel label={t("Patient:Stage:AppointmentNote")} floated={value.length > 0}>
        <Input.TextArea
          rows={5}
          value={value}
          maxLength={REMARK_LIMIT}
          aria-label={t("Patient:Stage:AppointmentNote")}
          onChange={(event) => onChange(event.target.value)}
        />
      </FloatingLabel>
      <div className="pd-stage-quickpick" role="group" aria-label={t("Patient:Stage:QuickPick")}>
        <span>{t("Patient:Stage:QuickPick")}</span>
        {QUICK_PICKS.map((pick) => (
          <button
            key={`${pick.count}${pick.unit}`}
            type="button"
            className={pick === picked ? "active" : undefined}
            aria-pressed={pick === picked}
            disabled={!treatmentDate}
            onClick={() => handlePick(pick)}
          >
            {quickPickLabel(treatmentDate, pick)}
          </button>
        ))}
      </div>
    </>
  );
}
