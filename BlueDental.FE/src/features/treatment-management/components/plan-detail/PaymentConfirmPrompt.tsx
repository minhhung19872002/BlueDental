import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import { useConfirmPayment, type PatientPaymentDto } from "../../api/treatmentPlanApi";

interface Props {
  /** The "Đã xuất phiếu thu" receipt whose ✓ was clicked; null keeps it shut. */
  payment: PatientPaymentDto | null;
  onClose: () => void;
}

/**
 * ✓ "Xác nhận thanh toán": the exported receipt turns "Đã thanh toán" as it
 * was exported — nothing on it changes, only Còn lại drops (P2610).
 */
export function PaymentConfirmPrompt({ payment, onClose }: Props) {
  const confirm = useConfirmPayment();

  const handleConfirm = async () => {
    if (!payment) return;
    try {
      await confirm.mutateAsync(payment.id);
      toast.success(t("Treatment:Payment:ConfirmSuccess"));
      onClose();
    } catch {
      // Toasted by the global MutationCache; the prompt stays open to retry.
    }
  };

  return (
    <ConfirmDialog
      open={payment !== null}
      title={t("Treatment:Payment:ConfirmPayment")}
      message={payment ? t("Treatment:Payment:ConfirmPrompt", formatMoneyUnit(payment.amount), payment.code) : ""}
      pending={confirm.isPending}
      onConfirm={() => void handleConfirm()}
      onClose={onClose}
    />
  );
}
