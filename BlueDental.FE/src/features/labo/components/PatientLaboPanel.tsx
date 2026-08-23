import { Card, Table, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import {
  laboKindLabels,
  laboStatusConfig,
  useLaboOrders,
  type LaboOrderDto,
} from "../api/laboApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { formatDate, formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";

const { Text } = Typography;

interface PatientLaboPanelProps {
  patientId: string;
}

/** Labo tab of a patient record: the samples sent out for this patient. */
export function PatientLaboPanel({ patientId }: PatientLaboPanelProps) {
  const branchId = useCurrentBranchId();
  const { data, isLoading } = useLaboOrders({ patientId, branchId, maxResultCount: 50 });

  const rows = data?.items ?? [];

  const columns: TableColumnsType<LaboOrderDto> = [
    { title: t("Mã phiếu"), dataIndex: "orderCode", key: "orderCode", width: 130 },
    {
      title: t("Loại"),
      dataIndex: "kind",
      key: "kind",
      width: 150,
      render: (value: LaboOrderDto["kind"]) => <Tag>{laboKindLabels()[value]}</Tag>,
    },
    { title: t("Nhà cung cấp"), dataIndex: "labProviderName", key: "labProviderName", width: 180 },
    {
      title: t("Răng"),
      dataIndex: "toothNumbers",
      key: "toothNumbers",
      width: 100,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Hẹn trả"),
      dataIndex: "dueDate",
      key: "dueDate",
      width: 110,
      render: (value: string | null, row) =>
        value ? (
          <Text type={row.isOverdue ? "danger" : undefined}>{formatDate(value)}</Text>
        ) : (
          "—"
        ),
    },
    {
      title: t("Chi phí"),
      dataIndex: "estimatedCost",
      key: "estimatedCost",
      width: 120,
      align: "right",
      render: (value: number) => t("{0} đ", formatVND(value ?? 0)),
    },
    {
      title: t("Trạng thái"),
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (value: LaboOrderDto["status"], row) => {
        const config = laboStatusConfig()[value];
        return (
          <>
            <Tag color={config.color}>{config.label}</Tag>
            {row.isOverdue && <Tag color="red">{t("Trễ")}</Tag>}
          </>
        );
      },
    },
  ];

  return (
    <Card size="small">
      <Table<LaboOrderDto>
        size="small"
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: <Text type="secondary">{t("Chưa có phiếu labo")}</Text> }}
      />
    </Card>
  );
}
