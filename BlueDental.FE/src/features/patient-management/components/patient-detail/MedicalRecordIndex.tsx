import type { CSSProperties } from "react";
import { Button } from "antd";
import { FileTextOutlined, MenuFoldOutlined, MenuUnfoldOutlined, PlusOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { PatientMedicalRecordDto } from "../../api/medicalRecordApi";
import { MEDICAL_RECORD_FORMS, type MedicalRecordFormSpec } from "./medicalRecordForms";
import { MedicalRecordSheetCard } from "./MedicalRecordSheetCard";

/**
 * "Mục lục bệnh án" — the left panel of the Bệnh án view.
 *
 * Each of the nine forms is a tinted row carrying its own `+ Thêm`, and every
 * sheet made from that form is nested underneath it as a card. The count in
 * the header counts *sheets*, not forms, which is what the reference shows.
 */

interface Props {
  sheets: PatientMedicalRecordDto[];
  activeId: string | null;
  checkedIds: ReadonlySet<string>;
  collapsed: boolean;
  adding: boolean;
  onToggleCollapse: () => void;
  onAdd: (spec: MedicalRecordFormSpec) => void;
  onSelect: (sheet: PatientMedicalRecordDto) => void;
  onCheck: (sheet: PatientMedicalRecordDto, checked: boolean) => void;
  onPrint: (sheet: PatientMedicalRecordDto) => void;
  onRename: (sheet: PatientMedicalRecordDto) => void;
  onDelete: (sheet: PatientMedicalRecordDto) => void;
}

export function MedicalRecordIndex({
  sheets,
  activeId,
  checkedIds,
  collapsed,
  adding,
  onToggleCollapse,
  onAdd,
  onSelect,
  onCheck,
  onPrint,
  onRename,
  onDelete,
}: Props) {
  return (
    <aside className={["pd-medical-index", collapsed && "pd-medical-index--collapsed"].filter(Boolean).join(" ")}>
      <header className="pd-medical-index-head">
        <span className="pd-medical-index-icon">
          <FileTextOutlined />
        </span>
        <div>
          <strong>{t("Mục lục bệnh án")}</strong>
          <small>{t("{0} biểu mẫu", sheets.length)}</small>
        </div>
        <Button
          type="text"
          className="pd-medical-collapse"
          aria-label={collapsed ? t("Mở mục lục") : t("Thu gọn mục lục")}
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggleCollapse}
        />
      </header>

      <ul className="pd-medical-forms">
        {MEDICAL_RECORD_FORMS.map((spec) => {
          // Sheets keep the order the server lists them in, so the ordinal a
          // card shows is stable: the first one made is always Bản 01.
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
                  {spec.index}. {t(spec.label)}
                </p>
                <Button
                  className="pd-medical-add"
                  icon={<PlusOutlined />}
                  loading={adding}
                  onClick={() => onAdd(spec)}
                >
                  {t("Thêm")}
                </Button>
              </div>

              {own.map((sheet, position) => (
                <MedicalRecordSheetCard
                  key={sheet.id}
                  sheet={sheet}
                  spec={spec}
                  ordinal={position + 1}
                  active={sheet.id === activeId}
                  checked={checkedIds.has(sheet.id)}
                  onSelect={() => onSelect(sheet)}
                  onCheck={(checked) => onCheck(sheet, checked)}
                  onPrint={() => onPrint(sheet)}
                  onRename={() => onRename(sheet)}
                  onDelete={() => onDelete(sheet)}
                />
              ))}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
