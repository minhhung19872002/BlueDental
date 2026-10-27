import { useNavigate, useParams } from "react-router-dom";
import { Spin } from "antd";
import { EmptyState } from "@/components/EmptyState";
import { StepTrack } from "@/components/StepTrack";
import { extractApiError } from "@/lib/apiError";
import { withBranch } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { openReceiptTab, showReceipt } from "@/lib/receiptTab";
import { usePaymentReceipt, useReceiptPdf } from "../api/paymentReceiptApi";
import { planPaymentPath } from "../components/paymentLedgerColumns";
import { ReceiptHeader } from "../components/receipt/ReceiptHeader";
import { ReceiptSheet, type ReceiptClinic } from "../components/receipt/ReceiptSheet";
import { ReceiptStatusPanel } from "../components/receipt/ReceiptStatusPanel";
import { receiptSteps } from "../components/receipt/receiptSteps";
import "../components/receipt/receipt.css";

/**
 * Tài chính → Phiếu thu (P2610): one receipt on its way from the counter to
 * the customer's signature — the step bar, the PHIẾU THU as written, and where
 * it stands. "Tạo phiếu thanh toán" lands here; the slip's Thanh toán tab
 * opens it from the receipt's number or 👁.
 */
export function ReceiptPage({ clinic }: { clinic: ReceiptClinic }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: receipt, isLoading, error } = usePaymentReceipt(id);
  const pdf = useReceiptPdf();

  if (isLoading) return <Spin className="rcpt-loading" />;
  if (error || !receipt) {
    return (
      <EmptyState
        title={t("Receipt:Page:Unavailable")}
        description={error ? extractApiError(error) : undefined}
        actionLabel={t("Treatment:Common:GoBack")}
        onAction={() => navigate("/billing")}
      />
    );
  }

  const slipPath = receipt.treatmentPlanId
    ? planPaymentPath(receipt.patientId, receipt.treatmentPlanId, receipt.clinicBranchId)
    : withBranch("/billing", receipt.clinicBranchId);

  const handlePrint = () => {
    const tab = openReceiptTab();
    pdf.mutate(receipt.id, {
      onSuccess: (blob) => showReceipt(tab, blob),
      // The failure itself is toasted by the global MutationCache.
      onError: () => tab?.close(),
    });
  };

  return (
    <div className="page-container rcpt-page">
      <ReceiptHeader receipt={receipt} backPath={slipPath} />
      <section className="rcpt-track-card">
        <StepTrack items={receiptSteps(receipt)} label={t("Receipt:Step:Label")} />
      </section>
      <div className="rcpt-body">
        <ReceiptSheet receipt={receipt} clinic={clinic} />
        <ReceiptStatusPanel receipt={receipt} slipPath={slipPath} onPrint={handlePrint} printing={pdf.isPending} />
      </div>
    </div>
  );
}
