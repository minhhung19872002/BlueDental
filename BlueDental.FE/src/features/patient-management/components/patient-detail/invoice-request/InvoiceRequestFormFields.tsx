import { Form, Input, InputNumber } from "antd";
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

type Rules = ReturnType<typeof formRules>;

/** Dịch vụ / Số tiền of the receipt; blank lines until one is picked. */
export interface InvoiceRequestSummary {
  serviceName?: string | null;
  amount: number;
}

/** Cá nhân: who the invoice is for. */
function PersonalLines({ rules }: { rules: Rules }) {
  return (
    <>
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
        <PaperInput label={field("NationalId")} name="nationalId" required rules={rules.nationalId}>
          <Input maxLength={12} inputMode="numeric" />
        </PaperInput>
      </PaperRow>
      <PaperLinedInput
        label={`${field("PersonalAddress")}: ${t("Patient:InvoiceRequest:AddressHint")}`}
        name="personalAddress"
        maxLength={500}
      />
    </>
  );
}

/** Công ty: the company lines and the Email the invoice goes to. */
function CompanyLines({ rules }: { rules: Rules }) {
  return (
    <>
      <PaperNote>{t("Patient:InvoiceRequest:CompanyNote")}</PaperNote>
      <PaperRow>
        <PaperInput label={field("CompanyName")} name="companyName" required rules={rules.companyName}>
          <Input maxLength={200} />
        </PaperInput>
      </PaperRow>
      <PaperRow>
        <PaperInput label={field("TaxCode")} name="taxCode" required rules={rules.taxCode}>
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
    </>
  );
}

/**
 * The BA's paper THÔNG TIN XUẤT HÓA ĐƠN filled in on screen, minus Cân nặng /
 * Chiều cao (written by hand on the printed sheet). Loại hóa đơn (R-916) shows
 * either the personal lines or the company lines + Email.
 */
export function InvoiceRequestFormFields({ summary }: { summary?: InvoiceRequestSummary }) {
  const form = Form.useFormInstance();
  const isCompany = Form.useWatch("isCompany", form) ?? false;
  const rules = formRules();
  const kinds = [
    { value: false, label: t("Patient:InvoiceRequest:Personal") },
    { value: true, label: t("Patient:InvoiceRequest:Company") },
  ];
  return (
    <InvoicePaper title={t("Patient:InvoiceRequest:SheetTitle")}>
      <PaperChoiceInput label={field("InvoiceKind")} name="isCompany" options={kinds} />
      {isCompany ? <CompanyLines rules={rules} /> : <PersonalLines rules={rules} />}
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
