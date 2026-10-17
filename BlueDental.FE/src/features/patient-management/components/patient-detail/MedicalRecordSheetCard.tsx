import type { CSSProperties } from "react";
import { Tooltip } from "antd";
import { DeleteOutlined, EditOutlined, FileTextOutlined, PrinterOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { PatientMedicalRecordDto } from "../../api/medicalRecordApi";
import type { SheetCardActions } from "./MedicalRecordIndex";
import type { MedicalRecordFormSpec } from "./medicalRecordForms";

/**
 * One created sheet, sitting inside its form's row in "Mục lục bệnh án".
 *
 * The reference nests a card per sheet under the form it came from, rather
 * than listing sheets somewhere separate: icon chip, title over a `Bản NN`
 * badge and the creation time, and print / rename / remove. Measured off its
 * computed styles — see docs/clone/pages/patient-detail.md.
 *
 * The clinic's own changes (save/P1710.drawio): the stamp tick is gone, and
 * the trash cancels the sheet rather than deleting it. A cancelled copy keeps
 * its number, struck through, reads "Đã hủy" with when, and can only be
 * opened and printed.
 */

interface Props {
  sheet: PatientMedicalRecordDto;
  spec: MedicalRecordFormSpec;
  /** Position among the sheets of this same form: 1 renders as `Bản 01`. */
  ordinal: number;
  active: boolean;
  actions: SheetCardActions;
}

/** `Bản 01` — the reference pads the ordinal to two digits. */
export function copyLabel(ordinal: number): string {
  return `${t("Patient:Misc:SlipCopy")} ${String(ordinal).padStart(2, "0")}`;
}

export function sheetTime(iso: string | null): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(at.getDate())}/${pad(at.getMonth() + 1)}/${at.getFullYear()} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

export function MedicalRecordSheetCard({ sheet, spec, ordinal, active, actions }: Props) {
  const cancelled = Boolean(sheet.cancelledAt);
  const created = sheetTime(sheet.creationTime);
  const cancelledAt = sheetTime(sheet.cancelledAt);

  const meta = cancelled ? (
    <Tooltip title={t("Patient:MedRecord:CancelledBy", sheet.cancellerName ?? "—", cancelledAt, sheet.cancelReason ?? "")}>
      <span>{t("Patient:MedRecord:CancelledAt", cancelledAt)}</span>
    </Tooltip>
  ) : (
    created && (
      <span>
        {t("Patient:Misc:Create")}: {created}
      </span>
    )
  );

  return (
    <div
      className={["pd-sheet-card", active && "pd-sheet-card--active", cancelled && "pd-sheet-card--cancelled"]
        .filter(Boolean)
        .join(" ")}
      style={{ "--form-accent": spec.accent, "--form-icon-bg": spec.iconBg } as CSSProperties}
    >
      <button type="button" className="pd-sheet-open" aria-pressed={active} onClick={() => actions.onSelect(sheet)}>
        <span className="pd-sheet-icon">
          <FileTextOutlined />
        </span>
        <span className="pd-sheet-text">
          <span className="pd-sheet-title">{sheet.title}</span>
          <span className="pd-sheet-meta">
            <em className="pd-sheet-copy">{copyLabel(ordinal)}</em>
            {cancelled && <span className="pd-sheet-status">{t("Patient:MedRecord:StatusCancelled")}</span>}
            {meta}
          </span>
        </span>
      </button>

      <div className="pd-sheet-actions">
        <Tooltip title={t("Patient:MedRecord:QuickPrint")}>
          <button
            type="button"
            aria-label={t("Patient:MedRecord:QuickPrintLabel", sheet.title)}
            onClick={() => actions.onPrint(sheet)}
          >
            <PrinterOutlined />
          </button>
        </Tooltip>
        {!cancelled && actions.onRename && (
          <Tooltip title={t("Patient:MedRecord:RenameShort")}>
            <button
              type="button"
              aria-label={t("Patient:MedicalRecord:RenameLabel", sheet.title)}
              onClick={() => actions.onRename?.(sheet)}
            >
              <EditOutlined />
            </button>
          </Tooltip>
        )}
        {!cancelled && actions.onCancel && (
          <Tooltip title={t("Patient:MedRecord:CancelTitle")}>
            <button
              type="button"
              aria-label={t("Patient:MedRecord:CancelLabel", sheet.title)}
              onClick={() => actions.onCancel?.(sheet)}
            >
              <DeleteOutlined />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
