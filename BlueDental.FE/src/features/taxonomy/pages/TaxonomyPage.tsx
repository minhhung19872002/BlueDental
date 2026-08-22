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
import {
  usePatientSourceList, useCreatePatientSource, useUpdatePatientSource, useDeletePatientSource,
  useOccupationList, useCreateOccupation, useUpdateOccupation, useDeleteOccupation,
  usePaymentMethodList, useCreatePaymentMethod, useUpdatePaymentMethod, useDeletePaymentMethod,
  usePatientTagList, useCreatePatientTag, useUpdatePatientTag, useDeletePatientTag,
  // Remaining 6 catalog entities
  useDiagnosisList, useCreateDiagnosis, useUpdateDiagnosis, useDeleteDiagnosis,
  useMedicationTypeList, useCreateMedicationType, useUpdateMedicationType, useDeleteMedicationType,
  useConsultingDataList, useCreateConsultingData, useUpdateConsultingData, useDeleteConsultingData,
  useMedicalHistoryTypeList, useCreateMedicalHistoryType, useUpdateMedicalHistoryType, useDeleteMedicalHistoryType,
  usePrescriptionTemplateList, useCreatePrescriptionTemplate, useUpdatePrescriptionTemplate, useDeletePrescriptionTemplate,
  useMedicalRecordTemplateList, useCreateMedicalRecordTemplate, useUpdateMedicalRecordTemplate, useDeleteMedicalRecordTemplate,
} from "../api/catalogApi";

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

const TAG_COLORS = [
  { value: "#2671D8", label: "Xanh dương" },
  { value: "#10B981", label: "Xanh lá" },
  { value: "#F59E0B", label: "Vàng" },
  { value: "#EF4444", label: "Đỏ" },
  { value: "#8B5CF6", label: "Tím" },
  { value: "#EC4899", label: "Hồng" },
  { value: "#6B7280", label: "Xám" },
];

// ── Create/Edit Modal (Dental Procedure) ─────────────────────────────────

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

// ── Generic CRUD Panel for simple catalog entities ────────────────────────

interface CatalogItem {
  id: string;
  name: string;
  code?: string;
  color?: string;
  description?: string;
  sortOrder?: number;
  isActive: boolean;
  creationTime: string;
  lastModificationTime?: string;
}

interface CrudPanelConfig {
  nameLabel: string;
  hasCode: boolean;
  hasColor: boolean;
  hasSortOrder: boolean;
  useList: () => { data: { items: CatalogItem[] } | undefined; isLoading: boolean };
  useCreate: () => { mutateAsync: (data: Record<string, unknown>) => Promise<unknown>; isPending: boolean };
  useUpdate: () => { mutateAsync: (data: { id: string; data: Record<string, unknown> }) => Promise<unknown>; isPending: boolean };
  useDelete: () => { mutateAsync: (id: string) => Promise<unknown>; isPending: boolean };
}

function CrudPanel({ config }: { config: CrudPanelConfig }) {
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = config.useList();
  const createMutation = config.useCreate();
  const updateMutation = config.useUpdate();
  const deleteMutation = config.useDelete();

  const isEdit = Boolean(editingItem);

  const items = (data?.items ?? []).filter(
    (item) => !keyword || item.name.toLowerCase().includes(keyword.toLowerCase()) || (item.code?.toLowerCase().includes(keyword.toLowerCase()) ?? false),
  );

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (isEdit && editingItem) {
        const updateData: Record<string, unknown> = { name: values.name, description: values.description };
        if (config.hasSortOrder) updateData.sortOrder = values.sortOrder ?? 0;
        if (config.hasColor) updateData.color = values.color;
        await updateMutation.mutateAsync({ id: editingItem.id, data: updateData });
        message.success("Cập nhật thành công");
      } else {
        const createData: Record<string, unknown> = { name: values.name, description: values.description };
        if (config.hasCode) createData.code = values.code;
        if (config.hasSortOrder) createData.sortOrder = values.sortOrder ?? 0;
        if (config.hasColor) createData.color = values.color;
        await createMutation.mutateAsync(createData);
        message.success("Tạo thành công");
      }
      form.resetFields();
      setEditingItem(null);
      setModalOpen(false);
    } catch {
      // validation
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      message.success("Xóa thành công");
    } catch {
      message.error("Xóa thất bại");
    }
  };

  const columns: ColumnsType<CatalogItem> = [
    {
      title: "",
      key: "drag",
      width: 32,
      render: () => <span style={{ color: "#CBD5E1", cursor: "grab" }}>⠿</span>,
    },
    ...(config.hasCode ? [{
      title: "Mã" as const,
      dataIndex: "code" as const,
      key: "code",
      width: 90,
    }] : []),
    {
      title: config.nameLabel,
      dataIndex: "name",
      key: "name",
      render: (v: string, record: CatalogItem) => (
        <span style={{ fontWeight: 500 }}>
          {config.hasColor && record.color && (
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", backgroundColor: record.color, marginRight: 8, verticalAlign: "middle" }} />
          )}
          {v}
        </span>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      key: "isActive",
      width: 110,
      render: (active: boolean) => (
        <Tag color={active ? "green" : "default"}>{active ? "Đang dùng" : "Ngừng"}</Tag>
      ),
    },
    {
      title: "Cập nhật gần nhất",
      dataIndex: "lastModificationTime",
      key: "updatedAt",
      render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY") : "—",
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 120,
      render: (_: unknown, record: CatalogItem) => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingItem(record);
              setModalOpen(true);
            }}
          />
          <Popconfirm
            title="Xác nhận xóa?"
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
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder={`Tìm ${config.nameLabel.toLowerCase()}...`}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          allowClear
          style={{ width: 280 }}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setEditingItem(null); form.resetFields(); setModalOpen(true); }}
        >
          Tạo mới
        </Button>
      </div>
      <Table<CatalogItem>
        rowKey="id"
        dataSource={items}
        columns={columns}
        loading={isLoading}
        locale={{
          emptyText: (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu" />
          ),
        }}
        pagination={{ pageSize: 20, showTotal: (total) => `Hiển thị ${total} bản ghi` }}
        size="middle"
      />

      <Modal
        title={isEdit ? `Chỉnh sửa ${config.nameLabel.toLowerCase()}` : `Thêm ${config.nameLabel.toLowerCase()} mới`}
        open={modalOpen}
        onCancel={() => { form.resetFields(); setEditingItem(null); setModalOpen(false); }}
        onOk={handleOk}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={isEdit ? "Lưu thay đổi" : "Tạo mới"}
        cancelText="Hủy"
        width={480}
        destroyOnClose
        afterOpenChange={(visible) => {
          if (visible && editingItem) {
            form.setFieldsValue({
              code: editingItem.code,
              name: editingItem.name,
              description: editingItem.description,
              sortOrder: editingItem.sortOrder,
              color: editingItem.color,
            });
          }
        }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {config.hasCode && !isEdit && (
            <Form.Item name="code" label="Mã" rules={[{ required: true, message: "Nhập mã" }]}>
              <Input placeholder="VD: NS001" />
            </Form.Item>
          )}
          <Form.Item name="name" label={config.nameLabel} rules={[{ required: true, message: `Nhập ${config.nameLabel.toLowerCase()}` }]}>
            <Input placeholder={`Nhập ${config.nameLabel.toLowerCase()}...`} />
          </Form.Item>
          {config.hasColor && (
            <Form.Item name="color" label="Màu sắc">
              <Select placeholder="Chọn màu" allowClear options={TAG_COLORS} />
            </Form.Item>
          )}
          {config.hasSortOrder && (
            <Form.Item name="sortOrder" label="Thứ tự sắp xếp">
              <InputNumber min={0} style={{ width: "100%" }} placeholder="0" />
            </Form.Item>
          )}
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Mô tả..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

// ── Crud Panel Configs ────────────────────────────────────────────────────

const CRUD_CONFIGS: Record<string, CrudPanelConfig> = {
  source: {
    nameLabel: "Nguồn đến",
    hasCode: true,
    hasColor: false,
    hasSortOrder: true,
    useList: usePatientSourceList as CrudPanelConfig["useList"],
    useCreate: useCreatePatientSource as CrudPanelConfig["useCreate"],
    useUpdate: useUpdatePatientSource as CrudPanelConfig["useUpdate"],
    useDelete: useDeletePatientSource as CrudPanelConfig["useDelete"],
  },
  occupation: {
    nameLabel: "Nghề nghiệp",
    hasCode: false,
    hasColor: false,
    hasSortOrder: true,
    useList: useOccupationList as CrudPanelConfig["useList"],
    useCreate: useCreateOccupation as CrudPanelConfig["useCreate"],
    useUpdate: useUpdateOccupation as CrudPanelConfig["useUpdate"],
    useDelete: useDeleteOccupation as CrudPanelConfig["useDelete"],
  },
  "payment-method": {
    nameLabel: "Phương thức thanh toán",
    hasCode: true,
    hasColor: false,
    hasSortOrder: false,
    useList: usePaymentMethodList as CrudPanelConfig["useList"],
    useCreate: useCreatePaymentMethod as CrudPanelConfig["useCreate"],
    useUpdate: useUpdatePaymentMethod as CrudPanelConfig["useUpdate"],
    useDelete: useDeletePaymentMethod as CrudPanelConfig["useDelete"],
  },
  tags: {
    nameLabel: "Thẻ hồ sơ",
    hasCode: false,
    hasColor: true,
    hasSortOrder: false,
    useList: usePatientTagList as CrudPanelConfig["useList"],
    useCreate: useCreatePatientTag as CrudPanelConfig["useCreate"],
    useUpdate: useUpdatePatientTag as CrudPanelConfig["useUpdate"],
    useDelete: useDeletePatientTag as CrudPanelConfig["useDelete"],
  },
  diagnosis: {
    nameLabel: "Chẩn đoán",
    hasCode: true,
    hasColor: false,
    hasSortOrder: true,
    useList: useDiagnosisList as CrudPanelConfig["useList"],
    useCreate: useCreateDiagnosis as CrudPanelConfig["useCreate"],
    useUpdate: useUpdateDiagnosis as CrudPanelConfig["useUpdate"],
    useDelete: useDeleteDiagnosis as CrudPanelConfig["useDelete"],
  },
  medicine: {
    nameLabel: "Loại thuốc",
    hasCode: false,
    hasColor: false,
    hasSortOrder: true,
    useList: useMedicationTypeList as CrudPanelConfig["useList"],
    useCreate: useCreateMedicationType as CrudPanelConfig["useCreate"],
    useUpdate: useUpdateMedicationType as CrudPanelConfig["useUpdate"],
    useDelete: useDeleteMedicationType as CrudPanelConfig["useDelete"],
  },
  consulting: {
    nameLabel: "Dữ liệu tư vấn",
    hasCode: false,
    hasColor: false,
    hasSortOrder: true,
    useList: useConsultingDataList as CrudPanelConfig["useList"],
    useCreate: useCreateConsultingData as CrudPanelConfig["useCreate"],
    useUpdate: useUpdateConsultingData as CrudPanelConfig["useUpdate"],
    useDelete: useDeleteConsultingData as CrudPanelConfig["useDelete"],
  },
  history: {
    nameLabel: "Lịch sử bệnh",
    hasCode: false,
    hasColor: false,
    hasSortOrder: true,
    useList: useMedicalHistoryTypeList as CrudPanelConfig["useList"],
    useCreate: useCreateMedicalHistoryType as CrudPanelConfig["useCreate"],
    useUpdate: useUpdateMedicalHistoryType as CrudPanelConfig["useUpdate"],
    useDelete: useDeleteMedicalHistoryType as CrudPanelConfig["useDelete"],
  },
  "prescription-template": {
    nameLabel: "Đơn thuốc mẫu",
    hasCode: false,
    hasColor: false,
    hasSortOrder: true,
    useList: usePrescriptionTemplateList as CrudPanelConfig["useList"],
    useCreate: useCreatePrescriptionTemplate as CrudPanelConfig["useCreate"],
    useUpdate: useUpdatePrescriptionTemplate as CrudPanelConfig["useUpdate"],
    useDelete: useDeletePrescriptionTemplate as CrudPanelConfig["useDelete"],
  },
  "medical-record-template": {
    nameLabel: "Bệnh án mẫu",
    hasCode: false,
    hasColor: false,
    hasSortOrder: true,
    useList: useMedicalRecordTemplateList as CrudPanelConfig["useList"],
    useCreate: useCreateMedicalRecordTemplate as CrudPanelConfig["useCreate"],
    useUpdate: useUpdateMedicalRecordTemplate as CrudPanelConfig["useUpdate"],
    useDelete: useDeleteMedicalRecordTemplate as CrudPanelConfig["useDelete"],
  },
};

// ── Simple Tab Panel (placeholder for tabs without BE yet) ───────────────

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
    { title: nameLabel, dataIndex: "name", key: "name", render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span> },
    { title: "Nhóm phân loại", dataIndex: "group", key: "group", render: (v: string) => v ? <Tag>{v}</Tag> : "—" },
    { title: "Cập nhật gần nhất", dataIndex: "updatedAt", key: "updatedAt", render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY") : "—" },
    {
      title: "Thao tác",
      key: "actions",
      width: 120,
      render: () => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small" icon={<EditOutlined />} />
          <Button size="small" icon={<DeleteOutlined />} danger />
        </div>
      ),
    },
  ];
}

function SimpleTabPanel({ activeTab }: { activeTab: string }) {
  const [keyword, setKeyword] = useState("");
  const tab = TAXONOMY_TABS.find((t) => t.key === activeTab);
  const nameLabel = tab?.label ?? "Tên";
  const columns = buildSimpleColumns(nameLabel);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder={`Tìm ${nameLabel.toLowerCase()}...`}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          allowClear
          style={{ width: 280 }}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => message.info("Chức năng đang phát triển")}
        >
          Tạo mới
        </Button>
      </div>
      <Table<TaxonomyRecord>
        rowKey="id"
        dataSource={[]}
        columns={columns}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Chưa có dữ liệu"
            />
          ),
        }}
        pagination={false}
        size="middle"
      />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export function TaxonomyPage() {
  const [activeTab, setActiveTab] = useState("service");

  const renderContent = () => {
    if (activeTab === "service") return <ServicePanel />;
    const crudConfig = CRUD_CONFIGS[activeTab];
    if (crudConfig) return <CrudPanel config={crudConfig} />;
    return <SimpleTabPanel activeTab={activeTab} />;
  };

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
        {renderContent()}
      </div>
    </div>
  );
}
