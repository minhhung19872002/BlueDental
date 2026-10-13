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
 * for the customer to write in by hand. Loại hóa đơn is ticked (R-916) and the
 * other kind's lines stay blank: a company invoice prints no personal details.
 */
export function InvoiceRequestSheet({ request }: Props) {
  const company = request.isCompany;
  const person = !company;
  return (
    <InvoicePaper title={t("Patient:InvoiceRequest:SheetTitle")} className="ir-sheet">
      <PaperChoiceRow label={field("InvoiceKind")}>
        <PaperBox checked={person} label={t("Patient:InvoiceRequest:Personal")} />
        <PaperBox checked={company} label={t("Patient:InvoiceRequest:Company")} />
      </PaperChoiceRow>
      <PaperRow>
        <PaperText label={field("FullName")} value={person && request.fullName} width="name" />
        <PaperText label={field("BirthYear")} value={person && request.birthYear} width="year" />
        <PaperText label={field("Phone")} value={person && request.phone} width="phone" />
      </PaperRow>
      <PaperRow>
        <PaperText label={field("NationalId")} value={person && request.nationalId} width="id" />
        <PaperText label={field("Weight")} width="weight" />
        <PaperText label={field("Height")} width="height" />
      </PaperRow>
      <PaperLinedText
        label={`${field("PersonalAddress")}: ${t("Patient:InvoiceRequest:AddressHint")}`}
        value={person && request.personalAddress}
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
