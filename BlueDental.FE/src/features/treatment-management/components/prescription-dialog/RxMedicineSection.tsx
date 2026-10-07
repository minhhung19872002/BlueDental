import { Button, Form, Select } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import type { CatalogOption } from "@/hooks/useCatalogOptions";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { t } from "@/lib/i18n";
import type { RxMedicineLine } from "../../types/prescription";
import { EMPTY_RX_LINE } from "../../utils/rxDose";
import { RxMedicineCard } from "./RxMedicineCard";
import { RxMedicineTable } from "./RxMedicineTable";

/** Below this the table gives way to one card per line; matches prescription.css. */
const NARROW_SCREEN = "(max-width: 640px)";

interface Props {
  lines: RxMedicineLine[];
  medicines: CatalogOption[];
  templates: CatalogOption[];
  onChange: (next: RxMedicineLine[]) => void;
  onPickTemplate: (templateId: string | undefined) => void;
  onAddMedicineType: () => void;
}

/**
 * "Danh sách thuốc (n)" — the template picker and the add buttons above the
 * lines; a table on a wide screen, one card per line on a narrow one (F-58).
 */
export function RxMedicineSection({
  lines,
  medicines,
  templates,
  onChange,
  onPickTemplate,
  onAddMedicineType,
}: Props) {
  const narrow = useMediaQuery(NARROW_SCREEN);
  const filled = lines.filter((line) => line.medicineEntryId).length;

  // Rows are patched by identity: two new lines are otherwise indistinguishable.
  const patch = (target: RxMedicineLine, change: Partial<RxMedicineLine>) =>
    onChange(lines.map((line) => (line === target ? { ...line, ...change } : line)));
  const remove = (target: RxMedicineLine) => onChange(lines.filter((line) => line !== target));
  const add = () => onChange([...lines, { ...EMPTY_RX_LINE }]);

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
          <Button type="primary" icon={<PlusOutlined />} onClick={add}>
            {t("Treatment:Rx:AddOtherMedicine")}
          </Button>
        </div>
      </div>

      {narrow ? (
        <div className="rx-med-cards">
          {lines.map((line, index) => (
            <RxMedicineCard
              key={line.id ?? `new-${index}`}
              line={line}
              index={index}
              medicines={medicines}
              canDelete={lines.length > 1}
              onPatch={(change) => patch(line, change)}
              onDelete={() => remove(line)}
            />
          ))}
        </div>
      ) : (
        <RxMedicineTable lines={lines} medicines={medicines} onPatch={patch} onRemove={remove} />
      )}
    </section>
  );
}
