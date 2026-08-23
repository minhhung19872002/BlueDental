import { useState } from "react";
import { Button, Input, Select, Spin, Table, Tag, Modal, Form, message, Popconfirm } from "antd";
import {
  SearchOutlined,
  DownloadOutlined,
  LeftOutlined,
  RightOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/vi";
import { useCareRecordList } from "../api/careApi";
import type { CareType as ApiCareType, CareStatus } from "../api/careApi";
import { useDebounce } from "@/hooks/useDebounce";

dayjs.locale("vi");

// ── Types ──────────────────────────────────────────────────────────────────

type TopTab = "care" | "grouping";
type ViewMode = "day" | "week" | "month";
type StatusFilter =
  | "total"
  | "success"
  | "failed"
  | "not-cared"
  | "zalo-sent";
type CareType =
  | "after-treatment"
  | "birthday"
  | "appointment-reminder"
  | "periodic"
  | "special";

// ── Static maps (keys only, labels resolved via t()) ──────────────────────

const CARE_TYPE_MAP: Record<CareType, ApiCareType> = {
  "after-treatment": "AfterTreatment",
  "birthday": "Birthday",
  "appointment-reminder": "AppointmentReminder",
  "periodic": "Periodic",
  "special": "Special",
};

const STATUS_MAP: Record<StatusFilter, CareStatus | undefined> = {
  "total": undefined,
  "success": "Completed",
  "failed": "Cancelled",
  "not-cared": "Pending",
  "zalo-sent": undefined,
};

// ── Component ──────────────────────────────────────────────────────────────

export function CskhGroupingPage() {
  const { t } = useTranslation();
  const [topTab, setTopTab] = useState<TopTab>("care");
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("total");
  const [careType, setCareType] = useState<CareType>("after-treatment");
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebounce(keyword);

  const TOP_TABS: { key: TopTab; label: string }[] = [
    { key: "care",     label: t("cskh.customerCare") },
    { key: "grouping", label: t("cskh.grouping") },
  ];

  const VIEW_MODES: { key: ViewMode; label: string }[] = [
    { key: "day",   label: t("common.day") },
    { key: "week",  label: t("common.week") },
    { key: "month", label: t("common.month") },
  ];

  const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "total",     label: t("cskh.totalCustomers") },
    { key: "success",   label: t("cskh.success") },
    { key: "failed",    label: t("cskh.failed") },
    { key: "not-cared", label: t("cskh.notCared") },
    { key: "zalo-sent", label: t("cskh.sentZalo") },
  ];

  const CARE_TYPES: { key: CareType; label: string }[] = [
    { key: "after-treatment",      label: t("cskh.afterTreatment") },
    { key: "birthday",             label: t("cskh.birthday") },
    { key: "appointment-reminder", label: t("cskh.appointmentReminder") },
    { key: "periodic",             label: t("cskh.periodic") },
    { key: "special",              label: t("cskh.special") },
  ];

  const TABLE_COLUMNS = [
    { title: t("cskh.careDate"),            dataIndex: "careDate",            key: "careDate" },
    { title: t("patient.fullName"),         dataIndex: "fullName",            key: "fullName" },
    { title: t("common.phone"),             dataIndex: "phone",               key: "phone" },
    { title: t("cskh.treatingDoctor"),      dataIndex: "doctor",              key: "doctor" },
    { title: t("cskh.upcomingAppointment"), dataIndex: "upcomingAppointment", key: "upcomingAppointment" },
    {
      title: t("common.status"),
      dataIndex: "status",
      key: "status",
      render: (status: string | undefined) =>
        status ? <Tag>{status}</Tag> : null,
    },
    { title: t("common.note"), dataIndex: "note", key: "note" },
    {
      title: t("common.actions"),
      key: "actions",
      render: () => (
        <Button size="small" type="link">
          {t("cskh.detail")}
        </Button>
      ),
    },
  ];

  const { data: careData, isLoading: careLoading } = useCareRecordList({
    type: CARE_TYPE_MAP[careType],
    status: STATUS_MAP[statusFilter],
    filter: debouncedKeyword || undefined,
    maxResultCount: 50,
  });

  const careRecords = careData?.items ?? [];

  const handlePrev = () => {
    if (viewMode === "day") setCurrentDate((d) => d.subtract(1, "day"));
    else if (viewMode === "week") setCurrentDate((d) => d.subtract(1, "week"));
    else setCurrentDate((d) => d.subtract(1, "month"));
  };

  const handleNext = () => {
    if (viewMode === "day") setCurrentDate((d) => d.add(1, "day"));
    else if (viewMode === "week") setCurrentDate((d) => d.add(1, "week"));
    else setCurrentDate((d) => d.add(1, "month"));
  };

  const formattedDate =
    viewMode === "month"
      ? currentDate.format("MM/YYYY")
      : currentDate.format("DD/MM/YYYY");

  return (
    <div className="reception-page">
      {/* Top-level tabs */}
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0 }}>
          {TOP_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTopTab(tab.key)}
              style={{
                padding: "8px 20px",
                border: "none",
                borderBottom: topTab === tab.key ? "2px solid #1677ff" : "2px solid transparent",
                background: "none",
                color: topTab === tab.key ? "#1677ff" : "#595959",
                fontWeight: topTab === tab.key ? 600 : 400,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar row 1: date navigation */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* View mode buttons */}
          <div style={{ display: "flex", border: "1px solid #d9d9d9", borderRadius: 6, overflow: "hidden" }}>
            {VIEW_MODES.map((vm) => (
              <button
                key={vm.key}
                onClick={() => setViewMode(vm.key)}
                style={{
                  padding: "5px 14px",
                  border: "none",
                  borderRight: "1px solid #d9d9d9",
                  background: viewMode === vm.key ? "#1677ff" : "#fff",
                  color: viewMode === vm.key ? "#fff" : "#595959",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: viewMode === vm.key ? 600 : 400,
                }}
              >
                {vm.label}
              </button>
            ))}
          </div>
          {/* Date navigator */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button
              icon={<LeftOutlined />}
              size="small"
              onClick={handlePrev}
            />
            <span style={{ minWidth: 90, textAlign: "center", fontWeight: 500 }}>
              {formattedDate}
            </span>
            <Button
              icon={<RightOutlined />}
              size="small"
              onClick={handleNext}
            />
          </div>
        </div>
      </div>

      {/* Status counter buttons */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {STATUS_FILTERS.map((sf) => {
            const count = sf.key === "total" ? (careData?.totalCount ?? 0)
              : sf.key === "success" ? careRecords.filter(r => r.status === "Completed").length
              : sf.key === "failed" ? careRecords.filter(r => r.status === "Cancelled").length
              : sf.key === "not-cared" ? careRecords.filter(r => r.status === "Pending").length
              : 0;
            return (
              <button
                key={sf.key}
                onClick={() => setStatusFilter(sf.key)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 20,
                  border: "1px solid",
                  borderColor: statusFilter === sf.key ? "#1677ff" : "#d9d9d9",
                  background: statusFilter === sf.key ? "#e6f4ff" : "#fff",
                  color: statusFilter === sf.key ? "#1677ff" : "#595959",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: statusFilter === sf.key ? 600 : 400,
                }}
              >
                {count} {sf.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Care type tabs */}
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
          {CARE_TYPES.map((ct) => (
            <button
              key={ct.key}
              onClick={() => setCareType(ct.key)}
              style={{
                padding: "8px 16px",
                border: "none",
                borderBottom: careType === ct.key ? "2px solid #1677ff" : "2px solid transparent",
                background: "none",
                color: careType === ct.key ? "#1677ff" : "#595959",
                fontWeight: careType === ct.key ? 600 : 400,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar row 2 */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button icon={<DownloadOutlined />}>{t("common.exportExcel")}</Button>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("common.search")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder={t("cskh.doctorFilter")}
            style={{ width: 180 }}
            allowClear
            options={[]}
          />
        </div>
      </div>

      {/* Tab content */}
      {topTab === "care" && (
        <div className="reception-card reception-card--content">
          {careLoading ? (
            <div style={{ textAlign: "center", padding: 48 }}><Spin /></div>
          ) : (
            <Table
              columns={TABLE_COLUMNS}
              dataSource={careRecords.map((r) => ({
                id: r.id,
                careDate: r.dueAt ? dayjs(r.dueAt).format("DD/MM/YYYY") : dayjs(r.creationTime).format("DD/MM/YYYY"),
                fullName: r.patientName ?? "—",
                phone: "—",
                doctor: "—",
                upcomingAppointment: "—",
                status: r.status,
                note: r.description ?? "—",
              }))}
              rowKey="id"
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                pageSizeOptions: ["10", "20", "50", "100"],
                showTotal: (total, range) => t("cskh.showRange", { from: range[0], to: range[1], total }),
              }}
              locale={{ emptyText: t("common.noData") }}
              size="middle"
            />
          )}
        </div>
      )}

      {topTab === "grouping" && <CskhGroupingPanel />}
    </div>
  );
}

import {
  useCskhGroupList,
  useCreateCskhGroup,
  useUpdateCskhGroup,
  useDeleteCskhGroup,
  type CskhGroupDto,
} from "../api/cskhGroupApi";

function CskhGroupingPanel() {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CskhGroupDto | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useCskhGroupList();
  const createMutation = useCreateCskhGroup();
  const updateMutation = useUpdateCskhGroup();
  const deleteMutation = useDeleteCskhGroup();
  const isEdit = Boolean(editingItem);

  const filtered = (data?.items ?? []).filter((g) =>
    !keyword || g.name.toLowerCase().includes(keyword.toLowerCase()),
  );

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (isEdit && editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, data: values });
        message.success(t("cskh.updateGroupSuccess"));
      } else {
        await createMutation.mutateAsync(values);
        message.success(t("cskh.createGroupSuccess"));
      }
      form.resetFields(); setEditingItem(null); setModalOpen(false);
    } catch { /* validation */ }
  };

  const handleDelete = async (id: string) => {
    try { await deleteMutation.mutateAsync(id); message.success(t("common.deleteSuccess")); } catch { message.error(t("common.deleteFailed")); }
  };

  const columns = [
    { title: t("cskh.groupName"), dataIndex: "name", key: "name", width: 220, render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span> },
    { title: t("cskh.groupCriteria"), dataIndex: "criteria", key: "criteria", render: (v: string) => v ?? "—" },
    {
      title: t("common.status"),
      dataIndex: "isActive",
      key: "status",
      width: 120,
      render: (v: boolean) => (
        <Tag color={v ? "green" : "default"}>{v ? t("cskh.using") : t("cskh.paused")}</Tag>
      ),
    },
    { title: t("common.day"), dataIndex: "creationTime", key: "createdAt", width: 120, render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY") : "—" },
    {
      title: t("common.actions"), key: "actions", width: 140,
      render: (_: unknown, record: CskhGroupDto) => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingItem(record); setModalOpen(true); }} />
          <Popconfirm title={t("cskh.confirmDeleteGroup")} onConfirm={() => handleDelete(record.id)} okText={t("common.delete")} cancelText={t("common.cancel")} okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Input prefix={<SearchOutlined />} placeholder={t("cskh.searchGroup")} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 260 }} allowClear />
          <Button type="primary" icon={<PlusOutlined />} style={{ marginLeft: "auto" }} onClick={() => { setEditingItem(null); form.resetFields(); setModalOpen(true); }}>{t("cskh.createGroup")}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table columns={columns} dataSource={filtered} rowKey="id" size="middle" loading={isLoading}
          pagination={{ pageSize: 20, showTotal: (total) => t("cskh.groupCount", { total }) }}
          locale={{ emptyText: t("cskh.noGroups") }} />
      </div>
      <Modal title={isEdit ? t("cskh.editGroupTitle") : t("cskh.createGroupTitle")} open={modalOpen}
        onCancel={() => { form.resetFields(); setEditingItem(null); setModalOpen(false); }}
        onOk={handleOk} confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={isEdit ? t("common.save") : t("cskh.createGroupBtn")} cancelText={t("common.cancel")} width={500} destroyOnClose
        afterOpenChange={(visible) => { if (visible && editingItem) form.setFieldsValue(editingItem); }}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={t("cskh.groupName")} rules={[{ required: true, message: t("cskh.enterGroupName") }]}><Input placeholder={t("cskh.groupNamePlaceholder")} /></Form.Item>
          <Form.Item name="criteria" label={t("cskh.groupCriteria")}><Input.TextArea rows={2} placeholder={t("cskh.groupCriteriaPlaceholder")} /></Form.Item>
          <Form.Item name="description" label={t("common.description")}><Input.TextArea rows={2} placeholder={t("common.description")} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
