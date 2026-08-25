import { useState } from "react";
import { Button, Input, Table, Modal, Form, InputNumber, Tag, Popconfirm, Select } from "antd";
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import {
  useInventoryItemList,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
  useAdjustInventoryStock,
  STOCK_MOVEMENT,
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
        toast.success(t("Cập nhật vật tư thành công"));
      } else {
        await createMutation.mutateAsync({
          itemCode: values.itemCode,
          name: values.name,
          category: values.category,
          unit: values.unit,
          reorderLevel: values.reorderLevel ?? 0,
          unitCost: values.unitCost,
        });
        toast.success(t("Thêm vật tư thành công"));
      }
      form.resetFields();
      onClose();
    } catch {
      // validation handled by antd
    }
  };

  return (
    <Modal
      title={isEdit ? t("Chỉnh sửa vật tư") : t("Thêm vật tư mới")}
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      okText={isEdit ? t("Lưu thay đổi") : t("Thêm vật tư")}
      cancelText={t("Hủy")}
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
          <Form.Item name="itemCode" label={t("Mã vật tư")} rules={[{ required: true, message: t("Nhập mã vật tư") }]}>
            <Input placeholder={t("Nhập mã vật tư")} />
          </Form.Item>
        )}
        <Form.Item name="name" label={t("Tên vật tư")} rules={[{ required: true, message: t("Nhập tên vật tư") }]}>
          <Input placeholder={t("Nhập tên vật tư")} />
        </Form.Item>
        <Form.Item name="category" label={t("Nhóm phân loại")}>
          <Input placeholder={t("Nhóm phân loại")} />
        </Form.Item>
        <Form.Item name="unit" label={t("Đơn vị")}>
          <Input placeholder={t("Đơn vị")} />
        </Form.Item>
        <Form.Item name="reorderLevel" label={t("Mức tồn kho tối thiểu")}>
          <InputNumber<number> min={0} style={{ width: "100%" }} placeholder="0" />
        </Form.Item>
        <Form.Item name="unitCost" label={t("Giá nhập (VND)")}>
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

  // A step is one unit in or out, recorded as a real stock movement.
  const adjustStock = useAdjustInventoryStock();

  const handleAdjust = async (id: string, movementType: number) => {
    try {
      await adjustStock.mutateAsync({ id, movementType, quantity: 1 });
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t("Xóa vật tư thành công"));
    } catch {
      toast.error(t("Xóa thất bại"));
    }
  };

  const columns: ColumnsType<InventoryItemDto> = [
    { title: t("Mã"), dataIndex: "itemCode", key: "itemCode", width: 90 },
    { title: t("Tên vật liệu"), dataIndex: "name", key: "name" },
    { title: t("Nhóm phân loại"), dataIndex: "category", key: "category", render: (v: string) => v ?? "—" },
    { title: t("Đơn vị"), dataIndex: "unit", key: "unit", render: (v: string) => v ?? "—" },
    {
      // The design reads stock against its floor — "12 / 10 hộp" — rather than
      // a bare number the reader has to judge on its own.
      title: t("Tồn / định mức"),
      dataIndex: "quantityOnHand",
      key: "quantityOnHand",
      width: 150,
      render: (v: number, record) => (
        <span>
          <b style={{ fontWeight: 700, color: record.needsReorder ? "var(--bd-red)" : "var(--bd-green)" }}>{v}</b>
          <span style={{ color: "var(--bd-sub)" }}> / {record.reorderLevel} {record.unit ?? ""}</span>
        </span>
      ),
    },
    {
      title: t("Điều chỉnh"),
      key: "adjust",
      width: 120,
      render: (_, record) => (
        <div className="stock-adjust">
          <button
            type="button"
            className="stock-step"
            aria-label={t("Giảm tồn {0}", record.name)}
            disabled={adjustStock.isPending || record.quantityOnHand <= 0}
            onClick={() => void handleAdjust(record.id, STOCK_MOVEMENT.Consumption)}
          >
            −
          </button>
          <button
            type="button"
            className="stock-step"
            aria-label={t("Tăng tồn {0}", record.name)}
            disabled={adjustStock.isPending}
            onClick={() => void handleAdjust(record.id, STOCK_MOVEMENT.Purchase)}
          >
            +
          </button>
        </div>
      ),
    },
    {
      title: t("Trạng thái"),
      dataIndex: "needsReorder",
      key: "status",
      render: (needsReorder: boolean, record) => (
        <Tag color={!record.isActive ? "default" : needsReorder ? "orange" : "green"}>
          {!record.isActive ? t("Ngừng") : needsReorder ? t("Sắp hết") : t("Đủ hàng")}
        </Tag>
      ),
    },
    {
      title: t("Cập nhật gần nhất"),
      dataIndex: "lastModificationTime",
      key: "updatedAt",
      render: (v: string) => (v ? dayjs(v).format("DD/MM/YYYY") : "—"),
    },
    {
      title: t("Thao tác"),
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
            title={t("Xác nhận xóa vật tư này?")}
            onConfirm={() => handleDelete(record.id)}
            okText={t("Xóa")}
            cancelText={t("Hủy")}
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
            {t("Nhóm vật tư")}
            <span style={{ fontWeight: 400, color: "var(--bd-muted)", marginLeft: 6 }}>
              {t("{0} nhóm", categories.length)}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--bd-muted)", marginBottom: 10 }}>
            {t("Chọn nhóm để xem vật tư")}
          </div>
          <Input
            placeholder={t("Tìm nhóm vật tư...")}
            size="small"
            style={{ marginBottom: 8 }}
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
            allowClear
          />
        </div>
        {filteredCategories.length === 0 ? (
          <div style={{ color: "var(--bd-muted)", fontSize: 13, textAlign: "center", paddingTop: 16 }}>
            {t("Chưa có nhóm vật tư")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                background: selectedGroup === null ? "var(--bd-blue-pale)" : "transparent",
                color: selectedGroup === null ? "var(--bd-blue)" : undefined,
                fontWeight: selectedGroup === null ? 500 : 400,
              }}
              onClick={() => setSelectedGroup(null)}
            >
              {t("Tất cả")} ({allItems.length})
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
                    background: selectedGroup === cat ? "var(--bd-blue-pale)" : "transparent",
                    color: selectedGroup === cat ? "var(--bd-blue)" : undefined,
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
                {t("Thêm vật tư")}
              </Button>
              <Button disabled>{t("Sync data hệ thống")}</Button>
            </div>
            <Input
              prefix={<SearchOutlined />}
              placeholder={t("Tìm kiếm...")}
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
              showTotal: (total) => t("Hiển thị {0} vật tư", total),
            }}
            locale={{ emptyText: t("Không có dữ liệu") }}
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
      toast.success(t("Tạo phiếu phân bổ thành công"));
      form.resetFields();
      setModalOpen(false);
    } catch { /* validation */ }
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    toast.success(t("Xóa phiếu phân bổ thành công"));
  };

  const columns: ColumnsType<MaterialAllocationDto> = [
    { title: t("Thời gian phân bổ"), dataIndex: "allocationTime", key: "allocationTime", width: 160, render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—" },
    { title: t("Mã phân bổ"), dataIndex: "allocationCode", key: "allocationCode", width: 150 },
    { title: t("Tên vật liệu"), dataIndex: "inventoryItemName", key: "material", render: (v: string) => v ?? "—" },
    { title: t("SL được phân bổ"), dataIndex: "allocatedQuantity", key: "allocatedQty", width: 130, align: "right" },
    { title: t("SL confirm còn lại"), dataIndex: "confirmedRemaining", key: "confirmedRemaining", width: 150, align: "right" },
    { title: t("Phòng ban"), dataIndex: "departmentName", key: "department", render: (v: string) => v ?? "—" },
    { title: t("Người thực hiện"), dataIndex: "performerName", key: "performer", render: (v: string) => v ?? "—" },
    { title: t("Ghi chú"), dataIndex: "note", key: "note", render: (v: string) => v ?? "—" },
    {
      title: t("Thao tác"),
      key: "actions",
      width: 80,
      render: (_, record) => (
        <Popconfirm title={t("Xác nhận xóa vật tư này?")} onConfirm={() => handleDelete(record.id)} okText={t("Xóa")} cancelText={t("Hủy")} okButtonProps={{ danger: true }}>
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
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>{t("Tạo phiếu phân bổ")}</Button>
            <Input prefix={<SearchOutlined />} placeholder={t("Tìm phiếu phân bổ...")} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 280 }} allowClear />
          </div>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table columns={columns} dataSource={filtered} rowKey="id" loading={isLoading} pagination={{ pageSize: 20, showTotal: (total) => t("Hiển thị {0} trên {1}", filtered.length, total) }} locale={{ emptyText: t("Chưa có phiếu phân bổ") }} size="middle" scroll={{ x: "max-content" }} />
      </div>

      <Modal title={t("Tạo phiếu phân bổ")} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleCreate} confirmLoading={createMutation.isPending} okText={t("Tạo phiếu")} cancelText={t("Hủy")} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="inventoryItemId" label={t("Tên vật liệu")} rules={[{ required: true, message: t("Chọn vật tư") }]}>
            <Select placeholder={t("Chọn vật tư...")} showSearch optionFilterProp="label" options={(inventoryData?.items ?? []).map((i) => ({ value: i.id, label: `${i.itemCode} - ${i.name}` }))} />
          </Form.Item>
          <Form.Item name="departmentId" label={t("Phòng ban")} rules={[{ required: true, message: t("Chọn phòng ban") }]}>
            <Select placeholder={t("Chọn phòng ban...")} options={(deptData?.items ?? []).map((d) => ({ value: d.id, label: d.name }))} />
          </Form.Item>
          <Form.Item name="allocatedQuantity" label={t("Số lượng phân bổ")} rules={[{ required: true, message: t("Nhập số lượng") }]}>
            <InputNumber<number> min={0.001} style={{ width: "100%" }} placeholder="0" />
          </Form.Item>
          <Form.Item name="performerName" label={t("Người thực hiện")}><Input placeholder={t("Tên người thực hiện...")} /></Form.Item>
          <Form.Item name="note" label={t("Ghi chú")}><Input.TextArea rows={2} placeholder={t("Ghi chú...")} /></Form.Item>
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
        toast.success(t("Cập nhật phòng ban thành công"));
      } else {
        await createDept.mutateAsync(values);
        toast.success(t("Tạo phòng ban thành công"));
      }
      deptForm.resetFields();
      setDeptModalOpen(false);
      setEditingDept(null);
    } catch { /* validation */ }
  };

  const handleDeptDelete = async (id: string) => {
    await deleteDept.mutateAsync(id);
    if (selectedDeptId === id) setSelectedDeptId(null);
    toast.success(t("Xóa phòng ban thành công"));
  };

  const rightColumns: ColumnsType<MaterialAllocationDto> = [
    { title: t("Thời gian phân bổ"), dataIndex: "allocationTime", key: "allocationTime", width: 160, render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—" },
    { title: t("Mã phân bổ"), dataIndex: "allocationCode", key: "allocationCode", width: 150 },
    { title: t("Tên vật liệu"), dataIndex: "inventoryItemName", key: "material", render: (v: string) => v ?? "—" },
    { title: t("SL được phát"), dataIndex: "allocatedQuantity", key: "distributedQty", width: 120, align: "right" },
    { title: t("SL còn lại (đã duyệt)"), dataIndex: "confirmedRemaining", key: "approvedRemaining", width: 170, align: "right" },
    { title: t("Người thực hiện"), dataIndex: "performerName", key: "performer", render: (v: string) => v ?? "—" },
    { title: t("Ghi chú"), dataIndex: "note", key: "note", render: (v: string) => v ?? "—" },
  ];

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div className="reception-card" style={{ width: 240, minWidth: 200, padding: 16, flexShrink: 0 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          {t("Phòng ban")}
          <span style={{ fontWeight: 400, color: "var(--bd-muted)", marginLeft: 6 }}>{t("{0} phòng ban", departments.length)}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--bd-muted)", marginBottom: 10 }}>
          {t("Chọn phòng ban để xem vật tư đã phát và kiểm kho")}
        </div>
        <Button type="dashed" block size="small" style={{ marginBottom: 8 }} onClick={() => { setEditingDept(null); deptForm.resetFields(); setDeptModalOpen(true); }}>{t("Tạo phòng ban")}</Button>
        {deptLoading ? null : departments.length === 0 ? (
          <div style={{ color: "var(--bd-muted)", fontSize: 13, textAlign: "center", paddingTop: 24 }}>{t("Chưa có phòng ban")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {departments.map((d) => (
              <div
                key={d.id}
                onClick={() => setSelectedDeptId(d.id === selectedDeptId ? null : d.id)}
                style={{
                  padding: "6px 8px", fontSize: 13, borderRadius: 4, cursor: "pointer",
                  background: d.id === selectedDeptId ? "var(--bd-blue-pale)" : "#F9FAFB",
                  color: d.id === selectedDeptId ? "var(--bd-blue)" : "#374151",
                  fontWeight: d.id === selectedDeptId ? 600 : 400,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}
              >
                <span>{d.name}</span>
                <div style={{ display: "flex", gap: 2 }} onClick={(e) => e.stopPropagation()}>
                  <Button type="text" size="small" icon={<EditOutlined />} style={{ padding: 0, width: 22, height: 22 }} onClick={() => { setEditingDept(d); deptForm.setFieldsValue(d); setDeptModalOpen(true); }} />
                  <Popconfirm title={t("Xóa phòng ban?")} onConfirm={() => handleDeptDelete(d.id)} okText={t("Xóa")} cancelText={t("Hủy")} okButtonProps={{ danger: true }}>
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
            <Input prefix={<SearchOutlined />} placeholder={t("Tìm vật tư...")} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 220 }} allowClear />
            <Button>{t("Gộp số lượng vật tư")}</Button>
          </div>
        </div>
        <div className="reception-card reception-card--content">
          <Table
            columns={rightColumns}
            dataSource={selectedDeptId ? allocations : []}
            rowKey="id"
            loading={allocLoading}
            pagination={{ pageSize: 20, showTotal: (total) => t("Hiển thị {0}–{1} trên {2} dòng", allocations.length, total, total) }}
            locale={{ emptyText: selectedDeptId ? t("Chưa có vật tư phân bổ cho phòng ban này") : t("Chọn phòng ban để xem vật tư đã phát và kiểm kho") }}
            size="middle"
            scroll={{ x: "max-content" }}
          />
        </div>
      </div>

      <Modal title={editingDept ? t("Chỉnh sửa phòng ban") : t("Tạo phòng ban")} open={deptModalOpen} onCancel={() => { setDeptModalOpen(false); setEditingDept(null); deptForm.resetFields(); }} onOk={handleDeptSave} confirmLoading={createDept.isPending || updateDept.isPending} okText={editingDept ? t("Lưu thay đổi") : t("Tạo phòng ban")} cancelText={t("Hủy")} destroyOnClose>
        <Form form={deptForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={t("Tên phòng ban")} rules={[{ required: true, message: t("Nhập tên phòng ban") }]}><Input placeholder={t("VD: Phòng khám 1, Phòng lễ tân...")} /></Form.Item>
          <Form.Item name="description" label={t("Mô tả")}><Input.TextArea rows={2} placeholder={t("Mô tả...")} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function MaterialsPage() {
  const [activeTab, setActiveTab] = useState<MaterialsSubRoute>("clinic");

  // The design's subtitle counts what needs restocking rather than describing
  // the tabs, so the number is the first thing read on this screen.
  const { data: lowStock } = useInventoryItemList({ needsReorder: true });
  const lowStockCount = lowStock?.items?.length ?? 0;

  const SUB_ROUTES: { key: MaterialsSubRoute; label: string }[] = [
    { key: "clinic",      label: t("Vật tư phòng khám") },
    { key: "allocation",  label: t("Phân bổ vật tư") },
    { key: "department",  label: t("Phòng ban") },
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
      <PageHeader
        title={t("Vật tư phòng khám")}
        subtitle={t("{0} mặt hàng dưới định mức cần nhập thêm", lowStockCount)}
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
