import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useCreateCatalogEntry,
  useUpdateCatalogEntry,
  type CatalogEntryDto,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

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

interface FormState {
  taxonomyId: string;
  name: string;
  code: string;
  price: string;
  content: string;
  description: string;
  isImageRequired: boolean;
  isActive: boolean;
  sortOrder: string;
}

function emptyForm(
  entry: CatalogEntryDto | null,
  defaultTaxonomyId: string | undefined,
  groups: TaxonomyDto[],
): FormState {
  return {
    taxonomyId: entry?.taxonomyId ?? defaultTaxonomyId ?? groups[0]?.id ?? "",
    name: entry?.name ?? "",
    code: entry?.code ?? "",
    price: entry?.price != null ? String(entry.price) : "",
    content: entry?.content ?? "",
    description: entry?.description ?? "",
    isImageRequired: entry?.isImageRequired ?? false,
    isActive: entry?.isActive ?? true,
    sortOrder: String(entry?.sortOrder ?? 0),
  };
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
  const branchId = useCurrentBranchId();
  const createEntry = useCreateCatalogEntry();
  const updateEntry = useUpdateCatalogEntry();

  const isEdit = entry !== null;
  const [form, setForm] = useState<FormState>(() => emptyForm(entry, defaultTaxonomyId, groups));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(entry, defaultTaxonomyId, groups));
    setErrors({});
  }, [open, entry, defaultTaxonomyId, groups]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.taxonomyId) errs.taxonomyId = t("Vui lòng chọn nhóm");
    if (!form.name.trim()) errs.name = t("Vui lòng nhập {0}", entityLabel.toLowerCase());
    if (priced && form.price !== "" && Number(form.price) < 0) errs.price = t("Giá không được âm");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const price = priced && form.price !== "" ? Number(form.price) : null;
    const content = templated && form.content ? form.content : null;

    try {
      if (isEdit) {
        await updateEntry.mutateAsync({
          id: entry.id,
          input: {
            taxonomyId: form.taxonomyId,
            name: form.name,
            code: form.code || undefined,
            price,
            content,
            description: form.description || undefined,
            isImageRequired: form.isImageRequired,
            isActive: form.isActive,
            sortOrder: Number(form.sortOrder),
          },
        });
        toast.success(t("Đã cập nhật {0}", entityNoun.toLowerCase()));
      } else {
        await createEntry.mutateAsync({
          clinicBranchId: branchId,
          taxonomyId: form.taxonomyId,
          name: form.name,
          code: form.code || undefined,
          price,
          content,
          description: form.description || undefined,
          isImageRequired: form.isImageRequired,
          sortOrder: Number(form.sortOrder),
        });
        toast.success(t("Đã thêm {0}", entityNoun.toLowerCase()));
      }

      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const isPending = createEntry.isPending || updateEntry.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("Sửa {0}", entityNoun.toLowerCase()) : t("Thêm {0}", entityNoun.toLowerCase())}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">
              {t("Nhóm phân loại")} <span className="text-destructive">*</span>
            </label>
            <Select value={form.taxonomyId} onValueChange={(v) => setField("taxonomyId", v)}>
              <SelectTrigger>
                <SelectValue placeholder={t("Chọn nhóm")} />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.taxonomyId && <p className="text-xs text-destructive mt-1">{errors.taxonomyId}</p>}
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">
              {entityLabel} <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder={t("Nhập {0}", entityLabel.toLowerCase())}
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
            />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">{t("Mã")}</label>
            <Input
              placeholder={t("Ví dụ: DT02")}
              value={form.code}
              onChange={(e) => setField("code", e.target.value)}
            />
          </div>

          {priced && (
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Giá (đ)")}</label>
              <Input
                type="number"
                min={0}
                step={10000}
                value={form.price}
                onChange={(e) => setField("price", e.target.value)}
              />
              {errors.price && <p className="text-xs text-destructive mt-1">{errors.price}</p>}
            </div>
          )}

          {templated && (
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Nội dung mẫu")}</label>
              <textarea
                className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={4}
                placeholder={t("Nội dung của mẫu")}
                value={form.content}
                onChange={(e) => setField("content", e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1 block">{t("Mô tả")}</label>
            <textarea
              className="w-full min-h-16 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              rows={2}
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">{t("Thứ tự hiển thị")}</label>
            <Input
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) => setField("sortOrder", e.target.value)}
            />
          </div>

          {priced && (
            <div className="flex items-center gap-3">
              <Switch
                id="isImageRequired"
                checked={form.isImageRequired}
                onCheckedChange={(v) => setField("isImageRequired", v)}
              />
              <label htmlFor="isImageRequired" className="text-sm cursor-pointer">
                {t("Bắt buộc đính kèm ảnh")}
              </label>
            </div>
          )}

          {isEdit && (
            <div className="flex items-center gap-3">
              <Switch
                id="isActive"
                checked={form.isActive}
                onCheckedChange={(v) => setField("isActive", v)}
              />
              <label htmlFor="isActive" className="text-sm cursor-pointer">
                {t("Đang sử dụng")}
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("Huỷ")}</Button>
          <Button onClick={() => void handleSubmit()} disabled={isPending}>
            {isEdit ? t("Lưu") : t("Thêm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
