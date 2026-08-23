import { Card, Table, Tag, Typography } from "antd";
import type { TableColumnsType } from "antd";
import {
  CARE_OUTCOME_LABELS,
  CARE_STATUS_CONFIG,
  CARE_TYPE_LABELS,
  useCareRecords,
  type CareRecordDto,
} from "../api/careApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { formatDate } from "@/utils/format";

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
      title: "Ngày chăm sóc",
      dataIndex: "dueAt",
      key: "dueAt",
      width: 130,
      render: (value: string | null) => (value ? formatDate(value) : "—"),
    },
    {
      title: "Trạng thái CSKH",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (value: CareRecordDto["status"]) => {
        const config = CARE_STATUS_CONFIG[value];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: "Nhóm",
      dataIndex: "type",
      key: "type",
      width: 160,
      render: (value: CareRecordDto["type"]) => CARE_TYPE_LABELS[value],
    },
    { title: "Nội dung", dataIndex: "subject", key: "subject" },
    {
      title: "Nhân viên chăm sóc",
      dataIndex: "careStaffName",
      key: "careStaffName",
      width: 160,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "Đánh giá",
      dataIndex: "outcome",
      key: "outcome",
      width: 110,
      render: (value: CareRecordDto["outcome"]) => CARE_OUTCOME_LABELS[value] ?? "—",
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
        locale={{ emptyText: <Text type="secondary">Chưa có dữ liệu chăm sóc</Text> }}
      />
    </Card>
  );
}
