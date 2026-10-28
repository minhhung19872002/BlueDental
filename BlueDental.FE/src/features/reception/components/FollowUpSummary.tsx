import type { Dayjs } from "dayjs";
import { t } from "@/lib/i18n";
import { hhmm } from "../utils/followUpSlots";
import type { MinuteSpan } from "../types/reception";

interface FollowUpSummaryProps {
  day: Dayjs | null;
  range?: MinuteSpan;
  doctorName?: string;
}

/** What Xác nhận will book: day, time and doctor, side by side. */
export function FollowUpSummary({ day, range, doctorName }: FollowUpSummaryProps) {
  const notPicked = t("Reception:FollowUpNotPicked");
  const items = [
    {
      key: "date",
      label: t("Reception:FollowUpSumDate"),
      value: day ? `${t(`Reception:FollowUpWeekday${day.day()}`)}, ${day.format("DD/MM/YYYY")}` : notPicked,
    },
    {
      key: "time",
      label: t("Reception:FollowUpSumTime"),
      value: range ? t("Reception:FollowUpRange", hhmm(range.start), hhmm(range.end), range.end - range.start) : notPicked,
    },
    { key: "doctor", label: t("Reception:FollowUpSumDoctor"), value: doctorName ?? notPicked },
  ];

  return (
    <dl className={`fu-summary${range ? " fu-summary--set" : ""}`}>
      {items.map((item) => (
        <div key={item.key} className={`fu-summary-item fu-summary-item--${item.key}`}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
