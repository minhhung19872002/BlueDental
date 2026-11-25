import { Tooltip } from "antd";
import { FolderPlus } from "lucide-react";
import { t } from "@/lib/i18n";

interface Props {
  onClick: () => void;
}

/** "Thư mục mới" beside the stage's "Chụp ảnh" (F-98), as square as it. */
export function PatientImageNewFolderButton({ onClick }: Props) {
  return (
    <Tooltip title={t("Patient:Image:FolderNew")}>
      <button
        type="button"
        className="pi-stage-capture pi-stage-new-folder"
        aria-label={t("Patient:Image:FolderNew")}
        onClick={onClick}
      >
        <FolderPlus size={17} />
      </button>
    </Tooltip>
  );
}
