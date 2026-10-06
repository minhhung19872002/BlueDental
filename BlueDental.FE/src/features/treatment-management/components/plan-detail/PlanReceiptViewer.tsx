import { useEffect, useMemo } from "react";
import { Spin } from "antd";
import { usePatientDto } from "@/features/patient-management/api/patientQueries";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { notifyError } from "@/lib/notify";
import { usePatientAdvises } from "../../api/consultingQueries";
import { PAYMENT_KIND, usePatientPayments, usePlanSlip } from "../../api/treatmentPlanApi";
import { PaymentReceiptDialog } from "./PaymentReceiptDialog";
import { receiptOf } from "./receiptView";
import "../plan/treatment-plan.css";
import "./plan-detail.css";

const PAGE_CAP = 200;

interface Props {
  paymentId: string;
  patientId: string;
  treatmentPlanId: string;
  branchId: string;
  onClose: () => void;
}

/**
 * "Chi tiết phiếu" for one receipt, opened away from its plan (Tài chính →
 * Thanh toán). The sheet's "Đã thanh toán trước" and "Còn lại" are read off the
 * slip and its other receipts, so those are loaded here the way the plan's
 * Thanh toán tab already holds them.
 */
export function PlanReceiptViewer({ paymentId, patientId, treatmentPlanId, branchId, onClose }: Props) {
  const patient = usePatientDto(patientId);
  const plan = usePlanSlip(treatmentPlanId);
  const payments = usePatientPayments({
    patientId,
    clinicBranchId: branchId,
    treatmentPlanId,
    kind: PAYMENT_KIND.Payment,
    maxResultCount: PAGE_CAP,
  });
  const clinic = useBranchInfo(branchId);
  const advises = usePatientAdvises({ patientId, clinicBranchId: branchId, maxResultCount: PAGE_CAP });

  const receipt = useMemo(() => {
    const receipts = payments.data?.items ?? [];
    const payment = receipts.find((item) => item.id === paymentId);
    return payment && plan.data ? receiptOf(payment, plan.data, receipts) : null;
  }, [payments.data, plan.data, paymentId]);

  const error = patient.error ?? plan.error ?? payments.error;
  // A receipt cancelled since the list was read is gone from its slip.
  const missing = payments.isSuccess && plan.isSuccess && !receipt;

  useEffect(() => {
    if (!error && !missing) return;
    notifyError(error ? extractApiError(error) : t("Treatment:Payment:ReceiptNotFound"));
    onClose();
  }, [error, missing, onClose]);

  if (error || missing) return null;
  if (!patient.data || !plan.data || !receipt) return <Spin fullscreen />;

  return (
    <PaymentReceiptDialog
      receipt={receipt}
      patient={patient.data}
      clinic={clinic.data}
      dentistName={plan.data.dentistName}
      advises={advises.data?.items ?? []}
      onClose={onClose}
    />
  );
}
