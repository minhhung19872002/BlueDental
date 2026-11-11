import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { LaboFormFieldRow } from "./LaboFormFieldRow";
import { blankField, moveItem, type FieldDraft } from "./formTemplateModel";

interface Props {
  fields: FieldDraft[];
  /** The template-wide number of the first field here. */
  firstNumber: number;
  /** False once the template holds as many fields as it may. */
  canAdd: boolean;
  onChange: (fields: FieldDraft[]) => void;
}

/**
 * The fields of one section of the template (F-94), numbered across the whole
 * template; the arrows move a field within its section, and a section keeps at
 * least one field — the section itself is removed instead.
 */
export function LaboFormSectionFields({ fields, firstNumber, canAdd, onChange }: Props) {
  const replace = (next: FieldDraft) => onChange(fields.map((f) => (f.rowId === next.rowId ? next : f)));
  const remove = (rowId: string) => onChange(fields.filter((f) => f.rowId !== rowId));

  return (
    <div className="ft-section-fields">
      {fields.map((field, index) => (
        <LaboFormFieldRow
          key={field.rowId}
          field={field}
          index={index}
          count={fields.length}
          number={firstNumber + index}
          onChange={replace}
          onMove={(step) => onChange(moveItem(fields, index, step))}
          onRemove={() => remove(field.rowId)}
        />
      ))}
      <Button
        size="small"
        type="dashed"
        className="ft-add-field"
        icon={<PlusOutlined />}
        disabled={!canAdd}
        onClick={() => onChange([...fields, blankField()])}
      >
        {t("Labo:FormTpl:AddField")}
      </Button>
    </div>
  );
}
