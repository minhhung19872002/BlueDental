import { useState, type ReactNode } from "react";
import { Modal, Spin } from "antd";
import { StatusBadge } from "@/components/StatusBadge";
import { t } from "@/lib/i18n";
import type { PickerOption } from "@/hooks/useLaboPickers";
import { useDentistList } from "@/features/staff/api/staffQueries";
import {
  useTreatmentPlans,
  type TreatmentPlanSlipDto,
} from "@/features/treatment-management/api/treatmentPlanApi";
import { useLaboOrder, type LaboOrderDto } from "@/features/labo/api/laboApi";
import { laboStatusPill } from "@/features/labo/api/laboStatus";
import type { LaboOrderSource } from "../order-dialogs/laboOrderSource";
import { LaboCheckStep } from "./LaboCheckStep";
import { LaboOrderStep } from "./LaboOrderStep";
import { LaboStepTabs } from "./LaboStepTabs";
import { LaboWarrantyStep } from "./LaboWarrantyStep";
import {
  isStepDone,
  isStepOpen,
  LABO_STEP_COPY,
  resolveStep,
  type LaboStep,
  type LaboWorkflowTarget,
} from "./laboWorkflowSteps";
import "../labo-order-dialog.css";
import "./labo-workflow-theme.css";

export interface LaboWorkflowPatient {
  id: string;
  code: string;
  name: string;
}

interface Props {
  /** What to open; null keeps the dialog closed. */
  target: LaboWorkflowTarget | null;
  branchId: string;
  patient: LaboWorkflowPatient;
  onClose: () => void;
  /** Mirrors the tab picked into the URL, where the opener keeps it there. */
  onStepChange?: (step: LaboStep) => void;
}

interface StepProps {
  branchId: string;
  patient: LaboWorkflowPatient;
  order: LaboOrderDto | undefined;
  source: LaboOrderSource | null | undefined;
  plans: TreatmentPlanSlipDto[];
  dentists: PickerOption[];
  /** "Xem chi tiết >" on the summary card of tabs 2 and 3. */
  onShowOrder: () => void;
  onClose: () => void;
}

/** One body per tab; tabs 2 and 3 only ever open on a saved order. */
const STEP_BODY: Record<LaboStep, (props: StepProps) => ReactNode> = {
  order: (props) => <LaboOrderStep {...props} />,
  check: ({ order, ...props }) => order && <LaboCheckStep {...props} order={order} />,
  warranty: ({ order, ...props }) => order && <LaboWarrantyStep {...props} order={order} />,
};

function targetKey(target: LaboWorkflowTarget): string {
  // Not the step: switching tabs keeps the body (and the step it remembers) mounted.
  if (target.kind === "open") return `open:${target.orderId}`;
  return `create:${target.source?.treatmentStageId ?? target.source?.treatmentServiceId ?? "tab"}`;
}

/**
 * The one Labo dialog every "Tạo Labo", "Xem" and "Kiểm tra Labo" opens
 * (P2910_03): Đặt hàng · Nhận hàng & kiểm tra · Bảo hành as three steps, a
 * step the order has not reached locked. The title is the step on screen
 * with the order's status beside it.
 */
export function LaboWorkflowDialog({ target, branchId, patient, onClose, onStepChange }: Props) {
  return (
    <Modal
      open={target !== null}
      /* Widened past the reference's 772px at the owner's ask (2026-10-30), to
         the 1320px of the Labo 1–3 mocks (P0111); shrinks with the viewport,
         16px each side, like the payment dialog. */
      width="min(1320px, calc(100vw - 32px))"
      className="pd-labo-dialog pd-labo-workflow"
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      {target && (
        <LaboWorkflowBody
          key={targetKey(target)}
          target={target}
          branchId={branchId}
          patient={patient}
          onClose={onClose}
          onStepChange={onStepChange}
        />
      )}
    </Modal>
  );
}

function LaboWorkflowBody({ target, branchId, patient, onClose, onStepChange }: Props & { target: LaboWorkflowTarget }) {
  const orderId = target.kind === "open" ? target.orderId : undefined;
  const query = useLaboOrder(orderId);
  const order = query.data;
  const plans = useTreatmentPlans(patient.id, branchId).data?.items ?? [];
  const dentistRows = useDentistList().data ?? [];
  const [chosen, setChosen] = useState<LaboStep | undefined>(target.kind === "open" ? target.step : undefined);

  if (orderId && !order) {
    return <div className="pd-labo-loading">{query.isError ? t("Common:NoData") : <Spin />}</div>;
  }

  const step = resolveStep(chosen, order);
  const pill = order ? laboStatusPill(order) : null;
  // A doctor who has since left the list still names the saved order.
  const dentists = dentistRows.map((staff) => ({ value: staff.id, label: staff.fullName }));
  if (order?.dentistId && !dentists.some((option) => option.value === order.dentistId)) {
    dentists.push({ value: order.dentistId, label: order.dentistName ?? "" });
  }

  const pick = (next: LaboStep) => {
    setChosen(next);
    onStepChange?.(next);
  };

  return (
    <>
      {/* Title, pill and hint on the left, the steps on the right (P0111 Labo 1–3 mocks). */}
      <header className="pd-labo-workflow-head">
        <div className="pd-labo-workflow-title">
          <div className="pd-labo-workflow-titlerow">
            <h2 className="bd-modal-title">{t(LABO_STEP_COPY[step].label)}</h2>
            {pill && <StatusBadge label={t(pill.label)} bg={pill.bg} color={pill.color} />}
          </div>
          <p className="pd-labo-step-hint">{t(LABO_STEP_COPY[step].hint)}</p>
        </div>
        <LaboStepTabs
          active={step}
          isOpen={(candidate) => isStepOpen(candidate, order)}
          isDone={(candidate) => isStepDone(candidate, order)}
          onChange={pick}
        />
      </header>
      {STEP_BODY[step]({
        branchId,
        patient,
        order,
        source: target.kind === "create" ? target.source : undefined,
        plans,
        dentists,
        onShowOrder: () => pick("order"),
        onClose,
      })}
    </>
  );
}
