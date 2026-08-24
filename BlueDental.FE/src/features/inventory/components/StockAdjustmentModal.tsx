// StockAdjustmentModal — records stock-in, stock-out, or adjustment transactions.

import { useState } from "react";
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
import { useAdjustStock, useInventoryList } from "../api/index";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Pre-selected inventory item id. When omitted the user picks from the list. */
  itemId?: string;
}

interface AdjustmentFormValues {
  itemId: string;
  adjustmentType: "stock_in" | "stock_out" | "inventory";
  quantity: string;
  reason: string;
}

export function StockAdjustmentModal({ open, onClose, itemId }: Props) {

  const ADJUSTMENT_TYPE_OPTIONS = [
    { value: "stock_in",  label: t("Nhập kho") },
    { value: "stock_out", label: t("Xuất kho") },
    { value: "inventory", label: t("Kiểm kê") },
  ];

  const [form, setForm] = useState<AdjustmentFormValues>({
    itemId: "",
    adjustmentType: "stock_in",
    quantity: "",
    reason: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof AdjustmentFormValues, string>>>({});

  const adjustStock = useAdjustStock();
  const { data: inventoryPage, isLoading: inventoryLoading } = useInventoryList({
    maxResultCount: 100,
  });

  const itemOptions = (inventoryPage?.items ?? []).map((item) => ({
    value: item.id,
    label: `${item.name} (${item.itemCode}) — ${t("tồn")}: ${item.currentStock} ${item.unit}`,
  }));

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof AdjustmentFormValues, string>> = {};
    if (!itemId && !form.itemId) newErrors.itemId = t("Vui lòng chọn vật tư");
    if (!form.adjustmentType) newErrors.adjustmentType = t("Vui lòng chọn loại điều chỉnh");
    const qty = Number(form.quantity);
    if (!form.quantity || isNaN(qty) || qty < 1) newErrors.quantity = t("Số lượng phải lớn hơn 0");
    if (!form.reason.trim()) newErrors.reason = t("Vui lòng nhập lý do");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const resolvedItemId = itemId ?? form.itemId;
    const qty = Number(form.quantity);
    const delta =
      form.adjustmentType === "stock_out" ? -qty : qty;

    adjustStock.mutate(
      { id: resolvedItemId, adjustment: delta, note: form.reason },
      {
        onSuccess: () => {
          toast.success(t("Điều chỉnh kho thành công!"));
          setForm({ itemId: "", adjustmentType: "stock_in", quantity: "", reason: "" });
          setErrors({});
          onClose();
        },
        onError: () => {
          toast.error(t("Không thể điều chỉnh kho. Vui lòng thử lại."));
        },
      },
    );
  };

  const handleCancel = () => {
    setForm({ itemId: "", adjustmentType: "stock_in", quantity: "", reason: "" });
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) handleCancel(); }}>
      <DialogContent style={{ maxWidth: 520 }}>
        <DialogHeader>
          <DialogTitle>{t("Điều chỉnh kho")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {!itemId && (
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("Vật tư")} <span className="text-destructive">*</span></label>
              <Select
                value={form.itemId}
                onValueChange={(v) => setForm((f) => ({ ...f, itemId: v }))}
                disabled={inventoryLoading}
              >
                <SelectTrigger className={errors.itemId ? "border-destructive" : ""}>
                  <SelectValue placeholder={t("Tìm và chọn vật tư...")} />
                </SelectTrigger>
                <SelectContent>
                  {itemOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.itemId && <p className="text-xs text-destructive">{errors.itemId}</p>}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Loại điều chỉnh")} <span className="text-destructive">*</span></label>
            <Select
              value={form.adjustmentType}
              onValueChange={(v) => setForm((f) => ({ ...f, adjustmentType: v as AdjustmentFormValues["adjustmentType"] }))}
            >
              <SelectTrigger className={errors.adjustmentType ? "border-destructive" : ""}>
                <SelectValue placeholder={t("Chọn loại điều chỉnh")} />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.adjustmentType && <p className="text-xs text-destructive">{errors.adjustmentType}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Số lượng")} <span className="text-destructive">*</span></label>
            <Input
              type="number"
              placeholder="0"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              className={errors.quantity ? "border-destructive" : ""}
            />
            {errors.quantity && <p className="text-xs text-destructive">{errors.quantity}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Lý do")} <span className="text-destructive">*</span></label>
            <textarea
              rows={3}
              placeholder={t("Nhập lý do điều chỉnh...")}
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              maxLength={500}
              style={{ width: "100%", padding: "8px 12px", border: "1px solid", borderColor: errors.reason ? "var(--destructive)" : "#e5e7eb", borderRadius: 6, fontSize: 14, resize: "none" }}
            />
            {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>{t("Hủy")}</Button>
          <Button
            disabled={adjustStock.isPending}
            onClick={handleSubmit}
            style={{ background: "#2671D8" }}
          >
            {t("Lưu điều chỉnh")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
