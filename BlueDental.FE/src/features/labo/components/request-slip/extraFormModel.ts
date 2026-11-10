import type {
  LaboExtraFormDto,
  LaboFieldType,
  LaboFormTemplateDto,
} from "@/features/labo/api/laboFormTemplateApi";

/** One field of Thông tin bổ sung as the slip shows it. */
export interface ExtraField {
  key: string;
  label: string;
  type: LaboFieldType;
  required: boolean;
  options: string[];
}

/**
 * Thông tin bổ sung on the Phiếu yêu cầu (F-93): the picked Mẫu phiếu's fields
 * and what was filled in, by field key. Every answer is text; a MultiSelect
 * has several, the others one or none.
 */
export interface ExtraFormValues {
  templateId: string;
  templateName: string;
  fields: ExtraField[];
  answers: Record<string, string[]>;
}

/** A saved order's own copy, answers included. */
export function extraFromOrder(extra: LaboExtraFormDto | null | undefined): ExtraFormValues | null {
  if (!extra) return null;
  return {
    templateId: extra.templateId,
    templateName: extra.templateName,
    fields: extra.entries.map(({ key, label, type, required, options }) => ({ key, label, type, required, options })),
    answers: Object.fromEntries(extra.entries.map((entry) => [entry.key, entry.values])),
  };
}

/** A template just picked: its fields as they are now, nothing filled in. */
export function extraFromTemplate(template: LaboFormTemplateDto): ExtraFormValues {
  return {
    templateId: template.id,
    templateName: template.name,
    fields: template.fields
      .filter((field): field is typeof field & { key: string } => Boolean(field.key))
      .map(({ key, label, type, required, options }) => ({ key, label, type, required, options })),
    answers: {},
  };
}

/**
 * What the Mẫu bổ sung picker switches to. Going back to the template the order
 * already holds brings its copy back, as the server would keep it; any other
 * template starts blank; none clears the section.
 */
export function pickExtra(
  templateId: string | undefined,
  templates: LaboFormTemplateDto[],
  saved: LaboExtraFormDto | null | undefined,
): ExtraFormValues | null {
  if (!templateId) return null;
  if (saved?.templateId === templateId) return extraFromOrder(saved);
  const template = templates.find((item) => item.id === templateId);
  return template ? extraFromTemplate(template) : null;
}

const filled = (values: string[] | undefined) => (values ?? []).some((value) => value.trim() !== "");

/** True while a Bắt buộc field of the section is still blank. */
export function extraMissing(extra: ExtraFormValues | null): boolean {
  return extra !== null && extra.fields.some((field) => field.required && !filled(extra.answers[field.key]));
}

/** The section as the save sends it; no template sent clears it on the server. */
export function extraBody(extra: ExtraFormValues | null) {
  if (!extra) return { extraFormTemplateId: undefined, extraFormAnswers: [] };
  return {
    extraFormTemplateId: extra.templateId,
    extraFormAnswers: extra.fields
      .map((field) => ({ key: field.key, values: (extra.answers[field.key] ?? []).filter((v) => v.trim() !== "") }))
      .filter((answer) => answer.values.length > 0),
  };
}
