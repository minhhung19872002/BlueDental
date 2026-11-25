import type { PatientImageFolderViewModel } from "../../../api/patientImageAdapters";
import type { PatientImageType } from "../../../api/patientImageApi";
import { usePatientImageDownload } from "../../../hooks/usePatientImageDownload";
import { usePatientImageMove } from "../../../hooks/usePatientImageMove";
import type { PatientImageSelection } from "../../../hooks/usePatientImageSelection";
import { PatientImageSelectionBar } from "./PatientImageSelectionBar";
import type { tickStateOf } from "./columnSelection";

interface Props {
  stageType: PatientImageType;
  selection: PatientImageSelection;
  /** How the column's tickable pictures stand: all / some ticked, and which they are. */
  tick: ReturnType<typeof tickStateOf>;
  folders: PatientImageFolderViewModel[];
  /** The thư mục the column is showing; null at its root. */
  currentFolderId: string | null;
  /** "Chuyển vào thư mục" is offered (it is an edit: treatmentImage.update). */
  canMove: boolean;
  onDeleteMany: () => void;
}

/** The column's head while pictures are ticked in it: move, download, delete them (R-1277, F-98). */
export function PatientImageColumnSelectionHead({
  stageType,
  selection,
  tick,
  folders,
  currentFolderId,
  canMove,
  onDeleteMany,
}: Props) {
  const { download, downloading } = usePatientImageDownload();
  const { move, moving } = usePatientImageMove(selection);
  const count = selection.picked.length;

  return (
    <PatientImageSelectionBar
      count={count}
      all={tick.all}
      some={tick.some}
      onSelectAll={(on) => selection.setMany(stageType, tick.selectable, on)}
      onExit={selection.clear}
    >
      {canMove && (
        <PatientImageSelectionBar.Move
          folders={folders}
          currentFolderId={currentFolderId}
          moving={moving}
          onMove={(folder) => void move(folder)}
        />
      )}
      <PatientImageSelectionBar.Download
        count={count}
        downloading={downloading}
        onDownload={() => void download(selection.picked)}
      />
      <PatientImageSelectionBar.Delete count={count} onDelete={onDeleteMany} />
    </PatientImageSelectionBar>
  );
}
