import { useMemo } from "react";
import type { TableColumnsType } from "antd";
import { DataTable } from "@/components/DataTable";
import { t } from "@/lib/i18n";
import { diagnosisLabel, lineTotal, money, rowDiscount, type QuoteRow } from "./quoteModel";

const buildColumns = (): TableColumnsType<QuoteRow> => [
  {
    key: "service",
    title: t("Patient:Misc:Service"),
    dataIndex: "service",
    className: "pq-cell-service",
    width: 320,
  },
  {
    key: "diagnosis",
    title: t("Patient:Tab:Diagnosis"),
    width: 160,
    render: (_, row) => <span className="pq-diagnosis">{diagnosisLabel(row)}</span>,
  },
  {
    key: "price",
    title: t("Patient:Payment:UnitPrice"),
    width: 180,
    render: (_, row) => t("{0} (SL. {1})", money(row.unitPrice), row.quantity),
  },
  {
    key: "discount",
    title: t("Patient:Payment:Discount"),
    width: 150,
    render: (_, row) => money(rowDiscount(row)),
  },
  {
    key: "amount",
    title: t("Patient:Payment:Amount"),
    width: 150,
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
