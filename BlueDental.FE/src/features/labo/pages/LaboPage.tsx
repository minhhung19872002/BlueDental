import { useState } from "react";
import { Button, Input, Select, Table, Tag, Modal, Form, InputNumber, DatePicker, message, Popconfirm } from "antd";
import { SearchOutlined, DownloadOutlined, PlusOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
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

// ── Create Labo Order Modal ────────────────────────────────────────────────

function CreateLaboModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
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
      message.success(t("labo.createSuccess"));
      form.resetFields();
      onClose();
    } catch {
      // validation handled by antd
    }
  };

  return (
    <Modal
      title={t("labo.createSampleTitle")}
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      confirmLoading={createMutation.isPending}
      okText={t("labo.createSample")}
      cancelText={t("common.cancel")}
      width={540}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="patientId" label={t("labo.customer")} rules={[{ required: true, message: t("labo.selectCustomer") }]}>
          <Select
            showSearch
            filterOption={false}
            onSearch={setPatientKeyword}
            placeholder={t("labo.searchCustomer")}
            options={(patientData?.items ?? []).map((p) => ({
              value: p.id,
              label: `${p.fullName} — ${p.phone ?? p.code}`,
            }))}
          />
        </Form.Item>
        <Form.Item name="labProviderName" label={t("labo.supplierName")} rules={[{ required: true, message: t("labo.enterSupplier") }]}>
          <Input placeholder={t("labo.enterSupplier")} />
        </Form.Item>
        <Form.Item name="toothNumbers" label={t("labo.toothNumber")}>
          <Input placeholder={t("labo.toothNumberPlaceholder")} />
        </Form.Item>
        <Form.Item name="workDescription" label={t("labo.jobDescription")}>
          <Input.TextArea rows={3} placeholder={t("labo.jobDescription")} />
        </Form.Item>
        <Form.Item name="estimatedCost" label={t("labo.estimatedCost")} rules={[{ required: true, message: t("labo.enterCost") }]}>
          <InputNumber<number>
            min={0}
            style={{ width: "100%" }}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            parser={(v) => parseFloat((v ?? "0").replace(/,/g, "")) || 0}
            placeholder="0"
          />
        </Form.Item>
        <Form.Item name="dueDate" label={t("labo.expectedDelivery")}>
          <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
        </Form.Item>
        <Form.Item name="notes" label={t("common.note")}>
          <Input.TextArea rows={2} placeholder={t("common.note")} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── Mẫu Labo View ─────────────────────────────────────────────────────────

function MauLaboView() {
  const { t } = useTranslation();
  const [filterTab, setFilterTab] = useState<LaboStatus | "all">("all");
  const [keyword, setKeyword] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const MAU_LABO_FILTER_TABS: { key: LaboStatus | "all"; label: string }[] = [
    { key: "all",        label: t("labo.allSamples") },
    { key: "New",        label: t("labo.notReceived") },
    { key: "InProgress", label: t("labo.lateDelivery") },
    { key: "Completed",  label: t("labo.received") },
  ];

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
      message.success(t("labo.deleteSuccess"));
    } catch {
      message.error(t("common.deleteFailed"));
    }
  };

  const columns = [
    {
      title: t("labo.codeDate"),
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
      title: t("labo.supplier"),
      dataIndex: "labProviderName",
      key: "labProviderName",
    },
    {
      title: t("labo.customer"),
      dataIndex: "patientName",
      key: "patientName",
      render: (v: string) => v ?? "—",
    },
    {
      title: t("labo.deliveryStatus"),
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
      title: t("labo.assignedDoctor"),
      dataIndex: "dentistName",
      key: "dentistName",
      render: (v: string) => v ?? "—",
    },
    {
      title: t("labo.teeth"),
      dataIndex: "toothNumbers",
      key: "toothNumbers",
      render: (v: string) => v ?? "—",
    },
    {
      title: t("labo.cost"),
      dataIndex: "estimatedCost",
      key: "estimatedCost",
      align: "right" as const,
      render: (v: number) => `${v.toLocaleString("vi-VN")} ₫`,
    },
    {
      title: t("common.actions"),
      key: "actions",
      render: (_: unknown, record: LaboOrderDto) => (
        <Popconfirm
          title={t("labo.confirmDelete")}
          onConfirm={() => handleDelete(record.id)}
          okText={t("common.delete")}
          cancelText={t("common.cancel")}
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
            <Button icon={<DownloadOutlined />}>{t("common.exportExcel")}</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              {t("labo.createSample")}
            </Button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder={t("labo.searchSample")}
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
            showTotal: (total) => t("labo.showTotal", { total }),
          }}
          locale={{ emptyText: t("common.noData") }}
          size="middle"
        />
      </div>

      <CreateLaboModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

// ── Supplier View ──────────────────────────────────────────────────────────

function SupplierView() {
  const { t } = useTranslation();
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
        message.success(t("labo.updateSupplierSuccess"));
      } else {
        await createMutation.mutateAsync(values);
        message.success(t("labo.createSupplierSuccess"));
      }
      form.resetFields();
      setEditingItem(null);
      setModalOpen(false);
    } catch { /* validation */ }
  };

  const handleDelete = async (id: string) => {
    try { await deleteMutation.mutateAsync(id); message.success(t("common.deleteSuccess")); } catch { message.error(t("common.deleteFailed")); }
  };

  const columns: ColumnsType<LaboSupplierDto> = [
    { title: t("labo.supplierNameLabel"), dataIndex: "name", key: "name" },
    { title: t("labo.supplierPhone"), dataIndex: "phone", key: "phone", render: (v: string) => v ?? "—" },
    { title: t("labo.supplierEmail"), dataIndex: "email", key: "email", render: (v: string) => v ?? "—" },
    { title: t("labo.supplierAddress"), dataIndex: "address", key: "address", render: (v: string) => v ?? "—" },
    { title: t("common.lastUpdated"), dataIndex: "lastModificationTime", key: "updatedAt", render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY") : "—" },
    {
      title: t("common.actions"), key: "actions", width: 120,
      render: (_, record) => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingItem(record); setModalOpen(true); }} />
          <Popconfirm title={t("labo.confirmDeleteSupplier")} onConfirm={() => handleDelete(record.id)} okText={t("common.delete")} cancelText={t("common.cancel")} okButtonProps={{ danger: true }}>
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
          <Input prefix={<SearchOutlined />} placeholder={t("labo.searchSupplier")} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 280 }} allowClear />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); form.resetFields(); setModalOpen(true); }}>{t("labo.createSupplier")}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table columns={columns} dataSource={filtered} rowKey="id" loading={isLoading}
          pagination={{ pageSize: 20, showTotal: (total) => t("labo.supplierCount", { total }) }}
          locale={{ emptyText: t("common.noData") }} size="middle" />
      </div>
      <Modal title={isEdit ? t("labo.editSupplierTitle") : t("labo.addSupplierTitle")} open={modalOpen}
        onCancel={() => { form.resetFields(); setEditingItem(null); setModalOpen(false); }}
        onOk={handleOk} confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={isEdit ? t("common.save") : t("common.create")} cancelText={t("common.cancel")} width={480} destroyOnClose
        afterOpenChange={(visible) => { if (visible && editingItem) form.setFieldsValue(editingItem); }}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={t("labo.supplierNameLabel")} rules={[{ required: true, message: t("labo.enterSupplierName") }]}><Input placeholder={t("labo.enterSupplierName")} /></Form.Item>
          <Form.Item name="phone" label={t("labo.supplierPhone")}><Input placeholder={t("labo.supplierPhone")} /></Form.Item>
          <Form.Item name="email" label={t("labo.supplierEmail")}><Input placeholder={t("labo.supplierEmail")} /></Form.Item>
          <Form.Item name="address" label={t("labo.supplierAddress")}><Input.TextArea rows={2} placeholder={t("labo.supplierAddress")} /></Form.Item>
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
    labelKey: "labo.bite",
    useList: useLaboBiteTypeList as LaboCrudConfig["useList"],
    useCreate: useCreateLaboBiteType as LaboCrudConfig["useCreate"],
    useUpdate: useUpdateLaboBiteType as LaboCrudConfig["useUpdate"],
    useDelete: useDeleteLaboBiteType as LaboCrudConfig["useDelete"],
  },
  "finish-line": {
    labelKey: "labo.finishLine",
    useList: useLaboFinishLineList as LaboCrudConfig["useList"],
    useCreate: useCreateLaboFinishLine as LaboCrudConfig["useCreate"],
    useUpdate: useUpdateLaboFinishLine as LaboCrudConfig["useUpdate"],
    useDelete: useDeleteLaboFinishLine as LaboCrudConfig["useDelete"],
  },
  nhip: {
    labelKey: "labo.bridgeType",
    useList: useLaboRhythmTypeList as LaboCrudConfig["useList"],
    useCreate: useCreateLaboRhythmType as LaboCrudConfig["useCreate"],
    useUpdate: useUpdateLaboRhythmType as LaboCrudConfig["useUpdate"],
    useDelete: useDeleteLaboRhythmType as LaboCrudConfig["useDelete"],
  },
};

function LaboCrudView({ config }: { config: LaboCrudConfig }) {
  const { t } = useTranslation();
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
        message.success(t("common.updateSuccess"));
      } else {
        await createMutation.mutateAsync(values);
        message.success(t("common.createSuccess"));
      }
      form.resetFields(); setEditingItem(null); setModalOpen(false);
    } catch { /* validation */ }
  };

  const handleDelete = async (id: string) => {
    try { await deleteMutation.mutateAsync(id); message.success(t("common.deleteSuccess")); } catch { message.error(t("common.deleteFailed")); }
  };

  const columns: ColumnsType<LaboCatalogItem> = [
    { title: label, dataIndex: "name", key: "name" },
    { title: t("common.lastUpdated"), dataIndex: "lastModificationTime", key: "updatedAt", render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY") : "—" },
    {
      title: t("common.actions"), key: "actions", width: 120,
      render: (_, record) => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingItem(record); setModalOpen(true); }} />
          <Popconfirm title={t("common.confirm")} onConfirm={() => handleDelete(record.id)} okText={t("common.delete")} cancelText={t("common.cancel")} okButtonProps={{ danger: true }}>
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
          <Input prefix={<SearchOutlined />} placeholder={`${t("common.search")} ${label.toLowerCase()}...`} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 280 }} allowClear />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); form.resetFields(); setModalOpen(true); }}>{t("common.create")} {label.toLowerCase()}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table columns={columns} dataSource={items} rowKey="id" loading={isLoading}
          pagination={{ pageSize: 20, showTotal: (total) => t("labo.itemCount", { total }) }}
          locale={{ emptyText: t("common.noData") }} size="middle" />
      </div>
      <Modal title={isEdit ? `${t("common.edit")} ${label.toLowerCase()}` : `${t("common.create")} ${label.toLowerCase()}`} open={modalOpen}
        onCancel={() => { form.resetFields(); setEditingItem(null); setModalOpen(false); }}
        onOk={handleOk} confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={isEdit ? t("common.save") : t("common.create")} cancelText={t("common.cancel")} width={420} destroyOnClose
        afterOpenChange={(visible) => { if (visible && editingItem) form.setFieldsValue(editingItem); }}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={label} rules={[{ required: true, message: `${t("common.create")} ${label.toLowerCase()}` }]}><Input placeholder={`${t("common.create")} ${label.toLowerCase()}...`} /></Form.Item>
          <Form.Item name="description" label={t("common.description")}><Input.TextArea rows={2} placeholder={t("common.description")} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function ServiceMaterialView() {
  const { t } = useTranslation();
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
        message.success(t("labo.updateMaterialSuccess"));
      } else {
        await createMutation.mutateAsync(values);
        message.success(t("labo.createMaterialSuccess"));
      }
      form.resetFields();
      setModalOpen(false);
      setEditingItem(null);
    } catch { /* validation */ }
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    message.success(t("labo.deleteMaterialSuccess"));
  };

  const columns: ColumnsType<LaboMaterialDto> = [
    { title: t("labo.materialName"), dataIndex: "name", key: "name" },
    { title: t("materials.group"), dataIndex: "category", key: "category", render: (v: string) => v ?? "—" },
    { title: t("labo.supplier"), key: "supplier", render: (_, r) => r.supplierId ? supplierMap.get(r.supplierId) ?? "—" : "—" },
    { title: t("common.lastUpdated"), dataIndex: "lastModificationTime", key: "updatedAt", render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY") : "—" },
    {
      title: t("common.actions"),
      key: "actions",
      width: 120,
      render: (_, record) => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingItem(record); form.setFieldsValue(record); setModalOpen(true); }} />
          <Popconfirm title={t("common.confirm")} onConfirm={() => handleDelete(record.id)} okText={t("common.delete")} cancelText={t("common.cancel")} okButtonProps={{ danger: true }}>
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
          {t("labo.supplierSidebar")}
          <span style={{ fontWeight: 400, color: "#8c8c8c", marginLeft: 6 }}>{t("labo.supplierSidebarCount", { count: (suppliers?.items ?? []).length })}</span>
        </div>
        {(suppliers?.items ?? []).length === 0 ? (
          <div style={{ color: "#8c8c8c", fontSize: 13, textAlign: "center", paddingTop: 24 }}>{t("labo.noSuppliers")}</div>
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
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingItem(null); form.resetFields(); setModalOpen(true); }}>{t("labo.createMaterial")}</Button>
            <Input prefix={<SearchOutlined />} placeholder={t("common.search")} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 220 }} allowClear />
          </div>
        </div>
        <div className="reception-card reception-card--content">
          <Table columns={columns} dataSource={items} rowKey="id" loading={isLoading} pagination={{ pageSize: 20, showTotal: (total) => t("labo.materialCount", { total }) }} locale={{ emptyText: t("common.noData") }} size="middle" />
        </div>
      </div>

      <Modal
        title={editingItem ? t("labo.editMaterialTitle") : t("labo.addMaterialTitle")}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingItem(null); form.resetFields(); }}
        onOk={handleOk}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={editingItem ? t("common.save") : t("common.create")}
        cancelText={t("common.cancel")}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={t("labo.materialName")} rules={[{ required: true, message: t("labo.enterMaterialName") }]}><Input placeholder={t("labo.enterMaterialName")} /></Form.Item>
          <Form.Item name="category" label={t("materials.group")}><Input placeholder={t("labo.materialCategoryPlaceholder")} /></Form.Item>
          <Form.Item name="supplierId" label={t("labo.supplier")}>
            <Select placeholder={t("labo.selectSupplier")} allowClear options={(suppliers?.items ?? []).map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
          <Form.Item name="description" label={t("common.description")}><Input.TextArea rows={2} placeholder={t("common.description")} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function LaboPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<LaboSubRoute>("mau-labo");

  const SUB_ROUTES: { key: LaboSubRoute; label: string }[] = [
    { key: "mau-labo",          label: t("labo.samples") },
    { key: "supplier",          label: t("labo.suppliers") },
    { key: "bite",              label: t("labo.bite") },
    { key: "finish-line",       label: t("labo.finishLine") },
    { key: "nhip",              label: t("labo.bridgeType") },
    { key: "service-material",  label: t("labo.serviceMaterial") },
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
