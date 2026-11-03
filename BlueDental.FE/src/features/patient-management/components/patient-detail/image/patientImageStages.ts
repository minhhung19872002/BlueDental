import { PATIENT_IMAGE_TYPE, type PatientImageType } from "../../../api/patientImageApi";

export interface PatientImageStage {
  type: PatientImageType;
  /** The number on the stage's badge. */
  step: number;
  labelKey: string;
  /** `pi-stage--<modifier>` carries the stage's colour. */
  modifier: "before" | "during" | "after";
}

/** The three "Giai đoạn điều trị", in the order the tab and its filter list them. */
export const PATIENT_IMAGE_STAGES: readonly PatientImageStage[] = [
  { type: PATIENT_IMAGE_TYPE.before, step: 1, labelKey: "Patient:Image:Before", modifier: "before" },
  { type: PATIENT_IMAGE_TYPE.during, step: 2, labelKey: "Patient:Image:During", modifier: "during" },
  { type: PATIENT_IMAGE_TYPE.after, step: 3, labelKey: "Patient:Image:After", modifier: "after" },
];
