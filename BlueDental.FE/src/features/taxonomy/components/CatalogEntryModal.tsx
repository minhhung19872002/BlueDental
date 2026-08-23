import { useEffect } from "react";
import { Form, Input, InputNumber, Modal, Select, Switch, message } from "antd";
import { useTranslation } from "react-i18next";
import {
  useCreateCatalogEntry,
  useUpdateCatalogEntry,
  type CatalogEntryDto,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";

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
  const { t } = useTranslation();
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
        message.success(t("catalogEntryModal.updateSuccess", { noun: entityNoun.toLowerCase() }));
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
        message.success(t("catalogEntryModal.createSuccess", { noun: entityNoun.toLowerCase() }));
      }

      onClose();
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? t("catalogEntryModal.editTitle", { noun: entityNoun.toLowerCase() }) : t("catalogEntryModal.createTitle", { noun: entityNoun.toLowerCase() })}
      okText={isEdit ? t("catalogEntryModal.okTextEdit") : t("catalogEntryModal.okTextCreate")}
      cancelText={t("catalogEntryModal.cancel")}
      confirmLoading={createEntry.isPending || updateEntry.isPending}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item
          name="taxonomyId"
          label={t("catalogEntryModal.groupLabel")}
          rules={[{ required: true, message: t("catalogEntryModal.groupRequired") }]}
        >
          <Select
            options={groups.map((g) => ({ value: g.id, label: g.name }))}
            placeholder={t("catalogEntryModal.groupPlaceholder")}
          />
        </Form.Item>

        <Form.Item
          name="name"
          label={entityLabel}
          rules={[{ required: true, message: t("catalogEntryModal.nameRequired", { label: entityLabel.toLowerCase() }) }]}
        >
          <Input placeholder={t("catalogEntryModal.namePlaceholder", { label: entityLabel.toLowerCase() })} />
        </Form.Item>

        <Form.Item name="code" label={t("catalogEntryModal.codeLabel")}>
          <Input placeholder={t("catalogEntryModal.codePlaceholder")} />
        </Form.Item>

        {priced && (
          <Form.Item
            name="price"
            label={t("catalogEntryModal.priceLabel")}
            rules={[{ type: "number", min: 0, message: t("catalogEntryModal.priceNotNegative") }]}
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
          <Form.Item name="content" label={t("catalogEntryModal.contentLabel")}>
            <Input.TextArea rows={4} placeholder={t("catalogEntryModal.contentPlaceholder")} />
          </Form.Item>
        )}

        <Form.Item name="description" label={t("catalogEntryModal.descriptionLabel")}>
          <Input.TextArea rows={2} />
        </Form.Item>

        <Form.Item name="sortOrder" label={t("catalogEntryModal.sortOrderLabel")}>
          <InputNumber style={{ width: "100%" }} min={0} />
        </Form.Item>

        {priced && (
          <Form.Item name="isImageRequired" label={t("catalogEntryModal.imageRequiredLabel")} valuePropName="checked">
            <Switch />
          </Form.Item>
        )}

        {isEdit && (
          <Form.Item name="isActive" label={t("catalogEntryModal.isActiveLabel")} valuePropName="checked">
            <Switch />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
