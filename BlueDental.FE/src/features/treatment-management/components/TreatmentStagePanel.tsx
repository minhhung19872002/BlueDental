import { useState } from "react";
import { Button, Card, Empty, Progress, Space, Table, Tag, Typography, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
    { title: t("treatment.colSequence"), dataIndex: "sequenceNumber", key: "sequenceNumber", width: 50 },
    {
      title: t("treatment.colService"),
      dataIndex: "serviceName",
      key: "serviceName",
      width: 180,
      render: (value: string | null) => value ?? "—",
    },
    { title: t("treatment.colStageName"), dataIndex: "name", key: "name" },
    {
      title: t("treatment.colTeeth"),
      key: "teeth",
      width: 140,
      render: (_, row) => (row.teeth.length === 0 ? "—" : formatTeeth(row.teeth)),
    },
    {
      title: t("treatment.colDoctor"),
      dataIndex: "staffName",
      key: "staffName",
      width: 140,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("treatment.colScheduledDate"),
      dataIndex: "scheduledDate",
      key: "scheduledDate",
      width: 120,
      render: (value: string | null) => (value ? formatDate(value) : "—"),
    },
    {
      title: t("treatment.colStatus"),
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (_, row) => {
        const config = STAGE_STATUS_CONFIG[row.status];
        return (
          <Space size={4}>
            <Tag color={config.color}>{config.label}</Tag>
            {row.isImageRequired && row.imageUrls.length === 0 ? (
              <Tag color="warning">{t("treatment.tagNeedPhoto")}</Tag>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: t("treatment.colActions"),
      key: "actions",
      width: 190,
      render: (_, row) =>
        row.status === STAGE_STATUS.Completed ? (
          <Text type="secondary">{t("treatment.stageDone")}</Text>
        ) : (
          <Space size={4}>
            {row.status === STAGE_STATUS.Pending ? (
              <Button
                size="small"
                type="link"
                loading={continueStage.isPending}
                onClick={() =>
                  run(continueStage.mutateAsync(row.id), t("treatment.stageContinued"))
                }
              >
                {t("treatment.stageContinueBtn")}
              </Button>
            ) : null}
            <Button
              size="small"
              type="link"
              loading={completeStage.isPending}
              onClick={() => run(completeStage.mutateAsync(row.id), t("treatment.stageCompleted"))}
            >
              {t("treatment.stageCompleteBtn")}
            </Button>
          </Space>
        ),
    },
  ];

  const latestText = latest
    ? t("treatment.stagePanelLatestValue", {
        service: latest.serviceName ?? t("treatment.colService"),
        note: latest.stageNote ?? t("treatment.stagePanelNoLatestNote"),
      })
    : t("treatment.stagePanelNoStage");

  return (
    <>
      <Card
        size="small"
        title={t("treatment.stagePanelTitle")}
        extra={
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            {t("treatment.stagePanelAddBtn")}
          </Button>
        }
        style={{ marginTop: 16 }}
      >
        <div style={{ marginBottom: 12 }} data-testid="stage-progress">
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t("treatment.stagePanelProgress", { completed, total: stages.length })}
          </Text>
          <Progress percent={progressPercent} size="small" />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t("treatment.stagePanelLatest")} {latestText}
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
            emptyText: <Empty description={t("treatment.stagePanelEmpty")} image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          }}
        />
      </Card>

      <StageModal open={modalOpen} patientId={patientId} onClose={() => setModalOpen(false)} />
    </>
  );
}
