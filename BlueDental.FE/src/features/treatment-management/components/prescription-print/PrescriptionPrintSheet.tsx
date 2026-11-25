import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { printedDoctorName } from "@/utils/printedDoctorName";
import type { PrescriptionDto } from "../../api/prescriptionApi";
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
 * (Downloads/Mau-Don-thuoc (2).docx, R-1302; A5 before) as the BA marked it
 * up on 2026-11-25 (R-1317): the clinic letterhead — fixed text by the BA's
 * call, not the branch's data (R-1301) — with the slip and patient codes on
 * its right; Giới tính and Điện thoại beside the name and birth date, the
 * address (two dotted lines when none), the diagnosis names (a dotted line
 * when none), the guardian, and no Điều trị line. The numbered medicines with
 * how to take each (no doses), the quantity and the catalog's Đơn vị tính
 * against the right margin. Then the standing advice and "Khác" — the slip's
 * own advice, or a dotted line for the doctor to write one — on the left
 * beside the doctor's signature block, "Khác" level with the doctor's name.
 * The BA's copy has no Tái khám line, so the follow-up date is not printed.
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

  return (
    <article className="rx-sheet">
      <header className="rx-sheet-head">
        <div className="rx-sheet-clinic">
          <strong>{t("Treatment:RxPrint:ClinicName")}</strong>
          <p className="rx-sheet-clinic-address">
            {t("Treatment:RxPrint:Address", t("Treatment:RxPrint:ClinicAddress"))}
          </p>
          <p>{t("Treatment:RxPrint:Phone", t("Treatment:RxPrint:ClinicPhones"))}</p>
        </div>
        <div className="rx-sheet-code">
          <p>
            {t("Treatment:RxPrint:Code")}: <strong>{prescription.code}</strong>
          </p>
          <p>
            {t("Treatment:RxPrint:PatientCode")}: <strong>{patient.code}</strong>
          </p>
        </div>
      </header>

      <h1 className="rx-sheet-title">{t("Treatment:RxPrint:Title")}</h1>

      <div className="rx-sheet-facts">
        <RxSheetFact label={t("Treatment:RxPrint:PatientName")} value={patient.fullName.toUpperCase()} />
        <RxSheetFact label={t("Treatment:RxPrint:Gender")} value={patient.genderLabel} />
        <RxSheetFact label={t("Treatment:RxPrint:DateOfBirth")} value={birth} />
        <RxSheetFact label={t("Treatment:RxPrint:PhoneLabel")} value={patient.phoneNumber ?? ""} />
        <RxSheetFact
          wide
          empty="dots"
          dotLines={2}
          label={t("Treatment:RxPrint:PatientAddress")}
          value={patientAddress}
        />
        <RxSheetFact
          wide
          empty="dots"
          label={t("Treatment:Diagnosis:Diagnosis")}
          value={printedDiagnosisNames(prescription.diagnoses, prescription.diagnosisText)}
        />
        <RxSheetFact empty="blank" label={t("Treatment:RxPrint:Guardian")} value={patient.guardian?.fullName ?? ""} />
        <RxSheetFact empty="blank" label={t("Treatment:RxPrint:GuardianPhone")} value={patient.guardian?.phone ?? ""} />
      </div>

      <RxSheetMedicines items={prescription.items} />
      <p className="rx-sheet-count">{t("Treatment:RxPrint:Count", prescription.items.length)}</p>

      <footer className="rx-sheet-foot">
        <div className="rx-sheet-advice">
          <p>
            <em>{t("Treatment:RxPrint:Advice")}</em>
            <strong>:</strong> <em>{t("Treatment:RxPrint:Reminder")}</em>
          </p>
          <RxSheetOtherAdvice note={prescription.note} />
        </div>
        <div className="rx-sheet-sign">
          <em>{placedDate(prescription.issuedAt)}</em>
          <span className="rx-sheet-sign-role">{t("Treatment:RxPrint:Doctor")}</span>
          <em>{t("Treatment:RxPrint:SignHint")}</em>
          <strong className="rx-sheet-signer">
            {printedDoctorName(prescription.staffName, prescription.staffJobTitle) ?? ""}
          </strong>
        </div>
      </footer>
    </article>
  );
}
