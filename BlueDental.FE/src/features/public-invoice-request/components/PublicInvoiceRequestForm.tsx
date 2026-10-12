import { Button, Form, Input, InputNumber, Radio } from "antd";
import { t } from "@/lib/i18n";
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
 * THÔNG TIN XUẤT HÓA ĐƠN as the customer sees it. Cân nặng / Chiều cao are not
 * asked here: they are written by hand on the printed sheet.
 */
export function PublicInvoiceRequestForm({ form, submitting, onSubmit }: Props) {
  const [antForm] = Form.useForm<PublicInvoiceRequestValues>();
  const buyerKind = Form.useWatch("buyerKind", antForm);
  const rules = publicRules(form);

  return (
    <Form
      form={antForm}
      layout="vertical"
      initialValues={initialValues(form)}
      onFinish={onSubmit}
      className="pir-form"
      scrollToFirstError
    >
      <h2 className="pir-section">{t("Patient:InvoiceRequest:Section:Customer")}</h2>
      <Form.Item label={field("FullName")} name="fullName" rules={rules.fullName}>
        <Input maxLength={200} autoComplete="name" />
      </Form.Item>
      <Form.Item label={field("BirthYear")} name="birthYear" rules={rules.birthYear}>
        <InputNumber className="pir-full" controls={false} precision={0} inputMode="numeric" />
      </Form.Item>
      <Form.Item label={field("Phone")} name="phone" rules={rules.phone} extra={keepHint(form.phoneHint)}>
        <Input maxLength={15} inputMode="tel" autoComplete="tel" />
      </Form.Item>
      <Form.Item label={field("NationalId")} name="nationalId" rules={rules.nationalId} extra={keepHint(form.nationalIdHint)}>
        <Input maxLength={12} inputMode="numeric" />
      </Form.Item>
      <Form.Item label={field("PersonalAddress")} name="personalAddress" extra={keepHint(form.addressHint)}>
        <Input maxLength={500} autoComplete="street-address" />
      </Form.Item>

      <h2 className="pir-section">{t("Patient:InvoiceRequest:Section:Invoice")}</h2>
      <Form.Item name="buyerKind">
        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          className="pir-kind"
          options={[
            { value: "personal", label: t("Patient:InvoiceRequest:Personal") },
            { value: "company", label: t("Patient:InvoiceRequest:Company") },
          ]}
        />
      </Form.Item>
      {buyerKind === "company" && (
        <>
          <Form.Item label={field("CompanyName")} name="companyName" rules={rules.companyName}>
            <Input maxLength={200} autoComplete="organization" />
          </Form.Item>
          <Form.Item label={field("TaxCode")} name="taxCode" rules={rules.taxCode}>
            <Input maxLength={13} inputMode="numeric" />
          </Form.Item>
          <Form.Item label={field("CompanyAddress")} name="companyAddress">
            <Input maxLength={500} />
          </Form.Item>
        </>
      )}
      <Form.Item label={field("Email")} name="email" rules={rules.email} extra={keepHint(form.emailHint)}>
        <Input maxLength={256} inputMode="email" autoComplete="email" />
      </Form.Item>
      <Form.Item label={field("PaperInvoice")} name="wantsPaperInvoice">
        <Radio.Group
          options={[
            { value: true, label: t("Common:Yes") },
            { value: false, label: t("Common:No") },
          ]}
        />
      </Form.Item>

      <Button type="primary" htmlType="submit" size="large" block loading={submitting} disabled={submitting}>
        {t("PublicInvoiceRequest:Submit")}
      </Button>
    </Form>
  );
}
