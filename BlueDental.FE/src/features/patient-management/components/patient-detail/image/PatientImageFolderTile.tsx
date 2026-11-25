import { memo } from "react";
import { Dropdown, type MenuProps } from "antd";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n";
import type { PatientImageFolderViewModel } from "../../../api/patientImageAdapters";
import { PatientImageFolderIcon } from "./PatientImageFolderIcon";

interface Props {
  folder: PatientImageFolderViewModel;
  canRename: boolean;
  canDelete: boolean;
  onOpen: (folder: PatientImageFolderViewModel) => void;
  onRename: (folder: PatientImageFolderViewModel) => void;
  onDelete: (folder: PatientImageFolderViewModel) => void;
}

/** A thư mục of the column (F-98): click or Enter opens it; "⋯" renames or deletes it. */
export const PatientImageFolderTile = memo(function PatientImageFolderTile({
  folder,
  canRename,
  canDelete,
  onOpen,
  onRename,
  onDelete,
}: Props) {
  const items: MenuProps["items"] = [
    ...(canRename ? [{ key: "rename", icon: <Pencil size={14} />, label: t("Patient:Image:FolderRename") }] : []),
    ...(canDelete
      ? [{ key: "delete", icon: <Trash2 size={14} />, label: t("Patient:Image:FolderDelete"), danger: true }]
      : []),
  ];
  const handleMenu: MenuProps["onClick"] = ({ key }) => (key === "rename" ? onRename(folder) : onDelete(folder));

  return (
    <div className="pi-folder" data-testid="patient-image-folder" data-folder-name={folder.name}>
      <button
        type="button"
        className="pi-folder-open"
        aria-label={t("Patient:Image:FolderOpen", folder.name)}
        onClick={() => onOpen(folder)}
      >
        <PatientImageFolderIcon coverUrl={folder.coverUrl} />
        <span className="pi-folder-name" title={folder.name}>
          {folder.name}
        </span>
        <span className="pi-folder-count">
          {folder.imageCount > 0 ? t("Patient:Image:DayCount", folder.imageCount) : t("Patient:Image:FolderEmpty")}
        </span>
      </button>
      {items.length > 0 && (
        <Dropdown trigger={["click"]} placement="bottomRight" menu={{ items, onClick: handleMenu }}>
          <button type="button" className="pi-folder-more" aria-label={t("Patient:Image:FolderMenu", folder.name)}>
            <MoreHorizontal size={16} />
          </button>
        </Dropdown>
      )}
    </div>
  );
});
