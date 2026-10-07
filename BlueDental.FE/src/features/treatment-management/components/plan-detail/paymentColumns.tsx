import type { ReactNode } from "react";
import type { TableColumnsType } from "antd";
import { CircleCheck, Eye, FileText, Pencil, Trash2 } from "lucide-react";
import type { RecordCardRow } from "@/components/RecordCard";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import {
  PAYMENT_STATUS,
  paymentMethodLabels,
  type PatientPaymentDto,
  type TreatmentPlanSlipDto,
} from "../../api/treatmentPlanApi";
import { ActionTooltip } from "@/components/ActionTooltip";
import { moneyText } from "../plan/planTypes";
import { dash, paymentServiceNames } from "./planDetailTypes";

/**
 * A receipt is written "Chưa thanh toán" and reads "Hoàn tất" once confirmed
 * (BA 2026-10-08). A cancelled one reads "Đã hủy" with who, when and why (bug
 * list item 28).
 */
function StatusPill({ payment }: { payment: PatientPaymentDto }) {
  if (!payment.isDeleted && payment.status === PAYMENT_STATUS.Pending) {
    return <span className="tp-pill tp-pill--pending">{t("Treatment:Payment:Pending")}</span>;
  }
  if (!payment.isDeleted) {
    return <span className="tp-pill tp-pill--done">{t("Treatment:Payment:Completed")}</span>;
  }
  return (
    <span className="pdt-cancelled">
      <span className="tp-pill tp-pill--cancelled">{t("Treatment:Payment:Cancelled")}</span>
      <span className="pdt-cancelled-by">
        {t("Treatment:Payment:CancelledBy", payment.cancelledByName ?? "-", formatDateTime(payment.deletionTime ?? ""))}
      </span>
      {payment.cancelReason && (
        <span className="pdt-cancelled-reason">{t("Treatment:Payment:CancelReasonShown", payment.cancelReason)}</span>
      )}
    </span>
  );
}

function viewButton(payment: PatientPaymentDto, onView: (payment: PatientPaymentDto) => void) {
  return (
    <button
      type="button"
      className="tp-eye"
      aria-label={t("Treatment:Payment:ViewPaymentFor", payment.code)}
      onClick={() => onView(payment)}
    >
      <Eye size={16} aria-hidden="true" />
    </button>
  );
}

/** What a receipt row can do: look at it, confirm, correct it, take it back, or e-invoice. */
export interface PaymentRowActions {
  onView: (payment: PatientPaymentDto) => void;
  /** "Xác nhận thanh toán"; left out without payment.update. */
  onConfirm?: (payment: PatientPaymentDto) => void;
  /** Left out when the user may not edit a receipt (payment.update). */
  onEdit?: (payment: PatientPaymentDto) => void;
  /** Left out when the user may not void a receipt (payment.delete). */
  onCancel?: (payment: PatientPaymentDto) => void;
  /** Left out when the user cannot finalize (payment.finalize). */
  onIssueInvoice?: (payment: PatientPaymentDto) => void;
  /** False for a receipt the server would refuse to invoice again. */
  canIssueInvoice?: (payment: PatientPaymentDto) => boolean;
  /** The receipt's e-invoice badge, when it has one. */
  renderEInvoice?: (payment: PatientPaymentDto) => ReactNode;
}

/** "Hoàn tất", with the receipt's e-invoice underneath when one was filed. */
function statusCell(payment: PatientPaymentDto, renderEInvoice?: (payment: PatientPaymentDto) => ReactNode) {
  return (
    <span className="pdt-status-cell">
      <StatusPill payment={payment} />
      {renderEInvoice?.(payment)}
    </span>
  );
}

/**
 * Which actions a receipt still offers. A cancelled one is only looked at. A
 * "Chưa thanh toán" one is confirmed, corrected or cancelled but not invoiced —
 * no money has come in yet. A "Hoàn tất" one is final: no edit, no cancel.
 */
export function actionsFor(payment: PatientPaymentDto, all: PaymentRowActions): PaymentRowActions {
  if (payment.isDeleted) return { onView: all.onView };
  if (payment.status === PAYMENT_STATUS.Pending) {
    return { onView: all.onView, onConfirm: all.onConfirm, onEdit: all.onEdit, onCancel: all.onCancel };
  }
  return {
    onView: all.onView,
    onIssueInvoice: all.onIssueInvoice,
    canIssueInvoice: all.canIssueInvoice,
    renderEInvoice: all.renderEInvoice,
  };
}

/**
 * The actions on a receipt row: Xem, Xác nhận thanh toán, Chỉnh sửa and a red
 * Huỷ. They sit in a 28px ghost button each, the danger one in red, as the
 * reference's own toolbar does.
 */
function rowActions(payment: PatientPaymentDto, allActions: PaymentRowActions) {
  const actions = actionsFor(payment, allActions);
  return (
    <span className="pdt-row-actions">
      <ActionTooltip title={t("Xem")}>
        <button
          type="button"
          className="pdt-row-action"
          aria-label={t("Treatment:Payment:ViewPaymentFor", payment.code)}
          onClick={() => actions.onView(payment)}
        >
          <Eye size={16} aria-hidden="true" />
        </button>
      </ActionTooltip>
      {actions.onConfirm && (
        <ActionTooltip title={t("Treatment:Payment:ConfirmPayment")}>
          <button
            type="button"
            className="pdt-row-action pdt-row-action--confirm"
            aria-label={t("Treatment:Payment:ConfirmPaymentFor", payment.code)}
            onClick={() => actions.onConfirm?.(payment)}
          >
            <CircleCheck size={16} aria-hidden="true" />
          </button>
        </ActionTooltip>
      )}
      {actions.onEdit && (
        <ActionTooltip title={t("Common:Edit")}>
          <button
            type="button"
            className="pdt-row-action"
            aria-label={t("Treatment:Payment:EditPaymentFor", payment.code)}
            onClick={() => actions.onEdit?.(payment)}
          >
            <Pencil size={16} aria-hidden="true" />
          </button>
        </ActionTooltip>
      )}
      {actions.onCancel && (
        <ActionTooltip title={t("Common:CancelAlt")}>
          <button
            type="button"
            className="pdt-row-action pdt-row-action--danger"
            aria-label={t("Treatment:Payment:CancelPaymentFor", payment.code)}
            onClick={() => actions.onCancel?.(payment)}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </ActionTooltip>
      )}
      {actions.onIssueInvoice && actions.canIssueInvoice?.(payment) !== false && (
        <ActionTooltip title={t("Treatment:EInvoice:Issue")}>
          <button
            type="button"
            className="pdt-row-action"
            aria-label={t("Treatment:EInvoice:Issue")}
            onClick={() => actions.onIssueInvoice?.(payment)}
          >
            <FileText size={16} aria-hidden="true" />
          </button>
        </ActionTooltip>
      )}
    </span>
  );
}

/** Tab "Thanh toán": the nine columns of production's receipt table. */
export function buildPaymentColumns(
  plan: TreatmentPlanSlipDto,
  actions: PaymentRowActions,
): TableColumnsType<PatientPaymentDto> {
  const methods = paymentMethodLabels();
  return [
    { key: "code", title: t("Treatment:Payment:PaymentCode"), width: 160, render: (_, p) => p.code },
    // "Ngày tạo" is when the receipt was written; `paidAt` moves to the confirm time.
    { key: "creationTime", title: t("Treatment:Payment:DateCreated"), width: 150, render: (_, p) => formatDateTime(p.creationTime) },
    { key: "services", title: t("Treatment:Payment:TreatmentServices"), width: 220, render: (_, p) => paymentServiceNames(p, plan) },
    { key: "planTotal", title: t("Treatment:Payment:PlanTotal"), width: 170, align: "right", render: () => moneyText(plan.totalAmount) },
    { key: "amount", title: t("Treatment:Payment:Payment"), width: 160, align: "right", render: (_, p) => moneyText(p.amount) },
    { key: "method", title: t("Treatment:Payment:PaymentMethod"), width: 230, render: (_, p) => methods[p.method] },
    { key: "note", title: t("Treatment:Common:Note"), width: 180, render: (_, p) => dash(p.note) },
    { key: "status", title: t("Common:Status"), width: 200, render: (_, p) => statusCell(p, actions.renderEInvoice) },
    {
      key: "actions",
      title: t("Common:Actions"),
      width: 170,
      align: "center",
      fixed: "right",
      render: (_, p) => rowActions(p, actions),
    },
  ];
}

/** The same receipt as card rows: four visible, the rest behind "Xem thêm". */
export function paymentCardRows(
  payment: PatientPaymentDto,
  plan: TreatmentPlanSlipDto,
  renderEInvoice?: (payment: PatientPaymentDto) => ReactNode,
) {
  const methods = paymentMethodLabels();
  const rows: RecordCardRow[] = [
    { key: "code", label: t("Treatment:Payment:PaymentCode"), value: payment.code },
    { key: "creationTime", label: t("Treatment:Payment:DateCreated"), value: formatDateTime(payment.creationTime) },
    { key: "services", label: t("Treatment:Payment:TreatmentServices"), value: paymentServiceNames(payment, plan) },
    { key: "planTotal", label: t("Treatment:Payment:PlanTotal"), value: moneyText(plan.totalAmount) },
  ];
  const moreRows: RecordCardRow[] = [
    { key: "amount", label: t("Treatment:Payment:Payment"), value: moneyText(payment.amount) },
    { key: "method", label: t("Treatment:Payment:PaymentMethod"), value: methods[payment.method] },
    { key: "note", label: t("Treatment:Common:Note"), value: dash(payment.note) },
    { key: "status", label: t("Common:Status"), value: statusCell(payment, renderEInvoice) },
  ];
  return { rows, moreRows };
}

/** Tab "Hoàn tiền": the seven columns of production's refund table. */
export function buildRefundColumns(
  plan: TreatmentPlanSlipDto,
  onView: (payment: PatientPaymentDto) => void,
): TableColumnsType<PatientPaymentDto> {
  const methods = paymentMethodLabels();
  return [
    { key: "code", title: t("Treatment:Refund:RefundCode"), width: 170, render: (_, p) => p.code },
    { key: "paidAt", title: t("Treatment:Payment:DateCreated"), width: 150, render: (_, p) => formatDateTime(p.paidAt) },
    { key: "services", title: t("Treatment:Service:Service"), width: 320, render: (_, p) => paymentServiceNames(p, plan) },
    { key: "amount", title: t("Treatment:Refund:AmountRefunded"), width: 150, align: "right", render: (_, p) => moneyText(p.amount) },
    { key: "method", title: t("Treatment:Payment:PaymentMethod"), width: 220, render: (_, p) => methods[p.method] },
    { key: "note", title: t("Treatment:Common:Note"), width: 220, render: (_, p) => dash(p.note) },
    {
      key: "actions",
      title: t("Common:Actions"),
      width: 70,
      align: "center",
      fixed: "right",
      render: (_, p) => viewButton(p, onView),
    },
  ];
}

export function refundCardRows(payment: PatientPaymentDto, plan: TreatmentPlanSlipDto) {
  const methods = paymentMethodLabels();
  const rows: RecordCardRow[] = [
    { key: "code", label: t("Treatment:Refund:RefundCode"), value: payment.code },
    { key: "paidAt", label: t("Treatment:Payment:DateCreated"), value: formatDateTime(payment.paidAt) },
    { key: "services", label: t("Treatment:Service:Service"), value: paymentServiceNames(payment, plan) },
    { key: "amount", label: t("Treatment:Refund:AmountRefunded"), value: moneyText(payment.amount) },
  ];
  const moreRows: RecordCardRow[] = [
    { key: "method", label: t("Treatment:Payment:PaymentMethod"), value: methods[payment.method] },
    { key: "note", label: t("Treatment:Common:Note"), value: dash(payment.note) },
  ];
  return { rows, moreRows };
}
