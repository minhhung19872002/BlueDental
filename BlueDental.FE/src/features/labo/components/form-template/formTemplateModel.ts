import { t } from "@/lib/i18n";
import {
  LABO_BLOCK_KIND,
  LABO_FIELD_TYPE,
  isChoiceType,
  type LaboBlockKind,
  type LaboFieldType,
  type LaboFormBlockDto,
  type LaboFormFieldDto,
  type LaboFormTemplateDto,
  type LaboFormTemplateInput,
} from "../../api/laboFormTemplateApi";
import {
  BLOCK_NAME,
  SYSTEM_BLOCKS,
  isSystemKind,
  sectionEntries,
  withoutRestorationCards,
} from "../request-slip/slipLayout";

/** The server's limits (BlueDental.Labo.LaboFormTemplate / LaboFormField / LaboFormLayout). */
export const MAX_FIELDS = 30;
export const MAX_SECTIONS = 10;
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

/**
 * One block of the layout being built (F-94). A system block's `key` is
 * unused and a blank `title` keeps its own name; a custom section carries the
 * key its fields point at — made here, so a new one can be pointed at before
 * the server has seen it — and its fields.
 */
export interface BlockDraft {
  rowId: string;
  key: string;
  kind: LaboBlockKind;
  title: string;
  visible: boolean;
  span: number;
  fields: FieldDraft[];
}

export interface TemplateDraft {
  name: string;
  description: string;
  isActive: boolean;
  blocks: BlockDraft[];
}

let rowSeq = 0;
const nextRowId = () => `row-${++rowSeq}`;
const newSectionKey = () => `s${Date.now().toString(36)}${(++rowSeq).toString(36)}`;

export const blankField = (): FieldDraft => ({
  rowId: nextRowId(),
  label: "",
  type: LABO_FIELD_TYPE.Text,
  required: false,
  options: [],
});

/** A new custom section: shown, full width, with one empty field. */
export const blankSection = (title = ""): BlockDraft => ({
  rowId: nextRowId(),
  key: newSectionKey(),
  kind: LABO_BLOCK_KIND.Custom,
  title,
  visible: true,
  span: 3,
  fields: [blankField()],
});

const fieldDraft = (field: LaboFormFieldDto): FieldDraft => ({
  rowId: nextRowId(),
  key: field.key ?? undefined,
  label: field.label,
  type: field.type,
  required: field.required,
  options: [...field.options],
});

/** The slip's own layout with one "Thông tin bổ sung" section before Yêu cầu — the F-93 shape. */
function defaultBlocks(): LaboFormBlockDto[] {
  const blocks: LaboFormBlockDto[] = SYSTEM_BLOCKS.map(({ kind, span }) => ({ kind, span, visible: true }));
  blocks.splice(blocks.length - 1, 0, { key: "extra", kind: LABO_BLOCK_KIND.Custom, span: 3, visible: true });
  return blocks;
}

function blockDraft(block: LaboFormBlockDto, fields: LaboFormFieldDto[]): BlockDraft {
  const custom = block.kind === LABO_BLOCK_KIND.Custom;
  return {
    rowId: nextRowId(),
    key: custom ? (block.key ?? newSectionKey()) : "",
    kind: block.kind,
    // The section of a template saved before layouts has no title of its own.
    title: block.title ?? (custom ? t("Labo:Slip:Extra") : ""),
    visible: block.visible,
    span: block.span,
    fields: custom ? fields.map(fieldDraft) : [],
  };
}

/**
 * A new template starts from the slip's own blocks alone, with no section of
 * its own (owner, 2026-11-11 — Thêm mục adds one); an edit loads the stored
 * layout, each field in its section.
 */
export function templateDraft(template: LaboFormTemplateDto | null): TemplateDraft {
  if (!template) {
    const blocks = SYSTEM_BLOCKS.map(({ kind, span }) => blockDraft({ kind, span, visible: true }, []));
    return { name: "", description: "", isActive: true, blocks };
  }
  const layout = template.blocks?.length ? withoutRestorationCards(template.blocks) : defaultBlocks();
  return {
    name: template.name,
    description: template.description ?? "",
    isActive: template.isActive,
    blocks: layout.map((block) => blockDraft(block, sectionEntries(layout, template.fields, block))),
  };
}

/** Moves the item at `from` one place up (-1) or down (+1); out of range leaves the list as it is. */
export function moveItem<T>(items: T[], from: number, step: -1 | 1): T[] {
  const to = from + step;
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export const isSection = (block: Pick<BlockDraft, "kind">): boolean => block.kind === LABO_BLOCK_KIND.Custom;

/** Every field of the template, section by section, as the builder numbers them. */
export const allFields = (draft: TemplateDraft): FieldDraft[] => draft.blocks.flatMap((block) => block.fields);

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

/** The layout's own problems: too many sections, one untitled, one with no field. */
function layoutProblem(draft: TemplateDraft): string | null {
  const sections = draft.blocks.filter(isSection);
  if (sections.length > MAX_SECTIONS) return t("Labo:FormTpl:Err:TooManyBlocks", String(MAX_SECTIONS));
  const untitled = draft.blocks.findIndex((block) => isSection(block) && !block.title.trim());
  if (untitled >= 0) return t("Labo:FormTpl:Err:BlockTitle", String(untitled + 1));
  const empty = sections.find((block) => block.fields.length === 0);
  return empty ? t("Labo:FormTpl:Err:BlockEmpty", empty.title.trim()) : null;
}

/**
 * What still stops Lưu, as a message — the same rules the server enforces,
 * shown before the round trip. Null when the draft can be saved. A layout
 * with no section, and so no field, is a template too (F-94).
 */
export function draftProblem(draft: TemplateDraft): string | null {
  if (!draft.name.trim()) return t("Common:PleaseEnter", t("Labo:FormTpl:Name"));
  const fields = allFields(draft);
  if (fields.length > MAX_FIELDS) return t("Labo:FormTpl:Err:TooMany", String(MAX_FIELDS));
  const layout = layoutProblem(draft);
  if (layout) return layout;
  const labels = new Set<string>();
  for (const [index, field] of fields.entries()) {
    const label = field.label.trim();
    if (!label) return t("Labo:FormTpl:Err:Label", String(index + 1));
    if (labels.has(label.toLowerCase())) return t("Labo:FormTpl:Err:Duplicate", label);
    labels.add(label.toLowerCase());
    if (isChoiceType(field.type) && cleanOptions(field.options).length === 0)
      return t("Labo:FormTpl:Err:Options", label);
  }
  return null;
}

/** The draft as the server takes it: the layout, and every field naming its section; options for the choice kinds only. */
export function templateInput(draft: TemplateDraft): LaboFormTemplateInput {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || undefined,
    isActive: draft.isActive,
    blocks: draft.blocks.map((block) => ({
      key: isSection(block) ? block.key : undefined,
      kind: block.kind,
      title: block.title.trim() || undefined,
      visible: block.visible,
      span: block.span,
    })),
    fields: draft.blocks.flatMap((block) =>
      block.fields.map((field) => ({
        key: field.key,
        label: field.label.trim(),
        type: field.type,
        required: field.required,
        options: isChoiceType(field.type) ? cleanOptions(field.options) : [],
        blockKey: block.key,
      })),
    ),
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

/** How the builder names a block in its labels: a system block by its own name, a section by its place. */
export const blockLabel = (block: Pick<BlockDraft, "kind">, index: number): string =>
  isSystemKind(block.kind) ? t(BLOCK_NAME[block.kind]) : String(index + 1);
