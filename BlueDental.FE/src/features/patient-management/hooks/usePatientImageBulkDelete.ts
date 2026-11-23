import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { useDeletePatientImages } from "../api/patientImageApi";
import type { PatientImageViewModel } from "../api/patientImageAdapters";
import { usePatientImageSelection } from "./usePatientImageSelection";

/**
 * The Hình ảnh tab's "chọn nhiều để xoá" end to end (R-1277): the selection,
 * the "Xoá N ảnh?" confirm and the one request behind it. Esc leaves the
 * selection; so does anything that changes what the columns show (`resetKey`
 * — the search, the stage filter), since ticks on pictures no longer in view
 * would be deleted unseen.
 */
export function usePatientImageBulkDelete(resetKey: string) {
  const selection = usePatientImageSelection();
  const deleteImages = useDeletePatientImages();
  const [confirming, setConfirming] = useState<PatientImageViewModel[] | null>(null);
  const { clear } = selection;
  const selecting = selection.stage !== null;

  useEffect(() => {
    clear();
    setConfirming(null);
  }, [resetKey, clear]);

  useEffect(() => {
    // The confirm's own Esc closes the confirm and keeps the ticks.
    if (!selecting || confirming) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) clear();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selecting, confirming, clear]);

  const ask = useCallback(() => setConfirming(selection.picked), [selection.picked]);
  const cancel = useCallback(() => setConfirming(null), []);

  const confirm = useCallback(async () => {
    if (!confirming) return;
    try {
      await deleteImages.mutateAsync(confirming.map((image) => image.id));
      toast.success(t("Patient:Image:DeleteManySuccess", confirming.length));
      setConfirming(null);
      clear();
    } catch (error) {
      toast.error(extractApiError(error) || t("Patient:Image:DeleteError"));
    }
  }, [confirming, deleteImages, clear]);

  return { selection, confirming, pending: deleteImages.isPending, ask, cancel, confirm };
}
