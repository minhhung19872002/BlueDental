import { useEffect } from "react";
import { Form, Input, InputNumber, Modal, Select, Switch } from "antd";
import { toast } from "sonner";
import {
  useCreateCatalogEntry,
  useUpdateCatalogEntry,
  type CatalogEntryDto,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";

interface CatalogEntryModalProps {
  open: boolean;
  entry: CatalogEntryDto | null;
  groups: TaxonomyDto[];
  defaultTaxonomyId?: string;
  /** Catalogs whose entries carry a price (dịch vụ, thuốc, vật tư). */
  priced: boolean;
  /** Catalogs whose entries carry template content (đơn thuốc mẫu, bệnh án mẫu). */
  templated: boolean;
  /** Column/field label, e.g. "Tên dịch vụ". */
  entityLabel: string;
  /** Noun used in dialog titles and toasts, e.g. "Dịch vụ". */
  entityNoun: string;
  onClose: () => void;
}

interface CatalogEntryFormValues {
  taxonomyId: string;
  name: string;
  code?: string;
  price?: number | null;
  content?: string | null;
  description?: string;
  isImageRequired: boolean;
  isActive: boolean;
  sortOrder: number;
}

export function CatalogEntryModal({
  open,
  entry,
  groups,
  defaultTaxonomyId,
  priced,
  templated,
  entityLabel,
  entityNoun,
  onClose,
}: CatalogEntryModalProps) {
  const [form] = Form.useForm<CatalogEntryFormValues>();
  const branchId = useCurrentBranchId();
  const createEntry = useCreateCatalogEntry();
  const updateEntry = useUpdateCatalogEntry();

  const isEdit = entry !== null;

  useEffect(() => {
    if (!open) return;

    form.setFieldsValue({
      taxonomyId: entry?.taxonomyId ?? defaultTaxonomyId ?? groups[0]?.id,
      name: entry?.name ?? "",
      code: entry?.code ?? undefined,
      price: entry?.price ?? undefined,
      content: entry?.content ?? undefined,
      description: entry?.description ?? undefined,
      isImageRequired: entry?.isImageRequired ?? false,
      isActive: entry?.isActive ?? true,
      sortOrder: entry?.sortOrder ?? 0,
    });
  }, [open, entry, defaultTaxonomyId, groups, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();

    // The server rejects a price on an unpriced catalog and content on a
    // non-template one, so only send what this catalog actually supports.
    const price = priced ? (values.price ?? null) : null;
    const content = templated ? (values.content ?? null) : null;

    try {
      if (isEdit) {
        await updateEntry.mutateAsync({
          id: entry.id,
          input: {
            taxonomyId: values.taxonomyId,
            name: values.name,
            code: values.code,
            price,
            content,
            description: values.description,
            isImageRequired: values.isImageRequired,
            isActive: values.isActive,
            sortOrder: values.sortOrder,
          },
        });
        toast.success(t("Đã cập nhật {0}", entityNoun.toLowerCase()));
      } else {
        await createEntry.mutateAsync({
          clinicBranchId: branchId,
          taxonomyId: values.taxonomyId,
          name: values.name,
          code: values.code,
          price,
          content,
          description: values.description,
          isImageRequired: values.isImageRequired,
          sortOrder: values.sortOrder,
        });
        toast.success(t("Đã thêm {0}", entityNoun.toLowerCase()));
      }

      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? t("Sửa {0}", entityNoun.toLowerCase()) : t("Thêm {0}", entityNoun.toLowerCase())}
      okText={isEdit ? t("Lưu") : t("Thêm")}
      cancelText={t("Huỷ")}
      confirmLoading={createEntry.isPending || updateEntry.isPending}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          name="taxonomyId"
          label={t("Nhóm phân loại")}
          rules={[{ required: true, message: t("Vui lòng chọn nhóm") }]}
        >
          <Select
            options={groups.map((g) => ({ value: g.id, label: g.name }))}
            placeholder={t("Chọn nhóm")}
          />
        </Form.Item>

        <Form.Item
          name="name"
          label={entityLabel}
          rules={[{ required: true, message: t("Vui lòng nhập {0}", entityLabel.toLowerCase()) }]}
        >
          <Input placeholder={t("Nhập {0}", entityLabel.toLowerCase())} />
        </Form.Item>

        <Form.Item name="code" label={t("Mã")}>
          <Input placeholder={t("Ví dụ: DT02")} />
        </Form.Item>

        {priced && (
          <Form.Item
            name="price"
            label={t("Giá (đ)")}
            rules={[{ type: "number", min: 0, message: t("Giá không được âm") }]}
          >
            <InputNumber<number>
              style={{ width: "100%" }}
              min={0}
              step={10000}
              formatter={(v) => `${v ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
              parser={(v) => Number((v ?? "").replace(/\./g, ""))}
            />
          </Form.Item>
        )}

        {templated && (
          <Form.Item name="content" label={t("Nội dung mẫu")}>
            <Input.TextArea rows={4} placeholder={t("Nội dung của mẫu")} />
          </Form.Item>
        )}

        <Form.Item name="description" label={t("Mô tả")}>
          <Input.TextArea rows={2} />
        </Form.Item>

        <Form.Item name="sortOrder" label={t("Thứ tự hiển thị")}>
          <InputNumber style={{ width: "100%" }} min={0} />
        </Form.Item>

        {priced && (
          <Form.Item name="isImageRequired" label={t("Bắt buộc đính kèm ảnh")} valuePropName="checked">
            <Switch />
          </Form.Item>
        )}

        {isEdit && (
          <Form.Item name="isActive" label={t("Đang sử dụng")} valuePropName="checked">
            <Switch />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
