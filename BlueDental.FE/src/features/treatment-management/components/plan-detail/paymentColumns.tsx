import type { TableColumnsType } from "antd";
import { Eye, Pencil, Trash2 } from "lucide-react";
import type { RecordCardRow } from "@/components/RecordCard";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import {
  paymentMethodLabels,
  type PatientPaymentDto,
  type TreatmentPlanSlipDto,
} from "../../api/treatmentPlanApi";
import { ActionTooltip } from "../plan/ActionTooltip";
import { moneyText } from "../plan/planTypes";
import { dash, paymentServiceNames } from "./planDetailTypes";

/** Every receipt on file is settled; the reference prints "Hoàn tất" on each. */
function StatusPill() {
  return <span className="tp-pill tp-pill--done">{t("Hoàn tất")}</span>;
}

function viewButton(payment: PatientPaymentDto, onView: (payment: PatientPaymentDto) => void) {
  return (
    <button
      type="button"
      className="tp-eye"
      aria-label={t("Xem phiếu {0}", payment.code)}
      onClick={() => onView(payment)}
    >
      <Eye size={16} aria-hidden="true" />
    </button>
  );
}

/** What a receipt row can do: look at it, correct it, or take it back. */
export interface PaymentRowActions {
  onView: (payment: PatientPaymentDto) => void;
  onEdit: (payment: PatientPaymentDto) => void;
  onCancel: (payment: PatientPaymentDto) => void;
}

/**
 * The three actions the reference puts on a receipt row: Xem, Chỉnh sửa and a
 * red Huỷ. They sit in a 28px ghost button each, the last one in the danger
 * colour, as its own toolbar does.
 */
function rowActions(payment: PatientPaymentDto, actions: PaymentRowActions) {
  return (
    <span className="pdt-row-actions">
      <ActionTooltip title={t("Xem")}>
        <button
          type="button"
          className="pdt-row-action"
          aria-label={t("Xem phiếu {0}", payment.code)}
          onClick={() => actions.onView(payment)}
        >
          <Eye size={16} aria-hidden="true" />
        </button>
      </ActionTooltip>
      <ActionTooltip title={t("Chỉnh sửa")}>
        <button
          type="button"
          className="pdt-row-action"
          aria-label={t("Chỉnh sửa phiếu {0}", payment.code)}
          onClick={() => actions.onEdit(payment)}
        >
          <Pencil size={16} aria-hidden="true" />
        </button>
      </ActionTooltip>
      <ActionTooltip title={t("Huỷ")}>
        <button
          type="button"
          className="pdt-row-action pdt-row-action--danger"
          aria-label={t("Huỷ phiếu {0}", payment.code)}
          onClick={() => actions.onCancel(payment)}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </ActionTooltip>
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
    { key: "code", title: t("Mã thanh toán"), width: 160, render: (_, p) => p.code },
    { key: "paidAt", title: t("Ngày tạo"), width: 150, render: (_, p) => formatDateTime(p.paidAt) },
    { key: "services", title: t("Dịch vụ điều trị"), width: 220, render: (_, p) => paymentServiceNames(p, plan) },
    { key: "planTotal", title: t("Tổng tiền phiếu"), width: 170, align: "right", render: () => moneyText(plan.totalAmount) },
    { key: "amount", title: t("Thanh toán"), width: 160, align: "right", render: (_, p) => moneyText(p.amount) },
    { key: "method", title: t("Phương thức thanh toán"), width: 230, render: (_, p) => methods[p.method] },
    { key: "note", title: t("Ghi chú"), width: 180, render: (_, p) => dash(p.note) },
    { key: "status", title: t("Trạng thái"), width: 160, render: () => <StatusPill /> },
    {
      key: "actions",
      title: t("Thao tác"),
      width: 120,
      align: "center",
      fixed: "right",
      render: (_, p) => rowActions(p, actions),
    },
  ];
}

/** The same receipt as card rows: four visible, the rest behind "Xem thêm". */
export function paymentCardRows(payment: PatientPaymentDto, plan: TreatmentPlanSlipDto) {
  const methods = paymentMethodLabels();
  const rows: RecordCardRow[] = [
    { key: "code", label: t("Mã thanh toán"), value: payment.code },
    { key: "paidAt", label: t("Ngày tạo"), value: formatDateTime(payment.paidAt) },
    { key: "services", label: t("Dịch vụ điều trị"), value: paymentServiceNames(payment, plan) },
    { key: "planTotal", label: t("Tổng tiền phiếu"), value: moneyText(plan.totalAmount) },
  ];
  const moreRows: RecordCardRow[] = [
    { key: "amount", label: t("Thanh toán"), value: moneyText(payment.amount) },
    { key: "method", label: t("Phương thức thanh toán"), value: methods[payment.method] },
    { key: "note", label: t("Ghi chú"), value: dash(payment.note) },
    { key: "status", label: t("Trạng thái"), value: <StatusPill /> },
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
    { key: "code", title: t("Mã hoàn tiền"), width: 170, render: (_, p) => p.code },
    { key: "paidAt", title: t("Ngày tạo"), width: 150, render: (_, p) => formatDateTime(p.paidAt) },
    { key: "services", title: t("Dịch vụ"), width: 320, render: (_, p) => paymentServiceNames(p, plan) },
    { key: "amount", title: t("Đã hoàn"), width: 150, align: "right", render: (_, p) => moneyText(p.amount) },
    { key: "method", title: t("Phương thức thanh toán"), width: 220, render: (_, p) => methods[p.method] },
    { key: "note", title: t("Ghi chú"), width: 220, render: (_, p) => dash(p.note) },
    {
      key: "actions",
      title: t("Thao tác"),
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
    { key: "code", label: t("Mã hoàn tiền"), value: payment.code },
    { key: "paidAt", label: t("Ngày tạo"), value: formatDateTime(payment.paidAt) },
    { key: "services", label: t("Dịch vụ"), value: paymentServiceNames(payment, plan) },
    { key: "amount", label: t("Đã hoàn"), value: moneyText(payment.amount) },
  ];
  const moreRows: RecordCardRow[] = [
    { key: "method", label: t("Phương thức thanh toán"), value: methods[payment.method] },
    { key: "note", label: t("Ghi chú"), value: dash(payment.note) },
  ];
  return { rows, moreRows };
}
