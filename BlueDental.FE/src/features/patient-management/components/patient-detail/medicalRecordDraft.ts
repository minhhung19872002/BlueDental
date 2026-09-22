import type { FieldValues } from "./medical-record/fieldValues";

/**
 * What a sheet stores in its single JSON column.
 *
 * One entry per blank the clinic has written on, keyed by the blank's
 * `data-medical-record-field` id: a string for a text blank, a boolean for a
 * tick box. Blanks nobody has touched are absent, which is what lets the record
 * keep answering them and lets a later correction to the record show through.
 */
export interface SheetContent {
  fieldValues: FieldValues;
}

function asObject(content: string | null): Record<string, unknown> | null {
  if (!content) return null;
  try {
    const parsed: unknown = JSON.parse(content);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    // A sheet whose stored JSON cannot be read opens blank rather than
    // throwing the whole view away.
    return null;
  }
}

/**
 * The blanks written on this sheet.
 *
 * Sheets saved before the forms were drawn from the printed originals stored a
 * different set of names (`nextOfKin`, `illnessHistory`, …). Those names are
 * not blanks on any of the nine forms, so they are left behind rather than
 * printed into cells they were never about.
 */
export function parseFieldValues(content: string | null): FieldValues {
  const parsed = asObject(content);
  if (!parsed) return {};

  const stored = parsed.fieldValues;
  if (typeof stored !== "object" || stored === null) return {};

  const values: FieldValues = {};
  for (const [key, value] of Object.entries(stored)) {
    if (typeof value === "string" || typeof value === "boolean") values[key] = value;
  }
  return values;
}

export function serialiseFieldValues(values: FieldValues): string {
  return JSON.stringify({ fieldValues: values } satisfies SheetContent);
}
