import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import { DataTable } from "@/components/DataTable";
import { useTablePagination } from "@/hooks/useTablePagination";
import { countedTotal } from "@/utils/countedTotal";
import { formatDate } from "@/utils/format";
import { ratePercent } from "../../api/statsAdapters";
import type { StatsTemplate } from "../../api/statsApi";
import { channelLabels } from "../../api/templateApi";
import { formatCount, formatPercent } from "./statsFormat";
import { StatsMeter } from "./StatsMeter";

interface Props {
  templates: StatsTemplate[];
  loading: boolean;
}

function buildColumns(): ColumnsType<StatsTemplate> {
  const channels = channelLabels();
  return [
    {
      key: "name",
      title: t("CSKH:Stats:Col:Template"),
      width: 280,
      render: (_, row) => <span className="cskh-stats-strong">{row.name}</span>,
    },
    {
      key: "channel",
      title: t("CSKH:Stats:Col:Channel"),
      width: 90,
      render: (_, row) => <span className="cskh-badge">{channels[row.channel]}</span>,
    },
    {
      key: "uses",
      title: t("CSKH:Stats:Col:Uses"),
      width: 130,
      render: (_, row) => t("CSKH:Stats:Col:UsesValue", formatCount(row.uses)),
    },
    {
      key: "sent",
      title: t("CSKH:Stats:Col:Sent"),
      width: 100,
      align: "right",
      render: (_, row) => <span className="cskh-stats-strong">{formatCount(row.sent)}</span>,
    },
    {
      key: "succeeded",
      title: t("CSKH:Stats:Col:Succeeded"),
      width: 180,
      render: (_, row) => (
        <div className="cskh-stats-rate">
          <StatsMeter value={row.succeeded} max={row.sent} tone="green" label={row.name} />
          <span>{formatPercent(ratePercent(row.succeeded, row.sent))}</span>
        </div>
      ),
    },
    {
      key: "lastSentAt",
      title: t("CSKH:Stats:Col:LastSent"),
      width: 120,
      render: (_, row) => (row.lastSentAt ? formatDate(row.lastSentAt) : "—"),
    },
  ];
}

/**
 * Hiệu suất theo mẫu — the overview already holds every row, so it pages on
 * the client. The page remounts it when the filters change, which puts it back
 * on page 1.
 */
export function StatsTemplateTable({ templates, loading }: Props) {
  const pager = useTablePagination(10);
  return (
    <section className="page-card cskh-stats-card cskh-stats-table-card">
      <div className="dash-card-head">
        <h2 className="dash-card-title">{t("CSKH:Stats:ByTemplate")}</h2>
      </div>
      <DataTable<StatsTemplate>
        className="cskh-table cskh-stats-table"
        rowKey={(row) => `${row.templateId ?? row.name}-${row.channel}`}
        columns={buildColumns()}
        dataSource={templates}
        loading={loading}
        pagination={pager.buildConfig(templates.length, countedTotal(t("CSKH:Stats:Noun:Template")))}
        locale={{ emptyText: t("CSKH:Stats:NoData") }}
      />
    </section>
  );
}
