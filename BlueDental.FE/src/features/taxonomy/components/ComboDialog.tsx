import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Checkbox, Col, Form, Input, InputNumber, Row, Select } from "antd";
import { toast } from "sonner";
import {
  SERVICE_TAX_RATE,
  useCreateCatalogEntry,
  useUpdateCatalogEntry,
  type CatalogEntryDto,
  type ServiceStageDto,
  type ServiceTaxRate,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { computeComboPricing } from "../api/comboPricing";
import { rowsOf, useComboRows } from "../hooks/useComboRows";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { useLaboSupplierOptions } from "@/hooks/useLaboPickers";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { ComboComponentPicker } from "./ComboComponentPicker";
import { ComboItemsTable } from "./ComboItemsTable";
import { ComboPriceSection } from "./ComboPriceSection";
import { ServiceSettingsTabs } from "./ServiceSettingsTabs";

interface Props {
  open: boolean;
  /** The combo being edited; null for a new one. */
  entry: CatalogEntryDto | null;
  /** "Sao chép": a new combo that starts as a copy of this one. */
  copyOf?: CatalogEntryDto | null;
  groups: TaxonomyDto[];
  defaultTaxonomyId?: string;
  kindSwitch?: ReactNode;
  onClose: () => void;
}

interface FormValues {
  name: string;
  taxonomyId: string;
  detailName: string;
  isDeleted: boolean;
  description: string;
  priority: number;
  taxRate: ServiceTaxRate;
  priceIncludesTax: boolean;
  unit: string;
  requireImage: boolean;
  deductDoctorOnWarranty: boolean;
  separateRevenue: boolean;
  showToothOnInvoice: boolean;
  revenueByStage: boolean;
  requireStageSequence: boolean;
  warrantyDays: number;
  stageDraft: string;
  laboSupplierIds: string[];
}

/**
 * "Thêm dịch vụ" with Loại: Combo (review P0510): a combo of single services
 * sold at one price. The left "Danh mục" picks its services; the table holds
 * their quantities and combo prices; the price block follows the table; the
 * four setting tabs are the service dialog's own.
 */
export function ComboDialog({ open, entry, copyOf, groups, defaultTaxonomyId, kindSwitch, onClose }: Props) {
  const branchId = useCurrentBranchId();
  const createEntry = useCreateCatalogEntry();
  const updateEntry = useUpdateCatalogEntry();
  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";
  const taxonomyId = Form.useWatch("taxonomyId", form) ?? "";
  const isDeleted = Form.useWatch("isDeleted", form) ?? false;
  const taxRate = Form.useWatch("taxRate", form) ?? SERVICE_TAX_RATE.NotTaxable;
  const priceIncludesTax = Form.useWatch("priceIncludesTax", form) ?? false;
  const combo = useComboRows();
  const [stages, setStages] = useState<ServiceStageDto[]>([]);
  const suppliers = useLaboSupplierOptions(branchId, open);

  // Read through a ref so a refetch while the dialog is open never resets it.
  const defaults = useRef({ defaultTaxonomyId, groups });
  defaults.current = { defaultTaxonomyId, groups };

  useEffect(() => {
    if (!open) return;
    const source = entry ?? copyOf ?? null;
    const config = source?.serviceConfig;
    const fallback = defaults.current.defaultTaxonomyId ?? defaults.current.groups[0]?.id ?? "";

    form.setFieldsValue({
      name: copyOf && !entry ? t("Taxonomy:Combo:CopyName", copyOf.name) : (entry?.name ?? ""),
      taxonomyId: source?.taxonomyId ?? fallback,
      detailName: source?.detailName ?? "",
      isDeleted: entry?.isDeleted ?? false,
      description: source?.description ?? "",
      priority: source?.sortOrder ?? 0,
      taxRate: config?.taxRate ?? SERVICE_TAX_RATE.NotTaxable,
      priceIncludesTax: config?.priceIncludesTax ?? false,
      unit: source?.unit ?? "",
      requireImage: config?.requireImage ?? false,
      deductDoctorOnWarranty: config?.deductDoctorOnWarranty ?? false,
      separateRevenue: config?.separateRevenue ?? false,
      showToothOnInvoice: config?.showToothOnInvoice ?? false,
      revenueByStage: config?.revenueByStage ?? false,
      requireStageSequence: config?.requireStageSequence ?? false,
      warrantyDays: config?.warrantyDays ?? 0,
      stageDraft: "",
      laboSupplierIds: config?.laboSupplierIds ?? [],
    });
    combo.reset(rowsOf(source));
    // A copy gets steps of its own, not the original's ids.
    setStages((source?.stages ?? []).map((stage) => (entry ? stage : { ...stage, id: undefined })));
  }, [open, entry, copyOf, form, combo.reset]);

  const pricing = useMemo(
    () => computeComboPricing({ rows: combo.rows, taxRate, priceIncludesTax }),
    [combo.rows, taxRate, priceIncludesTax],
  );

  const submit = async (values: FormValues) => {
    const shared = {
      taxonomyId: values.taxonomyId,
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
      detailName: values.detailName?.trim() || null,
      unit: values.unit?.trim() || null,
      sortOrder: Number(values.priority) || 0,
      stages,
      comboItems: combo.rows.map(({ componentEntryId, quantity, unitPrice }) => ({
        componentEntryId,
        quantity,
        unitPrice,
      })),
      // A combo carries no discount of its own: its saving is the rows' prices.
      serviceConfig: {
        taxRate: values.taxRate,
        priceIncludesTax: values.priceIncludesTax,
        discountIsPercent: true,
        discountValue: 0,
        requireImage: values.requireImage,
        deductDoctorOnWarranty: values.deductDoctorOnWarranty,
        separateRevenue: values.separateRevenue,
        showToothOnInvoice: values.showToothOnInvoice,
        revenueByStage: values.revenueByStage,
        requireStageSequence: values.requireStageSequence,
        warrantyDays: Number(values.warrantyDays ?? 0),
        laboSupplierIds: values.laboSupplierIds ?? [],
      },
    };

    try {
      if (entry) {
        await updateEntry.mutateAsync({
          id: entry.id,
          input: { ...shared, isActive: entry.isActive, isDeleted: values.isDeleted },
        });
        toast.success(values.isDeleted ? t("Common:Deleted") : t("Taxonomy:Combo:UpdatedSuccess"));
      } else {
        await createEntry.mutateAsync({ clinicBranchId: branchId, isCombo: true, ...shared });
        toast.success(t("Taxonomy:Combo:CreatedSuccess"));
      }
      onClose();
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  return (
    <AppDialog
      open={open}
      title={entry ? t("Taxonomy:Combo:UpdateTitle") : t("Taxonomy:Service:CreateTitle")}
      width="min(1180px, calc(100vw - 32px))"
      className="bd-combo-dialog"
      canSave={name.trim().length > 0 && taxonomyId.length > 0 && combo.rows.length > 0}
      saving={createEntry.isPending || updateEntry.isPending}
      saveLabel={t("Taxonomy:Combo:Save")}
      cancelLabel={t("Common:Cancel")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <div className="bd-combo-layout">
        <ComboComponentPicker branchId={branchId} groups={groups} rows={combo.rows} onAdd={combo.add} />

        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          className="bd-min0"
          onFinish={(values) => void submit(values)}
        >
          {kindSwitch}

          <Row gutter={[16, { xs: 20, sm: 12 }]}>
            <Col xs={24} sm={8}>
              <FloatingField
                name="name"
                label={t("Taxonomy:Combo:Name")}
                required
                rules={[{ required: true, message: t("Taxonomy:Combo:NameRequired") }]}
              >
                <Input autoFocus />
              </FloatingField>
            </Col>
            <Col xs={24} sm={8}>
              <FloatingField
                name="taxonomyId"
                label={t("Taxonomy:Service:ClassificationLabel")}
                required
                rules={[{ required: true, message: t("Taxonomy:Service:ClassificationRequired") }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={groups.map((group) => ({ value: group.id, label: group.name }))}
                />
              </FloatingField>
            </Col>
            <Col xs={24} sm={8}>
              <FloatingField name="detailName" label={t("Taxonomy:Service:DetailName")}>
                <Input />
              </FloatingField>
            </Col>
          </Row>

          {/* One state drawn as two boxes, as on the service dialog. */}
          <div className="bd-dialog-row bd-mb2">
            <Checkbox checked={!isDeleted} disabled={!entry} onChange={() => form.setFieldValue("isDeleted", false)}>
              {t("Taxonomy:Catalog:IsActive")}
            </Checkbox>
            <Checkbox checked={isDeleted} disabled={!entry} onChange={() => form.setFieldValue("isDeleted", true)}>
              {t("Taxonomy:Catalog:IsDeleted")}
            </Checkbox>
          </div>
          <Form.Item name="isDeleted" hidden>
            <Input />
          </Form.Item>

          <FloatingField name="description" label={t("Taxonomy:Catalog:Description")}>
            <Input.TextArea rows={3} />
          </FloatingField>

          <Row gutter={[16, { xs: 20, sm: 12 }]}>
            <Col xs={24} sm={12}>
              <FloatingField name="priority" label={t("Common:Priority")}>
                <InputNumber min={0} style={{ width: "100%" }} />
              </FloatingField>
            </Col>
          </Row>

          <ComboItemsTable rows={combo.rows} pricing={pricing} onChange={combo.update} onRemove={combo.remove} />
          <ComboPriceSection pricing={pricing} />

          <ServiceSettingsTabs
            stages={stages}
            onStagesChange={setStages}
            suppliers={suppliers.data ?? []}
            suppliersLoading={suppliers.isPending}
          />
        </Form>
      </div>
    </AppDialog>
  );
}
