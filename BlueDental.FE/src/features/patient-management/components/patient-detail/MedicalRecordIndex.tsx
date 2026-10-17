import type { CSSProperties, ReactNode } from "react";
import { Button } from "antd";
import { FileTextOutlined, PlusOutlined } from "@ant-design/icons";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { t } from "@/lib/i18n";
import type { PatientMedicalRecordDto } from "../../api/medicalRecordApi";
import type { MedicalRecordFormSpec } from "./medicalRecordForms";
import { MedicalRecordSheetCard } from "./MedicalRecordSheetCard";

/**
 * "Mục lục bệnh án" — the left panel of the Bệnh án view.
 *
 * Its head is the bộ hồ sơ being shown (`head`); below it, each form the set
 * shows is a tinted row carrying its own `+ Thêm`, and every sheet made from
 * that form in this set is nested underneath it as a card.
 */

/** What a sheet card can be asked to do; an absent action is not offered. */
export interface SheetCardActions {
  onSelect: (sheet: PatientMedicalRecordDto) => void;
  onPrint: (sheet: PatientMedicalRecordDto) => void;
  onRename?: (sheet: PatientMedicalRecordDto) => void;
  onCancel?: (sheet: PatientMedicalRecordDto) => void;
}

interface Props {
  /** The set picker and its tools, laid out by the caller. */
  head: ReactNode;
  /** The forms the set shows ("Mục hiển thị"), in index order. */
  forms: MedicalRecordFormSpec[];
  /** The set's sheets. */
  sheets: PatientMedicalRecordDto[];
  activeId: string | null;
  collapsed: boolean;
  adding: boolean;
  onToggleCollapse: () => void;
  onAdd?: (spec: MedicalRecordFormSpec) => void;
  actions: SheetCardActions;
}

/** "2 bản · 1 đã hủy" under a form's name; "Chưa có phiếu" when there is none. */
function copiesLine(own: PatientMedicalRecordDto[]): string {
  if (own.length === 0) return t("Patient:MedRecord:NoCopy");
  const cancelled = own.filter((sheet) => sheet.cancelledAt).length;
  return cancelled
    ? t("Patient:MedRecord:CopyCountCancelled", own.length, cancelled)
    : t("Patient:MedRecord:CopyCount", own.length);
}

export function MedicalRecordIndex({
  head,
  forms,
  sheets,
  activeId,
  collapsed,
  adding,
  onToggleCollapse,
  onAdd,
  actions,
}: Props) {
  return (
    <aside className={["pd-medical-index", collapsed && "pd-medical-index--collapsed"].filter(Boolean).join(" ")}>
      {/*
        * Folded on a wide window the panel is the reference's 64px rail: the
        * header keeps only the button that opens it again (PanelLeftOpen). The
        * set picker stays in the DOM for the narrow layout, where folding leaves
        * the header row and only the list goes — see patient-detail.css.
        */}
      <header className="pd-medical-index-head">
        <div className="pd-medical-index-title">{head}</div>
        <Button
          type="text"
          className="pd-medical-collapse"
          aria-label={
            collapsed ? t("Patient:MedicalRecord:ExpandIndexAria") : t("Patient:MedicalRecord:CollapseIndexAria")
          }
          aria-expanded={!collapsed}
          aria-controls="pd-medical-forms"
          title={collapsed ? t("Patient:MedicalRecord:Expand") : t("Patient:MedRecord:CollapseIndex")}
          icon={collapsed ? <PanelLeftOpenIcon size={16} strokeWidth={1.75} /> : <PanelLeftCloseIcon size={16} strokeWidth={1.75} />}
          onClick={onToggleCollapse}
        />
      </header>

      <ul id="pd-medical-forms" className="pd-medical-forms">
        {forms.map((spec) => {
          // Sheets keep the order the server lists them in, so the ordinal a
          // card shows is stable: the first one made is always Bản 01, and a
          // cancelled copy keeps its number.
          const own = sheets.filter((sheet) => sheet.form === spec.form);

          return (
            <li
              key={spec.form}
              className="pd-medical-form"
              style={
                {
                  "--form-tint": spec.tint,
                  "--form-accent": spec.accent,
                  "--form-icon-bg": spec.iconBg,
                } as CSSProperties
              }
            >
              <div className="pd-medical-form-head">
                <span className="pd-medical-form-icon">
                  <FileTextOutlined />
                </span>
                <p>
                  <span>
                    {spec.index}. {spec.label}
                  </span>
                  <small className="pd-medical-form-count">{copiesLine(own)}</small>
                </p>
                {onAdd && (
                  <Button
                    className="pd-medical-add"
                    icon={<PlusOutlined />}
                    loading={adding}
                    onClick={() => onAdd(spec)}
                  >
                    {t("Patient:Misc:Add")}
                  </Button>
                )}
              </div>

              {own.map((sheet, position) => (
                <MedicalRecordSheetCard
                  key={sheet.id}
                  sheet={sheet}
                  spec={spec}
                  ordinal={position + 1}
                  active={sheet.id === activeId}
                  actions={actions}
                />
              ))}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
