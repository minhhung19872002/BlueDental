import { Form } from "antd";
import { FloatingField } from "@/components/FloatingField";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import type { PickerOption } from "@/hooks/useLaboPickers";
import { toothLabels } from "@/features/treatment-management/api/consultingApi";
import {
  SERVICE_LINE_STATUS,
  type TreatmentPlanSlipDto,
  type TreatmentServiceDto,
} from "@/features/treatment-management/api/treatmentPlanApi";
import { requiredRule, type LaboOrderValues } from "./useLaboOrderForm";

/** Offered when the dialog opens from the Labo tab, with no công đoạn behind it. */
export interface LaboSourceLists {
  plans: TreatmentPlanSlipDto[];
  dentists: PickerOption[];
}

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
 * Kế hoạch điều trị / Dịch vụ điều trị / Bác sĩ chỉ định the way the tab's
 * dialog offers them on the reference: the plan narrows the lines, but a line
 * may be picked first and names its plan; the doctor follows the line and
 * stays open to change. Each carries the reference's own required message.
 */
export function LaboSourcePickers({ lists }: { lists: LaboSourceLists }) {
  const form = Form.useFormInstance<LaboOrderValues>();
  const planId = Form.useWatch("planId", form);

  // Runs after the Form.Item stored the line: the owner plan and the line's
  // doctor follow, their errors cleared with the value, and the tooth row
  // takes the line's teeth. Clearing the line empties the row again, and the
  // reference's "Chọn dịch vụ điều trị trước" comes back in its place.
  const pickLine = (lineId: string | undefined) => {
    const owner = lists.plans.find((plan) => plan.services.some((line) => line.id === lineId));
    const line = owner?.services.find((item) => item.id === lineId);
    if (!owner || !line) {
      form.setFieldsValue({ teeth: [], picked: [], quantity: "0" });
      return;
    }
    const teeth = toothLabels(line.teeth);
    form.setFields([
      { name: "planId", value: owner.id, errors: [] },
      { name: "dentistId", value: line.dentistId ?? owner.dentistId, errors: [] },
    ]);
    form.setFieldsValue({ teeth, picked: teeth, quantity: String(teeth.length) });
  };

  const pickPlan = () =>
    form.setFieldsValue({ lineId: undefined, teeth: [], picked: [], quantity: "0" });

  return (
    <>
      <FloatingField
        name="planId"
        label={t("Kế hoạch điều trị")}
        required
        rules={requiredRule(t("Vui lòng chọn kế hoạch điều trị."))}
      >
        <SearchSelect
          allowClear
          options={lists.plans.map((plan) => ({
            value: plan.id,
            label: `${plan.code} - ${plan.dentistName ?? ""}`.trim(),
          }))}
          onChange={pickPlan}
        />
      </FloatingField>
      <FloatingField
        name="lineId"
        label={t("Dịch vụ điều trị")}
        required
        rules={requiredRule(t("Vui lòng chọn dịch vụ điều trị."))}
      >
        <SearchSelect
          allowClear
          options={lineOptions(lists.plans, planId)}
          emptyText={t("Không có dịch vụ đang điều trị")}
          onChange={pickLine}
        />
      </FloatingField>
      <FloatingField
        name="dentistId"
        label={t("Bác sĩ chỉ định")}
        required
        rules={requiredRule(t("Vui lòng chọn bác sĩ chỉ định."))}
      >
        <SearchSelect options={lists.dentists} />
      </FloatingField>
    </>
  );
}
