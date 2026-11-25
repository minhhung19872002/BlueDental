import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import type { PatientImageFolderViewModel } from "../../../api/patientImageAdapters";
import { PatientImageFolderHeader } from "./PatientImageFolderHeader";
import { PatientImageNewFolderButton } from "./PatientImageNewFolderButton";
import { PatientImageStageHeader } from "./PatientImageStageHeader";
import type { PatientImageStage } from "./patientImageStages";

interface Props {
  stage: PatientImageStage;
  /** The thư mục the column is showing; null at its root. */
  folder: PatientImageFolderViewModel | null;
  summary: string;
  onBack: () => void;
  /** "Thư mục mới"; left out where the user may not make one, and inside a thư mục (one level only). */
  onNewFolder?: () => void;
  /** "Tải ảnh" and "Chụp ảnh", filing into whatever the column shows. */
  children?: ReactNode;
}

/** The column's head while nothing is ticked: the stage's own, or the open thư mục's (F-98). */
export function PatientImageColumnTitle({ stage, folder, summary, onBack, onNewFolder, children }: Props) {
  const title = t(stage.labelKey);
  if (folder) {
    return (
      <PatientImageFolderHeader stageTitle={title} name={folder.name} summary={summary} onBack={onBack}>
        {children}
      </PatientImageFolderHeader>
    );
  }

  return (
    <PatientImageStageHeader step={stage.step} title={title} summary={summary}>
      {children}
      {onNewFolder && <PatientImageNewFolderButton onClick={onNewFolder} />}
    </PatientImageStageHeader>
  );
}
