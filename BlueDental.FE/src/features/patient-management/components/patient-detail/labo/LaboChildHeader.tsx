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
function sentLabels(): Record<LaboChildKind, { date: string; time: string }> {
  return {
    "continue-process": { date: t("Patient:Labo:SentDate"), time: t("Patient:Labo:SentTime") },
    warranty: { date: t("Patient:Labo:WarrantyDate"), time: t("Patient:Labo:WarrantyTime") },
  };
}

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
      <FloatingLabel label={t("Patient:Form:CustomerName")} required floated>
        <Input disabled value={`${patient.code} - ${patient.name}`} />
      </FloatingLabel>
      <FloatingLabel label={t("Patient:Plan:Title")} required floated>
        <Input disabled value={planLabel} />
      </FloatingLabel>

      <FloatingLabel label={t("Patient:Plan:Service")} required floated>
        <Input disabled value={parent.treatmentServiceName ?? parent.workDescription ?? ""} />
      </FloatingLabel>
      <FloatingField
        name="dentistId"
        label={t("Patient:QuoteSheet:PrescribingDoctor")}
        required
        rules={requiredRule(t("Patient:QuoteSheet:RequiredPrescribingDoctor"))}
      >
        <SearchSelect options={dentists} />
      </FloatingField>

      <FloatingLabel label={t("Patient:Labo:SlipNumber")} required floated>
        <Input disabled value={parent.orderCode} />
      </FloatingLabel>
      <LaboDeliveryFields
        sentLabels={sentLabels()[kind]}
        suppliers={form.options.suppliers}
      />
    </div>
  );
}
