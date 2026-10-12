import { useMemo, useState, type KeyboardEvent } from "react";
import { DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { FloatingLabel } from "@/components/FloatingLabel";
import { t } from "@/lib/i18n";
import { DATE_INPUT_FORMAT } from "@/utils/dateInput";

const ISO_DAY = "YYYY-MM-DD";

/** The day typed as DD/MM/YYYY, or null while it is not a whole real day. */
function typedDay(text: string): Dayjs | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const day = dayjs(iso);
  return day.isValid() && day.format(ISO_DAY) === iso ? day : null;
}

interface Props {
  /** "YYYY-MM-DD", or "" while nothing is picked. */
  value: string;
  /** "YYYY-MM-DD" the phiếu điều trị was opened — no earlier day (QA #32). */
  minDate?: string;
  error?: string;
  onChange: (isoDate: string) => void;
}

/**
 * Ngày điều trị — the day the visit was worked, picked by the doctor (BA,
 * 2026-10-09). Shared by "Thêm/Tiếp tục công đoạn" and the "Tạo bảo hành /
 * Tạo tái khám" forms, so all of them date a row the same way.
 *
 * From the day the slip was opened to today; the server refuses anything else
 * too. A day typed outside that range is refused by the picker, which then
 * quietly puts the old day back — so the field says why (QA #31).
 */
export function StageDateField({ value, minDate, error, onChange }: Props) {
  const [typedError, setTypedError] = useState<string>();

  // One Dayjs per day rather than a fresh one every render: the picker
  // re-syncs its inner value whenever this object changes.
  const picked = useMemo(() => (value ? dayjs(value) : null), [value]);

  const isOutOfRange = (day: Dayjs) =>
    day.isAfter(dayjs(), "day") || (minDate ? day.isBefore(minDate, "day") : false);

  const rangeMessage = minDate
    ? t("Patient:Stage:TreatmentDateRange", dayjs(minDate).format(DATE_INPUT_FORMAT.format))
    : t("Patient:Stage:TreatmentDateNotFuture");

  const handleChange = (day: Dayjs | null) => {
    setTypedError(undefined);
    const next = day ? day.format(ISO_DAY) : "";
    if (next !== value) onChange(next);
  };

  // Read on Enter as well as on blur: Enter on a shut day makes the picker put
  // the old day back at once, so by the blur the typed text is gone. Only an
  // out-of-range day sets the message; a valid pick or a fresh focus clears it.
  const checkTyped = (target: EventTarget) => {
    const day = target instanceof HTMLInputElement ? typedDay(target.value) : null;
    if (day && isOutOfRange(day)) setTypedError(rangeMessage);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter") checkTyped(event.target);
  };

  const shown = error ?? typedError;

  return (
    <>
      <FloatingLabel label={t("Patient:Stage:TreatmentDate")} required floated>
        <DatePicker
          className="pd-stage-date"
          value={picked}
          format={DATE_INPUT_FORMAT}
          disabledDate={isOutOfRange}
          allowClear={false}
          status={shown ? "error" : undefined}
          onChange={handleChange}
          onFocus={() => setTypedError(undefined)}
          onKeyDown={handleKeyDown}
          onBlur={(event) => checkTyped(event.target)}
        />
      </FloatingLabel>
      {shown && <p className="pd-stage-error">{shown}</p>}
    </>
  );
}
