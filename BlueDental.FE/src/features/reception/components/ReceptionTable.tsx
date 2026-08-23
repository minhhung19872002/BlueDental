import React from "react";
import { Table, Tag, Button, Dropdown, Space, Typography, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import {
  MoreOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { ReceptionItem, ReceptionStatus, RefType } from "../types/reception";

const { Text } = Typography;

interface ReceptionTableProps {
  items: ReceptionItem[];
  loading?: boolean;
  onStatusChange: (id: string, newStatus: ReceptionStatus) => void;
  onRowClick?: (item: ReceptionItem) => void;
}

export const ReceptionTable: React.FC<ReceptionTableProps> = ({
  items,
  loading = false,
  onStatusChange,
  onRowClick,
}) => {
  const { t } = useTranslation();

  const refTypeLabels: Record<RefType, { label: string; color: string }> = {
    Medical:   { label: t("reception.refType.medical"),   color: "purple" },
    Self:      { label: t("reception.refType.self"),      color: "blue" },
    Referral:  { label: t("reception.refType.referral"),  color: "cyan" },
    Marketing: { label: t("reception.refType.marketing"), color: "geekblue" },
  };

  const columns: ColumnsType<ReceptionItem> = [
    {
      title: t("reception.table.voucherCode"),
      dataIndex: "voucherCode",
      key: "voucherCode",
      width: 140,
      render: (code: string) => (
        <Text strong style={{ color: "#2671D8", fontFamily: "monospace" }}>
          {code}
        </Text>
      ),
    },
    {
      title: t("reception.table.patient"),
      dataIndex: "patientName",
      key: "patientName",
      width: 220,
      render: (name: string, record: ReceptionItem) => (
        <div>
          <div>
            <Text strong style={{ color: "#0F172A" }}>
              {name}
            </Text>{" "}
            {record.patientType === "New" ? (
              <Tag color="green" style={{ fontSize: 10, borderRadius: 4 }}>
                {t("reception.table.patientNew")}
              </Tag>
            ) : (
              <Tag color="default" style={{ fontSize: 10, borderRadius: 4 }}>
                {t("reception.table.patientOld")}
              </Tag>
            )}
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.patientPhone}
          </Text>
        </div>
      ),
    },
    {
      title: t("reception.table.doctor"),
      dataIndex: "doctorName",
      key: "doctorName",
      width: 180,
      render: (doc: string) => (
        <Text style={{ fontWeight: 500, color: "#334155" }}>
          {doc}
        </Text>
      ),
    },
    {
      title: t("reception.table.adviser"),
      dataIndex: "adviseDoctorName",
      key: "adviseDoctorName",
      width: 160,
      render: (advise: string | undefined) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {advise ?? t("reception.table.noAdviser")}
        </Text>
      ),
    },
    {
      title: t("reception.table.refSource"),
      dataIndex: "refType",
      key: "refType",
      width: 130,
      render: (refType: RefType) => {
        const conf = refTypeLabels[refType] ?? { label: refType, color: "default" };
        return <Tag color={conf.color}>{conf.label}</Tag>;
      },
    },
    {
      title: t("reception.table.status"),
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (status: ReceptionStatus) => {
        if (status === "WaitingForExam") {
          return (
            <Tag icon={<ClockCircleOutlined />} color="processing">
              {t("reception.table.statusWaiting")}
            </Tag>
          );
        }
        if (status === "InProgress") {
          return (
            <Tag icon={<SyncOutlined spin />} color="warning">
              {t("reception.table.statusInProgress")}
            </Tag>
          );
        }
        if (status === "Completed") {
          return (
            <Tag icon={<CheckOutlined />} color="success">
              {t("reception.table.statusCompleted")}
            </Tag>
          );
        }
        return <Tag color="default">{status}</Tag>;
      },
    },
    {
      title: t("reception.table.services"),
      dataIndex: "services",
      key: "services",
      render: (services: string[]) => (
        <Space size={[0, 4]} wrap>
          {services.map((s, idx) => (
            <Tag key={idx} style={{ borderRadius: 12, fontSize: 12 }}>
              {s}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: t("reception.table.total"),
      dataIndex: "totalDue",
      key: "totalDue",
      width: 140,
      align: "right",
      render: (amt: number) => (
        <Text strong style={{ color: "#0F172A" }}>
          {amt.toLocaleString("vi-VN")} đ
        </Text>
      ),
    },
    {
      title: t("reception.table.actions"),
      key: "actions",
      width: 140,
      fixed: "right",
      align: "center",
      render: (_, record: ReceptionItem) => {
        const menuItems = [
          {
            key: "start",
            label: t("reception.table.actionStartExam"),
            disabled: record.status === "InProgress" || record.status === "Completed",
            onClick: () => onStatusChange(record.id, "InProgress"),
          },
          {
            key: "complete",
            label: t("reception.table.actionComplete"),
            disabled: record.status === "Completed",
            onClick: () => onStatusChange(record.id, "Completed"),
          },
          { type: "divider" as const },
          {
            key: "edit-note",
            label: t("reception.table.actionEditNote"),
          },
          {
            key: "remove-note",
            label: t("reception.table.actionRemoveNote"),
            danger: true,
          },
        ];

        return (
          <Space size={8}>
            {record.status === "WaitingForExam" && (
              <Tooltip title={t("reception.table.tooltipStartExam")}>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => onStatusChange(record.id, "InProgress")}
                  style={{
                    backgroundColor: "#2671D8",
                    borderColor: "#2671D8",
                    fontSize: 12,
                  }}
                >
                  {t("reception.table.btnReceive")}
                </Button>
              </Tooltip>
            )}

            {record.status === "InProgress" && (
              <Tooltip title={t("reception.table.tooltipComplete")}>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => onStatusChange(record.id, "Completed")}
                  style={{
                    backgroundColor: "#10B981",
                    borderColor: "#10B981",
                    fontSize: 12,
                  }}
                >
                  {t("reception.table.btnDone")}
                </Button>
              </Tooltip>
            )}

            <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
              <Button type="text" icon={<MoreOutlined />} size="small" />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  return (
    <Table<ReceptionItem>
      columns={columns}
      dataSource={items}
      rowKey="id"
      loading={loading}
      onRow={(record) => ({
        onClick: () => onRowClick?.(record),
        style: onRowClick ? { cursor: "pointer" } : undefined,
      })}
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        showTotal: (total) => t("reception.table.showTotal", { total }),
      }}
      locale={{
        emptyText: (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
            <Text strong style={{ color: "#64748B", display: "block" }}>
              {t("reception.table.emptyTitle")}
            </Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {t("reception.table.emptyDesc")}
            </Text>
          </div>
        ),
      }}
      scroll={{ x: 1100 }}
      style={{
        background: "#FFFFFF",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 4px 20px rgba(15, 23, 42, 0.04)",
      }}
    />
  );
};
