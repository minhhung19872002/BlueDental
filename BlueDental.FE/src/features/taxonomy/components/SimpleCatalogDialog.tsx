import { Checkbox, Col, Form, Input, InputNumber, Row, Select } from "antd";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import {
  useCreateCatalogEntry,
  useUpdateCatalogEntry,
  type CatalogEntryDto,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  entry: CatalogEntryDto | null;
  groups: TaxonomyDto[];
  defaultTaxonomyId?: string;
  /** Lowercase noun of the catalog, e.g. "nguồn đến". */
  noun: string;
  onClose: () => void;
}

interface FormValues {
  name: string;
  taxonomyId: string;
  isActive: boolean;
  isDeleted: boolean;
  priority: number;
}

/**
 * The form Nguồn đến, Lịch sử bệnh and Nghề nghiệp share on the reference:
 * a name, its group, the two state checkboxes and a priority. Nothing else —
 * these catalogs carry no price, no code and no content.
 *
 * "Đã xoá" is the reference's soft-delete switch. It only does one thing here:
 * ticking it and saving deletes the row, exactly as the table's bin icon does.
 * It is disabled while creating, because a record that is born deleted is not
 * a thing anyone wants, and the reference gives no way to list deleted rows to
 * untick it again.
 */
export function SimpleCatalogDialog({
  open,
  entry,
  groups,
  defaultTaxonomyId,
  noun,
  onClose,
}: Props) {
  const branchId = useCurrentBranchId();
  const createEntry = useCreateCatalogEntry();
  const updateEntry = useUpdateCatalogEntry();

  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";
  const taxonomyId = Form.useWatch("taxonomyId", form) ?? "";
  const isDeleted = Form.useWatch("isDeleted", form) ?? false;

  // React Query hands back a new array on every refetch, so these are read
  // through a ref: a refetch landing while the dialog is open must not reset
  // the form under the user's hands.
  const defaults = useRef({ defaultTaxonomyId, groups });
  defaults.current = { defaultTaxonomyId, groups };

  useEffect(() => {
    if (!open) return;
    const fallback = defaults.current.defaultTaxonomyId ?? defaults.current.groups[0]?.id ?? "";
    form.setFieldsValue({
      name: entry?.name ?? "",
      taxonomyId: entry?.taxonomyId ?? fallback,
      isActive: entry?.isActive ?? true,
      isDeleted: entry?.isDeleted ?? false,
      priority: entry?.sortOrder ?? 0,
    });
  }, [open, entry, form]);

  const pending = createEntry.isPending || updateEntry.isPending;

  const submit = async (values: FormValues) => {
    const trimmed = values.name.trim();
    const sortOrder = Number(values.priority) || 0;

    try {
      if (entry) {
        await updateEntry.mutateAsync({
          id: entry.id,
          input: {
            taxonomyId: values.taxonomyId,
            name: trimmed,
            code: entry.code ?? undefined,
            price: entry.price,
            content: entry.content,
            description: entry.description ?? undefined,
            isActive: values.isActive,
            isDeleted: values.isDeleted,
            sortOrder,
          },
        });

        toast.success(values.isDeleted ? t("Đã xoá") : t("Đã cập nhật"));
      } else {
        await createEntry.mutateAsync({
          clinicBranchId: branchId,
          taxonomyId: values.taxonomyId,
          name: trimmed,
          sortOrder,
        });
        toast.success(t("Đã thêm"));
      }
      onClose();
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  return (
    <AppDialog
      open={open}
      title={entry ? t("Cập nhật {0}", noun) : t("Thêm {0}", noun)}
      canSave={name.trim().length > 0 && taxonomyId.length > 0}
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ name: "", taxonomyId: "", isActive: true, isDeleted: false, priority: 0 }}
        onFinish={(values) => void submit(values)}
      >
        <Row gutter={[16, 12]}>
          <Col span={12}>
            <FloatingField
              name="name"
              label={t("Tên {0}", noun)}
              required
              rules={[{ required: true, message: t("Vui lòng nhập tên {0}", noun) }]}
            >
              <Input autoFocus />
            </FloatingField>
          </Col>
          <Col span={12}>
            <FloatingField
              name="taxonomyId"
              label={t("Chọn nhóm {0}", noun)}
              required
              rules={[{ required: true, message: t("Vui lòng chọn nhóm {0}", noun) }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={groups.map((group) => ({ value: group.id, label: group.name }))}
              />
            </FloatingField>
          </Col>
        </Row>

        <Row gutter={[16, 12]}>
          <Col span={12}>
            {/* One state, drawn as the reference draws it: two boxes of which
                exactly one is ticked. Disabled while creating — a record that
                is born deleted is not a thing anyone wants. */}
            <div className="bd-dialog-row">
              <Checkbox
                checked={!isDeleted}
                disabled={!entry}
                onChange={() => form.setFieldValue("isDeleted", false)}
              >
                {t("Đang hoạt động")}
              </Checkbox>
              <Checkbox
                checked={isDeleted}
                disabled={!entry}
                title={entry ? undefined : t("Chỉ dùng khi sửa bản ghi đã có")}
                onChange={() => form.setFieldValue("isDeleted", true)}
              >
                {t("Đã xoá")}
              </Checkbox>
            </div>
            <Form.Item name="isDeleted" hidden>
              <Input />
            </Form.Item>
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
