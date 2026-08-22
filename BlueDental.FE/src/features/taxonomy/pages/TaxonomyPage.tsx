import { useState } from "react";
import { Table, Empty, Tabs, Input, Button, Modal, Form, InputNumber, Select, message, Popconfirm, Tag } from "antd";
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import {
  useDentalProcedureList,
  useCreateDentalProcedure,
  useUpdateDentalProcedure,
  useDeleteDentalProcedure,
  PROCEDURE_CATEGORY_LABELS,
  type DentalProcedureDto,
  type ProcedureCategory,
  type CreateDentalProcedureDto,
  type UpdateDentalProcedureDto,
} from "../api";

// ── Constants ─────────────────────────────────────────────────────────────

interface TaxonomyTab {
  key: string;
  label: string;
}

const TAXONOMY_TABS: TaxonomyTab[] = [
  { key: "service", label: "Dịch vụ" },
  { key: "diagnosis", label: "Chẩn đoán" },
  { key: "medicine", label: "Loại thuốc" },
  { key: "consulting", label: "Dữ liệu tư vấn" },
  { key: "source", label: "Nguồn đến" },
  { key: "history", label: "Lịch sử bệnh" },
  { key: "prescription-template", label: "Đơn thuốc mẫu" },
  { key: "medical-record-template", label: "Bệnh án mẫu" },
  { key: "tags", label: "Thẻ hồ sơ" },
  { key: "payment-method", label: "Phương thức thanh toán" },
  { key: "occupation", label: "Nghề nghiệp" },
];

interface ServiceGroup {
  key: string;
  label: string;
  category: ProcedureCategory;
}

const SERVICE_GROUPS: ServiceGroup[] = [
  { key: "phau-thuat", label: "PHẪU THUẬT NHA CHU", category: "Surgery" },
  { key: "tong-quat",  label: "NHA KHOA TỔNG QUÁT",  category: "General" },
  { key: "tham-my",    label: "NHA KHOA THẨM MỸ",    category: "Cosmetic" },
  { key: "chinh-nha",  label: "CHỈNH NHA",            category: "Orthodontics" },
  { key: "implant",    label: "CẤY GHÉP IMPLANT",     category: "Implant" },
];

const CATEGORY_OPTIONS = Object.entries(PROCEDURE_CATEGORY_LABELS).map(([value, label]) => ({
  value: value as ProcedureCategory,
  label,
}));

// ── Create/Edit Modal ─────────────────────────────────────────────────────

interface ProcedureModalProps {
  open: boolean;
  onClose: () => void;
  editingItem: DentalProcedureDto | null;
  defaultCategory?: ProcedureCategory;
}

function ProcedureModal({ open, onClose, editingItem, defaultCategory }: ProcedureModalProps) {
  const [form] = Form.useForm<CreateDentalProcedureDto & UpdateDentalProcedureDto>();
  const createMutation = useCreateDentalProcedure();
  const updateMutation = useUpdateDentalProcedure();
  const isEdit = Boolean(editingItem);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (isEdit && editingItem) {
        await updateMutation.mutateAsync({
          id: editingItem.id,
          data: {
            name: values.name,
            description: values.description,
            category: values.category,
            basePrice: values.basePrice,
            estimatedDurationMinutes: values.estimatedDurationMinutes ?? 30,
          },
        });
        message.success("Cập nhật dịch vụ thành công");
      } else {
        await createMutation.mutateAsync({
          code: values.code,
          name: values.name,
          description: values.description,
          category: values.category,
          basePrice: values.basePrice,
          estimatedDurationMinutes: values.estimatedDurationMinutes ?? 30,
        });
        message.success("Tạo dịch vụ thành công");
      }
      form.resetFields();
      onClose();
    } catch {
      // validation errors handled by antd Form
    }
  };

  return (
    <Modal
      title={isEdit ? "Chỉnh sửa dịch vụ" : "Thêm dịch vụ mới"}
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      okText={isEdit ? "Lưu thay đổi" : "Tạo dịch vụ"}
      cancelText="Hủy"
      width={520}
      destroyOnClose
      afterOpenChange={(visible) => {
        if (visible && editingItem) {
          form.setFieldsValue({
            code: editingItem.code,
            name: editingItem.name,
            description: editingItem.description,
            category: editingItem.category,
            basePrice: editingItem.basePrice,
            estimatedDurationMinutes: editingItem.estimatedDurationMinutes,
          });
        } else if (visible && defaultCategory) {
          form.setFieldsValue({ category: defaultCategory });
        }
      }}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        {!isEdit && (
          <Form.Item name="code" label="Mã dịch vụ" rules={[{ required: true, message: "Nhập mã dịch vụ" }]}>
            <Input placeholder="VD: DV001" />
          </Form.Item>
        )}
        <Form.Item name="name" label="Tên dịch vụ" rules={[{ required: true, message: "Nhập tên dịch vụ" }]}>
          <Input placeholder="Nhập tên dịch vụ..." />
        </Form.Item>
        <Form.Item name="category" label="Nhóm phân loại" rules={[{ required: true, message: "Chọn nhóm" }]}>
          <Select options={CATEGORY_OPTIONS} placeholder="Chọn nhóm..." />
        </Form.Item>
        <Form.Item name="basePrice" label="Giá cơ bản (VND)" rules={[{ required: true, message: "Nhập giá" }]}>
          <InputNumber<number>
            min={0}
            style={{ width: "100%" }}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            parser={(v) => parseFloat((v ?? "0").replace(/,/g, "")) || 0}
            placeholder="0"
          />
        </Form.Item>
        <Form.Item name="estimatedDurationMinutes" label="Thời gian ước tính (phút)">
          <InputNumber min={5} max={480} style={{ width: "100%" }} placeholder="30" />
        </Form.Item>
        <Form.Item name="description" label="Mô tả">
          <Input.TextArea rows={3} placeholder="Mô tả dịch vụ..." />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// ── Service Panel ─────────────────────────────────────────────────────────

function GroupSidebar({
  selectedGroup,
  onSelect,
  counts,
}: {
  selectedGroup: string;
  onSelect: (key: string) => void;
  counts: Record<string, number>;
}) {
  const [groupSearch, setGroupSearch] = useState("");
  const filtered = SERVICE_GROUPS.filter((g) =>
    g.label.toLowerCase().includes(groupSearch.toLowerCase()),
  );

  return (
    <div
      style={{
        width: 230,
        flexShrink: 0,
        border: "1px solid #DCE3EE",
        borderRadius: 10,
        padding: 14,
        background: "#fff",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, color: "#1B2A41" }}>
        Nhóm dịch vụ
        <span style={{ fontWeight: 400, color: "#8FA4BD", marginLeft: 6, fontSize: 13 }}>
          {SERVICE_GROUPS.length} nhóm
        </span>
      </div>
      <div style={{ fontSize: 12, color: "#5A6B82", marginBottom: 10 }}>
        Chọn nhóm để xem dịch vụ bên trong
      </div>
      <Input
        prefix={<SearchOutlined />}
        placeholder="Tìm nhóm..."
        size="small"
        value={groupSearch}
        onChange={(e) => setGroupSearch(e.target.value)}
        style={{ marginBottom: 8 }}
        allowClear
      />
      {filtered.map((group) => (
        <button
          key={group.key}
          type="button"
          onClick={() => onSelect(group.key)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "8px 10px",
            borderRadius: 6,
            border: "none",
            background: selectedGroup === group.key ? "#EBF3FE" : "none",
            color: selectedGroup === group.key ? "#1E5BB0" : "#374151",
            fontWeight: selectedGroup === group.key ? 600 : 400,
            fontSize: 13,
            cursor: "pointer",
            textAlign: "left",
            marginBottom: 2,
          }}
        >
          <span>{group.label}</span>
          <span style={{ fontSize: 12, color: "#9CA3AF" }}>{counts[group.key] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

function ServicePanel() {
  const [selectedGroup, setSelectedGroup] = useState("phau-thuat");
  const [serviceKeyword, setServiceKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DentalProcedureDto | null>(null);

  const { data, isLoading } = useDentalProcedureList();
  const deleteMutation = useDeleteDentalProcedure();

  const currentGroup = SERVICE_GROUPS.find((g) => g.key === selectedGroup);

  const filteredItems = (data?.items ?? []).filter((p) => {
    const matchCategory = p.category === currentGroup?.category;
    const matchKeyword = !serviceKeyword || p.name.toLowerCase().includes(serviceKeyword.toLowerCase()) || p.code.toLowerCase().includes(serviceKeyword.toLowerCase());
    return matchCategory && matchKeyword;
  });

  const counts: Record<string, number> = {};
  SERVICE_GROUPS.forEach((g) => {
    counts[g.key] = (data?.items ?? []).filter((p) => p.category === g.category).length;
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      message.success("Xóa dịch vụ thành công");
    } catch {
      message.error("Xóa thất bại");
    }
  };

  const columns: ColumnsType<DentalProcedureDto> = [
    {
      title: "",
      key: "drag",
      width: 32,
      render: () => <span style={{ color: "#CBD5E1", cursor: "grab" }}>⠿</span>,
    },
    { title: "Mã", dataIndex: "code", key: "code", width: 90 },
    { title: "Tên dịch vụ", dataIndex: "name", key: "name" },
    {
      title: "Nhóm phân loại",
      dataIndex: "category",
      key: "category",
      render: (cat: ProcedureCategory) => PROCEDURE_CATEGORY_LABELS[cat] ?? cat,
    },
    {
      title: "Giá",
      dataIndex: "basePrice",
      key: "basePrice",
      align: "right",
      render: (v: number) => `${v.toLocaleString("vi-VN")} ₫`,
    },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      key: "isActive",
      render: (active: boolean) => (
        <Tag color={active ? "green" : "default"}>{active ? "Đang dùng" : "Ngừng"}</Tag>
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
            title="Xác nhận xóa dịch vụ này?"
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
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <GroupSidebar
        selectedGroup={selectedGroup}
        onSelect={setSelectedGroup}
        counts={counts}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#1B2A41" }}>
            {currentGroup?.label ?? "Dịch vụ"}
            <span style={{ fontWeight: 400, color: "#9CA3AF", fontSize: 13, marginLeft: 8 }}>
              {filteredItems.length} bản ghi
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#5A6B82", marginBottom: 10 }}>
            Quản lý các mục thuộc nhóm {currentGroup?.label}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => { setEditingItem(null); setModalOpen(true); }}
            >
              Thêm dịch vụ
            </Button>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Tìm theo tên dịch vụ..."
              value={serviceKeyword}
              onChange={(e) => setServiceKeyword(e.target.value)}
              style={{ width: 240 }}
              allowClear
            />
          </div>
        </div>
        <Table<DentalProcedureDto>
          rowKey="id"
          dataSource={filteredItems}
          columns={columns}
          loading={isLoading}
          size="middle"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Không có dữ liệu"
              />
            ),
          }}
          pagination={{
            pageSize: 20,
            showTotal: (total) => `Hiển thị ${total} bản ghi`,
          }}
        />
      </div>

      <ProcedureModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingItem={editingItem}
        defaultCategory={currentGroup?.category}
      />
    </div>
  );
}

// ── Simple Tab Panel ───────────────────────────────────────────────────────

interface TaxonomyRecord {
  id: string;
  name: string;
  group?: string;
  updatedAt?: string;
}

function buildSimpleColumns(nameLabel: string): ColumnsType<TaxonomyRecord> {
  return [
    {
      title: "",
      key: "drag",
      width: 32,
      render: () => <span style={{ color: "#CBD5E1", cursor: "grab" }}>⠿</span>,
    },
    { title: nameLabel, dataIndex: "name", key: "name" },
    { title: "Nhóm phân loại", dataIndex: "group", key: "group" },
    { title: "Cập nhật gần nhất", dataIndex: "updatedAt", key: "updatedAt" },
    {
      title: "Thao tác",
      key: "actions",
      width: 100,
      render: () => null,
    },
  ];
}

function SimpleTabPanel({ activeTab }: { activeTab: string }) {
  const tab = TAXONOMY_TABS.find((t) => t.key === activeTab);
  const nameLabel = tab?.label ?? "Tên";
  const columns = buildSimpleColumns(nameLabel);

  return (
    <Table<TaxonomyRecord>
      rowKey="id"
      dataSource={[]}
      columns={columns}
      locale={{
        emptyText: (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Không có dữ liệu"
          />
        ),
      }}
      pagination={false}
    />
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export function TaxonomyPage() {
  const [activeTab, setActiveTab] = useState("service");

  return (
    <div className="reception-page">
      <div className="reception-card reception-card--toolbar">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 0 }}
          items={TAXONOMY_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
          }))}
        />
      </div>
      <div className="reception-card reception-card--content">
        {activeTab === "service" ? (
          <ServicePanel />
        ) : (
          <SimpleTabPanel activeTab={activeTab} />
        )}
      </div>
    </div>
  );
}
