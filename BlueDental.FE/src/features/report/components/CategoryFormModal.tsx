import { useCallback, useEffect } from "react";
import { Col, Form, Input, InputNumber, Row } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { notifyDemoAction } from "../api/reportMockQueries";
import type { CategoryVm } from "../types/mock";
import { CategoryColorFields, DEFAULT_CATEGORY_COLOR } from "./CategoryColorFields";

export type CategoryVariant = "income" | "expense" | "cashbook";

interface Props {
  open: boolean;
  variant: CategoryVariant;
  category: CategoryVm | null;
  onClose: () => void;
}

interface FormValues {
  name: string;
  priority?: number;
  colorCode?: string;
}

const TITLES: Record<CategoryVariant, { create: () => string; edit: () => string }> = {
  income: { create: () => t("Thêm danh mục thu nhập"), edit: () => t("Sửa danh mục thu nhập") },
  expense: { create: () => t("Thêm danh mục chi phí"), edit: () => t("Sửa danh mục chi phí") },
  cashbook: { create: () => t("Thêm danh mục sổ quỹ"), edit: () => t("Sửa danh mục sổ quỹ") },
};

/**
 * "Thêm danh mục …". Thu nhập / chi phí put the name beside its priority;
 * sổ quỹ mirrors the "Thêm thẻ hồ sơ mới" dialog: name, swatches, preview.
 */
export function CategoryFormModal({ open, variant, category, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const isEdit = category !== null;
  const isCashbook = variant === "cashbook";
  const title = isEdit ? TITLES[variant].edit() : TITLES[variant].create();
  const name = Form.useWatch("name", form) ?? "";
  const color = Form.useWatch("colorCode", form) ?? DEFAULT_CATEGORY_COLOR;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (category) {
      form.setFieldsValue({
        name: category.name,
        priority: category.priority,
        colorCode: category.colorCode ?? DEFAULT_CATEGORY_COLOR,
      });
    }
  }, [open, category, form]);

  const handleFinish = useCallback(
    (values: FormValues) => {
      notifyDemoAction(isEdit ? t("Sửa danh mục {0}", values.name) : t("Thêm danh mục {0}", values.name));
      onClose();
    },
    [isEdit, onClose],
  );

  const handleColorChange = useCallback((next: string) => form.setFieldValue("colorCode", next), [form]);

  if (isCashbook) {
    return (
      <AppDialog open={open} title={title} canSave={name.trim().length > 0} onSave={() => form.submit()} onClose={onClose}>
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{ name: "", colorCode: DEFAULT_CATEGORY_COLOR }}
          onFinish={handleFinish}
        >
          <FloatingField name="name" label={t("Tên danh mục")} required rules={[{ required: true, message: t("Vui lòng nhập tên danh mục") }]}>
            <Input autoFocus maxLength={200} />
          </FloatingField>
          <CategoryColorFields color={color} previewName={name.trim()} onChange={handleColorChange} />
        </Form>
      </AppDialog>
    );
  }

  return (
    <AppDialog open={open} title={title} width={500} canSave onSave={() => form.submit()} onClose={onClose}>
      <Form form={form} layout="vertical" requiredMark={false} initialValues={{ priority: 0 }} onFinish={handleFinish}>
        <Row gutter={[16, 12]}>
          <Col xs={24} md={12}>
            <FloatingField name="name" label={t("Tên phân loại")} required rules={[{ required: true, whitespace: true, message: t("Vui lòng nhập tên") }]}>
              <Input autoFocus maxLength={200} />
            </FloatingField>
          </Col>
          <Col xs={24} md={12}>
            <FloatingField name="priority" label={t("Mức độ ưu tiên")}>
              <InputNumber min={0} className="report-full-width" />
            </FloatingField>
          </Col>
        </Row>
      </Form>
    </AppDialog>
  );
}
