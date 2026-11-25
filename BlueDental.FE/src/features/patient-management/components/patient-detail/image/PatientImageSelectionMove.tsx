import { Button, Dropdown, Tooltip, type MenuProps } from "antd";
import { Folder, FolderInput, FolderOutput } from "lucide-react";
import { t } from "@/lib/i18n";
import type { PatientImageFolderViewModel } from "../../../api/patientImageAdapters";

interface Props {
  /** The column's thư mục. */
  folders: PatientImageFolderViewModel[];
  /** The thư mục the column is showing; null at its root. */
  currentFolderId: string | null;
  moving: boolean;
  onMove: (folder: PatientImageFolderViewModel | null) => void;
}

const OUT = "__out__";

/**
 * "Chuyển vào thư mục" (F-98): files the ticked pictures into another thư mục
 * of the column, or — inside one — back out into the column.
 */
export function PatientImageSelectionMove({ folders, currentFolderId, moving, onMove }: Props) {
  const targets = folders.filter((folder) => folder.id !== currentFolderId);
  const items: MenuProps["items"] = [
    ...(currentFolderId
      ? [{ key: OUT, icon: <FolderOutput size={14} />, label: t("Patient:Image:MoveOut") }]
      : []),
    ...targets.map((folder) => ({ key: folder.id, icon: <Folder size={14} />, label: folder.name })),
  ];
  if (items.length === 0) {
    items.push({ key: "none", label: t("Patient:Image:MoveNoFolder"), disabled: true });
  }

  const handleClick: MenuProps["onClick"] = ({ key }) => {
    if (key === OUT) return onMove(null);
    const target = targets.find((folder) => folder.id === key);
    if (target) onMove(target);
  };

  const label = t("Patient:Image:MoveTo");
  return (
    <Dropdown trigger={["click"]} placement="bottomRight" disabled={moving} menu={{ items, onClick: handleClick }}>
      <Tooltip title={label}>
        <Button
          className="pi-select-download pi-select-move"
          aria-label={label}
          icon={<FolderInput size={15} />}
          loading={moving}
          disabled={moving}
        />
      </Tooltip>
    </Dropdown>
  );
}
