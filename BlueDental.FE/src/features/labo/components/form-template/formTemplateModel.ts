import { t } from "@/lib/i18n";
import {
  LABO_FIELD_TYPE,
  isChoiceType,
  type LaboFieldType,
  type LaboFormTemplateDto,
  type LaboFormTemplateInput,
} from "../../api/laboFormTemplateApi";

/** The server's limits (BlueDental.Labo.LaboFormTemplate / LaboFormField). */
export const MAX_FIELDS = 30;
export const MAX_OPTIONS = 50;
export const MAX_OPTION_LENGTH = 100;

/** One row of the builder. `rowId` only keys the row on screen; `key` is the server's. */
export interface FieldDraft {
  rowId: string;
  key?: string;
  label: string;
  type: LaboFieldType;
  required: boolean;
  options: string[];
}

export interface TemplateDraft {
  name: string;
  description: string;
  isActive: boolean;
  fields: FieldDraft[];
}

let rowSeq = 0;
const nextRowId = () => `row-${++rowSeq}`;

export const blankField = (): FieldDraft => ({
  rowId: nextRowId(),
  label: "",
  type: LABO_FIELD_TYPE.Text,
  required: false,
  options: [],
});

/** A new template starts with one empty field; an edit loads the stored one. */
export function templateDraft(template: LaboFormTemplateDto | null): TemplateDraft {
  if (!template) return { name: "", description: "", isActive: true, fields: [blankField()] };
  return {
    name: template.name,
    description: template.description ?? "",
    isActive: template.isActive,
    fields: template.fields.map((field) => ({
      rowId: nextRowId(),
      key: field.key ?? undefined,
      label: field.label,
      type: field.type,
      required: field.required,
      options: [...field.options],
    })),
  };
}

/** Moves the row at `from` one place up (-1) or down (+1); out of range leaves the list as it is. */
export function moveField(fields: FieldDraft[], from: number, step: -1 | 1): FieldDraft[] {
  const to = from + step;
  if (to < 0 || to >= fields.length) return fields;
  const next = [...fields];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** Trims, drops blanks and repeats (ignoring case), keeping the first spelling. */
export function cleanOptions(options: string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of options) {
    const option = raw.trim();
    if (!option || seen.has(option.toLowerCase())) continue;
    seen.add(option.toLowerCase());
    kept.push(option);
  }
  return kept;
}

/**
 * What still stops Lưu, as a message — the same rules the server enforces,
 * shown before the round trip. Null when the draft can be saved.
 */
export function draftProblem(draft: TemplateDraft): string | null {
  if (!draft.name.trim()) return t("Common:PleaseEnter", t("Labo:FormTpl:Name"));
  if (draft.fields.length === 0) return t("Labo:FormTpl:Err:NoField");
  if (draft.fields.length > MAX_FIELDS) return t("Labo:FormTpl:Err:TooMany", String(MAX_FIELDS));
  const labels = new Set<string>();
  for (const [index, field] of draft.fields.entries()) {
    const label = field.label.trim();
    if (!label) return t("Labo:FormTpl:Err:Label", String(index + 1));
    if (labels.has(label.toLowerCase())) return t("Labo:FormTpl:Err:Duplicate", label);
    labels.add(label.toLowerCase());
    if (isChoiceType(field.type) && cleanOptions(field.options).length === 0)
      return t("Labo:FormTpl:Err:Options", label);
  }
  return null;
}

/** The draft as the server takes it; options are sent for the choice kinds only. */
export function templateInput(draft: TemplateDraft): LaboFormTemplateInput {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || undefined,
    isActive: draft.isActive,
    fields: draft.fields.map((field) => ({
      key: field.key,
      label: field.label.trim(),
      type: field.type,
      required: field.required,
      options: isChoiceType(field.type) ? cleanOptions(field.options) : [],
    })),
  };
}

/** The i18n key naming each kind of field, for the type picker and the table. */
export const FIELD_TYPE_LABEL: Record<LaboFieldType, string> = {
  [LABO_FIELD_TYPE.Text]: "Labo:FormTpl:Type:Text",
  [LABO_FIELD_TYPE.LongText]: "Labo:FormTpl:Type:LongText",
  [LABO_FIELD_TYPE.Number]: "Labo:FormTpl:Type:Number",
  [LABO_FIELD_TYPE.Date]: "Labo:FormTpl:Type:Date",
  [LABO_FIELD_TYPE.Select]: "Labo:FormTpl:Type:Select",
  [LABO_FIELD_TYPE.MultiSelect]: "Labo:FormTpl:Type:MultiSelect",
  [LABO_FIELD_TYPE.YesNo]: "Labo:FormTpl:Type:YesNo",
};
