import { Form, Input, InputNumber, Radio, Switch } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { CurrencyInput } from "@/components/CurrencyInput";
import { t } from "@/lib/i18n";
import { COMMISSION_TYPE, type CardTypeDto, type SaveCardTypeInput } from "../types";
import {
  CARD_TYPE_FORM_DEFAULTS,
  cardTypeToForm,
  formToCardType,
  type CardTypeFormValues,
} from "../types/cardTypeForm";
import { ServiceScopeFields } from "./ServiceScopeFields";

interface Props {
  /** null closed, "new" for Thêm loại thẻ, a type for Sửa. */
  editing: CardTypeDto | "new" | null;
  saving: boolean;
  onSubmit: (input: SaveCardTypeInput) => void;
  onClose: () => void;
}

/**
 * "Khởi tạo thẻ" — a kind of card the clinic sells: giá bán vs giá trị sử
 * dụng, số lần tối đa, hoa hồng khi bán, gia đình, and the services it pays for.
 * Editing a type never changes a card already sold.
 */
export function CardTypeDialog({ editing, saving, onSubmit, onClose }: Props) {
  const [form] = Form.useForm<CardTypeFormValues>();
  const commissionType = Form.useWatch("commissionType", form);
  const salePrice = Form.useWatch("salePrice", form);
  const isNew = editing === "new";

  return (
    <AppDialog
      open={editing !== null}
      title={t(isNew ? "PrepaidCard:Type:CreateTitle" : "PrepaidCard:Type:EditTitle")}
      subtitle={isNew ? undefined : t("PrepaidCard:Type:EditHint")}
      width={720}
      className="prepaid-dialog"
      canSave
      saving={saving}
      cancelLabel={t("Common:Cancel")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      {editing !== null && (
        <Form<CardTypeFormValues>
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={editing === "new" ? CARD_TYPE_FORM_DEFAULTS : cardTypeToForm(editing)}
          onFinish={(values) => onSubmit(formToCardType(values))}
        >
          <Form.Item
            name="name"
            label={t("PrepaidCard:Field:TypeName")}
            rules={[{ required: true, whitespace: true, message: t("PrepaidCard:Validation:Name") }]}
          >
            <Input maxLength={200} />
          </Form.Item>
          <div className="prepaid-form-grid">
            <Form.Item
              name="salePrice"
              label={t("PrepaidCard:Field:SalePrice")}
              rules={[{ required: true, type: "number", min: 0, message: t("PrepaidCard:Validation:SalePrice") }]}
            >
              <CurrencyInput suffix=" đ" />
            </Form.Item>
            <Form.Item
              name="usageValue"
              label={t("PrepaidCard:Field:UsageValue")}
              rules={[{ required: true, type: "number", min: 1, message: t("PrepaidCard:Validation:UsageValue") }]}
            >
              <CurrencyInput suffix=" đ" />
            </Form.Item>
            <Form.Item name="maxUses" label={t("PrepaidCard:Field:MaxUses")} extra={t("PrepaidCard:Field:MaxUsesHint")}>
              <InputNumber min={1} max={10000} precision={0} className="prepaid-number" />
            </Form.Item>
            <Form.Item label={t("PrepaidCard:Field:Commission")} required>
              <div className="prepaid-commission">
                <Form.Item name="commissionType" noStyle>
                  <Radio.Group
                    optionType="button"
                    options={[
                      { value: COMMISSION_TYPE.Percent, label: "%" },
                      { value: COMMISSION_TYPE.Amount, label: "VNĐ" },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="commissionValue"
                  noStyle
                  rules={[
                    commissionType === COMMISSION_TYPE.Percent
                      ? { type: "number", min: 0, max: 100, message: t("PrepaidCard:Validation:CommissionPercent") }
                      : { type: "number", min: 0, max: salePrice ?? 0, message: t("PrepaidCard:Validation:CommissionAmount") },
                  ]}
                >
                  {commissionType === COMMISSION_TYPE.Percent ? (
                    <InputNumber min={0} max={100} precision={2} suffix="%" className="prepaid-number" />
                  ) : (
                    <CurrencyInput suffix=" đ" />
                  )}
                </Form.Item>
              </div>
            </Form.Item>
          </div>
          <div className="prepaid-form-switches">
            <Form.Item name="allowFamily" valuePropName="checked" label={t("PrepaidCard:Field:AllowFamily")}>
              <Switch />
            </Form.Item>
            <Form.Item name="isOnSale" valuePropName="checked" label={t("PrepaidCard:Field:OnSale")}>
              <Switch />
            </Form.Item>
          </div>
          <ServiceScopeFields />
          <Form.Item name="note" label={t("PrepaidCard:Field:Note")}>
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
        </Form>
      )}
    </AppDialog>
  );
}
