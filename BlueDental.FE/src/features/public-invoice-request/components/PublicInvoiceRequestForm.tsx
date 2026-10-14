import { Button, Form, Input, InputNumber } from "antd";
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
import type { PublicInvoiceRequestFormDto } from "../api/publicInvoiceRequestApi";
import {
  initialValues,
  publicRules,
  type PublicInvoiceRequestValues,
} from "./publicInvoiceRequestValues";

const field = (key: string) => t(`Patient:InvoiceRequest:Field:${key}`);

interface Props {
  form: PublicInvoiceRequestFormDto;
  submitting: boolean;
  onSubmit: (values: PublicInvoiceRequestValues) => void;
}

interface LinesProps {
  form: PublicInvoiceRequestFormDto;
  rules: ReturnType<typeof publicRules>;
}

/** Cá nhân: who the invoice is for. */
function PersonalLines({ form, rules }: LinesProps) {
  return (
    <>
      <PaperRow>
        <PaperInput label={field("FullName")} name="fullName" required rules={rules.fullName} width="name">
          <Input maxLength={200} autoComplete="name" />
        </PaperInput>
        <PaperInput label={field("BirthYear")} name="birthYear" rules={rules.birthYear} width="year">
          <InputNumber controls={false} precision={0} inputMode="numeric" />
        </PaperInput>
        <PaperInput label={field("Phone")} name="phone" required={!form.phoneHint} rules={rules.phone} width="phone">
          <Input maxLength={15} inputMode="tel" autoComplete="tel" />
        </PaperInput>
      </PaperRow>
      <PaperRow>
        <PaperInput label={field("NationalId")} name="nationalId" required={!form.nationalIdHint} rules={rules.nationalId}>
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
function CompanyLines({ form, rules }: LinesProps) {
  return (
    <>
      <PaperNote>{t("Patient:InvoiceRequest:CompanyNote")}</PaperNote>
      <PaperRow>
        <PaperInput label={field("CompanyName")} name="companyName" required rules={rules.companyName}>
          <Input maxLength={200} autoComplete="organization" />
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
        <PaperInput label={field("Email")} name="email" required={!form.emailHint} rules={rules.email} strong>
          <Input maxLength={256} inputMode="email" autoComplete="email" />
        </PaperInput>
      </PaperRow>
    </>
  );
}

/**
 * The BA's paper THÔNG TIN XUẤT HÓA ĐƠN filled in on the phone. Loại hóa đơn
 * (R-916) shows either the personal lines or the company lines + Email.
 * Cân nặng / Chiều cao are not asked: they are written by hand on the printed
 * sheet. Dịch vụ / Số tiền come from the receipt.
 */
export function PublicInvoiceRequestForm({ form, submitting, onSubmit }: Props) {
  const [antForm] = Form.useForm<PublicInvoiceRequestValues>();
  const isCompany = Form.useWatch("isCompany", antForm) ?? false;
  const rules = publicRules(form);
  const kinds = [
    { value: false, label: t("Patient:InvoiceRequest:Personal") },
    { value: true, label: t("Patient:InvoiceRequest:Company") },
  ];

  return (
    <Form form={antForm} initialValues={initialValues(form)} onFinish={onSubmit} className="pir-form" scrollToFirstError>
      <InvoicePaper title={t("Patient:InvoiceRequest:SheetTitle")}>
        <PaperChoiceInput label={field("InvoiceKind")} name="isCompany" options={kinds} />
        {isCompany ? <CompanyLines form={form} rules={rules} /> : <PersonalLines form={form} rules={rules} />}
        <PaperRow>
          <PaperText label={field("Service")} value={form.serviceName} strong />
        </PaperRow>
        <PaperRow>
          <PaperText label={field("Amount")} value={formatMoneyUnit(form.amount)} strong />
        </PaperRow>
        <PaperChoiceInput label={field("PaperInvoice")} name="wantsPaperInvoice" />
      </InvoicePaper>

      <Button type="primary" htmlType="submit" size="large" block loading={submitting} disabled={submitting} className="pir-submit">
        {t("PublicInvoiceRequest:Submit")}
      </Button>
    </Form>
  );
}
