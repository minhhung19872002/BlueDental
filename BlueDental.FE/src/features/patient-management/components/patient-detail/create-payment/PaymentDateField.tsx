import { useMemo } from "react";
import { DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { t } from "@/lib/i18n";
import { DATE_INPUT_FORMAT } from "@/utils/dateInput";
import { ISO_DAY } from "./usePaymentForm";

interface Props {
  /** "YYYY-MM-DD". */
  value: string;
  onChange: (isoDate: string) => void;
}

const FIELD_ID = "pd-newpay-paidon";

const isFuture = (day: Dayjs) => day.isAfter(dayjs(), "day");

/**
 * "Ngày thanh toán" on a new receipt: today or any day before it, with no
 * earliest day (owner 2026-10-14). The server refuses a later day too
 * (Billing PaymentDateInFuture).
 */
export function PaymentDateField({ value, onChange }: Props) {
  // One Dayjs per day: the picker re-syncs whenever this object changes.
  const picked = useMemo(() => dayjs(value), [value]);

  const handleChange = (day: Dayjs | null) => {
    if (day) onChange(day.format(ISO_DAY));
  };

  return (
    <div className="pd-newpay-fact pd-newpay-fact--field">
      <label htmlFor={FIELD_ID}>{t("Patient:Payment:DateLabel")}</label>
      <DatePicker
        id={FIELD_ID}
        className="pd-newpay-date"
        value={picked}
        format={DATE_INPUT_FORMAT}
        disabledDate={isFuture}
        allowClear={false}
        onChange={handleChange}
      />
    </div>
  );
}
