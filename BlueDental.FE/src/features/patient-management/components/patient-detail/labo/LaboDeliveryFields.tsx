import { DatePicker, TimePicker } from "antd";
import { FloatingField } from "@/components/FloatingField";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import type { PickerOption } from "@/hooks/useLaboPickers";
import { requiredRule } from "./useLaboOrderForm";

interface Props {
  /** "Ngày gửi / Giờ gửi", or the warranty stamp on the Bảo hành tab. */
  sentLabels: { date: string; time: string };
  suppliers: PickerOption[];
}

/**
 * The second half of every labo header: the sent stamp (prefilled with now),
 * the supplier and the due stamp, each with the reference's required message
 * under it. The sent pair is prefilled, so its messages are only ever seen
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
          rules={requiredRule(t("Vui lòng chọn {0}.", sentLabels.date.toLowerCase()))}
        >
          <DatePicker format="DD/MM/YYYY" />
        </FloatingField>
        <FloatingField
          name="sentTime"
          label={sentLabels.time}
          required
          rules={requiredRule(t("Vui lòng chọn {0}.", sentLabels.time.toLowerCase()))}
        >
          <TimePicker format="HH:mm" />
        </FloatingField>
      </div>

      <FloatingField
        name="supplierId"
        label={t("Nhà cung cấp")}
        required
        rules={requiredRule(t("Vui lòng chọn nhà cung cấp."))}
      >
        <SearchSelect options={suppliers} />
      </FloatingField>
      <div className="pd-labo-pair">
        <FloatingField
          name="dueDate"
          label={t("Ngày nhận dự kiến")}
          required
          rules={requiredRule(t("Vui lòng chọn ngày nhận dự kiến."))}
        >
          <DatePicker format="DD/MM/YYYY" />
        </FloatingField>
        <FloatingField
          name="dueTime"
          label={t("Giờ nhận")}
          required
          rules={requiredRule(t("Vui lòng chọn giờ nhận."))}
        >
          <TimePicker format="HH:mm" />
        </FloatingField>
      </div>
    </>
  );
}
