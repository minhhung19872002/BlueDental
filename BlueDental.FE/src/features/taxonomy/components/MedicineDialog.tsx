import { Col, Form, Input, InputNumber, Row, Select, message } from "antd";
import { useEffect, useRef } from "react";
import {
  useCreateCatalogEntry,
  useUpdateCatalogEntry,
  type CatalogEntryDto,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { extractApiError } from "@/lib/apiError";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  entry: CatalogEntryDto | null;
  groups: TaxonomyDto[];
  defaultTaxonomyId?: string;
  onClose: () => void;
}

interface FormValues {
  name: string;
  taxonomyId: string;
  activeIngredient: string;
  usage: string;
  purchasePrice: number | null;
  salePrice: number | null;
  prescriptionCode: string;
  usageNote: string;
  unit: string;
  priority: number;
}

const EMPTY: FormValues = {
  name: "",
  taxonomyId: "",
  activeIngredient: "",
  usage: "",
  purchasePrice: 0,
  salePrice: null,
  prescriptionCode: "",
  usageNote: "",
  unit: "",
  priority: 0,
};

/** Blank text fields are stored as null, not as an empty string. */
const orNull = (value: string | undefined) => value?.trim() || null;

/**
 * Loại thuốc. The reference asks for seven fields here and — alone among the
 * catalogs — shows no "Đang hoạt động" / "Đã xoá" pair.
 */
export function MedicineDialog({ open, entry, groups, defaultTaxonomyId, onClose }: Props) {
  const branchId = useCurrentBranchId();
  const createEntry = useCreateCatalogEntry();
  const updateEntry = useUpdateCatalogEntry();

  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";
  const taxonomyId = Form.useWatch("taxonomyId", form) ?? "";

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
      activeIngredient: entry?.medicine?.activeIngredient ?? "",
      usage: entry?.medicine?.usage ?? "",
      purchasePrice: entry?.medicine?.purchasePrice ?? 0,
      salePrice: entry?.price ?? null,
      prescriptionCode: entry?.medicine?.prescriptionCode ?? "",
      usageNote: entry?.medicine?.usageNote ?? "",
      unit: entry?.unit ?? "",
      priority: entry?.sortOrder ?? 0,
    });
  }, [open, entry, form]);

  const pending = createEntry.isPending || updateEntry.isPending;

  const submit = async (values: FormValues) => {
    const trimmed = values.name.trim();

    const medicine = {
      activeIngredient: orNull(values.activeIngredient),
      usage: orNull(values.usage),
      purchasePrice: Number(values.purchasePrice ?? 0),
      prescriptionCode: orNull(values.prescriptionCode),
      usageNote: orNull(values.usageNote),
    };
    // The entry's own price is the selling price everything else quotes from.
    const price = values.salePrice == null ? null : Number(values.salePrice);
    const sortOrder = Number(values.priority) || 0;

    try {
      if (entry) {
        await updateEntry.mutateAsync({
          id: entry.id,
          input: {
            taxonomyId: values.taxonomyId,
            name: trimmed,
            code: entry.code ?? undefined,
            price,
            unit: orNull(values.unit),
            medicine,
            isActive: entry.isActive,
            sortOrder,
          },
        });
        message.success(t("Đã cập nhật loại thuốc"));
      } else {
        await createEntry.mutateAsync({
          clinicBranchId: branchId,
          taxonomyId: values.taxonomyId,
          name: trimmed,
          price,
          unit: orNull(values.unit),
          medicine,
          sortOrder,
        });
        message.success(t("Đã thêm loại thuốc"));
      }
      onClose();
    } catch (cause) {
      message.error(extractApiError(cause));
    }
  };

  return (
    <AppDialog
      open={open}
      title={entry ? t("Cập nhật loại thuốc") : t("Thêm loại thuốc")}
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
        initialValues={EMPTY}
        onFinish={(values) => void submit(values)}
      >
        <Row gutter={[16, 12]}>
          <Col span={12}>
            <FloatingField
              name="name"
              label={t("Tên thuốc")}
              required
              rules={[{ required: true, message: t("Vui lòng nhập tên thuốc") }]}
            >
              <Input autoFocus />
            </FloatingField>
          </Col>
          <Col span={12}>
            <FloatingField
              name="taxonomyId"
              label={t("Chọn nhóm thuốc")}
              required
              rules={[{ required: true, message: t("Vui lòng chọn nhóm thuốc") }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={groups.map((group) => ({ value: group.id, label: group.name }))}
              />
            </FloatingField>
          </Col>

          <Col span={12}>
            <FloatingField name="activeIngredient" label={t("Hoạt chất")}>
              <Input />
            </FloatingField>
          </Col>
          <Col span={12}>
            <FloatingField name="usage" label={t("Cách dùng")}>
              <Input />
            </FloatingField>
          </Col>

          <Col span={12}>
            <FloatingField name="purchasePrice" label={t("Giá mua")}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </FloatingField>
          </Col>
          <Col span={12}>
            <FloatingField name="salePrice" label={t("Giá bán")}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </FloatingField>
          </Col>

          <Col span={12}>
            <FloatingField name="prescriptionCode" label={t("Mã toa thuốc")}>
              <Input />
            </FloatingField>
          </Col>
          <Col span={12}>
            <FloatingField name="usageNote" label={t("Lưu ý sử dụng")}>
              <Input />
            </FloatingField>
          </Col>

          <Col span={12}>
            <FloatingField name="unit" label={t("Đơn vị tính")}>
              <Input />
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
