import { useState } from "react";
import { Button, Card, Col, Row, Space, Table, Tag, Typography, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import {
  PLAN_STATUS_CONFIG,
  SERVICE_LINE_STATUS,
  SERVICE_LINE_STATUS_CONFIG,
  useCancelServiceLine,
  useCompleteServiceLine,
  useOpenTreatmentPlan,
  useTreatmentPlans,
  type TreatmentPlanSlipDto,
  type TreatmentServiceDto,
} from "../api/treatmentPlanApi";
import { usePatientAdvises } from "../api/consultingQueries";
import { ADVISE_STATUS } from "../api/consultingApi";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { downloadFile } from "@/lib/download";
import { formatDate, formatVND } from "@/utils/format";

const { Text } = Typography;

interface TreatmentPlanPanelProps {
  patientId: string;
}

/** One row of the reference's treatment-plan table: a slip flattened per service line. */
interface PlanRow extends TreatmentServiceDto {
  planId: string;
  planCode: string;
  planStatus: TreatmentPlanSlipDto["status"];
  planProgress: number;
  dentistName: string | null;
  planCreatedAt: string;
  planPayment: TreatmentPlanSlipDto["payment"];
}

/**
 * Kế hoạch điều trị.
 *
 * The reference renders one row per service line, carrying the slip's number, the
 * receiving dentist and the slip money. Everything money-side is derived by the
 * server, so this component only formats.
 */
export function TreatmentPlanPanel({ patientId }: TreatmentPlanPanelProps) {
  const branchId = useCurrentBranchId();
  const [opening, setOpening] = useState(false);

  const { data: plans, isLoading } = useTreatmentPlans(patientId, branchId);
  const { data: advises } = usePatientAdvises({ patientId });
  const { data: dentists } = useDentistList();

  const openPlan = useOpenTreatmentPlan();
  const completeLine = useCompleteServiceLine();
  const cancelLine = useCancelServiceLine();

  const acceptedCount = (advises?.items ?? []).filter(
    (advise) => advise.status === ADVISE_STATUS.Accepted,
  ).length;

  const slips = plans?.items ?? [];
  const rows: PlanRow[] = slips.flatMap((slip) =>
    slip.services.map((line) => ({
      ...line,
      planId: slip.id,
      planCode: slip.code,
      planStatus: slip.status,
      planProgress: slip.progressPercent,
      dentistName: slip.dentistName,
      planCreatedAt: slip.creationTime,
      planPayment: slip.payment,
    })),
  );

  const activeServices = rows.filter((r) => r.status === SERVICE_LINE_STATUS.InProgress);

  const run = async (action: Promise<unknown>, success: string) => {
    try {
      await action;
      message.success(success);
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  const handleOpenPlan = async () => {
    const dentistId = dentists?.[0]?.id;
    if (!dentistId) {
      message.error("Chưa có bác sĩ để tiếp nhận kế hoạch");
      return;
    }

    setOpening(true);
    try {
      await openPlan.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        dentistId,
      });
      message.success("Đã tạo kế hoạch điều trị");
    } catch (error) {
      message.error(extractApiError(error));
    } finally {
      setOpening(false);
    }
  };

  const columns: TableColumnsType<PlanRow> = [
    { title: "Số phiếu", dataIndex: "planCode", key: "planCode", width: 90 },
    {
      title: "Dịch vụ",
      dataIndex: "serviceName",
      key: "serviceName",
      width: 200,
      render: (value: string | null, row) => value ?? row.code,
    },
    {
      title: "Bác sĩ tiếp nhận",
      dataIndex: "dentistName",
      key: "dentistName",
      width: 150,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: "Trạng thái - Tiến độ",
      key: "status",
      width: 190,
      render: (_, row) => {
        const config = SERVICE_LINE_STATUS_CONFIG[row.status];
        return (
          <Space size={4}>
            <Tag color={config.color}>{config.label}</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.completedStageCount}/{row.stageCount} công đoạn
            </Text>
          </Space>
        );
      },
    },
    {
      title: "Ngày tạo",
      dataIndex: "planCreatedAt",
      key: "planCreatedAt",
      width: 110,
      render: (value: string) => formatDate(value),
    },
    {
      title: "Tổng phiếu",
      dataIndex: "grossAmount",
      key: "grossAmount",
      width: 120,
      align: "right",
      render: (value: number) => `${formatVND(value)} đ`,
    },
    {
      title: "Giảm giá",
      dataIndex: "discountAmount",
      key: "discountAmount",
      width: 110,
      align: "right",
      render: (value: number) => `${formatVND(value)} đ`,
    },
    {
      title: "Thành tiền",
      dataIndex: "effectiveAmount",
      key: "effectiveAmount",
      width: 120,
      align: "right",
      render: (value: number) => `${formatVND(value)} đ`,
    },
    {
      title: "Đã trả",
      key: "paid",
      width: 120,
      align: "right",
      render: (_, row) => (
        <Text style={{ color: "#10B981" }}>{formatVND(row.planPayment.totalPaid)} đ</Text>
      ),
    },
    {
      title: "Hoàn tiền",
      key: "refund",
      width: 110,
      align: "right",
      render: (_, row) => `${formatVND(row.planPayment.totalRefund)} đ`,
    },
    {
      title: "Còn lại",
      key: "due",
      width: 120,
      align: "right",
      render: (_, row) => (
        <Text style={{ color: "#EF4444" }}>{formatVND(row.planPayment.totalDue)} đ</Text>
      ),
    },
    {
      title: "Phải thu",
      key: "receivable",
      width: 110,
      align: "right",
      render: (_, row) => `${formatVND(row.planPayment.debt)} đ`,
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 250,
      fixed: "right",
      render: (_, row) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            onClick={() =>
              void downloadFile(
                `/v1/app/patient-treatments/${row.planId}/pdf`,
                `phieu-dieu-tri-${row.planCode}.pdf`,
              )
            }
          >
            In phiếu
          </Button>
          {row.status === SERVICE_LINE_STATUS.Done ||
          row.status === SERVICE_LINE_STATUS.Cancelled ? null : (
            <>
              <Button
                type="link"
                size="small"
                loading={completeLine.isPending}
                onClick={() =>
                  run(
                    completeLine.mutateAsync({ planId: row.planId, lineId: row.id }),
                    "Đã hoàn thành dịch vụ",
                  )
                }
              >
                Hoàn thành
              </Button>
              <Button
                type="link"
                size="small"
                danger
                loading={cancelLine.isPending}
                onClick={() =>
                  run(
                    cancelLine.mutateAsync({ planId: row.planId, lineId: row.id }),
                    "Đã huỷ dịch vụ",
                  )
                }
              >
                Huỷ
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          loading={opening}
          disabled={acceptedCount === 0}
          onClick={handleOpenPlan}
        >
          Tạo kế hoạch mới
        </Button>
      </div>

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card
            size="small"
            style={{ borderLeft: "4px solid #2671D8" }}
            data-testid="plan-active-services"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  background: "#2671D8",
                  color: "#fff",
                  borderRadius: 12,
                  padding: "2px 10px",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {activeServices.length}
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41" }}>
                  Dịch vụ đang điều trị
                </div>
                <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                  {activeServices.length === 0
                    ? "Chưa có dịch vụ đang điều trị"
                    : activeServices.map((s) => s.serviceName ?? s.code).join(", ")}
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            size="small"
            style={{ borderLeft: "4px solid #10B981" }}
            data-testid="plan-slip-count"
          >
            <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41", marginBottom: 4 }}>
              Phiếu điều trị
            </div>
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>
              {slips.length === 0
                ? acceptedCount === 0
                  ? "Chưa có phiếu — hãy chốt phiếu tư vấn trước"
                  : `${acceptedCount} dịch vụ đã chốt, sẵn sàng lên kế hoạch`
                : slips
                    .map(
                      (s) =>
                        `${s.code} · ${PLAN_STATUS_CONFIG[s.status].label} · ${s.progressPercent}%`,
                    )
                    .join(" — ")}
            </div>
          </Card>
        </Col>
      </Row>

      <Card size="small">
        <Table<PlanRow>
          size="small"
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 1500 }}
          locale={{
            emptyText: <span style={{ color: "#9CA3AF" }}>Chưa có kế hoạch điều trị</span>,
          }}
        />
      </Card>
    </div>
  );
}
