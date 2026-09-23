import { useCallback, useEffect } from "react";
import { Col, Form, Input, InputNumber, Row } from "antd";
import { toast } from "sonner";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { SALES_ENTRY_TYPE, useCreateCashflowCategory, useUpdateCashflowCategory } from "../api/financeApi";
import { CategoryColorFields, DEFAULT_CATEGORY_COLOR } from "./CategoryColorFields";
import type { CategoryVm } from "./CategoryPanel";

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
  description?: string;
  colorCode?: string;
}

const TITLES: Record<CategoryVariant, { create: () => string; edit: () => string }> = {
  income: { create: () => t("Report:CategoryForm:AddIncome"), edit: () => t("Report:CategoryForm:EditIncome") },
  expense: { create: () => t("Report:CategoryForm:AddExpense"), edit: () => t("Report:CategoryForm:EditExpense") },
  cashbook: { create: () => t("Report:CategoryForm:AddCashbook"), edit: () => t("Report:CategoryForm:EditCashbook") },
};

const VARIANT_TYPE = {
  income: SALES_ENTRY_TYPE.Income,
  expense: SALES_ENTRY_TYPE.Expense,
  cashbook: SALES_ENTRY_TYPE.Income,
} as const;

function trimmedOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function CategoryFormModal({ open, variant, category, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const isEdit = category !== null;
  const isCashbook = variant === "cashbook";
  const title = isEdit ? TITLES[variant].edit() : TITLES[variant].create();
  const name = Form.useWatch("name", form) ?? "";
  const color = Form.useWatch("colorCode", form) ?? DEFAULT_CATEGORY_COLOR;

  const branchId = useCurrentBranchId();
  const createMutation = useCreateCashflowCategory();
  const updateMutation = useUpdateCashflowCategory();
  const saving = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (category) {
      form.setFieldsValue({
        name: category.name,
        priority: category.priority,
        description: category.description ?? undefined,
        colorCode: category.colorCode ?? DEFAULT_CATEGORY_COLOR,
      });
    }
  }, [open, category, form]);

  const handleFinish = useCallback(
    (values: FormValues) => {
      const trimmedName = values.name.trim();
      const description = trimmedOrUndefined(values.description);
      // Only the cashbook dialog shows the colour swatch.
      const colorCode = isCashbook ? values.colorCode : undefined;
      // The cashbook dialog has no priority field, so an edit keeps the stored order.
      const sortOrder = values.priority ?? category?.priority ?? 0;
      if (category) {
        updateMutation.mutate(
          { id: category.id, input: { name: trimmedName, description, sortOrder, isActive: true, colorCode } },
          {
            onSuccess: () => {
              // The reference calls a sổ quỹ entry a "danh mục" and a thu/chi one a "nhóm".
              toast.success(isCashbook ? t("Report:CategoryForm:UpdateCashbookSuccess") : t("Report:CategoryForm:UpdateGroupSuccess"));
              onClose();
            },
          },
        );
        return;
      }
      createMutation.mutate(
        {
          clinicBranchId: branchId,
          name: trimmedName,
          type: VARIANT_TYPE[variant],
          appliesToTransfers: isCashbook,
          sortOrder,
          description,
          colorCode,
        },
        {
          onSuccess: () => {
            toast.success(isCashbook ? t("Report:CategoryForm:CreateCashbookSuccess") : t("Report:CategoryForm:CreateGroupSuccess"));
            onClose();
          },
        },
      );
    },
    [category, branchId, variant, isCashbook, createMutation, updateMutation, onClose],
  );

  const handleColorChange = useCallback((next: string) => form.setFieldValue("colorCode", next), [form]);

  if (isCashbook) {
    return (
      <AppDialog
        open={open}
        title={title}
        width={500}
        canSave={name.trim().length > 0}
        saving={saving}
        onSave={() => form.submit()}
        onClose={onClose}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{ name: "", colorCode: DEFAULT_CATEGORY_COLOR }}
          onFinish={handleFinish}
        >
          <FloatingField name="name" label={t("Report:CategoryForm:CashbookNameLabel")} required rules={[{ required: true, whitespace: true, message: t("Report:CategoryForm:NameRequired") }]}>
            <Input autoFocus maxLength={200} />
          </FloatingField>
          <FloatingField name="description" label={t("Report:CategoryForm:NoteOptional")}>
            <Input maxLength={500} />
          </FloatingField>
          <CategoryColorFields color={color} previewName={name.trim()} onChange={handleColorChange} />
        </Form>
      </AppDialog>
    );
  }

  return (
    <AppDialog
      open={open}
      title={title}
      width={500}
      canSave
      saving={saving}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form form={form} layout="vertical" requiredMark={false} initialValues={{ priority: 0 }} onFinish={handleFinish}>
        <Row gutter={[16, 12]}>
          <Col xs={24} md={12}>
            <FloatingField name="name" label={t("Report:CategoryForm:GroupNameLabel")} required rules={[{ required: true, whitespace: true, message: t("Report:CategoryForm:GroupNameRequired") }]}>
              <Input autoFocus maxLength={200} />
            </FloatingField>
          </Col>
          <Col xs={24} md={12}>
            <FloatingField name="priority" label={t("Report:CategoryForm:Priority")}>
              <InputNumber min={0} className="report-full-width" />
            </FloatingField>
          </Col>
        </Row>
      </Form>
    </AppDialog>
  );
}
