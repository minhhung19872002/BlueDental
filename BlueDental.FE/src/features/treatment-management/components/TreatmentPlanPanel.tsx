import { useState } from "react";
import {
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Popover,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  EyeOutlined,
  PlusOutlined,
  ProfileOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
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
import { ADVISE_STATUS, formatTeeth } from "../api/consultingApi";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { downloadFile } from "@/lib/download";
import { formatDate, formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";
import { DataTable } from "@/components/DataTable";
import { useStaffOptions } from "@/hooks/useStaffOptions";
import { useTablePagination } from "@/hooks/useTablePagination";
import { countedTotal } from "@/utils/countedTotal";
import { StageModal } from "./StageModal";

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
  const [createOpen, setCreateOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const pagination = useTablePagination(20);
  const [stageOpen, setStageOpen] = useState(false);
  const [form] = Form.useForm<{
    dentistId: string;
    consultantStaffId: string;
    title?: string;
    adviseIds?: string[];
  }>();

  const { data: plans, isLoading } = useTreatmentPlans(patientId, branchId);
  const { data: advises } = usePatientAdvises({ patientId });
  const { data: dentists } = useDentistList();
  const staff = useStaffOptions().data ?? [];

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
    const values = await form.validateFields();

    setOpening(true);
    try {
      await openPlan.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        dentistId: values.dentistId,
        consultantStaffId: values.consultantStaffId,
        title: values.title,
        adviseIds: values.adviseIds,
      });
      toast.success(t("Đã tạo kế hoạch điều trị"));
      setCreateOpen(false);
      form.resetFields();
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setOpening(false);
    }
  };

  const columns: TableColumnsType<PlanRow> = [
    {
      title: t("Thêm công đoạn"),
      key: "add-stage",
      width: 120,
      align: "center",
      render: () => (
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          aria-label={t("Thêm công đoạn")}
          onClick={() => setStageOpen(true)}
        />
      ),
    },
    { title: t("Số phiếu"), dataIndex: "planCode", key: "planCode", width: 90 },
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
        <Text style={{ color: "#1f8a63" }}>
          {formatVND(row.planPayment.totalPaid)} {t("đ")}
        </Text>
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
        <Text style={{ color: "#ef4d4d" }}>
          {formatVND(row.planPayment.totalDue)} {t("đ")}
        </Text>
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
    <div className="pd-treatment-plan">
      <div className="pd-record-toolbar">
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={opening}
            onClick={() => setCreateOpen(true)}
          >
            {t("Tạo kế hoạch mới")}
          </Button>
          <Button icon={<EyeOutlined />} onClick={() => setAllOpen(true)}>
            {t("Xem tất cả dịch vụ")}
          </Button>
        </Space>
      </div>

      {/* The reference states each card as a tinted icon, an uppercase title
          and the count on the far right — see docs/clone/pages/patient-detail.md. */}
      <div className="pd-plan-cards">
        <section className="pd-plan-card pd-plan-card--blue" data-testid="plan-active-services">
          <span className="pd-plan-icon">
            <ProfileOutlined />
          </span>
          <div className="pd-plan-card-body">
            <strong>{t("DỊCH VỤ ĐANG ĐIỀU TRỊ")}</strong>
            <span>
              {activeServices.length === 0
                ? t("Chưa có dịch vụ đang điều trị")
                : activeServices.map((s) => s.serviceName ?? s.code).join(", ")}
            </span>
          </div>
          <b className="pd-plan-count">{activeServices.length}</b>
        </section>

        <section className="pd-plan-card pd-plan-card--green" data-testid="plan-slip-count">
          <span className="pd-plan-icon">
            <ThunderboltOutlined />
          </span>
          <div className="pd-plan-card-body">
            <strong>{t("DỊCH VỤ CÓ CÔNG ĐOẠN GẦN NHẤT")}</strong>
            <span>
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
            </span>
          </div>
          {slips.length > 0 ? <b className="pd-plan-count">{slips.length}</b> : null}
        </section>
      </div>

      <div className="pd-column-action">
        <Popover
          open={columnsOpen}
          onOpenChange={setColumnsOpen}
          placement="bottomRight"
          trigger="click"
          content={
            <div className="pd-column-popover">
              <strong>{t("Cột hiển thị")}</strong>
              {columns.slice(0, 8).map((column, index) => (
                <Checkbox defaultChecked key={String(column.key ?? index)}>
                  {String(column.title ?? "")}
                </Checkbox>
              ))}
              <Button type="primary" block onClick={() => setColumnsOpen(false)}>
                {t("Lưu")}
              </Button>
            </div>
          }
        >
          <Button icon={<SettingOutlined />}>{t("Cột hiển thị")}</Button>
        </Popover>
      </div>
      <div className="bd-cat-card">
        <DataTable<PlanRow>
          rowKey="id"
          loading={isLoading}
          columns={columns}
          dataSource={rows.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize)}
          locale={{ emptyText: t("Chưa có kế hoạch điều trị") }}
          pagination={pagination.buildConfig(rows.length, countedTotal(t("kế hoạch")))}
        />
      </div>

      <Modal
        open={createOpen}
        title={t("Tạo kế hoạch điều trị")}
        width={1060}
        okText={t("Lưu")}
        cancelText={t("Hủy")}
        confirmLoading={opening}
        onOk={() => void handleOpenPlan()}
        onCancel={() => setCreateOpen(false)}
        destroyOnHidden
        className="pd-plan-dialog"
      >
        <Form form={form} layout="vertical">
          <div className="pd-plan-dialog-grid">
            <Form.Item
              name="consultantStaffId"
              label={t("Tư vấn viên 1")}
              rules={[{ required: true, message: t("Vui lòng chọn tư vấn viên") }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={staff}
                placeholder={t("Chọn tư vấn viên")}
              />
            </Form.Item>
            <Form.Item
              name="dentistId"
              label={t("Bác sĩ chẩn đoán")}
              rules={[{ required: true, message: t("Vui lòng chọn bác sĩ") }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={(dentists ?? []).map((item) => ({ value: item.id, label: item.name }))}
              />
            </Form.Item>
            <Form.Item name="title" label={t("Tên kế hoạch")}>
              <Input placeholder={t("Nhập tên kế hoạch điều trị")} />
            </Form.Item>
            <Form.Item name="adviseIds" label={t("Dịch vụ tư vấn")} className="pd-plan-dialog-wide">
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                placeholder={t("Tìm dịch vụ mới")}
                options={(advises?.items ?? []).map((item) => ({
                  value: item.id,
                  label: `${item.serviceName ?? item.code} · ${formatTeeth(item.teeth)}`,
                }))}
              />
            </Form.Item>
            <Form.Item label={t("Thông tin thanh toán")} className="pd-plan-dialog-wide">
              <div className="pd-plan-payment-preview">
                <span>
                  {t("Tổng tiền dịch vụ")}: <b>0 đ</b>
                </span>
                <span>
                  {t("Giảm giá")}: <b>0 đ</b>
                </span>
                <span>
                  {t("Thành tiền")}: <b>0 đ</b>
                </span>
              </div>
            </Form.Item>
          </div>
        </Form>
      </Modal>
      <StageModal open={stageOpen} patientId={patientId} onClose={() => setStageOpen(false)} />

      <Modal
        open={allOpen}
        title={t("Tất cả dịch vụ điều trị")}
        width={980}
        footer={
          <Button type="primary" onClick={() => setAllOpen(false)}>
            {t("Đóng")}
          </Button>
        }
        onCancel={() => setAllOpen(false)}
        destroyOnHidden
      >
        <DataTable<PlanRow>
          rowKey="id"
          dataSource={rows}
          totalCount={rows.length}
          pageSize={20}
          columns={[
            {
              title: t("Dịch vụ"),
              dataIndex: "serviceName",
              render: (value: string | null, row) => value ?? row.code,
            },
            { title: t("Chẩn đoán"), render: () => "—" },
            {
              title: t("Bác sĩ"),
              dataIndex: "dentistName",
              render: (value: string | null) => value ?? "—",
            },
            {
              title: t("Trạng thái"),
              dataIndex: "status",
              render: (value: PlanRow["status"]) => serviceLineStatusConfig()[value].label,
            },
            {
              title: t("Đơn giá"),
              dataIndex: "price",
              align: "right",
              render: (value: number) => `${formatVND(value)} đ`,
            },
            {
              title: t("Thành tiền"),
              dataIndex: "effectiveAmount",
              align: "right",
              render: (value: number) => `${formatVND(value)} đ`,
            },
          ]}
          locale={{ emptyText: t("Chưa có dịch vụ điều trị") }}
        />
      </Modal>
    </div>
  );
}
