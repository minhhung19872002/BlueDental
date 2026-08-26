import { useState } from "react";
import { toast } from "sonner";
import { Table, Button, Input, Tag, Empty, Modal } from "antd";
import { SearchOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { PageHeader } from "@/components/PageHeader";
import {
  useCallAssignments, useUpdateCallAssignmentStatus, useDeleteCallAssignment,
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
    <div className="pill-tabs" role="tablist" style={{ marginBottom: 4 }}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={tab.key === active}
          className={`pill-tab${tab.key === active ? " pill-tab--active" : ""}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}p ${s}s` : `${s}s`;
}

// ── Config status constant ─────────────────────────────────────────────────

// ── "Gọi thoại" views ─────────────────────────────────────────────────────

/**
 * The three integration-config screens — phone system, messaging, e-invoice —
 * have no endpoint behind them. They used to draw a search box that filtered
 * nothing, a "Tạo cấu hình" button with no handler, and edit/delete actions
 * that could never run; the e-invoice one went further and listed two seeded
 * rows as active MISA integrations, which is not something a clinic should
 * read on its own screen. Until there is an API, they say so.
 */
function ConfigNotAvailable({ what }: { what: string }) {
  return (
    <div className="reception-card reception-card--content">
      <div className="tools-empty">
        <div className="tools-empty-title">{t("Chưa có cấu hình {0}", what)}</div>
        <p className="tools-empty-body">
          {t("Phần cấu hình này chưa kết nối với hệ thống. Liên hệ quản trị viên để bật tích hợp.")}
        </p>
      </div>
    </div>
  );
}

function CallConfigView() {
  return <ConfigNotAvailable what={t("tổng đài")} />;
}

function CallAssignView() {
  const [keyword, setKeyword] = useState("");
  const [pendingDelete, setPendingDelete] = useState<CallAssignmentDto | null>(null);
  const { data, isLoading } = useCallAssignments({ filter: keyword || undefined });
  const assignments = data?.items ?? [];
  const updateStatus = useUpdateCallAssignmentStatus();
  const deleteAssignment = useDeleteCallAssignment();

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteAssignment.mutateAsync(pendingDelete.id);
    } catch {
      // Global MutationCache.onError already shows the toast
    } finally {
      setPendingDelete(null);
    }
  };

  const CALL_STATUS_LABELS: Record<number, string> = {
    0: t("Chưa gọi"),
    1: t("Đã gọi"),
    2: t("Không liên hệ được"),
  };

  const columns = [
    { title: t("Khách hàng"),   dataIndex: "patientName",  key: "patientName" },
    { title: t("Số điện thoại"),     dataIndex: "phoneNumber",  key: "phoneNumber",  width: 130 },
    { title: t("Nhân viên"),     dataIndex: "staffName",    key: "staffName" },
    {
      title: t("Trạng thái"), dataIndex: "status", key: "status", width: 150,
      render: (v: number) => {
        const label = CALL_STATUS_LABELS[v] ?? "—";
        const color = CALL_STATUS_COLORS[v] ?? "default";
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: t("Thời điểm gọi"), dataIndex: "calledAt", key: "calledAt", width: 140,
      render: (v: string | undefined) => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—",
    },
    { title: t("Ghi chú"),     dataIndex: "notes",        key: "notes",        ellipsis: true },
    {
      title: t("Thời điểm tạo"), dataIndex: "creationTime", key: "creationTime", width: 120,
      render: (v: string) => dayjs(v).format("DD/MM/YYYY"),
    },
    {
      title: t("Thao tác"), key: "actions", width: 200,
      render: (_: unknown, record: CallAssignmentDto) => (
        <div style={{ display: "flex", gap: 4 }}>
          {record.status === 0 && (
            <>
              <Button size="small" type="primary"
                onClick={() => updateStatus.mutate({ id: record.id, status: 1 })}>
                {t("Đã gọi")}
              </Button>
              <Button size="small"
                onClick={() => updateStatus.mutate({ id: record.id, status: 2 })}>
                {t("Không liên hệ được")}
              </Button>
            </>
          )}
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setPendingDelete(record)} />
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
            placeholder={t("Tìm kiếm bệnh nhân...")}
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
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Chưa có phân công cuộc gọi")} /> }}
          pagination={{ pageSize: 20, showTotal: (total) => t("Tổng phân công: {0}", total) }}
        />
      </div>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={t("phân công")}
        name={pendingDelete?.patientName ?? ""}
        pending={deleteAssignment.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}

function CallListView() {
  const [keyword, setKeyword] = useState("");
  const [pendingDelete, setPendingDelete] = useState<CallLogDto | null>(null);
  const { data, isLoading } = useCallLogs({ filter: keyword || undefined });
  const callLogs = data?.items ?? [];
  const deleteLog = useDeleteCallLog();

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteLog.mutateAsync(pendingDelete.id);
    } catch {
      // Global MutationCache.onError already shows the toast
    } finally {
      setPendingDelete(null);
    }
  };

  const CALL_DIRECTION_LABELS: Record<number, string> = {
    0: t("Gọi đến"),
    1: t("Gọi đi"),
  };

  const CALL_LOG_STATUS_LABELS: Record<number, string> = {
    0: t("Đã nghe"),
    1: t("Nhỡ"),
    2: t("Hộp thư"),
  };

  const columns = [
    {
      title: t("Thời gian"), dataIndex: "creationTime", key: "creationTime", width: 140,
      render: (v: string) => dayjs(v).format("DD/MM/YYYY HH:mm"),
    },
    { title: t("Khách hàng"),   dataIndex: "patientName", key: "patientName" },
    { title: t("Số điện thoại"),     dataIndex: "phoneNumber", key: "phoneNumber", width: 130 },
    { title: t("Nhân viên"),     dataIndex: "staffName",   key: "staffName" },
    {
      title: t("Chiều gọi"), dataIndex: "direction", key: "direction", width: 90,
      render: (v: number) => <Tag color={CALL_DIRECTION_COLOR[v] ?? "default"}>{CALL_DIRECTION_LABELS[v] ?? "—"}</Tag>,
    },
    {
      title: t("Trạng thái cuộc gọi"), dataIndex: "status", key: "status", width: 100,
      render: (v: number) => {
        const label = CALL_LOG_STATUS_LABELS[v] ?? "—";
        const color = CALL_LOG_STATUS_COLORS[v] ?? "default";
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: t("Thời lượng"), dataIndex: "durationSeconds", key: "durationSeconds", width: 100,
      render: (v: number) => formatDuration(v),
    },
    { title: t("Ghi chú"), dataIndex: "notes", key: "notes", ellipsis: true },
    {
      title: "", key: "actions", width: 50,
      render: (_: unknown, record: CallLogDto) => (
        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => setPendingDelete(record)} />
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("Tìm kiếm")}
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
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Chưa có cuộc gọi nào")} /> }}
          pagination={{ pageSize: 20, showTotal: (total) => t("Tổng cuộc gọi: {0}", total) }}
        />
      </div>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={t("cuộc gọi")}
        name={pendingDelete?.patientName ?? ""}
        pending={deleteLog.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}

function CallView() {
  const [sub, setSub] = useState("config");

  const CALL_SUB_TABS = [
    { key: "config", label: t("Cấu Hình") },
    { key: "assign", label: t("Phân công cuộc gọi") },
    { key: "list",   label: t("Danh Sách Cuộc Gọi") },
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
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MessageTemplateDto | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MessageTemplateDto | null>(null);
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
        { onSuccess: () => { setModalOpen(false); toast.success(t("Đã cập nhật mẫu tin")); } },
      );
    } else {
      createTemplate.mutate(
        { name: name.trim(), content: content.trim(), channel, category: category.trim() || undefined },
        { onSuccess: () => { setModalOpen(false); toast.success(t("Đã tạo mẫu tin")); } },
      );
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteTemplate.mutateAsync(pendingDelete.id);
    } catch {
      // Global MutationCache.onError already shows the toast
    } finally {
      setPendingDelete(null);
    }
  };

  const columns = [
    { title: t("Tên mẫu"),   dataIndex: "name",     key: "name" },
    { title: t("Nội dung"),         dataIndex: "content",  key: "content",  ellipsis: true },
    { title: t("Nhóm"),           dataIndex: "category", key: "category", width: 120, render: (v: string | undefined) => v ?? "—" },
    {
      title: t("Trạng thái"), dataIndex: "isActive", key: "isActive", width: 100,
      render: (v: boolean) => (
        <Tag color={v ? "green" : "default"}>{v ? t("Hoạt động") : t("Tắt")}</Tag>
      ),
    },
    {
      title: t("Ngày tạo"), dataIndex: "creationTime", key: "creationTime", width: 120,
      render: (v: string) => dayjs(v).format("DD/MM/YYYY"),
    },
    {
      title: t("Thao tác"), key: "actions", width: 140,
      render: (_: unknown, record: MessageTemplateDto) => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small" onClick={() => openEdit(record)}>{t("Chỉnh sửa")}</Button>
          <Button size="small" danger onClick={() => setPendingDelete(record)}>{t("Xóa")}</Button>
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
            placeholder={t("Tìm kiếm")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{t("Tạo mẫu tin")}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table<MessageTemplateDto>
          columns={columns}
          dataSource={templates}
          rowKey="id"
          size="small"
          loading={isLoading}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Chưa có mẫu nào")} /> }}
          pagination={{ pageSize: 20, showTotal: (total) => t("Tổng mẫu tin: {0}", total) }}
        />
      </div>

      <Modal
        title={editingItem ? t("Sửa mẫu tin nhắn") : t("Tạo mẫu")}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={createTemplate.isPending || updateTemplate.isPending}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            placeholder={t("Tên mẫu")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input.TextArea
            placeholder={t("Nhập nội dung")}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
          />
          <Input
            placeholder={t("Chọn nhóm")}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>
      </Modal>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={t("mẫu tin")}
        name={pendingDelete?.name ?? ""}
        pending={deleteTemplate.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </>
  );
}

// ── Message Log View ─────────────────────────────────────────────────────

function MessageLogView({ channel }: { channel: number }) {
  const [keyword, setKeyword] = useState("");
  const { data, isLoading } = useMessageLogs(channel, { filter: keyword || undefined });
  const logs = data?.items ?? [];

  const MSG_STATUS_LABELS: Record<number, string> = {
    0: t("Đang chờ"),
    1: t("Đã gửi"),
    2: t("Thất bại"),
    3: t("Đã nhận"),
  };

  const columns = [
    {
      title: t("Thời gian"), dataIndex: "creationTime", key: "creationTime", width: 140,
      render: (v: string) => dayjs(v).format("DD/MM/YYYY HH:mm"),
    },
    { title: t("Người nhận"),  dataIndex: "recipientName",  key: "recipientName" },
    { title: t("Số điện thoại"),      dataIndex: "recipientPhone", key: "recipientPhone", width: 130 },
    { title: t("Nội dung"),    dataIndex: "content",        key: "content",        ellipsis: true },
    {
      title: t("Trạng thái"), dataIndex: "status", key: "status", width: 100,
      render: (v: number) => {
        const label = MSG_STATUS_LABELS[v] ?? "—";
        const color = MSG_STATUS_COLORS[v] ?? "default";
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: t("Thời điểm gửi"), dataIndex: "sentAt", key: "sentAt", width: 140,
      render: (v: string | undefined) => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—",
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("Tìm kiếm")}
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
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Chưa có tin nhắn nào")} /> }}
          pagination={{ pageSize: 20, showTotal: (total) => t("Tổng tin nhắn: {0}", total) }}
        />
      </div>
    </>
  );
}

// ── "Tin nhắn" views ──────────────────────────────────────────────────────

function MessageConfigView() {
  return <ConfigNotAvailable what={t("tin nhắn")} />;
}

function MessageView() {
  const [sub, setSub] = useState("config");

  const MESSAGE_SUB_TABS = [
    { key: "config",    label: t("Cấu Hình") },
    { key: "templates", label: t("Mẫu Tin Nhắn") },
    { key: "list",      label: t("Danh Sách Tin Nhắn") },
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

  return (
    <div className="reception-card reception-card--content">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 0", gap: 16 }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "var(--bd-bg)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32,
        }}>
          OA
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: "var(--bd-ink)", marginBottom: 6 }}>
            {t("Chưa kết nối Zalo OA")}
          </div>
          <Tag color="default" style={{ marginBottom: 16 }}>{t("Chưa kích hoạt")}</Tag>
          <div>
            <Button type="primary" disabled>{t("Kết nối Zalo OA")}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ZaloView() {
  const [sub, setSub] = useState("config");

  const ZALO_SUB_TABS = [
    { key: "config",    label: t("Cấu Hình") },
    { key: "templates", label: t("Mẫu ZBS") },
    { key: "list",      label: t("Danh sách tin Zalo") },
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

function InvoiceView() {
  return <ConfigNotAvailable what={t("hoá đơn điện tử")} />;
}

// ── Main component ─────────────────────────────────────────────────────────

export function ToolsPage() {
  const [activeTab, setActiveTab] = useState<ToolCategory>("call");

  const TOOL_TABS: { key: ToolCategory; label: string }[] = [
    { key: "call",     label: t("Tổng đài") },
    { key: "message",  label: t("Tin nhắn") },
    { key: "zalo-oa",  label: t("Zalo OA") },
    { key: "invoice",  label: t("Hóa đơn") },
  ];

  return (
    <div className="reception-page">
      <PageHeader
        title={t("Công cụ")}
        subtitle={t("Tổng đài, tin nhắn, Zalo OA và hoá đơn điện tử")}
      />

      <div className="pill-tabs" role="tablist" style={{ marginBottom: 4 }}>
        {TOOL_TABS.map((tab) => (
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

      {activeTab === "call"     && <CallView />}
      {activeTab === "message"  && <MessageView />}
      {activeTab === "zalo-oa"  && <ZaloView />}
      {activeTab === "invoice"  && <InvoiceView />}
    </div>
  );
}
