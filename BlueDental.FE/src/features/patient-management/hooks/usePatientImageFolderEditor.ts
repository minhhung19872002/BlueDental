import { useCallback, useState } from "react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import type { PatientImageType } from "../api/patientImageApi";
import type { PatientImageFolderViewModel } from "../api/patientImageAdapters";
import { useCreatePatientImageFolder, useRenamePatientImageFolder } from "../api/patientImageFolderApi";

export type PatientImageFolderEditing =
  | { mode: "create" }
  | { mode: "rename"; folder: PatientImageFolderViewModel };

export interface PatientImageFolderEditor {
  /** The "Thư mục mới" / "Đổi tên thư mục" dialog's subject; null while it is closed. */
  editing: PatientImageFolderEditing | null;
  startCreate: () => void;
  startRename: (folder: PatientImageFolderViewModel) => void;
  close: () => void;
  /** Resolves once the server has answered; the dialog closes only when it took the name. */
  save: (name: string) => Promise<void>;
  saving: boolean;
}

/**
 * "Thư mục mới" and "Đổi tên" of a Hình ảnh column (F-98). A name already
 * used by another thư mục of the column is refused by the server, and its
 * message is shown as it comes.
 */
export function usePatientImageFolderEditor(
  patientId: string,
  clinicBranchId: string,
  type: PatientImageType,
): PatientImageFolderEditor {
  const create = useCreatePatientImageFolder();
  const rename = useRenamePatientImageFolder();
  const [editing, setEditing] = useState<PatientImageFolderEditing | null>(null);

  const startCreate = useCallback(() => setEditing({ mode: "create" }), []);
  const startRename = useCallback(
    (folder: PatientImageFolderViewModel) => setEditing({ mode: "rename", folder }),
    [],
  );
  const close = useCallback(() => setEditing(null), []);

  const save = useCallback(
    async (name: string) => {
      if (!editing) return;
      try {
        if (editing.mode === "create") {
          const created = await create.mutateAsync({ patientId, clinicBranchId, type, name });
          toast.success(t("Patient:Image:FolderCreated", created.name));
        } else {
          const renamed = await rename.mutateAsync({ id: editing.folder.id, name });
          toast.success(t("Patient:Image:FolderRenamed", renamed.name));
        }
        setEditing(null);
      } catch (error) {
        toast.error(extractApiError(error) || t("Patient:Image:FolderSaveError"));
      }
    },
    [editing, create, rename, patientId, clinicBranchId, type],
  );

  return { editing, startCreate, startRename, close, save, saving: create.isPending || rename.isPending };
}
