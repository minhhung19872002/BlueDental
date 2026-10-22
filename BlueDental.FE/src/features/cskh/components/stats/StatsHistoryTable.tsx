import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { useTablePagination } from "@/hooks/useTablePagination";
import { countedTotal } from "@/utils/countedTotal";
import { formatDateTime } from "@/utils/format";
import { useStatsBatches, type StatsBatch, type StatsFilter } from "../../api/statsApi";
import { channelLabels } from "../../api/templateApi";
import { audienceLabel, batchLook, batchResult } from "./statsLook";
import { formatCount } from "./statsFormat";
import { StatsMeter } from "./StatsMeter";

interface Props {
  filter: StatsFilter;
}

function ResultCell({ batch }: { batch: StatsBatch }) {
  const result = batchResult(batch);
  return (
    <div className="cskh-stats-result">
      <StatsMeter value={result.value} max={result.max} tone={result.tone} label={result.text} />
      <span>{result.text}</span>
    </div>
  );
}

function buildColumns(): ColumnsType<StatsBatch> {
  const channels = channelLabels();
  return [
    { key: "at", title: t("CSKH:Stats:Col:At"), width: 150, render: (_, row) => formatDateTime(row.at) },
    {
      key: "template",
      title: t("CSKH:Stats:Col:Template"),
      width: 240,
      render: (_, row) => (
        <div className="cskh-stats-two-line">
          <span className="cskh-stats-strong">{row.templateName}</span>
          <span className="cskh-stats-sub">{channels[row.channel]}</span>
        </div>
      ),
    },
    { key: "audience", title: t("CSKH:Stats:Col:Audience"), width: 180, render: (_, row) => audienceLabel(row) },
    { key: "sender", title: t("CSKH:Stats:Col:Sender"), width: 150, render: (_, row) => row.senderName ?? "—" },
    {
      key: "recipients",
      title: t("CSKH:Stats:Col:Recipients"),
      width: 110,
      align: "right",
      render: (_, row) => <span className="cskh-stats-strong">{formatCount(row.recipientCount)}</span>,
    },
    { key: "result", title: t("CSKH:Stats:Col:Result"), width: 200, render: (_, row) => <ResultCell batch={row} /> },
    { key: "status", title: t("CSKH:Stats:Col:Status"), width: 120, render: (_, row) => <StatusBadge {...batchLook(row)} /> },
  ];
}

/** Lịch sử gửi, newest first, paged on the server (BA img_32). Remounted per filter. */
export function StatsHistoryTable({ filter }: Props) {
  const pager = useTablePagination(10);
  const { data, isFetching } = useStatsBatches(filter, {
    skipCount: pager.skipCount,
    maxResultCount: pager.maxResultCount,
  });

  return (
    <section className="page-card cskh-stats-card cskh-stats-table-card">
      <div className="dash-card-head">
        <h2 className="dash-card-title">{t("CSKH:Stats:History")}</h2>
      </div>
      <DataTable<StatsBatch>
        className="cskh-table cskh-stats-table"
        rowKey="id"
        columns={buildColumns()}
        dataSource={data?.items ?? []}
        loading={isFetching}
        pagination={pager.buildConfig(data?.totalCount ?? 0, countedTotal(t("CSKH:Stats:Noun:Batch")))}
        locale={{ emptyText: t("CSKH:Stats:NoData") }}
      />
    </section>
  );
}
