import { useState } from "react";
import { Button, Card, Col, Row, Space, Table, Tag, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import {
  planStatusConfig,
  SERVICE_LINE_STATUS,
  serviceLineStatusConfig,
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
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { downloadFile } from "@/lib/download";
import { formatDate, formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";

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
      toast.success(success);
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const handleOpenPlan = async () => {
    const dentistId = dentists?.[0]?.id;
    if (!dentistId) {
      toast.error(t("Chưa có bác sĩ để tiếp nhận kế hoạch"));
      return;
    }

    setOpening(true);
    try {
      await openPlan.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        dentistId,
      });
      toast.success(t("Đã tạo kế hoạch điều trị"));
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setOpening(false);
    }
  };

  const columns: TableColumnsType<PlanRow> = [
    { title: t("Số phiếu"), dataIndex: "planCode", key: "planCode", width: 90 },
    {
      title: t("Dịch vụ"),
      dataIndex: "serviceName",
      key: "serviceName",
      width: 200,
      render: (value: string | null, row) => value ?? row.code,
    },
    {
      title: t("Bác sĩ tiếp nhận"),
      dataIndex: "dentistName",
      key: "dentistName",
      width: 150,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Trạng thái - Tiến độ"),
      key: "status",
      width: 190,
      render: (_, row) => {
        const config = serviceLineStatusConfig()[row.status];
        return (
          <Space size={4}>
            <Tag color={config.color}>{config.label}</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.completedStageCount}/{row.stageCount} {t("công đoạn")}
            </Text>
          </Space>
        );
      },
    },
    {
      title: t("Ngày tạo"),
      dataIndex: "planCreatedAt",
      key: "planCreatedAt",
      width: 110,
      render: (value: string) => formatDate(value),
    },
    {
      title: t("Tổng phiếu"),
      dataIndex: "grossAmount",
      key: "grossAmount",
      width: 120,
      align: "right",
      render: (value: number) => t("{0} đ", formatVND(value)),
    },
    {
      title: t("Giảm giá"),
      dataIndex: "discountAmount",
      key: "discountAmount",
      width: 110,
      align: "right",
      render: (value: number) => t("{0} đ", formatVND(value)),
    },
    {
      title: t("Thành tiền"),
      dataIndex: "effectiveAmount",
      key: "effectiveAmount",
      width: 120,
      align: "right",
      render: (value: number) => t("{0} đ", formatVND(value)),
    },
    {
      title: t("Đã trả"),
      key: "paid",
      width: 120,
      align: "right",
      render: (_, row) => (
        <Text style={{ color: "#1f8a63" }}>{formatVND(row.planPayment.totalPaid)} {t("đ")}</Text>
      ),
    },
    {
      title: t("Hoàn tiền"),
      key: "refund",
      width: 110,
      align: "right",
      render: (_, row) => t("{0} đ", formatVND(row.planPayment.totalRefund)),
    },
    {
      title: t("Còn lại"),
      key: "due",
      width: 120,
      align: "right",
      render: (_, row) => (
        <Text style={{ color: "#ef4d4d" }}>{formatVND(row.planPayment.totalDue)} {t("đ")}</Text>
      ),
    },
    {
      title: t("Phải thu"),
      key: "receivable",
      width: 110,
      align: "right",
      render: (_, row) => t("{0} đ", formatVND(row.planPayment.debt)),
    },
    {
      title: t("Thao tác"),
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
            {t("In phiếu")}
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
                    t("Đã hoàn thành dịch vụ"),
                  )
                }
              >
                {t("Hoàn thành")}
              </Button>
              <Button
                type="link"
                size="small"
                danger
                loading={cancelLine.isPending}
                onClick={() =>
                  run(
                    cancelLine.mutateAsync({ planId: row.planId, lineId: row.id }),
                    t("Đã huỷ dịch vụ"),
                  )
                }
              >
                {t("Huỷ")}
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
          {t("Tạo kế hoạch mới")}
        </Button>
      </div>

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card
            size="small"
            style={{ borderLeft: "4px solid #1c3566" }}
            data-testid="plan-active-services"
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  background: "#1c3566",
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
                <div style={{ fontWeight: 600, fontSize: 13, color: "#101c2c" }}>
                  {t("Dịch vụ đang điều trị")}
                </div>
                <div style={{ fontSize: 12, color: "#98a4b4" }}>
                  {activeServices.length === 0
                    ? t("Chưa có dịch vụ đang điều trị")
                    : activeServices.map((s) => s.serviceName ?? s.code).join(", ")}
                </div>
              </div>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card
            size="small"
            style={{ borderLeft: "4px solid #1f8a63" }}
            data-testid="plan-slip-count"
          >
            <div style={{ fontWeight: 600, fontSize: 13, color: "#101c2c", marginBottom: 4 }}>
              {t("Phiếu điều trị")}
            </div>
            <div style={{ fontSize: 12, color: "#98a4b4" }}>
              {slips.length === 0
                ? acceptedCount === 0
                  ? t("Chưa có phiếu — hãy chốt phiếu tư vấn trước")
                  : t("{0} dịch vụ đã chốt, sẵn sàng lên kế hoạch", acceptedCount)
                : slips
                    .map(
                      (s) =>
                        `${s.code} · ${planStatusConfig()[s.status].label} · ${s.progressPercent}%`,
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
            emptyText: <span style={{ color: "#98a4b4" }}>{t("Chưa có kế hoạch điều trị")}</span>,
          }}
        />
      </Card>
    </div>
  );
}
