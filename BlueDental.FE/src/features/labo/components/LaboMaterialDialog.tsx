import { useEffect, useRef } from "react";
import { Col, Form, Input, Row, Select } from "antd";
import { toast } from "sonner";
import { useLaboMaterialCommands, type LaboMaterialDto } from "../api/laboCatalogApi";
import type { LaboMaterialGroupItem } from "../api/laboMaterialGroups";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  material: LaboMaterialDto | null;
  /** The three fixed groups (BA P1011). */
  groups: LaboMaterialGroupItem[];
  /** The group selected in the panel, pre-filled on a new material. */
  defaultTaxonomyId?: string;
  onClose: () => void;
}

interface FormValues {
  code: string;
  name: string;
  taxonomyId: string;
  isActive: boolean;
}

/**
 * Tạo / Sửa vật liệu (BA P1011): Mã and Tên vật liệu on one row, Nhóm vật liệu
 * (the group is the table it fills on the Phiếu yêu cầu, and so decides its
 * columns), and Trạng thái. Mã is unique within the branch — the server says
 * so when it is taken.
 */
export function LaboMaterialDialog({ open, material, groups, defaultTaxonomyId, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const code = Form.useWatch("code", form) ?? "";
  const name = Form.useWatch("name", form) ?? "";
  const taxonomyId = Form.useWatch("taxonomyId", form) ?? "";
  const { create, update } = useLaboMaterialCommands();

  // React Query hands back a new array on every refetch; reading the defaults
  // through a ref keeps a refetch from resetting the form under the user.
  const defaults = useRef({ defaultTaxonomyId, groups });
  defaults.current = { defaultTaxonomyId, groups };

  useEffect(() => {
    if (!open) return;
    const fixed = defaults.current.groups;
    const fallback = defaults.current.defaultTaxonomyId ?? fixed[0]?.id ?? "";
    // A material still filed under a group made before P1011 has to be moved.
    const own = material && fixed.some((group) => group.id === material.taxonomyId) ? material.taxonomyId : "";
    form.setFieldsValue({
      code: material?.code ?? "",
      name: material?.name ?? "",
      taxonomyId: material ? own : fallback,
      isActive: material?.isActive ?? true,
    });
  }, [open, material, form]);

  const pending = create.isPending || update.isPending;

  const submit = async (values: FormValues) => {
    const input = {
      code: values.code.trim(),
      name: values.name.trim(),
      taxonomyId: values.taxonomyId,
      isActive: values.isActive,
    };
    try {
      if (material) {
        await update.mutateAsync({ id: material.id, input });
        toast.success(t("Common:Updated"));
      } else {
        await create.mutateAsync(input);
        toast.success(t("Common:Added"));
      }
      onClose();
    } catch {
      // queryClient reports the failure (a taken Mã among them); the dialog stays open to retry.
    }
  };

  const required = (label: string) => [{ required: true, whitespace: true, message: t("Common:PleaseEnter", label) }];

  return (
    <AppDialog
      open={open}
      width={560}
      title={material ? t("Common:EditItem", t("Labo:Noun:Material")) : t("Common:CreateItem", t("Labo:Noun:Material"))}
      canSave={code.trim().length > 0 && name.trim().length > 0 && taxonomyId.length > 0}
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ code: "", name: "", taxonomyId: "", isActive: true }}
        onFinish={(values) => void submit(values)}
      >
        <Row gutter={[16, 12]}>
          <Col xs={24} md={8}>
            <FloatingField name="code" label={t("Labo:Material:Code")} required rules={required(t("Labo:Material:Code"))}>
              <Input autoFocus maxLength={50} className="bd-labo-material-codeinput" />
            </FloatingField>
          </Col>
          <Col xs={24} md={16}>
            <FloatingField name="name" label={t("Labo:Material:Name")} required rules={required(t("Labo:Material:Name"))}>
              <Input maxLength={200} />
            </FloatingField>
          </Col>
          <Col xs={24}>
            <FloatingField
              name="taxonomyId"
              label={t("Labo:Material:Group")}
              required
              rules={[{ required: true, message: t("Common:PleaseSelect", t("Labo:Material:Group")) }]}
            >
              <Select options={groups.map((group) => ({ value: group.id, label: group.name }))} />
            </FloatingField>
          </Col>
          <Col xs={24}>
            <FloatingField name="isActive" label={t("Common:Status")}>
              <Select
                options={[
                  { value: true, label: t("Labo:Material:InUse") },
                  { value: false, label: t("Labo:Material:Stopped") },
                ]}
              />
            </FloatingField>
          </Col>
        </Row>
      </Form>
    </AppDialog>
  );
}
