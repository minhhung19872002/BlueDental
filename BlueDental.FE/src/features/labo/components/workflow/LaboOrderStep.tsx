import { useState } from "react";
import { Button, Form } from "antd";
import { SaveOutlined, SendOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { PickerOption } from "@/hooks/useLaboPickers";
import type { TreatmentPlanSlipDto } from "@/features/treatment-management/api/treatmentPlanApi";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboNewOrderHeader } from "../order-dialogs/LaboNewOrderHeader";
import { LaboOrderSpecs, LaboTeethField } from "../order-dialogs/LaboOrderFields";
import { LaboPrintButton } from "../order-dialogs/LaboPrintButton";
import type { LaboOrderSource } from "../order-dialogs/laboOrderSource";
import { LaboServiceMaterialRows } from "../order-dialogs/LaboServiceMaterialRows";
import { useLaboSendGap, type LaboSendGap } from "../order-dialogs/useLaboSendGap";
import { LaboDetailDialog } from "../order-dialogs/LaboDetailDialog";
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
  readOnly: boolean;
  onClose: () => void;
}

/**
 * Tab 1 "Đặt hàng" (P3110 m134/m139): the order as the Labo will read it. A
 * Nháp is edited here; «Tạo phiếu Labo» sends it and lets the dialog go — no
 * print, no new tab (P0111_02, R-1108). Sent, the tab is shown locked for
 * reference; In Phiếu Labo still prints it on demand. «Xem phiếu ›» on the
 * duplicate-tooth warning opens the earlier order over the draft, read-only
 * (P0111_02, R-1106).
 */
export function LaboOrderStep({
  branchId,
  patient,
  order,
  source,
  plans,
  dentists,
  readOnly,
  onClose,
}: Props) {
  const step = useLaboOrderStep({
    branchId,
    patientId: patient.id,
    order,
    source,
    plans,
    readOnly,
    onDone: onClose,
  });
  const { form, editable, saving } = step;
  const send = useLaboSendGap(form);
  const [viewing, setViewing] = useState<LaboOrderDto | null>(null);
  const printPatient = { ...patient, dateOfBirth: order?.patientDateOfBirth ?? null };

  return (
    <>
      {/* Labo 1 mock: "Thông tin phiếu" on the left, the per-tooth specs on the right. */}
      <Form
        form={form.form}
        layout="vertical"
        className="pd-labo-form pd-labo-flow-main"
        disabled={!editable}
        scrollToFirstError
      >
        <section className="pd-labo-flow-pane pd-labo-flow-pane--side pd-labo-flow-pane--order">
          <h3 className="pd-labo-flow-pane-title">{t("Labo:Summary:Order")}</h3>
          <LaboNewOrderHeader
            patient={patient}
            source={step.headerSource}
            plans={step.picksSource ? plans : undefined}
            dentists={dentists}
            code={step.code}
            form={form}
          />
          <hr className="pd-labo-flow-rule" />
          <LaboServiceMaterialRows form={form} />
          <LaboTeethField
            form={form}
            code={step.code}
            priors={step.priors}
            onViewPrior={setViewing}
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
        </section>
        <section className="pd-labo-flow-pane pd-labo-flow-pane--main">
          <LaboOrderSpecs form={form} busy={saving} priors={step.priors} />
        </section>
      </Form>
      {/* Outside the form: its `disabled` locks the fields of a sent order, not Huỷ or In. */}
      <div className="pd-labo-footer pd-labo-step-footer">
        {editable && <LaboSendStatus send={send} />}
        <div className="pd-labo-footer-actions">
          <Button onClick={onClose}>{t("Labo:Workflow:Dismiss")}</Button>
          {!readOnly && <LaboCancelOrderButton order={order} disabled={saving} onDone={onClose} />}
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
                onClick={() => void step.submit()}
              >
                {t("Labo:Workflow:CreateOrder")}
              </Button>
            </>
          )}
        </div>
      </div>
      <LaboDetailDialog
        order={viewing}
        branchId={branchId}
        canCreateAppointment={false}
        onClose={() => setViewing(null)}
      />
    </>
  );
}

/**
 * The footer's left (Labo v2 mock): the case and each tooth's surfaces, then
 * everything «Tạo phiếu Labo» still waits for, in red, or that all is ready.
 */
function LaboSendStatus({ send }: { send: LaboSendGap }) {
  if (send.teeth === 0) return <span className="pd-labo-footer-hint">{t("Treatment:Tooth:ToothRequired")}</span>;
  return (
    <span className="pd-labo-footer-hint pd-labo-footer-status">
      <span>{send.summary}</span>
      {send.errors.length > 0 ? (
        <span className="pd-labo-footer-hint--gap">
          {t("Labo:Spec:Errors", send.errors.length, send.errors.map((error) => error.message).join(" · "))}
        </span>
      ) : (
        <span className="pd-labo-footer-hint--done">{t("Labo:Spec:AllDone")}</span>
      )}
    </span>
  );
}
