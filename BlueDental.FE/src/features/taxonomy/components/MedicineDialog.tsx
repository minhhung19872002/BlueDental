import { message } from "antd";
import { useEffect, useRef, useState } from "react";
import {
  useCreateCatalogEntry,
  useUpdateCatalogEntry,
  type CatalogEntryDto,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { AppDialog } from "@/components/AppDialog";
import { LabeledField } from "@/components/LabeledField";
import { FloatingSelect } from "@/components/FloatingSelect";
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

const number = (value: string) => {
  const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Loại thuốc. The reference asks for seven fields here and — alone among the
 * catalogs — shows no "Đang hoạt động" / "Đã xoá" pair.
 */
export function MedicineDialog({ open, entry, groups, defaultTaxonomyId, onClose }: Props) {
  const branchId = useCurrentBranchId();
  const createEntry = useCreateCatalogEntry();
  const updateEntry = useUpdateCatalogEntry();

  const [name, setName] = useState("");
  const [taxonomyId, setTaxonomyId] = useState("");
  const [activeIngredient, setActiveIngredient] = useState("");
  const [usage, setUsage] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("0");
  const [salePrice, setSalePrice] = useState("");
  const [prescriptionCode, setPrescriptionCode] = useState("");
  const [usageNote, setUsageNote] = useState("");
  const [unit, setUnit] = useState("");
  const [priority, setPriority] = useState("0");
  const [error, setError] = useState<string | null>(null);

  // React Query hands back a new array on every refetch, so these are read
  // through a ref: a refetch landing while the dialog is open must not reset
  // the form under the user's hands.
  const defaults = useRef({ defaultTaxonomyId, groups });
  defaults.current = { defaultTaxonomyId, groups };

  useEffect(() => {
    if (!open) return;
    const fallback = defaults.current.defaultTaxonomyId ?? defaults.current.groups[0]?.id ?? "";
    setName(entry?.name ?? "");
    setTaxonomyId(entry?.taxonomyId ?? fallback);
    setActiveIngredient(entry?.medicine?.activeIngredient ?? "");
    setUsage(entry?.medicine?.usage ?? "");
    setPurchasePrice(String(entry?.medicine?.purchasePrice ?? 0));
    setSalePrice(entry?.price == null ? "" : String(entry.price));
    setPrescriptionCode(entry?.medicine?.prescriptionCode ?? "");
    setUsageNote(entry?.medicine?.usageNote ?? "");
    setUnit(entry?.unit ?? "");
    setPriority(String(entry?.sortOrder ?? 0));
    setError(null);
  }, [open, entry]);

  const pending = createEntry.isPending || updateEntry.isPending;

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("Vui lòng nhập tên thuốc"));
      return;
    }

    const medicine = {
      activeIngredient: activeIngredient.trim() || null,
      usage: usage.trim() || null,
      purchasePrice: number(purchasePrice),
      prescriptionCode: prescriptionCode.trim() || null,
      usageNote: usageNote.trim() || null,
    };
    // The entry's own price is the selling price everything else quotes from.
    const price = salePrice.trim() === "" ? null : number(salePrice);
    const sortOrder = Number.parseInt(priority, 10) || 0;

    try {
      if (entry) {
        await updateEntry.mutateAsync({
          id: entry.id,
          input: {
            taxonomyId,
            name: trimmed,
            code: entry.code ?? undefined,
            price,
            unit: unit.trim() || null,
            medicine,
            isActive: entry.isActive,
            sortOrder,
          },
        });
        message.success(t("Đã cập nhật loại thuốc"));
      } else {
        await createEntry.mutateAsync({
          clinicBranchId: branchId,
          taxonomyId,
          name: trimmed,
          price,
          unit: unit.trim() || null,
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
      onSave={() => void submit()}
      onClose={onClose}
    >
      <div className="bd-dialog-grid">
        <LabeledField
          id="medicine-name"
          label={t("Tên thuốc")}
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
          id="medicine-group"
          label={t("Chọn nhóm thuốc")}
          required
          value={taxonomyId}
          onChange={setTaxonomyId}
          options={groups.map((group) => ({ value: group.id, label: group.name }))}
        />

        <LabeledField
          id="medicine-ingredient"
          label={t("Hoạt chất")}
          value={activeIngredient}
          onChange={setActiveIngredient}
        />

        <LabeledField
          id="medicine-usage"
          label={t("Cách dùng")}
          value={usage}
          onChange={setUsage}
        />

        <div className="bd-dialog-grid">
          <LabeledField
            id="medicine-purchase-price"
            label={t("Giá mua")}
            inputMode="decimal"
            value={purchasePrice}
            onChange={setPurchasePrice}
          />
          <LabeledField
            id="medicine-sale-price"
            label={t("Giá bán")}
            inputMode="decimal"
            value={salePrice}
            onChange={setSalePrice}
          />
        </div>

        <LabeledField
          id="medicine-code"
          label={t("Mã toa thuốc")}
          value={prescriptionCode}
          onChange={setPrescriptionCode}
        />

        <LabeledField
          id="medicine-note"
          label={t("Lưu ý sử dụng")}
          value={usageNote}
          onChange={setUsageNote}
        />

        <LabeledField
          id="medicine-unit"
          label={t("Đơn vị tính")}
          value={unit}
          onChange={setUnit}
        />

        <LabeledField
          id="medicine-priority"
          label={t("Mức độ ưu tiên")}
          type="number"
          min={0}
          value={priority}
          onChange={setPriority}
        />
      </div>
    </AppDialog>
  );
}
