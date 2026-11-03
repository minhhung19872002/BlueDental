import { useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { extractApiError } from "@/lib/apiError";
import { useDeletePatientImage, type PatientImageDto } from "../../../api/patientImageApi";

/** The công đoạn picture awaiting "Xóa ảnh" confirmation on LỊCH SỬ ĐIỀU TRỊ, and its delete (R-1111). */
export function useStageImageDelete() {
  const remove = useDeletePatientImage();
  const [removing, setRemoving] = useState<PatientImageDto | null>(null);

  const confirm = async () => {
    if (!removing) return;
    try {
      await remove.mutateAsync(removing.id);
      toast.success(t("Patient:Image:DeleteSuccess"));
      setRemoving(null);
    } catch (error) {
      toast.error(extractApiError(error) || t("Patient:Image:DeleteError"));
    }
  };

  return { removing, pending: remove.isPending, ask: setRemoving, cancel: () => setRemoving(null), confirm };
}
