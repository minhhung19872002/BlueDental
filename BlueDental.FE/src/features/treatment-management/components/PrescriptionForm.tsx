import { Table, Tag, Empty, Spin } from "antd";
import type { ColumnsType } from "antd/es/table";
import { usePatientPrescriptions, type PrescriptionDto } from "../api";

interface Props {
  patientId: string;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  Active:    { color: "green",   label: "Đang dùng" },
  Expired:   { color: "default", label: "Hết hạn" },
  Cancelled: { color: "red",     label: "Đã hủy" },
};

const COLUMNS: ColumnsType<PrescriptionDto> = [
  {
    title: "Thuốc",
    dataIndex: "medicationName",
    key: "medicationName",
    render: (name: string | undefined) => name ?? "—",
    ellipsis: true,
  },
  {
    title: "Liều dùng",
    dataIndex: "dosage",
    key: "dosage",
    width: 120,
  },
  {
    title: "Tần suất",
    dataIndex: "frequency",
    key: "frequency",
    width: 140,
  },
  {
    title: "Số ngày",
    dataIndex: "durationDays",
    key: "durationDays",
    width: 90,
    align: "center",
    render: (days: number) => `${days} ngày`,
  },
  {
    title: "Trạng thái",
    dataIndex: "status",
    key: "status",
    width: 130,
    render: (status: string) => {
      const cfg = STATUS_CONFIG[status] ?? { color: "default", label: status };
      return <Tag color={cfg.color}>{cfg.label}</Tag>;
    },
  },
  {
    title: "Ngày kê",
    dataIndex: "issuedAt",
    key: "issuedAt",
    width: 140,
    render: (value: string) =>
      new Intl.DateTimeFormat("vi-VN", { dateStyle: "short" }).format(new Date(value)),
  },
];

export function PrescriptionForm({ patientId }: Props) {
  const { data: prescriptions, isLoading } = usePatientPrescriptions(patientId);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
        <Spin />
      </div>
    );
  }

  const items = prescriptions ?? [];

  if (items.length === 0) {
    return <Empty description="Chưa có đơn thuốc nào" />;
  }

  return (
    <Table<PrescriptionDto>
      columns={COLUMNS}
      dataSource={items}
      rowKey="id"
      pagination={false}
      size="small"
    />
  );
}
