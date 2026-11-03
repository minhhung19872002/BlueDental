import { useState } from "react";
import { DownOutlined, RightOutlined } from "@ant-design/icons";
import {
  PAYMENT_STATUS,
  paymentMethodLabels,
  type PatientPaymentStatus,
} from "@/features/treatment-management/api/treatmentPlanApi";
import { t } from "@/lib/i18n";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import type { EarlierRound } from "./paymentRounds";

/** This đợt's row, as the dialog has it so far. */
export interface CurrentRound {
  round: number;
  name: string;
  /** dd/MM/yyyy of the receipt being written. */
  paidOn: string;
  amount: number;
  /** What this đợt would collect without its TN giảm, VAT included. */
  amountBeforeDiscount: number;
  discount: number;
  voucherShare: number;
  voucherCode: string | null;
}

interface Props {
  /** The earlier đợt on the line, oldest first. */
  history: EarlierRound[];
  /** Null while the line is not ticked for this đợt. */
  current: CurrentRound | null;
  serviceName: string;
}

const STATUS_PILLS: Partial<Record<PatientPaymentStatus, { tone: string; label: string }>> = {
  [PAYMENT_STATUS.Pending]: { tone: "pending", label: "Treatment:Payment:Pending" },
  [PAYMENT_STATUS.Issued]: { tone: "issued", label: "Treatment:Payment:Issued" },
  [PAYMENT_STATUS.Completed]: { tone: "done", label: "Treatment:Payment:Completed" },
};

function StatusPill({ status }: { status: PatientPaymentStatus }) {
  const pill = STATUS_PILLS[status];
  if (!pill) return null;
  return <span className={`pd-newpay-pill pd-newpay-pill--${pill.tone}`}>{t(pill.label)}</span>;
}

/** The relief chips of a đợt: its voucher share, its TN giảm and, for the cashier, why. */
function ReliefChips({ voucherCode, voucherShare, discount, reason }: {
  voucherCode: string | null;
  voucherShare: number;
  discount: number;
  reason?: string | null;
}) {
  if (voucherShare <= 0 && discount <= 0) return null;
  return (
    <span className="pd-newpay-chips">
      {voucherShare > 0 ? (
        <span className="pd-newpay-chip pd-newpay-chip--voucher">
          {t("Patient:Payment:VoucherChip", voucherCode ?? "", formatMoneyUnit(voucherShare))}
        </span>
      ) : null}
      {discount > 0 ? (
        <span className="pd-newpay-chip">{t("Patient:Payment:CashierDiscountChip", formatMoneyUnit(discount))}</span>
      ) : null}
      {discount > 0 && reason ? <em>{t("Patient:Payment:ReasonValue", reason)}</em> : null}
    </span>
  );
}

/**
 * This đợt's money. With a TN giảm, what it would have collected is struck
 * through above what it does collect (owner 2026-11-03).
 */
function CurrentMoney({ current }: { current: CurrentRound }) {
  if (current.discount <= 0) return <b>{formatMoneyUnit(current.amount)}</b>;
  return (
    <>
      <s className="pd-newpay-history-was">{formatMoneyUnit(current.amountBeforeDiscount)}</s>
      <b className="pd-newpay-history-discounted">{formatMoneyUnit(current.amount)}</b>
    </>
  );
}

/**
 * "Các đợt thanh toán" on a service card (P2910): every live receipt that
 * already reached the line, with what it collected and its status, then this
 * đợt. Đã thu and Ưu đãi đã dùng count paid receipts only.
 */
export function PaymentRoundHistory({ history, current, serviceName }: Props) {
  const [open, setOpen] = useState(true);
  const methodLabels = paymentMethodLabels();
  const settled = history.filter(({ receipt }) => receipt.status === PAYMENT_STATUS.Completed);
  const paid = settled.reduce((sum, { line }) => sum + line.amount, 0);
  const relief = settled.reduce((sum, { line }) => sum + (line.cashierDiscount ?? 0) + (line.voucherShare ?? 0), 0);

  return (
    <div className="pd-newpay-history">
      <button type="button" aria-expanded={open} onClick={() => setOpen((on) => !on)}>
        {open ? <DownOutlined /> : <RightOutlined />}
        {t(current ? "Patient:Payment:HistoryHeaderNow" : "Patient:Payment:HistoryHeader", history.length)}
      </button>
      {open ? (
        <>
          <ol>
            {history.map(({ receipt, line }, index) => (
              <li key={receipt.id}>
                <span className="pd-newpay-history-round">{t("Patient:Payment:RoundValue", index + 1)}</span>
                <span className="pd-newpay-history-main">
                  <b>{line.receiptName ?? serviceName}</b>
                  <small>{[formatDate(receipt.paidAt), receipt.code, methodLabels[receipt.method]].join(" · ")}</small>
                  <ReliefChips
                    voucherCode={receipt.voucherCode}
                    voucherShare={line.voucherShare ?? 0}
                    discount={line.cashierDiscount ?? 0}
                    reason={line.cashierDiscountReason}
                  />
                </span>
                <span className="pd-newpay-history-money">
                  <b>{formatMoneyUnit(line.amount)}</b>
                  <StatusPill status={receipt.status} />
                </span>
              </li>
            ))}
            {current ? (
              <li className="pd-newpay-history-now">
                <span className="pd-newpay-history-round">{t("Patient:Payment:RoundValue", current.round)}</span>
                <span className="pd-newpay-history-main">
                  <b>{current.name}</b>
                  <small>{t("Patient:Payment:ThisReceipt", current.paidOn)}</small>
                  <ReliefChips
                    voucherCode={current.voucherCode}
                    voucherShare={current.voucherShare}
                    discount={current.discount}
                  />
                </span>
                <span className="pd-newpay-history-money">
                  <CurrentMoney current={current} />
                  <StatusPill status={PAYMENT_STATUS.Pending} />
                </span>
              </li>
            ) : null}
          </ol>
          <p className="pd-newpay-history-foot">
            <span>{t("Patient:Payment:HistoryPaid", settled.length, formatMoneyUnit(paid))}</span>
            <span>{t("Patient:Payment:HistoryRelief", formatMoneyUnit(relief))}</span>
          </p>
        </>
      ) : null}
    </div>
  );
}
