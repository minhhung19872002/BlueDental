import { DatePicker, Select } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import { useStaffOptions } from "@/hooks/useStaffOptions";
import { FloatingLabel } from "@/components/FloatingLabel";
import { t } from "@/lib/i18n";

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
  onDateChange?: (date: Dayjs | null) => void;
  doctorId?: string;
  onDoctorChange?: (id: string | undefined) => void;
}

/**
 * The line above the sheet: which copy is open, the day it is filled in for,
 * and the doctor picker the reference puts at the far end of it.
 *
 * UNKNOWN_REFERENCE_BEHAVIOR — what picking a doctor does, and the other half
 * of what the date does. On the reference the date also fetches that day's
 * diagnoses and treatment stages and writes them onto the sheet; confirming
 * that means picking on a live record, which would write. See
 * docs/clone/unknowns.md.
 */
export function MedicalRecordCanvasHead({
  ordinal,
  title,
  dateLabel,
  date,
  onDateChange,
  doctorId,
  onDoctorChange,
}: Props) {
  const staff = useStaffOptions().data ?? [];

  return (
    <header className="pd-medical-canvas-head">
      <div className="pd-medical-canvas-title">
        <small>
          {t("Bản")} {String(ordinal).padStart(2, "0")}
        </small>
        <strong>{title}</strong>
      </div>

      <div className="pd-medical-canvas-tools">
        {dateLabel && (
          <FloatingLabel label={t(dateLabel)} floated className="pd-medical-date">
            <DatePicker value={date} onChange={onDateChange} format="DD/MM/YYYY" allowClear={false} />
          </FloatingLabel>
        )}

        <FloatingLabel label={t("Bác sĩ")} floated={Boolean(doctorId)} className="pd-medical-doctor">
          <Select
            value={doctorId}
            onChange={onDoctorChange}
            options={staff}
            showSearch
            allowClear
            optionFilterProp="label"
            prefix={<SearchOutlined aria-hidden="true" />}
          />
        </FloatingLabel>
      </div>
    </header>
  );
}
