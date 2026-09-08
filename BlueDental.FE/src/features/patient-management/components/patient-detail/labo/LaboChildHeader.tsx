import { Input } from "antd";
import { FloatingField } from "@/components/FloatingField";
import { FloatingLabel } from "@/components/FloatingLabel";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import type { PickerOption } from "@/hooks/useLaboPickers";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboDeliveryFields } from "./LaboDeliveryFields";
import type { LaboChildKind } from "./laboModalKeys";
import { requiredRule, type LaboOrderForm } from "./useLaboOrderForm";

interface Props {
  kind: LaboChildKind;
  patient: { code: string; name: string };
  parent: LaboOrderDto;
  dentists: PickerOption[];
  form: LaboOrderForm;
}

/** The sent stamp is called the warranty stamp on the Bảo hành tab. */
const SENT_LABELS: Record<LaboChildKind, { date: string; time: string }> = {
  "continue-process": { date: "Ngày gửi", time: "Giờ gửi" },
  warranty: { date: "Ngày bảo hành", time: "Giờ bảo hành" },
};

/**
 * The top grid of Làm tiếp công đoạn / Bảo hành once a parent order is
 * picked: the parent's own facts locked, the doctor and supplier open.
 */
export function LaboChildHeader({ kind, patient, parent, dentists, form }: Props) {
  const planLabel = parent.treatmentPlanCode
    ? `${parent.treatmentPlanCode} - ${parent.treatmentPlanDentistName ?? ""}`.trim()
    : "";
  return (
    <div className="pd-labo-grid">
      <FloatingLabel label={t("Tên khách hàng")} required floated>
        <Input disabled value={`${patient.code} - ${patient.name}`} />
      </FloatingLabel>
      <FloatingLabel label={t("Kế hoạch điều trị")} required floated>
        <Input disabled value={planLabel} />
      </FloatingLabel>

      <FloatingLabel label={t("Dịch vụ điều trị")} required floated>
        <Input disabled value={parent.treatmentServiceName ?? parent.workDescription ?? ""} />
      </FloatingLabel>
      <FloatingField
        name="dentistId"
        label={t("Bác sĩ chỉ định")}
        required
        rules={requiredRule(t("Vui lòng chọn bác sĩ chỉ định."))}
      >
        <SearchSelect options={dentists} />
      </FloatingField>

      <FloatingLabel label={t("Số phiếu Labo")} required floated>
        <Input disabled value={parent.orderCode} />
      </FloatingLabel>
      <LaboDeliveryFields
        sentLabels={{ date: t(SENT_LABELS[kind].date), time: t(SENT_LABELS[kind].time) }}
        suppliers={form.options.suppliers}
      />
    </div>
  );
}
