import type { MedicalRecordFields } from "@/features/taxonomy/components/MedicalRecordSheet";

/**
 * What a sheet stores in its single JSON column.
 *
 * `fields` are the cells of a drawn form; `body` is the free text of a sheet
 * whose printed layout BlueDental does not draw. A sheet carries whichever it
 * needs, so both shapes live in one object rather than two columns.
 */
export interface SheetDraft {
  fields: SheetFields;
  body: string;
}

/**
 * A sheet's cells.
 *
 * The outpatient record has seventeen named cells; the cover's tables generate
 * theirs (`contentQtyA0`, `ctrl4_2`, …), so the map stays open. Every value is
 * a string — a ticked box stores `"1"`.
 */
export type SheetFields = MedicalRecordFields & Record<string, string | undefined>;

function asObject(content: string | null): Record<string, unknown> | null {
  if (!content) return null;
  try {
    const parsed: unknown = JSON.parse(content);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    // A sheet whose stored JSON cannot be read opens empty rather than
    // throwing the whole view away.
    return null;
  }
}

/**
 * The drawn cells. Sheets written before the two shapes were merged stored the
 * cells at the top level, so those are still read.
 */
export function parseFields(content: string | null): SheetFields {
  const parsed = asObject(content);
  if (!parsed) return {};

  if ("fields" in parsed) {
    const fields = parsed.fields;
    return typeof fields === "object" && fields !== null ? (fields as SheetFields) : {};
  }

  // Older shape: `{ "<cell>": "<value>" }`, but not the free sheet's `{ body }`.
  if ("body" in parsed) return {};
  return parsed as SheetFields;
}

/** The free sheet's text, under `body` in both the old shape and the new. */
export function parseBody(content: string | null): string {
  const parsed = asObject(content);
  if (!parsed) {
    // Sheets older still stored the text raw; show it rather than losing it.
    return content ?? "";
  }

  return typeof parsed.body === "string" ? parsed.body : "";
}
