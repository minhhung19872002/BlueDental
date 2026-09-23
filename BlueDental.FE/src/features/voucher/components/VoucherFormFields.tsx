import { useCallback } from "react";
import { DatePicker, Form, Input, Radio, Segmented, Switch } from "antd";
import type { FormInstance } from "antd";
import { t } from "@/lib/i18n";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FloatingField } from "@/components/FloatingField";
import type { VoucherFormValues } from "../types/voucherForm";
import { VoucherServicePicker } from "./VoucherServicePicker";

const DAY_LABEL_KEYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 7];

interface DayChipsProps {
  value?: number[];
  onChange?: (value: number[]) => void;
  disabled: boolean;
}

/* Controlled by Form.Item, so a toggle re-renders through onChange. */
function DayChipsInput({ value, onChange, disabled }: DayChipsProps) {
  const selected = value ?? [];

  const handleToggle = useCallback(
    (day: number) => {
      const next = selected.includes(day)
        ? selected.filter((d) => d !== day)
        : [...selected, day].sort((a, b) => a - b);
      onChange?.(next);
    },
    [selected, onChange],
  );

  return (
    <div className="voucher-days-row">
      {DAY_VALUES.map((day, i) => {
        const isSelected = !disabled && selected.includes(day);
        return (
          <button
            key={day}
            type="button"
            className={`voucher-day-chip${isSelected ? " voucher-day-chip--active" : ""}`}
            disabled={disabled}
            onClick={() => handleToggle(day)}
          >
            {t(DAY_LABEL_KEYS[i])}
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  form: FormInstance<VoucherFormValues>;
}

export function VoucherFormFields({ form }: Props) {
  const discountType = Form.useWatch("discountType", form) ?? "percentage";
  const scopeTarget = Form.useWatch("scopeTarget", form) ?? "service";
  const isDaysLimited = Form.useWatch("isDaysOfWeekLimited", form) ?? false;

  return (
    <>
      {/* ── Dates ── */}
      <div className="voucher-field-row">
        <FloatingField
          name="startDate"
          label={t("Voucher:StartDate")}
          required
          rules={[{ required: true, message: t("Voucher:DateRequired") }]}
        >
          <DatePicker format="DD/MM/YYYY" />
        </FloatingField>
        <FloatingField
          name="endDate"
          label={t("Voucher:EndDateLabel")}
          required
          rules={[{ required: true, message: t("Voucher:DateRequired") }]}
        >
          <DatePicker format="DD/MM/YYYY" />
        </FloatingField>
      </div>

      {/* ── Discount: %/VNĐ toggle + value + max discount ── */}
      <div className="voucher-discount-row">
        <Form.Item name="discountType" noStyle>
          <Segmented
            options={[
              { label: "%", value: "percentage" },
              { label: t("Voucher:CurrencyLabel"), value: "fixed_amount" },
            ]}
          />
        </Form.Item>
        <FloatingField
          name="discountValue"
          label={t("Voucher:DiscountLabel")}
          required
          className="voucher-discount-value"
          rules={[
            { required: true, message: t("Voucher:DiscountRequired") },
            { type: "number", min: 1, message: t("Voucher:DiscountMin") },
            ...(discountType === "percentage"
              ? [{ type: "number" as const, max: 100, message: t("Voucher:DiscountMax100") }]
              : []),
          ]}
        >
          <CurrencyInput />
        </FloatingField>
        {discountType === "percentage" && (
          <FloatingField
            name="maxDiscountAmount"
            label={t("Voucher:MaxDiscountLabel")}
            className="voucher-discount-max"
          >
            <CurrencyInput />
          </FloatingField>
        )}
      </div>

      {/* ── Scope ── */}
      <div className="voucher-scope-label">
        {t("Voucher:ScopeLabel")} <span className="voucher-required-star">*</span>
      </div>
      <div className="voucher-scope-bar">
        <Form.Item name="scopeTarget" noStyle>
          <Radio.Group>
            <Radio value="service">{t("Voucher:ScopeService")}</Radio>
            <Radio value="treatment">{t("Voucher:ScopeTreatment")}</Radio>
          </Radio.Group>
        </Form.Item>
      </div>

      {scopeTarget === "service" && <VoucherServicePicker form={form} />}

      {scopeTarget === "treatment" && (
        <div className="voucher-min-order">
          <FloatingField
            name="minOrderValue"
            label={t("Voucher:MinOrderLabel2")}
            required
            rules={[{ required: true, message: t("Voucher:MinOrderRequired") }]}
          >
            <CurrencyInput />
          </FloatingField>
          <div className="voucher-form-hint">
            {t("Voucher:MinOrderHint")}
          </div>
        </div>
      )}

      {/* ── Days of week ── */}
      <div className="voucher-days-section">
        <div className="voucher-days-header">
          <span>{t("Voucher:DayLimit")}</span>
          <Form.Item name="isDaysOfWeekLimited" valuePropName="checked" noStyle>
            <Switch />
          </Form.Item>
        </div>
        <Form.Item name="daysOfWeek" noStyle>
          <DayChipsInput disabled={!isDaysLimited} />
        </Form.Item>
      </div>

      {/* ── Exclusivity card ── */}
      <div className="voucher-exclusive-card">
        <div className="voucher-exclusive-row">
          <div>
            <div className="voucher-exclusive-title">{t("Voucher:ExclusiveToggle")}</div>
            <div className="voucher-exclusive-desc">
              {t("Voucher:ExclusiveHint")}
            </div>
          </div>
          {/* The switch means "cho phép kết hợp" — ON stores isExclusive: false. */}
          <Form.Item
            name="isExclusive"
            noStyle
            getValueProps={(value: boolean) => ({ checked: !value })}
            getValueFromEvent={(checked: boolean) => !checked}
          >
            <Switch />
          </Form.Item>
        </div>
      </div>

      {/* ── Description ── */}
      <Form.Item name="description">
        <Input.TextArea rows={4} placeholder={t("Voucher:DescriptionPlaceholder")} />
      </Form.Item>
    </>
  );
}

