import type { ReactNode } from "react";
import { Tooltip } from "antd";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { t } from "@/lib/i18n";

interface Props {
  /** The stage the thư mục belongs to: "Trước điều trị". */
  stageTitle: string;
  name: string;
  /** "Trước điều trị · 5 ảnh" under the name. */
  summary: string;
  onBack: () => void;
  /** "Tải ảnh" and "Chụp ảnh" into this thư mục, for whoever may upload. */
  children?: ReactNode;
}

/**
 * The column's head while a thư mục is open (F-98): back to the stage, the
 * thư mục's name, and the stage's upload buttons, filing into it — the same
 * box as the stage's own head, so the pictures below do not move.
 */
export function PatientImageFolderHeader({ stageTitle, name, summary, onBack, children }: Props) {
  const back = t("Patient:Image:FolderBack", stageTitle);
  return (
    <header className="pi-stage-head pi-folder-head" data-testid="patient-image-folder-head">
      <Tooltip title={back}>
        <button type="button" className="pi-select-exit" aria-label={back} onClick={onBack}>
          <ArrowLeft size={16} />
        </button>
      </Tooltip>
      <FolderOpen className="pi-folder-head-icon" size={22} aria-hidden="true" />
      <span className="pi-stage-heading">
        <h3 className="pi-stage-title pi-folder-head-name" title={name}>
          {name}
        </h3>
        <span className="pi-stage-summary">{summary}</span>
      </span>
      {children}
    </header>
  );
}
