import { useId } from "react";
import { Button, Input, InputNumber } from "antd";
import { CurrencyInput } from "@/components/CurrencyInput";
import type { TreatmentServiceDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import { cashierDiscountOf, defaultReceiptName, type DiscountUnit, type LineTerms } from "./paymentRounds";

interface Props {
  line: TreatmentServiceDto;
  /** This đợt's number on the line. */
  round: number;
  /** What is typed so far — the applied terms until something is changed. */
  draft: LineTerms;
  onEdit: (patch: Partial<LineTerms>) => void;
  onApply: () => void;
  onRestore: () => void;
}

const UNITS: ReadonlyArray<[DiscountUnit, string]> = [
  ["money", "Treatment:Pricing:UnitVnd"],
  ["percent", "Patient:Payment:UnitPercent"],
];

const NAME_LIMIT = 200;
const REASON_LIMIT = 500;

/**
 * "Đang chỉnh phiếu đợt N" (P2910): the name this đợt's receipt prints for the
 * line, and Giảm giá thu ngân in đồng or as % of what it still owes before VAT,
 * with why — the reason goes to the accountant at step 6, not on the receipt.
 */
export function PaymentLineTermsForm({ line, round, draft, onEdit, onApply, onRestore }: Props) {
  const discountLabelId = useId();
  const plain = line.serviceName ?? line.code;
  const room = line.preTaxOutstandingAmount;
  const discount = cashierDiscountOf(draft, line);

  return (
    <div className="pd-newpay-terms">
      <label className="pd-newpay-terms-field">
        <span>{t("Patient:Payment:ReceiptNameLabel", round)}</span>
        <Input
          value={draft.receiptName ?? defaultReceiptName(plain, round)}
          maxLength={NAME_LIMIT}
          onChange={(event) => onEdit({ receiptName: event.target.value })}
        />
      </label>
      <small className="pd-newpay-hint">{t("Patient:Payment:ReceiptNameHint")}</small>

      <div className="pd-newpay-terms-field">
        <span id={discountLabelId}>{t("Patient:Payment:CashierDiscount")}</span>
        <div className="pd-newpay-terms-discount">
          {draft.unit === "money" ? (
            <CurrencyInput
              aria-labelledby={discountLabelId}
              value={draft.value}
              max={room}
              selectOnFocus
              onChange={(value) => onEdit({ value })}
            />
          ) : (
            <InputNumber
              aria-labelledby={discountLabelId}
              min={0}
              max={100}
              precision={2}
              value={draft.value ?? null}
              onChange={(value) => onEdit({ value: value ?? undefined })}
            />
          )}
          <div className="pd-newpay-unit" role="group" aria-label={t("Patient:Payment:DiscountUnit")}>
            {UNITS.map(([unit, label]) => (
              <button
                type="button"
                key={unit}
                aria-pressed={draft.unit === unit}
                onClick={() => onEdit({ unit, value: undefined })}
              >
                {t(label)}
              </button>
            ))}
          </div>
        </div>
        <small className="pd-newpay-hint">
          {t("Patient:Payment:DiscountPreview", formatMoneyUnit(discount), formatMoneyUnit(room))}
        </small>
      </div>

      <label className="pd-newpay-terms-field">
        <span>{t("Patient:Payment:DiscountReasonLabel")}</span>
        <Input
          value={draft.reason}
          maxLength={REASON_LIMIT}
          placeholder={t("Patient:Payment:DiscountReasonPlaceholder")}
          onChange={(event) => onEdit({ reason: event.target.value })}
        />
      </label>

      <div className="pd-newpay-terms-actions">
        <Button size="small" onClick={onRestore}>
          {t("Patient:Payment:Restore")}
        </Button>
        <Button size="small" type="primary" onClick={onApply}>
          {t("Patient:Payment:Apply")}
        </Button>
      </div>
    </div>
  );
}
