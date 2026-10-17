import { DatePicker } from "antd";
import type { Dayjs } from "dayjs";
import { FloatingLabel } from "@/components/FloatingLabel";
import { t } from "@/lib/i18n";
import { DATE_INPUT_FORMAT } from "@/utils/dateInput";

interface Props {
  /** Position among the sheets of this same form: 1 reads as `Bản 01`. */
  ordinal: number;
  title: string;
  /**
   * Set on the five forms that are filled in for a particular day. The wording
   * is the form's own — "Ngày tư vấn" on the consent sheet, "Ngày thực hiện" on
   * the rest.
   */
  dateLabel?: string;
  date?: Dayjs | null;
  /** Absent on a sheet that can no longer change. */
  onDateChange?: (date: Dayjs | null) => void;
  /** Says why the sheet is read-only — a cancelled sheet or set. */
  notice?: string;
}

/**
 * The line above the sheet: which copy is open and the day it is filled in for.
 *
 * The reference also puts a doctor picker at the far end of it; the clinic
 * asked for it to be hidden (save/P1710.drawio, 2026-10-17), so it is gone.
 *
 * UNKNOWN_REFERENCE_BEHAVIOR — the other half of what the date does. On the
 * reference the date also fetches that day's diagnoses and treatment stages and
 * writes them onto the sheet; confirming that means picking on a live record,
 * which would write. See docs/clone/unknowns.md.
 */
export function MedicalRecordCanvasHead({ ordinal, title, dateLabel, date, onDateChange, notice }: Props) {
  return (
    <header className="pd-medical-canvas-head">
      <div className="pd-medical-canvas-title">
        <small>
          {t("Patient:Misc:SlipCopy")} {String(ordinal).padStart(2, "0")}
          {notice && <span className="pd-medical-readonly">{notice}</span>}
        </small>
        <strong>{title}</strong>
      </div>

      <div className="pd-medical-canvas-tools">
        {dateLabel && (
          <FloatingLabel label={t(dateLabel)} floated className="pd-medical-date">
            <DatePicker
              value={date}
              onChange={onDateChange}
              disabled={!onDateChange}
              format={DATE_INPUT_FORMAT}
              allowClear={false}
            />
          </FloatingLabel>
        )}
      </div>
    </header>
  );
}
