import type { CSSProperties } from "react";
import { Checkbox, Tooltip } from "antd";
import { DeleteOutlined, EditOutlined, FileTextOutlined, PrinterOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { PatientMedicalRecordDto } from "../../api/medicalRecordApi";
import type { MedicalRecordFormSpec } from "./medicalRecordForms";

/**
 * One created sheet, sitting inside its form's row in "Mục lục bệnh án".
 *
 * The reference nests a card per sheet under the form it came from, rather
 * than listing sheets somewhere separate: icon chip, title over a `Bản NN`
 * badge and the creation time, a checkbox, and print / rename / delete.
 * Measured off its computed styles — see docs/clone/pages/patient-detail.md.
 */

interface Props {
  sheet: PatientMedicalRecordDto;
  spec: MedicalRecordFormSpec;
  /** Position among the sheets of this same form: 1 renders as `Bản 01`. */
  ordinal: number;
  active: boolean;
  checked: boolean;
  onSelect: () => void;
  onCheck: (checked: boolean) => void;
  onPrint: () => void;
  onRename: () => void;
  onDelete: () => void;
}

/** `Bản 01` — the reference pads the ordinal to two digits. */
function copyLabel(ordinal: number): string {
  return `${t("Bản")} ${String(ordinal).padStart(2, "0")}`;
}

function createdAt(iso: string | null): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(at.getDate())}/${pad(at.getMonth() + 1)}/${at.getFullYear()} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

export function MedicalRecordSheetCard({
  sheet,
  spec,
  ordinal,
  active,
  checked,
  onSelect,
  onCheck,
  onPrint,
  onRename,
  onDelete,
}: Props) {
  const created = createdAt(sheet.creationTime);

  return (
    <div
      className={["pd-sheet-card", active && "pd-sheet-card--active"].filter(Boolean).join(" ")}
      style={{ "--form-accent": spec.accent, "--form-icon-bg": spec.iconBg } as CSSProperties}
    >
      <button type="button" className="pd-sheet-open" aria-pressed={active} onClick={onSelect}>
        <span className="pd-sheet-icon">
          <FileTextOutlined />
        </span>
        <span className="pd-sheet-text">
          <span className="pd-sheet-title">{sheet.title}</span>
          <span className="pd-sheet-meta">
            <em className="pd-sheet-copy">{copyLabel(ordinal)}</em>
            {created && <span>{t("Tạo")}: {created}</span>}
          </span>
        </span>
      </button>

      <Checkbox
        className="pd-sheet-check"
        checked={checked}
        onChange={(event) => onCheck(event.target.checked)}
        aria-label={t("Chọn {0} để in", sheet.title)}
      />

      <div className="pd-sheet-actions">
        <Tooltip title={t("In phiếu")}>
          <button type="button" aria-label={t("In phiếu")} onClick={onPrint}>
            <PrinterOutlined />
          </button>
        </Tooltip>
        <Tooltip title={t("Đổi tên phiếu")}>
          <button type="button" aria-label={t("Đổi tên phiếu")} onClick={onRename}>
            <EditOutlined />
          </button>
        </Tooltip>
        <Tooltip title={t("Xoá phiếu")}>
          <button type="button" aria-label={t("Xoá phiếu")} onClick={onDelete}>
            <DeleteOutlined />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
