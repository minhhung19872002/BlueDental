import { useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { DiagnosisGroupBlock } from "./DiagnosisGroupBlock";
import {
  groupByDiagnosis,
  lineTotal,
  money,
  romanNumeral,
  rowDiscount,
  type QuoteClinic,
  type QuoteCustomer,
  type QuoteImage,
  type QuoteRow,
  type QuoteTotals,
} from "./quoteModel";
import { QuoteSignatures } from "./QuoteSignatures";

export interface DiagnosisInvoiceSheetProps {
  clinic: QuoteClinic;
  customer: QuoteCustomer;
  rows: QuoteRow[];
  totals: QuoteTotals;
  images: QuoteImage[];
}

const dash = (value: string) => value || "-";

/**
 * "PHIẾU CHẨN ĐOÁN & HÓA ĐƠN" — the sheet "In hóa đơn kèm chẩn đoán" prints:
 * the ticked images, one section per diagnosis with its doctors' write-ups,
 * then the quoted services, and the reference's signature strip — "Bác sĩ
 * chẩn đoán" and "Khách hàng", the name printed above "(Ký, họ tên)". An
 * earlier pass recorded that it printed none, which the owner's copy corrected.
 * Explanations edited here stay here for the life of the preview.
 */
export function DiagnosisInvoiceSheet({
  clinic,
  customer,
  rows,
  totals,
  images,
}: DiagnosisInvoiceSheetProps) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const groups = useMemo(
    () =>
      groupByDiagnosis(rows).map((group) => ({
        ...group,
        doctors: group.doctors.map((item) => ({
          ...item,
          explanationHtml: edits[item.key] ?? item.explanationHtml,
        })),
      })),
    [rows, edits],
  );
  const firstNumber = images.length > 0 ? 2 : 1;

  // The sheet is signed by the doctor who made the diagnosis. Several rows can
  // name the same doctor, and a slip occasionally names two, so the distinct
  // names are joined rather than the first one taken.
  const diagnosingDoctor = useMemo(
    () => [...new Set(rows.flatMap((row) => row.doctors).filter(Boolean))].join(", "),
    [rows],
  );

  // Typed over, the edit stands for the life of the preview. Held as "not yet
  // edited" rather than seeded through an effect: an effect keyed on the rows
  // would wipe what the user typed the moment anything above re-rendered.
  const [signedBy, setSignedBy] = useState<string | null>(null);

  return (
    <div className="pq-dx">
      <div className="pq-dx__header">
        <div className="pq-dx__branch">
          {clinic.logoUrl && <img className="pq-dx__logo" src={clinic.logoUrl} alt="" />}
          <div>
            <p>
              <strong>{t("Patient:QuoteSheet:Clinic")}:</strong> {dash(clinic.name)}
            </p>
            <p>{t("Patient:DiagnosisInvoice:Address", dash(clinic.address))}</p>
            <p>{t("Patient:DiagnosisInvoice:Tel", dash(clinic.phone))}</p>
          </div>
        </div>
        <div className="pq-dx__title">
          <h1>{t("Patient:Diagnosis:SlipAndInvoice")}</h1>
          <p>{t("Patient:QuoteSheet:DentalClinic")}</p>
          <p className="pq-dx__date">{t("Patient:DiagnosisInvoice:Date", formatDate(new Date()))}</p>
        </div>
        <div className="pq-dx__customer">
          <p>{t("Patient:DiagnosisInvoice:Code", dash(customer.code))}</p>
          <p>{t("Patient:DiagnosisInvoice:Name", dash(customer.name))}</p>
          <p>{t("Patient:DiagnosisInvoice:Dob", customer.dateOfBirth)}</p>
          <p>{t("Patient:DiagnosisInvoice:Phone", dash(customer.phone))}</p>
        </div>
      </div>

      {images.length > 0 && (
        <section>
          <div className="pq-dx__section">
            <h2>I. {t("Patient:Diagnosis:ImagesLabel")}</h2>
          </div>
          <div className="pq-dx__image-grid">
            {images.map((image) => (
              <div key={image.id} className="pq-dx__image-frame">
                <img src={image.src} alt={image.alt} />
              </div>
            ))}
          </div>
        </section>
      )}

      {groups.map((group, index) => (
        <DiagnosisGroupBlock
          key={group.name}
          numeral={romanNumeral(firstNumber + index)}
          group={group}
          customerName={customer.name}
          onChangeExplanation={(key, html) => setEdits((prev) => ({ ...prev, [key]: html }))}
        />
      ))}

      <section className="pq-dx__services">
        <p className="pq-dx__services-title">{t("Patient:Quote:ServiceListTitle")}</p>
        <table className="pq-dx__table">
          <thead>
            <tr>
              <th>{t("Patient:Misc:ServiceLabel")}</th>
              <th>{t("Patient:Tab:Diagnosis")}</th>
              <th>{t("Patient:Payment:UnitPrice")}</th>
              <th>{t("Patient:Payment:Discount")}</th>
              <th>{t("Patient:Payment:Amount")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.service}</td>
                <td className="pq-sheet__diagnosis">
                  {[row.teeth, row.diagnosis || "-"].filter(Boolean).join(" - ")}
                </td>
                <td>{t("{0} (SL. {1})", money(row.unitPrice), row.quantity)}</td>
                <td>{money(rowDiscount(row))}</td>
                <td>{money(lineTotal(row))}</td>
              </tr>
            ))}
            <SummaryRows totals={totals} />
          </tbody>
        </table>
      </section>

      <QuoteSignatures
        layout="name-first"
        caption={t("Patient:QuoteSheet:SignName")}
        leftLabel={t("Patient:Diagnosis:Doctor")}
        leftName={signedBy ?? diagnosingDoctor}
        onLeftNameChange={setSignedBy}
        rightLabel={t("Patient:Col:Customer")}
        rightName={dash(customer.name)}
      />
    </div>
  );
}

function SummaryRows({ totals }: { totals: QuoteTotals }) {
  const span = totals.extra > 0 ? 4 : 3;
  return (
    <>
      <tr>
        <td colSpan={3} rowSpan={span} className="pq-sheet__summary-empty" />
        <td className="pq-sheet__summary-label">{t("Patient:QuoteSheet:GrandTotal")}</td>
        <td className="pq-sheet__summary-value">{money(totals.gross)}</td>
      </tr>
      <tr>
        <td className="pq-sheet__summary-label">{t("Patient:QuoteSheet:Discount")}</td>
        <td className="pq-sheet__summary-value pq-sheet__summary-value--discount">
          {totals.discount > 0 ? `-${money(totals.discount)}` : money(0)}
        </td>
      </tr>
      {totals.extra > 0 && (
        <tr>
          <td className="pq-sheet__summary-label">{t("Patient:QuoteSheet:DoctorDiscount")}</td>
          <td className="pq-sheet__summary-value pq-sheet__summary-value--discount">
            -{money(totals.extra)}
          </td>
        </tr>
      )}
      <tr className="pq-sheet__summary-row--total">
        <td className="pq-sheet__summary-label pq-sheet__summary-label--total">
          {t("Patient:QuoteSheet:Total")}
        </td>
        <td className="pq-sheet__summary-value pq-sheet__summary-value--total">
          {money(totals.net)}
        </td>
      </tr>
    </>
  );
}
