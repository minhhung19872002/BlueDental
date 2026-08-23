import { Card, Table, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import {
  careOutcomeLabels,
  careStatusConfig,
  careTypeLabels,
  useCareRecords,
  type CareRecordDto,
} from "../api/careApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { formatDate } from "@/utils/format";
import { t } from "@/lib/i18n";

const { Text } = Typography;

interface PatientCarePanelProps {
  patientId: string;
}

/** Chăm sóc KH tab of a patient record: their care log. */
export function PatientCarePanel({ patientId }: PatientCarePanelProps) {
  const branchId = useCurrentBranchId();
  const { data, isLoading } = useCareRecords({ patientId, branchId, maxResultCount: 50 });

  const rows = data?.items ?? [];

  const columns: TableColumnsType<CareRecordDto> = [
    {
      title: t("Ngày chăm sóc"),
      dataIndex: "dueAt",
      key: "dueAt",
      width: 130,
      render: (value: string | null) => (value ? formatDate(value) : "—"),
    },
    {
      title: t("Trạng thái CSKH"),
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (value: CareRecordDto["status"]) => {
        const config = careStatusConfig()[value];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: t("Nhóm"),
      dataIndex: "type",
      key: "type",
      width: 160,
      render: (value: CareRecordDto["type"]) => careTypeLabels()[value],
    },
    { title: t("Nội dung"), dataIndex: "subject", key: "subject" },
    {
      title: t("Nhân viên chăm sóc"),
      dataIndex: "careStaffName",
      key: "careStaffName",
      width: 160,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Đánh giá"),
      dataIndex: "outcome",
      key: "outcome",
      width: 110,
      render: (value: CareRecordDto["outcome"]) => careOutcomeLabels()[value] ?? "—",
    },
  ];

  return (
    <Card size="small">
      <Table<CareRecordDto>
        size="small"
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: <Text type="secondary">{t("Chưa có dữ liệu chăm sóc")}</Text> }}
      />
    </Card>
  );
}
