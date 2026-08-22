import { useState } from "react";
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

// ── Constants ──────────────────────────────────────────────────────────────

const SUB_ROUTES: { key: MaterialsSubRoute; label: string }[] = [
  { key: "clinic",     label: "Vật tư phòng khám" },
  { key: "allocation", label: "Phân bổ vật tư" },
  { key: "department", label: "Phòng ban" },
];

// ── Create/Edit Modal ─────────────────────────────────────────────────────

interface InventoryModalProps {
  open: boolean;
  onClose: () => void;
  editingItem: InventoryItemDto | null;
}

function InventoryModal({ open, onClose, editingItem }: InventoryModalProps) {
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
        message.success("Cập nhật vật tư thành công");
      } else {
        await createMutation.mutateAsync({
          itemCode: values.itemCode,
          name: values.name,
          category: values.category,
          unit: values.unit,
          reorderLevel: values.reorderLevel ?? 0,
          unitCost: values.unitCost,
        });
        message.success("Thêm vật tư thành công");
      }
      form.resetFields();
      onClose();
    } catch {
      // validation handled by antd
    }
  };

  return (
    <Modal
      title={isEdit ? "Chỉnh sửa vật tư" : "Thêm vật tư mới"}
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      okText={isEdit ? "Lưu thay đổi" : "Thêm vật tư"}
      cancelText="Hủy"
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
          <Form.Item name="itemCode" label="Mã vật tư" rules={[{ required: true, message: "Nhập mã vật tư" }]}>
            <Input placeholder="VD: VT001" />
          </Form.Item>
        )}
        <Form.Item name="name" label="Tên vật tư" rules={[{ required: true, message: "Nhập tên vật tư" }]}>
          <Input placeholder="Nhập tên vật tư..." />
        </Form.Item>
        <Form.Item name="category" label="Nhóm phân loại">
          <Input placeholder="VD: Dụng cụ nha khoa, Vật liệu nhổ..." />
        </Form.Item>
        <Form.Item name="unit" label="Đơn vị">
          <Input placeholder="VD: Cái, Hộp, Gói..." />
        </Form.Item>
        <Form.Item name="reorderLevel" label="Mức tồn kho tối thiểu">
          <InputNumber<number> min={0} style={{ width: "100%" }} placeholder="0" />
        </Form.Item>
        <Form.Item name="unitCost" label="Giá nhập (VND)">
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
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItemDto | null>(null);

  const { data, isLoading } = useInventoryItemList();
  const deleteMutation = useDeleteInventoryItem();

  const filtered = (data?.items ?? []).filter((item) => {
    if (!keyword) return true;
    const kw = keyword.toLowerCase();
    return item.name.toLowerCase().includes(kw) || item.itemCode.toLowerCase().includes(kw) || (item.category ?? "").toLowerCase().includes(kw);
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      message.success("Xóa vật tư thành công");
    } catch {
      message.error("Xóa thất bại");
    }
  };

  const columns: ColumnsType<InventoryItemDto> = [
    { title: "Mã", dataIndex: "itemCode", key: "itemCode", width: 90 },
    { title: "Tên vật liệu", dataIndex: "name", key: "name" },
    { title: "Nhóm phân loại", dataIndex: "category", key: "category", render: (v: string) => v ?? "—" },
    { title: "Đơn vị", dataIndex: "unit", key: "unit", render: (v: string) => v ?? "—" },
    {
      title: "Tồn kho",
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
      title: "Trạng thái",
      dataIndex: "needsReorder",
      key: "status",
      render: (needsReorder: boolean, record) => (
        <Tag color={!record.isActive ? "default" : needsReorder ? "orange" : "green"}>
          {!record.isActive ? "Ngừng" : needsReorder ? "Sắp hết" : "Đủ hàng"}
        </Tag>
      ),
    },
    {
      title: "Cập nhật gần nhất",
      dataIndex: "lastModificationTime",
      key: "updatedAt",
      render: (v: string) => (v ? dayjs(v).format("DD/MM/YYYY") : "—"),
    },
    {
      title: "Thao tác",
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
            title="Xác nhận xóa vật tư này?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
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
            Nhóm vật tư
            <span style={{ fontWeight: 400, color: "#8c8c8c", marginLeft: 6 }}>0 nhóm</span>
          </div>
          <div style={{ fontSize: 12, color: "#8c8c8c", marginBottom: 10 }}>
            Chọn nhóm để xem vật tư
          </div>
          <Input placeholder="Tìm nhóm vật tư..." size="small" style={{ marginBottom: 8 }} />
          <Button type="dashed" block size="small">Thêm Mới</Button>
        </div>
        <div style={{ color: "#8c8c8c", fontSize: 13, textAlign: "center", paddingTop: 16 }}>
          Chưa có nhóm vật tư
        </div>
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
                Thêm vật tư
              </Button>
              <Button disabled>Sync data hệ thống</Button>
            </div>
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
            dataSource={filtered}
            rowKey="id"
            loading={isLoading}
            scroll={{ x: "max-content" }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100"],
              showTotal: (total) => `Hiển thị ${total} vật tư`,
            }}
            locale={{ emptyText: "Không có dữ liệu" }}
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
      message.success("Tạo phiếu phân bổ thành công");
      form.resetFields();
      setModalOpen(false);
    } catch { /* validation */ }
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    message.success("Xóa phiếu phân bổ thành công");
  };

  const columns: ColumnsType<MaterialAllocationDto> = [
    { title: "Thời gian phân bổ", dataIndex: "allocationTime", key: "allocationTime", width: 160, render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—" },
    { title: "Mã phân bổ", dataIndex: "allocationCode", key: "allocationCode", width: 150 },
    { title: "Vật tư", dataIndex: "inventoryItemName", key: "material", render: (v: string) => v ?? "—" },
    { title: "SL được phân bổ", dataIndex: "allocatedQuantity", key: "allocatedQty", width: 130, align: "right" },
    { title: "SL confirm còn lại", dataIndex: "confirmedRemaining", key: "confirmedRemaining", width: 150, align: "right" },
    { title: "Phòng ban", dataIndex: "departmentName", key: "department", render: (v: string) => v ?? "—" },
    { title: "Người thực hiện", dataIndex: "performerName", key: "performer", render: (v: string) => v ?? "—" },
    { title: "Ghi chú", dataIndex: "note", key: "note", render: (v: string) => v ?? "—" },
    {
      title: "Thao tác",
      key: "actions",
      width: 80,
      render: (_, record) => (
        <Popconfirm title="Xác nhận xóa?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }}>
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
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>Tạo phiếu phân bổ</Button>
            <Input prefix={<SearchOutlined />} placeholder="Tìm phiếu phân bổ..." value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 280 }} allowClear />
          </div>
          <Button>Lịch sử kiểm kho</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table columns={columns} dataSource={filtered} rowKey="id" loading={isLoading} pagination={{ pageSize: 20, showTotal: (total) => `Hiển thị ${filtered.length} trên ${total}` }} locale={{ emptyText: "Chưa có phiếu phân bổ" }} size="middle" scroll={{ x: "max-content" }} />
      </div>

      <Modal title="Tạo phiếu phân bổ" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleCreate} confirmLoading={createMutation.isPending} okText="Tạo phiếu" cancelText="Hủy" destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="inventoryItemId" label="Vật tư" rules={[{ required: true, message: "Chọn vật tư" }]}>
            <Select placeholder="Chọn vật tư..." showSearch optionFilterProp="label" options={(inventoryData?.items ?? []).map((i) => ({ value: i.id, label: `${i.itemCode} - ${i.name}` }))} />
          </Form.Item>
          <Form.Item name="departmentId" label="Phòng ban" rules={[{ required: true, message: "Chọn phòng ban" }]}>
            <Select placeholder="Chọn phòng ban..." options={(deptData?.items ?? []).map((d) => ({ value: d.id, label: d.name }))} />
          </Form.Item>
          <Form.Item name="allocatedQuantity" label="Số lượng phân bổ" rules={[{ required: true, message: "Nhập số lượng" }]}>
            <InputNumber<number> min={0.001} style={{ width: "100%" }} placeholder="0" />
          </Form.Item>
          <Form.Item name="performerName" label="Người thực hiện"><Input placeholder="Tên người thực hiện..." /></Form.Item>
          <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={2} placeholder="Ghi chú..." /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ── Department View ────────────────────────────────────────────────────────

function DepartmentView() {
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
        message.success("Cập nhật phòng ban thành công");
      } else {
        await createDept.mutateAsync(values);
        message.success("Tạo phòng ban thành công");
      }
      deptForm.resetFields();
      setDeptModalOpen(false);
      setEditingDept(null);
    } catch { /* validation */ }
  };

  const handleDeptDelete = async (id: string) => {
    await deleteDept.mutateAsync(id);
    if (selectedDeptId === id) setSelectedDeptId(null);
    message.success("Xóa phòng ban thành công");
  };

  const rightColumns: ColumnsType<MaterialAllocationDto> = [
    { title: "Thời gian phân bổ", dataIndex: "allocationTime", key: "allocationTime", width: 160, render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—" },
    { title: "Mã phân bổ", dataIndex: "allocationCode", key: "allocationCode", width: 150 },
    { title: "Vật tư", dataIndex: "inventoryItemName", key: "material", render: (v: string) => v ?? "—" },
    { title: "SL được phát", dataIndex: "allocatedQuantity", key: "distributedQty", width: 120, align: "right" },
    { title: "SL còn lại (đã duyệt)", dataIndex: "confirmedRemaining", key: "approvedRemaining", width: 170, align: "right" },
    { title: "Người thực hiện", dataIndex: "performerName", key: "performer", render: (v: string) => v ?? "—" },
    { title: "Ghi chú", dataIndex: "note", key: "note", render: (v: string) => v ?? "—" },
  ];

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div className="reception-card" style={{ width: 240, minWidth: 200, padding: 16, flexShrink: 0 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          Phòng ban
          <span style={{ fontWeight: 400, color: "#8c8c8c", marginLeft: 6 }}>{departments.length} phòng ban</span>
        </div>
        <div style={{ fontSize: 12, color: "#8c8c8c", marginBottom: 10 }}>
          Chọn phòng ban để xem vật tư đã phát và kiểm kho
        </div>
        <Button type="dashed" block size="small" style={{ marginBottom: 8 }} onClick={() => { setEditingDept(null); deptForm.resetFields(); setDeptModalOpen(true); }}>Tạo phòng ban</Button>
        {deptLoading ? null : departments.length === 0 ? (
          <div style={{ color: "#8c8c8c", fontSize: 13, textAlign: "center", paddingTop: 24 }}>Chưa có phòng ban</div>
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
                  <Popconfirm title="Xóa phòng ban?" onConfirm={() => handleDeptDelete(d.id)} okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }}>
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
            <Input prefix={<SearchOutlined />} placeholder="Tìm vật tư..." value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 220 }} allowClear />
            <Button>Gộp số lượng vật tư</Button>
          </div>
        </div>
        <div className="reception-card reception-card--content">
          <Table
            columns={rightColumns}
            dataSource={selectedDeptId ? allocations : []}
            rowKey="id"
            loading={allocLoading}
            pagination={{ pageSize: 20, showTotal: (total) => `Hiển thị ${allocations.length} trên ${total}` }}
            locale={{ emptyText: selectedDeptId ? "Chưa có vật tư phân bổ cho phòng ban này" : "Chọn phòng ban để xem vật tư đã phân bổ" }}
            size="middle"
            scroll={{ x: "max-content" }}
          />
        </div>
      </div>

      <Modal title={editingDept ? "Chỉnh sửa phòng ban" : "Tạo phòng ban"} open={deptModalOpen} onCancel={() => { setDeptModalOpen(false); setEditingDept(null); deptForm.resetFields(); }} onOk={handleDeptSave} confirmLoading={createDept.isPending || updateDept.isPending} okText={editingDept ? "Lưu" : "Tạo"} cancelText="Hủy" destroyOnClose>
        <Form form={deptForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Tên phòng ban" rules={[{ required: true, message: "Nhập tên phòng ban" }]}><Input placeholder="VD: Phòng khám 1, Phòng lễ tân..." /></Form.Item>
          <Form.Item name="description" label="Mô tả"><Input.TextArea rows={2} placeholder="Mô tả..." /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function MaterialsPage() {
  const [activeTab, setActiveTab] = useState<MaterialsSubRoute>("clinic");

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
