import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { formatDash, formatDateTime, formatMoneyUnit } from "@/utils/format";
import type { InvoiceRequestDto } from "../../../api/invoiceRequestApi";
import { InvoiceRequestStatusTag } from "./InvoiceRequestStatusTag";

function SheetRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ir-sheet__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** A line the customer fills in by pen on the printed sheet. */
function HandwrittenRow({ label, unit }: { label: string; unit: string }) {
  return (
    <div className="ir-sheet__row ir-sheet__row--blank">
      <dt>{label}</dt>
      <dd>
        <span className="ir-sheet__line" />
        <span className="ir-sheet__unit">{unit}</span>
      </dd>
    </div>
  );
}

function paperLabel(value: boolean | null): string {
  if (value === null) return "—";
  return t(value ? "Common:Yes" : "Common:No");
}

interface Props {
  request: InvoiceRequestDto;
}

/** THÔNG TIN XUẤT HÓA ĐƠN — what the detail dialog shows and prints. */
export function InvoiceRequestSheet({ request }: Props) {
  const field = (key: string) => t(`Patient:InvoiceRequest:Field:${key}`);
  return (
    <section className="ir-sheet">
      <header className="ir-sheet__head">
        <h2 className="ir-sheet__title">{t("Patient:InvoiceRequest:SheetTitle")}</h2>
        <p className="ir-sheet__meta">
          {request.code} · {formatDateTime(request.requestedAt)}
        </p>
      </header>

      <dl className="ir-sheet__grid">
        <SheetRow label={field("Receipt")}>{request.paymentCode}</SheetRow>
        <SheetRow label={field("Service")}>{formatDash(request.serviceName)}</SheetRow>
        <SheetRow label={field("Amount")}>{formatMoneyUnit(request.amount)}</SheetRow>
        <SheetRow label={t("Patient:InvoiceRequest:Col:Status")}>
          <InvoiceRequestStatusTag status={request.status} />
        </SheetRow>
        {request.invoiceNo && <SheetRow label={field("InvoiceNo")}>{request.invoiceNo}</SheetRow>}
        {request.reason && <SheetRow label={field("Reason")}>{request.reason}</SheetRow>}
      </dl>

      <h3 className="ir-sheet__section">{t("Patient:InvoiceRequest:Section:Customer")}</h3>
      <dl className="ir-sheet__grid">
        <SheetRow label={field("FullName")}>{request.fullName}</SheetRow>
        <SheetRow label={field("BirthYear")}>{formatDash(request.birthYear)}</SheetRow>
        <HandwrittenRow label={field("Weight")} unit="kg" />
        <HandwrittenRow label={field("Height")} unit="cm" />
        <SheetRow label={field("Phone")}>{request.phone}</SheetRow>
        <SheetRow label={field("NationalId")}>{formatDash(request.nationalId)}</SheetRow>
        <SheetRow label={field("PersonalAddress")}>{formatDash(request.personalAddress)}</SheetRow>
      </dl>

      <h3 className="ir-sheet__section">{t("Patient:InvoiceRequest:Section:Invoice")}</h3>
      <dl className="ir-sheet__grid">
        <SheetRow label={field("BuyerKind")}>
          {t(request.isCompany ? "Patient:InvoiceRequest:Company" : "Patient:InvoiceRequest:Personal")}
        </SheetRow>
        {request.isCompany && (
          <>
            <SheetRow label={field("CompanyName")}>{formatDash(request.companyName)}</SheetRow>
            <SheetRow label={field("TaxCode")}>{formatDash(request.taxCode)}</SheetRow>
            <SheetRow label={field("CompanyAddress")}>{formatDash(request.companyAddress)}</SheetRow>
          </>
        )}
        <SheetRow label={field("Email")}>{request.email}</SheetRow>
        <SheetRow label={field("PaperInvoice")}>{paperLabel(request.wantsPaperInvoice)}</SheetRow>
      </dl>
    </section>
  );
}
