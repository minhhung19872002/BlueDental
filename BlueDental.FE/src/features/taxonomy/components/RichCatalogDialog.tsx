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
import { RichTextField } from "@/components/RichTextField";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

interface FormValues {
  name: string;
  taxonomyId: string;
  content: string;
  note: string;
  isActive: boolean;
  isDeleted: boolean;
  priority: number;
}

interface Props {
  open: boolean;
  entry: CatalogEntryDto | null;
  groups: TaxonomyDto[];
  defaultTaxonomyId?: string;
  /** Lowercase noun of the catalog, e.g. "chẩn đoán". */
  noun: string;
  onClose: () => void;
}

/**
 * Chẩn đoán and Dữ liệu tư vấn: the same form on the reference — a name, its
 * group, a rich-text body, a note, the two state checkboxes and a priority.
 */
export function RichCatalogDialog({
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
      content: entry?.content ?? "",
      note: entry?.note ?? "",
      isActive: entry?.isActive ?? true,
      isDeleted: entry?.isDeleted ?? false,
      priority: entry?.sortOrder ?? 0,
    });
  }, [open, entry, form]);

  const pending = createEntry.isPending || updateEntry.isPending;

  const submit = async (values: FormValues) => {
    const trimmed = values.name.trim();
    const sortOrder = Number(values.priority) || 0;
    // Quill leaves this behind for an empty document; storing it would make an
    // empty body look like content everywhere else.
    const body = values.content === "<p><br></p>" ? null : values.content || null;
    const noteText = values.note?.trim() || null;
    const taxonomyIdValue = values.taxonomyId;
    const isDeleted = values.isDeleted;
    const isActive = values.isActive;

    try {
      if (entry) {
        await updateEntry.mutateAsync({
          id: entry.id,
          input: {
            taxonomyId: taxonomyIdValue,
            name: trimmed,
            code: entry.code ?? undefined,
            price: entry.price,
            content: body,
            note: noteText,
            description: entry.description ?? undefined,
            isActive,
            isDeleted,
            sortOrder,
          },
        });

        toast.success(isDeleted ? t("Đã xoá") : t("Đã cập nhật"));
      } else {
        await createEntry.mutateAsync({
          clinicBranchId: branchId,
          taxonomyId: taxonomyIdValue,
          name: trimmed,
          content: body,
          note: noteText,
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
      width={820}
      canSave={name.trim().length > 0 && taxonomyId.length > 0}
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{
          name: "",
          taxonomyId: "",
          content: "",
          note: "",
          isActive: true,
          isDeleted: false,
          priority: 0,
        }}
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

        <Form.Item name="content">
          <RichTextField placeholder={t("Nhập nội dung tư vấn...")} />
        </Form.Item>

        <Row gutter={[16, 12]}>
          <Col span={12}>
            <FloatingField name="note" label={t("Ghi chú")}>
              <Input />
            </FloatingField>
          </Col>
          <Col span={12}>
            <FloatingField name="priority" label={t("Mức độ ưu tiên")}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </FloatingField>
          </Col>
        </Row>

        {/* One state, drawn as the reference draws it: two boxes of which
            exactly one is ticked. */}
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
            onChange={() => form.setFieldValue("isDeleted", true)}
          >
            {t("Đã xoá")}
          </Checkbox>
        </div>
        <Form.Item name="isDeleted" hidden>
          <Input />
        </Form.Item>
      </Form>
    </AppDialog>
  );
}
