import { Input, Modal, Select } from "antd";
import { Calendar, Loader2, Save, Search, X } from "lucide-react";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FloatingLabel } from "@/components/FloatingLabel";
import { t } from "@/lib/i18n";
import { formatShortDate } from "@/utils/format";
import type { PatientPaymentDto, TreatmentPlanSlipDto } from "../../api/treatmentPlanApi";
import { moneyText } from "../plan/planTypes";
import { RefundLinesTable } from "./RefundLinesTable";
import { REFUND_METHODS, REFUND_TYPE, refundMethodLabels, useRefundForm, type RefundType } from "./useRefundForm";

interface Props {
  open: boolean;
  plan: TreatmentPlanSlipDto;
  branchId: string;
  refunds: PatientPaymentDto[];
  heldForPatient: number;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * "Hoàn tiền" — the dialog behind the button on the refund tab: type, channel
 * and date stacked on the left, the note on the right, then a box per paid
 * service (or one box for the held balance) and the total the patient gets back.
 * The channel is a label only — production picks no account for a refund.
 */
export function RefundDialog({ open, plan, branchId, refunds, heldForPatient, onClose, onSaved }: Props) {
  const form = useRefundForm({ open, plan, branchId, refunds, heldForPatient, onSaved });
  const methods = refundMethodLabels();
  const typeOptions: { value: RefundType; label: string }[] = [
    { value: REFUND_TYPE.service, label: t("Hoàn tiền dịch vụ") },
    { value: REFUND_TYPE.debt, label: t("Hoàn tiền dư nợ") },
  ];

  return (
    <Modal
      open={open}
      title={t("Hoàn tiền")}
      className="tp-dialog pdt-refund-dialog"
      width="min(1240px, calc(100vw - 32px))"
      closeIcon={<X size={20} aria-hidden="true" />}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <div className="pdt-confirm-foot">
          <button type="button" className="tp-btn tp-btn--primary" disabled={form.saving} onClick={form.save}>
            {form.saving ? (
              <Loader2 size={16} className="pdt-spin" aria-hidden="true" />
            ) : (
              <Save size={16} aria-hidden="true" />
            )}
            {t("Lưu")}
          </button>
        </div>
      }
    >
      <div className="pdt-refund-form">
        <div className="pdt-refund-fields">
          <FloatingLabel label={t("Loại")} floated>
            <Select<RefundType> value={form.type} options={typeOptions} onChange={form.setType} aria-label={t("Loại")} />
          </FloatingLabel>
          <FloatingLabel label={t("Hình thức")} floated>
            <Select
              value={form.method}
              options={REFUND_METHODS.map((method) => ({ value: method, label: methods[method] }))}
              onChange={form.setMethod}
              prefix={<Search size={16} aria-hidden="true" />}
              aria-label={t("Hình thức")}
            />
          </FloatingLabel>
          <FloatingLabel label={t("Ngày tạo")} floated>
            <Input
              value={formatShortDate(new Date())}
              suffix={<Calendar size={16} aria-hidden="true" />}
              disabled
            />
          </FloatingLabel>
        </div>
        <FloatingLabel label={t("Nội dung")} floated className="pdt-refund-note">
          <Input.TextArea
            value={form.note}
            maxLength={500}
            showCount
            onChange={(event) => form.setNote(event.target.value)}
            aria-label={t("Nội dung")}
          />
        </FloatingLabel>
      </div>

      {form.type === REFUND_TYPE.service ? (
        <RefundLinesTable lines={form.lines} onAmountChange={form.setLineAmount} />
      ) : (
        <div className="pdt-refund-debt">
          <p>
            {t("Dư nợ hiện có")}: <strong>{moneyText(heldForPatient)}</strong>
          </p>
          <FloatingLabel label={t("Số tiền hoàn")} floated required>
            <CurrencyInput
              value={form.debtAmount}
              onChange={form.setDebtAmount}
              aria-label={t("Số tiền hoàn")}
              status={(form.debtAmount ?? 0) > heldForPatient ? "error" : undefined}
            />
          </FloatingLabel>
        </div>
      )}

      <p className="pdt-refund-total">
        <span>{t("Tổng tiền trả")}:</span>
        <strong>{moneyText(form.total)}</strong>
      </p>
    </Modal>
  );
}
