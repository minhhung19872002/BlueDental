import { useEffect, useRef } from "react";
import { Col, Form, Input, Row, Select } from "antd";
import { toast } from "sonner";
import { useLaboMaterialCommands, type LaboMaterialDto } from "../api/laboCatalogApi";
import type { LaboCatalogItem } from "../api/laboCatalogListApi";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  material: LaboMaterialDto | null;
  groups: LaboCatalogItem[];
  /** The group selected in the panel, pre-filled on a new material. */
  defaultTaxonomyId?: string;
  onClose: () => void;
}

interface FormValues {
  name: string;
  taxonomyId: string;
}

/**
 * Tạo / Sửa vật liệu — a name and the group it is filed under, which is what
 * the reference's own dialog asks for, and both are required.
 */
export function LaboMaterialDialog({
  open,
  material,
  groups,
  defaultTaxonomyId,
  onClose,
}: Props) {
  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";
  const taxonomyId = Form.useWatch("taxonomyId", form) ?? "";
  const { create, update } = useLaboMaterialCommands();

  // React Query hands back a new array on every refetch; reading the defaults
  // through a ref keeps a refetch from resetting the form under the user.
  const defaults = useRef({ defaultTaxonomyId, groups });
  defaults.current = { defaultTaxonomyId, groups };

  useEffect(() => {
    if (!open) return;
    const fallback = defaults.current.defaultTaxonomyId ?? defaults.current.groups[0]?.id ?? "";
    form.setFieldsValue({
      name: material?.name ?? "",
      taxonomyId: material?.taxonomyId ?? fallback,
    });
  }, [open, material, form]);

  const pending = create.isPending || update.isPending;

  const submit = async (values: FormValues) => {
    const input = { name: values.name.trim(), taxonomyId: values.taxonomyId };

    try {
      if (material) {
        await update.mutateAsync({ id: material.id, input });
        toast.success(t("Đã cập nhật"));
      } else {
        await create.mutateAsync(input);
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
      width={560}
      title={material ? t("Sửa vật liệu") : t("Tạo vật liệu")}
      canSave={name.trim().length > 0 && taxonomyId.length > 0}
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ name: "", taxonomyId: "" }}
        onFinish={(values) => void submit(values)}
      >
        <Row gutter={[16, 12]}>
          <Col xs={24} md={12}>
            <FloatingField
              name="name"
              label={t("Vật liệu")}
              required
              rules={[{ required: true, message: t("Vui lòng nhập tên vật liệu") }]}
            >
              <Input autoFocus maxLength={200} />
            </FloatingField>
          </Col>
          <Col xs={24} md={12}>
            <FloatingField
              name="taxonomyId"
              label={t("Phân loại dịch vụ")}
              required
              rules={[{ required: true, message: t("Vui lòng chọn phân loại dịch vụ") }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={groups.map((group) => ({ value: group.id, label: group.name }))}
              />
            </FloatingField>
          </Col>
        </Row>
      </Form>
    </AppDialog>
  );
}
