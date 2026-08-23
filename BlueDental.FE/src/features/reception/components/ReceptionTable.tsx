import React from "react";
import { Table, Tag, Button, Dropdown, Space, Typography, Tooltip } from "antd";
import {
  MoreOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { ReceptionItem, ReceptionStatus, RefType } from "../types/reception";
import { t } from "@/lib/i18n";

const { Text } = Typography;

interface ReceptionTableProps {
  items: ReceptionItem[];
  loading?: boolean;
  onStatusChange: (id: string, newStatus: ReceptionStatus) => void;
  onRowClick?: (item: ReceptionItem) => void;
}

const refTypeLabels = (): Record<RefType, { label: string; color: string }> => ({
  Medical: { label: t("Y tế"), color: "purple" },
  Self: { label: t("Tự đến"), color: "blue" },
  Referral: { label: t("Giới thiệu"), color: "cyan" },
  Marketing: { label: "Marketing", color: "geekblue" },
});

export const ReceptionTable: React.FC<ReceptionTableProps> = ({
  items,
  loading = false,
  onStatusChange,
  onRowClick,
}) => {
  const columns: ColumnsType<ReceptionItem> = [
    {
      title: t("Số phiếu"),
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
      title: t("Bệnh nhân"),
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
                {t("Mới")}
              </Tag>
            ) : (
              <Tag color="default" style={{ fontSize: 10, borderRadius: 4 }}>
                {t("Cũ")}
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
      title: t("Bác sĩ tiếp nhận"),
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
      title: t("Nhân sự tư vấn"),
      dataIndex: "adviseDoctorName",
      key: "adviseDoctorName",
      width: 160,
      render: (advise: string | undefined) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {advise ?? t("Chưa phân công")}
        </Text>
      ),
    },
    {
      title: t("Nguồn tiếp nhận"),
      dataIndex: "refType",
      key: "refType",
      width: 130,
      render: (refType: RefType) => {
        const conf = refTypeLabels()[refType] ?? { label: refType, color: "default" };
        return <Tag color={conf.color}>{conf.label}</Tag>;
      },
    },
    {
      title: t("Trạng thái"),
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (status: ReceptionStatus) => {
        if (status === "WaitingForExam") {
          return (
            <Tag icon={<ClockCircleOutlined />} color="processing">
              {t("Chờ khám")}
            </Tag>
          );
        }
        if (status === "InProgress") {
          return (
            <Tag icon={<SyncOutlined spin />} color="warning">
              {t("Đang khám")}
            </Tag>
          );
        }
        if (status === "Completed") {
          return (
            <Tag icon={<CheckOutlined />} color="success">
              {t("Hoàn thành")}
            </Tag>
          );
        }
        return <Tag color="default">{status}</Tag>;
      },
    },
    {
      title: t("Dịch vụ điều trị"),
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
      title: t("Tổng tiền"),
      dataIndex: "totalDue",
      key: "totalDue",
      width: 140,
      align: "right",
      render: (amt: number) => (
        <Text strong style={{ color: "#0F172A" }}>
          {amt.toLocaleString("vi-VN")} {t("đ")}
        </Text>
      ),
    },
    {
      title: t("Thao tác"),
      key: "actions",
      width: 140,
      fixed: "right",
      align: "center",
      render: (_, record: ReceptionItem) => {
        const menuItems = [
          {
            key: "start",
            label: t("Chuyển sang Đang khám"),
            disabled: record.status === "InProgress" || record.status === "Completed",
            onClick: () => onStatusChange(record.id, "InProgress"),
          },
          {
            key: "complete",
            label: t("Kết thúc điều trị (Hoàn thành)"),
            disabled: record.status === "Completed",
            onClick: () => onStatusChange(record.id, "Completed"),
          },
          { type: "divider" as const },
          {
            key: "edit-note",
            label: t("Sửa ghi chú"),
          },
          {
            key: "remove-note",
            label: t("Xoá ghi chú"),
            danger: true,
          },
        ];

        return (
          <Space size={8}>
            {record.status === "WaitingForExam" && (
              <Tooltip title={t("Chuyển vào khám")}>
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
                  {t("Tiếp nhận")}
                </Button>
              </Tooltip>
            )}

            {record.status === "InProgress" && (
              <Tooltip title={t("Hoàn thành dịch vụ")}>
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
                  Xong
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
        showTotal: (total) => t("Tổng số {0} hồ sơ tiếp nhận", total),
      }}
      locale={{
        emptyText: (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
            <Text strong style={{ color: "#64748B", display: "block" }}>
              {t("Danh sách trống")}
            </Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {t("Không tìm thấy hồ sơ tiếp nhận nào phù hợp với bộ lọc.")}
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
