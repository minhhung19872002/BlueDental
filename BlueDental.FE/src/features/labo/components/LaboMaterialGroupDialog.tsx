import { useEffect } from "react";
import { Col, Form, Input, InputNumber, Row } from "antd";
import { toast } from "sonner";
import { useLaboCatalogCommands, type LaboCatalogItem } from "../api/laboCatalogListApi";
import { LABO_GROUP } from "../laboTabs";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  /** The group being renamed, or null while creating. */
  group: LaboCatalogItem | null;
  onClose: () => void;
}

interface FormValues {
  name: string;
  priority: number;
}

/**
 * The classification-group form on Dịch vụ - vật liệu: a name and a priority,
 * which is all the reference's own dialog collects.
 */
export function LaboMaterialGroupDialog({ open, group, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";
  const { create, update } = useLaboCatalogCommands(LABO_GROUP.Material);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({ name: group?.name ?? "", priority: group?.sortOrder ?? 0 });
  }, [open, group, form]);

  const pending = create.isPending || update.isPending;

  const submit = async (values: FormValues) => {
    const trimmed = values.name.trim();
    const sortOrder = Number(values.priority) || 0;

    try {
      if (group) {
        await update.mutateAsync({ id: group.id, name: trimmed, sortOrder });
        toast.success(t("Đã cập nhật"));
      } else {
        await create.mutateAsync({ name: trimmed, sortOrder });
        toast.success(t("Đã thêm"));
      }
      onClose();
    } catch {
      // queryClient reports the failure; the dialog stays open to retry.
    }
  };

  return (
    <AppDialog
      open={open}
      width={520}
      title={group ? t("Sửa") : t("Tạo")}
      canSave={name.trim().length > 0}
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ name: "", priority: 0 }}
        onFinish={(values) => void submit(values)}
      >
        <Row gutter={[16, 12]}>
          <Col xs={24} md={14}>
            <FloatingField
              name="name"
              label={t("Tên phân loại")}
              required
              rules={[{ required: true, message: t("Vui lòng nhập tên phân loại") }]}
            >
              <Input autoFocus maxLength={100} />
            </FloatingField>
          </Col>
          <Col xs={24} md={10}>
            <FloatingField name="priority" label={t("Mức độ ưu tiên")}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </FloatingField>
          </Col>
        </Row>
      </Form>
    </AppDialog>
  );
}
