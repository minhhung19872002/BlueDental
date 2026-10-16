import type { PatientMedicalRecordDto } from "../../api/medicalRecordApi";
import { MedicalRecordDocument } from "./medical-record/MedicalRecordDocument";
import type { FieldValues } from "./medical-record/fieldValues";
import { templateOf } from "./medical-record/templates";
import { formSpecOf } from "./medicalRecordForms";

/**
 * Draws one sheet.
 *
 * All nine forms are drawn the same way — from the blank form they are printed
 * from, filled through its `data-medical-record-field` blanks. There is no
 * per-form component any more: the forms differ by eight hundred blanks and
 * seventeen pages of layout, which is a document, not code. See
 * docs/clone/pages/patient-detail.md §Bệnh án.
 */

interface Props {
  sheet: PatientMedicalRecordDto;
  /** Facts from the record and the letterhead, for the blanks that ask. */
  auto: FieldValues;
  zoom: number;
  /** Only the open sheet takes edits; the others are shown read-only. */
  editable: boolean;
  values: FieldValues;
  /**
   * Whether this user may lengthen or shorten the form's table. The reference
   * keeps that to a clinic administrator.
   */
  mayEditRows?: boolean;
  onChange: (next: FieldValues) => void;
}

export function MedicalRecordSheetView({
  sheet,
  auto,
  zoom,
  editable,
  values,
  mayEditRows = false,
  onChange,
}: Props) {
  const spec = formSpecOf(sheet.form);

  return (
    <MedicalRecordDocument
      sheetId={sheet.id}
      template={templateOf(sheet.form)}
      form={sheet.form}
      auto={auto}
      stored={values}
      /*
       * Rebuilt when the sheet changes, when the server hands back a newer copy
       * of it — and when what the record answers changes: the letterhead, the
       * address and the diagnoses are requests of their own and may land after
       * the sheet is first drawn. Never while it is being written on: typing
       * changes what is stored, not what the record answers.
       */
      documentKey={`${sheet.id}:${sheet.lastModificationTime ?? ""}:${JSON.stringify(auto)}`}
      editable={editable}
      zoom={zoom}
      canAddRows={mayEditRows && Boolean(spec.canAddRows)}
      canDeleteRows={mayEditRows && Boolean(spec.canDeleteRows)}
      onChange={editable ? onChange : undefined}
    />
  );
}
