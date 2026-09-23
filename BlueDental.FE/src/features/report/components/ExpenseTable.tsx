import { useMemo } from "react";
import type { TableColumnsType } from "antd";
import { t } from "@/lib/i18n";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import { useClientPaging } from "../hooks/useClientPaging";
import type { ServiceLineDto } from "../api/clinicReportApi";
import { ReportTableCard } from "./ReportTableCard";
import { groupSpans, spanCell } from "./tableSpans";

interface Props {
  data: ServiceLineDto[];
  loading: boolean;
}

function buildColumns(rows: ServiceLineDto[]): TableColumnsType<ServiceLineDto> {
  const dateSpans = groupSpans(rows, (r) => r.date);
  const patientSpans = groupSpans(rows, (r) => `${r.date}|${r.patientLabel}`);
  return [
    {
      title: t("Report:Column:Date"),
      dataIndex: "date",
      width: 130,
      render: (v: string) => formatDate(v),
      onCell: spanCell(dateSpans),
    },
    {
      title: t("Report:Column:CustomerName"),
      dataIndex: "patientLabel",
      width: 190,
      render: (v: string) => <span className="report-patient-link">{v}</span>,
      onCell: spanCell(patientSpans),
    },
    { title: t("Report:Column:CounselorName"), dataIndex: "counselorName", width: 170 },
    { title: t("Report:Column:DoctorName"), dataIndex: "doctorName", width: 180 },
    {
      title: t("Report:Column:TreatmentService"),
      dataIndex: "serviceName",
      width: 190,
      render: (v: string, row) => (
        <>
          {v}
          {row.cancelled && <span className="report-cancelled-label"> ({t("Report:ServiceStatus:Cancelled")})</span>}
        </>
      ),
    },
    { title: t("Report:Column:Quantity"), dataIndex: "quantity", width: 120, align: "center" },
    {
      title: t("Report:Column:TotalAmount"),
      dataIndex: "totalAmount",
      width: 140,
      align: "right",
      render: (v: number) => <span className="report-money">{formatMoneyUnit(v)}</span>,
    },
    {
      title: t("Report:Column:PaidAmount"),
      dataIndex: "paidAmount",
      width: 160,
      align: "right",
      render: (v: number) => <span className="report-money">{formatMoneyUnit(v)}</span>,
    },
  ];
}

/** Grouped service table: date and patient cells merge across consecutive rows. */
export function ExpenseTable({ data, loading }: Props) {
  const paging = useClientPaging(data);
  const columns = useMemo(() => buildColumns(paging.pageRows), [paging.pageRows]);

  return (
    <ReportTableCard<ServiceLineDto>
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
