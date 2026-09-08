import { t } from "@/lib/i18n";
import { money, type QuoteClinic, type QuoteCustomer, type QuoteTotals } from "./quoteModel";

const dash = (value: string) => value || "-";

/** The two fact columns at the top of Chi tiết phiếu. */
export function QuoteFacts({ clinic, customer }: { clinic: QuoteClinic; customer: QuoteCustomer }) {
  return (
    <div className="pq-facts">
      <section>
        <h3 className="pq-section-title">{t("THÔNG TIN CHI NHÁNH")}</h3>
        <div className="pq-fact-list">
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
      </section>
      <section>
        <h3 className="pq-section-title">{t("THÔNG TIN KHÁCH HÀNG")}</h3>
        <div className="pq-fact-list">
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
      </section>
    </div>
  );
}

/** The right-aligned "TỔNG TIỀN:" block under the service table. */
export function QuoteTotalsBlock({ totals }: { totals: QuoteTotals }) {
  return (
    <div className="pq-totals">
      <h3 className="pq-totals-title">{t("TỔNG TIỀN:")}</h3>
      <p className="pq-totals-row">
        <span>{t("Giá dịch vụ:")}</span>
        <strong>{money(totals.gross)}</strong>
      </p>
      <p className="pq-totals-row">
        <span>{t("Giảm giá dịch vụ:")}</span>
        <strong>{money(totals.discount)}</strong>
      </p>
      <p className="pq-totals-row">
        <span>{t("Giảm giá bác sĩ:")}</span>
        <strong>{money(totals.extra)}</strong>
      </p>
      <p className="pq-totals-row">
        <span>{t("Báo giá:")}</span>
        <strong>{money(totals.net)}</strong>
      </p>
    </div>
  );
}
