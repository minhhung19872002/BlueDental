import { useState } from "react";
import { Button, Input, Select, Table, Tag, Modal, Form, InputNumber, DatePicker, message, Popconfirm } from "antd";
import { SearchOutlined, DownloadOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  useLaboOrderList,
  useCreateLaboOrder,
  useDeleteLaboOrder,
  LABO_STATUS_CONFIG,
  type LaboStatus,
  type LaboOrderDto,
  type CreateLaboOrderDto,
} from "../api/laboApi";
import { usePatientList } from "@/features/patient-management/api/patientQueries";
import { useDebounce } from "@/hooks/useDebounce";

// ── Types ──────────────────────────────────────────────────────────────────

type LaboSubRoute =
  | "mau-labo"
  | "supplier"
  | "bite"
  | "finish-line"
  | "nhip"
  | "service-material";

// ── Constants ──────────────────────────────────────────────────────────────

const SUB_ROUTES: { key: LaboSubRoute; label: string }[] = [
  { key: "mau-labo",          label: "Mẫu Labo" },
  { key: "supplier",          label: "Nhà cung cấp Labo" },
  { key: "bite",              label: "Khớp cắn Labo" },
  { key: "finish-line",       label: "Đường hoàn tất" },
  { key: "nhip",              label: "Kiểu nhịp Labo" },
  { key: "service-material",  label: "Dịch vụ - vật liệu" },
];

const MAU_LABO_FILTER_TABS: { key: LaboStatus | "all"; label: string }[] = [
  { key: "all",       label: "Tất Cả Mẫu" },
  { key: "New",       label: "Mẫu Chưa Nhận" },
  { key: "InProgress",label: "Mẫu Giao Trễ" },
  { key: "Completed", label: "Mẫu Đã Nhận Hàng" },
];

// ── Create Labo Order Modal ────────────────────────────────────────────────

function CreateLaboModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form] = Form.useForm<CreateLaboOrderDto>();
  const [patientKeyword, setPatientKeyword] = useState("");
  const debouncedPatientKeyword = useDebounce(patientKeyword, 300);
  const { data: patientData } = usePatientList({ keyword: debouncedPatientKeyword || undefined, maxResultCount: 20 });
  const createMutation = useCreateLaboOrder();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      await createMutation.mutateAsync({
        ...values,
        dueDate: values.dueDate ? dayjs(values.dueDate as unknown as dayjs.Dayjs).toISOString() : undefined,
      });
      message.success("Tạo mẫu Labo thành công");
      form.resetFields();
      onClose();
    } catch {
      // validation handled by antd
    }
  };

  return (
    <Modal
      title="Tạo mẫu Labo mới"
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      confirmLoading={createMutation.isPending}
      okText="Tạo mẫu Labo"
      cancelText="Hủy"
      width={540}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="patientId" label="Khách hàng" rules={[{ required: true, message: "Chọn khách hàng" }]}>
          <Select
            showSearch
            filterOption={false}
            onSearch={setPatientKeyword}
            placeholder="Tìm khách hàng..."
            options={(patientData?.items ?? []).map((p) => ({
              value: p.id,
              label: `${p.fullName} — ${p.phone ?? p.code}`,
            }))}
          />
        </Form.Item>
        <Form.Item name="labProviderName" label="Nhà cung cấp Labo" rules={[{ required: true, message: "Nhập tên nhà cung cấp" }]}>
          <Input placeholder="Tên nhà cung cấp Labo..." />
        </Form.Item>
        <Form.Item name="toothNumbers" label="Số răng">
          <Input placeholder="VD: 11, 12, 21" />
        </Form.Item>
        <Form.Item name="workDescription" label="Mô tả công việc">
          <Input.TextArea rows={3} placeholder="Mô tả chi tiết công việc..." />
        </Form.Item>
        <Form.Item name="estimatedCost" label="Chi phí ước tính (VND)" rules={[{ required: true, message: "Nhập chi phí" }]}>
          <InputNumber<number>
            min={0}
            style={{ width: "100%" }}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            parser={(v) => parseFloat((v ?? "0").replace(/,/g, "")) || 0}
            placeholder="0"
          />
        </Form.Item>
        <Form.Item name="dueDate" label="Ngày giao dự kiến">
          <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
        </Form.Item>
        <Form.Item name="notes" label="Ghi chú">
          <Input.TextArea rows={2} placeholder="Ghi chú thêm..." />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── Mẫu Labo View ─────────────────────────────────────────────────────────

function MauLaboView() {
  const [filterTab, setFilterTab] = useState<LaboStatus | "all">("all");
  const [keyword, setKeyword] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useLaboOrderList({
    status: filterTab === "all" ? undefined : filterTab,
    maxResultCount: 100,
  });
  const deleteMutation = useDeleteLaboOrder();

  const filtered = (data?.items ?? []).filter((o) => {
    if (!keyword) return true;
    const kw = keyword.toLowerCase();
    return (
      o.orderCode.toLowerCase().includes(kw) ||
      (o.patientName ?? "").toLowerCase().includes(kw) ||
      o.labProviderName.toLowerCase().includes(kw)
    );
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      message.success("Xóa mẫu Labo thành công");
    } catch {
      message.error("Xóa thất bại");
    }
  };

  const columns = [
    {
      title: "Mã / Ngày tạo",
      dataIndex: "orderCode",
      key: "orderCode",
      render: (code: string, record: LaboOrderDto) => (
        <div>
          <div style={{ fontWeight: 600 }}>{code}</div>
          <div style={{ fontSize: 12, color: "#8c8c8c" }}>{dayjs(record.creationTime).format("DD/MM/YYYY")}</div>
        </div>
      ),
    },
    {
      title: "Nhà cung cấp",
      dataIndex: "labProviderName",
      key: "labProviderName",
    },
    {
      title: "Khách hàng",
      dataIndex: "patientName",
      key: "patientName",
      render: (v: string) => v ?? "—",
    },
    {
      title: "Ngày giao / Trạng thái",
      key: "delivery",
      render: (_: unknown, record: LaboOrderDto) => {
        const cfg = LABO_STATUS_CONFIG[record.status];
        return (
          <div>
            <div>{record.dueDate ? dayjs(record.dueDate).format("DD/MM/YYYY") : "—"}</div>
            <Tag color={cfg.color} style={{ marginTop: 2 }}>{cfg.label}</Tag>
          </div>
        );
      },
    },
    {
      title: "Bác sĩ chỉ định",
      dataIndex: "dentistName",
      key: "dentistName",
      render: (v: string) => v ?? "—",
    },
    {
      title: "Răng",
      dataIndex: "toothNumbers",
      key: "toothNumbers",
      render: (v: string) => v ?? "—",
    },
    {
      title: "Chi phí",
      dataIndex: "estimatedCost",
      key: "estimatedCost",
      align: "right" as const,
      render: (v: number) => `${v.toLocaleString("vi-VN")} ₫`,
    },
    {
      title: "Thao tác",
      key: "actions",
      render: (_: unknown, record: LaboOrderDto) => (
        <Popconfirm
          title="Xóa mẫu Labo này?"
          onConfirm={() => handleDelete(record.id)}
          okText="Xóa"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
        >
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      {/* Status filter tabs */}
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
          {MAU_LABO_FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              style={{
                padding: "8px 16px",
                border: "none",
                borderBottom:
                  filterTab === tab.key ? "2px solid #1677ff" : "2px solid transparent",
                background: "none",
                color: filterTab === tab.key ? "#1677ff" : "#595959",
                fontWeight: filterTab === tab.key ? 600 : 400,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Button icon={<DownloadOutlined />}>Xuất Excel</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              Tạo mẫu Labo
            </Button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm theo mã, bệnh nhân..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 220 }}
              allowClear
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="reception-card reception-card--content">
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50", "100"],
            showTotal: (total) => `Hiển thị ${total} mẫu labo`,
          }}
          locale={{ emptyText: "Không có dữ liệu" }}
          size="middle"
        />
      </div>

      <CreateLaboModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

// ── Supplier View ──────────────────────────────────────────────────────────

function SupplierView() {
  const [keyword, setKeyword] = useState("");

  const columns = [
    { title: "Tên labo", dataIndex: "name", key: "name" },
    { title: "Số điện thoại", dataIndex: "phone", key: "phone" },
    { title: "Email", dataIndex: "email", key: "email" },
    { title: "Địa chỉ", dataIndex: "address", key: "address" },
    { title: "Lần cập nhật cuối", dataIndex: "updatedAt", key: "updatedAt" },
    {
      title: "Thao tác",
      key: "actions",
      render: () => (
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="small">Chỉnh sửa</Button>
          <Button size="small" danger>Xoá</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm kiếm Labo..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Button type="primary">Tạo nhà cung cấp</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table
          columns={columns}
          dataSource={[]}
          rowKey="id"
          pagination={{ pageSize: 20, showTotal: (total) => `${total} nhà cung cấp` }}
          locale={{ emptyText: "Không có dữ liệu" }}
          size="middle"
        />
      </div>
    </>
  );
}

function SimpleCatalogView({
  searchPlaceholder,
  createLabel,
  columnLabel,
  paginationUnit,
}: {
  searchPlaceholder: string;
  createLabel: string;
  columnLabel: string;
  paginationUnit: string;
}) {
  const [keyword, setKeyword] = useState("");

  const columns = [
    { title: columnLabel, dataIndex: "name", key: "name" },
    { title: "Cập nhật gần nhất", dataIndex: "updatedAt", key: "updatedAt" },
    {
      title: "Thao tác",
      key: "actions",
      render: () => (
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="small">Chỉnh sửa</Button>
          <Button size="small" danger>Xoá</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={searchPlaceholder}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Button type="primary">{createLabel}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table
          columns={columns}
          dataSource={[]}
          rowKey="id"
          pagination={{ pageSize: 20, showTotal: (total) => `${total} ${paginationUnit}` }}
          locale={{ emptyText: "Không có dữ liệu" }}
          size="middle"
        />
      </div>
    </>
  );
}

function ServiceMaterialView() {
  const [keyword, setKeyword] = useState("");

  const columns = [
    { title: "Vật liệu", dataIndex: "name", key: "name" },
    { title: "Nhóm phân loại", dataIndex: "category", key: "category" },
    { title: "Cập nhật gần nhất", dataIndex: "updatedAt", key: "updatedAt" },
    {
      title: "Thao tác",
      key: "actions",
      render: () => (
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="small">Chỉnh sửa</Button>
          <Button size="small" danger>Xoá</Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div className="reception-card" style={{ width: 240, minWidth: 200, padding: 16, flexShrink: 0 }}>
        <div style={{ marginBottom: 12 }}>
          <Button type="dashed" block>Thêm Mới</Button>
        </div>
        <div style={{ color: "#8c8c8c", fontSize: 13, textAlign: "center", paddingTop: 24 }}>
          Chưa có nhà cung cấp
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="reception-card reception-card--toolbar">
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <Button type="primary">Tạo vật liệu</Button>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm kiếm..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 220 }}
              allowClear
            />
          </div>
        </div>
        <div className="reception-card reception-card--content">
          <Table
            columns={columns}
            dataSource={[]}
            rowKey="id"
            pagination={{ pageSize: 20, showTotal: (total) => `${total} vật liệu` }}
            locale={{ emptyText: "Không có dữ liệu" }}
            size="middle"
          />
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function LaboPage() {
  const [activeTab, setActiveTab] = useState<LaboSubRoute>("mau-labo");

  const renderContent = () => {
    switch (activeTab) {
      case "mau-labo":
        return <MauLaboView />;
      case "supplier":
        return <SupplierView />;
      case "bite":
        return (
          <SimpleCatalogView
            searchPlaceholder="Tìm kiếm khớp cắn..."
            createLabel="Tạo khớp cắn"
            columnLabel="Khớp cắn Labo"
            paginationUnit="mục"
          />
        );
      case "finish-line":
        return (
          <SimpleCatalogView
            searchPlaceholder="Tìm kiếm đường hoàn tất..."
            createLabel="Tạo đường hoàn tất"
            columnLabel="Đường hoàn tất"
            paginationUnit="mục"
          />
        );
      case "nhip":
        return (
          <SimpleCatalogView
            searchPlaceholder="Tìm kiếm kiểu nhịp..."
            createLabel="Tạo kiểu nhịp"
            columnLabel="Kiểu nhịp Labo"
            paginationUnit="mục"
          />
        );
      case "service-material":
        return <ServiceMaterialView />;
      default:
        return null;
    }
  };

  return (
    <div className="reception-page">
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
          {SUB_ROUTES.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "8px 18px",
                border: "none",
                borderBottom: activeTab === tab.key ? "2px solid #1677ff" : "2px solid transparent",
                background: "none",
                color: activeTab === tab.key ? "#1677ff" : "#595959",
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: "pointer",
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {renderContent()}
    </div>
  );
}
