import { Table, Tag, Empty, Spin } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTreatmentPlanList, type TreatmentPlanDto } from "../api";

interface Props {
  patientId: string;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  Draft:     { color: "default", label: "Nháp" },
  Active:    { color: "blue",    label: "Đang thực hiện" },
  Completed: { color: "green",   label: "Hoàn thành" },
  Cancelled: { color: "red",     label: "Đã hủy" },
};

const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

const COLUMNS: ColumnsType<TreatmentPlanDto> = [
  {
    title: "Tiêu đề kế hoạch",
    dataIndex: "title",
    key: "title",
    ellipsis: true,
  },
  {
    title: "Trạng thái",
    dataIndex: "status",
    key: "status",
    width: 160,
    render: (status: string) => {
      const cfg = STATUS_CONFIG[status] ?? { color: "default", label: status };
      return <Tag color={cfg.color}>{cfg.label}</Tag>;
    },
  },
  {
    title: "Chi phí ước tính",
    dataIndex: "estimatedCost",
    key: "estimatedCost",
    width: 180,
    align: "right",
    render: (cost: number) => vnd.format(cost),
  },
  {
    title: "Ngày tạo",
    dataIndex: "creationTime",
    key: "creationTime",
    width: 160,
    render: (value: string) =>
      new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(
        new Date(value),
      ),
  },
];

export function TreatmentPlanView({ patientId }: Props) {
  const { data, isLoading } = useTreatmentPlanList({ patientId });

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
        <Spin />
      </div>
    );
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return <Empty description="Chưa có kế hoạch điều trị" />;
  }

  return (
    <Table<TreatmentPlanDto>
      columns={COLUMNS}
      dataSource={items}
      rowKey="id"
      pagination={false}
      size="small"
    />
  );
}
