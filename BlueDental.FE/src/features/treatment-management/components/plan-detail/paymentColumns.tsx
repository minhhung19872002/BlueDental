import type { TableColumnsType } from "antd";
import { Eye } from "lucide-react";
import type { RecordCardRow } from "@/components/RecordCard";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import {
  paymentMethodLabels,
  type PatientPaymentDto,
  type TreatmentPlanSlipDto,
} from "../../api/treatmentPlanApi";
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

/** Tab "Thanh toán": the nine columns of production's receipt table. */
export function buildPaymentColumns(
  plan: TreatmentPlanSlipDto,
  onView: (payment: PatientPaymentDto) => void,
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
      width: 88,
      align: "center",
      fixed: "right",
      render: (_, p) => viewButton(p, onView),
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
