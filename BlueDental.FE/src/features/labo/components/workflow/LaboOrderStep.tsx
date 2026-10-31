import { Button, Form } from "antd";
import { SaveOutlined, SendOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { PickerOption } from "@/hooks/useLaboPickers";
import type { TreatmentPlanSlipDto } from "@/features/treatment-management/api/treatmentPlanApi";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboAutoPrint } from "../order-dialogs/LaboAutoPrint";
import { LaboNewOrderHeader } from "../order-dialogs/LaboNewOrderHeader";
import { LaboOrderFields } from "../order-dialogs/LaboOrderFields";
import { LaboPrintButton } from "../order-dialogs/LaboPrintButton";
import type { LaboOrderSource } from "../order-dialogs/laboOrderSource";
import { LaboServiceMaterialRows } from "../order-dialogs/LaboServiceMaterialRows";
import { gapMessageKey } from "../order-dialogs/laboToothSpecs";
import { useLaboSendGap, type LaboSendGap } from "../order-dialogs/useLaboSendGap";
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
  /** Holds this tab on screen: sent, the order's status alone would move the dialog to tab 2. */
  onShowOrder: () => void;
  onClose: () => void;
}

/**
 * Tab 1 "Đặt hàng" (P3110 m134/m139): the order as the Labo will read it. A
 * Nháp is edited here; once «Gửi Labo & in phiếu» sent it the tab is shown,
 * locked, for reference.
 */
export function LaboOrderStep({
  branchId,
  patient,
  order,
  source,
  plans,
  dentists,
  onShowOrder,
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
  const send = useLaboSendGap(form);
  const printPatient = { ...patient, dateOfBirth: order?.patientDateOfBirth ?? null };

  // LaboAutoPrint lives in this tab: it must stay mounted until the sheet printed.
  const handleSend = () => {
    onShowOrder();
    void step.submit();
  };

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
        <LaboServiceMaterialRows form={form} />
        <LaboOrderFields
          form={form}
          code={step.code}
          busy={saving}
          emptyTeeth={
            step.picksSource ? (
              <span className="pd-labo-emptypill">
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
        {editable && <LaboSendStatus send={send} />}
        <div className="pd-labo-footer-actions">
          <Button onClick={onClose}>{t("Labo:Workflow:Dismiss")}</Button>
          <LaboCancelOrderButton order={order} disabled={saving} onDone={onClose} />
          {order && !editable && (
            <LaboPrintButton
              order={order}
              branchId={branchId}
              patient={printPatient}
            />
          )}
          {editable && (
            <>
              <Button
                color="primary"
                variant="outlined"
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
                disabled={saving || !send.canSend}
                onClick={handleSend}
              >
                {t("Labo:Workflow:SendAndPrint")}
              </Button>
            </>
          )}
        </div>
      </div>
      {step.printing && (
        <LaboAutoPrint
          order={step.printing}
          branchId={branchId}
          patient={{ ...patient, dateOfBirth: step.printing.patientDateOfBirth ?? null }}
          onDone={onClose}
        />
      )}
    </>
  );
}

/** The footer's left: the first row still lacking, in red, or that every tooth is ready. */
function LaboSendStatus({ send }: { send: LaboSendGap }) {
  if (send.gap) {
    return <span className="pd-labo-footer-hint pd-labo-footer-hint--gap">{t(gapMessageKey(send.gap), send.gap.label)}</span>;
  }
  if (send.teeth === 0) return <span className="pd-labo-footer-hint">{t("Treatment:Tooth:ToothRequired")}</span>;
  return <span className="pd-labo-footer-hint">{t("Labo:Spec:Complete", send.teeth)}</span>;
}
