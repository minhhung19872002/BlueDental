import { Button, Checkbox, Popover, message } from "antd";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  PRESCRIPTION_USAGE,
  TAXONOMY_GROUP,
  useCatalogEntries,
  useCreateCatalogEntry,
  useUpdateCatalogEntry,
  type CatalogEntryDto,
  type PrescriptionTemplateLineDto,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { AppDialog } from "@/components/AppDialog";
import { LabeledField } from "@/components/LabeledField";
import { FloatingSelect } from "@/components/FloatingSelect";
import { extractApiError } from "@/lib/apiError";
import { useBranchFilter, useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  entry: CatalogEntryDto | null;
  groups: TaxonomyDto[];
  defaultTaxonomyId?: string;
  onClose: () => void;
}

type Line = Omit<PrescriptionTemplateLineDto, "quantity" | "medicineName">;

const EMPTY_LINE: Line = {
  medicineEntryId: "",
  timesPerDay: 1,
  amountPerTime: 1,
  days: 1,
  usage: 0,
};

/** The six choices the reference lists, in its order. */
function usageOptions(): { flag: number; label: string }[] {
  return [
    { flag: PRESCRIPTION_USAGE.AfterMeal, label: t("Sau khi ăn") },
    { flag: PRESCRIPTION_USAGE.BeforeMeal, label: t("Trước khi ăn") },
    { flag: PRESCRIPTION_USAGE.DuringMeal, label: t("Trong khi ăn") },
    { flag: PRESCRIPTION_USAGE.AfterWakingUp, label: t("Sau khi thức dậy") },
    { flag: PRESCRIPTION_USAGE.BeforeSleep, label: t("Trước khi ngủ") },
    { flag: PRESCRIPTION_USAGE.Other, label: t("Khác") },
  ];
}

function usageLabel(usage: number): string {
  const picked = usageOptions().filter((option) => (usage & option.flag) !== 0);
  return picked.length === 0 ? t("Sử dụng") : picked.map((option) => option.label).join(", ");
}

/** "Sử dụng" — a multi-select, the way the reference builds it. */
function UsagePicker({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  const content = (
    <div className="bd-usage-picker">
      {usageOptions().map((option) => {
        const checked = (value & option.flag) !== 0;
        return (
          <Checkbox
            key={option.flag}
            checked={checked}
            onChange={(event) =>
              onChange(event.target.checked ? value | option.flag : value & ~option.flag)
            }
          >
            {option.label}
          </Checkbox>
        );
      })}
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomLeft">
      <Button className="bd-usage-trigger">
        {usageLabel(value)}
      </Button>
    </Popover>
  );
}

/**
 * Đơn thuốc mẫu — a name, a piece of advice, and a table of medicine lines.
 *
 * "Số lượng" is shown disabled and derived from the three numbers beside it,
 * exactly as the reference does, so the stored template can never carry a
 * quantity that disagrees with its own dose.
 */
export function PrescriptionTemplateDialog({
  open,
  entry,
  groups,
  defaultTaxonomyId,
  onClose,
}: Props) {
  const branchId = useCurrentBranchId();
  const branchFilter = useBranchFilter();
  const createEntry = useCreateCatalogEntry();
  const updateEntry = useUpdateCatalogEntry();

  // The medicine picker offers this branch's thuốc catalog.
  const medicinesQuery = useCatalogEntries(branchFilter, TAXONOMY_GROUP.MedicationType, {
    scope: "catalog",
    skipCount: 0,
    maxResultCount: 200,
  });
  const medicines = medicinesQuery.data?.items ?? [];

  const [name, setName] = useState("");
  const [advice, setAdvice] = useState("");
  const [priority, setPriority] = useState("0");
  const [lines, setLines] = useState<Line[]>([EMPTY_LINE]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(entry?.name ?? "");
    setAdvice(entry?.description ?? "");
    setPriority(String(entry?.sortOrder ?? 0));
    setLines(
      entry && entry.prescriptionLines.length > 0
        ? entry.prescriptionLines.map((line) => ({
            id: line.id,
            medicineEntryId: line.medicineEntryId,
            timesPerDay: line.timesPerDay,
            amountPerTime: line.amountPerTime,
            days: line.days,
            usage: line.usage,
          }))
        : [EMPTY_LINE],
    );
    setError(null);
  }, [open, entry]);

  const pending = createEntry.isPending || updateEntry.isPending;

  const patch = (index: number, change: Partial<Line>) =>
    setLines((current) =>
      current.map((line, at) => (at === index ? { ...line, ...change } : line)),
    );

  // Read through a ref for the same reason the other dialogs do: a refetch
  // must not change what a save is about to write.
  const defaults = useRef({ defaultTaxonomyId, groups });
  defaults.current = { defaultTaxonomyId, groups };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("Vui lòng nhập tên đơn thuốc mẫu"));
      return;
    }

    // A line with no medicine picked is the empty row the table always shows.
    const filled = lines.filter((line) => line.medicineEntryId);
    const taxonomy =
      entry?.taxonomyId ??
      defaults.current.defaultTaxonomyId ??
      defaults.current.groups[0]?.id ??
      "";
    const sortOrder = Number.parseInt(priority, 10) || 0;

    try {
      if (entry) {
        await updateEntry.mutateAsync({
          id: entry.id,
          input: {
            taxonomyId: taxonomy,
            name: trimmed,
            description: advice.trim() || undefined,
            price: entry.price,
            isActive: entry.isActive,
            prescriptionLines: filled,
            sortOrder,
          },
        });
        message.success(t("Đã cập nhật đơn thuốc mẫu"));
      } else {
        await createEntry.mutateAsync({
          clinicBranchId: branchId,
          taxonomyId: taxonomy,
          name: trimmed,
          description: advice.trim() || undefined,
          prescriptionLines: filled,
          sortOrder,
        });
        message.success(t("Đã thêm đơn thuốc mẫu"));
      }
      onClose();
    } catch (cause) {
      message.error(extractApiError(cause));
    }
  };

  const CELL = "px-2 py-2 align-middle";
  const NUM =
    "bd-plain-input";

  return (
    <AppDialog
      open={open}
      title={entry ? t("Cập nhật đơn thuốc mẫu") : t("Thêm đơn thuốc mẫu")}
      width={1040}
      canSave={name.trim().length > 0}
      saving={pending}
      onSave={() => void submit()}
      onClose={onClose}
    >
      <div className="bd-dialog-stack">
        <div className="bd-dialog-grid">
          <LabeledField
            id="prescription-name"
            label={t("Tên đơn thuốc mẫu")}
            required
            autoFocus
            value={name}
            error={error ?? undefined}
            onChange={(next) => {
              setName(next);
              if (error) setError(null);
            }}
          />
          <LabeledField
            id="prescription-advice"
            label={t("Lời dặn")}
            value={advice}
            onChange={setAdvice}
          />
        </div>

        <div className="bd-row-end">
          <Button
            htmlType="button"
            variant="outlined"
            className="bd-primary-text"
            onClick={() => setLines((current) => [...current, { ...EMPTY_LINE }])}
          >
            <Plus className="bd-icon" aria-hidden="true" />
            {t("Thêm mới")}
          </Button>
        </div>

        <div className="bd-cat-tablebox">
          <table className="bd-cat-table bd-cat-table--wider">
            <thead>
              <tr className="bd-cat-thead">
                <th className={`${CELL} font-medium`}>{t("Tên thuốc")}</th>
                <th className={`${CELL} w-28 font-medium`}>{t("Ngày uống")}</th>
                <th className={`${CELL} w-24 font-medium`}>{t("Mỗi lần")}</th>
                <th className={`${CELL} w-24 font-medium`}>{t("Số ngày")}</th>
                <th className={`${CELL} w-24 font-medium`}>{t("Số lượng")}</th>
                <th className={`${CELL} w-52 font-medium`}>{t("Sử dụng")}</th>
                <th className={`${CELL} w-16`} />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.id ?? index} className="bd-cat-footline">
                  <td className={`${CELL} min-w-[220px]`}>
                    <FloatingSelect
                      id={`prescription-medicine-${index}`}
                      label={t("Tên thuốc")}
                      required
                      value={line.medicineEntryId}
                      onChange={(next) => patch(index, { medicineEntryId: next })}
                      options={medicines.map((medicine) => ({
                        value: medicine.id,
                        label: medicine.name,
                      }))}
                    />
                  </td>
                  <td className={CELL}>
                    <input
                      aria-label={t("Ngày uống")}
                      inputMode="numeric"
                      value={String(line.timesPerDay)}
                      onChange={(event) =>
                        patch(index, { timesPerDay: Number.parseInt(event.target.value, 10) || 0 })
                      }
                      className={NUM}
                    />
                  </td>
                  <td className={CELL}>
                    <input
                      aria-label={t("Mỗi lần")}
                      inputMode="decimal"
                      value={String(line.amountPerTime)}
                      onChange={(event) =>
                        patch(index, { amountPerTime: Number.parseFloat(event.target.value) || 0 })
                      }
                      className={NUM}
                    />
                  </td>
                  <td className={CELL}>
                    <input
                      aria-label={t("Số ngày")}
                      inputMode="numeric"
                      value={String(line.days)}
                      onChange={(event) =>
                        patch(index, { days: Number.parseInt(event.target.value, 10) || 0 })
                      }
                      className={NUM}
                    />
                  </td>
                  <td className={CELL}>
                    <input
                      aria-label={t("Số lượng")}
                      disabled
                      value={String(line.timesPerDay * line.amountPerTime * line.days)}
                      className={`${NUM} bg-app-surface text-app-label`}
                    />
                  </td>
                  <td className={CELL}>
                    <UsagePicker
                      value={line.usage}
                      onChange={(next) => patch(index, { usage: next })}
                    />
                  </td>
                  <td className={`${CELL} text-center`}>
                    <button
                      type="button"
                      aria-label={t("Xoá dòng thuốc {0}", String(index + 1))}
                      disabled={lines.length === 1}
                      onClick={() => setLines((current) => current.filter((_, at) => at !== index))}
                      className="bd-danger-text"
                    >
                      <Trash2 className="bd-icon" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <LabeledField
          id="prescription-priority"
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
