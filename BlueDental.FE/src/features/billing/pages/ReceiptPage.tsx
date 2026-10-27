import { useNavigate, useParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState";
import { ReceiptPaper, type ReceiptClinic } from "@/components/ReceiptPaper";
import { StepTrack } from "@/components/StepTrack";
import { useAbility } from "@/hooks/useAbility";
import { extractApiError } from "@/lib/apiError";
import { withBranch } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { openReceiptTab, receiptCancelPath, showReceipt } from "@/lib/receiptTab";
import { RECEIPT_STATUS, usePaymentReceipt, useReceiptPdf } from "../api/paymentReceiptApi";
import type { ReceiptSigningStateDto } from "../api/receiptSigningApi";
import { planPaymentPath } from "../components/paymentLedgerColumns";
import { ReceiptExportButton, ReceiptExportPanel } from "../components/receipt/ReceiptExportPanel";
import { ReceiptExportedPanel } from "../components/receipt/ReceiptExportedPanel";
import { ReceiptHeader } from "../components/receipt/ReceiptHeader";
import { ReceiptIpadControls, ReceiptIpadStatus } from "../components/receipt/ReceiptIpadControls";
import { ReceiptPageSkeleton } from "../components/receipt/ReceiptPageSkeleton";
import { ReceiptStatusPanel } from "../components/receipt/ReceiptStatusPanel";
import { isCancellable } from "../components/receipt/receiptStatus";
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

  const session = ipad.state?.session ?? null;

  const waiting = receipt.status === RECEIPT_STATUS.Pending;
  const exported =
    receipt.status === RECEIPT_STATUS.Issued || receipt.status === RECEIPT_STATUS.Completed;
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

  // Exported: Tải PDF saves the kept file; Tạo phiếu mới opens the slip's dialog (BA mock).
  // The number has "/" in it (THANHTOAN-1/DT1/2026), which no file name may hold.
  const handleDownload = () =>
    exporter.downloadStored(`${receipt.code.replace(/[\\/:*?"<>|]/g, "-")}.pdf`);
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
        <StepTrack items={receiptSteps(receipt, session)} label={t("Receipt:Step:Label")} />
      </section>
      <div className="rcpt-body">
        <ReceiptPaper receipt={receipt} clinic={clinic} signature={signatureOf(ipad.state)} />
        {exported ? (
          <ReceiptExportedPanel
            receipt={receipt}
            print={{ run: handlePrint, pending: pdf.isPending || exporter.printingStored }}
            download={
              receipt.hasFile
                ? { run: handleDownload, pending: exporter.downloadingStored }
                : undefined
            }
            onCreateNew={canCreate && newPaymentPath ? () => navigate(newPaymentPath) : undefined}
          />
        ) : (
          <ReceiptStatusPanel
            receipt={receipt}
            slipPath={slipPath}
            print={
              waiting && signed
                ? undefined
                : { run: handlePrint, pending: pdf.isPending || exporter.printingStored }
            }
            pendingTitle={pendingTitleOf(ipad.state)}
            notice={waiting && ipad.state && <ReceiptIpadStatus state={ipad.state} />}
            actions={
              waiting &&
              ipad.state && (
                <ReceiptIpadControls
                  state={ipad.state}
                  pendingAction={ipad.pendingAction}
                  confirmReplace={ipad.confirmReplace}
                  handlers={ipad}
                />
              )
            }
            primary={
              waiting &&
              signed && (
                <ReceiptExportButton
                  signMode={exporter.signMode}
                  onExport={exporter.exportReceipt}
                  exporting={exporter.exporting}
                />
              )
            }
          >
            {waiting && signed && (
              <ReceiptExportPanel
                signMode={exporter.signMode}
                onSignModeChange={exporter.setSignMode}
                exporting={exporter.exporting}
              />
            )}
          </ReceiptStatusPanel>
        )}
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
