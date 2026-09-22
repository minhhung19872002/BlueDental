import {
  MEDICAL_RECORD_FORM,
  type MedicalRecordForm,
} from "../../api/medicalRecordApi";

/**
 * "Mục lục bệnh án" — the nine printed forms the reference offers, in its own
 * order and wording, each with the tint and accent it draws the row in.
 *
 * The colours cycle through seven: rows 8 and 9 repeat rows 1 and 2, which is
 * what the reference does. Measured off its own computed styles — see
 * docs/clone/pages/patient-detail.md §Bệnh án.
 */
export interface MedicalRecordFormSpec {
  form: MedicalRecordForm;
  /** Position in the index, as the reference numbers them. */
  index: number;
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
   * the consent form, "Ngày thực hiện" on the rest.
   */
  dateLabel?: string;
  /**
   * The blanks that date is printed into. Two of the five have none: there the
   * date only says which day's clinical notes the sheet is about.
   */
  dateFieldKeys?: string[];
}

export const MEDICAL_RECORD_FORMS: MedicalRecordFormSpec[] = [
  {
    form: MEDICAL_RECORD_FORM.Cover,
    fillable: true,
    index: 1,
    label: "Bìa hồ sơ bệnh án",
    tint: "#f4f8ff",
    accent: "#3075cc",
    iconBg: "#e5f0ff",
  },
  {
    form: MEDICAL_RECORD_FORM.OutpatientDental,
    fillable: true,
    index: 2,
    label: "Bệnh án ngoại trú Răng Hàm Mặt",
    tint: "#f0fbf9",
    accent: "#22b5a6",
    iconBg: "#d8f6f2",
  },
  {
    form: MEDICAL_RECORD_FORM.Orthodontic,
    fillable: true,
    index: 3,
    label: "Bệnh án chỉnh nha",
    tint: "#fff7f1",
    accent: "#d97a40",
    iconBg: "#ffe6d5",
  },
  {
    form: MEDICAL_RECORD_FORM.GeneralConsultation,
    fillable: true,
    dateLabel: "Ngày thực hiện",
    dateFieldKeys: ["general-consultation.text.14", "consultation.text.4"],
    index: 4,
    label: "Phiếu Tư Vấn Tổng Quát",
    tint: "#faf6ff",
    accent: "#a174e0",
    iconBg: "#eee1ff",
  },
  {
    form: MEDICAL_RECORD_FORM.TreatmentConsent,
    fillable: true,
    canAddRows: true,
    dateLabel: "Ngày tư vấn",
    dateFieldKeys: ["consultation.text.4"],
    index: 5,
    label: "Phiếu tư vấn và xác nhận đồng ý điều trị",
    tint: "#fff9ef",
    accent: "#e2a32a",
    iconBg: "#fff0d5",
  },
  {
    form: MEDICAL_RECORD_FORM.SurgeryConsent,
    fillable: true,
    dateLabel: "Ngày thực hiện",
    index: 6,
    label: "Giấy đồng ý thực hiện phẫu thuật/thủ thuật",
    tint: "#f2fcf5",
    accent: "#18aa65",
    iconBg: "#ddf8e5",
  },
  {
    form: MEDICAL_RECORD_FORM.SurgeryRecord,
    fillable: true,
    index: 7,
    label: "Phiếu phẫu thuật/thủ thuật",
    tint: "#fff5f7",
    accent: "#f05d79",
    iconBg: "#ffe1e7",
  },
  {
    form: MEDICAL_RECORD_FORM.TreatmentFollowUp,
    fillable: true,
    canAddRows: true,
    canDeleteRows: true,
    dateLabel: "Ngày thực hiện",
    index: 8,
    label: "Phiếu theo dõi điều trị",
    tint: "#f4f8ff",
    accent: "#3075cc",
    iconBg: "#e5f0ff",
  },
  {
    form: MEDICAL_RECORD_FORM.CareSheet,
    fillable: true,
    canAddRows: true,
    canDeleteRows: true,
    dateLabel: "Ngày thực hiện",
    index: 9,
    label: "Phiếu chăm sóc",
    tint: "#f0fbf9",
    accent: "#22b5a6",
    iconBg: "#d8f6f2",
  },
];

export function formSpecOf(form: MedicalRecordForm): MedicalRecordFormSpec {
  return MEDICAL_RECORD_FORMS.find((item) => item.form === form) ?? MEDICAL_RECORD_FORMS[0];
}

