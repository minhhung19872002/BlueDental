import { t } from "@/lib/i18n";
import { money, type QuoteClinic, type QuoteCustomer, type QuoteTotals } from "./quoteModel";

const dash = (value: string) => value || "-";

/** The two fact columns at the top of Chi tiết phiếu. */
export function QuoteFacts({ clinic, customer }: { clinic: QuoteClinic; customer: QuoteCustomer }) {
  return (
    <div className="pq-facts">
      <section>
        <h3 className="pq-section-title">{t("Patient:QuoteSheet:BranchInfoTitle")}</h3>
        <div className="pq-fact-list">
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
      <section>
        <h3 className="pq-section-title">{t("Patient:QuoteSheet:CustomerInfoTitle")}</h3>
        <div className="pq-fact-list">
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
      </section>
    </div>
  );
}

/** The right-aligned "TỔNG TIỀN:" block under the service table. */
export function QuoteTotalsBlock({ totals }: { totals: QuoteTotals }) {
  return (
    <div className="pq-totals">
      <h3 className="pq-totals-title">{t("Patient:QuoteSheet:GrandTotal")}</h3>
      <p className="pq-totals-row">
        <span>{t("Patient:Payment:ServicePriceLabel")}</span>
        <strong>{money(totals.gross)}</strong>
      </p>
      <p className="pq-totals-row">
        <span>{t("Patient:Payment:ServiceDiscountLabel")}</span>
        <strong>{money(totals.discount)}</strong>
      </p>
      <p className="pq-totals-row">
        <span>{t("Patient:Payment:DoctorDiscountLabel")}</span>
        <strong>{money(totals.extra)}</strong>
      </p>
      <p className="pq-totals-row">
        <span>{t("Patient:Quote:Label")}</span>
        <strong>{money(totals.net)}</strong>
      </p>
    </div>
  );
}
