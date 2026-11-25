import { useCallback, useEffect, useState } from "react";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import type { PatientImageType } from "../api/patientImageApi";
import type { PatientImageFolderViewModel } from "../api/patientImageAdapters";
import { usePatientImageFolders } from "../api/patientImageFolderApi";
import type { PatientImageSelection } from "./usePatientImageSelection";

const NO_FOLDERS: PatientImageFolderViewModel[] = [];

export interface PatientImageFolderBrowser {
  /** The column's thư mục, by name. */
  folders: PatientImageFolderViewModel[];
  /** The thư mục the column is showing; null at the column's root. */
  openFolder: PatientImageFolderViewModel | null;
  open: (folder: PatientImageFolderViewModel) => void;
  /** Back to the column's root. */
  close: () => void;
}

/**
 * Which thư mục a Hình ảnh column is showing (F-98), one level deep. Going in
 * or out drops the column's ticks — they were on pictures no longer in view —
 * and a thư mục deleted while open sends the column back to its root.
 */
export function usePatientImageFolderBrowser(
  patientId: string,
  type: PatientImageType,
  selection: Pick<PatientImageSelection, "stage" | "clear">,
): PatientImageFolderBrowser {
  const query = usePatientImageFolders(patientId, useCurrentBranchId(), type);
  const folders = query.data ?? NO_FOLDERS;
  const [openId, setOpenId] = useState<string | null>(null);
  const openFolder = folders.find((folder) => folder.id === openId) ?? null;

  const { stage, clear } = selection;
  const go = useCallback(
    (id: string | null) => {
      if (stage === type) clear();
      setOpenId(id);
    },
    [stage, type, clear],
  );
  const open = useCallback((folder: PatientImageFolderViewModel) => go(folder.id), [go]);
  const close = useCallback(() => go(null), [go]);

  const gone = query.isSuccess && openId !== null && openFolder === null;
  useEffect(() => {
    if (gone) close();
  }, [gone, close]);

  return { folders, openFolder, open, close };
}
