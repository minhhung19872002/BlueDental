// InsuranceClaimView — lists insurance claims for a patient and lets the user create new ones.

import { useState } from "react";
import {
  Button,
  Card,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Space,
  Typography,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";
import { formatVND } from "@/utils/format";
import {
  usePatientInsuranceClaims,
  useCreateInsuranceClaim,
  type InsuranceClaimDto,
  type InsuranceClaimStatus,
  type CreateInsuranceClaimRequest,
} from "../api/index";

const { Text } = Typography;

interface CreateClaimFormValues {
  invoiceId: string;
  insurancePlanId: string;
  claimedAmount: number;
  notes?: string;
}

interface Props {
  patientId: string;
}

export function InsuranceClaimView({ patientId }: Props) {
  const { t } = useTranslation();
  const STATUS_CONFIG: Record<InsuranceClaimStatus, { label: string; color: string }> = {
    Submitted:   { label: t("billing.statusSubmitted"),   color: "blue" },
    UnderReview: { label: t("billing.statusUnderReview"), color: "orange" },
    Approved:    { label: t("billing.statusApproved"),    color: "green" },
    Rejected:    { label: t("billing.statusRejected"),    color: "red" },
  };
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm<CreateClaimFormValues>();
  const [messageApi, contextHolder] = message.useMessage();

  const { data: claims, isLoading } = usePatientInsuranceClaims(patientId);
  const createMutation = useCreateInsuranceClaim();

  const handleCreate = (values: CreateClaimFormValues) => {
    const payload: CreateInsuranceClaimRequest = {
      patientId,
      invoiceId: values.invoiceId.trim(),
      insurancePlanId: values.insurancePlanId.trim(),
      claimedAmount: values.claimedAmount,
      notes: values.notes?.trim() || undefined,
    };

    createMutation.mutate(payload, {
      onSuccess: () => {
        void messageApi.success(t("billing.createClaimSuccess"));
        form.resetFields();
        setModalOpen(false);
      },
      onError: () => {
        void messageApi.error(t("billing.createClaimFailed"));
      },
    });
  };

  const handleCancel = () => {
    form.resetFields();
    setModalOpen(false);
  };

  const columns: ColumnsType<InsuranceClaimDto> = [
    {
      title: t("billing.claimCode"),
      dataIndex: "claimCode",
      key: "claimCode",
      width: 140,
      render: (code: string) => <Text code>{code}</Text>,
    },
    {
      title: t("billing.patientName"),
      dataIndex: "patientName",
      key: "patientName",
      width: 180,
    },
    {
      title: t("billing.insurancePlan"),
      dataIndex: "insurancePlanName",
      key: "insurancePlanName",
      ellipsis: true,
    },
    {
      title: t("billing.claimedAmount"),
      dataIndex: "claimedAmount",
      key: "claimedAmount",
      width: 150,
      align: "right",
      render: (v: number) => (
        <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(v)} đ</Text>
      ),
    },
    {
      title: t("billing.approvedAmount"),
      dataIndex: "approvedAmount",
      key: "approvedAmount",
      width: 150,
      align: "right",
      render: (v: number | null) =>
        v !== null ? (
          <Text style={{ color: "#10B981", fontVariantNumeric: "tabular-nums" }}>
            {formatVND(v)} đ
          </Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: t("common.status"),
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (status: InsuranceClaimStatus) => {
        const cfg = STATUS_CONFIG[status];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: t("billing.issuedDate"),
      dataIndex: "submittedAt",
      key: "submittedAt",
      width: 130,
      render: (v: string) => dayjs(v).format("DD/MM/YYYY"),
    },
    {
      title: t("common.actions"),
      key: "actions",
      width: 100,
      render: (_: unknown, record: InsuranceClaimDto) => (
        <Space size="small">
          {record.status === "Rejected" && record.rejectionReason && (
            <Tooltip title={t("billing.rejectionReason", { reason: record.rejectionReason })}>
              <Button size="small" danger type="link">
                {t("billing.viewReason")}
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <Card
        title={t("billing.insurance")}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
          >
            {t("billing.createClaim")}
          </Button>
        }
      >
        <Table<InsuranceClaimDto>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={claims ?? []}
          loading={isLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
            showTotal: (total, range) =>
              t("billing.showTotalClaims", { from: range[0], to: range[1], total }),
          }}
          locale={{ emptyText: t("billing.noClaims") }}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={t("billing.createClaimTitle")}
        onCancel={handleCancel}
        footer={[
          <Button key="cancel" onClick={handleCancel}>
            {t("common.cancel")}
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={createMutation.isPending}
            onClick={() => form.submit()}
          >
            {t("billing.createClaim")}
          </Button>,
        ]}
        width={480}
        destroyOnClose
      >
        <Form<CreateClaimFormValues>
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="invoiceId"
            label={t("billing.invoiceId")}
            rules={[{ required: true, message: t("insuranceClaim.validation.invoiceIdRequired") }]}
          >
            <Input placeholder={t("insuranceClaim.placeholder.invoiceId")} />
          </Form.Item>

          <Form.Item
            name="insurancePlanId"
            label={t("billing.insurancePlanId")}
            rules={[{ required: true, message: t("insuranceClaim.validation.insurancePlanIdRequired") }]}
          >
            <Input placeholder={t("insuranceClaim.placeholder.insurancePlanId")} />
          </Form.Item>

          <Form.Item
            name="claimedAmount"
            label={t("billing.claimedAmountVnd")}
            rules={[
              { required: true, message: t("insuranceClaim.validation.claimedAmountRequired") },
              { type: "number", min: 1000, message: t("insuranceClaim.validation.claimedAmountMin") },
            ]}
          >
            <InputNumber
              placeholder="0"
              min={1000}
              step={1000}
              style={{ width: "100%" }}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
              parser={(v) => Number((v ?? "").replace(/\./g, "")) as unknown as 1000}
            />
          </Form.Item>

          <Form.Item name="notes" label={t("common.note")}>
            <Input.TextArea
              placeholder={t("insuranceClaim.placeholder.notes")}
              rows={3}
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
