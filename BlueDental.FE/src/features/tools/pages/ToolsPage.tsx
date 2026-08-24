import { useState } from "react";
import { Search, Plus, Trash2 } from "lucide-react";
import dayjs from "dayjs";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import {
  useCallAssignments, useUpdateCallAssignmentStatus, useDeleteCallAssignment,
  useCallLogs, useDeleteCallLog,
  useMessageTemplates, useCreateMessageTemplate, useUpdateMessageTemplate, useDeleteMessageTemplate,
  useMessageLogs,
  type CallAssignmentDto, type CallLogDto,
  type MessageTemplateDto, type MessageLogDto,
} from "../api/toolsApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ── Types ──────────────────────────────────────────────────────────────────

type ToolCategory = "call" | "message" | "zalo-oa" | "invoice";

// ── Status badge colors ─────────────────────────────────────────────────────

const CALL_STATUS_STYLES: Record<number, { bg: string; color: string }> = {
  0: { bg: "#f3f4f6", color: "#374151" },
  1: { bg: "#dcfce7", color: "#15803d" },
  2: { bg: "#fee2e2", color: "#b91c1c" },
};

const CALL_DIRECTION_STYLES: Record<number, { bg: string; color: string }> = {
  0: { bg: "#cffafe", color: "#0e7490" },
  1: { bg: "#dbeafe", color: "#1d4ed8" },
};

const CALL_LOG_STATUS_STYLES: Record<number, { bg: string; color: string }> = {
  0: { bg: "#dcfce7", color: "#15803d" },
  1: { bg: "#fee2e2", color: "#b91c1c" },
  2: { bg: "#f3f4f6", color: "#374151" },
};

const MSG_STATUS_STYLES: Record<number, { bg: string; color: string }> = {
  0: { bg: "#f3f4f6", color: "#374151" },
  1: { bg: "#dcfce7", color: "#15803d" },
  2: { bg: "#fee2e2", color: "#b91c1c" },
  3: { bg: "#dbeafe", color: "#1d4ed8" },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function StatusBadge({ style, label }: { style: { bg: string; color: string }; label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: style.bg, color: style.color }}
    >
      {label}
    </span>
  );
}

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
      <PageHeader
        title={t("Công cụ")}
        subtitle={t("Tổng đài, tin nhắn, Zalo OA và hoá đơn điện tử")}
      />

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

// UNKNOWN_REFERENCE_BEHAVIOR: The exact enum/string value used for the
// "activated" status in the call/message config API is not confirmed.
// Using "active" as a placeholder; adjust to match backend contract.
const CONFIG_STATUS_ACTIVE = "active";

// ── "Gọi thoại" views ─────────────────────────────────────────────────────

function CallConfigView() {
  const [keyword, setKeyword] = useState("");

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 w-64"
              placeholder={t("Tìm kiếm")}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <Button>{t("Tạo cấu hình")}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <div className="py-8 text-center text-muted-foreground">{t("Chưa có cấu hình nào")}</div>
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

  const CALL_STATUS_LABELS: Record<number, string> = {
    0: t("Chưa gọi"),
    1: t("Đã gọi"),
    2: t("Không liên hệ được"),
  };

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 w-64"
            placeholder={t("Tìm kiếm bệnh nhân...")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
      </div>
      <div className="reception-card reception-card--content overflow-x-auto">
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">{t("Đang tải...")}</div>
        ) : assignments.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">{t("Chưa có phân công cuộc gọi")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Khách hàng")}</TableHead>
                <TableHead className="w-32">{t("Số điện thoại")}</TableHead>
                <TableHead>{t("Nhân viên")}</TableHead>
                <TableHead className="w-36">{t("Trạng thái")}</TableHead>
                <TableHead className="w-36">{t("Thời điểm gọi")}</TableHead>
                <TableHead>{t("Ghi chú")}</TableHead>
                <TableHead className="w-28">{t("Thời điểm tạo")}</TableHead>
                <TableHead className="w-48">{t("Thao tác")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((record: CallAssignmentDto) => (
                <TableRow key={record.id}>
                  <TableCell>{record.patientName}</TableCell>
                  <TableCell>{record.phoneNumber}</TableCell>
                  <TableCell>{record.staffName}</TableCell>
                  <TableCell>
                    <StatusBadge
                      style={CALL_STATUS_STYLES[record.status] ?? CALL_STATUS_STYLES[0]}
                      label={CALL_STATUS_LABELS[record.status] ?? "—"}
                    />
                  </TableCell>
                  <TableCell>{record.calledAt ? dayjs(record.calledAt).format("DD/MM/YYYY HH:mm") : "—"}</TableCell>
                  <TableCell className="max-w-xs truncate">{record.notes}</TableCell>
                  <TableCell>{dayjs(record.creationTime).format("DD/MM/YYYY")}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {record.status === 0 && (
                        <>
                          <Button size="sm" onClick={() => updateStatus.mutate({ id: record.id, status: 1 })}>
                            {t("Đã gọi")}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: record.id, status: 2 })}>
                            {t("Không liên hệ được")}
                          </Button>
                        </>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive"><Trash2 size={14} /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("Xoá phân công?")}</AlertDialogTitle>
                            <AlertDialogDescription>{record.patientName}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("Huỷ")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteAssignment.mutate(record.id)}>
                              {t("Xoá")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}

function CallListView() {
  const [keyword, setKeyword] = useState("");
  const { data, isLoading } = useCallLogs({ filter: keyword || undefined });
  const callLogs = data?.items ?? [];
  const deleteLog = useDeleteCallLog();

  const CALL_DIRECTION_LABELS: Record<number, string> = {
    0: t("Gọi đến"),
    1: t("Gọi đi"),
  };

  const CALL_LOG_STATUS_LABELS: Record<number, string> = {
    0: t("Đã nghe"),
    1: t("Nhỡ"),
    2: t("Hộp thư"),
  };

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 w-64"
            placeholder={t("Tìm kiếm")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
      </div>
      <div className="reception-card reception-card--content overflow-x-auto">
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">{t("Đang tải...")}</div>
        ) : callLogs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">{t("Chưa có cuộc gọi nào")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">{t("Thời gian")}</TableHead>
                <TableHead>{t("Khách hàng")}</TableHead>
                <TableHead className="w-32">{t("Số điện thoại")}</TableHead>
                <TableHead>{t("Nhân viên")}</TableHead>
                <TableHead className="w-24">{t("Chiều gọi")}</TableHead>
                <TableHead className="w-28">{t("Trạng thái cuộc gọi")}</TableHead>
                <TableHead className="w-24">{t("Thời lượng")}</TableHead>
                <TableHead>{t("Ghi chú")}</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {callLogs.map((record: CallLogDto) => (
                <TableRow key={record.id}>
                  <TableCell>{dayjs(record.creationTime).format("DD/MM/YYYY HH:mm")}</TableCell>
                  <TableCell>{record.patientName}</TableCell>
                  <TableCell>{record.phoneNumber}</TableCell>
                  <TableCell>{record.staffName}</TableCell>
                  <TableCell>
                    <StatusBadge
                      style={CALL_DIRECTION_STYLES[record.direction] ?? CALL_DIRECTION_STYLES[0]}
                      label={CALL_DIRECTION_LABELS[record.direction] ?? "—"}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      style={CALL_LOG_STATUS_STYLES[record.status] ?? CALL_LOG_STATUS_STYLES[0]}
                      label={CALL_LOG_STATUS_LABELS[record.status] ?? "—"}
                    />
                  </TableCell>
                  <TableCell>{formatDuration(record.durationSeconds)}</TableCell>
                  <TableCell className="max-w-xs truncate">{record.notes}</TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-destructive">
                          <Trash2 size={14} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("Xoá cuộc gọi")}</AlertDialogTitle>
                          <AlertDialogDescription>{record.patientName}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("Huỷ")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteLog.mutate(record.id)}>
                            {t("Xoá")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
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

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 w-64"
              placeholder={t("Tìm kiếm")}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <Button onClick={openCreate}>
            <Plus size={14} className="mr-1" />
            {t("Tạo mẫu tin")}
          </Button>
        </div>
      </div>
      <div className="reception-card reception-card--content overflow-x-auto">
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">{t("Đang tải...")}</div>
        ) : templates.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">{t("Chưa có mẫu nào")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Tên mẫu")}</TableHead>
                <TableHead>{t("Nội dung")}</TableHead>
                <TableHead className="w-28">{t("Nhóm")}</TableHead>
                <TableHead className="w-24">{t("Trạng thái")}</TableHead>
                <TableHead className="w-28">{t("Ngày tạo")}</TableHead>
                <TableHead className="w-36">{t("Thao tác")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((record: MessageTemplateDto) => (
                <TableRow key={record.id}>
                  <TableCell>{record.name}</TableCell>
                  <TableCell className="max-w-xs truncate">{record.content}</TableCell>
                  <TableCell>{record.category ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge
                      style={record.isActive ? { bg: "#dcfce7", color: "#15803d" } : { bg: "#f3f4f6", color: "#374151" }}
                      label={record.isActive ? t("Hoạt động") : t("Tắt")}
                    />
                  </TableCell>
                  <TableCell>{dayjs(record.creationTime).format("DD/MM/YYYY")}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(record)}>{t("Chỉnh sửa")}</Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">{t("Xóa")}</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("Xoá mẫu?")}</AlertDialogTitle>
                            <AlertDialogDescription>{record.name}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("Huỷ")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteTemplate.mutate(record.id)}>
                              {t("Xoá")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) setModalOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? t("Sửa mẫu tin nhắn") : t("Tạo mẫu")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input placeholder={t("Tên mẫu")} value={name} onChange={(e) => setName(e.target.value)} />
            <textarea
              className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder={t("Nhập nội dung")}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
            />
            <Input placeholder={t("Chọn nhóm")} value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>{t("Huỷ")}</Button>
            <Button onClick={handleSave} disabled={createTemplate.isPending || updateTemplate.isPending}>
              {t("Lưu")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 w-64"
            placeholder={t("Tìm kiếm")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
      </div>
      <div className="reception-card reception-card--content overflow-x-auto">
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">{t("Đang tải...")}</div>
        ) : logs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">{t("Chưa có tin nhắn nào")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">{t("Thời gian")}</TableHead>
                <TableHead>{t("Người nhận")}</TableHead>
                <TableHead className="w-32">{t("Số điện thoại")}</TableHead>
                <TableHead>{t("Nội dung")}</TableHead>
                <TableHead className="w-24">{t("Trạng thái")}</TableHead>
                <TableHead className="w-36">{t("Thời điểm gửi")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((record: MessageLogDto) => (
                <TableRow key={record.id}>
                  <TableCell>{dayjs(record.creationTime).format("DD/MM/YYYY HH:mm")}</TableCell>
                  <TableCell>{record.recipientName}</TableCell>
                  <TableCell>{record.recipientPhone}</TableCell>
                  <TableCell className="max-w-xs truncate">{record.content}</TableCell>
                  <TableCell>
                    <StatusBadge
                      style={MSG_STATUS_STYLES[record.status] ?? MSG_STATUS_STYLES[0]}
                      label={MSG_STATUS_LABELS[record.status] ?? "—"}
                    />
                  </TableCell>
                  <TableCell>{record.sentAt ? dayjs(record.sentAt).format("DD/MM/YYYY HH:mm") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}

// ── "Tin nhắn" views ──────────────────────────────────────────────────────

function MessageConfigView() {
  const [keyword, setKeyword] = useState("");

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 w-64"
              placeholder={t("Tìm kiếm")}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <Button>{t("Tạo cấu hình")}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        <div className="py-8 text-center text-muted-foreground">{t("Chưa có cấu hình nào")}</div>
      </div>
    </>
  );
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
          background: "#F3F4F6",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32,
        }}>
          OA
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: "#1B2A41", marginBottom: 6 }}>
            {t("Chưa kết nối Zalo OA")}
          </div>
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 mb-4"
            style={{ marginBottom: 16, display: "inline-flex" }}
          >
            {t("Chưa kích hoạt")}
          </span>
          <div>
            <Button disabled>{t("Kết nối Zalo OA")}</Button>
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
  { id: "1", nameKey: "Quang Vinh", branchKey: "Chi nhánh Quang Vinh", moduleKey: "Hóa đơn", provider: "MISA", status: CONFIG_STATUS_ACTIVE },
  { id: "2", nameKey: "Thuế Hố Nai", branchKey: "Chi nhánh Hố Nai", moduleKey: "Hóa đơn", provider: "MISA", status: CONFIG_STATUS_ACTIVE },
];

function InvoiceView() {
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
          {t("Cấu Hình")}
        </button>
      </div>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 w-64"
              placeholder={t("Tìm kiếm")}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <Button>{t("Tạo cấu hình")}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">{t("Chưa có cấu hình nào")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Tên")}</TableHead>
                <TableHead>{t("Tên chi nhánh")}</TableHead>
                <TableHead>{t("Phân hệ")}</TableHead>
                <TableHead>{t("Nhà cung cấp")}</TableHead>
                <TableHead className="w-28">{t("Trạng thái")}</TableHead>
                <TableHead className="w-36">{t("Thao tác")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.branch}</TableCell>
                  <TableCell>{r.module}</TableCell>
                  <TableCell>{r.provider}</TableCell>
                  <TableCell>
                    <StatusBadge
                      style={r.status === CONFIG_STATUS_ACTIVE ? { bg: "#dcfce7", color: "#15803d" } : { bg: "#f3f4f6", color: "#374151" }}
                      label={r.status === CONFIG_STATUS_ACTIVE ? t("Đã kích hoạt") : t("Chưa kích hoạt")}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline">{t("Chỉnh sửa")}</Button>
                      <Button size="sm" variant="destructive">{t("Xoá")}</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
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
