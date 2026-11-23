import type { BranchInfo } from "@/hooks/useBranchInfo";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { printedDoctorName } from "@/utils/printedDoctorName";
import { PRESCRIPTION_TREATMENT_TYPE, type PrescriptionDto } from "../../api/prescriptionApi";
import type { PrescriptionPatientSummary } from "../../types/prescription";
import { ageOf } from "../../utils/age";
import { printedDiagnosisNames } from "../../utils/rxDiagnosis";
import { RxSheetFact, RxSheetMedicines, RxSheetOtherAdvice } from "./RxSheetParts";

interface Props {
  clinic: BranchInfo | undefined;
  patient: PrescriptionPatientSummary;
  /** The record's address as printed, already resolved ("" when none). */
  patientAddress: string;
  prescription: PrescriptionDto;
}

/**
 * "TP.HCM, Ngày 6 tháng 10 năm 2026" — the date the slip was written, after
 * the place: the last part of the clinic's address, as the BA's "TP HCM" is
 * the last part of theirs. An address without parts gives the date alone.
 */
function placedDate(value: string, clinicAddress: string | null | undefined): string {
  const date = new Date(value);
  const day = t("Patient:Print:LongDate", date.getDate(), date.getMonth() + 1, date.getFullYear());
  const parts = (clinicAddress ?? "").split(",").map((part) => part.trim());
  const place = parts.length > 1 ? parts[parts.length - 1] : "";
  return place ? t("Treatment:RxPrint:PlaceDate", place, day) : day;
}

/** "0799.160.888" — a ten-digit number in the BA's groups; anything else as stored. */
function dottedPhone(phone: string): string {
  return /^\d{10}$/.test(phone) ? `${phone.slice(0, 4)}.${phone.slice(4, 7)}.${phone.slice(7)}` : phone;
}

/** "0799.160.888 – 0767.080.333": the branch's lines, second one when set (R-1300). */
function clinicPhones(clinic: BranchInfo | undefined): string {
  return [clinic?.phone, clinic?.phone2].filter((phone): phone is string => Boolean(phone)).map(dottedPhone).join(" – ");
}

/**
 * "ĐƠN THUỐC" on an A5 page, laid out as the BA's second Word copy
 * (Downloads/Mau-Don-thuoc (1).docx, R-1300): the clinic letterhead and slip
 * code, the patient with address and guardian, the diagnosis names, the
 * numbered medicines with how to take each, the prescribing doctor's signature
 * block on the right, then the standing advice and "Khác" — the slip's own
 * advice, or a dotted line for the doctor to write one. The BA's copy has no
 * Tái khám line, so the follow-up date is not printed.
 *
 * Rendered twice by PrescriptionViewDialog — once on screen, once in the
 * off-screen copy that reaches the printer — so it holds no state. Not in the
 * reference (bug list #23); BlueDental's own design.
 */
export function PrescriptionPrintSheet({ clinic, patient, patientAddress, prescription }: Props) {
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
  const phones = clinicPhones(clinic);

  return (
    <article className="rx-sheet">
      <header className="rx-sheet-head">
        <div className="rx-sheet-clinic">
          <strong>{clinic?.name ?? ""}</strong>
          {clinic?.address && <p>{t("Treatment:RxPrint:Address", clinic.address)}</p>}
          {phones && <p>{t("Treatment:RxPrint:Phone", phones)}</p>}
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
        <em>{placedDate(prescription.issuedAt, clinic?.address)}</em>
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
