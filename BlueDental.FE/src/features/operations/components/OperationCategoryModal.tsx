import { Form, Input } from "antd";
import { toast } from "sonner";
import { useEffect } from "react";
import {
  useCreateOperationCategory,
  useUpdateOperationCategory,
  type OperationCategoryDto,
} from "../api/operationApi";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";

interface FormValues {
  name: string;
}

interface Props {
  open: boolean;
  /** null creates a new category, otherwise renames this one. */
  category: OperationCategoryDto | null;
  department: string;
  subTab: string;
  onClose: () => void;
  onCreated: (category: OperationCategoryDto) => void;
}

export function OperationCategoryModal({
  open,
  category,
  department,
  subTab,
  onClose,
  onCreated,
}: Props) {
  const createCategory = useCreateOperationCategory();
  const updateCategory = useUpdateOperationCategory();

  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({ name: category?.name ?? "" });
  }, [open, category, form]);

  const pending = createCategory.isPending || updateCategory.isPending;

  const submit = async (values: FormValues) => {
    const trimmed = values.name.trim();

    try {
      if (category) {
        await updateCategory.mutateAsync({
          id: category.id,
          data: { name: trimmed, sortOrder: category.sortOrder },
        });
        toast.success(t("Đã cập nhật mục"));
        onClose();
        return;
      }

      const created = await createCategory.mutateAsync({ name: trimmed, department, subTab });
      toast.success(t("Đã thêm mục"));
      // Closed before the parent is told, so a hiccup while it moves the
      // selection can never leave this dialog stuck open over the result.
      onClose();
      onCreated(created);
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  return (
    <AppDialog
      open={open}
      title={category ? t("Cập nhật mục") : t("Thêm mục mới")}
      canSave={name.trim().length > 0}
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ name: "" }}
        onFinish={(values) => void submit(values)}
      >
        <FloatingField
          name="name"
          label={t("Tên mục")}
          required
          rules={[{ required: true, message: t("Vui lòng nhập tên mục") }]}
        >
          <Input autoFocus />
        </FloatingField>
      </Form>
    </AppDialog>
  );
}
