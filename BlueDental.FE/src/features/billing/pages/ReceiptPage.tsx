import { useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { ReceiptPaper, type ReceiptClinic } from "@/components/ReceiptPaper";
import { StepTrack } from "@/components/StepTrack";
import { useAbility } from "@/hooks/useAbility";
import { extractApiError } from "@/lib/apiError";
import { withBranch } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { receiptCancelPath } from "@/lib/receiptTab";
import { RECEIPT_SIGN_MODE, RECEIPT_STATUS, usePaymentReceipt, type PaymentReceiptDto } from "../api/paymentReceiptApi";
import type { ReceiptSigningStateDto } from "../api/receiptSigningApi";
import { planPaymentPath } from "../components/paymentLedgerColumns";
import { ReceiptExportedPanel } from "../components/receipt/ReceiptExportedPanel";
import { ReceiptHeader } from "../components/receipt/ReceiptHeader";
import { ReceiptPageSkeleton } from "../components/receipt/ReceiptPageSkeleton";
import { ReceiptStatusPanel } from "../components/receipt/ReceiptStatusPanel";
import { ReceiptWaitingPanel } from "../components/receipt/ReceiptWaitingPanel";
import { isCancellable } from "../components/receipt/receiptStatus";
import { countedSession, customerSigned, receiptSteps } from "../components/receipt/receiptSteps";
import { useAccountantSignature } from "../hooks/useAccountantSignature";
import { useReceiptExport } from "../hooks/useReceiptExport";
import { useReceiptIpad } from "../hooks/useReceiptIpad";
import { useReceiptPrint } from "../hooks/useReceiptPrint";
import "../components/receipt/receipt.css";

/**
 * Tài chính → Phiếu thu (P2610, P2910_02): one receipt on its way from the
 * counter to the customer's signature — the step bar, the PHIẾU THU as
 * written, and where it stands: the iPad buttons and "In phiếu thu để ký tay"
 * while it waits, the accountant's export once signed. "Tạo phiếu thanh
 * toán" lands here; the slip's Thanh toán tab opens it from the receipt's
 * number or 👁.
 */
export function ReceiptPage({ clinic }: { clinic: ReceiptClinic }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: receipt, isLoading, error } = usePaymentReceipt(id);
  const ipad = useReceiptIpad(id);
  const exporter = useReceiptExport(id);
  const printer = useReceiptPrint(id);
  const waiting = receipt?.status === RECEIPT_STATUS.Pending;
  const customer = receipt ? customerSigned(receipt, ipad.state?.session ?? null) : null;
  // The saved signature is read only once the accountant's step is reached.
  const signature = useAccountantSignature(waiting && customer !== null);
  // Hủy phiếu thu rides on payment.delete, as Huỷ on the slip's Thanh toán tab.
  const { canDelete: canCancel, canCreate } = useAbility("payment");

  // Both reads first: the steps' times and the signature come with the iPad state.
  if (isLoading || ipad.loading) return <ReceiptPageSkeleton />;
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
  const exported = receipt.status === RECEIPT_STATUS.Issued || receipt.status === RECEIPT_STATUS.Completed;

  // Exported: In phiếu prints the file kept at export; Tải PDF saves it; Tạo phiếu mới opens the slip's dialog.
  // The number has "/" in it (THANHTOAN-1/DT1/2026), which no file name may hold.
  const handleDownload = () => exporter.downloadStored(`${receipt.code.replace(/[\\/:*?"<>|]/g, "-")}.pdf`);
  const newPaymentPath = receipt.treatmentPlanId
    ? planPaymentPath(receipt.patientId, receipt.treatmentPlanId, receipt.clinicBranchId, true)
    : null;

  return (
    <div className="page-container rcpt-page">
      <ReceiptHeader
        receipt={receipt}
        backPath={slipPath}
        onCancel={
          canCancel && isCancellable(receipt.status)
            ? () => navigate(receiptCancelPath(receipt.id, receipt.clinicBranchId))
            : undefined
        }
      />
      <section className="rcpt-track-card">
        <StepTrack items={receiptSteps(receipt, ipad.state?.session ?? null)} label={t("Receipt:Step:Label")} />
      </section>
      <div className="rcpt-body">
        <ReceiptPaper receipt={receipt} clinic={clinic} signature={signatureOf(ipad.state)} marks={marksOf(receipt)} />
        {exported && (
          <ReceiptExportedPanel
            receipt={receipt}
            customer={customer}
            print={{
              run: receipt.hasFile ? exporter.printStored : printer.printDraft,
              pending: printer.printing || exporter.printingStored,
            }}
            download={receipt.hasFile ? { run: handleDownload, pending: exporter.downloadingStored } : undefined}
            onCreateNew={canCreate && newPaymentPath ? () => navigate(newPaymentPath) : undefined}
          />
        )}
        {waiting && (
          <ReceiptWaitingPanel
            receipt={receipt}
            slipPath={slipPath}
            ipad={ipad}
            printer={printer}
            exporter={exporter}
            signature={signature}
          />
        )}
        {!exported && !waiting && <ReceiptStatusPanel receipt={receipt} slipPath={slipPath} />}
      </div>
    </div>
  );
}

/** The customer's drawing goes in the Người nộp tiền box once signed on the iPad. */
function signatureOf(state: ReceiptSigningStateDto | null) {
  const session = countedSession(state?.session ?? null);
  if (!session?.signatureDataUrl || !session.signedAt) return null;
  return { dataUrl: session.signatureDataUrl, signedAt: session.signedAt };
}

/** Signed on the printout; exported with the accountant's saved signature. */
function marksOf(receipt: PaymentReceiptDto) {
  return {
    payerOnPaper: receipt.paperSignedAt !== null,
    accountantSigned: receipt.issuedAt !== null && receipt.signMode === RECEIPT_SIGN_MODE.Electronic,
  };
}
