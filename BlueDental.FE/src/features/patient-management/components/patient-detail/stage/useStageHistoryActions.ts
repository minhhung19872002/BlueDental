import { useState } from "react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { t } from "@/lib/i18n";
import {
  useCompleteStage,
  useRevertStage,
  useUpdateStage,
  type TreatmentStageDto,
} from "@/features/treatment-management/api/stageApi";

/**
 * What a LỊCH SỬ ĐIỀU TRỊ row can do to its own công đoạn: tick or untick
 * Hoàn thành, rewrite its note. One công đoạn at a time is
 * busy, which is what the row reads to disable itself mid-request.
 */
export function useStageHistoryActions() {
  const completeStage = useCompleteStage();
  const revertStage = useRevertStage();
  const updateStage = useUpdateStage();
  const [busyStage, setBusyStage] = useState<string | null>(null);

  const run = async (stageId: string, action: () => Promise<void>, fallback?: string) => {
    setBusyStage(stageId);
    try {
      await action();
    } catch (error) {
      notifyError(extractApiError(error) || fallback || "");
    } finally {
      setBusyStage(null);
    }
  };

  /**
   * Ticks or un-ticks Hoàn thành. The reference's box turns both ways — it has a
   * `revert-status` beside its `status` — so un-ticking re-opens the công đoạn.
   * Ticking a warranty's closes it, which is what takes it off "TIẾP TỤC BẢO
   * HÀNH" and frees the line's Bảo hành buttons again.
   */
  const finish = (stage: TreatmentStageDto) =>
    run(stage.id, async () => {
      if (stage.completedAt !== null) {
        await revertStage.mutateAsync(stage.id);
        toast.success(t("Patient:Stage:Reopened"));
      } else {
        await completeStage.mutateAsync(stage.id);
        toast.success(t("Patient:Stage:Completed"));
      }
    });

  const saveNote = (stage: TreatmentStageDto, next: string) =>
    run(stage.id, async () => {
      await updateStage.mutateAsync({
        id: stage.id,
        name: stage.name,
        note: next.trim() || undefined,
        staffId: stage.staffId,
        secondStaffId: stage.secondStaffId ?? undefined,
        subStaffId: stage.subStaffId ?? undefined,
        scheduledDate: stage.scheduledDate ?? undefined,
        teeth: stage.teeth,
      });
      toast.success(t("Patient:Misc:NoteSaved"));
    });

  return {
    finish,
    saveNote,
    completingId: completeStage.isPending || revertStage.isPending ? busyStage : null,
    savingNoteFor: updateStage.isPending ? busyStage : null,
  };
}
