import {
  InvoicePaper,
  PaperBox,
  PaperChoiceRow,
  PaperLinedText,
  PaperNote,
  PaperRow,
  PaperText,
} from "@/components/InvoicePaper";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import type { InvoiceRequestDto } from "../../../api/invoiceRequestApi";

const field = (key: string) => t(`Patient:InvoiceRequest:Field:${key}`);

interface Props {
  request: InvoiceRequestDto;
}

/**
 * THÔNG TIN XUẤT HÓA ĐƠN laid out like the BA's paper form, line for line, so
 * the print can go straight to the accountant. Cân nặng / Chiều cao stay blank
 * for the customer to write in by hand; company lines stay blank on a personal
 * invoice.
 */
export function InvoiceRequestSheet({ request }: Props) {
  const company = request.isCompany;
  return (
    <InvoicePaper title={t("Patient:InvoiceRequest:SheetTitle")} className="ir-sheet">
      <PaperRow>
        <PaperText label={field("FullName")} value={request.fullName} width="name" />
        <PaperText label={field("BirthYear")} value={request.birthYear} width="year" />
        <PaperText label={field("Phone")} value={request.phone} width="phone" />
      </PaperRow>
      <PaperRow>
        <PaperText label={field("NationalId")} value={request.nationalId} width="id" />
        <PaperText label={field("Weight")} width="weight" />
        <PaperText label={field("Height")} width="height" />
      </PaperRow>
      <PaperLinedText
        label={`${field("PersonalAddress")}: ${t("Patient:InvoiceRequest:AddressHint")}`}
        value={request.personalAddress}
      />

      <PaperNote>{t("Patient:InvoiceRequest:CompanyNote")}</PaperNote>
      <PaperRow>
        <PaperText label={field("CompanyName")} value={company && request.companyName} />
      </PaperRow>
      <PaperRow>
        <PaperText label={field("TaxCode")} value={company && request.taxCode} />
      </PaperRow>
      <PaperRow>
        <PaperText label={field("CompanyAddress")} value={company && request.companyAddress} />
      </PaperRow>
      <PaperRow>
        <PaperText label={field("Email")} value={request.email} strong />
      </PaperRow>
      <PaperRow>
        <PaperText label={field("Service")} value={request.serviceName} strong />
      </PaperRow>
      <PaperRow>
        <PaperText label={field("Amount")} value={formatMoneyUnit(request.amount)} strong />
      </PaperRow>
      <PaperChoiceRow label={field("PaperInvoice")}>
        <PaperBox checked={request.wantsPaperInvoice === true} label={t("Common:Yes")} />
        <PaperBox checked={request.wantsPaperInvoice === false} label={t("Common:No")} />
      </PaperChoiceRow>
    </InvoicePaper>
  );
}
