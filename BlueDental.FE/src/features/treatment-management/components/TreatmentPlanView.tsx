import { Table, Tag, Empty, Spin } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";
import { useTreatmentPlanList, type TreatmentPlanDto } from "../api";

interface Props {
  patientId: string;
}

const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

export function TreatmentPlanView({ patientId }: Props) {
  const { t } = useTranslation();

  const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
    Draft:     { color: "default", label: t("treatment.planDraft") },
    Active:    { color: "blue",    label: t("treatment.planActive") },
    Completed: { color: "green",   label: t("treatment.planCompleted") },
    Cancelled: { color: "red",     label: t("treatment.planCancelled") },
  };

  const COLUMNS: ColumnsType<TreatmentPlanDto> = [
    {
      title: t("treatment.planTitle"),
      dataIndex: "title",
      key: "title",
      ellipsis: true,
    },
    {
      title: t("common.status"),
      dataIndex: "status",
      key: "status",
      width: 160,
      render: (status: string) => {
        const cfg = STATUS_CONFIG[status] ?? { color: "default", label: status };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: t("treatment.estimatedCost"),
      dataIndex: "estimatedCost",
      key: "estimatedCost",
      width: 180,
      align: "right",
      render: (cost: number) => vnd.format(cost),
    },
    {
      title: t("common.createdDate"),
      dataIndex: "creationTime",
      key: "creationTime",
      width: 160,
      render: (value: string) =>
        new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(
          new Date(value),
        ),
    },
  ];

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
    return <Empty description={t("treatment.noPlans")} />;
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
