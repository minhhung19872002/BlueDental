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
  keepHint,
  publicRules,
  type PublicInvoiceRequestValues,
} from "./publicInvoiceRequestValues";

const field = (key: string) => t(`Patient:InvoiceRequest:Field:${key}`);

interface Props {
  form: PublicInvoiceRequestFormDto;
  submitting: boolean;
  onSubmit: (values: PublicInvoiceRequestValues) => void;
}

/**
 * The BA's paper THÔNG TIN XUẤT HÓA ĐƠN filled in on the phone, line for line.
 * Cân nặng / Chiều cao are not asked: they are written by hand on the printed
 * sheet. Dịch vụ / Số tiền come from the receipt. No personal / company switch —
 * the company lines are optional under the note.
 */
export function PublicInvoiceRequestForm({ form, submitting, onSubmit }: Props) {
  const [antForm] = Form.useForm<PublicInvoiceRequestValues>();
  const rules = publicRules(form);

  return (
    <Form form={antForm} initialValues={initialValues(form)} onFinish={onSubmit} className="pir-form" scrollToFirstError>
      <InvoicePaper title={t("Patient:InvoiceRequest:SheetTitle")}>
        <PaperRow>
          <PaperInput label={field("FullName")} name="fullName" required rules={rules.fullName} width="name">
            <Input maxLength={200} autoComplete="name" />
          </PaperInput>
          <PaperInput label={field("BirthYear")} name="birthYear" rules={rules.birthYear} width="year">
            <InputNumber controls={false} precision={0} inputMode="numeric" />
          </PaperInput>
          <PaperInput
            label={field("Phone")}
            name="phone"
            required={!form.phoneHint}
            rules={rules.phone}
            extra={keepHint(form.phoneHint)}
            width="phone"
          >
            <Input maxLength={15} inputMode="tel" autoComplete="tel" />
          </PaperInput>
        </PaperRow>
        <PaperRow>
          <PaperInput label={field("NationalId")} name="nationalId" rules={rules.nationalId} extra={keepHint(form.nationalIdHint)}>
            <Input maxLength={12} inputMode="numeric" />
          </PaperInput>
        </PaperRow>
        <PaperLinedInput
          label={`${field("PersonalAddress")}: ${t("Patient:InvoiceRequest:AddressHint")}`}
          name="personalAddress"
          extra={keepHint(form.addressHint)}
          maxLength={500}
        />

        <PaperNote>{t("Patient:InvoiceRequest:CompanyNote")}</PaperNote>
        <PaperRow>
          <PaperInput label={field("CompanyName")} name="companyName" rules={rules.companyName}>
            <Input maxLength={200} autoComplete="organization" />
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
          <PaperInput
            label={field("Email")}
            name="email"
            required={!form.emailHint}
            rules={rules.email}
            extra={keepHint(form.emailHint)}
            strong
          >
            <Input maxLength={256} inputMode="email" autoComplete="email" />
          </PaperInput>
        </PaperRow>
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
