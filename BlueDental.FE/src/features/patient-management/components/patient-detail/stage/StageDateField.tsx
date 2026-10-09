import { DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { FloatingLabel } from "@/components/FloatingLabel";
import { t } from "@/lib/i18n";
import { DATE_INPUT_FORMAT } from "@/utils/dateInput";

/** Ngày điều trị is today or earlier — the server refuses a later day too. */
const isAfterToday = (day: Dayjs) => day.isAfter(dayjs(), "day");

interface Props {
  /** "YYYY-MM-DD", or "" while nothing is picked. */
  value: string;
  error?: string;
  onChange: (isoDate: string) => void;
}

/**
 * Ngày điều trị — the day the visit was worked, picked by the doctor (BA,
 * 2026-10-09). Shared by "Thêm/Tiếp tục công đoạn" and the "Tạo bảo hành /
 * Tạo tái khám" forms, so all of them date a row the same way.
 */
export function StageDateField({ value, error, onChange }: Props) {
  return (
    <>
      <FloatingLabel label={t("Patient:Stage:TreatmentDate")} required floated>
        <DatePicker
          className="pd-stage-date"
          value={value ? dayjs(value) : null}
          format={DATE_INPUT_FORMAT}
          disabledDate={isAfterToday}
          allowClear={false}
          status={error ? "error" : undefined}
          onChange={(day) => onChange(day ? day.format("YYYY-MM-DD") : "")}
        />
      </FloatingLabel>
      {error && <p className="pd-stage-error">{error}</p>}
    </>
  );
}
