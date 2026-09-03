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
/**
 * How a form is drawn.
 *
 * `cover`, `outpatient` and `consultation` are the three whose printed layout
 * was observed on the reference; `free` is the clinic's own plain A4 page,
 * used for the forms whose layout has not been.
 */
export type MedicalRecordFormKind = "cover" | "outpatient" | "consultation" | "free";

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
  kind: MedicalRecordFormKind;
  /**
   * Whether the sheet has anything to type into. The reference's
   * "Phiếu Tư Vấn Tổng Quát" carries no input at all — it is printed and then
   * filled in by hand — so saving it would store nothing.
   */
  fillable: boolean;
}

export const MEDICAL_RECORD_FORMS: MedicalRecordFormSpec[] = [
  {
    form: MEDICAL_RECORD_FORM.Cover,
    kind: "cover",
    fillable: true,
    index: 1,
    label: "Bìa hồ sơ bệnh án",
    tint: "#f4f8ff",
    accent: "#3075cc",
    iconBg: "#e5f0ff",
  },
  {
    form: MEDICAL_RECORD_FORM.OutpatientDental,
    kind: "outpatient",
    fillable: true,
    index: 2,
    label: "Bệnh án ngoại trú Răng Hàm Mặt",
    tint: "#f0fbf9",
    accent: "#22b5a6",
    iconBg: "#d8f6f2",
  },
  {
    form: MEDICAL_RECORD_FORM.Orthodontic,
    kind: "free",
    fillable: true,
    index: 3,
    label: "Bệnh án chỉnh nha",
    tint: "#fff7f1",
    accent: "#d97a40",
    iconBg: "#ffe6d5",
  },
  {
    form: MEDICAL_RECORD_FORM.GeneralConsultation,
    kind: "consultation",
    fillable: false,
    index: 4,
    label: "Phiếu Tư Vấn Tổng Quát",
    tint: "#faf6ff",
    accent: "#a174e0",
    iconBg: "#eee1ff",
  },
  {
    form: MEDICAL_RECORD_FORM.TreatmentConsent,
    kind: "free",
    fillable: true,
    index: 5,
    label: "Phiếu tư vấn và xác nhận đồng ý điều trị",
    tint: "#fff9ef",
    accent: "#e2a32a",
    iconBg: "#fff0d5",
  },
  {
    form: MEDICAL_RECORD_FORM.SurgeryConsent,
    kind: "free",
    fillable: true,
    index: 6,
    label: "Giấy đồng ý thực hiện phẫu thuật/thủ thuật",
    tint: "#f2fcf5",
    accent: "#18aa65",
    iconBg: "#ddf8e5",
  },
  {
    form: MEDICAL_RECORD_FORM.SurgeryRecord,
    kind: "free",
    fillable: true,
    index: 7,
    label: "Phiếu phẫu thuật/thủ thuật",
    tint: "#fff5f7",
    accent: "#f05d79",
    iconBg: "#ffe1e7",
  },
  {
    form: MEDICAL_RECORD_FORM.TreatmentFollowUp,
    kind: "free",
    fillable: true,
    index: 8,
    label: "Phiếu theo dõi điều trị",
    tint: "#f4f8ff",
    accent: "#3075cc",
    iconBg: "#e5f0ff",
  },
  {
    form: MEDICAL_RECORD_FORM.CareSheet,
    kind: "free",
    fillable: true,
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

