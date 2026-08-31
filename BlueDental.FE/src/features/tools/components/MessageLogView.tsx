import { useMemo, useState } from "react";
import { Select, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMessageLogs, type MessageLogDto } from "../api/toolsApi";
import { DataTable } from "@/components/DataTable";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { pagerTotal } from "@/utils/pagerTotal";

// UNKNOWN_REFERENCE_BEHAVIOR: call-log status labels and message-log status
// labels were both unobservable (empty tables). These are placeholders that
// mirror the BE enum values.
const MSG_STATUS_OPTIONS = [
  { value: 0, label: "Đang chờ", color: "default" },
  { value: 1, label: "Đã gửi", color: "green" },
  { value: 2, label: "Thất bại", color: "red" },
  { value: 3, label: "Đã nhận", color: "blue" },
];

function msgStatusTag(status: number): { label: string; color: string } {
  const found = MSG_STATUS_OPTIONS.find((o) => o.value === status);
  return found ? { label: t(found.label), color: found.color } : { label: "—", color: "default" };
}

// UNKNOWN_REFERENCE_BEHAVIOR: "Nhà cung cấp" and "Mục tiêu" filter options
// could not be observed (message list was empty). These are structural
// placeholders showing the correct control shape.

/** Danh sách tin nhắn — shared by Tin nhắn (channel 0) and Zalo (1). */
export function MessageLogView({ channel }: { channel: number }) {
  const [statusFilter, setStatusFilter] = useState<number | undefined>();
  const pagination = useTablePagination();

  const { data, isFetching } = useMessageLogs(channel, {
    status: statusFilter,
  });

  const columns = useMemo<ColumnsType<MessageLogDto>>(
    () => [
      { key: "phone", title: t("Số điện thoại"), dataIndex: "recipientPhone", width: 140 },
      { key: "content", title: t("Nội dung"), dataIndex: "content", ellipsis: true },
      {
        key: "target",
        title: t("Mục tiêu"),
        width: 140,
        // UNKNOWN_REFERENCE_BEHAVIOR: what "Mục tiêu" maps to could not be
        // determined — the list was empty. Renders the recipient name as the
        // closest guess.
        render: (_, log) => log.recipientName || "—",
      },
      {
        key: "status",
        title: t("Trạng thái"),
        width: 120,
        render: (_, log) => {
          const { label, color } = msgStatusTag(log.status);
          return <Tag color={color}>{label}</Tag>;
        },
      },
      {
        key: "actions",
        title: t("Thao tác"),
        width: 100,
        align: "center",
        // UNKNOWN_REFERENCE_BEHAVIOR: row actions could not be observed.
        render: () => "—",
      },
    ],
    [],
  );

  return (
    <div className="reception-card reception-card--content">
      <div className="bd-ops-toolbar">
        <Select
          className="bd-ops-filter"
          placeholder={t("Trạng thái")}
          allowClear
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            pagination.resetToFirstPage();
          }}
          options={MSG_STATUS_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
          style={{ width: 160 }}
        />
        <Select
          className="bd-ops-filter"
          placeholder={t("Nhà cung cấp")}
          allowClear
          disabled
          style={{ width: 160 }}
        />
        <Select
          className="bd-ops-filter"
          placeholder={t("Mục tiêu")}
          allowClear
          disabled
          style={{ width: 160 }}
        />
      </div>

      <DataTable<MessageLogDto>
        columns={columns}
        dataSource={data?.items ?? []}
        rowKey="id"
        loading={isFetching}
        pagination={pagination.buildConfig(data?.totalCount, pagerTotal)}
        locale={{ emptyText: t("Chưa có tin nhắn") }}
      />
    </div>
  );
}
