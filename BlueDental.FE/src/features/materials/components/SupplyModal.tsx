import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { toast } from "sonner";
import {
  useCreateSupply,
  useUpdateSupply,
  type SupplyDto,
} from "../api/suppliesApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";

interface SupplyModalProps {
  open: boolean;
  supply: SupplyDto | null;
  groups: { id: string; name: string }[];
  defaultGroupId?: string;
  onClose: () => void;
}

interface SupplyFormValues {
  itemCode: string;
  name: string;
  taxonomyId: string;
  unit: string;
  reorderLevel: string;
  unitCost: string;
  salePrice: string;
  supplier: string;
  origin: string;
}

export function SupplyModal({
  open,
  supply,
  groups,
  defaultGroupId,
  onClose,
}: SupplyModalProps) {
  const branchId = useCurrentBranchId();
  const createSupply = useCreateSupply();
  const updateSupply = useUpdateSupply();

  const isEdit = supply !== null;

  const [form, setForm] = useState<SupplyFormValues>({
    itemCode: "",
    name: "",
    taxonomyId: "",
    unit: "",
    reorderLevel: "0",
    unitCost: "",
    salePrice: "",
    supplier: "",
    origin: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SupplyFormValues, string>>>({});

  useEffect(() => {
    if (!open) return;
    setForm({
      itemCode: supply?.itemCode ?? "",
      name: supply?.name ?? "",
      taxonomyId: supply?.taxonomyId ?? defaultGroupId ?? "",
      unit: supply?.unit ?? "",
      reorderLevel: String(supply?.reorderLevel ?? 0),
      unitCost: supply?.unitCost != null ? String(supply.unitCost) : "",
      salePrice: supply?.salePrice != null ? String(supply.salePrice) : "",
      supplier: supply?.supplier ?? "",
      origin: supply?.origin ?? "",
    });
    setErrors({});
  }, [open, supply, defaultGroupId]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof SupplyFormValues, string>> = {};
    if (!form.itemCode.trim()) newErrors.itemCode = t("Vui lòng nhập mã");
    if (!form.name.trim()) newErrors.name = t("Vui lòng nhập tên");
    const reorder = Number(form.reorderLevel);
    if (isNaN(reorder) || reorder < 0) newErrors.reorderLevel = t("Không được âm");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      if (isEdit) {
        await updateSupply.mutateAsync({
          id: supply.id,
          input: {
            name: form.name,
            taxonomyId: form.taxonomyId || undefined,
            unit: form.unit || undefined,
            reorderLevel: Number(form.reorderLevel),
            unitCost: form.unitCost ? Number(form.unitCost) : null,
            salePrice: form.salePrice ? Number(form.salePrice) : null,
            supplier: form.supplier || undefined,
            origin: form.origin || undefined,
          },
        });
        toast.success(t("Đã cập nhật vật tư"));
      } else {
        await createSupply.mutateAsync({
          branchId,
          itemCode: form.itemCode,
          name: form.name,
          taxonomyId: form.taxonomyId || undefined,
          unit: form.unit || undefined,
          reorderLevel: Number(form.reorderLevel),
          unitCost: form.unitCost ? Number(form.unitCost) : null,
          salePrice: form.salePrice ? Number(form.salePrice) : null,
          supplier: form.supplier || undefined,
          origin: form.origin || undefined,
        });
        toast.success(t("Đã thêm vật tư"));
      }

      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const field = (key: keyof SupplyFormValues) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent style={{ maxWidth: 560 }}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("Sửa vật tư {0}", supply.itemCode) : t("Thêm vật tư")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-[2fr_3fr] gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("Mã vật tư")} <span className="text-destructive">*</span></label>
              <Input
                disabled={isEdit}
                placeholder="VT001"
                {...field("itemCode")}
                className={errors.itemCode ? "border-destructive" : ""}
              />
              {errors.itemCode && <p className="text-xs text-destructive">{errors.itemCode}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("Tên vật liệu")} <span className="text-destructive">*</span></label>
              <Input
                placeholder={t("Găng tay y tế")}
                {...field("name")}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
          </div>

          <div className="grid grid-cols-[3fr_2fr] gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("Nhóm phân loại")}</label>
              <Select
                value={form.taxonomyId}
                onValueChange={(v) => setForm((f) => ({ ...f, taxonomyId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={groups.length === 0 ? t("Chưa có nhóm vật tư") : t("Chọn nhóm")} />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("Đơn vị")}</label>
              <Input placeholder={t("Hộp / cái")} {...field("unit")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("Giá nhập (đ)")}</label>
              <Input type="number" min={0} {...field("unitCost")} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("Giá bán (đ)")}</label>
              <Input type="number" min={0} {...field("salePrice")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("Nhà cung cấp")}</label>
              <Input {...field("supplier")} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("Xuất xứ")}</label>
              <Input placeholder={t("Việt Nam")} {...field("origin")} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Mức tồn tối thiểu")}</label>
            <p className="text-xs text-muted-foreground">{t("Dưới mức này, vật tư hiển thị trạng thái Sắp hết")}</p>
            <Input
              type="number"
              min={0}
              {...field("reorderLevel")}
              className={errors.reorderLevel ? "border-destructive" : ""}
            />
            {errors.reorderLevel && <p className="text-xs text-destructive">{errors.reorderLevel}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("Huỷ")}</Button>
          <Button
            disabled={createSupply.isPending || updateSupply.isPending}
            onClick={() => void handleSubmit()}
          >
            {isEdit ? t("Lưu") : t("Thêm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
