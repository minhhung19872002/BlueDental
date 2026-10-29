import { MEDICAL_RECORD_FORM, type MedicalRecordForm } from "../../../../api/medicalRecordApi";
import { COVER_TEMPLATE } from "./cover";
import { OUTPATIENT_DENTAL_TEMPLATE } from "./outpatientDental";
import { ORTHODONTIC_TEMPLATE } from "./orthodontic";
import { GENERAL_CONSULTATION_TEMPLATE } from "./generalConsultation";
import { TREATMENT_CONSENT_TEMPLATE } from "./treatmentConsent";
import { SURGERY_CONSENT_TEMPLATE } from "./surgeryConsent";
import { SURGERY_RECORD_TEMPLATE } from "./surgeryRecord";
import { TREATMENT_FOLLOW_UP_TEMPLATE } from "./treatmentFollowUp";
import { CARE_SHEET_TEMPLATE } from "./careSheet";
import { ORTHODONTIC_CONTRACT_TEMPLATE } from "./orthodonticContract";

/**
 * The blank form each of the records is printed from: the reference's nine and
 * the clinic's own mẫu 10.
 *
 * They are shipped with the app rather than fetched: the reference keeps a
 * per-clinic copy that a clinic may edit, but BlueDental has no editor for
 * them yet, so every branch prints the same forms. See
 * docs/clone/pages/patient-detail.md §Bệnh án.
 */
export const MEDICAL_RECORD_TEMPLATES: Record<MedicalRecordForm, string> = {
  [MEDICAL_RECORD_FORM.Cover]: COVER_TEMPLATE,
  [MEDICAL_RECORD_FORM.OutpatientDental]: OUTPATIENT_DENTAL_TEMPLATE,
  [MEDICAL_RECORD_FORM.Orthodontic]: ORTHODONTIC_TEMPLATE,
  [MEDICAL_RECORD_FORM.GeneralConsultation]: GENERAL_CONSULTATION_TEMPLATE,
  [MEDICAL_RECORD_FORM.TreatmentConsent]: TREATMENT_CONSENT_TEMPLATE,
  [MEDICAL_RECORD_FORM.SurgeryConsent]: SURGERY_CONSENT_TEMPLATE,
  [MEDICAL_RECORD_FORM.SurgeryRecord]: SURGERY_RECORD_TEMPLATE,
  [MEDICAL_RECORD_FORM.TreatmentFollowUp]: TREATMENT_FOLLOW_UP_TEMPLATE,
  [MEDICAL_RECORD_FORM.CareSheet]: CARE_SHEET_TEMPLATE,
  [MEDICAL_RECORD_FORM.OrthodonticContract]: ORTHODONTIC_CONTRACT_TEMPLATE,
};

export function templateOf(form: MedicalRecordForm): string {
  return MEDICAL_RECORD_TEMPLATES[form] ?? "";
}
