import type { Dayjs } from "dayjs";
import { WarningOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { Gender } from "../../types/patient";
import { initialsOf } from "../../utils/guardian";

/** The patient the guardians are for, as the hồ sơ dialog currently holds them. */
export interface GuardianPatientSummaryData {
  fullName: string;
  code: string;
  gender: Gender;
  dateOfBirth: Dayjs | null;
  age: number | null;
  required: boolean;
}

const GENDER_LABEL: Record<Gender, string> = {
  male: "Nam",
  female: "Patient:Misc:Female",
  other: "Patient:Misc:OtherLabel",
};

/** The card at the top of the popup: who the guardians stand for, and why they are needed. */
export function GuardianPatientSummary({ patient }: { patient: GuardianPatientSummaryData }) {
  const name = patient.fullName.trim() || t("Patient:Guardian:UnnamedPatient");
  const birth = patient.dateOfBirth
    ? t("Patient:Guardian:BornOn", patient.dateOfBirth.format("DD/MM/YYYY"))
    : t("Patient:Guardian:NoBirthDate");

  return (
    <div className={["bd-guardian-patient", patient.required && "bd-guardian-patient--required"].filter(Boolean).join(" ")}>
      <span className="bd-guardian-avatar" aria-hidden>
        {initialsOf(patient.fullName)}
      </span>
      <div className="bd-min0">
        <strong>{[name, patient.code].filter(Boolean).join(" · ")}</strong>
        <span>{`${t(GENDER_LABEL[patient.gender])} · ${birth}`}</span>
      </div>
      {patient.age !== null && (
        <span className={patient.required ? "bd-guardian-agechip bd-guardian-agechip--required" : "bd-guardian-agechip"}>
          {patient.required && <WarningOutlined aria-hidden />}
          {patient.required
            ? t("Patient:Guardian:AgeRequired", patient.age)
            : t("Patient:Guardian:AgeYears", patient.age)}
        </span>
      )}
    </div>
  );
}
