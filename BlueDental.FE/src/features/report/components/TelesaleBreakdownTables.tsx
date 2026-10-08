import { useMemo } from "react";
import { PillTabs } from "@/components/PillTabs";
import { t } from "@/lib/i18n";
import { REPORT_TICKET_CHANNEL, type TelesaleBreakdownRowDto, type TelesaleReportDto } from "../api/customerReportApi";
import { ReportTableCard } from "./ReportTableCard";
import { breakdownColumns, fileColumns, type NamedTelesaleRow } from "./telesaleColumns";

interface Props {
  report: TelesaleReportDto;
}

function named<T extends TelesaleBreakdownRowDto>(rows: T[], labelOf: (row: T) => string, keyOf: (row: T) => string) {
  return rows.map((row): NamedTelesaleRow<T> => ({ ...row, rowKey: keyOf(row), label: labelOf(row) }));
}

/** "Bảng số liệu" under the charts: one pill per breakdown the BA asks for (16.8). */
export function TelesaleBreakdownTables({ report }: Props) {
  const tables = useMemo(() => {
    const byId = (row: TelesaleBreakdownRowDto) => row.id ?? "none";
    return {
      source: named(report.bySource, (r) => r.name ?? t("Report:Telesale:NoSource"), byId),
      channel: named(report.byChannel, (r) => t(`Ticket:Channel:${REPORT_TICKET_CHANNEL[r.channel]}`), (r) => String(r.channel)),
      customerType: named(
        report.byCustomerType,
        (r) => t(r.isReturningCustomer ? "Report:Telesale:Returning" : "Report:Telesale:New"),
        (r) => String(r.isReturningCustomer),
      ),
      file: named(report.byFile, (r) => r.name ?? "", byId),
      assignee: named(report.byAssignee, (r) => r.name ?? t(r.id ? "Report:Unknown" : "Report:Telesale:Unassigned"), byId),
    };
  }, [report]);

  const table = (rows: NamedTelesaleRow[], nameTitle: string) => (
    <ReportTableCard<NamedTelesaleRow>
      rowKey="rowKey"
      columns={breakdownColumns(nameTitle)}
      dataSource={rows}
      pagination={false}
      size="small"
    />
  );

  return (
    <PillTabs
      className="report-breakdown-tabs"
      items={[
        { key: "source", label: t("Report:Telesale:BySource"), children: table(tables.source, t("Report:Telesale:Source")) },
        { key: "customerType", label: t("Report:Telesale:ByCustomerType"), children: table(tables.customerType, t("Report:Telesale:Type")) },
        { key: "channel", label: t("Report:Telesale:ByChannel"), children: table(tables.channel, t("Report:Telesale:Channel")) },
        {
          key: "file",
          label: t("Report:Telesale:ByFile"),
          children: (
            <ReportTableCard
              rowKey="rowKey"
              columns={fileColumns()}
              dataSource={tables.file}
              pagination={false}
              size="small"
            />
          ),
        },
        { key: "assignee", label: t("Report:Telesale:ByAssignee"), children: table(tables.assignee, t("Report:Telesale:Staff")) },
      ]}
    />
  );
}
