import { Button, Popconfirm, Space, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import { QueueTicketStatus, QueueTicketPriority, type QueueTicket } from "../types";

const STATUS_CONFIG: Record<QueueTicketStatus, { color: string; labelKey: string }> = {
  [QueueTicketStatus.Waiting]: { color: "default", labelKey: "Queue:Status:Waiting" },
  [QueueTicketStatus.Called]: { color: "processing", labelKey: "Queue:Status:Called" },
  [QueueTicketStatus.Serving]: { color: "success", labelKey: "Queue:Status:Serving" },
  [QueueTicketStatus.Completed]: { color: "default", labelKey: "Queue:Status:Completed" },
  [QueueTicketStatus.Skipped]: { color: "warning", labelKey: "Queue:Status:Skipped" },
  [QueueTicketStatus.Expired]: { color: "error", labelKey: "Queue:Status:Expired" },
};

interface QueueTicketTableProps {
  data: QueueTicket[];
  loading: boolean;
  paginationConfig: import("antd").TablePaginationConfig;
  onCall: (id: string) => void;
  onServe: (id: string) => void;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
  onRecall: (id: string) => void;
  actionLoading: boolean;
}

export function QueueTicketTable({
  data,
  loading,
  paginationConfig,
  onCall,
  onServe,
  onComplete,
  onSkip,
  onRecall,
  actionLoading,
}: QueueTicketTableProps) {
  const columns: ColumnsType<QueueTicket> = [
    {
      title: t("Queue:Table:TicketNumber"),
      dataIndex: "displayNumber",
      width: 100,
      render: (val: string, record) => (
        <div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{val}</span>
          {record.priority === QueueTicketPriority.Urgent && (
            <div style={{ marginTop: 2 }}>
              <Tag color="red" style={{ margin: 0 }}>{t("Queue:Priority:Urgent")}</Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: t("Queue:Table:Patient"),
      dataIndex: "patientName",
      ellipsis: true,
    },
    {
      title: t("Queue:Table:Service"),
      dataIndex: "serviceType",
      ellipsis: true,
      render: (val: string | undefined) => val ?? "—",
    },
    {
      title: t("Queue:Table:Dentist"),
      dataIndex: "dentistName",
      ellipsis: true,
      render: (val: string | undefined) => val ?? "—",
    },
    {
      title: t("Queue:Table:Counter"),
      dataIndex: "counterName",
      width: 100,
      render: (val: string | undefined) => val ?? "—",
    },
    {
      title: t("Queue:Table:Status"),
      dataIndex: "status",
      width: 120,
      render: (status: QueueTicketStatus) => {
        const cfg = STATUS_CONFIG[status];
        return <Tag color={cfg.color}>{t(cfg.labelKey)}</Tag>;
      },
    },
    {
      title: t("Queue:Table:CallCount"),
      dataIndex: "callCount",
      width: 80,
      align: "center",
    },
    {
      title: t("Queue:Table:Note"),
      dataIndex: "note",
      ellipsis: true,
      render: (val: string | undefined) => val ?? "—",
    },
    {
      title: t("Queue:Table:Actions"),
      key: "actions",
      width: 200,
      render: (_: unknown, record: QueueTicket) => (
        <Space size={4} wrap>
          {record.status === QueueTicketStatus.Waiting && (
            <Button
              size="small"
              type="primary"
              disabled={actionLoading}
              onClick={() => onCall(record.id)}
            >
              {t("Queue:Action:Call")}
            </Button>
          )}
          {record.status === QueueTicketStatus.Called && (
            <>
              <Button
                size="small"
                type="primary"
                style={{ background: "var(--bd-green, #22c55e)" }}
                disabled={actionLoading}
                onClick={() => onServe(record.id)}
              >
                {t("Queue:Action:Serve")}
              </Button>
              <Popconfirm
                title={t("Queue:Action:SkipConfirm")}
                onConfirm={() => onSkip(record.id)}
                okText={t("Đồng ý")}
                cancelText={t("Hủy")}
              >
                <Button size="small" disabled={actionLoading}>
                  {t("Queue:Action:Skip")}
                </Button>
              </Popconfirm>
            </>
          )}
          {record.status === QueueTicketStatus.Serving && (
            <Button
              size="small"
              type="primary"
              disabled={actionLoading}
              onClick={() => onComplete(record.id)}
            >
              {t("Queue:Action:Complete")}
            </Button>
          )}
          {record.status === QueueTicketStatus.Skipped && (
            <Button
              size="small"
              disabled={actionLoading}
              onClick={() => onRecall(record.id)}
            >
              {t("Queue:Action:Recall")}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Table<QueueTicket>
      rowKey="id"
      columns={columns}
      dataSource={data}
      loading={loading}
      pagination={paginationConfig}
      size="small"
      scroll={{ x: 900 }}
    />
  );
}
