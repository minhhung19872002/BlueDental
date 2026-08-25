import { Form, Input } from "antd";
import { toast } from "sonner";
import { useEffect } from "react";
import {
  useCreateOperationArticle,
  useUpdateOperationArticle,
  type OperationArticleDto,
} from "../api/operationApi";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { RichTextField } from "@/components/RichTextField";
import { t } from "@/lib/i18n";

interface FormValues {
  title: string;
  content: string;
}

interface Props {
  open: boolean;
  /** null writes a new article, otherwise edits this one. */
  article: OperationArticleDto | null;
  /** The category a new article is filed under. */
  categoryId: string | null;
  department: string;
  subTab: string;
  onClose: () => void;
}

/**
 * "Tạo Bài Viết" — a title and a body.
 *
 * The reference stores the body as HTML, so it is written in the same rich-text
 * editor the catalog's Chẩn đoán and Dữ liệu tư vấn use.
 */
export function OperationArticleModal({
  open,
  article,
  categoryId,
  department,
  subTab,
  onClose,
}: Props) {
  const createArticle = useCreateOperationArticle();
  const updateArticle = useUpdateOperationArticle();

  const [form] = Form.useForm<FormValues>();
  const title = Form.useWatch("title", form) ?? "";

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({ title: article?.title ?? "", content: article?.content ?? "" });
  }, [open, article, form]);

  const pending = createArticle.isPending || updateArticle.isPending;

  const submit = async (values: FormValues) => {
    const trimmed = values.title.trim();
    // Quill leaves this behind for an empty document; storing it would make an
    // empty body look like content everywhere else.
    const content = values.content === "<p><br></p>" ? undefined : values.content || undefined;

    try {
      if (article) {
        await updateArticle.mutateAsync({ id: article.id, data: { title: trimmed, content } });
        toast.success(t("Đã cập nhật bài viết"));
      } else {
        if (!categoryId) return;
        await createArticle.mutateAsync({
          title: trimmed,
          content,
          categoryId,
          department,
          subTab,
        });
        toast.success(t("Đã thêm bài viết"));
      }
      onClose();
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  return (
    <AppDialog
      open={open}
      title={article ? t("Cập nhật bài viết") : t("Tạo Bài Viết")}
      width={820}
      canSave={title.trim().length > 0}
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ title: "", content: "" }}
        onFinish={(values) => void submit(values)}
      >
        <FloatingField
          name="title"
          label={t("Tiêu đề")}
          required
          rules={[{ required: true, message: t("Vui lòng nhập tiêu đề") }]}
        >
          <Input autoFocus />
        </FloatingField>

        <Form.Item name="content">
          <RichTextField placeholder={t("Nhập nội dung bài viết...")} />
        </Form.Item>
      </Form>
    </AppDialog>
  );
}
