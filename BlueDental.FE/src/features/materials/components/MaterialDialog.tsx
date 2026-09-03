import { Col, DatePicker, Form, Input, Row, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  useCreateSupply,
  useUpdateSupply,
  type SupplyDto,
} from "../api/suppliesApi";
import { AppDialog } from "@/components/AppDialog";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FloatingField } from "@/components/FloatingField";
import type { TaxonomyGroup } from "@/hooks/useTaxonomyGroups";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import "./materials.css";

/** The reference starts every new material at fifteen days' warning. */
const DEFAULT_WARNING_DAYS = 15;

interface FormValues {
  name: string;
  taxonomyId: string;
  quantity: string;
  expiryWarningDays: string;
  supplier: string;
  origin: string;
  unitCost: number | null;
  salePrice: number | null;
  stockedAt: Dayjs | null;
  expiryDate: Dayjs | null;
}

interface Props {
  open: boolean;
  /** null adds a material, otherwise edits this one. */
  material: SupplyDto | null;
  groups: TaxonomyGroup[];
  /** The group the panel has selected, which a new material lands in. */
  defaultTaxonomyId: string | null;
  onClose: () => void;
}

function toNumber(raw: string): number {
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * "Thêm vật tư" — the whole material in one form.
 *
 * The reference collects its first stock and both dates here rather than making
 * you save the material and then receive stock into it, so this does too.
 */
export function MaterialDialog({
  open,
  material,
  groups,
  defaultTaxonomyId,
  onClose,
}: Props) {
  const branchId = useCurrentBranchId();
  const createSupply = useCreateSupply();
  const updateSupply = useUpdateSupply();

  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";
  const taxonomyId = Form.useWatch("taxonomyId", form) ?? "";

  useEffect(() => {
    if (!open) return;

    form.setFieldsValue({
      name: material?.name ?? "",
      taxonomyId: material?.taxonomyId ?? defaultTaxonomyId ?? "",
      quantity: String(material?.quantityOnHand ?? ""),
      expiryWarningDays: String(material?.expiryWarningDays ?? DEFAULT_WARNING_DAYS),
      supplier: material?.supplier ?? "",
      origin: material?.origin ?? "",
      unitCost: material?.unitCost ?? null,
      salePrice: material?.salePrice ?? null,
      // A new material is normally being entered because a delivery arrived
      // today, which is the date the reference fills in.
      stockedAt: material?.stockedAt ? dayjs(material.stockedAt) : dayjs(),
      expiryDate: material?.expiryDate ? dayjs(material.expiryDate) : null,
    });
  }, [open, material, defaultTaxonomyId, form]);

  const pending = createSupply.isPending || updateSupply.isPending;

  const submit = async (values: FormValues) => {
    const shared = {
      name: values.name.trim(),
      taxonomyId: values.taxonomyId || undefined,
      supplier: values.supplier.trim() || undefined,
      origin: values.origin.trim() || undefined,
      unitCost: values.unitCost,
      salePrice: values.salePrice,
      reorderLevel: material?.reorderLevel ?? 0,
    };

    try {
      if (material) {
        await updateSupply.mutateAsync({ id: material.id, input: shared });
        toast.success(t("Đã cập nhật vật tư"));
      } else {
        await createSupply.mutateAsync({
          ...shared,
          branchId,
          // The reference shows no code field, so one is derived rather than
          // asked for; it is what the list keys and searches on.
          itemCode: `VT${Date.now().toString().slice(-8)}`,
          quantity: toNumber(values.quantity),
          expiryWarningDays: toNumber(values.expiryWarningDays) || DEFAULT_WARNING_DAYS,
          stockedAt: values.stockedAt?.format("YYYY-MM-DD"),
          expiryDate: values.expiryDate?.format("YYYY-MM-DD"),
        });
        toast.success(t("Đã thêm vật tư"));
      }
      onClose();
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  return (
    <AppDialog
      open={open}
      title={material ? t("Sửa vật tư") : t("Thêm vật tư")}
      width={770}
      canSave={name.trim().length > 0 && taxonomyId.length > 0}
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={(values) => void submit(values)}
      >
        <Row gutter={[16, { xs: 20, sm: 12 }]}>
          <Col xs={24} sm={12}>
            <FloatingField
              name="name"
              label={t("Tên vật tư")}
              required
              rules={[{ required: true, message: t("Vui lòng nhập tên vật tư") }]}
            >
              <Input autoFocus />
            </FloatingField>
          </Col>
          <Col xs={24} sm={12}>
            <FloatingField
              name="taxonomyId"
              label={t("Nhóm phân loại")}
              required
              rules={[{ required: true, message: t("Vui lòng chọn nhóm phân loại") }]}
            >
              <Select
                options={groups.map((group) => ({ value: group.id, label: group.name }))}
              />
            </FloatingField>
          </Col>

          <Col xs={24} sm={12}>
            <FloatingField name="quantity" label={t("Số lượng")}>
              <Input inputMode="numeric" />
            </FloatingField>
          </Col>
          <Col xs={24} sm={12}>
            <FloatingField name="expiryWarningDays" label={t("Cảnh báo hết hạn (ngày)")}>
              <Input inputMode="numeric" />
            </FloatingField>
          </Col>

          <Col xs={24} sm={12}>
            <FloatingField name="supplier" label={t("Nhà sản xuất")}>
              <Input />
            </FloatingField>
          </Col>
          <Col xs={24} sm={12}>
            <FloatingField name="origin" label={t("Xuất xứ")}>
              <Input />
            </FloatingField>
          </Col>

          <Col xs={24} sm={12}>
            <FloatingField name="unitCost" label={t("Giá nhập")}>
              <CurrencyInput />
            </FloatingField>
          </Col>
          <Col xs={24} sm={12}>
            <FloatingField name="salePrice" label={t("Giá bán")}>
              <CurrencyInput />
            </FloatingField>
          </Col>

          <Col xs={12} sm={12}>
            <FloatingField name="stockedAt" label={t("Ngày nhập kho")}>
              <DatePicker format="DD/MM/YYYY" className="bd-mat-datepicker" />
            </FloatingField>
          </Col>
          <Col xs={12} sm={12}>
            <FloatingField name="expiryDate" label={t("Hạn sử dụng")}>
              <DatePicker format="DD/MM/YYYY" className="bd-mat-datepicker" />
            </FloatingField>
          </Col>
        </Row>
      </Form>
    </AppDialog>
  );
}
