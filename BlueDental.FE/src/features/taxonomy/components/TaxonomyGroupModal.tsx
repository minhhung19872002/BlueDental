import { Col, Form, Input, InputNumber, Row } from "antd";
import { toast } from "sonner";
import { useEffect } from "react";
import {
  useCreateTaxonomyGroup,
  useUpdateTaxonomyGroup,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

interface FormValues {
  name: string;
  priority: number;
}

interface Props {
  open: boolean;
  /** null creates a new group, otherwise edits this one. */
  group: TaxonomyDto | null;
  /** Taxonomy group slug of the active tab. */
  taxonomyGroup: string;
  onClose: () => void;
  onCreated: (group: TaxonomyDto) => void;
}

/** What the reference offers a new group, and what the list sorts by. */
const DEFAULT_PRIORITY = "0";

export function TaxonomyGroupModal({ open, group, taxonomyGroup, onClose, onCreated }: Props) {
  const branchId = useCurrentBranchId();
  const createGroup = useCreateTaxonomyGroup();
  const updateGroup = useUpdateTaxonomyGroup();

  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      name: group?.name ?? "",
      /** "Mức độ ưu tiên" — the sort order the panel lists groups by. */
      priority: group ? group.sortOrder : Number(DEFAULT_PRIORITY),
    });
  }, [open, group, form]);

  const pending = createGroup.isPending || updateGroup.isPending;

  const submit = async (values: FormValues) => {
    const trimmed = values.name.trim();
    // An empty box means "no priority", which is the same as the default.
    const resolvedSortOrder = Number.isFinite(values.priority) ? Number(values.priority) : 0;

    try {
      if (group) {
        await updateGroup.mutateAsync({
          id: group.id,
          input: {
            name: trimmed,
            alias: group.alias ?? undefined,
            color: group.color ?? undefined,
            description: group.description ?? undefined,
            sortOrder: resolvedSortOrder,
          },
        });
        toast.success(t("Đã cập nhật nhóm"));
      } else {
        const created = await createGroup.mutateAsync({
          clinicBranchId: branchId,
          group: taxonomyGroup,
          name: trimmed,
          sortOrder: resolvedSortOrder,
        });
        toast.success(t("Đã thêm nhóm"));
        // Closed before the parent is told, so a hiccup while it moves the
        // selection can never leave this dialog stuck open over the result.
        onClose();
        onCreated(created);
        return;
      }
      onClose();
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  return (
    <AppDialog
      open={open}
      // The reference titles the edit dialog "Cập nhật nhóm", not "Sửa".
      title={group ? t("Cập nhật nhóm") : t("Tạo nhóm")}
      canSave={name.trim().length > 0}
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ name: "", priority: Number(DEFAULT_PRIORITY) }}
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
            <FloatingField name="priority" label={t("Mức độ ưu tiên")}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </FloatingField>
          </Col>
        </Row>
      </Form>
    </AppDialog>
  );
}
