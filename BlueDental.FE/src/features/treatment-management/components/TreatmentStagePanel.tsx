import { useState } from "react";
import { Button, Card, Empty, Progress, Space, Table, Tag, Typography, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import {
  STAGE_STATUS,
  STAGE_STATUS_CONFIG,
  useCompleteStage,
  useContinueStage,
  useLatestTreatmentStage,
  useTreatmentStages,
  type TreatmentStageDto,
} from "../api/stageApi";
import { StageModal } from "./StageModal";
import { formatTeeth } from "../api/consultingApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { formatDate } from "@/utils/format";

const { Text } = Typography;

interface TreatmentStagePanelProps {
  patientId: string;
}

/**
 * Công đoạn điều trị for one patient.
 *
 * The reference surfaces stages in two places on this tab: the "Dịch vụ có công đoạn
 * gần nhất" card and a "Thêm công đoạn" action per service line. Both read from the
 * same list here, grouped by the service line each stage belongs to.
 */
export function TreatmentStagePanel({ patientId }: TreatmentStagePanelProps) {
  const branchId = useCurrentBranchId();
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useTreatmentStages({
    patientId,
    clinicBranchId: branchId,
    maxResultCount: 100,
  });
  const { data: latest } = useLatestTreatmentStage(patientId);

  const continueStage = useContinueStage();
  const completeStage = useCompleteStage();

  const stages = data?.items ?? [];
  const completed = stages.filter((s) => s.status === STAGE_STATUS.Completed).length;
  const progressPercent = stages.length === 0 ? 0 : Math.round((completed / stages.length) * 100);

  const run = async (action: Promise<unknown>, success: string) => {
    try {
      await action;
      message.success(success);
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  const columns: TableColumnsType<TreatmentStageDto> = [
    { title: "#", dataIndex: "sequenceNumber", key: "sequenceNumber", width: 50 },
    {
      title: "Dịch vụ",
      dataIndex: "serviceName",
      key: "serviceName",
      width: 180,
      render: (value: string | null) => value ?? "—",
    },
    { title: "Công đoạn", dataIndex: "name", key: "name" },
    {
      title: "Răng",
      key: "teeth",
      width: 140,
      render: (_, row) => (row.teeth.length === 0 ? "—" : formatTeeth(row.teeth)),
    },
    {
      title: "Bác sĩ",
      dataIndex: "staffName",
      key: "staffName",
      width: 140,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "Ngày dự kiến",
      dataIndex: "scheduledDate",
      key: "scheduledDate",
      width: 120,
      render: (value: string | null) => (value ? formatDate(value) : "—"),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (_, row) => {
        const config = STAGE_STATUS_CONFIG[row.status];
        return (
          <Space size={4}>
            <Tag color={config.color}>{config.label}</Tag>
            {row.isImageRequired && row.imageUrls.length === 0 ? (
              <Tag color="warning">Cần ảnh</Tag>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 190,
      render: (_, row) =>
        row.status === STAGE_STATUS.Completed ? (
          <Text type="secondary">Đã xong</Text>
        ) : (
          <Space size={4}>
            {row.status === STAGE_STATUS.Pending ? (
              <Button
                size="small"
                type="link"
                loading={continueStage.isPending}
                onClick={() =>
                  run(continueStage.mutateAsync(row.id), "Đã tiếp tục công đoạn")
                }
              >
                Tiếp tục
              </Button>
            ) : null}
            <Button
              size="small"
              type="link"
              loading={completeStage.isPending}
              onClick={() => run(completeStage.mutateAsync(row.id), "Đã hoàn thành công đoạn")}
            >
              Hoàn thành
            </Button>
          </Space>
        ),
    },
  ];

  return (
    <>
      <Card
        size="small"
        title="Công đoạn điều trị"
        extra={
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            Công đoạn
          </Button>
        }
        style={{ marginTop: 16 }}
      >
        <div style={{ marginBottom: 12 }} data-testid="stage-progress">
          <Text type="secondary" style={{ fontSize: 12 }}>
            Tiến độ: {completed}/{stages.length} công đoạn
          </Text>
          <Progress percent={progressPercent} size="small" />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Công đoạn gần nhất:{" "}
            {latest
              ? `${latest.serviceName ?? "Dịch vụ"} — ${latest.stageNote ?? "(không có ghi chú)"}`
              : "Chưa có công đoạn"}
          </Text>
        </div>

        <Table<TreatmentStageDto>
          size="small"
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={stages}
          pagination={false}
          locale={{
            emptyText: <Empty description="Chưa có công đoạn" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          }}
        />
      </Card>

      <StageModal open={modalOpen} patientId={patientId} onClose={() => setModalOpen(false)} />
    </>
  );
}
