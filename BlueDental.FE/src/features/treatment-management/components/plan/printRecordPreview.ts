import {
  MEDICAL_RECORD_FORM,
  type MedicalRecordForm,
  type PatientMedicalRecordDto,
} from "@/features/patient-management/api/medicalRecordApi";
import { MEDICAL_RECORD_FORMS } from "@/features/patient-management/components/patient-detail/medicalRecordForms";

/**
 * Zoom of the "In bệnh án" preview, as measured on the reference: 40%–120% in
 * 5% steps, and "Fit" is a reset to 85% rather than a fit-to-width — it lands
 * on 85% at every window size. See docs/clone/pages/treatment-plan.md.
 */
export const PREVIEW_ZOOM = {
  min: 0.4,
  max: 1.2,
  step: 0.05,
  fit: 0.85,
} as const;

export function clampZoom(value: number): number {
  return Math.min(PREVIEW_ZOOM.max, Math.max(PREVIEW_ZOOM.min, Number(value.toFixed(2))));
}

/** The file picker lists the nine printed forms, in the reference's order. */
export const PRINT_FORM_OPTIONS = MEDICAL_RECORD_FORMS.map((spec) => ({
  value: spec.form,
  label: spec.label,
}));

export const DEFAULT_PRINT_FORM: MedicalRecordForm = MEDICAL_RECORD_FORM.Cover;

/**
 * The sheet to draw for the chosen form: the patient's own, so anything already
 * written on it prints, or an unsaved blank of that form when they have none.
 *
 * The blank keeps a stable id per form so that switching files re-seeds the
 * draft exactly once, rather than on every render.
 */
export function previewSheet(
  form: MedicalRecordForm,
  sheets: readonly PatientMedicalRecordDto[],
  patientId: string,
  clinicBranchId: string,
): PatientMedicalRecordDto {
  const saved = sheets.find((sheet) => sheet.form === form);
  if (saved) return saved;

  const spec = MEDICAL_RECORD_FORMS.find((item) => item.form === form);
  return {
    id: `preview-${form}`,
    patientId,
    clinicBranchId,
    form,
    title: spec?.label ?? "",
    sortOrder: spec?.index ?? 0,
    content: null,
    creationTime: "",
    lastModificationTime: null,
  };
}
