import { useMemo } from "react";
import type { TableColumnsType } from "antd";
import { t } from "@/lib/i18n";
import { formatDate, formatVND } from "@/utils/format";
import { useClientPaging } from "../hooks/useClientPaging";
import type { ServiceLineVm } from "../types/mock";
import { ReportTableCard } from "./ReportTableCard";
import { groupSpans, spanCell } from "./tableSpans";

interface Props {
  data: ServiceLineVm[];
  loading: boolean;
}

function buildColumns(rows: ServiceLineVm[]): TableColumnsType<ServiceLineVm> {
  const dateSpans = groupSpans(rows, (r) => r.date);
  const patientSpans = groupSpans(rows, (r) => `${r.date}|${r.patientLabel}`);
  return [
    {
      title: t("Ngày"),
      dataIndex: "date",
      width: 110,
      render: (v: string) => formatDate(v),
      onCell: spanCell(dateSpans),
    },
    {
      title: t("Tên khách hàng"),
      dataIndex: "patientLabel",
      width: 220,
      render: (v: string) => <span className="report-patient-link">{v}</span>,
      onCell: spanCell(patientSpans),
    },
    { title: t("Nhân sự tư vấn"), dataIndex: "counselorName", width: 200 },
    { title: t("Bác sĩ tiếp nhận"), dataIndex: "doctorName", width: 190 },
    {
      title: t("Dịch vụ điều trị"),
      dataIndex: "serviceName",
      render: (v: string, row) => (
        <>
          {v}
          {row.cancelled && <span className="report-cancelled-label"> ({t("đã hủy")})</span>}
        </>
      ),
    },
    { title: t("Số lượng"), dataIndex: "quantity", width: 90, align: "center" },
    {
      title: t("Thành tiền"),
      dataIndex: "totalAmount",
      width: 140,
      align: "right",
      render: (v: number) => <span className="report-money">{formatVND(v)} đ</span>,
    },
    {
      title: t("Đã thanh toán"),
      dataIndex: "paidAmount",
      width: 150,
      align: "right",
      render: (v: number) => <span className="report-money">{formatVND(v)} đ</span>,
    },
  ];
}

/** Grouped service table: date and patient cells merge across consecutive rows. */
export function ExpenseTable({ data, loading }: Props) {
  const paging = useClientPaging(data);
  const columns = useMemo(() => buildColumns(paging.pageRows), [paging.pageRows]);

  return (
    <ReportTableCard<ServiceLineVm>
      rowKey="id"
      columns={columns}
      dataSource={paging.pageRows}
      loading={loading}
      totalCount={paging.totalCount}
      page={paging.page}
      pageSize={paging.pageSize}
      onPageChange={paging.onPageChange}
    />
  );
}
