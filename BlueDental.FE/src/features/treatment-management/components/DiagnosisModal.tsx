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
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateDiagnosis } from "../api/consultingQueries";
import { formatTeeth, type ToothSelectionDto } from "../api/consultingApi";
import { CATALOG_GROUP, useCatalogOptions } from "@/hooks/useCatalogOptions";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";

interface DiagnosisModalProps {
  open: boolean;
  patientId: string;
  /** Teeth currently marked on the chart — a diagnosis must cover at least one. */
  teeth: ToothSelectionDto[];
  onClose: () => void;
  onCreated?: () => void;
}

interface DiagnosisFormValues {
  diagnosisId: string;
  staffId: string;
  secondStaffId?: string;
  note?: string;
}

export function DiagnosisModal({
  open,
  patientId,
  teeth,
  onClose,
  onCreated,
}: DiagnosisModalProps) {
  const { control, handleSubmit, reset } = useForm<DiagnosisFormValues>({
    defaultValues: { diagnosisId: "", staffId: "", secondStaffId: "", note: "" },
  });
  const branchId = useCurrentBranchId();
  const createDiagnosis = useCreateDiagnosis();

  const { data: diagnoses } = useCatalogOptions(CATALOG_GROUP.Diagnosis);
  const { data: dentists } = useDentistList();

  useEffect(() => {
    if (!open) return;
    reset();
  }, [open, reset]);

  const onSubmit = async (values: DiagnosisFormValues) => {
    try {
      await createDiagnosis.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        diagnosisId: values.diagnosisId,
        staffId: values.staffId,
        secondStaffId: values.secondStaffId,
        note: values.note,
        teeth,
      });

      toast.success(t("Đã tạo phiếu chẩn đoán"));
      onCreated?.();
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Tạo phiếu chẩn đoán")}</DialogTitle>
        </DialogHeader>

        {teeth.length === 0 ? (
          <div className="border rounded-md p-4 bg-yellow-50 text-yellow-700 text-sm">
            <div className="font-medium mb-1">{t("Chưa chọn răng")}</div>
            <div className="text-xs text-yellow-600">
              {t("Chọn ít nhất một răng hoặc một mặt răng trên sơ đồ trước khi tạo phiếu chẩn đoán.")}
            </div>
          </div>
        ) : (
          <div className="border rounded-md p-3 bg-blue-50 text-blue-700 text-sm">
            {t("Răng đã chọn: {0}", formatTeeth(teeth))}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <fieldset disabled={teeth.length === 0} className="contents">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("Chẩn đoán")} <span className="text-destructive">*</span></label>
              <Controller
                name="diagnosisId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={teeth.length === 0}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          (diagnoses?.length ?? 0) === 0
                            ? t("Chưa có danh mục chẩn đoán — thêm ở trang Danh mục")
                            : t("Chọn chẩn đoán")
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(diagnoses ?? []).map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("Bác sĩ chẩn đoán")} <span className="text-destructive">*</span></label>
              <Controller
                name="staffId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={teeth.length === 0}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("Chọn bác sĩ")} />
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
              <label className="text-sm font-medium">{t("Bác sĩ hỗ trợ")}</label>
              <Controller
                name="secondStaffId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={teeth.length === 0}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("Không bắt buộc")} />
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
                    rows={3}
                    placeholder={t("Mô tả tình trạng")}
                    disabled={teeth.length === 0}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                  />
                )}
              />
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("Huỷ")}
            </Button>
            <Button type="submit" disabled={teeth.length === 0 || createDiagnosis.isPending}>
              {createDiagnosis.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
              {t("Tạo")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
