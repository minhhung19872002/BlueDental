import { useEffect } from "react";
import { Col, Form, Input, InputNumber, Row } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  saving: boolean;
  onSave: (name: string, sortOrder: number) => void;
  onClose: () => void;
}

interface Values {
  name: string;
  sortOrder: number;
}

/**
 * The quick-add behind the "+" beside "Chọn loại nguồn đến".
 *
 * A name and where it sits in the list, as the reference's own dialog collects
 * them. Everything else about a source group is edited on the Danh mục screen;
 * the point here is to file a new one without abandoning a half-typed record.
 */
export function AddSourceGroupDialog({ open, saving, onSave, onClose }: Props) {
  const [form] = Form.useForm<Values>();
  const name = Form.useWatch("name", form) ?? "";

  useEffect(() => {
    if (open) form.setFieldsValue({ name: "", sortOrder: 0 });
  }, [open, form]);

  return (
    <AppDialog
      open={open}
      width={520}
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
        onFinish={(values) => onSave(values.name.trim(), values.sortOrder ?? 0)}
      >
        {/* Side by side, the way Danh mục lays its own group dialogs out and
            the way the reference draws this one. */}
        <Row gutter={[16, 12]}>
          <Col span={15}>
            <FloatingField
              label={t("Tên loại nguồn đến")}
              name="name"
              required
              rules={[{ required: true, message: t("Vui lòng nhập tên") }]}
            >
              <Input maxLength={100} autoFocus />
            </FloatingField>
          </Col>
          <Col span={9}>
            {/* Where it sits in the list. The reference defaults it to 0. */}
            <FloatingField label={t("Mức độ ưu tiên")} name="sortOrder">
              <InputNumber min={0} max={9999} precision={0} style={{ width: "100%" }} />
            </FloatingField>
          </Col>
        </Row>
      </Form>
    </AppDialog>
  );
}
