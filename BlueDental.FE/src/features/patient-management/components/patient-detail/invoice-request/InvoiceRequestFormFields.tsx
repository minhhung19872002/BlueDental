import { Input, InputNumber } from "antd";
import {
  InvoicePaper,
  PaperChoiceInput,
  PaperInput,
  PaperLinedInput,
  PaperNote,
  PaperRow,
  PaperText,
} from "@/components/InvoicePaper";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import { formRules } from "./invoiceRequestForm";

const field = (key: string) => t(`Patient:InvoiceRequest:Field:${key}`);

/** Dịch vụ / Số tiền of the receipt; blank lines until one is picked. */
export interface InvoiceRequestSummary {
  serviceName?: string | null;
  amount: number;
}

/**
 * The BA's paper THÔNG TIN XUẤT HÓA ĐƠN filled in on screen, line for line,
 * minus Cân nặng / Chiều cao (written by hand on the printed sheet). No
 * personal / company switch: the company lines stay optional under the note.
 */
export function InvoiceRequestFormFields({ summary }: { summary?: InvoiceRequestSummary }) {
  const rules = formRules();
  return (
    <InvoicePaper title={t("Patient:InvoiceRequest:SheetTitle")}>
      <PaperRow>
        <PaperInput label={field("FullName")} name="fullName" required rules={rules.fullName} width="name">
          <Input maxLength={200} />
        </PaperInput>
        <PaperInput label={field("BirthYear")} name="birthYear" rules={rules.birthYear} width="year">
          <InputNumber controls={false} precision={0} />
        </PaperInput>
        <PaperInput label={field("Phone")} name="phone" required rules={rules.phone} width="phone">
          <Input maxLength={15} inputMode="tel" />
        </PaperInput>
      </PaperRow>
      <PaperRow>
        <PaperInput label={field("NationalId")} name="nationalId" rules={rules.nationalId}>
          <Input maxLength={12} inputMode="numeric" />
        </PaperInput>
      </PaperRow>
      <PaperLinedInput
        label={`${field("PersonalAddress")}: ${t("Patient:InvoiceRequest:AddressHint")}`}
        name="personalAddress"
        maxLength={500}
      />

      <PaperNote>{t("Patient:InvoiceRequest:CompanyNote")}</PaperNote>
      <PaperRow>
        <PaperInput label={field("CompanyName")} name="companyName" rules={rules.companyName}>
          <Input maxLength={200} />
        </PaperInput>
      </PaperRow>
      <PaperRow>
        <PaperInput label={field("TaxCode")} name="taxCode" rules={rules.taxCode}>
          <Input maxLength={13} inputMode="numeric" />
        </PaperInput>
      </PaperRow>
      <PaperRow>
        <PaperInput label={field("CompanyAddress")} name="companyAddress">
          <Input maxLength={500} />
        </PaperInput>
      </PaperRow>
      <PaperRow>
        <PaperInput label={field("Email")} name="email" required rules={rules.email} strong>
          <Input maxLength={256} inputMode="email" />
        </PaperInput>
      </PaperRow>
      <PaperRow>
        <PaperText label={field("Service")} value={summary?.serviceName} strong />
      </PaperRow>
      <PaperRow>
        <PaperText label={field("Amount")} value={summary && formatMoneyUnit(summary.amount)} strong />
      </PaperRow>
      <PaperChoiceInput label={field("PaperInvoice")} name="wantsPaperInvoice" />
    </InvoicePaper>
  );
}
