import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useCreateCatalogEntry,
  useDeleteCatalogEntry,
  useUpdateCatalogEntry,
  type CatalogEntryDto,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { FloatingSelect } from "@/components/FloatingSelect";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { extractApiError } from "@/lib/apiError";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  entry: CatalogEntryDto | null;
  groups: TaxonomyDto[];
  defaultTaxonomyId?: string;
  /** Lowercase noun of the catalog, e.g. "nguồn đến". */
  noun: string;
  onClose: () => void;
}

/**
 * The form Nguồn đến, Lịch sử bệnh and Nghề nghiệp share on the reference:
 * a name, its group, the two state checkboxes and a priority. Nothing else —
 * these catalogs carry no price, no code and no content.
 *
 * "Đã xoá" is the reference's soft-delete switch. It only does one thing here:
 * ticking it and saving deletes the row, exactly as the table's bin icon does.
 * It is disabled while creating, because a record that is born deleted is not
 * a thing anyone wants, and the reference gives no way to list deleted rows to
 * untick it again.
 */
export function SimpleCatalogDialog({
  open,
  entry,
  groups,
  defaultTaxonomyId,
  noun,
  onClose,
}: Props) {
  const branchId = useCurrentBranchId();
  const createEntry = useCreateCatalogEntry();
  const updateEntry = useUpdateCatalogEntry();
  const deleteEntry = useDeleteCatalogEntry();

  const [name, setName] = useState("");
  const [taxonomyId, setTaxonomyId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isDeleted, setIsDeleted] = useState(false);
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
    setIsActive(entry?.isActive ?? true);
    setIsDeleted(false);
    setPriority(String(entry?.sortOrder ?? 0));
    setError(null);
  }, [open, entry]);

  const pending = createEntry.isPending || updateEntry.isPending || deleteEntry.isPending;

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("Vui lòng nhập tên {0}", noun));
      return;
    }

    const sortOrder = Number.parseInt(priority, 10);

    try {
      if (entry) {
        await updateEntry.mutateAsync({
          id: entry.id,
          input: {
            taxonomyId,
            name: trimmed,
            code: entry.code ?? undefined,
            price: entry.price,
            content: entry.content,
            description: entry.description ?? undefined,
            isActive,
            sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
          },
        });

        if (isDeleted) {
          await deleteEntry.mutateAsync(entry.id);
          toast.success(t("Đã xoá"));
          onClose();
          return;
        }

        toast.success(t("Đã cập nhật"));
      } else {
        await createEntry.mutateAsync({
          clinicBranchId: branchId,
          taxonomyId,
          name: trimmed,
          sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
        });
        toast.success(t("Đã thêm"));
      }
      onClose();
    } catch (cause) {
      toast.error(extractApiError(cause));
    }
  };

  return (
    <AppDialog
      open={open}
      title={entry ? t("Cập nhật {0}", noun) : t("Thêm {0}", noun)}
      canSave={name.trim().length > 0 && taxonomyId.length > 0}
      saving={pending}
      onSave={() => void submit()}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FloatingField
            id="catalog-simple-name"
            label={t("Tên {0}", noun)}
            required
            autoFocus
            value={name}
            error={error ?? undefined}
            onChange={(next) => {
              setName(next);
              if (error) setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
          />

          <FloatingSelect
            id="catalog-simple-group"
            label={t("Chọn nhóm {0}", noun)}
            required
            value={taxonomyId}
            onChange={setTaxonomyId}
            options={groups.map((group) => ({ value: group.id, label: group.name }))}
          />
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="catalog-simple-active"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
            />
            <Label htmlFor="catalog-simple-active" className="cursor-pointer text-[14px]">
              {t("Đang hoạt động")}
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="catalog-simple-deleted"
              checked={isDeleted}
              disabled={!entry}
              onCheckedChange={(checked) => setIsDeleted(checked === true)}
            />
            <Label
              htmlFor="catalog-simple-deleted"
              className="cursor-pointer text-[14px]"
              title={entry ? undefined : t("Chỉ dùng khi sửa bản ghi đã có")}
            >
              {t("Đã xoá")}
            </Label>
          </div>
        </div>

        <FloatingField
          id="catalog-simple-priority"
          label={t("Mức độ ưu tiên")}
          type="number"
          min={0}
          inputMode="numeric"
          value={priority}
          onChange={setPriority}
          className="sm:max-w-[240px]"
        />
      </div>
    </AppDialog>
  );
}
