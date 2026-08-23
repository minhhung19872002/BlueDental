import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Table, Modal, Form, InputNumber, Tag, message, Popconfirm, Select } from "antd";
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import {
  useInventoryItemList,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
  type InventoryItemDto,
  type UpdateInventoryItemDto,
} from "../api";
import {
  useDepartmentList,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  type DepartmentDto,
} from "../api/departmentApi";
import {
  useAllocationList,
  useCreateAllocation,
  useDeleteAllocation,
  type MaterialAllocationDto,
} from "../api/allocationApi";

// ── Types ──────────────────────────────────────────────────────────────────

type MaterialsSubRoute = "clinic" | "allocation" | "department";

// ── Create/Edit Modal ─────────────────────────────────────────────────────

interface InventoryModalProps {
  open: boolean;
  onClose: () => void;
  editingItem: InventoryItemDto | null;
}

function InventoryModal({ open, onClose, editingItem }: InventoryModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const createMutation = useCreateInventoryItem();
  const updateMutation = useUpdateInventoryItem();
  const isEdit = Boolean(editingItem);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (isEdit && editingItem) {
        await updateMutation.mutateAsync({
          id: editingItem.id,
          data: {
            name: values.name,
            category: values.category,
            unit: values.unit,
            reorderLevel: values.reorderLevel ?? 0,
            unitCost: values.unitCost,
          } as UpdateInventoryItemDto,
        });
        message.success(t("materials.updateSuccess"));
      } else {
        await createMutation.mutateAsync({
          itemCode: values.itemCode,
          name: values.name,
          category: values.category,
          unit: values.unit,
          reorderLevel: values.reorderLevel ?? 0,
          unitCost: values.unitCost,
        });
        message.success(t("materials.createSuccess"));
      }
      form.resetFields();
      onClose();
    } catch {
      // validation handled by antd
    }
  };

  return (
    <Modal
      title={isEdit ? t("materials.editTitle") : t("materials.createTitle")}
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      okText={isEdit ? t("materials.saveChanges") : t("materials.addMaterial")}
      cancelText={t("common.cancel")}
      width={500}
      destroyOnClose
      afterOpenChange={(visible) => {
        if (visible && editingItem) {
          form.setFieldsValue({
            itemCode: editingItem.itemCode,
            name: editingItem.name,
            category: editingItem.category,
            unit: editingItem.unit,
            reorderLevel: editingItem.reorderLevel,
          });
        }
      }}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        {!isEdit && (
          <Form.Item name="itemCode" label={t("materials.materialCode")} rules={[{ required: true, message: t("materials.enterCode") }]}>
            <Input placeholder={t("materials.enterCode")} />
          </Form.Item>
        )}
        <Form.Item name="name" label={t("materials.materialNameLabel")} rules={[{ required: true, message: t("materials.enterName") }]}>
          <Input placeholder={t("materials.enterName")} />
        </Form.Item>
        <Form.Item name="category" label={t("materials.group")}>
          <Input placeholder={t("materials.group")} />
        </Form.Item>
        <Form.Item name="unit" label={t("materials.unit")}>
          <Input placeholder={t("materials.unit")} />
        </Form.Item>
        <Form.Item name="reorderLevel" label={t("materials.minReorder")}>
          <InputNumber<number> min={0} style={{ width: "100%" }} placeholder="0" />
        </Form.Item>
        <Form.Item name="unitCost" label={t("materials.importPrice")}>
          <InputNumber<number>
            min={0}
            style={{ width: "100%" }}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            parser={(v) => parseFloat((v ?? "0").replace(/,/g, "")) || 0}
            placeholder="0"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── Clinic Materials View ─────────────────────────────────────────────────

function ClinicMaterialsView() {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItemDto | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupSearch, setGroupSearch] = useState("");

  const { data, isLoading } = useInventoryItemList();
  const deleteMutation = useDeleteInventoryItem();

  const allItems = data?.items ?? [];
  const categories = [...new Set(allItems.map((i) => i.category).filter(Boolean))] as string[];
  const filteredCategories = categories.filter((c) =>
    !groupSearch || c.toLowerCase().includes(groupSearch.toLowerCase()),
  );

  const filtered = allItems.filter((item) => {
    if (selectedGroup && item.category !== selectedGroup) return false;
    if (!keyword) return true;
    const kw = keyword.toLowerCase();
    return item.name.toLowerCase().includes(kw) || item.itemCode.toLowerCase().includes(kw) || (item.category ?? "").toLowerCase().includes(kw);
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      message.success(t("materials.deleteSuccess"));
    } catch {
      message.error(t("common.deleteFailed"));
    }
  };

  const columns: ColumnsType<InventoryItemDto> = [
    { title: t("materials.code"), dataIndex: "itemCode", key: "itemCode", width: 90 },
    { title: t("materials.materialName"), dataIndex: "name", key: "name" },
    { title: t("materials.group"), dataIndex: "category", key: "category", render: (v: string) => v ?? "—" },
    { title: t("materials.unit"), dataIndex: "unit", key: "unit", render: (v: string) => v ?? "—" },
    {
      title: t("materials.stock"),
      dataIndex: "quantityOnHand",
      key: "quantityOnHand",
      align: "right",
      render: (v: number, record) => (
        <span style={{ color: record.needsReorder ? "#ff4d4f" : undefined, fontWeight: record.needsReorder ? 600 : 400 }}>
          {v}
        </span>
      ),
    },
    {
      title: t("common.status"),
      dataIndex: "needsReorder",
      key: "status",
      render: (needsReorder: boolean, record) => (
        <Tag color={!record.isActive ? "default" : needsReorder ? "orange" : "green"}>
          {!record.isActive ? t("materials.stopped") : needsReorder ? t("materials.lowStock") : t("materials.inStock")}
        </Tag>
      ),
    },
    {
      title: t("common.lastUpdated"),
      dataIndex: "lastModificationTime",
      key: "updatedAt",
      render: (v: string) => (v ? dayjs(v).format("DD/MM/YYYY") : "—"),
    },
    {
      title: t("common.actions"),
      key: "actions",
      width: 120,
      render: (_, record) => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => { setEditingItem(record); setModalOpen(true); }}
          />
          <Popconfirm
            title={t("materials.confirmDelete")}
            onConfirm={() => handleDelete(record.id)}
            okText={t("common.delete")}
            cancelText={t("common.cancel")}
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", gap: 16 }}>
      {/* Left panel: material groups */}
      <div className="reception-card" style={{ width: 240, minWidth: 200, padding: 16, flexShrink: 0 }}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {t("materials.materialGroups")}
            <span style={{ fontWeight: 400, color: "#8c8c8c", marginLeft: 6 }}>
              {t("materials.groupCount", { count: categories.length })}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#8c8c8c", marginBottom: 10 }}>
            {t("materials.selectGroup")}
          </div>
          <Input
            placeholder={t("materials.searchGroup")}
            size="small"
            style={{ marginBottom: 8 }}
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
            allowClear
          />
        </div>
        {filteredCategories.length === 0 ? (
          <div style={{ color: "#8c8c8c", fontSize: 13, textAlign: "center", paddingTop: 16 }}>
            {t("materials.noGroups")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                background: selectedGroup === null ? "#e6f4ff" : "transparent",
                color: selectedGroup === null ? "#1677ff" : undefined,
                fontWeight: selectedGroup === null ? 500 : 400,
              }}
              onClick={() => setSelectedGroup(null)}
            >
              {t("common.all")} ({allItems.length})
            </div>
            {filteredCategories.map((cat) => {
              const count = allItems.filter((i) => i.category === cat).length;
              return (
                <div
                  key={cat}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 13,
                    background: selectedGroup === cat ? "#e6f4ff" : "transparent",
                    color: selectedGroup === cat ? "#1677ff" : undefined,
                    fontWeight: selectedGroup === cat ? 500 : 400,
                  }}
                  onClick={() => setSelectedGroup(cat)}
                >
                  {cat} ({count})
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="reception-card reception-card--toolbar">
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => { setEditingItem(null); setModalOpen(true); }}
              >
                {t("materials.addMaterial")}
              </Button>
              <Button disabled>{t("materials.syncData")}</Button>
            </div>
            <Input
              prefix={<SearchOutlined />}
              placeholder={t("common.search")}
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
            dataSource={filtered}
            rowKey="id"
            loading={isLoading}
            scroll={{ x: "max-content" }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100"],
              showTotal: (total) => t("materials.showMaterialCount", { total }),
            }}
            locale={{ emptyText: t("common.noData") }}
            size="middle"
          />
        </div>
      </div>

      <InventoryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingItem={editingItem}
      />
    </div>
  );
}

// ── Allocation View ────────────────────────────────────────────────────────

function AllocationView() {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useAllocationList();
  const { data: inventoryData } = useInventoryItemList();
  const { data: deptData } = useDepartmentList();
  const createMutation = useCreateAllocation();
  const deleteMutation = useDeleteAllocation();

  const allItems = data?.items ?? [];
  const filtered = allItems.filter((item) => {
    if (!keyword) return true;
    const kw = keyword.toLowerCase();
    return item.allocationCode.toLowerCase().includes(kw) ||
      (item.inventoryItemName ?? "").toLowerCase().includes(kw) ||
      (item.performerName ?? "").toLowerCase().includes(kw);
  });

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await createMutation.mutateAsync(values);
      message.success(t("materials.allocationCreateSuccess"));
      form.resetFields();
      setModalOpen(false);
    } catch { /* validation */ }
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    message.success(t("materials.allocationDeleteSuccess"));
  };

  const columns: ColumnsType<MaterialAllocationDto> = [
    { title: t("materials.allocationTime"), dataIndex: "allocationTime", key: "allocationTime", width: 160, render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—" },
    { title: t("materials.allocationCode"), dataIndex: "allocationCode", key: "allocationCode", width: 150 },
    { title: t("materials.materialName"), dataIndex: "inventoryItemName", key: "material", render: (v: string) => v ?? "—" },
    { title: t("materials.allocatedQty"), dataIndex: "allocatedQuantity", key: "allocatedQty", width: 130, align: "right" },
    { title: t("materials.confirmedRemaining"), dataIndex: "confirmedRemaining", key: "confirmedRemaining", width: 150, align: "right" },
    { title: t("materials.department"), dataIndex: "departmentName", key: "department", render: (v: string) => v ?? "—" },
    { title: t("materials.performer"), dataIndex: "performerName", key: "performer", render: (v: string) => v ?? "—" },
    { title: t("materials.note"), dataIndex: "note", key: "note", render: (v: string) => v ?? "—" },
    {
      title: t("common.actions"),
      key: "actions",
      width: 80,
      render: (_, record) => (
        <Popconfirm title={t("materials.confirmDelete")} onConfirm={() => handleDelete(record.id)} okText={t("common.delete")} cancelText={t("common.cancel")} okButtonProps={{ danger: true }}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>{t("materials.createAllocation")}</Button>
            <Input prefix={<SearchOutlined />} placeholder={t("materials.searchAllocation")} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 280 }} allowClear />
          </div>
          <Button>{t("materials.inventoryHistory")}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table columns={columns} dataSource={filtered} rowKey="id" loading={isLoading} pagination={{ pageSize: 20, showTotal: (total) => t("materials.showRange", { from: filtered.length, total }) }} locale={{ emptyText: t("materials.noAllocations") }} size="middle" scroll={{ x: "max-content" }} />
      </div>

      <Modal title={t("materials.createAllocation")} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleCreate} confirmLoading={createMutation.isPending} okText={t("materials.createAllocationBtn")} cancelText={t("common.cancel")} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="inventoryItemId" label={t("materials.materialName")} rules={[{ required: true, message: t("materials.selectMaterial") }]}>
            <Select placeholder={t("materials.selectMaterialPlaceholder")} showSearch optionFilterProp="label" options={(inventoryData?.items ?? []).map((i) => ({ value: i.id, label: `${i.itemCode} - ${i.name}` }))} />
          </Form.Item>
          <Form.Item name="departmentId" label={t("materials.department")} rules={[{ required: true, message: t("materials.selectDepartment") }]}>
            <Select placeholder={t("materials.selectDepartmentPlaceholder")} options={(deptData?.items ?? []).map((d) => ({ value: d.id, label: d.name }))} />
          </Form.Item>
          <Form.Item name="allocatedQuantity" label={t("materials.allocatedQtyLabel")} rules={[{ required: true, message: t("materials.enterQty") }]}>
            <InputNumber<number> min={0.001} style={{ width: "100%" }} placeholder="0" />
          </Form.Item>
          <Form.Item name="performerName" label={t("materials.performer")}><Input placeholder={t("materials.performerPlaceholder")} /></Form.Item>
          <Form.Item name="note" label={t("materials.note")}><Input.TextArea rows={2} placeholder={t("materials.notePlaceholder")} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ── Department View ────────────────────────────────────────────────────────

function DepartmentView() {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentDto | null>(null);
  const [deptForm] = Form.useForm();

  const { data: deptData, isLoading: deptLoading } = useDepartmentList();
  const createDept = useCreateDepartment();
  const updateDept = useUpdateDepartment();
  const deleteDept = useDeleteDepartment();
  const { data: allocData, isLoading: allocLoading } = useAllocationList(selectedDeptId ?? undefined);

  const departments = deptData?.items ?? [];
  const allocations = (allocData?.items ?? []).filter((a) => {
    if (!keyword) return true;
    const kw = keyword.toLowerCase();
    return (a.inventoryItemName ?? "").toLowerCase().includes(kw) || a.allocationCode.toLowerCase().includes(kw);
  });

  const handleDeptSave = async () => {
    try {
      const values = await deptForm.validateFields();
      if (editingDept) {
        await updateDept.mutateAsync({ id: editingDept.id, data: values });
        message.success(t("materials.deptUpdateSuccess"));
      } else {
        await createDept.mutateAsync(values);
        message.success(t("materials.deptCreateSuccess"));
      }
      deptForm.resetFields();
      setDeptModalOpen(false);
      setEditingDept(null);
    } catch { /* validation */ }
  };

  const handleDeptDelete = async (id: string) => {
    await deleteDept.mutateAsync(id);
    if (selectedDeptId === id) setSelectedDeptId(null);
    message.success(t("materials.deptDeleteSuccess"));
  };

  const rightColumns: ColumnsType<MaterialAllocationDto> = [
    { title: t("materials.allocationTime"), dataIndex: "allocationTime", key: "allocationTime", width: 160, render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—" },
    { title: t("materials.allocationCode"), dataIndex: "allocationCode", key: "allocationCode", width: 150 },
    { title: t("materials.materialName"), dataIndex: "inventoryItemName", key: "material", render: (v: string) => v ?? "—" },
    { title: t("materials.distributedQty"), dataIndex: "allocatedQuantity", key: "distributedQty", width: 120, align: "right" },
    { title: t("materials.approvedRemaining"), dataIndex: "confirmedRemaining", key: "approvedRemaining", width: 170, align: "right" },
    { title: t("materials.performer"), dataIndex: "performerName", key: "performer", render: (v: string) => v ?? "—" },
    { title: t("materials.note"), dataIndex: "note", key: "note", render: (v: string) => v ?? "—" },
  ];

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div className="reception-card" style={{ width: 240, minWidth: 200, padding: 16, flexShrink: 0 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          {t("materials.departments")}
          <span style={{ fontWeight: 400, color: "#8c8c8c", marginLeft: 6 }}>{t("materials.deptCount", { count: departments.length })}</span>
        </div>
        <div style={{ fontSize: 12, color: "#8c8c8c", marginBottom: 10 }}>
          {t("materials.selectDeptPrompt")}
        </div>
        <Button type="dashed" block size="small" style={{ marginBottom: 8 }} onClick={() => { setEditingDept(null); deptForm.resetFields(); setDeptModalOpen(true); }}>{t("materials.createDept")}</Button>
        {deptLoading ? null : departments.length === 0 ? (
          <div style={{ color: "#8c8c8c", fontSize: 13, textAlign: "center", paddingTop: 24 }}>{t("materials.noDepts")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {departments.map((d) => (
              <div
                key={d.id}
                onClick={() => setSelectedDeptId(d.id === selectedDeptId ? null : d.id)}
                style={{
                  padding: "6px 8px", fontSize: 13, borderRadius: 4, cursor: "pointer",
                  background: d.id === selectedDeptId ? "#E6F4FF" : "#F9FAFB",
                  color: d.id === selectedDeptId ? "#1677ff" : "#374151",
                  fontWeight: d.id === selectedDeptId ? 600 : 400,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
              >
                <span>{d.name}</span>
                <div style={{ display: "flex", gap: 2 }} onClick={(e) => e.stopPropagation()}>
                  <Button type="text" size="small" icon={<EditOutlined />} style={{ padding: 0, width: 22, height: 22 }} onClick={() => { setEditingDept(d); deptForm.setFieldsValue(d); setDeptModalOpen(true); }} />
                  <Popconfirm title={t("materials.confirmDeleteDept")} onConfirm={() => handleDeptDelete(d.id)} okText={t("common.delete")} cancelText={t("common.cancel")} okButtonProps={{ danger: true }}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ padding: 0, width: 22, height: 22 }} />
                  </Popconfirm>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="reception-card reception-card--toolbar">
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <Input prefix={<SearchOutlined />} placeholder={t("materials.searchMaterial")} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 220 }} allowClear />
            <Button>{t("materials.mergeMaterialQty")}</Button>
          </div>
        </div>
        <div className="reception-card reception-card--content">
          <Table
            columns={rightColumns}
            dataSource={selectedDeptId ? allocations : []}
            rowKey="id"
            loading={allocLoading}
            pagination={{ pageSize: 20, showTotal: (total) => `Hiển thị ${allocations.length} trên ${total}` }}
            locale={{ emptyText: selectedDeptId ? t("materials.noDeptAllocations") : t("materials.selectDeptToView") }}
            size="middle"
            scroll={{ x: "max-content" }}
          />
        </div>
      </div>

      <Modal title={editingDept ? t("materials.editDeptTitle") : t("materials.createDeptTitle")} open={deptModalOpen} onCancel={() => { setDeptModalOpen(false); setEditingDept(null); deptForm.resetFields(); }} onOk={handleDeptSave} confirmLoading={createDept.isPending || updateDept.isPending} okText={editingDept ? t("materials.saveChanges") : t("materials.createDept")} cancelText={t("common.cancel")} destroyOnClose>
        <Form form={deptForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={t("materials.deptName")} rules={[{ required: true, message: t("materials.enterDeptName") }]}><Input placeholder={t("materials.deptNamePlaceholder")} /></Form.Item>
          <Form.Item name="description" label={t("materials.description")}><Input.TextArea rows={2} placeholder={t("materials.descriptionPlaceholder")} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function MaterialsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<MaterialsSubRoute>("clinic");

  const SUB_ROUTES: { key: MaterialsSubRoute; label: string }[] = [
    { key: "clinic",      label: t("materials.tabClinicMaterials") },
    { key: "allocation",  label: t("materials.tabAllocation") },
    { key: "department",  label: t("materials.tabDepartments") },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "clinic":
        return <ClinicMaterialsView />;
      case "allocation":
        return <AllocationView />;
      case "department":
        return <DepartmentView />;
      default:
        return null;
    }
  };

  return (
    <div className="reception-page">
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0 }}>
          {SUB_ROUTES.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "8px 20px",
                border: "none",
                borderBottom: activeTab === tab.key ? "2px solid #1677ff" : "2px solid transparent",
                background: "none",
                color: activeTab === tab.key ? "#1677ff" : "#595959",
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: "pointer",
                fontSize: 14,
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
