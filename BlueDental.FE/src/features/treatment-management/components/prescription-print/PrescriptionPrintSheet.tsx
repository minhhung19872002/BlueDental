import { usageLabel } from "@/components/prescription-lines";
import type { BranchInfo } from "@/hooks/useBranchInfo";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import {
  PRESCRIPTION_TREATMENT_TYPE,
  type PrescriptionDto,
  type PrescriptionItemDto,
} from "../../api/prescriptionApi";
import type { PrescriptionPatientSummary } from "../../types/prescription";
import { ageOf } from "../../utils/age";

interface Props {
  clinic: BranchInfo | undefined;
  patient: PrescriptionPatientSummary;
  prescription: PrescriptionDto;
}

/** "Ngày uống 2 lần, mỗi lần 1, trong 5 ngày · Sau khi ăn". */
function directionsOf(item: PrescriptionItemDto): string {
  const dose = t("Treatment:RxPrint:Dosage", item.timesPerDay, item.amountPerTime, item.days);
  const usage = item.usage === 0 ? null : usageLabel(item);
  return usage ? `${dose} · ${usage}` : dose;
}

/** "Ngày 6 tháng 10 năm 2026" — the date the slip was written. */
function longDate(value: string): string {
  const date = new Date(value);
  return t("Patient:Print:LongDate", date.getDate(), date.getMonth() + 1, date.getFullYear());
}

function Fact({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <p className={wide ? "rx-sheet-fact rx-sheet-fact--wide" : "rx-sheet-fact"}>
      <span>{label}:</span> <strong>{value || "—"}</strong>
    </p>
  );
}

/**
 * "ĐƠN THUỐC" — one slip laid out as a Vietnamese outpatient prescription:
 * clinic letterhead and slip code, the patient, the diagnosis, the numbered
 * medicines with how to take each, the advice, the follow-up date and the
 * prescribing doctor's signature block.
 *
 * Rendered twice by PrescriptionViewDialog — once on screen, once in the
 * off-screen copy that reaches the printer — so it holds no state. Not in the
 * reference (bug list #23); BlueDental's own design.
 */
export function PrescriptionPrintSheet({ clinic, patient, prescription }: Props) {
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
          <strong>{clinic?.name ?? ""}</strong>
          {clinic?.address && <p>{t("Treatment:RxPrint:Address", clinic.address)}</p>}
          {clinic?.phone && <p>{t("Treatment:RxPrint:Phone", clinic.phone)}</p>}
        </div>
        <p className="rx-sheet-code">
          {t("Treatment:RxPrint:Code")}: <strong>{prescription.code}</strong>
        </p>
      </header>

      <h1 className="rx-sheet-title">{t("Treatment:RxPrint:Title")}</h1>

      <div className="rx-sheet-facts">
        <Fact label={t("Treatment:RxPrint:PatientName")} value={patient.fullName.toUpperCase()} />
        <Fact label={t("Treatment:RxPrint:PatientCode")} value={patient.code} />
        <Fact label={t("Treatment:RxPrint:DateOfBirth")} value={birth} />
        <Fact label={t("Treatment:RxPrint:Gender")} value={patient.genderLabel} />
        <Fact label={t("Treatment:RxPrint:PhoneLabel")} value={patient.phoneNumber ?? ""} />
        <Fact label={t("Treatment:Prescription:TreatmentType")} value={treatment} />
        <Fact wide label={t("Treatment:Diagnosis:Diagnosis")} value={prescription.diagnosisText ?? ""} />
      </div>

      <table className="rx-sheet-table">
        <thead>
          <tr>
            <th className="rx-sheet-no">{t("Treatment:RxPrint:No")}</th>
            <th>{t("Treatment:RxPrint:Medicine")}</th>
            <th className="rx-sheet-qty">{t("Common:Rx:Quantity")}</th>
          </tr>
        </thead>
        <tbody>
          {prescription.items.map((item, index) => (
            <tr key={item.id}>
              <td className="rx-sheet-no">{index + 1}</td>
              <td>
                <strong>{item.medicationName}</strong>
                <em>{directionsOf(item)}</em>
              </td>
              <td className="rx-sheet-qty">{item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="rx-sheet-count">{t("Treatment:RxPrint:Count", prescription.items.length)}</p>

      <div className="rx-sheet-advice">
        <p className="rx-sheet-note">
          <strong>{t("Treatment:RxPrint:Advice")}:</strong> {prescription.note || "—"}
        </p>
        <p>
          <strong>{t("Treatment:Prescription:TypeRecheck")}:</strong>{" "}
          {prescription.followUpDate ? formatDate(prescription.followUpDate) : "—"}
        </p>
      </div>

      <footer className="rx-sheet-foot">
        <p className="rx-sheet-reminder">{t("Treatment:RxPrint:Reminder")}</p>
        <div className="rx-sheet-sign">
          <em>{longDate(prescription.issuedAt)}</em>
          <strong>{t("Treatment:RxPrint:Doctor")}</strong>
          <em>{t("Treatment:RxPrint:SignHint")}</em>
          <strong className="rx-sheet-signer">{prescription.staffName ?? ""}</strong>
        </div>
      </footer>
    </article>
  );
}
