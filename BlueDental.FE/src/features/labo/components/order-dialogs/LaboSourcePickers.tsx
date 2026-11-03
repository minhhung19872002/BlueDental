import { Form } from "antd";
import { FloatingField } from "@/components/FloatingField";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import type { PickerOption } from "@/hooks/useLaboPickers";
import {
  SERVICE_LINE_STATUS,
  type TreatmentPlanSlipDto,
  type TreatmentServiceDto,
} from "@/features/treatment-management/api/treatmentPlanApi";
import { toothCodes } from "./laboOrderSource";
import { requiredRule, type LaboOrderValues } from "./useLaboOrderForm";

/** Only lines still open take a labo order; the server refuses the rest anyway. */
export function isOpenLine(line: TreatmentServiceDto): boolean {
  return (
    line.status === SERVICE_LINE_STATUS.Created || line.status === SERVICE_LINE_STATUS.InProgress
  );
}

/** Every open line of the patient, or of the one plan already picked. */
function lineOptions(plans: TreatmentPlanSlipDto[], planId: string | undefined): PickerOption[] {
  const owners = planId ? plans.filter((plan) => plan.id === planId) : plans;
  return owners.flatMap((plan) =>
    plan.services.filter(isOpenLine).map((line) => ({
      value: line.id,
      label: `${line.code} - ${line.serviceName ?? ""}`.trim(),
    })),
  );
}

/**
 * Kế hoạch điều trị / Dịch vụ điều trị the way the tab's dialog offers them
 * on the reference: the plan ("Phiếu điều trị - Bác sĩ tiếp nhận") narrows the
 * lines, but a line may be picked first and names its plan; Bác sĩ chỉ định
 * follows the line and stays open to change. Each carries the reference's own
 * required message.
 */
export function LaboSourcePickers({ plans }: { plans: TreatmentPlanSlipDto[] }) {
  const form = Form.useFormInstance<LaboOrderValues>();
  const planId = Form.useWatch("planId", form);

  // Runs after the Form.Item stored the line: the owner plan and the line's
  // doctor follow, their errors cleared with the value, and the tooth row
  // takes the line's teeth. Clearing the line empties the row again, and the
  // reference's "Chọn dịch vụ điều trị trước" comes back in its place.
  const pickLine = (lineId: string | undefined) => {
    const owner = plans.find((plan) => plan.services.some((line) => line.id === lineId));
    const line = owner?.services.find((item) => item.id === lineId);
    if (!owner || !line) {
      form.setFieldsValue({ teeth: [], quantity: "0" });
      return;
    }
    const teeth = toothCodes(line.teeth);
    form.setFields([
      { name: "planId", value: owner.id, errors: [] },
      { name: "dentistId", value: line.dentistId ?? owner.dentistId, errors: [] },
    ]);
    form.setFieldsValue({ teeth, quantity: String(teeth.length) });
  };

  const pickPlan = () =>
    form.setFieldsValue({ lineId: undefined, teeth: [], quantity: "0" });

  return (
    <>
      <FloatingField
        name="planId"
        label={t("Patient:Plan:Title")}
        required
        rules={requiredRule(t("Patient:Misc:RequiredPlan"))}
      >
        <SearchSelect
          allowClear
          options={plans.map((plan) => ({
            value: plan.id,
            label: `${plan.code} - ${plan.dentistName ?? ""}`.trim(),
          }))}
          onChange={pickPlan}
        />
      </FloatingField>
      <FloatingField
        name="lineId"
        label={t("Patient:Plan:Service")}
        required
        rules={requiredRule(t("Patient:Labo:RequiredTreatmentService"))}
      >
        <SearchSelect
          allowClear
          options={lineOptions(plans, planId)}
          emptyText={t("Patient:Plan:NoActiveService")}
          onChange={pickLine}
        />
      </FloatingField>
    </>
  );
}
