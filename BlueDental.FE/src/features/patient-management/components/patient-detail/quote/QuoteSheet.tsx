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

export interface QuoteSheetProps {
  clinic: QuoteClinic;
  customer: QuoteCustomer;
  rows: QuoteRow[];
  totals: QuoteTotals;
}

const dash = (value: string) => value || "-";

/** "PHIẾU BÁO GIÁ" — the sheet "In Hoá Đơn" prints. No signature strip: the reference prints none. */
export function QuoteSheet({ clinic, customer, rows, totals }: QuoteSheetProps) {
  const summarySpan = totals.extra > 0 ? 4 : 3;
  return (
    <div className="pq-sheet">
      <div className="pq-sheet__header">
        <div className="pq-sheet__branch">
          {clinic.logoUrl && <img className="pq-sheet__logo" src={clinic.logoUrl} alt="" />}
          <div>
            <p className="pq-sheet__section-label">{t("THÔNG TIN CHI NHÁNH")}</p>
            <p>
              <strong>{t("Phòng khám")}:</strong> {dash(clinic.name)}
            </p>
            <p>
              <strong>{t("Địa chỉ")}:</strong> {dash(clinic.address)}
            </p>
            <p>
              <strong>{t("ĐT")}:</strong> {dash(clinic.phone)}
            </p>
            <p>
              <strong>{t("Email")}:</strong> {dash(clinic.email)}
            </p>
          </div>
        </div>
        <div className="pq-sheet__customer">
          <p className="pq-sheet__section-label">{t("THÔNG TIN KHÁCH HÀNG")}</p>
          <p>
            <strong>{t("Mã KH")}:</strong> {dash(customer.code)}
          </p>
          <p>
            <strong>{t("Họ và tên")}:</strong> {dash(customer.name)}
          </p>
          <p>
            <strong>{t("SĐT")}:</strong> {dash(customer.phone)}
          </p>
          <p>
            <strong>{t("Địa chỉ")}:</strong> {dash(customer.address)}
          </p>
        </div>
      </div>

      <h2 className="pq-sheet__title">{t("PHIẾU BÁO GIÁ")}</h2>
      <div className="pq-sheet__meta">
        <p className="pq-sheet__meta-right">{t("Ngày: {0}", formatDate(new Date()))}</p>
      </div>

      <p className="pq-sheet__table-title">{t("DANH SÁCH DỊCH VỤ BÁO GIÁ")}</p>
      <table>
        <thead>
          <tr>
            <th>{t("Dịch vụ")}</th>
            <th>{t("Chẩn đoán")}</th>
            <th>{t("Đơn giá")}</th>
            <th>{t("Giảm giá")}</th>
            <th>{t("Thành tiền")}</th>
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
            <td className="pq-sheet__summary-label">{t("TỔNG TIỀN:")}</td>
            <td className="pq-sheet__summary-value">{money(totals.gross)}</td>
          </tr>
          <tr>
            <td className="pq-sheet__summary-label">{t("GIẢM GIÁ:")}</td>
            <td className="pq-sheet__summary-value pq-sheet__summary-value--discount">
              {totals.discount > 0 ? `-${money(totals.discount)}` : money(0)}
            </td>
          </tr>
          {totals.extra > 0 && (
            <tr>
              <td className="pq-sheet__summary-label">{t("GIẢM GIÁ BÁC SĨ:")}</td>
              <td className="pq-sheet__summary-value pq-sheet__summary-value--discount">
                -{money(totals.extra)}
              </td>
            </tr>
          )}
          <tr className="pq-sheet__summary-row--total">
            <td className="pq-sheet__summary-label pq-sheet__summary-label--total">
              {t("THÀNH TIỀN:")}
            </td>
            <td className="pq-sheet__summary-value pq-sheet__summary-value--total">
              {money(totals.net)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
