import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateAdvise } from "../api/consultingQueries";
import {
  DISCOUNT_TYPE,
  formatTeeth,
  type DiscountType,
  type PatientDiagnosisDto,
} from "../api/consultingApi";
import { CATALOG_GROUP, useCatalogOptions } from "@/hooks/useCatalogOptions";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";

interface AdviseModalProps {
  open: boolean;
  patientId: string;
  /** The diagnosis this advise answers — an advise always hangs off one. */
  diagnosis: PatientDiagnosisDto | null;
  onClose: () => void;
  onCreated?: () => void;
}

interface AdviseFormValues {
  serviceId: string;
  staffId: string;
  secondStaffId?: string;
  price: string;
  quantity: string;
  discountType: string;
  discountValue: string;
  note?: string;
}

export function AdviseModal({
  open,
  patientId,
  diagnosis,
  onClose,
  onCreated,
}: AdviseModalProps) {
  const { control, handleSubmit, watch, setValue, reset } = useForm<AdviseFormValues>({
    defaultValues: {
      serviceId: "",
      staffId: "",
      secondStaffId: "",
      price: "0",
      quantity: "1",
      discountType: String(DISCOUNT_TYPE.None),
      discountValue: "0",
      note: "",
    },
  });
  const branchId = useCurrentBranchId();
  const createAdvise = useCreateAdvise();

  const { data: services } = useCatalogOptions(CATALOG_GROUP.CareService);
  const { data: dentists } = useDentistList();

  const serviceId = watch("serviceId");
  const price = Number(watch("price")) || 0;
  const quantity = Number(watch("quantity")) || 1;
  const discountType = Number(watch("discountType")) as DiscountType;
  const discountValue = Number(watch("discountValue")) || 0;

  const selectedService = services?.find((s) => s.id === serviceId);

  // Mirrors PatientAdvise.EffectiveAmount so the clinician sees what the server
  // will store, instead of finding out after saving.
  const gross = price * quantity;
  const discount =
    discountType === DISCOUNT_TYPE.Money
      ? discountValue
      : discountType === DISCOUNT_TYPE.Percentage
        ? (gross * discountValue) / 100
        : 0;
  const effective = Math.max(gross - discount, 0);

  useEffect(() => {
    if (!open) return;

    reset({
      serviceId: "",
      staffId: diagnosis?.staffId ?? "",
      secondStaffId: diagnosis?.secondStaffId ?? "",
      price: "0",
      quantity: "1",
      discountType: String(DISCOUNT_TYPE.None),
      discountValue: "0",
      note: "",
    });
  }, [open, diagnosis, reset]);

  const handleServiceChange = (value: string) => {
    // Default to the catalog price; the clinician can still negotiate it.
    const service = services?.find((s) => s.id === value);
    setValue("serviceId", value);
    setValue("price", String(service?.price ?? 0));
  };

  const onSubmit = async (values: AdviseFormValues) => {
    if (!diagnosis) return;

    try {
      await createAdvise.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        patientDiagnosisId: diagnosis.id,
        diagnosisId: diagnosis.diagnosisId,
        serviceId: values.serviceId,
        staffId: values.staffId,
        secondStaffId: values.secondStaffId,
        originalPrice: selectedService?.price ?? Number(values.price),
        price: Number(values.price),
        quantity: Number(values.quantity),
        discountType: Number(values.discountType) as DiscountType,
        discountValue: Number(values.discountType) === DISCOUNT_TYPE.None ? 0 : Number(values.discountValue),
        note: values.note,
        // An advise inherits the teeth of the diagnosis it answers.
        teeth: diagnosis.teeth,
      });

      toast.success(t("Đã tạo phiếu tư vấn"));
      onCreated?.();
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent style={{ maxWidth: 560 }}>
        <DialogHeader>
          <DialogTitle>
            {diagnosis ? t("Tạo dịch vụ cho phiếu {0}", diagnosis.code) : t("Tạo phiếu tư vấn")}
          </DialogTitle>
        </DialogHeader>

        {diagnosis && (
          <div className="border rounded-md p-3 bg-blue-50 text-blue-700 text-sm">
            {t("{0} — răng {1}", diagnosis.diagnosisName ?? diagnosis.code, formatTeeth(diagnosis.teeth))}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t("Dịch vụ")} <span className="text-destructive">*</span></label>
            <Select value={serviceId} onValueChange={handleServiceChange}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    (services?.length ?? 0) === 0
                      ? t("Chưa có danh mục dịch vụ — thêm ở trang Danh mục")
                      : t("Chọn dịch vụ")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(services ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.price != null ? t("{0} — {1} đ", s.name, formatVND(s.price)) : s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedService?.isImageRequired && (
            <div className="border rounded-md p-3 bg-yellow-50 text-yellow-700 text-sm">
              {t("Dịch vụ này yêu cầu đính kèm ảnh trước khi điều trị.")}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("Đơn giá (đ)")} <span className="text-destructive">*</span></label>
              <Controller
                name="price"
                control={control}
                render={({ field }) => (
                  <Input {...field} type="number" min={0} step={100000} />
                )}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("Số lượng")} <span className="text-destructive">*</span></label>
              <Controller
                name="quantity"
                control={control}
                render={({ field }) => (
                  <Input {...field} type="number" min={1} />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("Chiết khấu")}</label>
              <Controller
                name="discountType"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => { field.onChange(v); setValue("discountValue", "0"); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={String(DISCOUNT_TYPE.None)}>{t("Không chiết khấu")}</SelectItem>
                      <SelectItem value={String(DISCOUNT_TYPE.Money)}>{t("Số tiền (đ)")}</SelectItem>
                      <SelectItem value={String(DISCOUNT_TYPE.Percentage)}>{t("Phần trăm (%)")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("Giá trị")}</label>
              <Controller
                name="discountValue"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    type="number"
                    min={0}
                    max={discountType === DISCOUNT_TYPE.Percentage ? 100 : undefined}
                    disabled={discountType === DISCOUNT_TYPE.None}
                  />
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t("Bác sĩ tư vấn")} <span className="text-destructive">*</span></label>
            <Controller
              name="staffId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(dentists ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t("Ghi chú")}</label>
            <Controller
              name="note"
              control={control}
              render={({ field }) => (
                <textarea
                  {...field}
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              )}
            />
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">{t("Thành tiền")}</span>
            <span className="font-bold text-base" style={{ color: "#101c2c" }}>
              {formatVND(effective)} {t("đ")}
            </span>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("Huỷ")}
            </Button>
            <Button type="submit" disabled={createAdvise.isPending}>
              {createAdvise.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
              {t("Tạo")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
