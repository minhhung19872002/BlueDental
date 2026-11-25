import { useCallback, useState } from "react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import type { PatientImageFolderViewModel } from "../api/patientImageAdapters";
import { useDeletePatientImageFolder } from "../api/patientImageFolderApi";

export interface PatientImageFolderRemoval {
  /** The thư mục whose "Xoá thư mục?" is open; null while none is. */
  removing: PatientImageFolderViewModel | null;
  ask: (folder: PatientImageFolderViewModel) => void;
  cancel: () => void;
  confirm: () => Promise<void>;
  pending: boolean;
}

/** "Xoá thư mục" (F-98): the thư mục goes, its pictures go back into the column. */
export function usePatientImageFolderRemoval(): PatientImageFolderRemoval {
  const remove = useDeletePatientImageFolder();
  const [removing, setRemoving] = useState<PatientImageFolderViewModel | null>(null);

  const ask = useCallback((folder: PatientImageFolderViewModel) => setRemoving(folder), []);
  const cancel = useCallback(() => setRemoving(null), []);

  const confirm = useCallback(async () => {
    if (!removing) return;
    try {
      await remove.mutateAsync(removing.id);
      toast.success(t("Patient:Image:FolderDeleted", removing.name));
      setRemoving(null);
    } catch (error) {
      toast.error(extractApiError(error) || t("Patient:Image:FolderDeleteError"));
    }
  }, [removing, remove]);

  return { removing, ask, cancel, confirm, pending: remove.isPending };
}
