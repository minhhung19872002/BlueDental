import { useState } from "react";
import { Button, Input, Select, Table, Tag, Modal, Form, InputNumber, DatePicker, message, Popconfirm } from "antd";
import { SearchOutlined, DownloadOutlined, PlusOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  useLaboOrderList,
  useCreateLaboOrder,
  useDeleteLaboOrder,
  LABO_STATUS,
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
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";

// ── Types ──────────────────────────────────────────────────────────────────

type LaboSubRoute =
  | "mau-labo"
  | "supplier"
  | "bite"
  | "finish-line"
  | "nhip"
  | "service-material";

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
      message.success(t("Tạo mẫu Labo thành công"));
      form.resetFields();
      onClose();
    } catch {
      // validation handled by antd
    }
  };

  return (
    <Modal
      title={t("Tạo mẫu Labo mới")}
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      confirmLoading={createMutation.isPending}
      okText={t("Tạo mẫu Labo")}
      cancelText={t("Hủy")}
      width={540}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="patientId" label={t("Khách hàng")} rules={[{ required: true, message: t("Chọn khách hàng") }]}>
          <Select
            showSearch
            filterOption={false}
            onSearch={setPatientKeyword}
            placeholder={t("Tìm khách hàng...")}
            options={(patientData?.items ?? []).map((p) => ({
              value: p.id,
              label: `${p.fullName} — ${p.phone ?? p.code}`,
            }))}
          />
        </Form.Item>
        <Form.Item name="labProviderName" label={t("Nhà cung cấp Labo")} rules={[{ required: true, message: t("Nhập tên nhà cung cấp") }]}>
          <Input placeholder={t("Nhập tên nhà cung cấp")} />
        </Form.Item>
        <Form.Item name="toothNumbers" label={t("Số răng")}>
          <Input placeholder={t("VD: 11, 12, 21")} />
        </Form.Item>
        <Form.Item name="workDescription" label={t("Mô tả công việc")}>
          <Input.TextArea rows={3} placeholder={t("Mô tả công việc")} />
        </Form.Item>
        <Form.Item name="estimatedCost" label={t("Chi phí ước tính (VND)")} rules={[{ required: true, message: t("Nhập chi phí") }]}>
          <InputNumber<number>
            min={0}
            style={{ width: "100%" }}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            parser={(v) => parseFloat((v ?? "0").replace(/,/g, "")) || 0}
            placeholder="0"
          />
        </Form.Item>
        <Form.Item name="dueDate" label={t("Ngày giao dự kiến")}>
          <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
        </Form.Item>
        <Form.Item name="notes" label={t("Ghi chú")}>
          <Input.TextArea rows={2} placeholder={t("Ghi chú")} />
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

  const MAU_LABO_FILTER_TABS: { key: LaboStatus | "all"; label: string }[] = [
    { key: "all",                  label: t("Tất Cả Mẫu") },
    { key: LABO_STATUS.Sent,       label: t("Mẫu Chưa Nhận") },
    { key: LABO_STATUS.InProgress, label: t("Mẫu Giao Trễ") },
    { key: LABO_STATUS.Received,   label: t("Mẫu Đã Nhận Hàng") },
  ];

  const { data, isLoading } = useLaboOrderList({
    status: filterTab === "all" ? undefined : filterTab,
    maxResultCount: 100,
  });
  const deleteMutation = useDeleteLaboOrder();

  // The tiles count the whole queue, not the filtered view, so switching a
  // filter does not change the numbers above it.
  const { data: allOrders } = useLaboOrderList({ maxResultCount: 500 });
  const allLaboItems = allOrders?.items ?? [];
  const laboCounts = {
    all: allOrders?.totalCount ?? 0,
    pending: allLaboItems.filter((o) => o.status === LABO_STATUS.Sent || o.status === LABO_STATUS.InProgress).length,
    received: allLaboItems.filter((o) => o.status === LABO_STATUS.Received || o.status === LABO_STATUS.Completed).length,
  };

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
      message.success(t("Xóa mẫu Labo thành công"));
    } catch {
      message.error(t("Xóa thất bại"));
    }
  };

  const columns = [
    {
      title: t("Mã / Ngày tạo"),
      dataIndex: "orderCode",
      key: "orderCode",
      render: (code: string, record: LaboOrderDto) => (
        <div>
          <div style={{ fontWeight: 600 }}>{code}</div>
          <div style={{ fontSize: 12, color: "var(--bd-muted)" }}>{dayjs(record.creationTime).format("DD/MM/YYYY")}</div>
        </div>
      ),
    },
    {
      title: t("Nhà cung cấp"),
      dataIndex: "labProviderName",
      key: "labProviderName",
    },
    {
      title: t("Khách hàng"),
      dataIndex: "patientName",
      key: "patientName",
      render: (v: string) => v ?? "—",
    },
    {
      title: t("Ngày giao / Trạng thái"),
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
      title: t("Bác sĩ chỉ định"),
      dataIndex: "dentistName",
      key: "dentistName",
      render: (v: string) => v ?? "—",
    },
    {
      title: t("Răng"),
      dataIndex: "toothNumbers",
      key: "toothNumbers",
      render: (v: string) => v ?? "—",
    },
    {
      title: t("Chi phí"),
      dataIndex: "estimatedCost",
      key: "estimatedCost",
      align: "right" as const,
      render: (v: number) => `${v.toLocaleString("vi-VN")} ₫`,
    },
    {
      title: t("Thao tác"),
      key: "actions",
      render: (_: unknown, record: LaboOrderDto) => (
        <Popconfirm
          title={t("Xóa mẫu Labo này?")}
          onConfirm={() => handleDelete(record.id)}
          okText={t("Xóa")}
          cancelText={t("Hủy")}
          okButtonProps={{ danger: true }}
        >
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      {/* The design counts the queue above the filters. */}
      <div className="stat-tiles" style={{ marginBottom: 12 }}>
        <div className="stat-tile" style={{ "--tile-color": "var(--bd-blue)" } as React.CSSProperties}>
          <div className="stat-tile-value">{laboCounts.all}</div>
          <div className="stat-tile-label">{t("Tất cả phiếu")}</div>
        </div>
        <div className="stat-tile" style={{ "--tile-color": "var(--bd-gold-deep)" } as React.CSSProperties}>
          <div className="stat-tile-value">{laboCounts.pending}</div>
          <div className="stat-tile-label">{t("Chưa nhận")}</div>
        </div>
        <div className="stat-tile" style={{ "--tile-color": "var(--bd-green-bright)" } as React.CSSProperties}>
          <div className="stat-tile-value">{laboCounts.received}</div>
          <div className="stat-tile-label">{t("Đã nhận hàng")}</div>
        </div>
      </div>

      <div className="pill-tabs" role="tablist" style={{ marginBottom: 12 }}>
        {MAU_LABO_FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === filterTab}
            className={`pill-tab${tab.key === filterTab ? " pill-tab--active" : ""}`}
            onClick={() => setFilterTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Button icon={<DownloadOutlined />}>{t("Xuất Excel")}</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              {t("Tạo mẫu Labo")}
            </Button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder={t("Tìm theo mã, bệnh nhân...")}
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
            showTotal: (total) => t("Hiển thị {0} mẫu labo", total),
          }}
          locale={{ emptyText: t("Không có dữ liệu") }}
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
        message.success(t("Cập nhật nhà cung cấp thành công"));
      } else {
        await createMutation.mutateAsync(values);
        message.success(t("Tạo nhà cung cấp thành công"));
      }
      form.resetFields();
      setEditingItem(null);
      setModalOpen(false);
    } catch { /* validation */ }
  };

  const handleDelete = async (id: string) => {
    try { await deleteMutation.mutateAsync(id); message.success(t("Xóa thành công")); } catch { message.error(t("Xóa thất bại")); }
  };

  const columns: ColumnsType<LaboSupplierDto> = [
    { title: t("Tên nhà cung cấp"), dataIndex: "name", key: "name" },
    { title: t("Số điện thoại"), dataIndex: "phone", key: "phone", render: (v: string) => v ?? "—" },
    { title: t("Email"), dataIndex: "email", key: "email", render: (v: string) => v ?? "—" },
    { title: t("Địa chỉ"), dataIndex: "address", key: "address", render: (v: string) => v ?? "—" },
    { title: t("Cập nhật gần nhất"), dataIndex: "lastModificationTime", key: "updatedAt", render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY") : "—" },
    {
      title: t("Thao tác"), key: "actions", width: 120,
      render: (_, record) => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingItem(record); setModalOpen(true); }} />
          <Popconfirm title={t("Xóa nhà cung cấp?")} onConfirm={() => handleDelete(record.id)} okText={t("Xóa")} cancelText={t("Hủy")} okButtonProps={{ danger: true }}>
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
          <Input prefix={<SearchOutlined />} placeholder={t("Tìm kiếm Labo...")} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 280 }} allowClear />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); form.resetFields(); setModalOpen(true); }}>{t("Tạo nhà cung cấp")}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table columns={columns} dataSource={filtered} rowKey="id" loading={isLoading}
          pagination={{ pageSize: 20, showTotal: (total) => t("{0} nhà cung cấp", total) }}
          locale={{ emptyText: t("Không có dữ liệu") }} size="middle" />
      </div>
      <Modal title={isEdit ? t("Chỉnh sửa nhà cung cấp") : t("Thêm nhà cung cấp")} open={modalOpen}
        onCancel={() => { form.resetFields(); setEditingItem(null); setModalOpen(false); }}
        onOk={handleOk} confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={isEdit ? t("Lưu") : t("Tạo")} cancelText={t("Hủy")} width={480} destroyOnClose
        afterOpenChange={(visible) => { if (visible && editingItem) form.setFieldsValue(editingItem); }}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={t("Tên nhà cung cấp")} rules={[{ required: true, message: t("Nhập tên") }]}><Input placeholder={t("Nhập tên")} /></Form.Item>
          <Form.Item name="phone" label={t("Số điện thoại")}><Input placeholder={t("Số điện thoại")} /></Form.Item>
          <Form.Item name="email" label={t("Email")}><Input placeholder={t("Email")} /></Form.Item>
          <Form.Item name="address" label={t("Địa chỉ")}><Input.TextArea rows={2} placeholder={t("Địa chỉ")} /></Form.Item>
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
  labelKey: string;
  useList: () => { data: { items: LaboCatalogItem[] } | undefined; isLoading: boolean };
  useCreate: () => { mutateAsync: (data: { name: string; description?: string }) => Promise<unknown>; isPending: boolean };
  useUpdate: () => { mutateAsync: (data: { id: string; data: { name: string; description?: string } }) => Promise<unknown>; isPending: boolean };
  useDelete: () => { mutateAsync: (id: string) => Promise<unknown>; isPending: boolean };
}

const LABO_CRUD_CONFIGS: Record<string, LaboCrudConfig> = {
  bite: {
    labelKey: "Khớp cắn Labo",
    useList: useLaboBiteTypeList as LaboCrudConfig["useList"],
    useCreate: useCreateLaboBiteType as LaboCrudConfig["useCreate"],
    useUpdate: useUpdateLaboBiteType as LaboCrudConfig["useUpdate"],
    useDelete: useDeleteLaboBiteType as LaboCrudConfig["useDelete"],
  },
  "finish-line": {
    labelKey: "Đường hoàn tất",
    useList: useLaboFinishLineList as LaboCrudConfig["useList"],
    useCreate: useCreateLaboFinishLine as LaboCrudConfig["useCreate"],
    useUpdate: useUpdateLaboFinishLine as LaboCrudConfig["useUpdate"],
    useDelete: useDeleteLaboFinishLine as LaboCrudConfig["useDelete"],
  },
  nhip: {
    labelKey: "Kiểu nhịp Labo",
    useList: useLaboRhythmTypeList as LaboCrudConfig["useList"],
    useCreate: useCreateLaboRhythmType as LaboCrudConfig["useCreate"],
    useUpdate: useUpdateLaboRhythmType as LaboCrudConfig["useUpdate"],
    useDelete: useDeleteLaboRhythmType as LaboCrudConfig["useDelete"],
  },
};

function LaboCrudView({ config }: { config: LaboCrudConfig }) {
  const label = t(config.labelKey);
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
        message.success(t("Cập nhật thành công"));
      } else {
        await createMutation.mutateAsync(values);
        message.success(t("Tạo thành công"));
      }
      form.resetFields(); setEditingItem(null); setModalOpen(false);
    } catch { /* validation */ }
  };

  const handleDelete = async (id: string) => {
    try { await deleteMutation.mutateAsync(id); message.success(t("Xóa thành công")); } catch { message.error(t("Xóa thất bại")); }
  };

  const columns: ColumnsType<LaboCatalogItem> = [
    { title: label, dataIndex: "name", key: "name" },
    { title: t("Cập nhật gần nhất"), dataIndex: "lastModificationTime", key: "updatedAt", render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY") : "—" },
    {
      title: t("Thao tác"), key: "actions", width: 120,
      render: (_, record) => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingItem(record); setModalOpen(true); }} />
          <Popconfirm title={t("Xác nhận")} onConfirm={() => handleDelete(record.id)} okText={t("Xóa")} cancelText={t("Hủy")} okButtonProps={{ danger: true }}>
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
          <Input prefix={<SearchOutlined />} placeholder={`${t("Tìm kiếm...")} ${label.toLowerCase()}...`} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 280 }} allowClear />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); form.resetFields(); setModalOpen(true); }}>{t("Tạo")} {label.toLowerCase()}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table columns={columns} dataSource={items} rowKey="id" loading={isLoading}
          pagination={{ pageSize: 20, showTotal: (total) => t("{0} mục", total) }}
          locale={{ emptyText: t("Không có dữ liệu") }} size="middle" />
      </div>
      <Modal title={isEdit ? `${t("Chỉnh sửa")} ${label.toLowerCase()}` : `${t("Tạo")} ${label.toLowerCase()}`} open={modalOpen}
        onCancel={() => { form.resetFields(); setEditingItem(null); setModalOpen(false); }}
        onOk={handleOk} confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={isEdit ? t("Lưu") : t("Tạo")} cancelText={t("Hủy")} width={420} destroyOnClose
        afterOpenChange={(visible) => { if (visible && editingItem) form.setFieldsValue(editingItem); }}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={label} rules={[{ required: true, message: `${t("Tạo")} ${label.toLowerCase()}` }]}><Input placeholder={`${t("Tạo")} ${label.toLowerCase()}...`} /></Form.Item>
          <Form.Item name="description" label={t("Mô tả")}><Input.TextArea rows={2} placeholder={t("Mô tả")} /></Form.Item>
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
        message.success(t("Cập nhật vật liệu thành công"));
      } else {
        await createMutation.mutateAsync(values);
        message.success(t("Thêm vật liệu thành công"));
      }
      form.resetFields();
      setModalOpen(false);
      setEditingItem(null);
    } catch { /* validation */ }
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    message.success(t("Xóa vật liệu thành công"));
  };

  const columns: ColumnsType<LaboMaterialDto> = [
    { title: t("Tên vật liệu"), dataIndex: "name", key: "name" },
    { title: t("Nhóm phân loại"), dataIndex: "category", key: "category", render: (v: string) => v ?? "—" },
    { title: t("Nhà cung cấp"), key: "supplier", render: (_, r) => r.supplierId ? supplierMap.get(r.supplierId) ?? "—" : "—" },
    { title: t("Cập nhật gần nhất"), dataIndex: "lastModificationTime", key: "updatedAt", render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY") : "—" },
    {
      title: t("Thao tác"),
      key: "actions",
      width: 120,
      render: (_, record) => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingItem(record); form.setFieldsValue(record); setModalOpen(true); }} />
          <Popconfirm title={t("Xác nhận")} onConfirm={() => handleDelete(record.id)} okText={t("Xóa")} cancelText={t("Hủy")} okButtonProps={{ danger: true }}>
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
          {t("Nhà cung cấp")}
          <span style={{ fontWeight: 400, color: "var(--bd-muted)", marginLeft: 6 }}>{t("{0} NCC", (suppliers?.items ?? []).length)}</span>
        </div>
        {(suppliers?.items ?? []).length === 0 ? (
          <div style={{ color: "var(--bd-muted)", fontSize: 13, textAlign: "center", paddingTop: 24 }}>{t("Chưa có nhà cung cấp")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {(suppliers?.items ?? []).map((s) => (
              <div key={s.id} style={{ padding: "6px 8px", fontSize: 13, borderRadius: 4, background: "var(--bd-bg)", cursor: "default" }}>{s.name}</div>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="reception-card reception-card--toolbar">
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); form.resetFields(); setModalOpen(true); }}>{t("Tạo vật liệu")}</Button>
            <Input prefix={<SearchOutlined />} placeholder={t("Tìm kiếm...")} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 220 }} allowClear />
          </div>
        </div>
        <div className="reception-card reception-card--content">
          <Table columns={columns} dataSource={items} rowKey="id" loading={isLoading} pagination={{ pageSize: 20, showTotal: (total) => t("{0} vật liệu", total) }} locale={{ emptyText: t("Không có dữ liệu") }} size="middle" />
        </div>
      </div>

      <Modal
        title={editingItem ? t("Chỉnh sửa vật liệu") : t("Thêm vật liệu Labo")}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingItem(null); form.resetFields(); }}
        onOk={handleOk}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={editingItem ? t("Lưu") : t("Tạo")}
        cancelText={t("Hủy")}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={t("Tên vật liệu")} rules={[{ required: true, message: t("Nhập tên vật liệu") }]}><Input placeholder={t("Nhập tên vật liệu")} /></Form.Item>
          <Form.Item name="category" label={t("Nhóm phân loại")}><Input placeholder={t("VD: Kim loại, Sứ, Composite...")} /></Form.Item>
          <Form.Item name="supplierId" label={t("Nhà cung cấp")}>
            <Select placeholder={t("Chọn nhà cung cấp")} allowClear options={(suppliers?.items ?? []).map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
          <Form.Item name="description" label={t("Mô tả")}><Input.TextArea rows={2} placeholder={t("Mô tả")} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function LaboPage() {
  const [activeTab, setActiveTab] = useState<LaboSubRoute>("mau-labo");

  const SUB_ROUTES: { key: LaboSubRoute; label: string }[] = [
    { key: "mau-labo",          label: t("Mẫu Labo") },
    { key: "supplier",          label: t("Nhà cung cấp Labo") },
    { key: "bite",              label: t("Khớp cắn Labo") },
    { key: "finish-line",       label: t("Đường hoàn tất") },
    { key: "nhip",              label: t("Kiểu nhịp Labo") },
    { key: "service-material",  label: t("Dịch vụ - vật liệu") },
  ];

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
      <PageHeader
        title={t("Labo")}
        subtitle={t("Phiếu labo, nhà cung cấp và danh mục kỹ thuật")}
      />

      <div className="pill-tabs" role="tablist" style={{ marginBottom: 4 }}>
        {SUB_ROUTES.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === activeTab}
            className={`pill-tab${tab.key === activeTab ? " pill-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {renderContent()}
    </div>
  );
}
