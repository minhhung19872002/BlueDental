import { useState } from "react";
import { Table, Button, Input, Tag, Empty, Popconfirm, Modal, message } from "antd";
import { SearchOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
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

// ── Constants ──────────────────────────────────────────────────────────────

const TOOL_TABS: { key: ToolCategory; label: string }[] = [
  { key: "call",     label: "Gọi thoại" },
  { key: "message",  label: "Tin nhắn" },
  { key: "zalo-oa",  label: "Zalo OA" },
  { key: "invoice",  label: "Hóa đơn" },
];

const CALL_SUB_TABS = [
  { key: "config",    label: "Cấu Hình" },
  { key: "assign",    label: "Phân Công Gọi" },
  { key: "list",      label: "Danh Sách Cuộc Gọi" },
];

const MESSAGE_SUB_TABS = [
  { key: "config",    label: "Cấu Hình" },
  { key: "templates", label: "Mẫu Tin Nhắn" },
  { key: "list",      label: "Danh Sách Tin Nhắn" },
];

const ZALO_SUB_TABS = [
  { key: "config",    label: "Cấu Hình" },
  { key: "templates", label: "Mẫu ZBS" },
  { key: "list",      label: "Danh sách Tin Nhắn" },
];

const CALL_STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: "Chưa gọi", color: "default" },
  1: { label: "Đã gọi", color: "green" },
  2: { label: "Không liên lạc được", color: "red" },
};

const CALL_DIRECTION_MAP: Record<number, string> = {
  0: "Gọi đến",
  1: "Gọi đi",
};

const CALL_LOG_STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: "Đã nghe", color: "green" },
  1: { label: "Nhỡ", color: "red" },
  2: { label: "Hộp thư", color: "default" },
};

const MSG_STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: "Đang chờ", color: "default" },
  1: { label: "Đã gửi", color: "green" },
  2: { label: "Thất bại", color: "red" },
  3: { label: "Đã nhận", color: "blue" },
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

// ── "Gọi thoại" views ─────────────────────────────────────────────────────

function CallConfigView() {
  const [keyword, setKeyword] = useState("");

  const columns = [
    { title: "Tên", dataIndex: "name", key: "name" },
    { title: "Chi nhánh", dataIndex: "branch", key: "branch" },
    { title: "Loại cài đặt", dataIndex: "settingType", key: "settingType" },
    { title: "Nhà cung cấp", dataIndex: "provider", key: "provider" },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (v: string | undefined) =>
        v ? <Tag color={v === "Đã kích hoạt" ? "green" : "default"}>{v}</Tag> : null,
    },
    {
      title: "Thao tác",
      key: "actions",
      render: () => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small">Chỉnh sửa</Button>
          <Button size="small" danger>Xoá</Button>
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
            placeholder="Tìm kiếm..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Button type="primary">Tạo cấu hình</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table
          columns={columns}
          dataSource={[]}
          rowKey="id"
          size="small"
          locale={{ emptyText: "Chưa có cấu hình nào" }}
          pagination={{ pageSize: 20, showTotal: (total) => `Hiển thị 0 trên ${total}` }}
        />
      </div>
    </>
  );
}

function CallAssignView() {
  const [keyword, setKeyword] = useState("");
  const { data, isLoading } = useCallAssignments({ filter: keyword || undefined });
  const assignments = data?.items ?? [];
  const updateStatus = useUpdateCallAssignmentStatus();
  const deleteAssignment = useDeleteCallAssignment();

  const columns = [
    { title: "Bệnh nhân", dataIndex: "patientName", key: "patientName" },
    { title: "Số điện thoại", dataIndex: "phoneNumber", key: "phoneNumber", width: 130 },
    { title: "Nhân viên", dataIndex: "staffName", key: "staffName" },
    {
      title: "Trạng thái", dataIndex: "status", key: "status", width: 150,
      render: (v: number) => {
        const s = CALL_STATUS_MAP[v] ?? { label: "—", color: "default" };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: "Ngày gọi", dataIndex: "calledAt", key: "calledAt", width: 140,
      render: (v: string | undefined) => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—",
    },
    { title: "Ghi chú", dataIndex: "notes", key: "notes", ellipsis: true },
    {
      title: "Ngày tạo", dataIndex: "creationTime", key: "creationTime", width: 120,
      render: (v: string) => dayjs(v).format("DD/MM/YYYY"),
    },
    {
      title: "Thao tác", key: "actions", width: 200,
      render: (_: unknown, record: CallAssignmentDto) => (
        <div style={{ display: "flex", gap: 4 }}>
          {record.status === 0 && (
            <>
              <Button size="small" type="primary"
                onClick={() => updateStatus.mutate({ id: record.id, status: 1 })}>
                Đã gọi
              </Button>
              <Button size="small"
                onClick={() => updateStatus.mutate({ id: record.id, status: 2 })}>
                K.liên lạc
              </Button>
            </>
          )}
          <Popconfirm title="Xoá phân công?" onConfirm={() => deleteAssignment.mutate(record.id)}>
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
            placeholder="Tìm kiếm bệnh nhân..."
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
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có phân công gọi nào" /> }}
          pagination={{ pageSize: 20, showTotal: (total) => `${total} phân công` }}
        />
      </div>
    </>
  );
}

function CallListView() {
  const [keyword, setKeyword] = useState("");
  const { data, isLoading } = useCallLogs({ filter: keyword || undefined });
  const callLogs = data?.items ?? [];
  const deleteLog = useDeleteCallLog();

  const columns = [
    {
      title: "Thời gian", dataIndex: "creationTime", key: "creationTime", width: 140,
      render: (v: string) => dayjs(v).format("DD/MM/YYYY HH:mm"),
    },
    { title: "Bệnh nhân", dataIndex: "patientName", key: "patientName" },
    { title: "Số điện thoại", dataIndex: "phoneNumber", key: "phoneNumber", width: 130 },
    { title: "Nhân viên", dataIndex: "staffName", key: "staffName" },
    {
      title: "Chiều", dataIndex: "direction", key: "direction", width: 90,
      render: (v: number) => <Tag color={v === 1 ? "blue" : "cyan"}>{CALL_DIRECTION_MAP[v] ?? "—"}</Tag>,
    },
    {
      title: "Trạng thái", dataIndex: "status", key: "status", width: 100,
      render: (v: number) => {
        const s = CALL_LOG_STATUS_MAP[v] ?? { label: "—", color: "default" };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: "Thời lượng", dataIndex: "durationSeconds", key: "durationSeconds", width: 100,
      render: (v: number) => formatDuration(v),
    },
    { title: "Ghi chú", dataIndex: "notes", key: "notes", ellipsis: true },
    {
      title: "", key: "actions", width: 50,
      render: (_: unknown, record: CallLogDto) => (
        <Popconfirm title="Xoá?" onConfirm={() => deleteLog.mutate(record.id)}>
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
            placeholder="Tìm kiếm..."
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
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có cuộc gọi nào" /> }}
          pagination={{ pageSize: 20, showTotal: (total) => `${total} cuộc gọi` }}
        />
      </div>
    </>
  );
}

function CallView() {
  const [sub, setSub] = useState("config");

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
        { onSuccess: () => { setModalOpen(false); message.success("Đã cập nhật mẫu"); } },
      );
    } else {
      createTemplate.mutate(
        { name: name.trim(), content: content.trim(), channel, category: category.trim() || undefined },
        { onSuccess: () => { setModalOpen(false); message.success("Đã tạo mẫu"); } },
      );
    }
  };

  const columns = [
    { title: "Tên mẫu", dataIndex: "name", key: "name" },
    { title: "Nội dung", dataIndex: "content", key: "content", ellipsis: true },
    { title: "Nhóm", dataIndex: "category", key: "category", width: 120, render: (v: string | undefined) => v ?? "—" },
    {
      title: "Trạng thái", dataIndex: "isActive", key: "isActive", width: 100,
      render: (v: boolean) => <Tag color={v ? "green" : "default"}>{v ? "Hoạt động" : "Tắt"}</Tag>,
    },
    {
      title: "Ngày tạo", dataIndex: "creationTime", key: "creationTime", width: 120,
      render: (v: string) => dayjs(v).format("DD/MM/YYYY"),
    },
    {
      title: "Thao tác", key: "actions", width: 140,
      render: (_: unknown, record: MessageTemplateDto) => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small" onClick={() => openEdit(record)}>Sửa</Button>
          <Popconfirm title="Xoá mẫu?" onConfirm={() => deleteTemplate.mutate(record.id)}>
            <Button size="small" danger>Xoá</Button>
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
            placeholder="Tìm kiếm mẫu..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo mẫu</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table<MessageTemplateDto>
          columns={columns}
          dataSource={templates}
          rowKey="id"
          size="small"
          loading={isLoading}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có mẫu nào" /> }}
          pagination={{ pageSize: 20, showTotal: (total) => `${total} mẫu` }}
        />
      </div>

      <Modal
        title={editingItem ? "Sửa mẫu tin nhắn" : "Tạo mẫu tin nhắn"}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={createTemplate.isPending || updateTemplate.isPending}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Input
            placeholder="Tên mẫu"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input.TextArea
            placeholder="Nội dung mẫu (hỗ trợ biến: {patientName}, {appointmentDate}...)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
          />
          <Input
            placeholder="Nhóm (tuỳ chọn)"
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
  const [keyword, setKeyword] = useState("");
  const { data, isLoading } = useMessageLogs(channel, { filter: keyword || undefined });
  const logs = data?.items ?? [];

  const columns = [
    {
      title: "Thời gian", dataIndex: "creationTime", key: "creationTime", width: 140,
      render: (v: string) => dayjs(v).format("DD/MM/YYYY HH:mm"),
    },
    { title: "Người nhận", dataIndex: "recipientName", key: "recipientName" },
    { title: "Số điện thoại", dataIndex: "recipientPhone", key: "recipientPhone", width: 130 },
    { title: "Nội dung", dataIndex: "content", key: "content", ellipsis: true },
    {
      title: "Trạng thái", dataIndex: "status", key: "status", width: 100,
      render: (v: number) => {
        const s = MSG_STATUS_MAP[v] ?? { label: "—", color: "default" };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: "Gửi lúc", dataIndex: "sentAt", key: "sentAt", width: 140,
      render: (v: string | undefined) => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—",
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm kiếm..."
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
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có tin nhắn nào" /> }}
          pagination={{ pageSize: 20, showTotal: (total) => `${total} tin nhắn` }}
        />
      </div>
    </>
  );
}

// ── "Tin nhắn" views ──────────────────────────────────────────────────────

function MessageConfigView() {
  const [keyword, setKeyword] = useState("");

  const columns = [
    { title: "Tên", dataIndex: "name", key: "name" },
    { title: "Nhà cung cấp", dataIndex: "provider", key: "provider" },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (v: string | undefined) =>
        v ? <Tag color={v === "Đã kích hoạt" ? "green" : "default"}>{v}</Tag> : null,
    },
    {
      title: "Thao tác",
      key: "actions",
      render: () => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small">Chỉnh sửa</Button>
          <Button size="small" danger>Xoá</Button>
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
            placeholder="Tìm kiếm..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Button type="primary">Tạo cấu hình</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table
          columns={columns}
          dataSource={[]}
          rowKey="id"
          size="small"
          locale={{ emptyText: "Chưa có cấu hình nào" }}
          pagination={{ pageSize: 20, showTotal: (total) => `Hiển thị 0 trên ${total}` }}
        />
      </div>
    </>
  );
}

function MessageView() {
  const [sub, setSub] = useState("config");

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
          background: "#F3F4F6",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32,
        }}>
          OA
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: "#1B2A41", marginBottom: 6 }}>
            Chưa kết nối Zalo OA
          </div>
          <Tag color="default" style={{ marginBottom: 16 }}>Chưa kích hoạt</Tag>
          <div>
            <Button type="primary" disabled>Kết nối Zalo OA</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ZaloView() {
  const [sub, setSub] = useState("config");

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
  name: string;
  branch: string;
  module: string;
  provider: string;
  status: string;
}

const INVOICE_DATA: InvoiceConfig[] = [
  { id: "1", name: "Quang Vinh", branch: "Chi nhánh Quang Vinh", module: "Hóa đơn", provider: "MISA", status: "Đã kích hoạt" },
  { id: "2", name: "Thuế Hố Nai", branch: "Chi nhánh Hố Nai", module: "Hóa đơn", provider: "MISA", status: "Đã kích hoạt" },
];

function InvoiceView() {
  const [keyword, setKeyword] = useState("");

  const filtered = INVOICE_DATA.filter(
    (r) => r.name.toLowerCase().includes(keyword.toLowerCase()) || r.branch.toLowerCase().includes(keyword.toLowerCase()),
  );

  const columns = [
    { title: "Tên", dataIndex: "name", key: "name" },
    { title: "Tên chi nhánh", dataIndex: "branch", key: "branch" },
    { title: "Mô đun", dataIndex: "module", key: "module" },
    { title: "Nhà cung cấp", dataIndex: "provider", key: "provider" },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (v: string) => <Tag color="green">{v}</Tag>,
    },
    {
      title: "Thao tác",
      key: "actions",
      render: () => (
        <div style={{ display: "flex", gap: 6 }}>
          <Button size="small">Chỉnh sửa</Button>
          <Button size="small" danger>Xoá</Button>
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
          Cấu Hình
        </button>
      </div>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm kiếm..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Button type="primary">Tạo cấu hình</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          size="small"
          locale={{ emptyText: "Chưa có cấu hình nào" }}
          pagination={{ pageSize: 20, showTotal: (total) => `Hiển thị 0 trên ${total}` }}
        />
      </div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ToolsPage() {
  const [activeTab, setActiveTab] = useState<ToolCategory>("call");

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
