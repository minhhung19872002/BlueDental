import { Alert, Button, Checkbox, Col, Form, Input, InputNumber, Row, Segmented, Select } from "antd";
import { toast } from "sonner";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SyncOutlined, WarningOutlined } from "@ant-design/icons";
import {
  SERVICE_TAX_RATE,
  SERVICE_TAX_RATE_OPTIONS,
  useComboHolders,
  useCreateCatalogEntry,
  useUpdateCatalogEntry,
  type CatalogEntryDto,
  type ServiceStageDto,
  type ServiceTaxRate,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { AppDialog } from "@/components/AppDialog";
import { CurrencyInput } from "@/components/CurrencyInput";
import { FloatingField } from "@/components/FloatingField";
import { useLaboSupplierOptions } from "@/hooks/useLaboPickers";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { useServiceDialogSync } from "../hooks/useServiceDialogSync";
import { useServicePricePreview } from "../hooks/useServicePricePreview";
import { ComboHoldersNotice } from "./ComboHoldersNotice";
import { ServiceSettingsTabs } from "./ServiceSettingsTabs";

interface Props {
  open: boolean;
  entry: CatalogEntryDto | null;
  groups: TaxonomyDto[];
  defaultTaxonomyId?: string;
  /** "Loại: Dịch vụ lẻ | Combo", drawn above the form on a new entry. */
  kindSwitch?: ReactNode;
  onClose: () => void;
}

interface FormValues {
  name: string;
  taxonomyId: string;
  detailName: string;
  isActive: boolean;
  isDeleted: boolean;
  description: string;
  priority: number;

  taxRate: ServiceTaxRate;
  priceIncludesTax: boolean;
  price: number;
  discountIsPercent: boolean;
  discountValue: number;
  unit: string;

  requireImage: boolean;
  deductDoctorOnWarranty: boolean;
  separateRevenue: boolean;
  showToothOnInvoice: boolean;
  revenueByStage: boolean;
  requireStageSequence: boolean;
  warrantyDays: number;

  /** Typed into the "Công đoạn" box; becomes a row on the button, never saved. */
  stageDraft: string;
  laboSupplierIds: string[];
}

const EMPTY: FormValues = {
  name: "",
  taxonomyId: "",
  detailName: "",
  isActive: true,
  isDeleted: false,
  description: "",
  priority: 0,
  taxRate: SERVICE_TAX_RATE.NotTaxable,
  priceIncludesTax: false,
  price: 0,
  discountIsPercent: true,
  discountValue: 0,
  unit: "",
  requireImage: false,
  deductDoctorOnWarranty: false,
  separateRevenue: false,
  showToothOnInvoice: false,
  revenueByStage: false,
  requireStageSequence: false,
  warrantyDays: 0,
  stageDraft: "",
  laboSupplierIds: [],
};

/**
 * Dịch vụ — the reference's largest catalog dialog: the entry itself, a price
 * and tax block, and four tabs of settings (Cài đặt, Công đoạn, Bảo hành, Labo).
 *
 * "Giá sau giảm" and "Thực thu từ khách" follow the price inputs live, as the
 * reference's do; the formula is the domain's, mirrored in `servicePricing.ts`.
 */
export function ServiceDialog({ open, entry, groups, defaultTaxonomyId, kindSwitch, onClose }: Props) {
  const branchId = useCurrentBranchId();
  const createEntry = useCreateCatalogEntry();
  const updateEntry = useUpdateCatalogEntry();

  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";
  const taxonomyId = Form.useWatch("taxonomyId", form) ?? "";
  const isDeleted = Form.useWatch("isDeleted", form) ?? false;
  // Ticking "Đã xoá" on a live service takes it out of its combos on Lưu.
  const deleting = open && isDeleted && entry?.isDeleted === false;
  const comboHolders = useComboHolders(entry?.id, deleting);
  const pricing = useServicePricePreview(form);
  const partnerSync = useServiceDialogSync(branchId, open);

  /** The stage list is a small editor of its own, not a single field. */
  const [stages, setStages] = useState<ServiceStageDto[]>([]);
  const suppliers = useLaboSupplierOptions(branchId, open);

  // React Query hands back a new array on every refetch, so these are read
  // through a ref: a refetch landing while the dialog is open must not reset
  // the form under the user's hands.
  const defaults = useRef({ defaultTaxonomyId, groups });
  defaults.current = { defaultTaxonomyId, groups };

  useEffect(() => {
    if (!open) return;
    const fallback = defaults.current.defaultTaxonomyId ?? defaults.current.groups[0]?.id ?? "";
    const config = entry?.serviceConfig;

    form.setFieldsValue({
      name: entry?.name ?? "",
      taxonomyId: entry?.taxonomyId ?? fallback,
      detailName: entry?.detailName ?? "",
      isActive: entry?.isActive ?? true,
      isDeleted: entry?.isDeleted ?? false,
      description: entry?.description ?? "",
      priority: entry?.sortOrder ?? 0,

      taxRate: config?.taxRate ?? SERVICE_TAX_RATE.NotTaxable,
      priceIncludesTax: config?.priceIncludesTax ?? false,
      price: entry?.price ?? 0,
      discountIsPercent: config?.discountIsPercent ?? true,
      discountValue: config?.discountValue ?? 0,
      unit: entry?.unit ?? "",

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

    setStages(entry?.stages ?? []);
  }, [open, entry, form]);

  const pending = createEntry.isPending || updateEntry.isPending;

  const submit = async (values: FormValues) => {
    const trimmed = values.name.trim();

    const serviceConfig = {
      taxRate: values.taxRate,
      priceIncludesTax: values.priceIncludesTax,
      discountIsPercent: values.discountIsPercent,
      discountValue: Number(values.discountValue ?? 0),
      requireImage: values.requireImage,
      deductDoctorOnWarranty: values.deductDoctorOnWarranty,
      separateRevenue: values.separateRevenue,
      showToothOnInvoice: values.showToothOnInvoice,
      revenueByStage: values.revenueByStage,
      requireStageSequence: values.requireStageSequence,
      warrantyDays: Number(values.warrantyDays ?? 0),
      laboSupplierIds: values.laboSupplierIds ?? [],
    };
    const shared = {
      taxonomyId: values.taxonomyId,
      name: trimmed,
      price: Number(values.price ?? 0),
      description: values.description?.trim() || undefined,
      detailName: values.detailName?.trim() || null,
      unit: values.unit?.trim() || null,
      serviceConfig,
      stages,
      sortOrder: Number(values.priority) || 0,
    };

    try {
      let saved: CatalogEntryDto;
      if (entry) {
        saved = await updateEntry.mutateAsync({
          id: entry.id,
          input: { ...shared, isActive: values.isActive, isDeleted: values.isDeleted },
        });

        toast.success(values.isDeleted ? t("Common:Deleted") : t("Taxonomy:Service:UpdatedSuccess"));
      } else {
        saved = await createEntry.mutateAsync({ clinicBranchId: branchId, ...shared });
        toast.success(t("Taxonomy:Service:CreatedSuccess"));
      }

      // With partner sync on, the reference keeps the dialog open so the
      // service just saved can be sent at once.
      if (partnerSync.syncEnabled) {
        partnerSync.markSaved(saved.id);
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
      title={entry ? t("Taxonomy:Service:UpdateTitle") : t("Taxonomy:Service:CreateTitle")}
      width={820}
      canSave={name.trim().length > 0 && taxonomyId.length > 0 && !partnerSync.savedId}
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
      footerActions={
        partnerSync.savedId ? (
          <Button
            icon={<SyncOutlined />}
            title={t("Taxonomy:Sync:ThisServiceHint")}
            loading={partnerSync.isSyncing}
            disabled={partnerSync.isSyncing}
            onClick={() => partnerSync.syncSaved(onClose)}
          >
            {t("Taxonomy:Sync:ThisService")}
          </Button>
        ) : null
      }
    >
      {entry && partnerSync.syncEnabled && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          className="bd-sync-notice"
          title={t("Taxonomy:Sync:NoticeTitle")}
          description={t("Taxonomy:Sync:NoticeBody")}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={EMPTY}
        onFinish={(values) => void submit(values)}
      >
        {kindSwitch}

        <Row gutter={[16, { xs: 20, sm: 12 }]}>
          <Col xs={24} sm={8}>
            <FloatingField
              name="name"
              label={t("Taxonomy:Service:ServiceLabel")}
              required
              rules={[{ required: true, message: t("Taxonomy:Service:ServiceNameRequired") }]}
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

        {/* One state, drawn as the reference draws it: two boxes of which
            exactly one is ticked. */}
        <div className="bd-dialog-row bd-mb2">
          <Checkbox
            checked={!isDeleted}
            disabled={!entry}
            onChange={() => form.setFieldValue("isDeleted", false)}
          >
            {t("Taxonomy:Catalog:IsActive")}
          </Checkbox>
          <Checkbox
            checked={isDeleted}
            disabled={!entry}
            onChange={() => form.setFieldValue("isDeleted", true)}
          >
            {t("Taxonomy:Catalog:IsDeleted")}
          </Checkbox>
          {deleting && <ComboHoldersNotice holders={comboHolders.data} />}
        </div>
        <Form.Item name="isDeleted" hidden>
          <Input />
        </Form.Item>

        <FloatingField name="description" label={t("Taxonomy:Catalog:Description")}>
          <Input.TextArea rows={3} />
        </FloatingField>

        {/* The reference dropped its "Mã dịch vụ" box; the code is still
            generated on the server when the entry is created. */}
        <Row gutter={[16, { xs: 20, sm: 12 }]}>
          <Col xs={24} sm={12}>
            <FloatingField name="priority" label={t("Common:Priority")}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </FloatingField>
          </Col>
        </Row>

        {/* ── Cấu hình giá & thuế ─────────────────────────────────────── */}
        <div className="bd-dialog-section">
          <div className="bd-dialog-section-head">
            <p className="bd-dialog-section-title">{t("Taxonomy:Service:PriceTaxSection")}</p>
            <FloatingField name="taxRate" label={t("Taxonomy:Service:TaxRateLabel")} className="bd-w160">
              <Select
                options={SERVICE_TAX_RATE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
            </FloatingField>
          </div>

          <Row gutter={[16, { xs: 20, sm: 12 }]} align="middle" className="bd-svc-price-row">
            <Col flex="none">
              <Form.Item name="priceIncludesTax" noStyle>
                <TaxSegmented />
              </Form.Item>
            </Col>
            <Col flex="auto">
              <FloatingField name="price" label={t("Taxonomy:Service:PriceLabel")}>
                <CurrencyInput />
              </FloatingField>
            </Col>
            <Col flex="none">
              <Form.Item name="discountIsPercent" noStyle>
                <DiscountSegmented />
              </Form.Item>
            </Col>
            <Col flex="auto">
              <FloatingField name="discountValue" label={t("Taxonomy:Service:DiscountLabel")}>
                <CurrencyInput />
              </FloatingField>
            </Col>
          </Row>

          <Row gutter={[16, { xs: 20, sm: 12 }]}>
            {/* Read-only: priced live from the inputs above, whole đồng. */}
            <Col xs={24} sm={8}>
              <FloatingField label={t("Taxonomy:Service:PriceAfterDiscount")}>
                <Input readOnly value={formatVND(pricing.priceAfterDiscount)} />
              </FloatingField>
            </Col>
            <Col xs={24} sm={8}>
              <FloatingField name="unit" label={t("Taxonomy:Service:Unit")}>
                <Input />
              </FloatingField>
            </Col>
            <Col xs={24} sm={8}>
              <FloatingField label={t("Taxonomy:Service:AmountCollected")}>
                <Input readOnly value={formatVND(pricing.amountCollected)} />
              </FloatingField>
            </Col>
          </Row>
        </div>

        {/* ── Cài đặt | Công đoạn | Bảo hành | Labo ───────────────────── */}
        <ServiceSettingsTabs
          stages={stages}
          onStagesChange={setStages}
          suppliers={suppliers.data ?? []}
          suppliersLoading={suppliers.isPending}
        />
      </Form>
    </AppDialog>
  );
}

/**
 * The price toggle stores a boolean but reads as two words, so it translates
 * between the two for whichever Form.Item holds it.
 */
export function TaxSegmented({
  value,
  onChange,
}: {
  value?: boolean;
  onChange?: (next: boolean) => void;
}) {
  return (
    <Segmented
      value={value ? "after" : "before"}
      onChange={(next) => onChange?.(next === "after")}
      options={[
        { value: "before", label: t("Taxonomy:Service:BeforeTax") },
        { value: "after", label: t("Taxonomy:Service:AfterTax") },
      ]}
    />
  );
}

function DiscountSegmented({
  value,
  onChange,
}: {
  value?: boolean;
  onChange?: (next: boolean) => void;
}) {
  return (
    <Segmented
      value={value ? "percent" : "vnd"}
      onChange={(next) => onChange?.(next === "percent")}
      options={[
        { value: "percent", label: "%" },
        { value: "vnd", label: "VNĐ" },
      ]}
    />
  );
}
