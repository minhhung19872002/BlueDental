import type { ReactNode } from "react";
import { Button, Checkbox, Tooltip } from "antd";
import { Download, Trash2, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { PatientImageSelectionMove } from "./PatientImageSelectionMove";

interface Props {
  count: number;
  /** Every picture of the column that may be ticked is ticked / some of them are. */
  all: boolean;
  some: boolean;
  onSelectAll: (on: boolean) => void;
  onExit: () => void;
  /** What may be done with the ticked pictures: "Chuyển vào thư mục", "Tải xuống", "Xoá N ảnh". */
  children: ReactNode;
}

/**
 * The stage column's head while it is being selected in (R-1277): what is
 * ticked, "Chọn tất cả", and what to do with them — in place of the title and
 * the upload buttons, at the same height so nothing below moves.
 */
export function PatientImageSelectionBar({ count, all, some, onSelectAll, onExit, children }: Props) {
  return (
    <header className="pi-stage-head pi-stage-head--selecting" data-testid="patient-image-selection-bar">
      <Tooltip title={t("Patient:Image:SelectExit")}>
        <button type="button" className="pi-select-exit" aria-label={t("Patient:Image:SelectExit")} onClick={onExit}>
          <X size={16} />
        </button>
      </Tooltip>
      <span className="pi-select-count" aria-live="polite">
        {t("Patient:Image:PickedCount", count)}
      </span>
      <Checkbox
        className="pi-select-all"
        title={t("Patient:Image:SelectAll")}
        checked={all}
        indeterminate={some}
        onChange={(event) => onSelectAll(event.target.checked)}
      >
        {/* Only the box shows in a narrow column; the name stays for screen readers. */}
        <span className="pi-select-all-label">{t("Patient:Image:SelectAll")}</span>
      </Checkbox>
      {children}
    </header>
  );
}

interface DownloadProps {
  count: number;
  downloading: boolean;
  onDownload: () => void;
}

/** One picture is saved as itself; two or more as one .zip. */
function SelectionDownload({ count, downloading, onDownload }: DownloadProps) {
  const label = t("Patient:Image:DownloadMany", count);
  return (
    <Tooltip title={label}>
      <Button
        className="pi-select-download"
        aria-label={label}
        icon={<Download size={15} />}
        loading={downloading}
        disabled={downloading}
        onClick={onDownload}
      />
    </Tooltip>
  );
}

interface DeleteProps {
  count: number;
  onDelete: () => void;
}

function SelectionDelete({ count, onDelete }: DeleteProps) {
  return (
    <Button className="pi-select-delete" danger type="primary" icon={<Trash2 size={14} />} onClick={onDelete}>
      {t("Patient:Image:DeleteMany", count)}
    </Button>
  );
}

PatientImageSelectionBar.Download = SelectionDownload;
PatientImageSelectionBar.Delete = SelectionDelete;
PatientImageSelectionBar.Move = PatientImageSelectionMove;
