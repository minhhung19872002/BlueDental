import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { notifyError } from "@/lib/notify";
import { useDeleteTreatmentPlan, type TreatmentPlanSlipDto } from "../../api/treatmentPlanApi";

interface Props {
  /** The slip to delete; null keeps the dialog closed. */
  plan: TreatmentPlanSlipDto | null;
  onClose: () => void;
}

/**
 * "Xoá phiếu điều trị". The server refuses a slip that already has money,
 * công đoạn, labo, prescriptions, re-exams or an e-invoice against it; that
 * refusal comes back as its own message and the dialog stays open.
 */
export function DeletePlanDialog({ plan, onClose }: Props) {
  const deletePlan = useDeleteTreatmentPlan();

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
      note={t("Treatment:Plan:DeleteNote")}
      pending={deletePlan.isPending}
      onConfirm={handleConfirm}
      onClose={onClose}
    />
  );
}
