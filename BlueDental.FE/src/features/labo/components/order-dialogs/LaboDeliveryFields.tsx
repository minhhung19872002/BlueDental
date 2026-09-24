import { DatePicker, TimePicker } from "antd";
import type { Rule } from "antd/es/form";
import type { Dayjs } from "dayjs";
import { FloatingField } from "@/components/FloatingField";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import type { PickerOption } from "@/hooks/useLaboPickers";
import { dueAfterSent, requiredRule } from "./useLaboOrderForm";

/** The due pair has to follow the sent pair; the message is the reference's. */
const dueAfterSentRule: Rule = ({ getFieldValue }) => ({
  validator: () => {
    const pick = (name: "sentDate" | "sentTime" | "dueDate" | "dueTime"): Dayjs | null =>
      getFieldValue(name) ?? null;
    const ok = dueAfterSent({
      sentDate: pick("sentDate"),
      sentTime: pick("sentTime"),
      dueDate: pick("dueDate"),
      dueTime: pick("dueTime"),
    });
    return ok ? Promise.resolve() : Promise.reject(new Error(t("Patient:Labo:DueAfterSent")));
  },
});

/** Ngày nhận dự kiến and Giờ nhận are checked together, whichever one moved. */
const DUE_PAIR = ["sentDate", "sentTime", "dueDate", "dueTime"];

interface Props {
  /** "Ngày gửi / Giờ gửi", or the warranty stamp on the Bảo hành tab. */
  sentLabels: { date: string; time: string };
  suppliers: PickerOption[];
}

/**
 * The second half of every labo header: the sent stamp (prefilled with now),
 * the supplier and the due stamp, each with the reference's required message
 * under it. The time labels never drop into the field: the reference keeps
 * them on the border over an "HH:mm" hint (staging, docs/clone/pages/labo.md §2.6). The sent pair is prefilled, so its messages are only ever seen
 * when someone clears it; the reference's own wording for that is unknown.
 */
export function LaboDeliveryFields({ sentLabels, suppliers }: Props) {
  return (
    <>
      <div className="pd-labo-pair">
        <FloatingField
          name="sentDate"
          label={sentLabels.date}
          required
          rules={requiredRule(t("Patient:Labo:RequiredField", sentLabels.date.toLowerCase()))}
        >
          <DatePicker format="DD/MM/YYYY" />
        </FloatingField>
        <FloatingField
          name="sentTime"
          label={sentLabels.time}
          required
          alwaysFloat
          rules={requiredRule(t("Patient:Labo:RequiredField", sentLabels.time.toLowerCase()))}
        >
          <TimePicker format="HH:mm" placeholder="HH:mm" />
        </FloatingField>
      </div>

      <FloatingField
        name="supplierId"
        label={t("Patient:Labo:Supplier")}
        required
        rules={requiredRule(t("Patient:Labo:RequiredSupplier"))}
      >
        <SearchSelect options={suppliers} />
      </FloatingField>
      <div className="pd-labo-pair">
        <FloatingField
          name="dueDate"
          label={t("Patient:Labo:ExpectedReceiveDate")}
          required
          dependencies={DUE_PAIR}
          rules={[...requiredRule(t("Patient:Labo:RequiredExpectedDate")), dueAfterSentRule]}
        >
          <DatePicker format="DD/MM/YYYY" />
        </FloatingField>
        <FloatingField
          name="dueTime"
          label={t("Patient:Labo:ReceiveTime")}
          required
          alwaysFloat
          dependencies={DUE_PAIR}
          rules={[...requiredRule(t("Patient:Labo:RequiredReceiveTime")), dueAfterSentRule]}
        >
          <TimePicker format="HH:mm" placeholder="HH:mm" />
        </FloatingField>
      </div>
    </>
  );
}
