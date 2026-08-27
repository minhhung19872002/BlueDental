import { useEffect } from "react";
import { Form, Input } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  saving: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
}

interface Values {
  name: string;
}

/**
 * The quick-add behind the "+" beside "Chọn loại nguồn đến".
 *
 * Only a name: everything else about a source group is edited on the Danh mục
 * screen, and the point here is to file a new one without abandoning a
 * half-typed patient record.
 */
export function AddSourceGroupDialog({ open, saving, onSave, onClose }: Props) {
  const [form] = Form.useForm<Values>();
  const name = Form.useWatch("name", form) ?? "";

  useEffect(() => {
    if (open) form.setFieldsValue({ name: "" });
  }, [open, form]);

  return (
    <AppDialog
      open={open}
      width={420}
      title={t("Thêm loại nguồn đến")}
      canSave={name.trim().length > 0}
      saving={saving}
      cancelLabel={t("Huỷ")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={(values) => onSave(values.name.trim())}
      >
        <FloatingField
          label={t("Tên loại nguồn đến")}
          name="name"
          required
          rules={[{ required: true, message: t("Vui lòng nhập tên") }]}
        >
          <Input maxLength={100} autoFocus />
        </FloatingField>
      </Form>
    </AppDialog>
  );
}
