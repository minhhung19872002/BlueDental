import { useState } from "react";
import { Table, Empty, Tabs, Input, Button, Modal, Form, InputNumber, Select, message, Popconfirm, Tag } from "antd";
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
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
  labelKey: string;
}

const TAXONOMY_TAB_DEFS: TaxonomyTab[] = [
  { key: "service",                  labelKey: "taxonomy.service" },
  { key: "diagnosis",                labelKey: "taxonomy.diagnosis" },
  { key: "medicine",                 labelKey: "taxonomy.medicine" },
  { key: "consulting",               labelKey: "taxonomy.consulting" },
  { key: "source",                   labelKey: "taxonomy.source" },
  { key: "history",                  labelKey: "taxonomy.history" },
  { key: "prescription-template",    labelKey: "taxonomy.prescriptionTemplate" },
  { key: "medical-record-template",  labelKey: "taxonomy.medicalRecordTemplate" },
  { key: "tags",                     labelKey: "taxonomy.tags" },
  { key: "payment-method",           labelKey: "taxonomy.paymentMethod" },
  { key: "occupation",               labelKey: "taxonomy.occupation" },
];

interface ServiceGroupDef {
  key: string;
  labelKey: string;
  category: ProcedureCategory;
}

const SERVICE_GROUP_DEFS: ServiceGroupDef[] = [
  { key: "phau-thuat", labelKey: "taxonomy.surgery",      category: "Surgery" },
  { key: "tong-quat",  labelKey: "taxonomy.general",      category: "General" },
  { key: "tham-my",    labelKey: "taxonomy.cosmetic",     category: "Cosmetic" },
  { key: "chinh-nha",  labelKey: "taxonomy.orthodontics", category: "Orthodontics" },
  { key: "implant",    labelKey: "taxonomy.implant",      category: "Implant" },
];

const CATEGORY_OPTIONS = Object.entries(PROCEDURE_CATEGORY_LABELS).map(([value, label]) => ({
  value: value as ProcedureCategory,
  label,
}));

// ── Create/Edit Modal (Dental Procedure) ─────────────────────────────────

interface ProcedureModalProps {
  open: boolean;
  onClose: () => void;
  editingItem: DentalProcedureDto | null;
  defaultCategory?: ProcedureCategory;
}

function ProcedureModal({ open, onClose, editingItem, defaultCategory }: ProcedureModalProps) {
  const { t } = useTranslation();
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
        message.success(t("taxonomy.updateServiceSuccess"));
      } else {
        await createMutation.mutateAsync({
          code: values.code,
          name: values.name,
          description: values.description,
          category: values.category,
          basePrice: values.basePrice,
          estimatedDurationMinutes: values.estimatedDurationMinutes ?? 30,
        });
        message.success(t("taxonomy.createServiceSuccess"));
      }
      form.resetFields();
      onClose();
    } catch {
      // validation errors handled by antd Form
    }
  };

  return (
    <Modal
      title={isEdit ? t("taxonomy.editService") : t("taxonomy.addServiceNew")}
      open={open}
      onCancel={() => { form.resetFields(); onClose(); }}
      onOk={handleOk}
      confirmLoading={createMutation.isPending || updateMutation.isPending}
      okText={isEdit ? t("taxonomy.saveChanges") : t("taxonomy.createService")}
      cancelText={t("taxonomy.cancel")}
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
          <Form.Item name="code" label={t("taxonomy.serviceCode")} rules={[{ required: true, message: t("taxonomy.enterServiceCode") }]}>
            <Input placeholder="VD: DV001" />
          </Form.Item>
        )}
        <Form.Item name="name" label={t("taxonomy.serviceName")} rules={[{ required: true, message: t("taxonomy.enterServiceName") }]}>
          <Input placeholder={t("taxonomy.enterServiceName")} />
        </Form.Item>
        <Form.Item name="category" label={t("taxonomy.category")} rules={[{ required: true, message: t("taxonomy.selectCategory") }]}>
          <Select options={CATEGORY_OPTIONS} placeholder={t("taxonomy.selectCategory")} />
        </Form.Item>
        <Form.Item name="basePrice" label={t("taxonomy.basePrice")} rules={[{ required: true, message: t("taxonomy.basePrice") }]}>
          <InputNumber<number>
            min={0}
            style={{ width: "100%" }}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            parser={(v) => parseFloat((v ?? "0").replace(/,/g, "")) || 0}
            placeholder="0"
          />
        </Form.Item>
        <Form.Item name="estimatedDurationMinutes" label={t("taxonomy.estimatedDuration")}>
          <InputNumber min={5} max={480} style={{ width: "100%" }} placeholder="30" />
        </Form.Item>
        <Form.Item name="description" label={t("taxonomy.description")}>
          <Input.TextArea rows={3} placeholder={t("taxonomy.describeService")} />
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
  const { t } = useTranslation();
  const [groupSearch, setGroupSearch] = useState("");

  const SERVICE_GROUPS = SERVICE_GROUP_DEFS.map((g) => ({ ...g, label: t(g.labelKey) }));
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
        {t("taxonomy.serviceGroups")}
        <span style={{ fontWeight: 400, color: "#8FA4BD", marginLeft: 6, fontSize: 13 }}>
          {t("taxonomy.groupCount", { count: SERVICE_GROUP_DEFS.length })}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "#5A6B82", marginBottom: 10 }}>
        {t("taxonomy.selectGroupHint")}
      </div>
      <Input
        prefix={<SearchOutlined />}
        placeholder={t("taxonomy.searchGroup")}
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
  const { t } = useTranslation();
  const [selectedGroup, setSelectedGroup] = useState("phau-thuat");
  const [serviceKeyword, setServiceKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DentalProcedureDto | null>(null);

  const { data, isLoading } = useDentalProcedureList();
  const deleteMutation = useDeleteDentalProcedure();

  const SERVICE_GROUPS = SERVICE_GROUP_DEFS.map((g) => ({ ...g, label: t(g.labelKey) }));
  const currentGroup = SERVICE_GROUPS.find((g) => g.key === selectedGroup);

  const filteredItems = (data?.items ?? []).filter((p) => {
    const matchCategory = p.category === currentGroup?.category;
    const matchKeyword = !serviceKeyword || p.name.toLowerCase().includes(serviceKeyword.toLowerCase()) || p.code.toLowerCase().includes(serviceKeyword.toLowerCase());
    return matchCategory && matchKeyword;
  });

  const counts: Record<string, number> = {};
  SERVICE_GROUP_DEFS.forEach((g) => {
    counts[g.key] = (data?.items ?? []).filter((p) => p.category === g.category).length;
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      message.success(t("taxonomy.deleteServiceSuccess"));
    } catch {
      message.error(t("taxonomy.deleteFailed"));
    }
  };

  const columns: ColumnsType<DentalProcedureDto> = [
    {
      title: "",
      key: "drag",
      width: 32,
      render: () => <span style={{ color: "#CBD5E1", cursor: "grab" }}>⠿</span>,
    },
    { title: t("taxonomy.code"),        dataIndex: "code",     key: "code",     width: 90 },
    { title: t("taxonomy.serviceName"), dataIndex: "name",     key: "name" },
    {
      title: t("taxonomy.category"),
      dataIndex: "category",
      key: "category",
      render: (cat: ProcedureCategory) => PROCEDURE_CATEGORY_LABELS[cat] ?? cat,
    },
    {
      title: t("taxonomy.price"),
      dataIndex: "basePrice",
      key: "basePrice",
      align: "right",
      render: (v: number) => `${v.toLocaleString("vi-VN")} ₫`,
    },
    {
      title: t("common.status"),
      dataIndex: "isActive",
      key: "isActive",
      render: (active: boolean) => (
        <Tag color={active ? "green" : "default"}>{active ? t("taxonomy.statusActive") : t("taxonomy.statusStopped")}</Tag>
      ),
    },
    {
      title: t("taxonomy.lastUpdated"),
      dataIndex: "lastModificationTime",
      key: "updatedAt",
      render: (v: string) => (v ? dayjs(v).format("DD/MM/YYYY") : "—"),
    },
    {
      title: t("taxonomy.actions"),
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
            title={t("taxonomy.confirmDelete")}
            onConfirm={() => handleDelete(record.id)}
            okText={t("common.delete")}
            cancelText={t("taxonomy.cancel")}
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
            {currentGroup?.label ?? t("taxonomy.service")}
            <span style={{ fontWeight: 400, color: "#9CA3AF", fontSize: 13, marginLeft: 8 }}>
              {t("taxonomy.recordCount", { count: filteredItems.length })}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#5A6B82", marginBottom: 10 }}>
            {t("taxonomy.manageGroup", { group: currentGroup?.label })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => { setEditingItem(null); setModalOpen(true); }}
            >
              {t("taxonomy.addService")}
            </Button>
            <Input
              prefix={<SearchOutlined />}
              placeholder={t("taxonomy.searchService")}
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
                description={t("taxonomy.noData")}
              />
            ),
          }}
          pagination={{
            pageSize: 20,
            showTotal: (total) => t("taxonomy.showTotal", { total }),
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
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = config.useList();
  const createMutation = config.useCreate();
  const updateMutation = config.useUpdate();
  const deleteMutation = config.useDelete();

  const isEdit = Boolean(editingItem);

  const TAG_COLORS = [
    { value: "#2671D8", label: t("taxonomy.colorBlue") },
    { value: "#10B981", label: t("taxonomy.colorGreen") },
    { value: "#F59E0B", label: t("taxonomy.colorYellow") },
    { value: "#EF4444", label: t("taxonomy.colorRed") },
    { value: "#8B5CF6", label: t("taxonomy.colorPurple") },
    { value: "#EC4899", label: t("taxonomy.colorPink") },
    { value: "#6B7280", label: t("taxonomy.colorGray") },
  ];

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
        message.success(t("taxonomy.updateSuccess"));
      } else {
        const createData: Record<string, unknown> = { name: values.name, description: values.description };
        if (config.hasCode) createData.code = values.code;
        if (config.hasSortOrder) createData.sortOrder = values.sortOrder ?? 0;
        if (config.hasColor) createData.color = values.color;
        await createMutation.mutateAsync(createData);
        message.success(t("taxonomy.createSuccess"));
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
      message.success(t("taxonomy.deleteSuccess"));
    } catch {
      message.error(t("taxonomy.deleteFailed"));
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
      title: t("taxonomy.codeLabel") as string,
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
      title: t("common.status"),
      dataIndex: "isActive",
      key: "isActive",
      width: 110,
      render: (active: boolean) => (
        <Tag color={active ? "green" : "default"}>{active ? t("taxonomy.statusActive") : t("taxonomy.statusStopped")}</Tag>
      ),
    },
    {
      title: t("taxonomy.lastUpdated"),
      dataIndex: "lastModificationTime",
      key: "updatedAt",
      render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY") : "—",
    },
    {
      title: t("taxonomy.actions"),
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
            title={t("taxonomy.confirmDeleteItem")}
            onConfirm={() => handleDelete(record.id)}
            okText={t("common.delete")}
            cancelText={t("taxonomy.cancel")}
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
          placeholder={t("taxonomy.searchPlaceholder", { name: config.nameLabel.toLowerCase() })}
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
          {t("taxonomy.createNew")}
        </Button>
      </div>
      <Table<CatalogItem>
        rowKey="id"
        dataSource={items}
        columns={columns}
        loading={isLoading}
        locale={{
          emptyText: (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("taxonomy.noDataYet")} />
          ),
        }}
        pagination={{ pageSize: 20, showTotal: (total) => t("taxonomy.showTotal", { total }) }}
        size="middle"
      />

      <Modal
        title={isEdit ? t("taxonomy.editItem", { name: config.nameLabel.toLowerCase() }) : t("taxonomy.addItem", { name: config.nameLabel.toLowerCase() })}
        open={modalOpen}
        onCancel={() => { form.resetFields(); setEditingItem(null); setModalOpen(false); }}
        onOk={handleOk}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={isEdit ? t("taxonomy.saveChanges") : t("taxonomy.createNew")}
        cancelText={t("taxonomy.cancel")}
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
            <Form.Item name="code" label={t("taxonomy.codeLabel")} rules={[{ required: true, message: t("taxonomy.enterCode") }]}>
              <Input placeholder="VD: NS001" />
            </Form.Item>
          )}
          <Form.Item name="name" label={config.nameLabel} rules={[{ required: true, message: t("taxonomy.enterItem", { name: config.nameLabel.toLowerCase() }) }]}>
            <Input placeholder={t("taxonomy.enterItem", { name: config.nameLabel.toLowerCase() })} />
          </Form.Item>
          {config.hasColor && (
            <Form.Item name="color" label={t("taxonomy.colorLabel")}>
              <Select placeholder={t("taxonomy.selectColor")} allowClear options={TAG_COLORS} />
            </Form.Item>
          )}
          {config.hasSortOrder && (
            <Form.Item name="sortOrder" label={t("taxonomy.sortOrder")}>
              <InputNumber min={0} style={{ width: "100%" }} placeholder="0" />
            </Form.Item>
          )}
          <Form.Item name="description" label={t("taxonomy.descriptionLabel")}>
            <Input.TextArea rows={3} placeholder={t("taxonomy.descriptionPlaceholder")} />
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

// ── Main ──────────────────────────────────────────────────────────────────

export function TaxonomyPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("service");

  const renderContent = () => {
    if (activeTab === "service") return <ServicePanel />;
    const crudConfig = CRUD_CONFIGS[activeTab];
    if (crudConfig) return <CrudPanel config={crudConfig} />;
    return null;
  };

  return (
    <div className="reception-page">
      <div className="reception-card reception-card--toolbar">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 0 }}
          items={TAXONOMY_TAB_DEFS.map((tab) => ({
            key: tab.key,
            label: t(tab.labelKey),
          }))}
        />
      </div>
      <div className="reception-card reception-card--content">
        {renderContent()}
      </div>
    </div>
  );
}
