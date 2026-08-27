import { useState } from "react";
import { Empty, Input, Table, Tag } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useMessageLogs, type MessageLogDto } from "../api/toolsApi";
import { t } from "@/lib/i18n";

const MSG_STATUS_COLORS: Record<number, string> = {
  0: "default",
  1: "green",
  2: "red",
  3: "blue",
};

/** Danh sách tin nhắn — shared by Tin nhắn (channel 0) and Zalo (1). */
export function MessageLogView({ channel }: { channel: number }) {
  const [keyword, setKeyword] = useState("");
  const { data, isLoading } = useMessageLogs(channel, { filter: keyword || undefined });
  const logs = data?.items ?? [];

  const MSG_STATUS_LABELS: Record<number, string> = {
    0: t("Đang chờ"),
    1: t("Đã gửi"),
    2: t("Thất bại"),
    3: t("Đã nhận"),
  };

  const columns = [
    {
      title: t("Thời gian"), dataIndex: "creationTime", key: "creationTime", width: 140,
      render: (v: string) => dayjs(v).format("DD/MM/YYYY HH:mm"),
    },
    { title: t("Người nhận"), dataIndex: "recipientName", key: "recipientName" },
    { title: t("Số điện thoại"), dataIndex: "recipientPhone", key: "recipientPhone", width: 130 },
    { title: t("Nội dung"), dataIndex: "content", key: "content", ellipsis: true },
    {
      title: t("Trạng thái"), dataIndex: "status", key: "status", width: 100,
      render: (v: number) => {
        const label = MSG_STATUS_LABELS[v] ?? "—";
        const color = MSG_STATUS_COLORS[v] ?? "default";
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: t("Thời điểm gửi"), dataIndex: "sentAt", key: "sentAt", width: 140,
      render: (v: string | undefined) => (v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—"),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div className="bd-ops-toolbar">
          <Input
            className="bd-ops-search"
            prefix={<SearchOutlined />}
            placeholder={t("Tìm kiếm")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            allowClear
          />
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table<MessageLogDto>
          columns={columns}
          dataSource={logs}
          rowKey="id"
          size="small"
          loading={isLoading}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Chưa có tin nhắn nào")} /> }}
          pagination={{ pageSize: 20, showTotal: (total) => t("Tổng tin nhắn: {0}", total) }}
        />
      </div>
    </>
  );
}
