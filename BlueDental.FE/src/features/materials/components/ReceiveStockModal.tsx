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
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { toast } from "sonner";
import dayjs from "dayjs";
import { useReceiveStock, type SupplyDto } from "../api/suppliesApi";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";

interface ReceiveStockModalProps {
  open: boolean;
  supply: SupplyDto | null;
  onClose: () => void;
}

interface ReceiveFormValues {
  quantity: string;
  stockedAt: string;
  expiryDate: string;
  expiryWarningDays: string;
}

/**
 * Nhập kho — a receipt carries the expiry of the batch, which is what drives the
 * "Cảnh báo hết hạn" and "Trạng thái" columns.
 */
export function ReceiveStockModal({ open, supply, onClose }: ReceiveStockModalProps) {
  const receiveStock = useReceiveStock();
  const [form, setForm] = useState<ReceiveFormValues>({
    quantity: "",
    stockedAt: dayjs().format("YYYY-MM-DD"),
    expiryDate: "",
    expiryWarningDays: "30",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ReceiveFormValues, string>>>({});

  useEffect(() => {
    if (!open) return;
    setForm({
      quantity: "",
      stockedAt: dayjs().format("YYYY-MM-DD"),
      expiryDate: "",
      expiryWarningDays: String(supply?.expiryWarningDays ?? 30),
    });
    setErrors({});
  }, [open, supply]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ReceiveFormValues, string>> = {};
    const qty = Number(form.quantity);
    if (!form.quantity || isNaN(qty) || qty < 1) newErrors.quantity = t("Số lượng phải lớn hơn 0");
    if (!form.stockedAt) newErrors.stockedAt = t("Vui lòng chọn ngày nhập kho");
    const warnDays = Number(form.expiryWarningDays);
    if (form.expiryWarningDays && (isNaN(warnDays) || warnDays < 0)) newErrors.expiryWarningDays = t("Không được âm");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!supply) return;

    try {
      await receiveStock.mutateAsync({
        id: supply.id,
        input: {
          quantity: Number(form.quantity),
          stockedAt: form.stockedAt,
          expiryDate: form.expiryDate || undefined,
          expiryWarningDays: form.expiryWarningDays ? Number(form.expiryWarningDays) : undefined,
        },
      });

      toast.success(t("Đã nhập kho"));
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {supply ? t("Nhập kho — {0}", supply.name) : t("Nhập kho")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Số lượng nhập")} <span className="text-destructive">*</span></label>
            <Input
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              className={errors.quantity ? "border-destructive" : ""}
            />
            {errors.quantity && <p className="text-xs text-destructive">{errors.quantity}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Ngày nhập kho")} <span className="text-destructive">*</span></label>
            <DatePickerInput
              value={form.stockedAt}
              onChange={(v) => setForm((f) => ({ ...f, stockedAt: v }))}
              className={errors.stockedAt ? "border-destructive" : ""}
            />
            {errors.stockedAt && <p className="text-xs text-destructive">{errors.stockedAt}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Hạn sử dụng")}</label>
            <DatePickerInput
              value={form.expiryDate}
              onChange={(v) => setForm((f) => ({ ...f, expiryDate: v }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Cảnh báo trước (ngày)")}</label>
            <Input
              type="number"
              min={0}
              value={form.expiryWarningDays}
              onChange={(e) => setForm((f) => ({ ...f, expiryWarningDays: e.target.value }))}
              className={errors.expiryWarningDays ? "border-destructive" : ""}
            />
            {errors.expiryWarningDays && <p className="text-xs text-destructive">{errors.expiryWarningDays}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("Huỷ")}</Button>
          <Button disabled={receiveStock.isPending} onClick={() => void handleSubmit()}>
            {t("Nhập kho")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
