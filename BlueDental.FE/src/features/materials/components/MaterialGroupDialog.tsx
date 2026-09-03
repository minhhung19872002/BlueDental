import { Col, Form, Input, Row } from "antd";
import { useEffect } from "react";
import { toast } from "sonner";
import { SUPPLIES_GROUP } from "../materialsTabs";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { useTaxonomyGroupCommands, type TaxonomyGroup } from "@/hooks/useTaxonomyGroups";
import { t } from "@/lib/i18n";

interface FormValues {
  name: string;
  sortOrder: string;
}

interface Props {
  open: boolean;
  /** null creates a group, otherwise edits this one. */
  group: TaxonomyGroup | null;
  onClose: () => void;
  onCreated: (group: TaxonomyGroup) => void;
}

/** "0" and "" both mean the bottom of the list, as the reference's default does. */
function toSortOrder(raw: string): number {
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * The material group dialog — titled in two words and carrying two fields, the
 * same as the one Danh mục opens, because the reference uses the same one.
 */
export function MaterialGroupDialog({ open, group, onClose, onCreated }: Props) {
  const { create, update } = useTaxonomyGroupCommands(SUPPLIES_GROUP);

  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      name: group?.name ?? "",
      sortOrder: String(group?.sortOrder ?? 0),
    });
  }, [open, group, form]);

  const submit = async (values: FormValues) => {
    const name = values.name.trim();
    const sortOrder = toSortOrder(values.sortOrder);

    try {
      if (group) {
        await update.mutateAsync({ id: group.id, name, sortOrder });
        toast.success(t("Đã cập nhật nhóm vật tư"));
        onClose();
        return;
      }

      const created = await create.mutateAsync({ name, sortOrder });
      toast.success(t("Đã thêm nhóm vật tư"));
      onClose();
      onCreated(created);
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  return (
    <AppDialog
      open={open}
      title={group ? t("Sửa") : t("Tạo")}
      canSave={name.trim().length > 0}
      saving={create.isPending || update.isPending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={(values) => void submit(values)}
      >
        <Row gutter={[16, { xs: 20, sm: 12 }]}>
          <Col xs={24} sm={12}>
            <FloatingField
              name="name"
              label={t("Tên phân loại")}
              required
              rules={[{ required: true, message: t("Vui lòng nhập tên phân loại") }]}
            >
              <Input autoFocus />
            </FloatingField>
          </Col>
          <Col xs={24} sm={12}>
            <FloatingField name="sortOrder" label={t("Mức độ ưu tiên")}>
              <Input inputMode="numeric" />
            </FloatingField>
          </Col>
        </Row>
      </Form>
    </AppDialog>
  );
}
