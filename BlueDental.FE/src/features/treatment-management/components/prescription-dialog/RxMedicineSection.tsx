import { Button, Form, Select } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import {
  appendEmptyLine,
  PrescriptionLineList,
  type PrescriptionLine,
} from "@/components/prescription-lines";
import type { CatalogOption } from "@/hooks/useCatalogOptions";
import { t } from "@/lib/i18n";

interface Props {
  lines: PrescriptionLine[];
  medicines: CatalogOption[];
  templates: CatalogOption[];
  onChange: (next: PrescriptionLine[]) => void;
  onPickTemplate: (templateId: string | undefined) => void;
  onAddMedicineType: () => void;
}

/**
 * "Danh sách thuốc (n)" — the template picker and the add buttons above the
 * lines, then the line table the Đơn thuốc mẫu catalog shares (F-58, R-884).
 */
export function RxMedicineSection({
  lines,
  medicines,
  templates,
  onChange,
  onPickTemplate,
  onAddMedicineType,
}: Props) {
  const filled = lines.filter((line) => line.medicineEntryId).length;
  const handleAdd = () => onChange(appendEmptyLine(lines));

  return (
    <section className="rx-section rx-meds" aria-label={t("Treatment:Rx:Medicines", filled)}>
      <div className="rx-meds-toolbar">
        <h3 className="rx-section-title">{t("Treatment:Rx:Medicines", filled)}</h3>
        <div className="rx-meds-actions">
          <Form.Item name="templateId" noStyle>
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              className="rx-template-select"
              placeholder={t("Treatment:Prescription:SelectTemplate")}
              aria-label={t("Treatment:Prescription:SelectTemplate")}
              prefix={<SearchOutlined />}
              notFoundContent={t("Treatment:Common:NotFound")}
              options={templates.map((template) => ({ value: template.id, label: template.name }))}
              onChange={onPickTemplate}
            />
          </Form.Item>
          <Button icon={<PlusOutlined />} className="rx-soft-btn" onClick={onAddMedicineType}>
            {t("Treatment:Prescription:AddMedicine")}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            {t("Treatment:Rx:AddOtherMedicine")}
          </Button>
        </div>
      </div>

      <PrescriptionLineList lines={lines} medicines={medicines} onChange={onChange} />
    </section>
  );
}
