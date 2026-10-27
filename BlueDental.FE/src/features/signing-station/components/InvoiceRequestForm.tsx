import { Button, Form, Input, Segmented } from "antd";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import type { StationInvoiceRequestDto } from "../api/signingStationApi";
import {
  INITIAL_INVOICE_VALUES,
  stationInvoiceRules,
  toStationInvoiceBody,
  type StationInvoiceValues,
} from "./invoiceFormValues";

const label = (key: string) => t(`SigningStation:Invoice:Field:${key}`);
const hint = (key: string) => t(`SigningStation:Invoice:Hint:${key}`);

interface Props {
  paymentCode: string;
  amount: number;
  saving: boolean;
  /** The server's refusal, shown above the footnote. */
  error: string | null;
  onCancel: () => void;
  onSave: (body: StationInvoiceRequestDto) => void;
}

type Rules = ReturnType<typeof stationInvoiceRules>;

/** THÔNG TIN ĐƠN VỊ + NHẬN HÓA ĐƠN, as the BA mock draws them. */
function CompanyLines({ rules }: { rules: Rules }) {
  return (
    <>
      <h3 className="sst-form-section">{t("SigningStation:Invoice:CompanySection")}</h3>
      <Form.Item label={label("TaxCode")} name="taxCode" rules={rules.taxCode} required>
        <Input size="large" maxLength={13} inputMode="numeric" placeholder={hint("TaxCode")} />
      </Form.Item>
      <Form.Item label={label("CompanyName")} name="companyName" rules={rules.companyName} required>
        <Input size="large" maxLength={200} placeholder={hint("CompanyName")} />
      </Form.Item>
      <Form.Item label={label("CompanyAddress")} name="companyAddress" rules={rules.companyAddress} required>
        <Input size="large" maxLength={500} placeholder={hint("CompanyAddress")} />
      </Form.Item>
      <h3 className="sst-form-section">{t("SigningStation:Invoice:ReceiveSection")}</h3>
      <Form.Item label={label("Email")} name="email" rules={rules.email} required>
        <Input size="large" maxLength={256} inputMode="email" placeholder={hint("Email")} />
      </Form.Item>
      <Form.Item label={label("Buyer")} name="fullName">
        <Input size="large" maxLength={200} placeholder={hint("Optional")} />
      </Form.Item>
    </>
  );
}

/** Cá nhân — an assumption (the mock draws only the company side). */
function PersonLines({ rules }: { rules: Rules }) {
  return (
    <>
      <h3 className="sst-form-section">{t("SigningStation:Invoice:PersonSection")}</h3>
      <Form.Item label={label("FullName")} name="fullName" rules={rules.fullName} required>
        <Input size="large" maxLength={200} />
      </Form.Item>
      <Form.Item label={label("Phone")} name="phone" rules={rules.phone} required>
        <Input size="large" maxLength={15} inputMode="tel" />
      </Form.Item>
      <Form.Item label={label("NationalId")} name="nationalId" rules={rules.nationalId} required>
        <Input size="large" maxLength={12} inputMode="numeric" />
      </Form.Item>
      <Form.Item label={label("Address")} name="personalAddress">
        <Input size="large" maxLength={500} placeholder={hint("Optional")} />
      </Form.Item>
      <h3 className="sst-form-section">{t("SigningStation:Invoice:ReceiveSection")}</h3>
      <Form.Item label={label("Email")} name="email" rules={rules.personalEmail}>
        <Input size="large" maxLength={256} inputMode="email" placeholder={hint("Optional")} />
      </Form.Item>
    </>
  );
}

/** "Thông tin xuất hóa đơn" (BA mock): Hủy on the left, Lưu on the right. */
export function InvoiceRequestForm({ paymentCode, amount, saving, error, onCancel, onSave }: Props) {
  const [form] = Form.useForm<StationInvoiceValues>();
  const isCompany = Form.useWatch("isCompany", form) ?? true;
  const rules = stationInvoiceRules();
  const handleFinish = (values: StationInvoiceValues) => onSave(toStationInvoiceBody(values));

  return (
    <section className="sst-form-card" aria-labelledby="sst-invoice-title">
      <Form form={form} layout="vertical" initialValues={INITIAL_INVOICE_VALUES} onFinish={handleFinish}>
        <header className="sst-form-head">
          <Button size="large" onClick={onCancel} disabled={saving}>
            {t("SigningStation:Invoice:Cancel")}
          </Button>
          <div className="sst-form-heading">
            <h2 id="sst-invoice-title">{t("SigningStation:Invoice:FormTitle")}</h2>
            <p>{t("SigningStation:Invoice:FormSub", paymentCode, formatMoneyUnit(amount))}</p>
          </div>
          <Button size="large" type="primary" htmlType="submit" loading={saving} disabled={saving}>
            {t("SigningStation:Invoice:Save")}
          </Button>
        </header>
        <Form.Item name="isCompany" className="sst-form-kind">
          <Segmented
            block
            size="large"
            options={[
              { value: true, label: t("SigningStation:Invoice:Company") },
              { value: false, label: t("SigningStation:Invoice:Person") },
            ]}
          />
        </Form.Item>
        {isCompany ? <CompanyLines rules={rules} /> : <PersonLines rules={rules} />}
        {error && (
          <p className="sst-form-error" role="alert">
            {error}
          </p>
        )}
        <p className="sst-form-foot">{t("SigningStation:Invoice:Footnote")}</p>
      </Form>
    </section>
  );
}
