import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import {
  lineTotal,
  money,
  rowDiscount,
  type QuoteClinic,
  type QuoteCustomer,
  type QuoteRow,
  type QuoteTotals,
  sheetLabel,
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
const PREPARER_KEY = "Patient:Quote:Preparer";

/**
 * "PHIẾU BÁO GIÁ" — the sheet "In Hoá Đơn" prints.
 *
 * R-1334: the branch block takes the full width with the customer block
 * stacked under it, one fact per line (R-1337: the branch facts under no
 * heading of their own; the customer's Địa chỉ with its ward and province);
 * the table reads Dịch vụ | Số lượng |
 * Đơn giá | Giảm giá | Thành tiền, and each summary label spans Đơn giá +
 * Giảm giá so the figures never wrap. Body type is 16px like the hồ sơ forms.
 *
 * It ends on the reference's signature strip: "Người lập phiếu" and "Khách
 * hàng", each captioned "(Ký, ghi rõ họ tên)" with the signing space above the
 * printed name.
 */
export function QuoteSheet({ clinic, customer, rows, totals }: QuoteSheetProps) {
  const summarySpan = totals.extra > 0 ? 4 : 3;
  return (
    <div className="pq-sheet">
      <div className="pq-sheet__header">
        <section className="pq-sheet__branch">
          {clinic.logoUrl && <img className="pq-sheet__logo" src={clinic.logoUrl} alt="" />}
          <div>
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
        </section>
        <section className="pq-sheet__customer">
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
        </section>
      </div>

      <h2 className="pq-sheet__title">{t("Patient:Quote:SlipTitle")}</h2>
      <div className="pq-sheet__meta">
        <p className="pq-sheet__meta-right">{t("Patient:DiagnosisInvoice:Date", formatDate(new Date()))}</p>
      </div>

      <p className="pq-sheet__table-title">{t("Patient:Quote:ServiceListTitle")}</p>
      <table>
        <colgroup>
          <col className="pq-sheet__col-service" />
          <col className="pq-sheet__col-quantity" />
          <col className="pq-sheet__col-money" />
          <col className="pq-sheet__col-money" />
          <col className="pq-sheet__col-money" />
        </colgroup>
        <thead>
          <tr>
            <th>{t("Patient:Misc:ServiceLabel")}</th>
            <th className="pq-sheet__num">{t("Patient:Payment:Quantity")}</th>
            <th>{t("Patient:Payment:UnitPrice")}</th>
            <th>{t("Patient:Payment:Discount")}</th>
            <th>{t("Patient:Payment:Amount")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.service}</td>
              <td className="pq-sheet__num">{row.quantity}</td>
              <td>{money(row.unitPrice)}</td>
              <td>{money(rowDiscount(row))}</td>
              <td>{money(lineTotal(row))}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2} rowSpan={summarySpan} className="pq-sheet__summary-empty" />
            <td colSpan={2} className="pq-sheet__summary-label">
              {sheetLabel("Patient:PlanTotals:Subtotal")}
            </td>
            <td className="pq-sheet__summary-value">{money(totals.gross)}</td>
          </tr>
          <tr>
            <td colSpan={2} className="pq-sheet__summary-label">
              {sheetLabel("Patient:PlanTotals:Discount")}
            </td>
            <td className="pq-sheet__summary-value pq-sheet__summary-value--discount">
              {totals.discount > 0 ? `-${money(totals.discount)}` : money(0)}
            </td>
          </tr>
          {totals.extra > 0 && (
            <tr>
              <td colSpan={2} className="pq-sheet__summary-label">
                {sheetLabel("Patient:PlanTotals:Voucher")}
              </td>
              <td className="pq-sheet__summary-value pq-sheet__summary-value--discount">
                -{money(totals.extra)}
              </td>
            </tr>
          )}
          <tr className="pq-sheet__summary-row--total">
            <td colSpan={2} className="pq-sheet__summary-label pq-sheet__summary-label--total">
              {sheetLabel("Patient:PlanTotals:Net")}
            </td>
            <td className="pq-sheet__summary-value pq-sheet__summary-value--total">
              {money(totals.net)}
            </td>
          </tr>
        </tbody>
      </table>

      <QuoteSignatures
        caption={t("Patient:QuoteSheet:SignFullName")}
        leftLabel={t("Patient:QuoteSheet:Creator")}
        leftName={t(PREPARER_KEY)}
        rightLabel={t("Patient:Col:Customer")}
        rightName={dash(customer.name)}
      />
    </div>
  );
}
