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
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateStage } from "../api/stageApi";
import {
  SERVICE_LINE_STATUS,
  useTreatmentPlans,
  type TreatmentPlanSlipDto,
} from "../api/treatmentPlanApi";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";

interface StageModalProps {
  open: boolean;
  patientId: string;
  onClose: () => void;
}

interface StageFormValues {
  serviceLineId: string;
  name: string;
  staffId: string;
  note?: string;
  scheduledDate?: string;
}

/** A service line and the slip it belongs to, flattened for the picker. */
interface ServiceLineOption {
  id: string;
  planId: string;
  label: string;
  serviceId: string;
}

/**
 * A công đoạn is always a step of one service line of a treatment slip, so only
 * lines that are still open are offered.
 */
export function StageModal({ open, patientId, onClose }: StageModalProps) {
  const { control, handleSubmit, reset } = useForm<StageFormValues>({
    defaultValues: { serviceLineId: "", name: "", staffId: "", note: "", scheduledDate: "" },
  });
  const branchId = useCurrentBranchId();
  const createStage = useCreateStage();

  const { data: plans } = useTreatmentPlans(patientId, branchId);
  const { data: dentists } = useDentistList();

  const serviceLines: ServiceLineOption[] = (plans?.items ?? []).flatMap(
    (slip: TreatmentPlanSlipDto) =>
      slip.services
        .filter(
          (line) =>
            line.status !== SERVICE_LINE_STATUS.Cancelled &&
            line.status !== SERVICE_LINE_STATUS.Done,
        )
        .map((line) => ({
          id: line.id,
          planId: slip.id,
          serviceId: line.serviceId,
          label: t("{0} · {1} — {2} đ", slip.code, line.serviceName ?? line.code, formatVND(line.effectiveAmount)),
        })),
  );

  useEffect(() => {
    if (!open) return;
    reset();
  }, [open, reset]);

  const onSubmit = async (values: StageFormValues) => {
    const line = serviceLines.find((item) => item.id === values.serviceLineId);
    if (!line) return;

    try {
      await createStage.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        treatmentId: line.planId,
        treatmentServiceId: line.id,
        serviceId: line.serviceId,
        name: values.name,
        note: values.note,
        staffId: values.staffId,
        scheduledDate: values.scheduledDate || undefined,
      });

      toast.success(t("Đã thêm công đoạn"));
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Thêm công đoạn")}</DialogTitle>
        </DialogHeader>

        {serviceLines.length === 0 ? (
          <div className="border rounded-md p-4 bg-blue-50 text-blue-700 text-sm">
            <div className="font-medium mb-1">{t("Chưa có dịch vụ điều trị đang mở")}</div>
            <div className="text-xs text-blue-600">
              {t("Công đoạn là một bước của dịch vụ trong kế hoạch điều trị. Hãy chốt phiếu tư vấn rồi tạo kế hoạch điều trị trước.")}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("Dịch vụ điều trị")} <span className="text-destructive">*</span></label>
              <Controller
                name="serviceLineId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("Chọn dịch vụ")} />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceLines.map((line) => (
                        <SelectItem key={line.id} value={line.id}>{line.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("Tên công đoạn")} <span className="text-destructive">*</span></label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input {...field} placeholder={t("Tên công đoạn")} maxLength={300} />
                )}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("Bác sĩ thực hiện")} <span className="text-destructive">*</span></label>
              <Controller
                name="staffId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("Chọn bác sĩ")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(dentists ?? []).map((dentist) => (
                        <SelectItem key={dentist.id} value={dentist.id}>{dentist.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("Ngày dự kiến")}</label>
              <Controller
                name="scheduledDate"
                control={control}
                render={({ field }) => (
                  <DatePickerInput value={field.value} onChange={(v) => field.onChange(v)} />
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
                    rows={3}
                    maxLength={2000}
                    placeholder={t("Ghi chú công đoạn")}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("Huỷ")}
              </Button>
              <Button type="submit" disabled={serviceLines.length === 0 || createStage.isPending}>
                {createStage.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                {t("Tạo")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
