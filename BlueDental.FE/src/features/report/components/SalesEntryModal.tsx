import { useEffect, useState } from "react";
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
  PAYMENT_CHANNEL,
  PAYMENT_CHANNEL_LABELS,
  SALES_ENTRY_TYPE,
  useCashflowCategories,
  useCreateCashflowCategory,
  useCreateSalesEntry,
  useUpdateSalesEntry,
  type PaymentChannel,
  type SalesEntryDto,
  type SalesEntryType,
} from "../api/financeApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { useAuthStore } from "@/features/auth/store/authStore";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";

interface SalesEntryModalProps {
  open: boolean;
  entry: SalesEntryDto | null;
  /** Only used when creating — an existing voucher keeps its own type. */
  defaultType: SalesEntryType;
  onClose: () => void;
}

interface SalesEntryFormValues {
  type: string;
  categoryId: string;
  amount: string;
  channel: string;
  description: string;
  entryDate: string;
}

const CHANNEL_OPTIONS = Object.entries(PAYMENT_CHANNEL_LABELS).map(([value, label]) => ({
  value: String(value),
  label,
}));

export function SalesEntryModal({ open, entry, defaultType, onClose }: SalesEntryModalProps) {
  const branchId = useCurrentBranchId();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);

  const createEntry = useCreateSalesEntry();
  const updateEntry = useUpdateSalesEntry();
  const createCategory = useCreateCashflowCategory();

  const { data: categoryPage } = useCashflowCategories(branchId, false);
  const isEdit = entry !== null;

  const schema = z.object({
    type: z.string().min(1),
    categoryId: z.string().min(1, t("Vui lòng chọn mục")),
    amount: z.string().min(1, t("Vui lòng nhập số tiền")),
    channel: z.string().min(1),
    description: z.string().min(1, t("Vui lòng nhập nội dung")),
    entryDate: z.string().min(1, t("Vui lòng chọn ngày")),
  });

  const { control, handleSubmit, watch, reset, formState: { errors } } = useForm<SalesEntryFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: String(entry?.type ?? defaultType),
      categoryId: entry?.categoryId ?? "",
      amount: entry?.amount ? String(entry.amount) : "",
      channel: String(entry?.channel ?? PAYMENT_CHANNEL.Cash),
      description: entry?.description ?? "",
      entryDate: dayjs(entry?.entryDate ?? undefined).format("YYYY-MM-DD"),
    },
  });

  const watchedType = watch("type");

  // Income and expense keep separate category lists, as on the reference.
  const categories = (categoryPage?.items ?? []).filter((c) => String(c.type) === watchedType);

  useEffect(() => {
    if (!open) return;
    reset({
      type: String(entry?.type ?? defaultType),
      categoryId: entry?.categoryId ?? "",
      amount: entry?.amount ? String(entry.amount) : "",
      channel: String(entry?.channel ?? PAYMENT_CHANNEL.Cash),
      description: entry?.description ?? "",
      entryDate: dayjs(entry?.entryDate ?? undefined).format("YYYY-MM-DD"),
    });
    setShowAddCategory(false);
    setNewCategoryName("");
  }, [open, entry, defaultType, reset]);

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;

    try {
      await createCategory.mutateAsync({
        clinicBranchId: branchId,
        name,
        type: Number(watchedType) as SalesEntryType,
        appliesToTransfers: false,
      });
      setNewCategoryName("");
      setShowAddCategory(false);
      toast.success(t("Đã thêm mục thu chi"));
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const onSubmit = async (values: SalesEntryFormValues) => {
    if (!currentUserId) {
      toast.error(t("Không xác định được người dùng hiện tại."));
      return;
    }

    try {
      if (isEdit) {
        await updateEntry.mutateAsync({
          id: entry.id,
          input: {
            categoryId: values.categoryId,
            amount: Number(values.amount),
            channel: Number(values.channel) as PaymentChannel,
            description: values.description,
            entryDate: values.entryDate,
          },
        });
        toast.success(t("Đã cập nhật phiếu"));
      } else {
        await createEntry.mutateAsync({
          clinicBranchId: branchId,
          type: Number(values.type) as SalesEntryType,
          categoryId: values.categoryId,
          staffId: currentUserId,
          amount: Number(values.amount),
          channel: Number(values.channel) as PaymentChannel,
          description: values.description,
          entryDate: values.entryDate,
        });
        toast.success(
          Number(values.type) === SALES_ENTRY_TYPE.Expense
            ? t("Đã tạo phiếu chi — đang chờ duyệt")
            : t("Đã tạo phiếu thu"),
        );
      }

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
            {isEdit ? t("Sửa phiếu {0}", entry.code) : t("Tạo phiếu thu chi")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Loại phiếu")} <span className="text-destructive">*</span></label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={String(SALES_ENTRY_TYPE.Income)}>{t("Phiếu thu")}</SelectItem>
                    <SelectItem value={String(SALES_ENTRY_TYPE.Expense)}>{t("Phiếu chi (cần duyệt)")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Mục thu chi")} <span className="text-destructive">*</span></label>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className={errors.categoryId ? "border-destructive" : ""}>
                    <SelectValue placeholder={categories.length === 0 ? t("Chưa có mục — thêm bên dưới") : t("Chọn mục")} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId.message}</p>}
            <button
              type="button"
              className="text-xs text-primary underline"
              onClick={() => setShowAddCategory((v) => !v)}
            >
              {showAddCategory ? t("Ẩn") : t("+ Thêm mục mới")}
            </button>
            {showAddCategory && (
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder={t("Thêm mục mới")}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleAddCategory(); }}
                />
                <Button type="button" size="sm" onClick={() => void handleAddCategory()}>{t("Thêm")}</Button>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Số tiền (đ)")} <span className="text-destructive">*</span></label>
            <Controller
              name="amount"
              control={control}
              render={({ field }) => (
                <Input
                  type="number"
                  min={1}
                  step={10000}
                  {...field}
                  className={errors.amount ? "border-destructive" : ""}
                />
              )}
            />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Hình thức")} <span className="text-destructive">*</span></label>
            <Controller
              name="channel"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t("Nội dung")} <span className="text-destructive">*</span></label>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <textarea
                  {...field}
                  rows={2}
                  placeholder={t("Nội dung thu / chi")}
                  className={`w-full rounded-md border px-3 py-2 text-sm ${errors.description ? "border-destructive" : "border-input"}`}
                />
              )}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("Huỷ")}</Button>
          <Button
            disabled={createEntry.isPending || updateEntry.isPending}
            onClick={handleSubmit(onSubmit)}
          >
            {isEdit ? t("Lưu") : t("Tạo")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
