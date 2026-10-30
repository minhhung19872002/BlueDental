import { Button, Form } from "antd";
import { SaveOutlined, SendOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { PickerOption } from "@/hooks/useLaboPickers";
import type { TreatmentPlanSlipDto } from "@/features/treatment-management/api/treatmentPlanApi";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboMaterialStrips } from "../order-dialogs/LaboChipStrips";
import { LaboNewOrderHeader } from "../order-dialogs/LaboNewOrderHeader";
import { LaboOrderFields } from "../order-dialogs/LaboOrderFields";
import { LaboPrintButton } from "../order-dialogs/LaboPrintButton";
import type { LaboOrderSource } from "../order-dialogs/laboOrderSource";
import { LaboCancelOrderButton } from "./LaboCancelOrderButton";
import type { LaboWorkflowPatient } from "./LaboWorkflowDialog";
import { useLaboOrderStep } from "./useLaboOrderStep";

interface Props {
  branchId: string;
  patient: LaboWorkflowPatient;
  order: LaboOrderDto | undefined;
  source: LaboOrderSource | null | undefined;
  plans: TreatmentPlanSlipDto[];
  dentists: PickerOption[];
  onClose: () => void;
}

/**
 * Tab 1 "Đặt hàng": the order as the Labo will read it. A Nháp is edited
 * here; once Tạo phiếu Labo sent it the tab is shown, locked, for reference.
 */
export function LaboOrderStep({
  branchId,
  patient,
  order,
  source,
  plans,
  dentists,
  onClose,
}: Props) {
  const step = useLaboOrderStep({
    branchId,
    patientId: patient.id,
    order,
    source,
    plans,
    onDone: onClose,
  });
  const { form, editable, saving } = step;

  return (
    <>
      <Form
        form={form.form}
        layout="vertical"
        className="pd-labo-form"
        disabled={!editable}
        scrollToFirstError
      >
        <LaboNewOrderHeader
          patient={patient}
          source={step.headerSource}
          plans={step.picksSource ? plans : undefined}
          dentists={dentists}
          code={step.code}
          form={form}
        />
        <LaboMaterialStrips form={form} />
        <LaboOrderFields
          form={form}
          code={step.code}
          busy={saving}
          emptyTeeth={
            step.picksSource ? (
              <span className="pd-labo-teeth-hint">
                {t("Patient:Stage:SelectTreatmentServiceFirst")}
              </span>
            ) : (
              <span className="pd-labo-emptypill">{t("Patient:QuoteSheet:Empty")}</span>
            )
          }
        />
      </Form>
      {/* Outside the form: its `disabled` locks the fields of a sent order, not Huỷ or In. */}
      <div className="pd-labo-footer pd-labo-step-footer">
        {editable && (
          <span className="pd-labo-footer-hint">{t("Labo:Workflow:OrderFooterHint")}</span>
        )}
        <div className="pd-labo-footer-actions">
          <Button onClick={onClose}>{t("Labo:Workflow:Dismiss")}</Button>
          <LaboCancelOrderButton order={order} disabled={saving} onDone={onClose} />
          {order && !editable && (
            <LaboPrintButton
              order={order}
              branchId={branchId}
              patient={{ ...patient, dateOfBirth: order.patientDateOfBirth ?? null }}
            />
          )}
          {editable && (
            <>
              <Button
                icon={<SaveOutlined />}
                loading={saving}
                disabled={saving}
                onClick={() => void step.saveDraft()}
              >
                {t("Labo:Workflow:SaveDraft")}
              </Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={saving}
                disabled={saving}
                onClick={() => void step.submit()}
              >
                {t("Labo:Workflow:Submit")}
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
