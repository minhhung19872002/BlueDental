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
import { formatVND } from "@/utils/format";
import {
  usePatientInsuranceClaims,
  useCreateInsuranceClaim,
  type InsuranceClaimDto,
  type InsuranceClaimStatus,
  type CreateInsuranceClaimRequest,
} from "../api/index";

const { Text } = Typography;

const STATUS_CONFIG: Record<InsuranceClaimStatus, { label: string; color: string }> = {
  Submitted:   { label: "Đã gửi",         color: "blue" },
  UnderReview: { label: "Đang xem xét",   color: "orange" },
  Approved:    { label: "Đã duyệt",       color: "green" },
  Rejected:    { label: "Từ chối",        color: "red" },
};

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
        void messageApi.success("Đã tạo yêu cầu bảo hiểm");
        form.resetFields();
        setModalOpen(false);
      },
      onError: () => {
        void messageApi.error("Không thể tạo yêu cầu bảo hiểm. Vui lòng thử lại.");
      },
    });
  };

  const handleCancel = () => {
    form.resetFields();
    setModalOpen(false);
  };

  const columns: ColumnsType<InsuranceClaimDto> = [
    {
      title: "Mã yêu cầu",
      dataIndex: "claimCode",
      key: "claimCode",
      width: 140,
      render: (code: string) => <Text code>{code}</Text>,
    },
    {
      title: "Bệnh nhân",
      dataIndex: "patientName",
      key: "patientName",
      width: 180,
    },
    {
      title: "Gói BH",
      dataIndex: "insurancePlanName",
      key: "insurancePlanName",
      ellipsis: true,
    },
    {
      title: "Số tiền yêu cầu",
      dataIndex: "claimedAmount",
      key: "claimedAmount",
      width: 150,
      align: "right",
      render: (v: number) => (
        <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(v)} đ</Text>
      ),
    },
    {
      title: "Số tiền duyệt",
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
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (status: InsuranceClaimStatus) => {
        const cfg = STATUS_CONFIG[status];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: "Ngày tạo",
      dataIndex: "submittedAt",
      key: "submittedAt",
      width: 130,
      render: (v: string) => dayjs(v).format("DD/MM/YYYY"),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 100,
      render: (_: unknown, record: InsuranceClaimDto) => (
        <Space size="small">
          {record.status === "Rejected" && record.rejectionReason && (
            <Tooltip title={`Lý do từ chối: ${record.rejectionReason}`}>
              <Button size="small" danger type="link">
                Xem lý do
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
        title="Bảo hiểm y tế"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
          >
            Tạo yêu cầu BH
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
              `Hiển thị ${range[0]}–${range[1]} trên ${total} yêu cầu`,
          }}
          locale={{ emptyText: "Chưa có yêu cầu bảo hiểm nào" }}
        />
      </Card>

      <Modal
        open={modalOpen}
        title="Tạo yêu cầu bảo hiểm"
        onCancel={handleCancel}
        footer={[
          <Button key="cancel" onClick={handleCancel}>
            Hủy
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={createMutation.isPending}
            onClick={() => form.submit()}
          >
            Tạo yêu cầu
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
            label="Mã hóa đơn"
            rules={[{ required: true, message: "Vui lòng nhập mã hóa đơn" }]}
          >
            <Input placeholder="Nhập mã hóa đơn liên quan" />
          </Form.Item>

          <Form.Item
            name="insurancePlanId"
            label="Mã gói bảo hiểm"
            rules={[{ required: true, message: "Vui lòng nhập mã gói bảo hiểm" }]}
          >
            <Input placeholder="Nhập mã gói bảo hiểm" />
          </Form.Item>

          <Form.Item
            name="claimedAmount"
            label="Số tiền yêu cầu (VND)"
            rules={[
              { required: true, message: "Vui lòng nhập số tiền" },
              { type: "number", min: 1000, message: "Số tiền phải lớn hơn 1.000 đ" },
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

          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea
              placeholder="Ghi chú thêm (tuỳ chọn)..."
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
