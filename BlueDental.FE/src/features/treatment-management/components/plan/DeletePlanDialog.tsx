import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { notifyError } from "@/lib/notify";
import { useDeleteTreatmentPlan, type TreatmentPlanSlipDto } from "../../api/treatmentPlanApi";
import { moneyText } from "./planTypes";

interface Props {
  /** The slip to delete; null keeps the dialog closed. */
  plan: TreatmentPlanSlipDto | null;
  onClose: () => void;
}

/**
 * "Xoá phiếu điều trị". The slip goes with everything written against it, its
 * receipts included, so a slip that has taken money says how much in red
 * before the confirm (owner 2026-10-27). A refusal from the server comes back
 * as its own message and the dialog stays open.
 */
export function DeletePlanDialog({ plan, onClose }: Props) {
  const deletePlan = useDeleteTreatmentPlan();
  const paid = plan?.payment.totalPaid ?? 0;

  const handleConfirm = async () => {
    if (!plan) return;
    try {
      await deletePlan.mutateAsync(plan.id);
      toast.success(t("Treatment:Plan:DeleteSuccess", plan.code));
      onClose();
    } catch (error) {
      notifyError(extractApiError(error) || t("Treatment:Plan:DeleteError"));
    }
  };

  return (
    <ConfirmDeleteDialog
      open={plan !== null}
      noun={t("Treatment:Plan:DeleteNoun")}
      name={plan?.code}
      note={
        <>
          {paid > 0 && (
            <span className="tp-delete-paid">
              {t("Treatment:Plan:DeletePaidWarning", moneyText(paid))}
            </span>
          )}
          {t("Treatment:Plan:DeleteNote")}
        </>
      }
      pending={deletePlan.isPending}
      onConfirm={handleConfirm}
      onClose={onClose}
    />
  );
}
