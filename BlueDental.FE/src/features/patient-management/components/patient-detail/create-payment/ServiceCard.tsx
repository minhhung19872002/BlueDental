import type { MouseEvent } from "react";
import { Checkbox } from "antd";
import dayjs from "dayjs";
import { EditOutlined } from "@ant-design/icons";
import type { TreatmentServiceDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { t } from "@/lib/i18n";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import { doctorDiscountOf, listAmount } from "./paymentDialogModel";
import { PaymentLineTermsForm } from "./PaymentLineTermsForm";
import { PaymentRoundHistory, type CurrentRound } from "./PaymentRoundHistory";
import { lineFigures, receiptNameToSend } from "./paymentRounds";
import type { PaymentForm } from "./usePaymentForm";

interface Props {
  payment: PaymentForm;
  line: TreatmentServiceDto;
}

/** This đợt's row of the card's history, once the line is ticked. */
function currentRound(payment: PaymentForm, line: TreatmentServiceDto, round: number): CurrentRound | null {
  const figures = payment.money.figures.find((item) => item.line.id === line.id);
  if (!figures) return null;
  const plain = line.serviceName ?? line.code;
  const amount = payment.money.amountOf(line.id);
  // What TN giảm took off what this đợt collects, its VAT included.
  const discountEffect = lineFigures(line, 0, figures.voucherShare).cap - figures.cap;
  return {
    round,
    name: receiptNameToSend(payment.terms.appliedOf(line.id), plain, round) ?? plain,
    paidOn: formatDate(dayjs(payment.form.paidOn).toDate()),
    amount,
    amountBeforeDiscount: amount + discountEffect,
    discount: figures.discount,
    voucherShare: figures.voucherShare,
    voucherCode: payment.voucher.applied?.code ?? null,
  };
}

/**
 * One service of the slip (P2910): its đợt and the doctor's discount as tags,
 * its prices and Còn nợ, the đợt before this one, and — once ticked — this
 * đợt's terms, folded behind "Chỉnh phiếu đợt N" until opened.
 */
export function ServiceCard({ payment, line }: Props) {
  const { terms, rounds } = payment;
  const checked = payment.form.picked.includes(line.id);
  const expanded = checked && terms.isExpanded(line.id);
  const round = rounds.roundOf(line.id);
  const history = rounds.historyOf(line.id);
  const doctorDiscount = doctorDiscountOf(line);
  const applied = payment.money.figures.find((item) => item.line.id === line.id)?.discount ?? 0;
  const vat =
    line.taxAmount > 0
      ? t("Patient:Payment:IncludesVat", line.taxPercent, formatMoneyUnit(line.taxAmount))
      : t("Patient:Payment:NoVat");

  /**
   * The whole head of the card ticks it, not just the box (owner 2026-11-01,
   * R-1102). A click on the checkbox's own label is left to the checkbox, or
   * the line would tick and untick at once.
   */
  const handleRowClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest(".ant-checkbox-wrapper")) return;
    payment.toggle(line.id, !checked);
  };

  return (
    <li className={checked ? "pd-newpay-card pd-newpay-card--on" : "pd-newpay-card"}>
      <div className="pd-newpay-card-row" onClick={handleRowClick}>
        <Checkbox checked={checked} onChange={(event) => payment.toggle(line.id, event.target.checked)}>
          {round > 1 || doctorDiscount > 0 ? (
            <span className="pd-newpay-tags">
              {round > 1 ? (
                <span className="pd-newpay-tag pd-newpay-tag--round">{t("Patient:Payment:RoundTag", round)}</span>
              ) : null}
              {doctorDiscount > 0 ? (
                <span className="pd-newpay-tag pd-newpay-tag--doctor">
                  {t("Patient:Payment:DoctorDiscountTag", formatMoneyUnit(doctorDiscount))}
                </span>
              ) : null}
            </span>
          ) : null}
          <span className="pd-newpay-name">{line.serviceName ?? line.code}</span>
          <span className="pd-newpay-qty">{[t("Patient:Payment:QuantityValue", line.quantity), vat].join(" · ")}</span>
        </Checkbox>
        <div className="pd-newpay-card-money">
          <span className="pd-newpay-price">
            {t("Patient:Payment:OriginalPrice")} {formatMoneyUnit(listAmount(line))}
          </span>
          {/* Before VAT — after the slip discount and voucher — so the price reads
              as the price; Còn nợ is VAT included, as it is what the receipt collects. */}
          <span className="pd-newpay-price">
            {t("Patient:Payment:DiscountedPrice")} <b>{formatMoneyUnit(line.chargedAmount)}</b>
          </span>
          <span className="pd-newpay-price">{t("Patient:Payment:PaidValue", formatMoneyUnit(line.paidAmount))}</span>
          <span className="pd-newpay-due">
            {t("Patient:Payment:OutstandingValue", formatMoneyUnit(line.outstandingAmount))}
          </span>
        </div>
      </div>

      {history.length > 0 ? (
        <PaymentRoundHistory
          history={history}
          current={checked ? currentRound(payment, line, round) : null}
          serviceName={line.serviceName ?? line.code}
          taxPercent={line.taxPercent}
        />
      ) : null}

      {checked ? (
        <div className="pd-newpay-editrow">
          <button
            type="button"
            className="pd-newpay-editlink"
            aria-expanded={expanded}
            onClick={() => terms.expand(line.id, !expanded)}
          >
            <EditOutlined /> {t(expanded ? "Patient:Payment:EditingRound" : "Patient:Payment:EditRound", round)}
          </button>
          {!expanded && applied > 0 ? (
            <span className="pd-newpay-chip">{t("Patient:Payment:CashierDiscountChip", formatMoneyUnit(applied))}</span>
          ) : null}
        </div>
      ) : null}
      {expanded ? (
        <PaymentLineTermsForm
          line={line}
          round={round}
          draft={terms.draftOf(line.id)}
          onEdit={(patch) => terms.edit(line.id, patch)}
          onApply={() => terms.apply(line.id)}
          onRestore={() => terms.restore(line.id)}
        />
      ) : null}
    </li>
  );
}
