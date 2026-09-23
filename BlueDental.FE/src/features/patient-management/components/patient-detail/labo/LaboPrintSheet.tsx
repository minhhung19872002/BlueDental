import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";
import type { PrintClinic } from "../stage/TreatmentHistoryPrintDialog";
import { dashed, type LaboDetailPatient, type LaboOrderFacts } from "./laboOrderFacts";

interface Props {
  clinic: PrintClinic;
  patient: LaboDetailPatient;
  orderCode: string;
  facts: LaboOrderFacts;
}

/** "Ngày 8 tháng 9 năm 2026", the wording under the sheet's title. */
function longDate(value: Date): string {
  return t(
    "Ngày {0} tháng {1} năm {2}",
    value.getDate(),
    value.getMonth() + 1,
    value.getFullYear(),
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="pd-labo-sheet-row">
      <b>{label}:</b> <span>{dashed(value)}</span>
    </p>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span>{label}:</span> <span>{dashed(value)}</span>
    </p>
  );
}

/**
 * "PHIẾU ĐẶT HÀNG LABO" — the A4 copy behind "In Phiếu Labo". Off-screen until
 * the body wears `pd-printing`, and portaled onto <body> rather than kept
 * inside the modal, for the reason TreatmentHistoryPrintDialog gives. Layout
 * measured on the reference on 2026-09-08 (docs/clone/pages/patient-detail.md).
 */
export function LaboPrintSheet({ clinic, patient, orderCode, facts }: Props) {
  return createPortal(
    <div className="pd-print-sheet">
      <article className="pd-labo-sheet">
        <div className="pd-print-sheethead">
          <section>
            <Fact label={t("Patient:Misc:Clinic")} value={clinic.name} />
            <Fact label={t("Patient:Col:Address")} value={clinic.address ?? ""} />
            <Fact label={t("Patient:Form:Tel")} value={clinic.phone ?? ""} />
            <Fact label={t("Email")} value={clinic.email ?? ""} />
          </section>
          <header>
            <h2>{t("Patient:Labo:OrderTitle")}</h2>
            <p>{longDate(new Date())}</p>
            <p>
              {t("Patient:Misc:Number")}: {orderCode}
            </p>
          </header>
          <section>
            <Fact label={t("Patient:Col:PatientCode")} value={patient.code} />
            <Fact label={t("Patient:Col:Customer")} value={patient.name} />
            <Fact label={t("Patient:Col:DateOfBirth")} value={facts.birthDate} />
            <Fact label={t("Patient:QuoteSheet:PrescribingDoctor")} value={facts.dentist} />
          </section>
        </div>

        <div className="pd-labo-sheet-body">
          <div className="pd-labo-sheet-grid">
            <section>
              <h3>{t("Patient:Labo:OrderInfo")}</h3>
              <Row label={t("Patient:Labo:Supplier")} value={facts.supplier} />
              <Row label={t("Patient:Labo:SentDate")} value={facts.sentAt} />
              <Row label={t("Patient:Labo:ExpectedReceiveDate")} value={facts.dueDate} />
            </section>
            <section>
              <h3>{t("Patient:Labo:CommonParams")}</h3>
              <Row label={t("Patient:Quote:ServiceSelection")} value={facts.laboService} />
              <Row label={t("Patient:Plan:Service")} value={facts.treatmentService} />
              <Row label={t("Patient:Labo:ProsthesisType")} value={facts.laboService} />
            </section>
          </div>

          <h3>{t("Patient:Plan:ProsthesisDetailTitle")}</h3>
          <div className="pd-labo-sheet-grid">
            <section>
              <Row label={t("Patient:Labo:Material")} value={facts.material} />
              <Row label={t("Patient:Viewer:CompletedPath")} value={facts.finishLine} />
              <Row label={t("Patient:DentalChart:Occlusion")} value={facts.bite} />
              <Row label={t("Patient:DentalChart:RhythmType")} value={facts.rhythm} />
            </section>
            <section>
              <Row label={t("Patient:DentalChart:ToothNumber")} value={facts.teeth} />
              <Row label={t("Patient:Viewer:DetailColorLabel")} value={facts.shade} />
              <Row label={t("Patient:Payment:Quantity")} value={facts.quantity} />
              <Row label={t("Patient:QuoteSheet:PrescriptionContent")} value={facts.instruction} />
            </section>
          </div>

          <div className="pd-labo-sheet-sign">
            <div>
              <p>{t("Patient:Labo:Orderer")}</p>
              <p>{t("Patient:QuoteSheet:SignConfirm")}</p>
              <p>{facts.dentist}</p>
            </div>
          </div>
        </div>
      </article>
    </div>,
    document.body,
  );
}
