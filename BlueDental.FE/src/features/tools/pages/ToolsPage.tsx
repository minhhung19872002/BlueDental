import { useState } from "react";
import { Table, Button, Input, Tag, Empty, Popconfirm, Modal, message } from "antd";
import { SearchOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import {
  useCallAssignments, useCreateCallAssignment, useUpdateCallAssignmentStatus, useDeleteCallAssignment,
  useCallLogs, useDeleteCallLog,
  useMessageTemplates, useCreateMessageTemplate, useUpdateMessageTemplate, useDeleteMessageTemplate,
  useMessageLogs,
  type CallAssignmentDto, type CallLogDto,
  type MessageTemplateDto, type MessageLogDto,
} from "../api/toolsApi";

// ── Types ──────────────────────────────────────────────────────────────────

type ToolCategory = "call" | "message" | "zalo-oa" | "invoice";

// ── Status maps (numeric keys, labels via t()) ─────────────────────────────

const CALL_STATUS_COLORS: Record<number, string> = {
  0: "default",
  1: "green",
  2: "red",
};

const CALL_DIRECTION_COLOR: Record<number, string> = {
  0: "cyan",
  1: "blue",
};

const CALL_LOG_STATUS_COLORS: Record<number, string> = {
  0: "green",
  1: "red",
  2: "default",
};

const MSG_STATUS_COLORS: Record<number, string> = {
  0: "default",
  1: "green",
  2: "red",
  3: "blue",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function SubTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (k: string) => void;
}) {
  return (
    <div className="reception-card reception-card--tabs">
      <div style={{ display: "flex", gap: 0 }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            style={{
              padding: "8px 16px",
              border: "none",
              borderBottom: active === tab.key ? "2px solid #1677ff" : "2px solid transparent",
              background: "none",
              color: active === tab.key ? "#1677ff" : "#595959",
              fontWeight: active === tab.key ? 600 : 400,
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
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}p ${s}s` : `${s}s`;
}

// ── Config status constant ─────────────────────────────────────────────────
// UNKNOWN_REFERENCE_BEHAVIOR: The exact enum/string value used for the
// "activated" status in the call/message config API is not confirmed.
// Using "active" as a placeholder; adjust to match backend contract.
const CONFIG_STATUS_ACTIVE = "active";

// ── "Gọi thoại" views ─────────────────────────────────────────────────────

function CallConfigView() {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");

  const columns = [
    { title: t("tools.name"),        dataIndex: "name",        key: "name" },
    { title: t("tools.branch"),      dataIndex: "branch",      key: "branch" },
    { title: t("tools.settingType"), dataIndex: "settingType", key: "settingType" },
    { title: t("tools.provider"),    dataIndex: "provider",    key: "provider" },
    {
      title: t("tools.status"),
      dataIndex: "status",
      key: "status",
      render: (v: string | undefined) =>
        v ? (
          <Tag color={v === CONFIG_STATUS_ACTIVE ? "green" : "default"}>
            {v === CONFIG_STATUS_ACTIVE ? t("tools.statusActivated") : t("tools.statusInactive")}
          </Tag>
        ) : null,
    },
    {
      title: t("tools.actions"),
      key: "actions",
      render: () => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small">{t("tools.edit")}</Button>
          <Button size="small" danger>{t("tools.delete")}</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("tools.search")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Button type="primary">{t("tools.createConfig")}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table
          columns={columns}
          dataSource={[]}
          rowKey="id"
          size="small"
          locale={{ emptyText: t("tools.noConfig") }}
          pagination={{ pageSize: 20, showTotal: (total) => `0 / ${total}` }}
        />
      </div>
    </>
  );
}

function CallAssignView() {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const { data, isLoading } = useCallAssignments({ filter: keyword || undefined });
  const assignments = data?.items ?? [];
  const updateStatus = useUpdateCallAssignmentStatus();
  const deleteAssignment = useDeleteCallAssignment();

  const CALL_STATUS_LABELS: Record<number, string> = {
    0: t("tools.notCalled"),
    1: t("tools.called"),
    2: t("tools.noContact"),
  };

  const columns = [
    { title: t("tools.patient"),   dataIndex: "patientName",  key: "patientName" },
    { title: t("tools.phone"),     dataIndex: "phoneNumber",  key: "phoneNumber",  width: 130 },
    { title: t("tools.staff"),     dataIndex: "staffName",    key: "staffName" },
    {
      title: t("tools.status"), dataIndex: "status", key: "status", width: 150,
      render: (v: number) => {
        const label = CALL_STATUS_LABELS[v] ?? "—";
        const color = CALL_STATUS_COLORS[v] ?? "default";
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: t("tools.calledAt"), dataIndex: "calledAt", key: "calledAt", width: 140,
      render: (v: string | undefined) => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—",
    },
    { title: t("tools.notes"),     dataIndex: "notes",        key: "notes",        ellipsis: true },
    {
      title: t("tools.createdAt"), dataIndex: "creationTime", key: "creationTime", width: 120,
      render: (v: string) => dayjs(v).format("DD/MM/YYYY"),
    },
    {
      title: t("tools.actions"), key: "actions", width: 200,
      render: (_: unknown, record: CallAssignmentDto) => (
        <div style={{ display: "flex", gap: 4 }}>
          {record.status === 0 && (
            <>
              <Button size="small" type="primary"
                onClick={() => updateStatus.mutate({ id: record.id, status: 1 })}>
                {t("tools.called")}
              </Button>
              <Button size="small"
                onClick={() => updateStatus.mutate({ id: record.id, status: 2 })}>
                {t("tools.noContact")}
              </Button>
            </>
          )}
          <Popconfirm title={t("tools.deleteAssign")} onConfirm={() => deleteAssignment.mutate(record.id)}>
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
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("tools.searchPatient")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table<CallAssignmentDto>
          columns={columns}
          dataSource={assignments}
          rowKey="id"
          size="small"
          loading={isLoading}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("tools.noCallAssign")} /> }}
          pagination={{ pageSize: 20, showTotal: (total) => t("tools.totalAssigns", { total }) }}
        />
      </div>
    </>
  );
}

function CallListView() {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const { data, isLoading } = useCallLogs({ filter: keyword || undefined });
  const callLogs = data?.items ?? [];
  const deleteLog = useDeleteCallLog();

  const CALL_DIRECTION_LABELS: Record<number, string> = {
    0: t("tools.callInbound"),
    1: t("tools.callOutbound"),
  };

  const CALL_LOG_STATUS_LABELS: Record<number, string> = {
    0: t("tools.callAnswered"),
    1: t("tools.callMissed"),
    2: t("tools.callVoicemail"),
  };

  const columns = [
    {
      title: t("tools.time"), dataIndex: "creationTime", key: "creationTime", width: 140,
      render: (v: string) => dayjs(v).format("DD/MM/YYYY HH:mm"),
    },
    { title: t("tools.patient"),   dataIndex: "patientName", key: "patientName" },
    { title: t("tools.phone"),     dataIndex: "phoneNumber", key: "phoneNumber", width: 130 },
    { title: t("tools.staff"),     dataIndex: "staffName",   key: "staffName" },
    {
      title: t("tools.direction"), dataIndex: "direction", key: "direction", width: 90,
      render: (v: number) => <Tag color={CALL_DIRECTION_COLOR[v] ?? "default"}>{CALL_DIRECTION_LABELS[v] ?? "—"}</Tag>,
    },
    {
      title: t("tools.callStatus"), dataIndex: "status", key: "status", width: 100,
      render: (v: number) => {
        const label = CALL_LOG_STATUS_LABELS[v] ?? "—";
        const color = CALL_LOG_STATUS_COLORS[v] ?? "default";
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: t("tools.duration"), dataIndex: "durationSeconds", key: "durationSeconds", width: 100,
      render: (v: number) => formatDuration(v),
    },
    { title: t("tools.notes"), dataIndex: "notes", key: "notes", ellipsis: true },
    {
      title: "", key: "actions", width: 50,
      render: (_: unknown, record: CallLogDto) => (
        <Popconfirm title={t("tools.deleteCall")} onConfirm={() => deleteLog.mutate(record.id)}>
          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("tools.search")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table<CallLogDto>
          columns={columns}
          dataSource={callLogs}
          rowKey="id"
          size="small"
          loading={isLoading}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("tools.noCallLogs")} /> }}
          pagination={{ pageSize: 20, showTotal: (total) => t("tools.totalCalls", { total }) }}
        />
      </div>
    </>
  );
}

function CallView() {
  const { t } = useTranslation();
  const [sub, setSub] = useState("config");

  const CALL_SUB_TABS = [
    { key: "config", label: t("tools.config") },
    { key: "assign", label: t("tools.callAssign") },
    { key: "list",   label: t("tools.callList") },
  ];

  return (
    <>
      <SubTabBar tabs={CALL_SUB_TABS} active={sub} onChange={setSub} />
      {sub === "config" && <CallConfigView />}
      {sub === "assign" && <CallAssignView />}
      {sub === "list" && <CallListView />}
    </>
  );
}

// ── Message Template View ────────────────────────────────────────────────

function MessageTemplateView({ channel }: { channel: number }) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MessageTemplateDto | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");

  const { data, isLoading } = useMessageTemplates(channel, keyword || undefined);
  const templates = data?.items ?? [];
  const createTemplate = useCreateMessageTemplate();
  const updateTemplate = useUpdateMessageTemplate();
  const deleteTemplate = useDeleteMessageTemplate();

  const openCreate = () => {
    setEditingItem(null);
    setName("");
    setContent("");
    setCategory("");
    setModalOpen(true);
  };

  const openEdit = (item: MessageTemplateDto) => {
    setEditingItem(item);
    setName(item.name);
    setContent(item.content);
    setCategory(item.category ?? "");
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!name.trim() || !content.trim()) return;
    if (editingItem) {
      updateTemplate.mutate(
        { id: editingItem.id, data: { name: name.trim(), content: content.trim(), category: category.trim() || undefined } },
        { onSuccess: () => { setModalOpen(false); message.success(t("tools.templateUpdated")); } },
      );
    } else {
      createTemplate.mutate(
        { name: name.trim(), content: content.trim(), channel, category: category.trim() || undefined },
        { onSuccess: () => { setModalOpen(false); message.success(t("tools.templateCreated")); } },
      );
    }
  };

  const columns = [
    { title: t("tools.templateName"),   dataIndex: "name",     key: "name" },
    { title: t("tools.content"),         dataIndex: "content",  key: "content",  ellipsis: true },
    { title: t("tools.group"),           dataIndex: "category", key: "category", width: 120, render: (v: string | undefined) => v ?? "—" },
    {
      title: t("tools.templateStatus"), dataIndex: "isActive", key: "isActive", width: 100,
      render: (v: boolean) => (
        <Tag color={v ? "green" : "default"}>{v ? t("tools.statusActive") : t("tools.statusOff")}</Tag>
      ),
    },
    {
      title: t("tools.createdDate"), dataIndex: "creationTime", key: "creationTime", width: 120,
      render: (v: string) => dayjs(v).format("DD/MM/YYYY"),
    },
    {
      title: t("tools.actions"), key: "actions", width: 140,
      render: (_: unknown, record: MessageTemplateDto) => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small" onClick={() => openEdit(record)}>{t("common.edit")}</Button>
          <Popconfirm title={t("tools.deleteTemplate")} onConfirm={() => deleteTemplate.mutate(record.id)}>
            <Button size="small" danger>{t("common.delete")}</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("tools.search")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{t("tools.createTemplateBtn")}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table<MessageTemplateDto>
          columns={columns}
          dataSource={templates}
          rowKey="id"
          size="small"
          loading={isLoading}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("tools.noTemplates")} /> }}
          pagination={{ pageSize: 20, showTotal: (total) => t("tools.totalTemplates", { total }) }}
        />
      </div>

      <Modal
        title={editingItem ? t("tools.editTemplate") : t("tools.createTemplate")}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={createTemplate.isPending || updateTemplate.isPending}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            placeholder={t("tools.templateNamePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input.TextArea
            placeholder={t("tools.contentPlaceholder")}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
          />
          <Input
            placeholder={t("tools.groupPlaceholder")}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
      </Modal>
    </>
  );
}

// ── Message Log View ─────────────────────────────────────────────────────

function MessageLogView({ channel }: { channel: number }) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");
  const { data, isLoading } = useMessageLogs(channel, { filter: keyword || undefined });
  const logs = data?.items ?? [];

  const MSG_STATUS_LABELS: Record<number, string> = {
    0: t("tools.msgPending"),
    1: t("tools.msgSent"),
    2: t("tools.msgFailed"),
    3: t("tools.msgReceived"),
  };

  const columns = [
    {
      title: t("tools.time"), dataIndex: "creationTime", key: "creationTime", width: 140,
      render: (v: string) => dayjs(v).format("DD/MM/YYYY HH:mm"),
    },
    { title: t("tools.recipient"),  dataIndex: "recipientName",  key: "recipientName" },
    { title: t("tools.phone"),      dataIndex: "recipientPhone", key: "recipientPhone", width: 130 },
    { title: t("tools.content"),    dataIndex: "content",        key: "content",        ellipsis: true },
    {
      title: t("tools.status"), dataIndex: "status", key: "status", width: 100,
      render: (v: number) => {
        const label = MSG_STATUS_LABELS[v] ?? "—";
        const color = MSG_STATUS_COLORS[v] ?? "default";
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: t("tools.sentAt"), dataIndex: "sentAt", key: "sentAt", width: 140,
      render: (v: string | undefined) => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—",
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("tools.search")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table<MessageLogDto>
          columns={columns}
          dataSource={logs}
          rowKey="id"
          size="small"
          loading={isLoading}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("tools.noMessages")} /> }}
          pagination={{ pageSize: 20, showTotal: (total) => t("tools.totalMessages", { total }) }}
        />
      </div>
    </>
  );
}

// ── "Tin nhắn" views ──────────────────────────────────────────────────────

function MessageConfigView() {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");

  const columns = [
    { title: t("tools.name"),     dataIndex: "name",     key: "name" },
    { title: t("tools.provider"), dataIndex: "provider", key: "provider" },
    {
      title: t("tools.status"),
      dataIndex: "status",
      key: "status",
      render: (v: string | undefined) =>
        v ? (
          <Tag color={v === CONFIG_STATUS_ACTIVE ? "green" : "default"}>
            {v === CONFIG_STATUS_ACTIVE ? t("tools.statusActivated") : t("tools.statusInactive")}
          </Tag>
        ) : null,
    },
    {
      title: t("tools.actions"),
      key: "actions",
      render: () => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small">{t("tools.edit")}</Button>
          <Button size="small" danger>{t("tools.delete")}</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("tools.search")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Button type="primary">{t("tools.createConfig")}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table
          columns={columns}
          dataSource={[]}
          rowKey="id"
          size="small"
          locale={{ emptyText: t("tools.noConfig") }}
          pagination={{ pageSize: 20, showTotal: (total) => `0 / ${total}` }}
        />
      </div>
    </>
  );
}

function MessageView() {
  const { t } = useTranslation();
  const [sub, setSub] = useState("config");

  const MESSAGE_SUB_TABS = [
    { key: "config",    label: t("tools.config") },
    { key: "templates", label: t("tools.templates") },
    { key: "list",      label: t("tools.messageList") },
  ];

  return (
    <>
      <SubTabBar tabs={MESSAGE_SUB_TABS} active={sub} onChange={setSub} />
      {sub === "config" && <MessageConfigView />}
      {sub === "templates" && <MessageTemplateView channel={0} />}
      {sub === "list" && <MessageLogView channel={0} />}
    </>
  );
}

// ── "Zalo OA" views ───────────────────────────────────────────────────────

function ZaloConfigView() {
  const { t } = useTranslation();

  return (
    <div className="reception-card reception-card--content">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 0", gap: 16 }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "#F3F4F6",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32,
        }}>
          OA
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: "#1B2A41", marginBottom: 6 }}>
            {t("tools.zaloNotConnected")}
          </div>
          <Tag color="default" style={{ marginBottom: 16 }}>{t("tools.zaloNotActivated")}</Tag>
          <div>
            <Button type="primary" disabled>{t("tools.connectZalo")}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ZaloView() {
  const { t } = useTranslation();
  const [sub, setSub] = useState("config");

  const ZALO_SUB_TABS = [
    { key: "config",    label: t("tools.config") },
    { key: "templates", label: t("tools.zaloTemplates") },
    { key: "list",      label: t("tools.zaloMessageList") },
  ];

  return (
    <>
      <SubTabBar tabs={ZALO_SUB_TABS} active={sub} onChange={setSub} />
      {sub === "config" && <ZaloConfigView />}
      {sub === "templates" && <MessageTemplateView channel={1} />}
      {sub === "list" && <MessageLogView channel={1} />}
    </>
  );
}

// ── "Hóa đơn" view ────────────────────────────────────────────────────────

interface InvoiceConfig {
  id: string;
  nameKey: string;
  branchKey: string;
  moduleKey: string;
  provider: string;
  status: string;
}

/** Synthetic seed data — status uses CONFIG_STATUS_ACTIVE constant, not a translated label. */
const INVOICE_SEED: InvoiceConfig[] = [
  { id: "1", nameKey: "tools.invoiceSeedName1", branchKey: "tools.invoiceSeedBranch1", moduleKey: "tools.invoiceModule", provider: "MISA", status: CONFIG_STATUS_ACTIVE },
  { id: "2", nameKey: "tools.invoiceSeedName2", branchKey: "tools.invoiceSeedBranch2", moduleKey: "tools.invoiceModule", provider: "MISA", status: CONFIG_STATUS_ACTIVE },
];

function InvoiceView() {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState("");

  const INVOICE_DATA = INVOICE_SEED.map((r) => ({
    ...r,
    name: t(r.nameKey),
    branch: t(r.branchKey),
    module: t(r.moduleKey),
  }));

  const filtered = INVOICE_DATA.filter(
    (r) => r.name.toLowerCase().includes(keyword.toLowerCase()) || r.branch.toLowerCase().includes(keyword.toLowerCase()),
  );

  const columns = [
    { title: t("tools.name"),       dataIndex: "name",     key: "name" },
    { title: t("tools.branchName"), dataIndex: "branch",   key: "branch" },
    { title: t("tools.module"),     dataIndex: "module",   key: "module" },
    { title: t("tools.provider"),   dataIndex: "provider", key: "provider" },
    {
      title: t("tools.status"),
      dataIndex: "status",
      key: "status",
      render: (v: string) => (
        <Tag color={v === CONFIG_STATUS_ACTIVE ? "green" : "default"}>
          {v === CONFIG_STATUS_ACTIVE ? t("tools.statusActivated") : t("tools.statusInactive")}
        </Tag>
      ),
    },
    {
      title: t("tools.actions"),
      key: "actions",
      render: () => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small">{t("tools.edit")}</Button>
          <Button size="small" danger>{t("tools.delete")}</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--tabs">
        <button
          type="button"
          style={{
            padding: "8px 16px",
            border: "none",
            borderBottom: "2px solid #1677ff",
            background: "none",
            color: "#1677ff",
            fontWeight: 600,
            cursor: "default",
            fontSize: 13,
          }}
        >
          {t("tools.invoiceConfig")}
        </button>
      </div>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("tools.search")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Button type="primary">{t("tools.createConfig")}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          size="small"
          locale={{ emptyText: t("tools.noConfig") }}
          pagination={{ pageSize: 20, showTotal: (total) => `0 / ${total}` }}
        />
      </div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ToolsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ToolCategory>("call");

  const TOOL_TABS: { key: ToolCategory; label: string }[] = [
    { key: "call",     label: t("tools.voiceCall") },
    { key: "message",  label: t("tools.message") },
    { key: "zalo-oa",  label: t("tools.zaloOA") },
    { key: "invoice",  label: t("tools.invoice") },
  ];

  return (
    <div className="reception-page">
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 0 }}>
          {TOOL_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
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

      {activeTab === "call"     && <CallView />}
      {activeTab === "message"  && <MessageView />}
      {activeTab === "zalo-oa"  && <ZaloView />}
      {activeTab === "invoice"  && <InvoiceView />}
    </div>
  );
}
