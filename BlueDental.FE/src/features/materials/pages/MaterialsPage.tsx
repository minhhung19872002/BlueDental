import { useState } from "react";
import { Button, Input, Table, Modal, Form, InputNumber, Tag, message, Popconfirm } from "antd";
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

  const columns = [
    { title: "Thời gian phân bổ", dataIndex: "allocationTime", key: "allocationTime" },
    { title: "Mã phân bổ", dataIndex: "allocationCode", key: "allocationCode" },
    { title: "Vật tư", dataIndex: "material", key: "material" },
    { title: "SL được phân bổ", dataIndex: "allocatedQty", key: "allocatedQty" },
    { title: "SL confirm còn lại", dataIndex: "confirmedRemaining", key: "confirmedRemaining" },
    { title: "Phòng ban", dataIndex: "department", key: "department" },
    { title: "Người thực hiện", dataIndex: "performer", key: "performer" },
    { title: "Ghi chú", dataIndex: "note", key: "note" },
    {
      title: "Thao tác",
      key: "actions",
      render: () => <Button size="small" type="link">Chi tiết</Button>,
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm phiếu phân bổ..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Button>Lịch sử kiểm kho</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table
          columns={columns}
          dataSource={[]}
          rowKey="id"
          pagination={{ pageSize: 20, showTotal: (total) => `Hiển thị 0 trên ${total}` }}
          locale={{ emptyText: "Chưa có phiếu phân bổ" }}
          size="middle"
        />
      </div>
    </>
  );
}

// ── Department View ────────────────────────────────────────────────────────

function DepartmentView() {
  const [keyword, setKeyword] = useState("");

  const rightColumns = [
    { title: "Thời gian phân bổ", dataIndex: "allocationTime", key: "allocationTime" },
    { title: "Mã phân bổ", dataIndex: "allocationCode", key: "allocationCode" },
    { title: "Vật tư", dataIndex: "material", key: "material" },
    { title: "SL được phát", dataIndex: "distributedQty", key: "distributedQty" },
    { title: "SL còn lại (đã duyệt)", dataIndex: "approvedRemaining", key: "approvedRemaining" },
    { title: "Kiểm kho", dataIndex: "inventoryCheck", key: "inventoryCheck" },
    { title: "Người thực hiện", dataIndex: "performer", key: "performer" },
    { title: "Ghi chú", dataIndex: "note", key: "note" },
    {
      title: "Thao tác",
      key: "actions",
      render: () => <Button size="small" type="link">Chi tiết</Button>,
    },
  ];

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div className="reception-card" style={{ width: 240, minWidth: 200, padding: 16, flexShrink: 0 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          Phòng ban
          <span style={{ fontWeight: 400, color: "#8c8c8c", marginLeft: 6 }}>0 phòng ban</span>
        </div>
        <div style={{ fontSize: 12, color: "#8c8c8c", marginBottom: 10 }}>
          Chọn phòng ban để xem vật tư đã phát và kiểm kho
        </div>
        <Input placeholder="Tìm phòng ban..." size="small" style={{ marginBottom: 8 }} />
        <Button type="dashed" block size="small">Tạo phòng ban</Button>
        <div style={{ color: "#8c8c8c", fontSize: 13, textAlign: "center", paddingTop: 24 }}>
          Chưa có phòng ban
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="reception-card reception-card--toolbar">
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm vật tư..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 220 }}
              allowClear
            />
            <Button>Gộp số lượng vật tư</Button>
          </div>
        </div>
        <div className="reception-card reception-card--content">
          <Table
            columns={rightColumns}
            dataSource={[]}
            rowKey="id"
            pagination={{ pageSize: 20, showTotal: (total) => `Hiển thị 0 trên ${total}` }}
            locale={{ emptyText: "Chọn phòng ban để xem vật tư đã phân bổ" }}
            size="middle"
          />
        </div>
      </div>
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
