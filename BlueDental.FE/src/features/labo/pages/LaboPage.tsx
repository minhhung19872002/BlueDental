import { useState } from "react";
import { Button, Input, Select, Table, Tag, Modal, Form, InputNumber, DatePicker, message, Popconfirm } from "antd";
import { SearchOutlined, DownloadOutlined, PlusOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
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
import {
  useLaboSupplierList, useCreateLaboSupplier, useUpdateLaboSupplier, useDeleteLaboSupplier,
  useLaboBiteTypeList, useCreateLaboBiteType, useUpdateLaboBiteType, useDeleteLaboBiteType,
  useLaboFinishLineList, useCreateLaboFinishLine, useUpdateLaboFinishLine, useDeleteLaboFinishLine,
  useLaboRhythmTypeList, useCreateLaboRhythmType, useUpdateLaboRhythmType, useDeleteLaboRhythmType,
  useLaboMaterialList, useCreateLaboMaterial, useUpdateLaboMaterial, useDeleteLaboMaterial,
  type LaboSupplierDto,
  type LaboMaterialDto,
} from "../api/laboCatalogApi";
import { usePatientList } from "@/features/patient-management/api/patientQueries";
import { useDebounce } from "@/hooks/useDebounce";
import type { ColumnsType } from "antd/es/table";

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
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LaboSupplierDto | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useLaboSupplierList();
  const createMutation = useCreateLaboSupplier();
  const updateMutation = useUpdateLaboSupplier();
  const deleteMutation = useDeleteLaboSupplier();
  const isEdit = Boolean(editingItem);

  const filtered = (data?.items ?? []).filter(
    (s) => !keyword || s.name.toLowerCase().includes(keyword.toLowerCase()) || (s.phone ?? "").includes(keyword),
  );

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (isEdit && editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, data: values });
        message.success("Cập nhật nhà cung cấp thành công");
      } else {
        await createMutation.mutateAsync(values);
        message.success("Tạo nhà cung cấp thành công");
      }
      form.resetFields();
      setEditingItem(null);
      setModalOpen(false);
    } catch { /* validation */ }
  };

  const handleDelete = async (id: string) => {
    try { await deleteMutation.mutateAsync(id); message.success("Xóa thành công"); } catch { message.error("Xóa thất bại"); }
  };

  const columns: ColumnsType<LaboSupplierDto> = [
    { title: "Tên labo", dataIndex: "name", key: "name" },
    { title: "Số điện thoại", dataIndex: "phone", key: "phone", render: (v: string) => v ?? "—" },
    { title: "Email", dataIndex: "email", key: "email", render: (v: string) => v ?? "—" },
    { title: "Địa chỉ", dataIndex: "address", key: "address", render: (v: string) => v ?? "—" },
    { title: "Lần cập nhật cuối", dataIndex: "lastModificationTime", key: "updatedAt", render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY") : "—" },
    {
      title: "Thao tác", key: "actions", width: 120,
      render: (_, record) => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingItem(record); setModalOpen(true); }} />
          <Popconfirm title="Xóa nhà cung cấp?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Input prefix={<SearchOutlined />} placeholder="Tìm kiếm Labo..." value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 280 }} allowClear />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); form.resetFields(); setModalOpen(true); }}>Tạo nhà cung cấp</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table columns={columns} dataSource={filtered} rowKey="id" loading={isLoading}
          pagination={{ pageSize: 20, showTotal: (total) => `${total} nhà cung cấp` }}
          locale={{ emptyText: "Không có dữ liệu" }} size="middle" />
      </div>
      <Modal title={isEdit ? "Chỉnh sửa nhà cung cấp" : "Thêm nhà cung cấp"} open={modalOpen}
        onCancel={() => { form.resetFields(); setEditingItem(null); setModalOpen(false); }}
        onOk={handleOk} confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={isEdit ? "Lưu thay đổi" : "Tạo mới"} cancelText="Hủy" width={480} destroyOnClose
        afterOpenChange={(visible) => { if (visible && editingItem) form.setFieldsValue(editingItem); }}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Tên nhà cung cấp" rules={[{ required: true, message: "Nhập tên" }]}><Input placeholder="Tên..." /></Form.Item>
          <Form.Item name="phone" label="Số điện thoại"><Input placeholder="Số điện thoại..." /></Form.Item>
          <Form.Item name="email" label="Email"><Input placeholder="Email..." /></Form.Item>
          <Form.Item name="address" label="Địa chỉ"><Input.TextArea rows={2} placeholder="Địa chỉ..." /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}

interface LaboCatalogItem {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  lastModificationTime?: string;
}

interface LaboCrudConfig {
  label: string;
  useList: () => { data: { items: LaboCatalogItem[] } | undefined; isLoading: boolean };
  useCreate: () => { mutateAsync: (data: { name: string; description?: string }) => Promise<unknown>; isPending: boolean };
  useUpdate: () => { mutateAsync: (data: { id: string; data: { name: string; description?: string } }) => Promise<unknown>; isPending: boolean };
  useDelete: () => { mutateAsync: (id: string) => Promise<unknown>; isPending: boolean };
}

const LABO_CRUD_CONFIGS: Record<string, LaboCrudConfig> = {
  bite: {
    label: "Khớp cắn Labo",
    useList: useLaboBiteTypeList as LaboCrudConfig["useList"],
    useCreate: useCreateLaboBiteType as LaboCrudConfig["useCreate"],
    useUpdate: useUpdateLaboBiteType as LaboCrudConfig["useUpdate"],
    useDelete: useDeleteLaboBiteType as LaboCrudConfig["useDelete"],
  },
  "finish-line": {
    label: "Đường hoàn tất",
    useList: useLaboFinishLineList as LaboCrudConfig["useList"],
    useCreate: useCreateLaboFinishLine as LaboCrudConfig["useCreate"],
    useUpdate: useUpdateLaboFinishLine as LaboCrudConfig["useUpdate"],
    useDelete: useDeleteLaboFinishLine as LaboCrudConfig["useDelete"],
  },
  nhip: {
    label: "Kiểu nhịp Labo",
    useList: useLaboRhythmTypeList as LaboCrudConfig["useList"],
    useCreate: useCreateLaboRhythmType as LaboCrudConfig["useCreate"],
    useUpdate: useUpdateLaboRhythmType as LaboCrudConfig["useUpdate"],
    useDelete: useDeleteLaboRhythmType as LaboCrudConfig["useDelete"],
  },
};

function LaboCrudView({ config }: { config: LaboCrudConfig }) {
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LaboCatalogItem | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = config.useList();
  const createMutation = config.useCreate();
  const updateMutation = config.useUpdate();
  const deleteMutation = config.useDelete();
  const isEdit = Boolean(editingItem);

  const items = (data?.items ?? []).filter(
    (item) => !keyword || item.name.toLowerCase().includes(keyword.toLowerCase()),
  );

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (isEdit && editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, data: values });
        message.success("Cập nhật thành công");
      } else {
        await createMutation.mutateAsync(values);
        message.success("Tạo thành công");
      }
      form.resetFields(); setEditingItem(null); setModalOpen(false);
    } catch { /* validation */ }
  };

  const handleDelete = async (id: string) => {
    try { await deleteMutation.mutateAsync(id); message.success("Xóa thành công"); } catch { message.error("Xóa thất bại"); }
  };

  const columns: ColumnsType<LaboCatalogItem> = [
    { title: config.label, dataIndex: "name", key: "name" },
    { title: "Cập nhật gần nhất", dataIndex: "lastModificationTime", key: "updatedAt", render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY") : "—" },
    {
      title: "Thao tác", key: "actions", width: 120,
      render: (_, record) => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingItem(record); setModalOpen(true); }} />
          <Popconfirm title="Xác nhận xóa?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Input prefix={<SearchOutlined />} placeholder={`Tìm kiếm ${config.label.toLowerCase()}...`} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 280 }} allowClear />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); form.resetFields(); setModalOpen(true); }}>Tạo {config.label.toLowerCase()}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table columns={columns} dataSource={items} rowKey="id" loading={isLoading}
          pagination={{ pageSize: 20, showTotal: (total) => `${total} mục` }}
          locale={{ emptyText: "Không có dữ liệu" }} size="middle" />
      </div>
      <Modal title={isEdit ? `Chỉnh sửa ${config.label.toLowerCase()}` : `Thêm ${config.label.toLowerCase()}`} open={modalOpen}
        onCancel={() => { form.resetFields(); setEditingItem(null); setModalOpen(false); }}
        onOk={handleOk} confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={isEdit ? "Lưu" : "Tạo mới"} cancelText="Hủy" width={420} destroyOnClose
        afterOpenChange={(visible) => { if (visible && editingItem) form.setFieldsValue(editingItem); }}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={config.label} rules={[{ required: true, message: `Nhập ${config.label.toLowerCase()}` }]}><Input placeholder={`Nhập ${config.label.toLowerCase()}...`} /></Form.Item>
          <Form.Item name="description" label="Mô tả"><Input.TextArea rows={2} placeholder="Mô tả..." /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function ServiceMaterialView() {
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LaboMaterialDto | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useLaboMaterialList();
  const createMutation = useCreateLaboMaterial();
  const updateMutation = useUpdateLaboMaterial();
  const deleteMutation = useDeleteLaboMaterial();
  const { data: suppliers } = useLaboSupplierList();

  const items = (data?.items ?? []).filter((item) => {
    if (!keyword) return true;
    const kw = keyword.toLowerCase();
    return item.name.toLowerCase().includes(kw) || (item.category ?? "").toLowerCase().includes(kw);
  });

  const supplierMap = new Map((suppliers?.items ?? []).map((s) => [s.id, s.name]));

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, data: values });
        message.success("Cập nhật vật liệu thành công");
      } else {
        await createMutation.mutateAsync(values);
        message.success("Thêm vật liệu thành công");
      }
      form.resetFields();
      setModalOpen(false);
      setEditingItem(null);
    } catch { /* validation */ }
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    message.success("Xóa vật liệu thành công");
  };

  const columns: ColumnsType<LaboMaterialDto> = [
    { title: "Vật liệu", dataIndex: "name", key: "name" },
    { title: "Nhóm phân loại", dataIndex: "category", key: "category", render: (v: string) => v ?? "—" },
    { title: "Nhà cung cấp", key: "supplier", render: (_, r) => r.supplierId ? supplierMap.get(r.supplierId) ?? "—" : "—" },
    { title: "Cập nhật gần nhất", dataIndex: "lastModificationTime", key: "updatedAt", render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY") : "—" },
    {
      title: "Thao tác",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingItem(record); form.setFieldsValue(record); setModalOpen(true); }} />
          <Popconfirm title="Xác nhận xóa?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div className="reception-card" style={{ width: 240, minWidth: 200, padding: 16, flexShrink: 0 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>
          Nhà cung cấp
          <span style={{ fontWeight: 400, color: "#8c8c8c", marginLeft: 6 }}>{(suppliers?.items ?? []).length} NCC</span>
        </div>
        {(suppliers?.items ?? []).length === 0 ? (
          <div style={{ color: "#8c8c8c", fontSize: 13, textAlign: "center", paddingTop: 24 }}>Chưa có nhà cung cấp</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {(suppliers?.items ?? []).map((s) => (
              <div key={s.id} style={{ padding: "6px 8px", fontSize: 13, borderRadius: 4, background: "#F3F4F6", cursor: "default" }}>{s.name}</div>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="reception-card reception-card--toolbar">
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); form.resetFields(); setModalOpen(true); }}>Tạo vật liệu</Button>
            <Input prefix={<SearchOutlined />} placeholder="Tìm kiếm..." value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 220 }} allowClear />
          </div>
        </div>
        <div className="reception-card reception-card--content">
          <Table columns={columns} dataSource={items} rowKey="id" loading={isLoading} pagination={{ pageSize: 20, showTotal: (total) => `${total} vật liệu` }} locale={{ emptyText: "Không có dữ liệu" }} size="middle" />
        </div>
      </div>

      <Modal
        title={editingItem ? "Chỉnh sửa vật liệu" : "Thêm vật liệu Labo"}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingItem(null); form.resetFields(); }}
        onOk={handleOk}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={editingItem ? "Lưu" : "Thêm"}
        cancelText="Hủy"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Tên vật liệu" rules={[{ required: true, message: "Nhập tên vật liệu" }]}><Input placeholder="Nhập tên..." /></Form.Item>
          <Form.Item name="category" label="Nhóm phân loại"><Input placeholder="VD: Kim loại, Sứ, Composite..." /></Form.Item>
          <Form.Item name="supplierId" label="Nhà cung cấp">
            <Select placeholder="Chọn nhà cung cấp" allowClear options={(suppliers?.items ?? []).map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
          <Form.Item name="description" label="Mô tả"><Input.TextArea rows={2} placeholder="Mô tả..." /></Form.Item>
        </Form>
      </Modal>
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
      case "finish-line":
      case "nhip":
        return <LaboCrudView config={LABO_CRUD_CONFIGS[activeTab]} />;
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
