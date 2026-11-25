import { t } from "@/lib/i18n";
import type { PatientImageFolderViewModel } from "../../../api/patientImageAdapters";
import { PatientImageFolderTile } from "./PatientImageFolderTile";

interface Props {
  folders: PatientImageFolderViewModel[];
  canRename: boolean;
  canDelete: boolean;
  onOpen: (folder: PatientImageFolderViewModel) => void;
  onRename: (folder: PatientImageFolderViewModel) => void;
  onDelete: (folder: PatientImageFolderViewModel) => void;
}

/** The column's thư mục, above the pictures that lie in no thư mục (F-98). */
export function PatientImageFolderGrid({ folders, ...tileProps }: Props) {
  if (folders.length === 0) return null;

  return (
    <ul className="pi-folders" aria-label={t("Patient:Image:Folders")} data-testid="patient-image-folders">
      {folders.map((folder) => (
        <li key={folder.id} className="pi-folders-item">
          <PatientImageFolderTile folder={folder} {...tileProps} />
        </li>
      ))}
    </ul>
  );
}
