import { useEffect, useState } from "react";
import {
  Button, Col, DatePicker, Empty, Form, Input, InputNumber, Modal, Popconfirm,
  Row, Select, Table, Tag, Typography, message,
} from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import {
  CUSTOMER_TARGET,
  CUSTOMER_TARGET_LABELS,
  DISCOUNT_TYPE,
  VOUCHER_STATUS,
  VOUCHER_STATUS_CONFIG,
  useActivateVoucher,
  useCreateVoucher,
  useDeleteVoucher,
  usePauseVoucher,
  useUpdateVoucher,
  useVoucherStats,
  useVouchers,
  type DiscountType,
  type VoucherCustomerTarget,
  type VoucherDto,
  type VoucherStatus,
} from "../api/voucherApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { formatDate, formatVND } from "@/utils/format";

const { Text } = Typography;

interface VoucherFormValues {
  code: string;
  name: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  customerTarget: VoucherCustomerTarget;
  validRange: [dayjs.Dayjs, dayjs.Dayjs];
  usageLimit?: number | null;
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="reception-card" style={{ padding: "16px 20px" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#1B2A41", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: "#5A6B82" }}>{label}</div>
    </div>
  );
}

function VoucherModal({
  open,
  voucher,
  onClose,
}: {
  open: boolean;
  voucher: VoucherDto | null;
  onClose: () => void;
}) {
  const [form] = Form.useForm<VoucherFormValues>();
  const branchId = useCurrentBranchId();
  const createVoucher = useCreateVoucher();
  const updateVoucher = useUpdateVoucher();

  const isEdit = voucher !== null;
  const discountType = Form.useWatch("discountType", form) ?? voucher?.discountType ?? DISCOUNT_TYPE.Percentage;

  useEffect(() => {
    if (!open) return;

    form.setFieldsValue({
      code: voucher?.code ?? "",
      name: voucher?.name ?? "",
      description: voucher?.description ?? undefined,
      discountType: voucher?.discountType ?? DISCOUNT_TYPE.Percentage,
      discountValue: voucher?.discountValue ?? undefined,
      maxDiscountAmount: voucher?.maxDiscountAmount ?? undefined,
      minOrderAmount: voucher?.minOrderAmount ?? undefined,
      customerTarget: voucher?.customerTarget ?? CUSTOMER_TARGET.All,
      validRange: [
        dayjs(voucher?.validFrom ?? undefined),
        dayjs(voucher?.validTo ?? dayjs().add(30, "day")),
      ],
      usageLimit: voucher?.usageLimit ?? undefined,
    });
  }, [open, voucher, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const [validFrom, validTo] = values.validRange;

    try {
      if (isEdit) {
        await updateVoucher.mutateAsync({
          id: voucher.id,
          input: {
            name: values.name,
            description: values.description,
            minOrderAmount: values.minOrderAmount ?? null,
            maxDiscountAmount: values.maxDiscountAmount ?? null,
            customerTarget: values.customerTarget,
            validFrom: validFrom.format("YYYY-MM-DD"),
            validTo: validTo.format("YYYY-MM-DD"),
          },
        });
        message.success("Đã cập nhật voucher");
      } else {
        await createVoucher.mutateAsync({
          clinicBranchId: branchId,
          code: values.code,
          name: values.name,
          description: values.description,
          discountType: values.discountType,
          discountValue: values.discountValue,
          maxDiscountAmount: values.maxDiscountAmount ?? null,
          minOrderAmount: values.minOrderAmount ?? null,
          customerTarget: values.customerTarget,
          validFrom: validFrom.format("YYYY-MM-DD"),
          validTo: validTo.format("YYYY-MM-DD"),
          usageLimit: values.usageLimit ?? null,
        });
        message.success("Đã tạo voucher");
      }

      onClose();
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? `Sửa voucher ${voucher.code}` : "Tạo voucher"}
      okText={isEdit ? "Lưu" : "Tạo"}
      cancelText="Huỷ"
      confirmLoading={createVoucher.isPending || updateVoucher.isPending}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnHidden
      width={560}
    >
      <Form form={form} layout="vertical" requiredMark>
        <Row gutter={12}>
          <Col span={10}>
            <Form.Item
              name="code"
              label="Mã voucher"
              rules={[{ required: true, message: "Vui lòng nhập mã" }]}
            >
              {/* The code identifies redemptions, so it is fixed after creation. */}
              <Input disabled={isEdit} placeholder="SUM26" />
            </Form.Item>
          </Col>
          <Col span={14}>
            <Form.Item
              name="name"
              label="Tên chương trình"
              rules={[{ required: true, message: "Vui lòng nhập tên" }]}
            >
              <Input placeholder="Khuyến mãi hè" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="discountType" label="Kiểu giảm" rules={[{ required: true }]}>
              <Select
                disabled={isEdit}
                options={[
                  { value: DISCOUNT_TYPE.Percentage, label: "Theo phần trăm (%)" },
                  { value: DISCOUNT_TYPE.Money, label: "Số tiền cố định (đ)" },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="discountValue"
              label={discountType === DISCOUNT_TYPE.Percentage ? "Mức giảm (%)" : "Mức giảm (đ)"}
              rules={[
                { required: true, message: "Vui lòng nhập mức giảm" },
                { type: "number", min: 1, message: "Mức giảm phải lớn hơn 0" },
                ...(discountType === DISCOUNT_TYPE.Percentage
                  ? [{ type: "number" as const, max: 100, message: "Phần trăm tối đa là 100" }]
                  : []),
              ]}
            >
              <InputNumber<number> style={{ width: "100%" }} min={0} disabled={isEdit} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="minOrderAmount" label="Đơn tối thiểu (đ)">
              <InputNumber<number> style={{ width: "100%" }} min={0} step={100000} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="maxDiscountAmount"
              label="Giảm tối đa (đ)"
              tooltip="Chỉ áp dụng cho voucher giảm theo phần trăm"
            >
              <InputNumber<number>
                style={{ width: "100%" }}
                min={0}
                step={100000}
                disabled={discountType !== DISCOUNT_TYPE.Percentage}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="customerTarget" label="Áp dụng cho" rules={[{ required: true }]}>
              <Select
                options={Object.entries(CUSTOMER_TARGET_LABELS).map(([value, label]) => ({
                  value: Number(value) as VoucherCustomerTarget,
                  label,
                }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="usageLimit" label="Giới hạn lượt dùng">
              <InputNumber<number>
                style={{ width: "100%" }}
                min={1}
                placeholder="Bỏ trống = không giới hạn"
                disabled={isEdit}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="validRange" label="Thời hạn" rules={[{ required: true }]}>
          <DatePicker.RangePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
        </Form.Item>

        <Form.Item name="description" label="Mô tả">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/**
 * Voucher khuyến mãi — mirrors the reference's /voucher screen: a stats bar over
 * a table of promotions with activate / pause controls.
 */
export function VoucherPage() {
  const branchId = useCurrentBranchId();
  const [statusFilter, setStatusFilter] = useState<VoucherStatus | undefined>();
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VoucherDto | null>(null);

  const { data: stats } = useVoucherStats(branchId);
  const { data: page, isLoading } = useVouchers(branchId, statusFilter, keyword);

  const activateVoucher = useActivateVoucher();
  const pauseVoucher = usePauseVoucher();
  const deleteVoucher = useDeleteVoucher();

  const run = async (action: Promise<unknown>, successMessage: string) => {
    try {
      await action;
      message.success(successMessage);
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  const columns: ColumnsType<VoucherDto> = [
    {
      title: "Mã / Tên Voucher",
      key: "code",
      render: (_, row) => (
        <>
          <div style={{ fontWeight: 600, color: "#1B2A41" }}>{row.code}</div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>{row.name}</div>
        </>
      ),
    },
    {
      title: "Mức giảm",
      key: "discount",
      width: 160,
      render: (_, row) =>
        row.discountType === DISCOUNT_TYPE.Percentage
          ? `${row.discountValue}%${row.maxDiscountAmount ? ` (tối đa ${formatVND(row.maxDiscountAmount)} đ)` : ""}`
          : `${formatVND(row.discountValue)} đ`,
    },
    {
      title: "Điều kiện áp dụng",
      key: "conditions",
      width: 200,
      render: (_, row) => (
        <>
          <div>{CUSTOMER_TARGET_LABELS[row.customerTarget]}</div>
          {row.minOrderAmount != null && (
            <div style={{ fontSize: 12, color: "#6B7280" }}>
              Đơn từ {formatVND(row.minOrderAmount)} đ
            </div>
          )}
        </>
      ),
    },
    {
      title: "Thời hạn",
      key: "validity",
      width: 190,
      render: (_, row) => `${formatDate(row.validFrom)} – ${formatDate(row.validTo)}`,
    },
    {
      title: "Lượt dùng",
      key: "usage",
      width: 120,
      render: (_, row) =>
        row.usageLimit == null
          ? `${row.usedCount} / ∞`
          : `${row.usedCount} / ${row.usageLimit}`,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (status: VoucherStatus) => {
        const config = VOUCHER_STATUS_CONFIG[status];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 220,
      render: (_, row) => (
        <>
          {row.status !== VOUCHER_STATUS.Active && row.status !== VOUCHER_STATUS.Expired && (
            <Button
              type="link"
              size="small"
              onClick={() => run(activateVoucher.mutateAsync(row.id), "Đã kích hoạt voucher")}
            >
              Kích hoạt
            </Button>
          )}
          {row.status === VOUCHER_STATUS.Active && (
            <Button
              type="link"
              size="small"
              onClick={() => run(pauseVoucher.mutateAsync(row.id), "Đã tạm dừng voucher")}
            >
              Tạm dừng
            </Button>
          )}
          <Button type="link" size="small" onClick={() => { setEditing(row); setModalOpen(true); }}>
            Sửa
          </Button>
          {row.usedCount === 0 && (
            <Popconfirm
              title="Xoá voucher này?"
              okText="Xoá"
              cancelText="Huỷ"
              onConfirm={() => run(deleteVoucher.mutateAsync(row.id), "Đã xoá voucher")}
            >
              <Button type="link" size="small" danger>Xoá</Button>
            </Popconfirm>
          )}
        </>
      ),
    },
  ];

  return (
    <div className="reception-page">
      <div className="reception-card" style={{ padding: "16px 20px", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#1B2A41" }}>Voucher khuyến mãi</div>
        <Text style={{ fontSize: 13, color: "#5A6B82" }}>
          Quản lý các chương trình khuyến mãi cho khách hàng
        </Text>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={12} md={6}><StatTile value={stats?.total ?? 0} label="Tổng voucher" /></Col>
        <Col xs={12} md={6}><StatTile value={stats?.active ?? 0} label="Đang hoạt động" /></Col>
        <Col xs={12} md={6}><StatTile value={stats?.issued ?? 0} label="Đã phát hành" /></Col>
        <Col xs={12} md={6}><StatTile value={stats?.expired ?? 0} label="Đã hết hạn" /></Col>
      </Row>

      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm theo mã hoặc tên voucher..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            allowClear
            placeholder="Tất cả trạng thái"
            style={{ width: 180 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={Object.entries(VOUCHER_STATUS_CONFIG).map(([value, config]) => ({
              value: Number(value) as VoucherStatus,
              label: config.label,
            }))}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            style={{ marginLeft: "auto" }}
            onClick={() => { setEditing(null); setModalOpen(true); }}
          >
            Tạo voucher
          </Button>
        </div>
      </div>

      <div className="reception-card reception-card--content">
        <Table<VoucherDto>
          rowKey="id"
          loading={isLoading}
          dataSource={page?.items ?? []}
          columns={columns}
          size="middle"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Chưa có voucher nào — nhấn “Tạo voucher” để bắt đầu."
              />
            ),
          }}
          pagination={{
            pageSize: 20,
            showTotal: (total, range) => `Hiển thị ${range[0]}–${range[1]} trên ${total}`,
          }}
        />
      </div>

      <VoucherModal
        open={modalOpen}
        voucher={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
      />
    </div>
  );
}
