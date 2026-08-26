import { Col, Form, Input, Row } from "antd";
import { toast } from "sonner";
import { useEffect } from "react";
import {
  useCreateOperationCategory,
  useUpdateOperationCategory,
  type OperationCategoryDto,
} from "../api/operationApi";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

interface FormValues {
  name: string;
  sortOrder: string;
}

interface Props {
  open: boolean;
  /** null creates a new category, otherwise edits this one. */
  category: OperationCategoryDto | null;
  department: string;
  subTab: string;
  onClose: () => void;
  onCreated: (category: OperationCategoryDto) => void;
}

/** "0" and "" both mean the bottom of the list, as the reference's default does. */
function toSortOrder(raw: string): number {
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function OperationCategoryModal({
  open,
  category,
  department,
  subTab,
  onClose,
  onCreated,
}: Props) {
  const branchId = useCurrentBranchId();
  const createCategory = useCreateOperationCategory();
  const updateCategory = useUpdateOperationCategory();

  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      name: category?.name ?? "",
      sortOrder: String(category?.sortOrder ?? 0),
    });
  }, [open, category, form]);

  const pending = createCategory.isPending || updateCategory.isPending;

  const submit = async (values: FormValues) => {
    const trimmed = values.name.trim();
    const sortOrder = toSortOrder(values.sortOrder);

    try {
      if (category) {
        await updateCategory.mutateAsync({
          id: category.id,
          data: { name: trimmed, sortOrder },
        });
        toast.success(t("Đã cập nhật phân loại"));
        onClose();
        return;
      }

      const created = await createCategory.mutateAsync({
        clinicBranchId: branchId,
        name: trimmed,
        department,
        subTab,
        sortOrder,
      });
      toast.success(t("Đã thêm phân loại"));
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
      // The reference titles these two words, not a sentence.
      title={category ? t("Sửa") : t("Tạo")}
      canSave={name.trim().length > 0}
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ name: "", sortOrder: "0" }}
        onFinish={(values) => void submit(values)}
      >
        <Row gutter={[16, 12]}>
          <Col span={12}>
            <FloatingField
              name="name"
              label={t("Tên phân loại")}
              required
              rules={[{ required: true, message: t("Vui lòng nhập tên phân loại") }]}
            >
              <Input autoFocus />
            </FloatingField>
          </Col>
          <Col span={12}>
            <FloatingField name="sortOrder" label={t("Mức độ ưu tiên")}>
              <Input inputMode="numeric" />
            </FloatingField>
          </Col>
        </Row>
      </Form>
    </AppDialog>
  );
}
