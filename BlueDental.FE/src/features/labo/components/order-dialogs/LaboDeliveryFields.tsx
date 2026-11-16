import { DatePicker } from "antd";
import type { Rule } from "antd/es/form";
import type { Dayjs } from "dayjs";
import { FloatingField } from "@/components/FloatingField";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import type { PickerOption } from "@/hooks/useLaboPickers";
import { dueAfterSent, requiredRule } from "./useLaboOrderForm";
import { DATE_TIME_INPUT_FORMAT } from "@/utils/dateInput";

const STAMP_TIME = { format: "HH:mm", minuteStep: 5 } as const;

/** Ngày giờ nhận dự kiến has to be later than Ngày giờ gửi. */
const dueAfterSentRule: Rule = ({ getFieldValue }) => ({
  validator: () => {
    const sent: Dayjs | null = getFieldValue("sentDate") ?? null;
    const due: Dayjs | null = getFieldValue("dueDate") ?? null;
    return dueAfterSent(sent, due) ? Promise.resolve() : Promise.reject(new Error(t("Patient:Labo:DueAfterSent")));
  },
});

const DATE_PAIR = ["sentDate", "dueDate"];

interface Props {
  suppliers: PickerOption[];
}

/**
 * Ngày gửi, Nhà cung cấp and Ngày nhận dự kiến of the labo header — each a
 * day and hour in one picker (BA 2026-11-16, after P3110 m142 had dropped the
 * hour). Ngày gửi starts on now;
 * a sent order keeps both, locked by the form (REQ-C2).
 */
export function LaboDeliveryFields({ suppliers }: Props) {
  const sentLabel = t("Patient:Labo:SentDate");
  return (
    <>
      <FloatingField
        name="sentDate"
        label={sentLabel}
        required
        dependencies={DATE_PAIR}
        rules={requiredRule(t("Patient:Labo:RequiredField", sentLabel.toLowerCase()))}
      >
        <DatePicker showTime={STAMP_TIME} needConfirm={false} format={DATE_TIME_INPUT_FORMAT} />
      </FloatingField>
      <FloatingField
        name="supplierId"
        label={t("Patient:Labo:Supplier")}
        required
        rules={requiredRule(t("Patient:Labo:RequiredSupplier"))}
      >
        <SearchSelect options={suppliers} />
      </FloatingField>
      <FloatingField
        name="dueDate"
        label={t("Patient:Labo:ExpectedReceiveDate")}
        required
        dependencies={DATE_PAIR}
        rules={[...requiredRule(t("Patient:Labo:RequiredExpectedDate")), dueAfterSentRule]}
      >
        <DatePicker showTime={STAMP_TIME} needConfirm={false} format={DATE_TIME_INPUT_FORMAT} />
      </FloatingField>
    </>
  );
}
