import type { ColumnsType } from "antd/es/table";
import type { TablePaginationConfig } from "antd";
import { Button } from "antd";
import { t } from "@/lib/i18n";
import { DataTable } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import type { Campaign } from "../../api/campaignApi";
import { formatCount } from "../stats/statsFormat";
import { campaignAudience, campaignLook, campaignRunLine, canStop, channelChip, formatRunAt } from "./campaignLook";

interface CampaignTableProps {
  items: Campaign[];
  loading: boolean;
  pagination: TablePaginationConfig;
  /** Null without "Gửi tin nhắn › Tạo": no Tạm dừng button. */
  onStop: ((campaign: Campaign) => void) | null;
  onOpen: (id: string) => void;
}

function buildColumns({ onStop, onOpen }: Pick<CampaignTableProps, "onStop" | "onOpen">): ColumnsType<Campaign> {
  return [
    {
      key: "template",
      title: t("CSKH:Campaign:Col:Template"),
      width: 280,
      render: (_, row) => (
        <span className="cmp-template">
          <span className="cskh-badge cskh-badge--blue">{channelChip(row.channel)}</span>
          <span className="cskh-stats-strong">{row.templateName}</span>
        </span>
      ),
    },
    {
      key: "audience",
      title: t("CSKH:Campaign:Col:Audience"),
      width: 220,
      render: (_, row) => (
        <div className="cskh-stats-two-line">
          <span>{campaignAudience(row)}</span>
          <span className="cskh-stats-sub">{t("CSKH:Campaign:Customers", formatCount(row.selectedCount))}</span>
        </div>
      ),
    },
    {
      key: "lastRun",
      title: t("CSKH:Campaign:Col:LastRun"),
      width: 220,
      render: (_, row) => (
        <div className="cskh-stats-two-line">
          <span>{formatRunAt(row.lastRunAt)}</span>
          <span className="cskh-stats-sub">{campaignRunLine(row)}</span>
        </div>
      ),
    },
    {
      key: "status",
      title: t("CSKH:Campaign:Col:Status"),
      width: 120,
      render: (_, row) => <StatusBadge {...campaignLook(row)} />,
    },
    {
      key: "actions",
      title: t("CSKH:Campaign:Col:Actions"),
      width: 210,
      align: "right",
      render: (_, row) => (
        <span className="cmp-actions">
          {onStop && canStop(row) && (
            <Button size="small" onClick={() => onStop(row)}>
              {t("CSKH:Campaign:Stop")}
            </Button>
          )}
          <Button size="small" onClick={() => onOpen(row.id)}>
            {t("CSKH:Campaign:History")}
          </Button>
        </span>
      ),
    },
  ];
}

/** Template first, as the BA moved it (P2210): which message went, to whom, how it went. */
export function CampaignTable({ items, loading, pagination, onStop, onOpen }: CampaignTableProps) {
  return (
    <div className="cskh-table-card cmp-table-card">
      <DataTable<Campaign>
        className="cskh-table"
        rowKey="id"
        columns={buildColumns({ onStop, onOpen })}
        dataSource={items}
        loading={loading}
        pagination={pagination}
        locale={{ emptyText: t("CSKH:Campaign:Empty") }}
      />
    </div>
  );
}
