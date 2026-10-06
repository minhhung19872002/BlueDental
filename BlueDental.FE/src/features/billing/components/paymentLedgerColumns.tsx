import { Link } from "react-router-dom";
import type { TableColumnsType } from "antd";
import { Eye, FileText } from "lucide-react";
import { ActionTooltip } from "@/components/ActionTooltip";
import { formatDateTime, formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";
import { ledgerMethodLabels, type LedgerMethod, type PaymentLedgerItemDto } from "../api/paymentLedgerApi";

/**
 * The plan's Thanh toán tab, where the receipt was written. Spelled out here
 * because billing may not import treatment-management's `planDetailPath`.
 */
function planPaymentPath(patientId: string, planId: string, branchId: string): string {
  const params = new URLSearchParams({ planTab: "payment-v2" });
  if (branchId) params.set("branchId", branchId);
  return `/patient/${patientId}/treatment-plan/${planId}?${params.toString()}`;
}

const dash = (value: string | null | undefined) => value || "—";

export interface LedgerRowActions {
  /** Omitted without patient.read and treatmentConsultation.read: the sheet reads both. */
  onView?: (row: PaymentLedgerItemDto) => void;
  /** Omitted without payment.finalize. */
  onIssueEInvoice?: (row: PaymentLedgerItemDto) => void;
}

/**
 * Xem / In and Xuất hoá đơn điện tử — the two of the plan tab's four that
 * leave the receipt as it is. Sửa and Huỷ stay on the plan (owner, 2026-10-06).
 */
function rowActions(row: PaymentLedgerItemDto, { onView, onIssueEInvoice }: LedgerRowActions) {
  // The sheet is drawn from the receipt's slip.
  if (!row.treatmentPlanId) return null;
  return (
    <span className="billing-row-actions">
      {onView && (
        <ActionTooltip title={t("Xem")}>
          <button
            type="button"
            className="billing-row-action"
            aria-label={t("Treatment:Payment:ViewPaymentFor", row.code)}
            onClick={() => onView(row)}
          >
            <Eye size={16} aria-hidden="true" />
          </button>
        </ActionTooltip>
      )}
      {onIssueEInvoice && row.canIssueEInvoice && (
        <ActionTooltip title={t("Treatment:EInvoice:Issue")}>
          <button
            type="button"
            className="billing-row-action"
            aria-label={t("Billing:Ledger:IssueEInvoiceFor", row.code)}
            onClick={() => onIssueEInvoice(row)}
          >
            <FileText size={16} aria-hidden="true" />
          </button>
        </ActionTooltip>
      )}
    </span>
  );
}

export function buildPaymentLedgerColumns(
  branchId: string,
  actions: LedgerRowActions,
): TableColumnsType<PaymentLedgerItemDto> {
  const methods = ledgerMethodLabels();
  return [
    {
      title: t("Treatment:Payment:PaymentCode"),
      dataIndex: "code",
      key: "code",
      width: 190,
      render: (value: string) => <strong className="billing-ledger-code">{value}</strong>,
    },
    {
      title: t("Billing:Ledger:Date"),
      dataIndex: "paidAt",
      key: "paidAt",
      width: 140,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: t("Billing:Customer"),
      key: "patient",
      width: 200,
      render: (_: unknown, row) => (
        <>
          <div>{dash(row.patientName)}</div>
          <div className="billing-ledger-sub">{row.patientCode}</div>
        </>
      ),
    },
    {
      title: t("Billing:Ledger:Plan"),
      key: "plan",
      width: 200,
      render: (_: unknown, row) => {
        if (!row.treatmentPlanId) return "—";
        return (
          <Link to={planPaymentPath(row.patientId, row.treatmentPlanId, branchId)}>
            <div>{row.treatmentPlanCode}</div>
            {row.treatmentPlanTitle && (
              <div className="billing-ledger-sub">{row.treatmentPlanTitle}</div>
            )}
          </Link>
        );
      },
    },
    {
      title: t("Billing:Ledger:Services"),
      dataIndex: "serviceNames",
      key: "serviceNames",
      width: 220,
      ellipsis: { showTitle: true },
      render: dash,
    },
    {
      title: t("Billing:Amount"),
      dataIndex: "amount",
      key: "amount",
      width: 130,
      align: "right",
      render: (value: number) => <strong className="billing-ledger-amount">{formatVND(value)}</strong>,
    },
    {
      title: t("Billing:PaymentMethodLabel"),
      dataIndex: "method",
      key: "method",
      width: 150,
      render: (value: LedgerMethod) => methods[value] ?? "—",
    },
    {
      title: t("Billing:Ledger:Cashier"),
      dataIndex: "staffName",
      key: "staffName",
      width: 150,
      render: dash,
    },
    {
      title: t("Billing:Ledger:Note"),
      dataIndex: "note",
      key: "note",
      width: 180,
      ellipsis: { showTitle: true },
      render: dash,
    },
    {
      title: t("Common:Actions"),
      key: "actions",
      width: 100,
      align: "center",
      fixed: "right",
      render: (_: unknown, row) => rowActions(row, actions),
    },
  ];
}
