import { t } from "@/lib/i18n";
import { formatDateTime, formatMoneyUnit, formatDate } from "@/utils/format";
import type { CustomerPanel } from "../../api/inboxApi";

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="ibx-line">
      <dt>{label}</dt>
      <dd className={strong ? "ibx-line-strong" : undefined}>{value || "—"}</dd>
    </div>
  );
}

/** Lịch hẹn · Dịch vụ đang điều trị · Công nợ of the linked record, in this branch (BA mock). */
export function CustomerSections({ customer }: { customer: CustomerPanel }) {
  return (
    <>
      <section className="ibx-side-block">
        <h4 className="ibx-side-title">{t("CSKH:Inbox:Panel:Appointments")}</h4>
        <dl className="ibx-lines">
          <Line label={t("CSKH:Inbox:Panel:Next")} value={formatDateTime(customer.nextAppointmentAt)} strong />
          <Line label={t("CSKH:Inbox:Panel:LastVisit")} value={formatDate(customer.lastVisitAt)} />
        </dl>
      </section>
      <section className="ibx-side-block">
        <h4 className="ibx-side-title">{t("CSKH:Inbox:Panel:Services")}</h4>
        <p className="ibx-side-text">
          {customer.activeServices.length > 0 ? customer.activeServices.join(", ") : t("CSKH:Inbox:Panel:NoService")}
        </p>
        {customer.dentistName && (
          <dl className="ibx-lines">
            <Line label={t("CSKH:Inbox:Panel:Dentist")} value={customer.dentistName} />
          </dl>
        )}
      </section>
      {customer.seesMoney && (
        <section className="ibx-side-block">
          <h4 className="ibx-side-title">{t("CSKH:Inbox:Panel:Debt")}</h4>
          <dl className="ibx-lines">
            <Line label={t("CSKH:Inbox:Panel:Total")} value={formatMoneyUnit(customer.totalAmount)} />
            <Line label={t("CSKH:Inbox:Panel:Paid")} value={formatMoneyUnit(customer.paidAmount)} />
            <Line label={t("CSKH:Inbox:Panel:Due")} value={formatMoneyUnit(customer.dueAmount)} strong />
          </dl>
        </section>
      )}
    </>
  );
}
