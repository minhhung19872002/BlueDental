import { Form, Input, Radio } from "antd";
import { CircleDollarSign, RefreshCw } from "lucide-react";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FloatingLabel } from "@/components/FloatingLabel";
import { t } from "@/lib/i18n";
import { CONVERSION_TYPE, DIFFERENCE_HANDLING } from "../../../api/treatmentPlanApi";
import { PlanServicePicker } from "../../plan/PlanServicePicker";
import { formatToothValue } from "../../plan/toothPicker";
import { moneyText } from "../../plan/planTypes";
import { ConvertFacts, ConvertHead } from "./ConvertFacts";
import { ConvertStaffBox } from "./ConvertStaffBox";
import type { useConvertServiceForm } from "./useConvertServiceForm";

type Form = ReturnType<typeof useConvertServiceForm>;

/** Hints the reference prints under "Xử lý chênh lệch". */
const DIFFERENCE_HINT = {
  [DIFFERENCE_HANDLING.Refund]: "Treatment:Convert:HintRefund",
  [DIFFERENCE_HANDLING.Debt]: "Treatment:Convert:HintDebt",
} as const;

/** Right column: what the line is being converted into, and what that costs. */
export function ConvertNewService({ form }: { form: Form }) {
  const [pickerForm] = Form.useForm<{ serviceId?: string }>();

  return (
    <div className="cvt-col">
      <section className="cvt-section">
        <ConvertHead icon={<RefreshCw size={16} aria-hidden="true" />}>
          {t("Treatment:Convert:NewService")}
        </ConvertHead>

        <p className="cvt-label">{t("Treatment:Refund:ConversionType")}</p>
        <Radio.Group
          className="cvt-kind"
          value={form.conversionType}
          onChange={(event) => form.setConversionType(event.target.value)}
        >
          <Radio value={CONVERSION_TYPE.Replace}>{t("Treatment:Convert:ReplaceOption")}</Radio>
          <Radio value={CONVERSION_TYPE.OldService}>{t("Treatment:Convert:OldService")}</Radio>
        </Radio.Group>

        {form.replacing && (
          <Form form={pickerForm} className="cvt-picker">
            <PlanServicePicker onPickService={form.setService} />
          </Form>
        )}
        {form.errors.service && <p className="cvt-error">{form.errors.service}</p>}

        <FloatingLabel label={t("Treatment:Payment:Payment")} floated={form.charge !== null}>
          <CurrencyInput
            aria-label={t("Treatment:Payment:Payment")}
            value={form.charge ?? undefined}
            onChange={(value) => form.setCharge(value ?? null)}
          />
        </FloatingLabel>

        <FloatingLabel label={t("Treatment:Common:Note")} floated={form.note.length > 0} required>
          <Input.TextArea
            className="cvt-note"
            aria-label={t("Treatment:Common:Note")}
            value={form.note}
            maxLength={1000}
            onChange={(event) => form.setNote(event.target.value)}
            status={form.errors.note ? "error" : undefined}
          />
        </FloatingLabel>
        {form.errors.note && <p className="cvt-error">{form.errors.note}</p>}

        <ConvertStaffBox
          diagnoserId={form.diagnoserId}
          secondDiagnoserId={form.secondDiagnoserId}
          consultantId={form.consultantId}
          secondConsultantId={form.secondConsultantId}
          errors={form.errors}
          onDiagnoser={form.setDiagnoserId}
          onSecondDiagnoser={form.setSecondDiagnoserId}
          onConsultant={form.setConsultantId}
          onSecondConsultant={form.setSecondConsultantId}
        />

        {form.showDifference && (
          <div className="cvt-difference">
            <p className="cvt-label">{t("Treatment:Refund:DifferenceSolution")}</p>
            <Radio.Group
              className="cvt-kind"
              value={form.difference}
              onChange={(event) => form.setDifference(event.target.value)}
            >
              <Radio value={DIFFERENCE_HANDLING.Refund}>{t("Treatment:Refund:Refund")}</Radio>
              <Radio value={DIFFERENCE_HANDLING.Debt}>{t("Treatment:Debt:OutstandingDebt")}</Radio>
            </Radio.Group>
            {form.difference && <p className="cvt-hint">{t(DIFFERENCE_HINT[form.difference])}</p>}
            {form.errors.difference && <p className="cvt-error">{form.errors.difference}</p>}
          </div>
        )}
      </section>

      <div className="cvt-teeth">
        <span>
          {t("Treatment:Tooth:Tooth")}: {formatToothValue(form.teeth)}
        </span>
        <button
          type="button"
          className="cvt-teeth-btn"
          aria-label={t("Treatment:Tooth:SelectTooth")}
          onClick={form.openTeeth}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7 2C4.8 2 3 3.8 3 6c0 2 .5 3.4.9 5.2.3 1.3.5 2.7.6 4.4.1 1.6.3 3 .7 4.2.2.7.8 1.2 1.5 1.2.8 0 1.4-.6 1.6-1.4l.9-4c.2-.9.9-1.6 1.8-1.6s1.6.7 1.8 1.6l.9 4c.2.8.8 1.4 1.6 1.4.7 0 1.3-.5 1.5-1.2.4-1.2.6-2.6.7-4.2.1-1.7.3-3.1.6-4.4C20.5 9.4 21 8 21 6c0-2.2-1.8-4-4-4-1.6 0-2.8.6-3.7 1.1-.8.4-1.1.6-1.3.6s-.5-.2-1.3-.6C9.8 2.6 8.6 2 7 2Z" />
          </svg>
        </button>
      </div>
      {form.errors.teeth && <p className="cvt-error">{form.errors.teeth}</p>}

      <section className="cvt-section">
        <ConvertHead icon={<CircleDollarSign size={16} aria-hidden="true" />}>
          {t("Treatment:Pricing:PaymentInfo")}
        </ConvertHead>
        <ConvertFacts
          tight
          facts={[
            { label: t("Treatment:Pricing:TotalAmount"), value: moneyText(form.money.gross) },
            { label: t("Treatment:Pricing:Discount"), value: moneyText(form.money.discount) },
            { label: t("Treatment:Receipt:TotalPaid"), value: moneyText(form.money.paid) },
            { label: t("Treatment:Refund:ReturnDifference"), value: moneyText(form.money.refund) },
            { label: t("Treatment:Pricing:Remaining"), value: moneyText(form.money.remaining) },
          ]}
        />
      </section>
    </div>
  );
}
