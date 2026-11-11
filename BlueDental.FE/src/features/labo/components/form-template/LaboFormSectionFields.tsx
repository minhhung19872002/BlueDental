import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { t } from "@/lib/i18n";
import { LaboFormFieldRow } from "./LaboFormFieldRow";
import { SortableShell } from "./SortableShell";
import { blankField, moveItem, type FieldDraft } from "./formTemplateModel";
import { sectionDropId } from "./layoutDnd";
import { useTakesDrag } from "./useLayoutDnd";

interface Props {
  blockRowId: string;
  fields: FieldDraft[];
  /** The template-wide number of the first field here. */
  firstNumber: number;
  /** False once the template holds as many fields as it may. */
  canAdd: boolean;
  onChange: (fields: FieldDraft[]) => void;
}

/**
 * The fields of one section of the template (F-94), numbered across the whole
 * template. A field is dragged by its grip within the section or into another
 * one (R-1202) — the arrows still move it one place; a section left with no
 * field shows where to drop one, and Lưu waits until it holds one.
 */
export function LaboFormSectionFields({ blockRowId, fields, firstNumber, canAdd, onChange }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: sectionDropId(blockRowId),
    data: { type: "section", blockRowId },
    disabled: !useTakesDrag("section"),
  });
  const replace = (next: FieldDraft) => onChange(fields.map((f) => (f.rowId === next.rowId ? next : f)));
  const remove = (rowId: string) => onChange(fields.filter((f) => f.rowId !== rowId));
  const className = ["ft-section-fields", isOver && "is-over"].filter(Boolean).join(" ");

  return (
    <div ref={setNodeRef} className={className}>
      <SortableContext items={fields.map((field) => field.rowId)} strategy={verticalListSortingStrategy}>
        {fields.map((field, index) => (
          <SortableShell
            key={field.rowId}
            id={field.rowId}
            data={{ type: "field", blockRowId }}
            variant="field"
            handleLabel={t("Labo:FormTpl:FieldDragOf", String(firstNumber + index))}
          >
            <LaboFormFieldRow
              field={field}
              index={index}
              count={fields.length}
              number={firstNumber + index}
              onChange={replace}
              onMove={(step) => onChange(moveItem(fields, index, step))}
              onRemove={() => remove(field.rowId)}
            />
          </SortableShell>
        ))}
      </SortableContext>
      {fields.length === 0 && <p className="ft-drop-hint">{t("Labo:FormTpl:DropFieldHere")}</p>}
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
