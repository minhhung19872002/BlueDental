import { useMemo } from "react";
import { Button, Table, type TableColumnsType } from "antd";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { LetterAvatar } from "@/components/LetterAvatar";
import { t } from "@/lib/i18n";
import type { HistoryEntry } from "../../types/appointmentHistory";
import { ActionBadge, StatusText } from "./HistoryBadges";
import { HistoryDetailPanel } from "./HistoryDetailPanel";
import { HistoryValueList } from "./HistoryValueList";
import { formatOccurredAt } from "./historyLabels";

interface Props {
  entries: HistoryEntry[];
  loading: boolean;
  expandedId: string | null;
  onToggle: (id: string) => void;
}

function buildColumns(expandedId: string | null, onToggle: (id: string) => void): TableColumnsType<HistoryEntry> {
  return [
    {
      title: t("Appointment:History:Table:Time"),
      dataIndex: "occurredAt",
      width: 170,
      render: (value: string) => <span className="ah-time">{formatOccurredAt(value)}</span>,
    },
    {
      title: t("Appointment:History:Table:Type"),
      dataIndex: "action",
      width: 150,
      render: (_, entry) => <ActionBadge action={entry.action} />,
    },
    {
      title: t("Appointment:History:Table:OldValue"),
      key: "before",
      render: (_, entry) => <HistoryValueList entry={entry} side="before" />,
    },
    {
      title: t("Appointment:History:Table:NewValue"),
      key: "after",
      render: (_, entry) => <HistoryValueList entry={entry} side="after" />,
    },
    {
      title: t("Common:Status"),
      key: "status",
      width: 160,
      render: (_, entry) => <StatusText entry={entry} />,
    },
    {
      title: t("Appointment:History:Table:Person"),
      key: "actor",
      width: 200,
      render: (_, entry) => (
        <span className="ah-actor">
          <LetterAvatar name={entry.actorName} className="ah-avatar" />
          <span className="ah-actor-name">{entry.actorName}</span>
        </span>
      ),
    },
    {
      key: "expand",
      width: 56,
      align: "center",
      render: (_, entry) => {
        const open = entry.id === expandedId;
        return (
          <Button
            type="text"
            size="small"
            className="ah-expand"
            aria-label={open ? t("Appointment:History:Table:Collapse") : t("Appointment:History:Table:Expand")}
            aria-expanded={open}
            icon={open ? <UpOutlined /> : <DownOutlined />}
            onClick={() => onToggle(entry.id)}
          />
        );
      },
    },
  ];
}

/** Bảng: one row per change, the chevron opening the full detail beneath it. */
export function HistoryTable({ entries, loading, expandedId, onToggle }: Props) {
  const columns = useMemo(() => buildColumns(expandedId, onToggle), [expandedId, onToggle]);

  return (
    <Table<HistoryEntry>
      className="ah-table"
      rowKey="id"
      columns={columns}
      dataSource={entries}
      loading={loading}
      pagination={false}
      scroll={{ x: "max-content" }}
      locale={{ emptyText: t("Appointment:History:NoChangesInPeriod") }}
      expandable={{
        expandedRowKeys: expandedId ? [expandedId] : [],
        showExpandColumn: false,
        expandedRowRender: (entry) => <HistoryDetailPanel entry={entry} />,
        expandedRowClassName: () => "ah-expanded-row",
      }}
    />
  );
}
