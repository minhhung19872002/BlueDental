import { useMemo } from "react";
import type { TableColumnsType } from "antd";
import { DataTable } from "@/components/DataTable";
import { t } from "@/lib/i18n";
import { lineTotal, money, rowDiscount, type QuoteRow } from "./quoteModel";

/** Dịch vụ | Số lượng | Đơn giá | Giảm giá | Thành tiền — no Chẩn đoán column (R-1334). */
const buildColumns = (): TableColumnsType<QuoteRow> => [
  {
    key: "service",
    title: t("Patient:Misc:ServiceLabel"),
    dataIndex: "service",
    className: "pq-cell-service",
    width: 280,
  },
  {
    key: "quantity",
    title: t("Patient:Payment:Quantity"),
    dataIndex: "quantity",
    align: "center",
    width: 96,
  },
  {
    key: "price",
    title: t("Patient:Payment:UnitPrice"),
    width: 144,
    render: (_, row) => money(row.unitPrice),
  },
  {
    key: "discount",
    title: t("Patient:Payment:Discount"),
    width: 128,
    render: (_, row) => money(rowDiscount(row)),
  },
  {
    key: "amount",
    title: t("Patient:Payment:Amount"),
    width: 144,
    render: (_, row) => money(lineTotal(row)),
  },
];

/** "DANH SÁCH DỊCH VỤ BÁO GIÁ" — the ticked rows, unpaginated. */
export function QuoteServiceTable({ rows }: { rows: QuoteRow[] }) {
  const columns = useMemo(buildColumns, []);
  return (
    <section className="pq-services">
      <h3 className="pq-section-title">{t("Patient:Quote:ServiceListTitle")}</h3>
      <DataTable<QuoteRow>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: t("Patient:Advise:NoQuoteService") }}
      />
    </section>
  );
}
