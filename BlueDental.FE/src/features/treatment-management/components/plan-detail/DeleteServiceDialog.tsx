import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { notifyError } from "@/lib/notify";
import { useDeleteServiceLine, type TreatmentServiceDto } from "../../api/treatmentPlanApi";

interface Props {
  planId: string;
  /** The line to take off the slip; null keeps the dialog closed. */
  service: TreatmentServiceDto | null;
  onClose: () => void;
}

/**
 * "Xóa" on a line still "Đã tạo" (R-953). The server refuses a line with money,
 * công đoạn, re-exams or labo against it; that refusal comes back as its own
 * message and the dialog stays open.
 */
export function DeleteServiceDialog({ planId, service, onClose }: Props) {
  const deleteLine = useDeleteServiceLine();

  const handleConfirm = async () => {
    if (!service) return;
    try {
      await deleteLine.mutateAsync({ planId, lineId: service.id });
      toast.success(t("Treatment:Service:DeleteSuccess"));
      onClose();
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  return (
    <ConfirmDeleteDialog
      open={service !== null}
      noun={t("Treatment:Service:ServiceNoun")}
      name={service?.serviceName ?? service?.code}
      pending={deleteLine.isPending}
      onConfirm={handleConfirm}
      onClose={onClose}
    />
  );
}
