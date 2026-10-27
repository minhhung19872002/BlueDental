import { useNavigate, useParams } from "react-router-dom";
import { Spin } from "antd";
import { EmptyState } from "@/components/EmptyState";
import { ReceiptPaper, type ReceiptClinic } from "@/components/ReceiptPaper";
import { StepTrack } from "@/components/StepTrack";
import { extractApiError } from "@/lib/apiError";
import { withBranch } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { openReceiptTab, showReceipt } from "@/lib/receiptTab";
import { RECEIPT_STATUS, usePaymentReceipt, useReceiptPdf } from "../api/paymentReceiptApi";
import type { ReceiptSigningStateDto } from "../api/receiptSigningApi";
import { planPaymentPath } from "../components/paymentLedgerColumns";
import { ReceiptExportPanel } from "../components/receipt/ReceiptExportPanel";
import { ReceiptHeader } from "../components/receipt/ReceiptHeader";
import { ReceiptIpadControls } from "../components/receipt/ReceiptIpadControls";
import { ReceiptStatusPanel } from "../components/receipt/ReceiptStatusPanel";
import { countedSession, receiptSteps } from "../components/receipt/receiptSteps";
import { useReceiptExport } from "../hooks/useReceiptExport";
import { useReceiptIpad } from "../hooks/useReceiptIpad";
import "../components/receipt/receipt.css";

/**
 * Tài chính → Phiếu thu (P2610): one receipt on its way from the counter to
 * the customer's signature — the step bar, the PHIẾU THU as written, and where
 * it stands, with the iPad buttons while it waits. "Tạo phiếu thanh toán"
 * lands here; the slip's Thanh toán tab opens it from the receipt's number or 👁.
 */
export function ReceiptPage({ clinic }: { clinic: ReceiptClinic }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: receipt, isLoading, error } = usePaymentReceipt(id);
  const pdf = useReceiptPdf();
  const ipad = useReceiptIpad(id);
  const exporter = useReceiptExport(id);

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

  const session = ipad.state?.session ?? null;

  const waiting = receipt.status === RECEIPT_STATUS.Pending;
  const signed = Boolean(session?.isOpen && session.signedAt);

  // An exported receipt prints the file kept at export; before that, the template.
  const handlePrint = () => {
    if (receipt.hasFile) {
      exporter.printStored();
      return;
    }
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
        <StepTrack items={receiptSteps(receipt, session)} label={t("Receipt:Step:Label")} />
      </section>
      <div className="rcpt-body">
        <ReceiptPaper receipt={receipt} clinic={clinic} signature={signatureOf(ipad.state)} />
        <ReceiptStatusPanel
          receipt={receipt}
          slipPath={slipPath}
          onPrint={handlePrint}
          printing={pdf.isPending || exporter.printingStored}
          pendingTitle={pendingTitleOf(ipad.state)}
        >
          {waiting && ipad.state && (
            <ReceiptIpadControls
              state={ipad.state}
              pendingAction={ipad.pendingAction}
              confirmReplace={ipad.confirmReplace}
              handlers={ipad}
            />
          )}
          {waiting && signed && (
            <ReceiptExportPanel
              signMode={exporter.signMode}
              onSignModeChange={exporter.setSignMode}
              onExport={exporter.exportReceipt}
              exporting={exporter.exporting}
            />
          )}
        </ReceiptStatusPanel>
      </div>
    </div>
  );
}

/** The customer's drawing goes in the Người nộp tiền box once signed. */
function signatureOf(state: ReceiptSigningStateDto | null) {
  const session = countedSession(state?.session ?? null);
  if (!session?.signatureDataUrl || !session.signedAt) return null;
  return { dataUrl: session.signatureDataUrl, signedAt: session.signedAt };
}

/** The column's heading while the receipt waits, by what the customer has done. */
function pendingTitleOf(state: ReceiptSigningStateDto | null): string | undefined {
  const open = state?.session?.isOpen ? state.session : null;
  if (!open) return undefined;
  return open.signedAt ? t("Receipt:Panel:SignedTitle") : t("Receipt:Panel:AtIpadTitle");
}
