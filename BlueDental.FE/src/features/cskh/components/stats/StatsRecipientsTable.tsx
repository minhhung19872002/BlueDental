import type { TableProps } from "antd";
import type { ColumnsType, SortOrder } from "antd/es/table/interface";
import { t } from "@/lib/i18n";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { useTablePagination } from "@/hooks/useTablePagination";
import { countedTotal } from "@/utils/countedTotal";
import { formatDateTime } from "@/utils/format";
import {
  useStatsRecipients,
  type StatsFilter,
  type StatsRecipient,
  type StatsRecipientQuery,
  type StatsRecipientSort,
} from "../../api/statsApi";
import { channelLabels } from "../../api/templateApi";
import { recipientLook } from "./statsLook";

interface Props {
  filter: StatsFilter;
  query: StatsRecipientQuery;
  onSortChange: (sorting: StatsRecipientSort) => void;
}

type SortColumn = "name" | "at";

function orderOf(sorting: StatsRecipientSort, column: SortColumn): SortOrder {
  const [field, direction] = sorting.split(" ");
  if (field !== column) return null;
  return direction === "asc" ? "ascend" : "descend";
}

function buildColumns(sorting: StatsRecipientSort): ColumnsType<StatsRecipient> {
  const channels = channelLabels();
  return [
    {
      key: "name",
      title: t("CSKH:Stats:Col:Customer"),
      width: 200,
      sorter: true,
      sortOrder: orderOf(sorting, "name"),
      render: (_, row) => <span className="cskh-stats-strong">{row.name}</span>,
    },
    { key: "phone", title: t("CSKH:Stats:Col:Contact"), width: 140, render: (_, row) => row.phone ?? "—" },
    {
      key: "template",
      title: t("CSKH:Stats:Col:TemplateReceived"),
      width: 240,
      render: (_, row) => row.templateName ?? t("CSKH:Stats:UnknownTemplate"),
    },
    { key: "channel", title: t("CSKH:Stats:Col:Channel"), width: 90, render: (_, row) => channels[row.channel] },
    {
      key: "at",
      title: t("CSKH:Stats:Col:At"),
      width: 150,
      sorter: true,
      sortOrder: orderOf(sorting, "at"),
      render: (_, row) => formatDateTime(row.at),
    },
    {
      key: "outcome",
      title: t("CSKH:Stats:Col:Status"),
      width: 260,
      render: (_, row) => (
        <div className="cskh-stats-outcome">
          <StatusBadge {...recipientLook(row)} />
          {row.error && <span className="cskh-stats-sub">{row.error}</span>}
        </div>
      ),
    },
  ];
}

/** Antd's sorter back into the API's "name asc" form; a cleared sort is the default, newest first. */
function toSorting(sorter: Parameters<NonNullable<TableProps<StatsRecipient>["onChange"]>>[2]): StatsRecipientSort {
  const single = Array.isArray(sorter) ? sorter[0] : sorter;
  if (!single?.order || (single.columnKey !== "name" && single.columnKey !== "at")) return "at desc";
  return `${single.columnKey} ${single.order === "ascend" ? "asc" : "desc"}`;
}

/** The paged recipient rows. Remounted when the filters or the search change, back to page 1. */
export function StatsRecipientsTable({ filter, query, onSortChange }: Props) {
  const pager = useTablePagination(10);
  const { data, isFetching } = useStatsRecipients(filter, query, {
    skipCount: pager.skipCount,
    maxResultCount: pager.maxResultCount,
  });

  const handleChange: TableProps<StatsRecipient>["onChange"] = (_pagination, _filters, sorter, extra) => {
    if (extra.action === "sort") onSortChange(toSorting(sorter));
  };

  return (
    <DataTable<StatsRecipient>
      className="cskh-table cskh-stats-table"
      rowKey="id"
      columns={buildColumns(query.sorting)}
      dataSource={data?.items ?? []}
      loading={isFetching}
      onChange={handleChange}
      pagination={pager.buildConfig(data?.totalCount ?? 0, countedTotal(t("CSKH:Stats:Noun:Recipient")))}
      locale={{ emptyText: t("CSKH:Stats:NoData") }}
    />
  );
}
