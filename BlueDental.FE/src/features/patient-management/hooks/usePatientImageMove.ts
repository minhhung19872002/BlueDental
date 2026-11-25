import { useCallback } from "react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { useMovePatientImages } from "../api/patientImageApi";
import type { PatientImageFolderViewModel } from "../api/patientImageAdapters";
import type { PatientImageSelection } from "./usePatientImageSelection";

export interface PatientImageMove {
  /** Files the ticked pictures into `folder`, or back into the column with null. */
  move: (folder: PatientImageFolderViewModel | null) => Promise<void>;
  moving: boolean;
}

/**
 * The selection bar's "Chuyển vào thư mục" (F-98): every ticked picture in one
 * request, all or none; the ticks are dropped once they have moved out of view.
 */
export function usePatientImageMove(selection: Pick<PatientImageSelection, "picked" | "clear">): PatientImageMove {
  const mutation = useMovePatientImages();
  const { picked, clear } = selection;

  const move = useCallback(
    async (folder: PatientImageFolderViewModel | null) => {
      if (picked.length === 0) return;
      try {
        await mutation.mutateAsync({ ids: picked.map((image) => image.id), folderId: folder?.id ?? null });
        toast.success(
          folder
            ? t("Patient:Image:Moved", picked.length, folder.name)
            : t("Patient:Image:MovedOut", picked.length),
        );
        clear();
      } catch (error) {
        toast.error(extractApiError(error) || t("Patient:Image:MoveError"));
      }
    },
    [picked, clear, mutation],
  );

  return { move, moving: mutation.isPending };
}
