import { DatePicker } from "antd";
import type { Rule } from "antd/es/form";
import type { Dayjs } from "dayjs";
import { FloatingField } from "@/components/FloatingField";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import type { PickerOption } from "@/hooks/useLaboPickers";
import { dueAfterSent, requiredRule } from "./useLaboOrderForm";
import { DATE_INPUT_FORMAT } from "@/utils/dateInput";

/** Ngày nhận dự kiến has to be a later day than Ngày gửi. */
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
 * Ngày gửi, Nhà cung cấp and Ngày nhận dự kiến of the labo header — days
 * only since P3110 (m142 dropped Giờ gửi / Giờ nhận). Ngày gửi starts on today;
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
        <DatePicker format={DATE_INPUT_FORMAT} />
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
        <DatePicker format={DATE_INPUT_FORMAT} />
      </FloatingField>
    </>
  );
}
