import { FloatingField } from "@/components/FloatingField";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import type { PickerOption } from "@/hooks/useLaboPickers";
import type { TreatmentPlanSlipDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { LaboDeliveryFields } from "./LaboDeliveryFields";
import { LaboLockedField } from "./LaboLockedField";
import { LaboSourcePickers } from "./LaboSourcePickers";
import { requiredRule, type LaboOrderForm } from "./useLaboOrderForm";

/** Where the order comes from, as the header prints it once it is known. */
export interface LaboHeaderSource {
  planLabel: string;
  serviceName: string;
}

interface Props {
  patient: { code: string; name: string };
  /** Known and locked: raised from a công đoạn, or a saved order. */
  source: LaboHeaderSource | null;
  /** Picked here instead: a new order raised from the Labo tab. */
  plans?: TreatmentPlanSlipDto[];
  dentists: PickerOption[];
  /** Handed out by the server; the reference shows it locked. */
  code: string;
  form: LaboOrderForm;
}

/**
 * The top grid of the Đặt hàng tab: Tên KH, Kế hoạch điều trị, Dịch vụ điều
 * trị, Bác sĩ chỉ định, then Số phiếu, the sent stamp, the supplier and the
 * due stamp. From a công đoạn the plan and line are known and locked; from
 * the tab they are picked here. Bác sĩ chỉ định stays open either way.
 */
export function LaboNewOrderHeader({ patient, source, plans, dentists, code, form }: Props) {
  return (
    <div className="pd-labo-grid">
      <LaboLockedField label={t("Patient:Form:CustomerName")} value={`${patient.code} - ${patient.name}`} />
      {plans ? (
        <LaboSourcePickers plans={plans} />
      ) : (
        <>
          <LaboLockedField label={t("Patient:Plan:Title")} value={source?.planLabel ?? ""} />
          <LaboLockedField label={t("Patient:Plan:Service")} value={source?.serviceName ?? ""} />
        </>
      )}
      <FloatingField
        name="dentistId"
        label={t("Patient:QuoteSheet:PrescribingDoctor")}
        required
        rules={requiredRule(t("Patient:QuoteSheet:RequiredPrescribingDoctor"))}
      >
        <SearchSelect options={dentists} />
      </FloatingField>

      <LaboLockedField label={t("Patient:Labo:SlipNumber")} value={code} />
      <LaboDeliveryFields
        sentLabels={{ date: t("Patient:Labo:SentDate"), time: t("Patient:Labo:SentTime") }}
        suppliers={form.options.suppliers}
      />
    </div>
  );
}
