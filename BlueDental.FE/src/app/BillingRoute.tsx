import { useCurrentBranchId } from "@/lib/clinicBranch";
import { BillingPage, type LedgerRowDialogs } from "@/features/billing/pages/BillingPage";
import { InvoiceModal } from "@/features/treatment-management/components/InvoiceModal";
import { PlanReceiptViewer } from "@/features/treatment-management/components/plan-detail/PlanReceiptViewer";

/**
 * /billing — Tài chính → Thanh toán, with the plan's own receipt sheet and
 * e-invoice dialog behind its row actions. Composed here so neither feature
 * imports the other.
 */
export function BillingRoute() {
  const branchId = useCurrentBranchId();

  const dialogs: LedgerRowDialogs = {
    renderReceipt: (row, onClose) =>
      row.treatmentPlanId && (
        <PlanReceiptViewer
          paymentId={row.id}
          patientId={row.patientId}
          treatmentPlanId={row.treatmentPlanId}
          branchId={branchId}
          onClose={onClose}
        />
      ),
    renderEInvoice: (row, onClose) => (
      <InvoiceModal open source={{ patientPaymentId: row.id }} onClose={onClose} />
    ),
  };

  return <BillingPage dialogs={dialogs} />;
}
