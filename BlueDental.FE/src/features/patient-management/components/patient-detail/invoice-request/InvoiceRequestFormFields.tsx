import { Col, Form, Input, InputNumber, Radio, Row } from "antd";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { formRules, type InvoiceRequestFormState } from "./invoiceRequestForm";

/**
 * The THÔNG TIN XUẤT HÓA ĐƠN form of the BA, minus Cân nặng / Chiều cao: those
 * are left blank on the printed sheet for the customer to write in by hand.
 */
export function InvoiceRequestFormFields() {
  const buyerKind = Form.useWatch<InvoiceRequestFormState["buyerKind"]>("buyerKind");
  const rules = formRules();
  return (
    <>
      <h4 className="ir-form__section">{t("Patient:InvoiceRequest:Section:Customer")}</h4>
      <Row gutter={[16, 12]}>
        <Col xs={24} md={16}>
          <FloatingField label={t("Patient:InvoiceRequest:Field:FullName")} name="fullName" required rules={rules.fullName}>
            <Input maxLength={200} />
          </FloatingField>
        </Col>
        <Col xs={24} md={8}>
          <FloatingField label={t("Patient:InvoiceRequest:Field:BirthYear")} name="birthYear" rules={rules.birthYear}>
            <InputNumber className="ir-full" controls={false} precision={0} />
          </FloatingField>
        </Col>
        <Col xs={24} md={12}>
          <FloatingField label={t("Patient:InvoiceRequest:Field:Phone")} name="phone" required rules={rules.phone}>
            <Input maxLength={15} inputMode="tel" />
          </FloatingField>
        </Col>
        <Col xs={24} md={12}>
          <FloatingField label={t("Patient:InvoiceRequest:Field:NationalId")} name="nationalId" rules={rules.nationalId}>
            <Input maxLength={12} inputMode="numeric" />
          </FloatingField>
        </Col>
        <Col span={24}>
          <FloatingField label={t("Patient:InvoiceRequest:Field:PersonalAddress")} name="personalAddress">
            <Input maxLength={500} />
          </FloatingField>
        </Col>
      </Row>

      <div className="ir-form__kind">
        <h4 className="ir-form__section">{t("Patient:InvoiceRequest:Section:Invoice")}</h4>
        <Form.Item name="buyerKind" noStyle>
          <Radio.Group
            optionType="button"
            options={[
              { value: "personal", label: t("Patient:InvoiceRequest:Personal") },
              { value: "company", label: t("Patient:InvoiceRequest:Company") },
            ]}
          />
        </Form.Item>
      </div>
      <Row gutter={[16, 12]}>
        {buyerKind === "company" && (
          <>
            <Col xs={24} md={16}>
              <FloatingField label={t("Patient:InvoiceRequest:Field:CompanyName")} name="companyName" required rules={rules.companyName}>
                <Input maxLength={200} />
              </FloatingField>
            </Col>
            <Col xs={24} md={8}>
              <FloatingField label={t("Patient:InvoiceRequest:Field:TaxCode")} name="taxCode" required rules={rules.taxCode}>
                <Input maxLength={13} inputMode="numeric" />
              </FloatingField>
            </Col>
            <Col span={24}>
              <FloatingField label={t("Patient:InvoiceRequest:Field:CompanyAddress")} name="companyAddress">
                <Input maxLength={500} />
              </FloatingField>
            </Col>
          </>
        )}
        <Col xs={24} md={16}>
          <FloatingField label={t("Patient:InvoiceRequest:Field:Email")} name="email" required rules={rules.email}>
            <Input maxLength={256} inputMode="email" />
          </FloatingField>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="wantsPaperInvoice" label={t("Patient:InvoiceRequest:Field:PaperInvoice")} className="ir-form__paper">
            <Radio.Group
              options={[
                { value: true, label: t("Common:Yes") },
                { value: false, label: t("Common:No") },
              ]}
            />
          </Form.Item>
        </Col>
      </Row>
    </>
  );
}
