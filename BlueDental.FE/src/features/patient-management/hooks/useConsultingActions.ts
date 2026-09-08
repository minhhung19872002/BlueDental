import { useState } from "react";
import { toast } from "sonner";
import {
  useCancelDiagnosis,
  useCreateDiagnosis,
  useRejectAdvise,
} from "@/features/treatment-management/api/consultingQueries";
import type {
  CreatePatientDiagnosisDto,
  PatientAdviseDto,
  PatientDiagnosisDto,
} from "@/features/treatment-management/api/consultingApi";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { useDeletePatientImage, useUploadPatientImage } from "../api/patientImageApi";
import { useConsultingImageReorder } from "./usePatientImageReorder";

/**
 * Everything Chẩn đoán & Tư vấn writes, each with its own toast, plus the two
 * "are you sure" states the delete dialogs hang off.
 */
export function useConsultingActions(patientId: string, branchId: string | null) {
  const [removingDiagnosis, setRemovingDiagnosis] = useState<PatientDiagnosisDto | null>(null);
  const [removingAdvise, setRemovingAdvise] = useState<PatientAdviseDto | null>(null);

  const uploadImage = useUploadPatientImage();
  const deleteImage = useDeletePatientImage();
  const reorderImages = useConsultingImageReorder(patientId);
  const createDiagnosis = useCreateDiagnosis();
  const cancelDiagnosis = useCancelDiagnosis();
  const rejectAdvise = useRejectAdvise();

  const upload = async (files: File[]) => {
    if (!branchId) return;
    try {
      for (const file of files) {
        await uploadImage.mutateAsync({ patientId, clinicBranchId: branchId, file });
      }
      toast.success(t("Đã tải ảnh lên"));
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const removeImage = async (id: string) => {
    try {
      await deleteImage.mutateAsync(id);
      toast.success(t("Đã xoá ảnh"));
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  /** Resolves with the new slip, or null when the server turned it down. */
  const create = async (
    input: Omit<CreatePatientDiagnosisDto, "patientId" | "clinicBranchId">,
  ): Promise<PatientDiagnosisDto | null> => {
    if (!branchId) return null;
    try {
      const created = await createDiagnosis.mutateAsync({
        ...input,
        patientId,
        clinicBranchId: branchId,
      });
      toast.success(t("Đã tạo phiếu chẩn đoán"));
      return created;
    } catch (error) {
      toast.error(extractApiError(error));
      return null;
    }
  };

  const confirmCancelDiagnosis = async () => {
    if (!removingDiagnosis) return;
    try {
      await cancelDiagnosis.mutateAsync(removingDiagnosis.id);
      toast.success(t("Đã xoá chẩn đoán"));
      setRemovingDiagnosis(null);
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  /**
   * An advise is never hard-deleted — the server turns it down instead, which
   * is what keeps it out of the plan while the history stays readable.
   */
  const confirmRejectAdvise = async () => {
    if (!removingAdvise) return;
    try {
      await rejectAdvise.mutateAsync(removingAdvise.id);
      toast.success(t("Đã từ chối dịch vụ tư vấn"));
      setRemovingAdvise(null);
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return {
    upload,
    uploading: uploadImage.isPending,
    removeImage,
    reorderImage: reorderImages.reorder,
    reordering: reorderImages.reordering,
    create,
    creating: createDiagnosis.isPending,
    removingDiagnosis,
    setRemovingDiagnosis,
    confirmCancelDiagnosis,
    cancellingDiagnosis: cancelDiagnosis.isPending,
    removingAdvise,
    setRemovingAdvise,
    confirmRejectAdvise,
    rejectingAdvise: rejectAdvise.isPending,
  };
}
