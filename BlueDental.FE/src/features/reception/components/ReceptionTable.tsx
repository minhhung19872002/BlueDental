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

const { Text } = Typography;

interface ReceptionTableProps {
  items: ReceptionItem[];
  loading?: boolean;
  onStatusChange: (id: string, newStatus: ReceptionStatus) => void;
  onRowClick?: (item: ReceptionItem) => void;
}

const REF_TYPE_LABELS: Record<RefType, { label: string; color: string }> = {
  Medical: { label: "Y tế", color: "purple" },
  Self: { label: "Tự đến", color: "blue" },
  Referral: { label: "Giới thiệu", color: "cyan" },
  Marketing: { label: "Marketing", color: "geekblue" },
};

export const ReceptionTable: React.FC<ReceptionTableProps> = ({
  items,
  loading = false,
  onStatusChange,
  onRowClick,
}) => {
  const columns: ColumnsType<ReceptionItem> = [
    {
      title: "Số phiếu",
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
      title: "Bệnh nhân",
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
                Mới
              </Tag>
            ) : (
              <Tag color="default" style={{ fontSize: 10, borderRadius: 4 }}>
                Cũ
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
      title: "Bác sĩ tiếp nhận",
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
      title: "Nhân sự tư vấn",
      dataIndex: "adviseDoctorName",
      key: "adviseDoctorName",
      width: 160,
      render: (advise: string | undefined) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {advise ?? "Chưa phân công"}
        </Text>
      ),
    },
    {
      title: "Nguồn tiếp nhận",
      dataIndex: "refType",
      key: "refType",
      width: 130,
      render: (refType: RefType) => {
        const conf = REF_TYPE_LABELS[refType] ?? { label: refType, color: "default" };
        return <Tag color={conf.color}>{conf.label}</Tag>;
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (status: ReceptionStatus) => {
        if (status === "WaitingForExam") {
          return (
            <Tag icon={<ClockCircleOutlined />} color="processing">
              Chờ khám
            </Tag>
          );
        }
        if (status === "InProgress") {
          return (
            <Tag icon={<SyncOutlined spin />} color="warning">
              Đang khám
            </Tag>
          );
        }
        if (status === "Completed") {
          return (
            <Tag icon={<CheckOutlined />} color="success">
              Hoàn thành
            </Tag>
          );
        }
        return <Tag color="default">{status}</Tag>;
      },
    },
    {
      title: "Dịch vụ điều trị",
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
      title: "Tổng tiền",
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
      title: "Thao tác",
      key: "actions",
      width: 140,
      fixed: "right",
      align: "center",
      render: (_, record: ReceptionItem) => {
        const menuItems = [
          {
            key: "start",
            label: "Chuyển sang Đang khám",
            disabled: record.status === "InProgress" || record.status === "Completed",
            onClick: () => onStatusChange(record.id, "InProgress"),
          },
          {
            key: "complete",
            label: "Kết thúc điều trị (Hoàn thành)",
            disabled: record.status === "Completed",
            onClick: () => onStatusChange(record.id, "Completed"),
          },
          { type: "divider" as const },
          {
            key: "edit-note",
            label: "Sửa ghi chú",
          },
          {
            key: "remove-note",
            label: "Xoá ghi chú",
            danger: true,
          },
        ];

        return (
          <Space size={8}>
            {record.status === "WaitingForExam" && (
              <Tooltip title="Chuyển vào khám">
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
                  Tiếp nhận
                </Button>
              </Tooltip>
            )}

            {record.status === "InProgress" && (
              <Tooltip title="Hoàn thành dịch vụ">
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
        showTotal: (total) => `Tổng số ${total} hồ sơ tiếp nhận`,
      }}
      locale={{
        emptyText: (
          <div style={{ padding: "32px 0", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
            <Text strong style={{ color: "#64748B", display: "block" }}>
              Danh sách trống
            </Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Không tìm thấy hồ sơ tiếp nhận nào phù hợp với bộ lọc.
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
