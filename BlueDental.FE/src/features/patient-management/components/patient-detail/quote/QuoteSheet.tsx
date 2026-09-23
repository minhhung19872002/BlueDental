import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import {
  diagnosisLabel,
  lineTotal,
  money,
  rowDiscount,
  type QuoteClinic,
  type QuoteCustomer,
  type QuoteRow,
  type QuoteTotals,
} from "./quoteModel";
import { QuoteSignatures } from "./QuoteSignatures";

export interface QuoteSheetProps {
  clinic: QuoteClinic;
  customer: QuoteCustomer;
  rows: QuoteRow[];
  totals: QuoteTotals;
}

const dash = (value: string) => value || "-";

/**
 * Who signs the left-hand column. The reference prints the desk that raised the
 * slip rather than a person — the same wording whoever is logged in.
 */
const PREPARER = "Thu Ngân / Bác Sĩ";

/**
 * "PHIẾU BÁO GIÁ" — the sheet "In Hoá Đơn" prints.
 *
 * It ends on the reference's signature strip: "Người lập phiếu" and "Khách
 * hàng", each captioned "(Ký, ghi rõ họ tên)" with the signing space above the
 * printed name. An earlier pass recorded that the reference printed none, which
 * the project owner's own copy of the sheet corrected.
 */
export function QuoteSheet({ clinic, customer, rows, totals }: QuoteSheetProps) {
  const summarySpan = totals.extra > 0 ? 4 : 3;
  return (
    <div className="pq-sheet">
      <div className="pq-sheet__header">
        <div className="pq-sheet__branch">
          {clinic.logoUrl && <img className="pq-sheet__logo" src={clinic.logoUrl} alt="" />}
          <div>
            <p className="pq-sheet__section-label">{t("Patient:QuoteSheet:BranchInfoTitle")}</p>
            <p>
              <strong>{t("Patient:Misc:Clinic")}:</strong> {dash(clinic.name)}
            </p>
            <p>
              <strong>{t("Patient:Col:Address")}:</strong> {dash(clinic.address)}
            </p>
            <p>
              <strong>{t("Patient:Form:Tel")}:</strong> {dash(clinic.phone)}
            </p>
            <p>
              <strong>{t("Email")}:</strong> {dash(clinic.email)}
            </p>
          </div>
        </div>
        <div className="pq-sheet__customer">
          <p className="pq-sheet__section-label">{t("Patient:QuoteSheet:CustomerInfoTitle")}</p>
          <p>
            <strong>{t("Patient:Col:PatientCode")}:</strong> {dash(customer.code)}
          </p>
          <p>
            <strong>{t("Patient:Col:FullName")}:</strong> {dash(customer.name)}
          </p>
          <p>
            <strong>{t("Patient:Form:ShortPhone")}:</strong> {dash(customer.phone)}
          </p>
          <p>
            <strong>{t("Patient:Col:Address")}:</strong> {dash(customer.address)}
          </p>
        </div>
      </div>

      <h2 className="pq-sheet__title">{t("Patient:Quote:SlipTitle")}</h2>
      <div className="pq-sheet__meta">
        <p className="pq-sheet__meta-right">{t("Patient:DiagnosisInvoice:Date", formatDate(new Date()))}</p>
      </div>

      <p className="pq-sheet__table-title">{t("Patient:Quote:ServiceListTitle")}</p>
      <table>
        <thead>
          <tr>
            <th>{t("Patient:Misc:Service")}</th>
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
              <td className="pq-sheet__diagnosis">{diagnosisLabel(row)}</td>
              <td>{t("{0} (SL. {1})", money(row.unitPrice), row.quantity)}</td>
              <td>{money(rowDiscount(row))}</td>
              <td>{money(lineTotal(row))}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} rowSpan={summarySpan} className="pq-sheet__summary-empty" />
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
        </tbody>
      </table>

      <QuoteSignatures
        layout="caption-first"
        caption={t("Patient:QuoteSheet:SignFullName")}
        leftLabel={t("Patient:QuoteSheet:Creator")}
        leftName={PREPARER}
        rightLabel={t("Patient:Col:Customer")}
        rightName={dash(customer.name)}
      />
    </div>
  );
}
