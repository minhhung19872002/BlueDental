import { useState } from "react";
import { toast } from "sonner";
import {
  useAcceptAdvise,
  useCancelDiagnosis,
  useCreateDiagnosis,
  useRejectAdvise,
  useReorderAdvise,
  useUpdateDiagnosis,
} from "@/features/treatment-management/api/consultingQueries";
import { useOpenTreatmentPlan } from "@/features/treatment-management/api/treatmentPlanApi";
import {
  ADVISE_STATUS,
  type CreatePatientDiagnosisDto,
  type PatientAdviseDto,
  type PatientDiagnosisDto,
  type UpdatePatientDiagnosisDto,
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
  const updateDiagnosis = useUpdateDiagnosis();
  const cancelDiagnosis = useCancelDiagnosis();
  const rejectAdvise = useRejectAdvise();
  const reorderAdvise = useReorderAdvise();
  const acceptAdvise = useAcceptAdvise();
  const openPlan = useOpenTreatmentPlan();

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

  /** Resolves with the slip as saved, or null when the server turned it down. */
  const update = async (
    id: string,
    data: UpdatePatientDiagnosisDto,
  ): Promise<PatientDiagnosisDto | null> => {
    try {
      const updated = await updateDiagnosis.mutateAsync({ id, data });
      toast.success(t("Đã cập nhật phiếu chẩn đoán"));
      return updated;
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

  /**
   * A dragged advise row. The table keeps showing the dragged order until this
   * settles, so nothing is said on success — only a refusal needs a word, and
   * the list then snaps back to what the server actually holds.
   */
  const moveAdvise = async (id: string, sortOrder: number) => {
    try {
      await reorderAdvise.mutateAsync({ id, sortOrder });
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  /**
   * "Thêm kế hoạch điều trị": opens a slip off the ticked consulting lines.
   *
   * The server pulls in **accepted** lines only, so a line still `Created` is
   * accepted first — the same order the single-service dialog uses. Only those:
   * `PatientAdvise.Accept` refuses anything that is not `Created`, so accepting
   * a line blindly would throw on one that had already been through here.
   *
   * A line already `Converted` belongs to a slip and cannot join another, so it
   * is left out rather than sent and refused. Nothing to send means nothing to
   * open, which is a refusal the caller reports.
   *
   * Opening converts the lines, and `ConvertTo` makes each immutable — so this
   * is deliberately the last step.
   *
   * Resolves true once the slip exists, so the caller can move to its tab.
   */
  const addToPlan = async (
    dentistId: string,
    rows: PatientAdviseDto[],
    voucherDiscountAmount?: number,
  ): Promise<boolean> => {
    if (!branchId) return false;

    const usable = rows.filter(
      (row) => row.status === ADVISE_STATUS.Created || row.status === ADVISE_STATUS.Accepted,
    );
    if (usable.length === 0) {
      toast.error(t("Những dịch vụ đã chọn đều đã nằm trong một kế hoạch điều trị"));
      return false;
    }

    try {
      for (const row of usable.filter((item) => item.status === ADVISE_STATUS.Created)) {
        await acceptAdvise.mutateAsync(row.id);
      }
      await openPlan.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        dentistId,
        adviseIds: usable.map((row) => row.id),
        voucherDiscountAmount,
      });
      toast.success(t("Đã tạo kế hoạch điều trị"));
      return true;
    } catch (error) {
      toast.error(extractApiError(error));
      return false;
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
    update,
    updating: updateDiagnosis.isPending,
    removingDiagnosis,
    setRemovingDiagnosis,
    confirmCancelDiagnosis,
    cancellingDiagnosis: cancelDiagnosis.isPending,
    removingAdvise,
    setRemovingAdvise,
    confirmRejectAdvise,
    rejectingAdvise: rejectAdvise.isPending,
    moveAdvise,
    addToPlan,
    addingToPlan: acceptAdvise.isPending || openPlan.isPending,
  };
}
