import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Spin } from "antd";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { useAbility } from "@/hooks/useAbility";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { receiptPagePath } from "@/lib/receiptTab";
import { useCancelReceipt, usePaymentReceipt, type CancelReceiptInput } from "../api/paymentReceiptApi";
import { ReceiptCancelForm } from "../components/receipt/cancel/ReceiptCancelForm";
import { ReceiptCancelHeader } from "../components/receipt/cancel/ReceiptCancelHeader";
import { ReceiptCancelSummary } from "../components/receipt/cancel/ReceiptCancelSummary";
import { isCancellable } from "../components/receipt/receiptStatus";
import "../components/receipt/receipt.css";

/**
 * Tài chính → Phiếu thu → Hủy phiếu thu (P2610 phase 6): the receipt on the
 * left, why it is cancelled on the right — at any step (BA). Sent, the receipt
 * reads Đã hủy and is kept, its iPad session closes, and the debt it settled
 * comes back. Back on the receipt's page either way. One already cancelled,
 * or without payment.delete, goes back too.
 */
export function ReceiptCancelPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: receipt, isLoading, error } = usePaymentReceipt(id);
  const cancel = useCancelReceipt(id);
  const { canDelete } = useAbility("payment");

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

  const receiptPath = receiptPagePath(receipt.id, receipt.clinicBranchId);
  // Not while the cancel is in flight: its refetch reads Đã hủy before onSuccess runs.
  if (!cancel.isPending && !cancel.isSuccess && (!canDelete || !isCancellable(receipt.status))) {
    return <Navigate to={receiptPath} replace />;
  }

  // A refusal (a refund drew on it, a signed e-invoice) is toasted by the global MutationCache.
  const handleSubmit = (input: CancelReceiptInput) =>
    cancel.mutate(input, {
      onSuccess: () => {
        toast.success(t("Receipt:Cancel:Done"));
        navigate(receiptPath, { replace: true });
      },
    });

  return (
    <div className="page-container rcpt-page">
      <ReceiptCancelHeader receipt={receipt} backPath={receiptPath} />
      <div className="rcpt-cancel-body">
        <ReceiptCancelSummary receipt={receipt} />
        <ReceiptCancelForm pending={cancel.isPending} onSubmit={handleSubmit} onBack={() => navigate(receiptPath)} />
      </div>
    </div>
  );
}
