import { Button, Checkbox, Col, Form, Input, InputNumber, Row, Segmented, Select, Table, Tabs, Tooltip } from "antd";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  SERVICE_TAX_RATE,
  SERVICE_TAX_RATE_OPTIONS,
  WARRANTY_PRESETS,
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
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";

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
  detailName: string;
  isActive: boolean;
  isDeleted: boolean;
  description: string;
  priority: number;
  code: string;

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
}

const EMPTY: FormValues = {
  name: "",
  taxonomyId: "",
  detailName: "",
  isActive: true,
  isDeleted: false,
  description: "",
  priority: 0,
  code: "",
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
};

/** Labels for the reference's fixed row of warranty choices. */
function warrantyLabel(days: number): string {
  if (days === 0) return t("Taxonomy:Service:WarrantyNone");
  if (days === 365) return t("Taxonomy:Service:Warranty1Year");
  if (days === 730) return t("Taxonomy:Service:Warranty2Years");
  return t("Taxonomy:Service:WarrantyMonths", String(Math.round(days / 30)));
}

/** One labelled checkbox with an optional explanation under it. */
function CheckRow({
  name,
  label,
  hint,
}: {
  name: keyof FormValues;
  label: string;
  hint?: string;
}) {
  return (
    <div className="bd-check-row">
      <Form.Item name={name} valuePropName="checked" noStyle>
        <Checkbox>{label}</Checkbox>
      </Form.Item>
      {hint && <p className="bd-check-hint">{hint}</p>}
    </div>
  );
}

/**
 * Dịch vụ — the reference's largest catalog dialog: the entry itself, a price
 * and tax block, and three tabs of settings.
 *
 * "Giá sau giảm" and "Thực thu từ khách" are shown from the server's own
 * numbers after a save rather than recomputed here, so the browser and the
 * domain can never disagree about the formula.
 */
export function ServiceDialog({ open, entry, groups, defaultTaxonomyId, onClose }: Props) {
  const branchId = useCurrentBranchId();
  const createEntry = useCreateCatalogEntry();
  const updateEntry = useUpdateCatalogEntry();

  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";
  const taxonomyId = Form.useWatch("taxonomyId", form) ?? "";
  const warrantyDays = Form.useWatch("warrantyDays", form) ?? 0;
  const isDeleted = Form.useWatch("isDeleted", form) ?? false;

  /** The stage list is a small editor of its own, not a single field. */
  const [stages, setStages] = useState<ServiceStageDto[]>([]);
  const [stageName, setStageName] = useState("");

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
      code: entry?.code ?? "",

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
    });

    setStages(entry?.stages ?? []);
    setStageName("");
  }, [open, entry, form]);

  const pending = createEntry.isPending || updateEntry.isPending;

  const addStage = () => {
    const trimmed = stageName.trim();
    if (!trimmed) return;
    setStages((current) => [...current, { name: trimmed, value: 0 }]);
    setStageName("");
  };

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
    };
    const shared = {
      taxonomyId: values.taxonomyId,
      name: trimmed,
      code: values.code?.trim() || undefined,
      price: Number(values.price ?? 0),
      description: values.description?.trim() || undefined,
      detailName: values.detailName?.trim() || null,
      unit: values.unit?.trim() || null,
      serviceConfig,
      stages,
      sortOrder: Number(values.priority) || 0,
    };

    try {
      if (entry) {
        await updateEntry.mutateAsync({
          id: entry.id,
          input: { ...shared, isActive: values.isActive, isDeleted: values.isDeleted },
        });

        toast.success(values.isDeleted ? t("Common:Deleted") : t("Taxonomy:Service:UpdatedSuccess"));
      } else {
        await createEntry.mutateAsync({ clinicBranchId: branchId, ...shared });
        toast.success(t("Taxonomy:Service:CreatedSuccess"));
      }
      onClose();
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  const saved = entry?.serviceConfig;

  const stageColumns = useMemo<ColumnsType<ServiceStageDto>>(
    () => [
      {
        key: "index",
        title: t("Taxonomy:Service:StageSeqCol"),
        width: 64,
        render: (_, __, index) => <span className="bd-muted-text">{index + 1}</span>,
      },
      { key: "name", title: t("Taxonomy:Service:StageNameCol"), dataIndex: "name" },
      {
        key: "value",
        title: t("Taxonomy:Service:StageValueCol"),
        width: 180,
        render: (_, stage, index) => (
          <CurrencyInput
            aria-label={t("Taxonomy:Service:StageValueAria", stage.name)}
            value={stage.value}
            onChange={(next) =>
              setStages((current) =>
                current.map((item, at) =>
                  at === index ? { ...item, value: next ?? 0 } : item,
                ),
              )
            }
          />
        ),
      },
      {
        key: "actions",
        title: t("Common:Actions"),
        width: 90,
        align: "center",
        fixed: "right",
        render: (_, stage, index) => (
          <Tooltip title={t("Common:Delete")}>
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              aria-label={t("Taxonomy:Service:StageDeleteAria", stage.name)}
              onClick={() => setStages((current) => current.filter((_, at) => at !== index))}
            />
          </Tooltip>
        ),
      },
    ],
    [],
  );

  return (
    <AppDialog
      open={open}
      title={entry ? t("Taxonomy:Service:UpdateTitle") : t("Taxonomy:Service:CreateTitle")}
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
          <Col xs={24} sm={12}>
            <FloatingField
              name="code"
              label={t("Taxonomy:Service:CodeLabel")}
            >
              <Input />
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
            {/* Read-only: these two come back from the server after a save, so
                the formula lives in one place. */}
            <Col xs={24} sm={8}>
              <FloatingField label={t("Taxonomy:Service:PriceAfterDiscount")}>
                <Input readOnly value={saved ? formatVND(saved.priceAfterDiscount) : "—"} />
              </FloatingField>
            </Col>
            <Col xs={24} sm={8}>
              <FloatingField name="unit" label={t("Taxonomy:Service:Unit")}>
                <Input />
              </FloatingField>
            </Col>
            <Col xs={24} sm={8}>
              <FloatingField label={t("Taxonomy:Service:AmountCollected")}>
                <Input readOnly value={saved ? formatVND(saved.amountCollected) : "—"} />
              </FloatingField>
            </Col>
          </Row>
        </div>

        {/* ── Cài đặt | Công đoạn | Bảo hành ──────────────────────────── */}
        <Tabs
          className="bd-dialog-tabs"
          items={[
            {
              key: "settings",
              label: t("Taxonomy:Service:Settings"),
              children: (
                <div className="bd-check-list">
                  <CheckRow name="requireImage" label={t("Taxonomy:Service:RequireImage")} />
                  <CheckRow
                    name="deductDoctorOnWarranty"
                    label={t("Taxonomy:Service:DeductOnWarranty")}
                  />
                  <CheckRow name="separateRevenue" label={t("Taxonomy:Service:SeparateRevenue")} />
                  <CheckRow name="showToothOnInvoice" label={t("Taxonomy:Service:ShowToothInvoice")} />
                </div>
              ),
            },
            {
              key: "stages",
              label: t("Taxonomy:Service:Stages"),
              children: (
                <div className="bd-check-list">
                  <CheckRow
                    name="revenueByStage"
                    label={t("Taxonomy:Service:RevenueByStage")}
                    hint={t("Taxonomy:Service:RevenueByStageHint")}
                  />
                  <CheckRow
                    name="requireStageSequence"
                    label={t("Taxonomy:Service:RequireSequence")}
                    hint={t(
                      "Tắt: Bác sĩ chỉ nhận hoa hồng trên các công đoạn dịch vụ đã hoàn thành",
                    )}
                  />

                  <Row gutter={[8, 12]} className="bd-mt3">
                    <Col flex="auto">
                      <Input
                        aria-label={t("Taxonomy:Service:StageName")}
                        placeholder={t("Taxonomy:Service:StageName")}
                        value={stageName}
                        onChange={(event) => setStageName(event.target.value)}
                        onPressEnter={(event) => {
                          event.preventDefault();
                          addStage();
                        }}
                      />
                    </Col>
                    <Col flex="none">
                      <Button icon={<PlusOutlined />} onClick={addStage}>
                        {t("Taxonomy:Service:Stages")}
                      </Button>
                    </Col>
                  </Row>

                  <Table<ServiceStageDto>
                    className="bd-line-table bd-mt3"
                    columns={stageColumns}
                    dataSource={stages}
                    rowKey={(stage, index) => stage.id ?? `${stage.name}-${index}`}
                    pagination={false}
                    size="small"
                    scroll={{ x: "max-content" }}
                    locale={{ emptyText: t("Taxonomy:Service:NoStages") }}
                  />
                </div>
              ),
            },
            {
              key: "warranty",
              label: t("Taxonomy:Service:Warranty"),
              children: (
                <div className="bd-check-list">
                  <Row gutter={[16, 8]}>
                    {WARRANTY_PRESETS.map((days) => (
                      <Col xs={12} sm={8} key={days}>
                        <Checkbox
                          // The reference shows these as checkboxes but only one
                          // period can be in force, so picking one clears the rest.
                          checked={warrantyDays === days}
                          onChange={() => form.setFieldValue("warrantyDays", days)}
                        >
                          {warrantyLabel(days)}
                        </Checkbox>
                      </Col>
                    ))}
                  </Row>

                  <Row gutter={[16, { xs: 20, sm: 12 }]} className="bd-mt3">
                    <Col xs={24} sm={12}>
                      <FloatingField name="warrantyDays" label={t("Taxonomy:Service:Custom")}>
                        <InputNumber min={0} style={{ width: "100%" }} />
                      </FloatingField>
                    </Col>
                  </Row>
                  <p className="bd-cat-hint">{t("Taxonomy:Service:UnitDays")}</p>
                </div>
              ),
            },
          ]}
        />
      </Form>
    </AppDialog>
  );
}

/**
 * The price toggle stores a boolean but reads as two words, so it translates
 * between the two for whichever Form.Item holds it.
 */
function TaxSegmented({
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
