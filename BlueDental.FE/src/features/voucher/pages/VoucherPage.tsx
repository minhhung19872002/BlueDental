import { useEffect, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import dayjs from "dayjs";
import { useForm, Controller, useWatch } from "react-hook-form";
import {
  CUSTOMER_TARGET,
  customerTargetLabels,
  DISCOUNT_TYPE,
  VOUCHER_STATUS,
  voucherStatusConfig,
  useActivateVoucher,
  useCreateVoucher,
  useDeleteVoucher,
  usePauseVoucher,
  useUpdateVoucher,
  useVoucherStats,
  useVouchers,
  type DiscountType,
  type VoucherCustomerTarget,
  type VoucherDto,
  type VoucherStatus,
} from "../api/voucherApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { formatDate, formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";

interface VoucherFormValues {
  code: string;
  name: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  customerTarget: VoucherCustomerTarget;
  validFrom: string;
  validTo: string;
  usageLimit?: number | null;
}

function StatTile({
  value,
  label,
  testId,
}: {
  value: number;
  label: string;
  testId: string;
}) {
  return (
    <div className="reception-card" data-testid={testId} style={{ padding: "16px 20px" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#101c2c", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#6f7c90" }}>{label}</div>
    </div>
  );
}

function VoucherModal({
  open,
  voucher,
  onClose,
}: {
  open: boolean;
  voucher: VoucherDto | null;
  onClose: () => void;
}) {
  const branchId = useCurrentBranchId();
  const createVoucher = useCreateVoucher();
  const updateVoucher = useUpdateVoucher();
  const isEdit = voucher !== null;

  const { register, handleSubmit, control, reset, watch, setValue, formState: { errors } } = useForm<VoucherFormValues>();
  const discountType = useWatch({ control, name: "discountType" }) ?? voucher?.discountType ?? DISCOUNT_TYPE.Percentage;

  useEffect(() => {
    if (!open) return;
    reset({
      code: voucher?.code ?? "",
      name: voucher?.name ?? "",
      description: voucher?.description ?? "",
      discountType: voucher?.discountType ?? DISCOUNT_TYPE.Percentage,
      discountValue: voucher?.discountValue ?? (undefined as unknown as number),
      maxDiscountAmount: voucher?.maxDiscountAmount ?? undefined,
      minOrderAmount: voucher?.minOrderAmount ?? undefined,
      customerTarget: voucher?.customerTarget ?? CUSTOMER_TARGET.All,
      validFrom: voucher?.validFrom ? dayjs(voucher.validFrom).format("YYYY-MM-DD") : "",
      validTo: voucher?.validTo ? dayjs(voucher.validTo).format("YYYY-MM-DD") : dayjs().add(30, "day").format("YYYY-MM-DD"),
      usageLimit: voucher?.usageLimit ?? undefined,
    });
  }, [open, voucher, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit) {
        await updateVoucher.mutateAsync({
          id: voucher.id,
          input: {
            name: values.name,
            description: values.description,
            minOrderAmount: values.minOrderAmount ?? null,
            maxDiscountAmount: values.maxDiscountAmount ?? null,
            customerTarget: values.customerTarget,
            validFrom: values.validFrom,
            validTo: values.validTo,
          },
        });
        toast.success(t("Đã cập nhật voucher"));
      } else {
        await createVoucher.mutateAsync({
          clinicBranchId: branchId,
          code: values.code,
          name: values.name,
          description: values.description,
          discountType: values.discountType,
          discountValue: values.discountValue,
          maxDiscountAmount: values.maxDiscountAmount ?? null,
          minOrderAmount: values.minOrderAmount ?? null,
          customerTarget: values.customerTarget,
          validFrom: values.validFrom,
          validTo: values.validTo,
          usageLimit: values.usageLimit ?? null,
        });
        toast.success(t("Đã tạo voucher"));
      }
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("Sửa voucher {0}", voucher.code) : t("Tạo voucher")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 mt-2">
          {/* Row 1: code + name */}
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-2">
              <label className="text-sm font-medium mb-1 block">{t("Mã voucher")} <span className="text-destructive">*</span></label>
              <Input disabled={isEdit} placeholder="SUM26" {...register("code", { required: t("Vui lòng nhập mã") })} />
              {errors.code && <p className="text-xs text-destructive mt-1">{errors.code.message}</p>}
            </div>
            <div className="col-span-3">
              <label className="text-sm font-medium mb-1 block">{t("Tên chương trình")} <span className="text-destructive">*</span></label>
              <Input placeholder={t("Khuyến mãi hè")} {...register("name", { required: t("Vui lòng nhập tên") })} />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
            </div>
          </div>

          {/* Row 2: discount type + value */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Kiểu giảm")} <span className="text-destructive">*</span></label>
              <Controller control={control} name="discountType" rules={{ required: true }}
                render={({ field }) => (
                  <Select disabled={isEdit} onValueChange={(v) => field.onChange(Number(v))} value={String(field.value ?? DISCOUNT_TYPE.Percentage)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={String(DISCOUNT_TYPE.Percentage)}>{t("Theo phần trăm (%)")}</SelectItem>
                      <SelectItem value={String(DISCOUNT_TYPE.Money)}>{t("Số tiền cố định (đ)")}</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                {discountType === DISCOUNT_TYPE.Percentage ? t("Mức giảm (%)") : t("Mức giảm (đ)")} <span className="text-destructive">*</span>
              </label>
              <Input type="number" min={0} max={discountType === DISCOUNT_TYPE.Percentage ? 100 : undefined} disabled={isEdit}
                {...register("discountValue", { required: t("Vui lòng nhập mức giảm"), valueAsNumber: true, min: { value: 1, message: t("Mức giảm phải lớn hơn 0") } })} />
              {errors.discountValue && <p className="text-xs text-destructive mt-1">{errors.discountValue.message}</p>}
            </div>
          </div>

          {/* Row 3: min order + max discount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Đơn tối thiểu (đ)")}</label>
              <Input type="number" min={0} step={100000} {...register("minOrderAmount", { valueAsNumber: true })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Giảm tối đa (đ)")}</label>
              <Input type="number" min={0} step={100000} disabled={discountType !== DISCOUNT_TYPE.Percentage}
                {...register("maxDiscountAmount", { valueAsNumber: true })} />
            </div>
          </div>

          {/* Row 4: customer target + usage limit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Áp dụng cho")} <span className="text-destructive">*</span></label>
              <Controller control={control} name="customerTarget" rules={{ required: true }}
                render={({ field }) => (
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={String(field.value ?? CUSTOMER_TARGET.All)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(customerTargetLabels()).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Giới hạn lượt dùng")}</label>
              <Input type="number" min={1} disabled={isEdit} placeholder={t("Bỏ trống = không giới hạn")}
                {...register("usageLimit", { valueAsNumber: true })} />
            </div>
          </div>

          {/* Row 5: date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Từ ngày")} <span className="text-destructive">*</span></label>
              <DatePickerInput value={watch("validFrom")} onChange={(v) => setValue("validFrom", v, { shouldValidate: true })} />
              {errors.validFrom && <p className="text-xs text-destructive mt-1">{errors.validFrom.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Đến ngày")} <span className="text-destructive">*</span></label>
              <DatePickerInput value={watch("validTo")} onChange={(v) => setValue("validTo", v, { shouldValidate: true })} />
              {errors.validTo && <p className="text-xs text-destructive mt-1">{errors.validTo.message}</p>}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium mb-1 block">{t("Mô tả")}</label>
            <textarea rows={2} {...register("description")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("Huỷ")}</Button>
            <Button type="submit" disabled={createVoucher.isPending || updateVoucher.isPending}>
              {(createVoucher.isPending || updateVoucher.isPending) && <Loader2 className="size-4 animate-spin mr-2" />}
              {isEdit ? t("Lưu") : t("Tạo")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function VoucherPage() {
  const branchId = useCurrentBranchId();
  const [statusFilter, setStatusFilter] = useState<VoucherStatus | undefined>();
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VoucherDto | null>(null);

  const { data: stats } = useVoucherStats(branchId);
  const { data: page, isLoading } = useVouchers(branchId, statusFilter, keyword);

  const activateVoucher = useActivateVoucher();
  const pauseVoucher = usePauseVoucher();
  const deleteVoucher = useDeleteVoucher();

  const run = async (action: Promise<unknown>, successMessage: string) => {
    try {
      await action;
      toast.success(successMessage);
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const statusCfg = voucherStatusConfig();
  const voucherItems = page?.items ?? [];

  return (
    <div className="reception-page">
      <PageHeader
        title={t("Voucher khuyến mãi")}
        subtitle={t("Voucher mới luôn ở trạng thái Nháp — phải kích hoạt mới dùng được")}
      />

      <div className="reception-card" style={{ padding: "16px 20px", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#101c2c" }}>{t("Voucher khuyến mãi")}</div>
        <span style={{ fontSize: 13, color: "#6f7c90" }}>{t("Quản lý các chương trình khuyến mãi cho khách hàng")}</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <StatTile value={stats?.total ?? 0} label={t("Tổng voucher")} testId="voucher-stat-total" />
        <StatTile value={stats?.active ?? 0} label={t("Đang hoạt động")} testId="voucher-stat-active" />
        <StatTile value={stats?.issued ?? 0} label={t("Đã phát hành")} testId="voucher-stat-issued" />
        <StatTile value={stats?.expired ?? 0} label={t("Đã hết hạn")} testId="voucher-stat-expired" />
      </div>

      {/* Toolbar */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t("Tìm theo mã hoặc tên voucher...")} value={keyword} onChange={(e) => setKeyword(e.target.value)} className="pl-8 w-72" />
          </div>
          <Select value={statusFilter !== undefined ? String(statusFilter) : "__all"} onValueChange={(v) => setStatusFilter(v === "__all" ? undefined : (Number(v) as VoucherStatus))}>
            <SelectTrigger className="w-44"><SelectValue placeholder={t("Tất cả trạng thái")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">{t("Tất cả trạng thái")}</SelectItem>
              {Object.entries(statusCfg).map(([value, config]) => (
                <SelectItem key={value} value={value}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="ml-auto" onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus size={14} className="mr-1.5" />{t("Tạo voucher")}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="reception-card reception-card--content overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Mã / Tên Voucher")}</TableHead>
              <TableHead className="w-44">{t("Mức giảm")}</TableHead>
              <TableHead className="w-52">{t("Điều kiện áp dụng")}</TableHead>
              <TableHead className="w-48">{t("Thời hạn")}</TableHead>
              <TableHead className="w-28">{t("Lượt dùng")}</TableHead>
              <TableHead className="w-36">{t("Trạng thái")}</TableHead>
              <TableHead className="w-56">{t("Thao tác")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : voucherItems.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("Chưa có voucher nào — nhấn \"Tạo voucher\" để bắt đầu.")}</TableCell></TableRow>
            ) : (
              voucherItems.map((row) => {
                const config = statusCfg[row.status];
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-semibold text-[#101c2c]">{row.code}</div>
                      <div className="text-xs text-[#6f7c90]">{row.name}</div>
                    </TableCell>
                    <TableCell>
                      {row.discountType === DISCOUNT_TYPE.Percentage
                        ? `${row.discountValue}%${row.maxDiscountAmount ? ` (tối đa ${formatVND(row.maxDiscountAmount)} đ)` : ""}`
                        : `${formatVND(row.discountValue)} đ`}
                    </TableCell>
                    <TableCell>
                      <div>{customerTargetLabels()[row.customerTarget]}</div>
                      {row.minOrderAmount != null && (
                        <div className="text-xs text-[#6f7c90]">{t("Đơn từ")} {formatVND(row.minOrderAmount)} {t("đ")}</div>
                      )}
                    </TableCell>
                    <TableCell>{`${formatDate(row.validFrom)} – ${formatDate(row.validTo)}`}</TableCell>
                    <TableCell>{row.usageLimit == null ? `${row.usedCount} / ∞` : `${row.usedCount} / ${row.usageLimit}`}</TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: config.color + "22", color: config.color, border: `1px solid ${config.color}44` }}>
                        {config.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {row.status !== VOUCHER_STATUS.Active && row.status !== VOUCHER_STATUS.Expired && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-primary"
                            onClick={() => run(activateVoucher.mutateAsync(row.id), t("Đã kích hoạt voucher"))}>
                            {t("Kích hoạt")}
                          </Button>
                        )}
                        {row.status === VOUCHER_STATUS.Active && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                            onClick={() => run(pauseVoucher.mutateAsync(row.id), t("Đã tạm dừng voucher"))}>
                            {t("Tạm dừng")}
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditing(row); setModalOpen(true); }}>
                          {t("Sửa")}
                        </Button>
                        {row.usedCount === 0 && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive">{t("Xoá")}</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>{t("Xoá voucher này?")}</AlertDialogTitle></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("Huỷ")}</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
                                  onClick={() => run(deleteVoucher.mutateAsync(row.id), t("Đã xoá voucher"))}>
                                  {t("Xoá")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <VoucherModal
        open={modalOpen}
        voucher={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
      />
    </div>
  );
}
