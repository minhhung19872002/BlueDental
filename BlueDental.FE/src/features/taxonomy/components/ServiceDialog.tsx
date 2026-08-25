import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  SERVICE_TAX_RATE,
  SERVICE_TAX_RATE_OPTIONS,
  WARRANTY_PRESETS,
  useCreateCatalogEntry,
  useDeleteCatalogEntry,
  useUpdateCatalogEntry,
  type CatalogEntryDto,
  type ServiceStageDto,
  type ServiceTaxRate,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { FloatingSelect } from "@/components/FloatingSelect";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { extractApiError } from "@/lib/apiError";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";

interface Props {
  open: boolean;
  entry: CatalogEntryDto | null;
  groups: TaxonomyDto[];
  defaultTaxonomyId?: string;
  onClose: () => void;
}

type SettingsTab = "settings" | "stages" | "warranty";

const number = (value: string) => {
  const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
};

/** Labels for the reference's fixed row of warranty choices. */
function warrantyLabel(days: number): string {
  if (days === 0) return t("Không bảo hành");
  if (days === 365) return t("Bảo hành 1 năm");
  if (days === 730) return t("Bảo hành 2 năm");
  return t("Bảo hành {0} tháng", String(Math.round(days / 30)));
}

/** One labelled checkbox, the shape the reference repeats down these tabs. */
function CheckRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={id}
        checked={checked}
        className="mt-0.5"
        onCheckedChange={(next) => onChange(next === true)}
      />
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer text-[14px] text-app-ink">
          {label}
        </Label>
        {hint && <p className="mt-0.5 text-[12px] text-app-label">{hint}</p>}
      </div>
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
  const deleteEntry = useDeleteCatalogEntry();

  const [name, setName] = useState("");
  const [taxonomyId, setTaxonomyId] = useState("");
  const [detailName, setDetailName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isDeleted, setIsDeleted] = useState(false);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("0");
  const [code, setCode] = useState("");

  const [taxRate, setTaxRate] = useState<ServiceTaxRate>(SERVICE_TAX_RATE.NotTaxable);
  const [priceIncludesTax, setPriceIncludesTax] = useState(false);
  const [price, setPrice] = useState("0");
  const [discountIsPercent, setDiscountIsPercent] = useState(true);
  const [discountValue, setDiscountValue] = useState("0");
  const [unit, setUnit] = useState("");

  const [requireImage, setRequireImage] = useState(false);
  const [deductDoctorOnWarranty, setDeductDoctorOnWarranty] = useState(false);
  const [separateRevenue, setSeparateRevenue] = useState(false);
  const [showToothOnInvoice, setShowToothOnInvoice] = useState(false);
  const [revenueByStage, setRevenueByStage] = useState(false);
  const [requireStageSequence, setRequireStageSequence] = useState(false);
  const [warrantyDays, setWarrantyDays] = useState(0);

  const [stages, setStages] = useState<ServiceStageDto[]>([]);
  const [stageName, setStageName] = useState("");
  const [tab, setTab] = useState<SettingsTab>("settings");
  const [error, setError] = useState<string | null>(null);

  // React Query hands back a new array on every refetch, so these are read
  // through a ref: a refetch landing while the dialog is open must not reset
  // the form under the user's hands.
  const defaults = useRef({ defaultTaxonomyId, groups });
  defaults.current = { defaultTaxonomyId, groups };

  useEffect(() => {
    if (!open) return;
    const fallback = defaults.current.defaultTaxonomyId ?? defaults.current.groups[0]?.id ?? "";
    const config = entry?.serviceConfig;

    setName(entry?.name ?? "");
    setTaxonomyId(entry?.taxonomyId ?? fallback);
    setDetailName(entry?.detailName ?? "");
    setIsActive(entry?.isActive ?? true);
    setIsDeleted(false);
    setDescription(entry?.description ?? "");
    setPriority(String(entry?.sortOrder ?? 0));
    setCode(entry?.code ?? "");

    setTaxRate(config?.taxRate ?? SERVICE_TAX_RATE.NotTaxable);
    setPriceIncludesTax(config?.priceIncludesTax ?? false);
    setPrice(String(entry?.price ?? 0));
    setDiscountIsPercent(config?.discountIsPercent ?? true);
    setDiscountValue(String(config?.discountValue ?? 0));
    setUnit(entry?.unit ?? "");

    setRequireImage(config?.requireImage ?? false);
    setDeductDoctorOnWarranty(config?.deductDoctorOnWarranty ?? false);
    setSeparateRevenue(config?.separateRevenue ?? false);
    setShowToothOnInvoice(config?.showToothOnInvoice ?? false);
    setRevenueByStage(config?.revenueByStage ?? false);
    setRequireStageSequence(config?.requireStageSequence ?? false);
    setWarrantyDays(config?.warrantyDays ?? 0);

    setStages(entry?.stages ?? []);
    setStageName("");
    setTab("settings");
    setError(null);
  }, [open, entry]);

  const pending = createEntry.isPending || updateEntry.isPending || deleteEntry.isPending;

  const addStage = () => {
    const trimmed = stageName.trim();
    if (!trimmed) return;
    setStages((current) => [...current, { name: trimmed, value: 0 }]);
    setStageName("");
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("Vui lòng nhập tên dịch vụ"));
      return;
    }

    const serviceConfig = {
      taxRate,
      priceIncludesTax,
      discountIsPercent,
      discountValue: number(discountValue),
      requireImage,
      deductDoctorOnWarranty,
      separateRevenue,
      showToothOnInvoice,
      revenueByStage,
      requireStageSequence,
      warrantyDays,
    };
    const shared = {
      taxonomyId,
      name: trimmed,
      code: code.trim() || undefined,
      price: number(price),
      description: description.trim() || undefined,
      detailName: detailName.trim() || null,
      unit: unit.trim() || null,
      serviceConfig,
      stages,
      sortOrder: Number.parseInt(priority, 10) || 0,
    };

    try {
      if (entry) {
        await updateEntry.mutateAsync({ id: entry.id, input: { ...shared, isActive } });

        if (isDeleted) {
          await deleteEntry.mutateAsync(entry.id);
          toast.success(t("Đã xoá"));
          onClose();
          return;
        }

        toast.success(t("Đã cập nhật dịch vụ"));
      } else {
        await createEntry.mutateAsync({ clinicBranchId: branchId, ...shared });
        toast.success(t("Đã thêm dịch vụ"));
      }
      onClose();
    } catch (cause) {
      toast.error(extractApiError(cause));
    }
  };

  const saved = entry?.serviceConfig;

  return (
    <AppDialog
      open={open}
      title={entry ? t("Cập nhật dịch vụ") : t("Thêm dịch vụ")}
      width="sm:max-w-3xl"
      canSave={name.trim().length > 0 && taxonomyId.length > 0}
      saving={pending}
      onSave={() => void submit()}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <FloatingField
            id="service-name"
            label={t("Dịch vụ")}
            required
            autoFocus
            value={name}
            error={error ?? undefined}
            onChange={(next) => {
              setName(next);
              if (error) setError(null);
            }}
          />
          <FloatingSelect
            id="service-group"
            label={t("Phân loại dịch vụ")}
            required
            value={taxonomyId}
            onChange={setTaxonomyId}
            options={groups.map((group) => ({ value: group.id, label: group.name }))}
          />
          <FloatingField
            id="service-detail-name"
            label={t("Tên chi tiết")}
            value={detailName}
            onChange={setDetailName}
          />
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="service-active"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
            />
            <Label htmlFor="service-active" className="cursor-pointer text-[14px]">
              {t("Đang hoạt động")}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="service-deleted"
              checked={isDeleted}
              disabled={!entry}
              onCheckedChange={(checked) => setIsDeleted(checked === true)}
            />
            <Label htmlFor="service-deleted" className="cursor-pointer text-[14px]">
              {t("Đã xoá")}
            </Label>
          </div>
        </div>

        <div className="relative">
          <Textarea
            id="service-description"
            value={description}
            placeholder=" "
            rows={3}
            onChange={(event) => setDescription(event.target.value)}
            className="peer min-h-[90px] rounded-lg border-app-line bg-white text-[14px] placeholder:text-transparent"
          />
          <label
            htmlFor="service-description"
            className="pointer-events-none absolute top-0 left-3 -translate-y-1/2 bg-white px-1 text-[13px] font-medium text-app-label peer-placeholder-shown:top-4 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-[14px] peer-focus:top-0 peer-focus:bg-white peer-focus:text-[13px] peer-focus:text-app-primary"
          >
            {t("Mô tả")}
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FloatingField
            id="service-priority"
            label={t("Mức độ ưu tiên")}
            type="number"
            min={0}
            inputMode="numeric"
            value={priority}
            onChange={setPriority}
          />
          <FloatingField
            id="service-code"
            label={t("Mã dịch vụ (để trống sẽ tự động tạo mã)")}
            value={code}
            onChange={setCode}
          />
        </div>

        {/* ── Cấu hình giá & thuế ─────────────────────────────────────── */}
        <div className="space-y-4 border-t border-app-line pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-[16px] font-bold text-app-ink">{t("Cấu hình giá & thuế")}</p>
            <FloatingSelect
              id="service-tax"
              label={t("% thuế")}
              value={String(taxRate)}
              onChange={(next) => setTaxRate(Number(next) as ServiceTaxRate)}
              options={SERVICE_TAX_RATE_OPTIONS.map((option) => ({
                value: String(option.value),
                label: option.label,
              }))}
              className="w-[160px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              tone="app"
              value={priceIncludesTax ? "after" : "before"}
              onChange={(next) => setPriceIncludesTax(next === "after")}
              options={[
                { key: "before", label: t("Trước thuế") },
                { key: "after", label: t("Sau thuế") },
              ]}
            />
            <FloatingField
              id="service-price"
              label={t("Giá")}
              inputMode="decimal"
              value={price}
              onChange={setPrice}
              className="min-w-[180px] flex-1"
            />
            <SegmentedControl
              tone="app"
              value={discountIsPercent ? "percent" : "vnd"}
              onChange={(next) => setDiscountIsPercent(next === "percent")}
              options={[
                { key: "percent", label: "%" },
                { key: "vnd", label: "VNĐ" },
              ]}
            />
            <FloatingField
              id="service-discount"
              label={t("Giảm giá")}
              inputMode="decimal"
              value={discountValue}
              onChange={setDiscountValue}
              className="min-w-[140px] flex-1"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Read-only: these two come back from the server after a save, so
                the formula lives in one place. */}
            <FloatingField
              id="service-after-discount"
              label={t("Giá sau giảm")}
              readOnly
              value={saved ? formatVND(saved.priceAfterDiscount) : "—"}
              onChange={() => undefined}
            />
            <FloatingField id="service-unit" label={t("Đơn vị")} value={unit} onChange={setUnit} />
            <FloatingField
              id="service-collected"
              label={t("Thực thu từ khách (Đã gồm VAT)")}
              readOnly
              value={saved ? formatVND(saved.amountCollected) : "—"}
              onChange={() => undefined}
            />
          </div>
        </div>

        {/* ── Cài đặt | Công đoạn | Bảo hành ──────────────────────────── */}
        <div className="border-t border-app-line pt-4">
          <div role="tablist" className="flex gap-1 border-b border-app-line">
            {(
              [
                ["settings", t("Cài đặt")],
                ["stages", t("Công đoạn")],
                ["warranty", t("Bảo hành")],
              ] as [SettingsTab, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "cursor-pointer px-4 py-2 text-[14px] font-medium transition-colors",
                  tab === key
                    ? "border-b-2 border-app-primary text-app-primary"
                    : "text-app-label hover:text-app-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="pt-4">
            {tab === "settings" && (
              <div className="space-y-3">
                <CheckRow
                  id="service-require-image"
                  label={t("Yêu cầu hình ảnh khi điều trị")}
                  checked={requireImage}
                  onChange={setRequireImage}
                />
                <CheckRow
                  id="service-deduct-doctor"
                  label={t("Yêu cầu trừ tiền bác sĩ khi bảo hành")}
                  checked={deductDoctorOnWarranty}
                  onChange={setDeductDoctorOnWarranty}
                />
                <CheckRow
                  id="service-separate-revenue"
                  label={t("Tính doanh số riêng")}
                  checked={separateRevenue}
                  onChange={setSeparateRevenue}
                />
                <CheckRow
                  id="service-show-tooth"
                  label={t("Hiển thị răng ở hóa đơn")}
                  checked={showToothOnInvoice}
                  onChange={setShowToothOnInvoice}
                />
              </div>
            )}

            {tab === "stages" && (
              <div className="space-y-4">
                <CheckRow
                  id="service-revenue-by-stage"
                  label={t("Tính doanh số trên công đoạn")}
                  hint={t("Bác sĩ sẽ nhận hoa hồng trên toàn bộ công đoạn được hoàn thành")}
                  checked={revenueByStage}
                  onChange={setRevenueByStage}
                />
                <CheckRow
                  id="service-stage-sequence"
                  label={t("Yêu cầu tuần tự công đoạn")}
                  hint={t("Tắt: Bác sĩ chỉ nhận hoa hồng trên các công đoạn dịch vụ đã hoàn thành")}
                  checked={requireStageSequence}
                  onChange={setRequireStageSequence}
                />

                <div className="flex items-end gap-2">
                  <FloatingField
                    id="service-stage-name"
                    label={t("Công đoạn")}
                    value={stageName}
                    onChange={setStageName}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addStage();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button type="button" onClick={addStage} className="h-11 gap-1">
                    <Plus className="size-4" aria-hidden="true" />
                    {t("Công đoạn")}
                  </Button>
                </div>

                <div className="overflow-hidden rounded-lg border border-app-line">
                  <table className="w-full text-[14px]">
                    <thead>
                      <tr className="bg-app-surface text-left text-app-label">
                        <th className="w-14 px-3 py-2 font-medium">{t("STT")}</th>
                        <th className="px-3 py-2 font-medium">{t("Tên công đoạn")}</th>
                        <th className="w-40 px-3 py-2 font-medium">{t("Giá trị")}</th>
                        <th className="w-20 px-3 py-2 text-center font-medium">{t("Thao tác")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stages.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-app-label">
                            {t("Chưa có công đoạn nào")}
                          </td>
                        </tr>
                      ) : (
                        stages.map((stage, index) => (
                          <tr
                            key={stage.id ?? `${stage.name}-${index}`}
                            className="border-t border-app-line"
                          >
                            <td className="px-3 py-2 text-app-label">{index + 1}</td>
                            <td className="px-3 py-2 text-app-ink">{stage.name}</td>
                            <td className="px-3 py-2">
                              <input
                                aria-label={t("Giá trị công đoạn {0}", stage.name)}
                                inputMode="decimal"
                                value={String(stage.value)}
                                onChange={(event) =>
                                  setStages((current) =>
                                    current.map((item, at) =>
                                      at === index
                                        ? { ...item, value: number(event.target.value) }
                                        : item,
                                    ),
                                  )
                                }
                                className="h-9 w-full rounded-md border border-app-line px-2 text-[14px] outline-none focus-visible:border-app-primary"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                aria-label={t("Xoá công đoạn {0}", stage.name)}
                                onClick={() =>
                                  setStages((current) => current.filter((_, at) => at !== index))
                                }
                                className="cursor-pointer text-app-danger"
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === "warranty" && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  {WARRANTY_PRESETS.map((days) => (
                    <CheckRow
                      key={days}
                      id={`service-warranty-${days}`}
                      label={warrantyLabel(days)}
                      // The reference shows these as checkboxes but only one
                      // period can be in force, so picking one clears the rest.
                      checked={warrantyDays === days}
                      onChange={() => setWarrantyDays(days)}
                    />
                  ))}
                </div>
                <FloatingField
                  id="service-warranty-custom"
                  label={t("Tuỳ chỉnh")}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={String(warrantyDays)}
                  onChange={(next) => setWarrantyDays(Number.parseInt(next, 10) || 0)}
                  className="sm:max-w-[240px]"
                />
                <p className="text-[12px] text-app-label">{t("Đơn vị: Ngày")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppDialog>
  );
}
