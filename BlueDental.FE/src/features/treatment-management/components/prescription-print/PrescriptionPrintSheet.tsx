import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { printedDoctorName } from "@/utils/printedDoctorName";
import { PRESCRIPTION_TREATMENT_TYPE, type PrescriptionDto } from "../../api/prescriptionApi";
import type { PrescriptionPatientSummary } from "../../types/prescription";
import { ageOf } from "../../utils/age";
import { printedDiagnosisNames } from "../../utils/rxDiagnosis";
import { RxSheetFact, RxSheetMedicines, RxSheetOtherAdvice } from "./RxSheetParts";

interface Props {
  patient: PrescriptionPatientSummary;
  /** The record's address as printed, already resolved ("" when none). */
  patientAddress: string;
  prescription: PrescriptionDto;
}

/** "TP HCM, Ngày 6 tháng 10 năm 2026" — where and when the slip was written. */
function placedDate(value: string): string {
  const date = new Date(value);
  const day = t("Patient:Print:LongDate", date.getDate(), date.getMonth() + 1, date.getFullYear());
  return t("Treatment:RxPrint:PlaceDate", t("Treatment:RxPrint:ClinicPlace"), day);
}

/**
 * "ĐƠN THUỐC" on an A4 page, laid out as the BA's third Word copy
 * (Downloads/Mau-Don-thuoc (2).docx, R-1302; A5 before): the clinic
 * letterhead — fixed text by the BA's call, not the branch's data (R-1301) —
 * and the slip code, the patient with address and guardian, the diagnosis
 * names, the numbered medicines with how to take each (no doses) beside the
 * quantity and the catalog's Đơn vị tính, the prescribing doctor's signature
 * block on the right, then the standing advice and "Khác" — the slip's own
 * advice, or a dotted line for the doctor to write one. The BA's copy has no
 * Tái khám line, so the follow-up date is not printed.
 *
 * Rendered twice by PrescriptionViewDialog — once on screen, once in the
 * off-screen copy that reaches the printer — so it holds no state. Not in the
 * reference (bug list #23); BlueDental's own design.
 */
export function PrescriptionPrintSheet({ patient, patientAddress, prescription }: Props) {
  const age = ageOf(patient.dateOfBirth);
  const birth = [
    patient.dateOfBirth ? formatDate(patient.dateOfBirth) : null,
    age === null ? null : `(${t("Treatment:Rx:PatientAge", age)})`,
  ]
    .filter(Boolean)
    .join(" ");
  const treatment =
    prescription.treatmentType === PRESCRIPTION_TREATMENT_TYPE.Inpatient
      ? t("Treatment:Prescription:Inpatient")
      : t("Treatment:Prescription:Outpatient");

  return (
    <article className="rx-sheet">
      <header className="rx-sheet-head">
        <div className="rx-sheet-clinic">
          <strong>{t("Treatment:RxPrint:ClinicName")}</strong>
          <p>{t("Treatment:RxPrint:Address", t("Treatment:RxPrint:ClinicAddress"))}</p>
          <p>{t("Treatment:RxPrint:Phone", t("Treatment:RxPrint:ClinicPhones"))}</p>
        </div>
        <p className="rx-sheet-code">
          {t("Treatment:RxPrint:Code")}: <strong>{prescription.code}</strong>
        </p>
      </header>

      <h1 className="rx-sheet-title">{t("Treatment:RxPrint:Title")}</h1>

      <div className="rx-sheet-facts">
        <RxSheetFact label={t("Treatment:RxPrint:PatientName")} value={patient.fullName.toUpperCase()} />
        <RxSheetFact label={t("Treatment:RxPrint:PatientCode")} value={patient.code} />
        <RxSheetFact label={t("Treatment:RxPrint:DateOfBirth")} value={birth} />
        <RxSheetFact label={t("Treatment:RxPrint:Gender")} value={patient.genderLabel} />
        <RxSheetFact wide empty="dots" label={t("Treatment:RxPrint:PatientAddress")} value={patientAddress} />
        <RxSheetFact label={t("Treatment:RxPrint:PhoneLabel")} value={patient.phoneNumber ?? ""} />
        <RxSheetFact label={t("Treatment:Prescription:TreatmentType")} value={treatment} />
        <RxSheetFact
          wide
          label={t("Treatment:Diagnosis:Diagnosis")}
          value={printedDiagnosisNames(prescription.diagnoses, prescription.diagnosisText)}
        />
        <RxSheetFact empty="blank" label={t("Treatment:RxPrint:Guardian")} value={patient.guardian?.fullName ?? ""} />
        <RxSheetFact empty="blank" label={t("Treatment:RxPrint:GuardianPhone")} value={patient.guardian?.phone ?? ""} />
      </div>

      <RxSheetMedicines items={prescription.items} />
      <p className="rx-sheet-count">{t("Treatment:RxPrint:Count", prescription.items.length)}</p>

      <footer className="rx-sheet-sign">
        <em>{placedDate(prescription.issuedAt)}</em>
        <span className="rx-sheet-sign-role">{t("Treatment:RxPrint:Doctor")}</span>
        <em>{t("Treatment:RxPrint:SignHint")}</em>
        <strong className="rx-sheet-signer">{printedDoctorName(prescription.staffName, prescription.staffJobTitle) ?? ""}</strong>
      </footer>

      <div className="rx-sheet-advice">
        <p>
          <em>{t("Treatment:RxPrint:Advice")}</em>
          <strong>:</strong> <em>{t("Treatment:RxPrint:Reminder")}</em>
        </p>
        <RxSheetOtherAdvice note={prescription.note} />
      </div>
    </article>
  );
}
