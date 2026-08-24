import { useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import {
  CASH_HOLDING,
  CASH_HOLDING_LABELS,
  CASH_TRANSACTION_TYPE,
  useCashflowCategories,
  useCreateCashflowEntry,
  type CashHolding,
  type CashTransactionType,
} from "../api/financeApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { useAuthStore } from "@/features/auth/store/authStore";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";

interface CashflowEntryModalProps {
  open: boolean;
  transactionType: CashTransactionType;
  onClose: () => void;
}

interface CashflowFormValues {
  fromHolding: string;
  toHolding: string;
  amount: string;
  categoryId: string;
  entryDate: string;
  note: string;
}

const HOLDING_OPTIONS = Object.entries(CASH_HOLDING_LABELS).map(([value, label]) => ({
  value: String(value),
  label,
}));

export function CashflowEntryModal({ open, transactionType, onClose }: CashflowEntryModalProps) {
  const branchId = useCurrentBranchId();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const createEntry = useCreateCashflowEntry();
  const { data: categoryPage } = useCashflowCategories(branchId, true);

  const needsFrom = transactionType !== CASH_TRANSACTION_TYPE.Deposit;
  const needsTo = transactionType !== CASH_TRANSACTION_TYPE.Withdraw;

  const TITLES: Record<CashTransactionType, string> = {
    [CASH_TRANSACTION_TYPE.Deposit]: t("Nạp tiền"),
    [CASH_TRANSACTION_TYPE.Withdraw]: t("Rút tiền"),
    [CASH_TRANSACTION_TYPE.Transfer]: t("Luân chuyển"),
  };

  const schema = z.object({
    fromHolding: needsFrom ? z.string().min(1, t("Vui lòng chọn nguồn tiền")) : z.string().optional(),
    toHolding: needsTo ? z.string().min(1, t("Vui lòng chọn đích")) : z.string().optional(),
    amount: z.string().min(1, t("Vui lòng nhập số tiền")),
    categoryId: z.string().optional(),
    entryDate: z.string().min(1, t("Vui lòng chọn ngày")),
    note: z.string().optional(),
  });

  const { control, handleSubmit, reset, formState: { errors } } = useForm<CashflowFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fromHolding: needsFrom ? String(CASH_HOLDING.Cash) : "",
      toHolding: needsTo ? (transactionType === CASH_TRANSACTION_TYPE.Transfer ? String(CASH_HOLDING.Bank) : String(CASH_HOLDING.Cash)) : "",
      amount: "",
      categoryId: "",
      entryDate: dayjs().format("YYYY-MM-DD"),
      note: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      fromHolding: needsFrom ? String(CASH_HOLDING.Cash) : "",
      toHolding: needsTo ? (transactionType === CASH_TRANSACTION_TYPE.Transfer ? String(CASH_HOLDING.Bank) : String(CASH_HOLDING.Cash)) : "",
      amount: "",
      categoryId: "",
      entryDate: dayjs().format("YYYY-MM-DD"),
      note: "",
    });
  }, [open, transactionType, needsFrom, needsTo, reset]);

  const onSubmit = async (values: CashflowFormValues) => {
    if (!currentUserId) {
      toast.error(t("Không xác định được người dùng hiện tại."));
      return;
    }

    if (
      transactionType === CASH_TRANSACTION_TYPE.Transfer &&
      values.fromHolding === values.toHolding
    ) {
      toast.error(t("Nguồn và đích của luân chuyển phải khác nhau."));
      return;
    }

    try {
      await createEntry.mutateAsync({
        clinicBranchId: branchId,
        transactionType,
        fromHolding: needsFrom ? (Number(values.fromHolding) as CashHolding) : null,
        toHolding: needsTo ? (Number(values.toHolding) as CashHolding) : null,
        amount: Number(values.amount),
        categoryId: values.categoryId || null,
        createdByStaffId: currentUserId,
        entryDate: values.entryDate,
        note: values.note || undefined,
      });

      toast.success(t("Đã ghi nhận giao dịch {0}", TITLES[transactionType].toLowerCase()));
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{TITLES[transactionType]}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {needsFrom && (
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("Từ")} <span className="text-destructive">*</span></label>
              <Controller
                name="fromHolding"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className={errors.fromHolding ? "border-destructive" : ""}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOLDING_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.fromHolding && <p className="text-xs text-destructive">{errors.fromHolding.message}</p>}
            </div>
          )}

          {needsTo && (
            <div className="space-y-1">
              <label className="text-sm font-medium">{t("Đến")} <span className="text-destructive">*</span></label>
              <Controller
                name="toHolding"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className={errors.toHolding ? "border-destructive" : ""}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOLDING_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.toHolding && <p className="text-xs text-destructive">{errors.toHolding.message}</p>}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Số tiền (đ)")} <span className="text-destructive">*</span></label>
            <Controller
              name="amount"
              control={control}
              render={({ field }) => (
                <Input
                  type="number"
                  min={1}
                  step={100000}
                  {...field}
                  className={errors.amount ? "border-destructive" : ""}
                />
              )}
            />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Danh mục")}</label>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("Không bắt buộc")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t("Không chọn")}</SelectItem>
                    {(categoryPage?.items ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Ngày")} <span className="text-destructive">*</span></label>
            <Controller
              name="entryDate"
              control={control}
              render={({ field }) => (
                <DatePickerInput
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                  className={errors.entryDate ? "border-destructive" : ""}
                />
              )}
            />
            {errors.entryDate && <p className="text-xs text-destructive">{errors.entryDate.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Ghi chú")}</label>
            <Controller
              name="note"
              control={control}
              render={({ field }) => (
                <textarea
                  {...field}
                  rows={2}
                  className="w-full rounded-md border border-input px-3 py-2 text-sm"
                />
              )}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("Huỷ")}</Button>
          <Button
            disabled={createEntry.isPending}
            onClick={handleSubmit(onSubmit)}
          >
            {t("Ghi nhận")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
