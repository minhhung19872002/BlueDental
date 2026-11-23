import { Button, Checkbox, Tooltip } from "antd";
import { Trash2, X } from "lucide-react";
import { t } from "@/lib/i18n";

interface Props {
  count: number;
  /** Every picture of the column that may be deleted is ticked / some of them are. */
  all: boolean;
  some: boolean;
  onSelectAll: (on: boolean) => void;
  onExit: () => void;
  onDelete: () => void;
}

/**
 * The stage column's head while it is being selected in (R-1277): what is
 * ticked, "Chọn tất cả", and "Xoá N ảnh" — in place of the title and the
 * upload buttons, at the same height so nothing below moves.
 */
export function PatientImageSelectionBar({ count, all, some, onSelectAll, onExit, onDelete }: Props) {
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
        checked={all}
        indeterminate={some}
        onChange={(event) => onSelectAll(event.target.checked)}
      >
        {t("Patient:Image:SelectAll")}
      </Checkbox>
      <Button className="pi-select-delete" danger type="primary" icon={<Trash2 size={14} />} onClick={onDelete}>
        {t("Patient:Image:DeleteMany", count)}
      </Button>
    </header>
  );
}
