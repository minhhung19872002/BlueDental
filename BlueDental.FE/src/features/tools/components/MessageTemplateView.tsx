import { useEffect, useMemo, useState } from "react";
import { Button, Form, Input, Switch, Tag, Tooltip } from "antd";
import { toast } from "sonner";
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  useCreateMessageTemplate,
  useDeleteMessageTemplate,
  useMessageTemplates,
  useUpdateMessageTemplate,
  type MessageTemplateDto,
} from "../api/toolsApi";
import { activeTag } from "./callCatalog";
import { AppDialog } from "@/components/AppDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { FloatingField } from "@/components/FloatingField";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { pagerTotal } from "@/utils/pagerTotal";

interface DialogProps {
  open: boolean;
  template: MessageTemplateDto | null;
  channel: number;
  onClose: () => void;
}

interface FormValues {
  name: string;
  content: string;
  isActive: boolean;
}

function MessageTemplateDialog({ open, template, channel, onClose }: DialogProps) {
  const createTemplate = useCreateMessageTemplate();
  const updateTemplate = useUpdateMessageTemplate();
  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";
  const content = Form.useWatch("content", form) ?? "";

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      name: template?.name ?? "",
      content: template?.content ?? "",
      isActive: template?.isActive ?? true,
    });
  }, [open, template, form]);

  const pending = createTemplate.isPending || updateTemplate.isPending;

  const submit = async (values: FormValues) => {
    try {
      if (template) {
        await updateTemplate.mutateAsync({
          id: template.id,
          data: { name: values.name.trim(), content: values.content.trim() },
        });
        toast.success(t("Đã cập nhật mẫu tin"));
      } else {
        await createTemplate.mutateAsync({
          name: values.name.trim(),
          content: values.content.trim(),
          channel,
        });
        toast.success(t("Đã tạo mẫu tin"));
      }
      onClose();
    } catch {
      // queryClient reports the failure
    }
  };

  const canSave = name.trim().length > 0 && content.trim().length > 0;

  return (
    <AppDialog
      open={open}
      title={template ? t("Sửa mẫu tin nhắn") : t("Tạo mẫu tin nhắn")}
      width={560}
      canSave={canSave}
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ name: "", content: "", isActive: true }}
        onFinish={(values) => void submit(values)}
      >
        <div className="bd-call-dialog-fields">
          <FloatingField name="name" label={t("Tên")} required rules={[{ required: true, message: t("Vui lòng nhập tên") }]}>
            <Input autoFocus />
          </FloatingField>

          <FloatingField name="content" label={t("Nội dung")} required rules={[{ required: true, message: t("Vui lòng nhập nội dung") }]}>
            <Input.TextArea rows={4} />
          </FloatingField>

          <div className="bd-call-dialog-switch">
            <span>{t("Trạng thái")}</span>
            <Form.Item name="isActive" valuePropName="checked">
              <Switch aria-label={t("Trạng thái")} />
            </Form.Item>
          </div>
        </div>
      </Form>
    </AppDialog>
  );
}

/** Mẫu tin nhắn / Mẫu ZBS — shared by Tin nhắn (channel 0) and Zalo (1). */
export function MessageTemplateView({ channel }: { channel: number }) {
  const [keyword, setKeyword] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; template: MessageTemplateDto | null }>({
    open: false,
    template: null,
  });
  const [pendingDelete, setPendingDelete] = useState<MessageTemplateDto | null>(null);

  const pagination = useTablePagination();
  const debouncedKeyword = useDebounce(keyword, 300);

  const { data, isFetching } = useMessageTemplates(channel, debouncedKeyword.trim() || undefined);
  const deleteTemplate = useDeleteMessageTemplate();

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteTemplate.mutateAsync(pendingDelete.id);
      toast.success(t("Đã xoá mẫu tin"));
    } catch {
      // queryClient reports the failure
    } finally {
      setPendingDelete(null);
    }
  };

  const columns = useMemo<ColumnsType<MessageTemplateDto>>(
    () => [
      { key: "name", title: t("Tên"), dataIndex: "name" },
      { key: "content", title: t("Nội dung"), dataIndex: "content", ellipsis: true },
      {
        key: "status",
        title: t("Trạng thái"),
        width: 130,
        render: (_, tpl) => {
          const { label, color } = activeTag(tpl.isActive);
          return <Tag color={color}>{label}</Tag>;
        },
      },
      {
        key: "actions",
        title: t("Thao tác"),
        width: 110,
        align: "center",
        render: (_, tpl) => (
          <div className="bd-cat-rowactions">
            <Tooltip title={t("Chỉnh sửa")}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                aria-label={t("Chỉnh sửa {0}", tpl.name)}
                onClick={() => setDialog({ open: true, template: tpl })}
              />
            </Tooltip>
            <Tooltip title={t("Xoá")}>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label={t("Xoá {0}", tpl.name)}
                onClick={() => setPendingDelete(tpl)}
              />
            </Tooltip>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="reception-card reception-card--content">
      <div className="bd-ops-toolbar">
        <Input
          className="bd-ops-search"
          prefix={<SearchOutlined />}
          placeholder={t("Tìm kiếm")}
          aria-label={t("Tìm kiếm")}
          value={keyword}
          allowClear
          onChange={(e) => {
            setKeyword(e.target.value);
            pagination.resetToFirstPage();
          }}
        />
        <Button
          className="bd-tools-toolbar-end"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setDialog({ open: true, template: null })}
        >
          {t("Tạo mẫu tin nhắn")}
        </Button>
      </div>

      <DataTable<MessageTemplateDto>
        columns={columns}
        dataSource={data?.items ?? []}
        rowKey="id"
        loading={isFetching}
        pagination={pagination.buildConfig(data?.totalCount, pagerTotal)}
        locale={{ emptyText: t("Chưa có mẫu tin nhắn") }}
      />

      <MessageTemplateDialog
        open={dialog.open}
        template={dialog.template}
        channel={channel}
        onClose={() => setDialog({ open: false, template: null })}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={t("mẫu tin")}
        name={pendingDelete?.name ?? ""}
        pending={deleteTemplate.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
