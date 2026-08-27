import { useState } from "react";
import { toast } from "sonner";
import { Button, Empty, Input, Modal, Table, Tag } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  useCreateMessageTemplate,
  useDeleteMessageTemplate,
  useMessageTemplates,
  useUpdateMessageTemplate,
  type MessageTemplateDto,
} from "../api/toolsApi";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { t } from "@/lib/i18n";

const MSG_TEMPLATE_STATUS_COLORS: Record<string, string> = {
  active: "green",
  inactive: "default",
};

/** Mẫu tin nhắn / Mẫu ZBS — shared by Tin nhắn (channel 0) and Zalo (1). */
export function MessageTemplateView({ channel }: { channel: number }) {
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
    { title: t("Tên mẫu"), dataIndex: "name", key: "name" },
    { title: t("Nội dung"), dataIndex: "content", key: "content", ellipsis: true },
    { title: t("Nhóm"), dataIndex: "category", key: "category", width: 120, render: (v: string | undefined) => v ?? "—" },
    {
      title: t("Trạng thái"), dataIndex: "isActive", key: "isActive", width: 100,
      render: (v: boolean) => (
        <Tag color={MSG_TEMPLATE_STATUS_COLORS[v ? "active" : "inactive"]}>
          {v ? t("Hoạt động") : t("Tắt")}
        </Tag>
      ),
    },
    {
      title: t("Ngày tạo"), dataIndex: "creationTime", key: "creationTime", width: 120,
      render: (v: string) => dayjs(v).format("DD/MM/YYYY"),
    },
    {
      title: t("Thao tác"), key: "actions", width: 140,
      render: (_: unknown, record: MessageTemplateDto) => (
        <div className="bd-cat-rowactions">
          <Button size="small" onClick={() => openEdit(record)}>{t("Chỉnh sửa")}</Button>
          <Button size="small" danger onClick={() => setPendingDelete(record)}>{t("Xóa")}</Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div className="bd-ops-toolbar">
          <Input
            className="bd-ops-search"
            prefix={<SearchOutlined />}
            placeholder={t("Tìm kiếm")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            allowClear
          />
          <Button className="bd-tools-toolbar-end" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t("Tạo mẫu tin")}
          </Button>
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
        <div className="bd-dialog-stack">
          <Input placeholder={t("Tên mẫu")} value={name} onChange={(e) => setName(e.target.value)} />
          <Input.TextArea
            placeholder={t("Nhập nội dung")}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
          />
          <Input placeholder={t("Chọn nhóm")} value={category} onChange={(e) => setCategory(e.target.value)} />
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
