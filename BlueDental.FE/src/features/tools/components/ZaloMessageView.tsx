import { useMemo, useState } from "react";
import { Select, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DataTable } from "@/components/DataTable";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { formatDateTime, formatVND } from "@/utils/format";
import {
  ZALO_MESSAGE_STATUS,
  useZaloMessageStats,
  useZaloMessages,
  type ZaloMessageDto,
} from "../api/zaloApi";

const STATUS_OPTIONS: { value: number; label: string; color: string }[] = [
  { value: ZALO_MESSAGE_STATUS.Pending, label: "Tools:MsgPending", color: "default" },
  { value: ZALO_MESSAGE_STATUS.Sent, label: "Tools:MsgSent", color: "green" },
  { value: ZALO_MESSAGE_STATUS.Delivered, label: "Tools:MsgDelivered", color: "blue" },
  { value: ZALO_MESSAGE_STATUS.Failed, label: "Tools:MsgFailed", color: "red" },
];

function statusTag(status: number) {
  const found = STATUS_OPTIONS.find((o) => o.value === status);
  return found ? { label: t(found.label), color: found.color } : { label: "—", color: "default" };
}

function messageTotal(total: number, range: [number, number]) {
  return total === 0
    ? t("Tools:ZaloMessagePagerZero")
    : t("Tools:ZaloMessagePagerRange", range[0], range[1], total);
}

/** The counters double as filters: Tổng số, Thành công, Thất bại. */
type Outcome = "all" | "success" | "failed";

const OUTCOME_SUCCEEDED: Record<Outcome, boolean | undefined> = {
  all: undefined,
  success: true,
  failed: false,
};

/** Danh sách tin Zalo — every ZNS this branch tried to send, with Zalo's answer. */
export function ZaloMessageView() {
  const [status, setStatus] = useState<number | undefined>();
  const [outcome, setOutcome] = useState<Outcome>("all");
  const pagination = useTablePagination(20, { pageSizeOptions: [5, 10, 20, 25, 50, 100] });

  const { data, isFetching } = useZaloMessages({
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
    status,
    succeeded: OUTCOME_SUCCEEDED[outcome],
  });
  const { data: stats } = useZaloMessageStats();

  const counters: { key: Outcome; count: number; label: string }[] = [
    { key: "all", count: stats?.total ?? 0, label: t("Tools:ZaloCounterTotal") },
    { key: "success", count: stats?.success ?? 0, label: t("Tools:ZaloCounterSuccess") },
    { key: "failed", count: stats?.failed ?? 0, label: t("Tools:ZaloCounterFailed") },
  ];

  const pickOutcome = (key: Outcome) => {
    setOutcome(key);
    pagination.resetToFirstPage();
  };

  const columns = useMemo<ColumnsType<ZaloMessageDto>>(
    () => [
      { key: "phone", title: t("Tools:PhoneLabel"), dataIndex: "recipientPhone", width: 140 },
      { key: "content", title: t("Tools:ContentLabel"), dataIndex: "content", ellipsis: true },
      {
        key: "status",
        title: t("Tools:StatusLabel"),
        width: 140,
        render: (_, msg) => {
          const { label, color } = statusTag(msg.status);
          const tag = <Tag color={color}>{label}</Tag>;
          return msg.errorMessage ? <Tooltip title={msg.errorMessage}>{tag}</Tooltip> : tag;
        },
      },
      {
        key: "cost",
        title: t("Tools:ZaloCost"),
        width: 110,
        align: "right",
        render: (_, msg) => (msg.cost == null ? "—" : formatVND(msg.cost)),
      },
      {
        key: "sentAt",
        title: t("Tools:ZaloSentAt"),
        width: 160,
        render: (_, msg) => formatDateTime(msg.sentAt ?? msg.creationTime),
      },
    ],
    [],
  );

  return (
    <div className="reception-card reception-card--content">
      <div className="bd-ops-toolbar">
        <Select
          className="bd-ops-filter"
          placeholder={t("Tools:StatusLabel")}
          allowClear
          value={status}
          onChange={(v) => {
            setStatus(v);
            pagination.resetToFirstPage();
          }}
          options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
        />
        <div className="bd-zalo-counters" role="group" aria-label={t("Tools:ZaloCounterTotal")}>
          {counters.map((c) => (
            <button
              key={c.key}
              type="button"
              className={cn("bd-zalo-counter", outcome === c.key && "bd-zalo-counter--active")}
              aria-pressed={outcome === c.key}
              onClick={() => pickOutcome(c.key)}
            >
              <strong>{c.count}</strong> {c.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable<ZaloMessageDto>
        columns={columns}
        dataSource={data?.items ?? []}
        rowKey="id"
        loading={isFetching}
        pagination={pagination.buildConfig(data?.totalCount, messageTotal)}
        locale={{ emptyText: t("Tools:NoMessages") }}
      />
    </div>
  );
}
