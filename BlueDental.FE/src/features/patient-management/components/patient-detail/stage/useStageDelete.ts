import { useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { useDeleteStage, type TreatmentStageDto } from "@/features/treatment-management/api/stageApi";

/**
 * The công đoạn awaiting "Xóa công đoạn" confirmation on LỊCH SỬ ĐIỀU TRỊ, and
 * its delete — an admin's way to undo a row written by mistake (BA 2026-11-02).
 * The server hands the teeth back to the row before it and refuses a row a
 * later one continues (0065) or a Labo order still stands on (0064).
 */
export function useStageDelete() {
  const remove = useDeleteStage();
  const [removing, setRemoving] = useState<TreatmentStageDto | null>(null);

  const confirm = async () => {
    if (!removing) return;
    try {
      await remove.mutateAsync(removing.id);
      toast.success(t("Patient:Stage:Deleted"));
      setRemoving(null);
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  return { removing, pending: remove.isPending, ask: setRemoving, cancel: () => setRemoving(null), confirm };
}
