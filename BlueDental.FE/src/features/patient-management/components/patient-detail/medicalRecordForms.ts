import {
  MEDICAL_RECORD_FORM,
  type MedicalRecordForm,
} from "../../api/medicalRecordApi";

/**
 * "Mục lục bệnh án" — the nine printed forms the reference offers, in its own
 * order and wording, each with the tint and accent it draws the row in.
 *
 * The colours cycle through seven: rows 8 and 9 repeat rows 1 and 2, which is
 * what the reference does (docs/clone/pages/patient-detail.md §Bệnh án). The
 * seven hues are the reference's; the steps are the app's v3 families (R-991).
 */
export interface MedicalRecordFormSpec {
  form: MedicalRecordForm;
  /** Position in the index, as the reference numbers them. */
  index: number;
  /**
   * The form's own printed name. Left untranslated on purpose: the nine forms
   * are Vietnamese medical documents in both languages, and this is also the
   * title a new sheet is saved under.
   */
  label: string;
  /** Row background. */
  tint: string;
  /** Button fill and icon colour. */
  accent: string;
  /** Icon chip background. */
  iconBg: string;
  /**
   * Whether the form has any blanks to type into. All nine do, now that each is
   * drawn from its printed original — "Phiếu Tư Vấn Tổng Quát" carries
   * twenty-three, which the earlier hand-drawn version of it did not.
   */
  fillable: boolean;
  /**
   * Whether a row of this form's table may be added, and whether one may be
   * removed. Three forms carry a table that is really a list — the cost lines
   * and the two treatment logs — and the reference offers `+` on all three but
   * `−` only on the two logs, where a whole printed block can go.
   */
  canAddRows?: boolean;
  canDeleteRows?: boolean;
  /**
   * The date the form is filled in for, shown beside the doctor picker. Five of
   * the nine carry one; the wording is the reference's own — "Ngày tư vấn" on
   * the consent form, "Ngày thực hiện" on the rest. It is the picker's label,
   * not part of the sheet, so it is an i18n key.
   */
  dateLabel?: string;
  /**
   * The blanks that date is printed into. Two of the five have none: there the
   * date only says which day's clinical notes the sheet is about.
   */
  dateFieldKeys?: string[];
  /**
   * The blanks the doctor picked above the sheet is printed into: the name,
   * and the Chức danh kept on their staff record (clinic, 2026-10-16).
   */
  doctorFieldKeys?: { name: string[]; jobTitle: string[] };
}

/** Each family's *-subtle step and its solid step, as --bd-* tokens. */
const FORM_FAMILY = {
  info: ["--bd-info-pale", "--bd-info"],
  aqua: ["--bd-aqua-pale", "--bd-aqua"],
  orange: ["--bd-orange-pale", "--bd-orange"],
  orchid: ["--bd-purple-pale", "--bd-purple"],
  gold: ["--bd-gold-100", "--bd-gold-700"],
  success: ["--bd-green-pale", "--bd-green"],
  danger: ["--bd-red-pale", "--bd-red"],
} as const;

/** The row is half the family's tint on white; the icon chip the full tint. */
function formTone(family: keyof typeof FORM_FAMILY) {
  const [pale, solid] = FORM_FAMILY[family];
  return {
    tint: `color-mix(in srgb, var(${pale}) 50%, var(--bd-card))`,
    accent: `var(${solid})`,
    iconBg: `var(${pale})`,
  };
}

export const MEDICAL_RECORD_FORMS: MedicalRecordFormSpec[] = [
  {
    form: MEDICAL_RECORD_FORM.Cover,
    fillable: true,
    index: 1,
    label: "Bìa hồ sơ bệnh án",
    ...formTone("info"),
  },
  {
    form: MEDICAL_RECORD_FORM.OutpatientDental,
    fillable: true,
    index: 2,
    label: "Bệnh án ngoại trú Răng Hàm Mặt",
    ...formTone("aqua"),
  },
  {
    form: MEDICAL_RECORD_FORM.Orthodontic,
    fillable: true,
    index: 3,
    label: "Bệnh án chỉnh nha",
    ...formTone("orange"),
  },
  {
    form: MEDICAL_RECORD_FORM.GeneralConsultation,
    fillable: true,
    dateLabel: "Patient:MedRecord:PerformedDate",
    dateFieldKeys: ["general-consultation.text.14", "consultation.text.4"],
    index: 4,
    label: "Phiếu Tư Vấn Tổng Quát",
    ...formTone("orchid"),
  },
  {
    form: MEDICAL_RECORD_FORM.TreatmentConsent,
    fillable: true,
    canAddRows: true,
    dateLabel: "Patient:MedRecord:ConsultingDate",
    dateFieldKeys: ["consultation.text.4"],
    index: 5,
    label: "Phiếu tư vấn và xác nhận đồng ý điều trị",
    ...formTone("gold"),
  },
  {
    form: MEDICAL_RECORD_FORM.SurgeryConsent,
    fillable: true,
    dateLabel: "Patient:MedRecord:PerformedDate",
    doctorFieldKeys: { name: ["surgery-consent.text.1"], jobTitle: ["surgery-consent.text.2"] },
    index: 6,
    label: "Giấy đồng ý thực hiện phẫu thuật/thủ thuật",
    ...formTone("success"),
  },
  {
    form: MEDICAL_RECORD_FORM.SurgeryRecord,
    fillable: true,
    index: 7,
    label: "Phiếu phẫu thuật/thủ thuật",
    ...formTone("danger"),
  },
  {
    form: MEDICAL_RECORD_FORM.TreatmentFollowUp,
    fillable: true,
    canAddRows: true,
    canDeleteRows: true,
    dateLabel: "Patient:MedRecord:PerformedDate",
    index: 8,
    label: "Phiếu theo dõi điều trị",
    ...formTone("info"),
  },
  {
    form: MEDICAL_RECORD_FORM.CareSheet,
    fillable: true,
    canAddRows: true,
    canDeleteRows: true,
    dateLabel: "Patient:MedRecord:PerformedDate",
    index: 9,
    label: "Phiếu chăm sóc",
    ...formTone("aqua"),
  },
];

export function formSpecOf(form: MedicalRecordForm): MedicalRecordFormSpec {
  return MEDICAL_RECORD_FORMS.find((item) => item.form === form) ?? MEDICAL_RECORD_FORMS[0];
}

