import { useState } from "react";
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Tag,
} from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import dayjs from "dayjs";
import {
  PRESCRIPTION_STATUS,
  prescriptionStatusConfig,
  useCancelPrescription,
  useCreatePrescription,
  useDispensePrescription,
  usePrescriptions,
  type PrescriptionDto,
} from "../api/prescriptionApi";
import { CATALOG_GROUP, useCatalogOptions } from "@/hooks/useCatalogOptions";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { downloadFile } from "@/lib/download";
import { formatDate } from "@/utils/format";
import { t } from "@/lib/i18n";
import { DataTable } from "@/components/DataTable";
import { useTablePagination } from "@/hooks/useTablePagination";
import { countedTotal } from "@/utils/countedTotal";

interface PrescriptionPanelProps {
  patientId: string;
  /** Patient detail uses the reference's compact six-column presentation. */
  compact?: boolean;
  patientLabel?: string;
  patientPhone?: string | null;
}

interface PrescriptionFormValues {
  staffId: string;
  diagnosisText?: string;
  followUpDate?: dayjs.Dayjs;
  note?: string;
  items: {
    medicationId: string;
    dosage: string;
    frequency: string;
    durationDays: number;
    quantity: number;
  }[];
}

/**
 * Đơn thuốc.
 *
 * The reference lists slips with "Mã đơn thuốc, Bác sĩ, Chẩn đoán, Tái khám,
 * Ngày tạo"; the medicines are the slip's lines and come from the Loại thuốc
 * catalog.
 */
export function PrescriptionPanel({
  patientId,
  compact = false,
  patientLabel,
  patientPhone,
}: PrescriptionPanelProps) {
  const branchId = useCurrentBranchId();
  const [form] = Form.useForm<PrescriptionFormValues>();
  const [modalOpen, setModalOpen] = useState(false);
  const pagination = useTablePagination(20);

  const { data, isLoading } = usePrescriptions(patientId, branchId);
  const { data: medications } = useCatalogOptions(CATALOG_GROUP.MedicationType);
  const { data: dentists } = useDentistList();
  // "Đơn thuốc mẫu" is a catalog group, read through the shared catalog lookup.
  // It used to call a /prescription-templates route that does not exist, so the
  // picker was permanently empty and the console carried a 404 on every visit.
  const templates = useCatalogOptions(CATALOG_GROUP.PrescriptionTemplate).data ?? [];

  const createPrescription = useCreatePrescription();
  const dispensePrescription = useDispensePrescription();
  const cancelPrescription = useCancelPrescription();

  const run = async (action: Promise<unknown>, success: string) => {
    try {
      await action;
      toast.success(success);
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();

    try {
      await createPrescription.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        staffId: values.staffId,
        diagnosisText: values.diagnosisText,
        followUpDate: values.followUpDate?.format("YYYY-MM-DD"),
        note: values.note,
        items: values.items.map((item) => ({
          medicationId: item.medicationId,
          dosage: item.dosage,
          frequency: item.frequency,
          durationDays: item.durationDays,
          quantity: item.quantity,
        })),
      });

      toast.success(t("Đã tạo đơn thuốc"));
      setModalOpen(false);
      form.resetFields();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const columns: TableColumnsType<PrescriptionDto> = [
    { title: t("Mã đơn thuốc"), dataIndex: "code", key: "code", width: 130 },
    {
      title: t("Bác sĩ"),
      dataIndex: "staffName",
      key: "staffName",
      width: 150,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Chẩn đoán"),
      dataIndex: "diagnosisText",
      key: "diagnosisText",
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Thuốc"),
      key: "items",
      width: 240,
      render: (_, row) =>
        row.items.length === 0
          ? "—"
          : row.items.map((item) => t("{0} ×{1}", item.medicationName, item.quantity)).join(", "),
    },
    {
      title: t("Tái khám"),
      dataIndex: "followUpDate",
      key: "followUpDate",
      width: 110,
      render: (value: string | null) => (value ? formatDate(value) : "—"),
    },
    {
      title: t("Ngày tạo"),
      dataIndex: "issuedAt",
      key: "issuedAt",
      width: 110,
      render: (value: string) => formatDate(value),
    },
    {
      title: t("Trạng thái"),
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (value: PrescriptionDto["status"]) => {
        const config = prescriptionStatusConfig()[value];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: t("Thao tác"),
      key: "actions",
      width: 230,
      render: (_, row) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            onClick={() =>
              void downloadFile(`/v1/app/prescriptions/${row.id}/pdf`, `don-thuoc-${row.code}.pdf`)
            }
          >
            {t("In đơn")}
          </Button>
          {row.status === PRESCRIPTION_STATUS.Active ? (
            <>
              <Button
                type="link"
                size="small"
                loading={dispensePrescription.isPending}
                onClick={() => run(dispensePrescription.mutateAsync(row.id), t("Đã phát thuốc"))}
              >
                {t("Phát thuốc")}
              </Button>
              <Button
                type="link"
                size="small"
                danger
                loading={cancelPrescription.isPending}
                onClick={() => run(cancelPrescription.mutateAsync(row.id), t("Đã huỷ đơn thuốc"))}
              >
                {t("Huỷ")}
              </Button>
            </>
          ) : null}
        </Space>
      ),
    },
  ];
  const visibleColumns = compact
    ? columns.filter((column) => column.key !== "items" && column.key !== "status")
    : columns;

  const rows = data?.items ?? [];

  return (
    <div className={compact ? "pd-prescription-panel" : undefined}>
      <div className="pd-prescription-toolbar">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          {t("Tạo đơn thuốc")}
        </Button>
      </div>

      <div className="bd-cat-card">
        <DataTable<PrescriptionDto>
          size="small"
          rowKey="id"
          loading={isLoading}
          columns={visibleColumns}
          dataSource={
            compact
              ? rows.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize)
              : rows
          }
          pagination={
            compact ? pagination.buildConfig(rows.length, countedTotal(t("đơn thuốc"))) : false
          }
          locale={{ emptyText: t("Chưa có đơn thuốc") }}
        />
      </div>

      <Modal
        open={modalOpen}
        title={t("Thêm đơn thuốc")}
        okText={t("Lưu")}
        cancelText={t("Huỷ")}
        width={1040}
        confirmLoading={createPrescription.isPending}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnHidden
        className="pd-prescription-dialog"
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={{ items: [{ durationDays: 5, quantity: 10 }] }}
        >
          <div className="pd-prescription-head">
            <div>
              <strong>{patientLabel ?? t("Bệnh nhân")}</strong>
              {patientPhone ? <span>{patientPhone}</span> : null}
            </div>
            <Select
              allowClear
              placeholder={t("Chọn mẫu đơn thuốc")}
              options={templates.map((item) => ({ value: item.id, label: item.name }))}
              onChange={(id) => {
                const template = templates.find((item) => item.id === id);
                if (template?.content) form.setFieldValue("note", template.content);
              }}
            />
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => {
                const items = form.getFieldValue("items") ?? [];
                form.setFieldValue("items", [...items, { durationDays: 5, quantity: 10 }]);
              }}
            >
              {t("Thêm loại thuốc")}
            </Button>
          </div>
          <div className="pd-prescription-grid">
            <Form.Item
              name="staffId"
              label={t("Bác sĩ kê đơn")}
              rules={[{ required: true, message: t("Vui lòng chọn bác sĩ") }]}
            >
              <Select
                placeholder={t("Chọn bác sĩ")}
                options={(dentists ?? []).map((d) => ({ value: d.id, label: d.name }))}
              />
            </Form.Item>

            <Form.Item name="diagnosisText" label={t("Chẩn đoán")}>
              <Input placeholder={t("Chẩn đoán trên đơn")} maxLength={500} />
            </Form.Item>

            <Form.Item name="followUpDate" label={t("Tái khám")}>
              <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
            </Form.Item>

            <Form.Item name="note" label={t("Lời dặn")}>
              <Input.TextArea rows={2} maxLength={1000} placeholder={t("Lời dặn của bác sĩ")} />
            </Form.Item>
          </div>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" style={{ display: "flex", gap: 8 }}>
                    {/* The line carries no label, so the wrapper gives tests a handle. */}
                    <div data-testid="prescription-medicine">
                      <Form.Item
                        name={[field.name, "medicationId"]}
                        rules={[{ required: true, message: t("Chọn thuốc") }]}
                        style={{ width: 220 }}
                      >
                        <Select
                          showSearch
                          optionFilterProp="label"
                          placeholder={
                            (medications?.length ?? 0) === 0
                              ? t("Chưa có danh mục thuốc")
                              : t("Chọn thuốc")
                          }
                          options={(medications ?? []).map((m) => ({ value: m.id, label: m.name }))}
                        />
                      </Form.Item>
                    </div>
                    <Form.Item name={[field.name, "dosage"]} style={{ width: 110 }}>
                      <Input placeholder={t("Liều dùng")} />
                    </Form.Item>
                    <Form.Item name={[field.name, "frequency"]} style={{ width: 120 }}>
                      <Input placeholder={t("Tần suất")} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, "durationDays"]}
                      rules={[{ required: true, message: t("Số ngày") }]}
                      style={{ width: 90 }}
                    >
                      <InputNumber min={1} placeholder={t("Ngày")} style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, "quantity"]}
                      rules={[{ required: true, message: t("Số lượng") }]}
                      style={{ width: 90 }}
                    >
                      <InputNumber min={1} placeholder="SL" style={{ width: "100%" }} />
                    </Form.Item>
                    {fields.length > 1 && (
                      <MinusCircleOutlined onClick={() => remove(field.name)} />
                    )}
                  </Space>
                ))}
                <Button
                  type="dashed"
                  block
                  icon={<PlusOutlined />}
                  onClick={() => add({ durationDays: 5, quantity: 10 })}
                >
                  {t("Thêm thuốc")}
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
