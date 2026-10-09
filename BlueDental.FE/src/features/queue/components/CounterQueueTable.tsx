import type { CSSProperties } from "react";
import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import { DataTable } from "@/components/DataTable";
import { formatClock, waitLevelOf } from "../utils/waitLevel";
import type { CounterQueueRow } from "../types";
import { NumberChip } from "./CounterCardParts";
import { WaitBadge } from "./WaitBadge";

interface CounterQueueTableProps {
  rows: CounterQueueRow[];
  thresholdMinutes: number;
  loading: boolean;
}

/** The bar fills against the threshold and stops at full once a wait passes it. */
function WaitBar({ minutes, threshold }: { minutes: number; threshold: number }) {
  const level = waitLevelOf(minutes, threshold);
  const share = Math.min(100, Math.round((minutes / Math.max(1, threshold)) * 100));
  return (
    <span className="queue-waitbar">
      <span className={`queue-waitbar__track queue-waitbar__track--${level}`}>
        <span
          className="queue-waitbar__fill"
          style={{ "--queue-wait-share": `${share}%` } as CSSProperties}
        />
      </span>
      <span className="queue-waitbar__value">{t("Queue:Minutes", minutes)}</span>
    </span>
  );
}

/** Shares, not pixels: the five columns spread over the card at any width. */
function useColumns(threshold: number): ColumnsType<CounterQueueRow> {
  return [
    {
      title: t("Queue:Detail:Col:Number"),
      key: "number",
      width: "14%",
      render: (_: unknown, row) => <NumberChip ticket={row} />,
    },
    {
      title: t("Queue:Detail:Col:TakenAt"),
      key: "takenAt",
      width: "17%",
      render: (_: unknown, row) => formatClock(row.takenAt),
    },
    {
      title: t("Queue:Detail:Col:Waited"),
      key: "waited",
      width: "31%",
      render: (_: unknown, row) => <WaitBar minutes={row.waitedMinutes} threshold={threshold} />,
    },
    {
      title: t("Queue:Detail:Col:EstimatedCall"),
      key: "estimated",
      width: "18%",
      render: (_: unknown, row) => formatClock(row.estimatedCallAt),
    },
    {
      title: t("Queue:Detail:Col:Level"),
      key: "level",
      width: "20%",
      render: (_: unknown, row) => <WaitBadge level={waitLevelOf(row.waitedMinutes, threshold)} />,
    },
  ];
}

/** The counter's waiting numbers in calling order: no patient column (BA). */
export function CounterQueueTable({ rows, thresholdMinutes, loading }: CounterQueueTableProps) {
  const columns = useColumns(thresholdMinutes);
  return (
    <section className="reception-card queue-detail__list">
      <h2 className="queue-detail__list-title">{t("Queue:Detail:ListTitle", rows.length)}</h2>
      <DataTable<CounterQueueRow>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={false}
        size="small"
        locale={{ emptyText: t("Queue:Display:NoWaiting") }}
      />
    </section>
  );
}
