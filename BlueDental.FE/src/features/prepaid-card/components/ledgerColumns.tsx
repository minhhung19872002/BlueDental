import { Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import { formatDateTime, formatVND } from "@/utils/format";
import { TRANSACTION_TYPE, type CardTransactionDto, type TransactionType } from "../types";

const TYPE_CONFIG: Record<TransactionType, { key: string; color: string; credit: boolean }> = {
  [TRANSACTION_TYPE.Issue]: { key: "PrepaidCard:Tx:Issue", color: "blue", credit: true },
  [TRANSACTION_TYPE.Topup]: { key: "PrepaidCard:Tx:Topup", color: "green", credit: true },
  [TRANSACTION_TYPE.Use]: { key: "PrepaidCard:Tx:Use", color: "orange", credit: false },
  [TRANSACTION_TYPE.Refund]: { key: "PrepaidCard:Tx:Refund", color: "purple", credit: true },
  [TRANSACTION_TYPE.Cancel]: { key: "PrepaidCard:Tx:Cancel", color: "red", credit: false },
};

/** What a line was about: the receipt and who spent, or the money taken. */
function detailOf(row: CardTransactionDto): string {
  if (row.patientPaymentCode) {
    return [row.patientPaymentCode, row.patientName].filter(Boolean).join(" · ");
  }
  if (row.paidAmount <= 0) return "";
  return t(row.type === TRANSACTION_TYPE.Cancel ? "PrepaidCard:Tx:PaidBack" : "PrepaidCard:Tx:Paid", formatVND(row.paidAmount));
}

/** "Lịch sử sử dụng thẻ" — every movement, with the balance it left behind. */
export function ledgerColumns(): ColumnsType<CardTransactionDto> {
  return [
    { title: t("PrepaidCard:Tx:Date"), dataIndex: "occurredAt", width: 150, render: (v: string) => formatDateTime(v) },
    {
      title: t("PrepaidCard:Tx:Type"),
      dataIndex: "type",
      width: 120,
      render: (type: TransactionType) => <Tag color={TYPE_CONFIG[type].color}>{t(TYPE_CONFIG[type].key)}</Tag>,
    },
    {
      title: t("PrepaidCard:Tx:Value"),
      key: "value",
      align: "right",
      width: 140,
      render: (_, row) => {
        const credit = TYPE_CONFIG[row.type].credit;
        return (
          <span className={credit ? "prepaid-credit" : "prepaid-debit"}>
            {credit ? "+" : "-"}
            {formatVND(row.value)}
          </span>
        );
      },
    },
    { title: t("PrepaidCard:Tx:BalanceAfter"), dataIndex: "balanceAfter", align: "right", width: 140, render: formatVND },
    { title: t("PrepaidCard:Tx:Detail"), key: "detail", width: 220, render: (_, row) => detailOf(row) || "—" },
    { title: t("PrepaidCard:Tx:Staff"), dataIndex: "staffName", width: 150, render: (v: string | null) => v ?? "—" },
    { title: t("PrepaidCard:Field:Note"), dataIndex: "note", width: 160, ellipsis: true, render: (v: string | null) => v ?? "—" },
  ];
}
