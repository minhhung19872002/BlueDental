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
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import { toast } from "sonner";
import { useCreateAppointment } from "../api/appointmentMutations";
import { SearchSelect } from "@/components/SearchSelect";
import { usePatientOptions } from "@/hooks/usePatientOptions";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { t } from "@/lib/i18n";

/** One appointment slot, matching the calendar grid. */
const SLOT_MINUTES = 30;

const buildSchema = () =>
  z.object({
  patientId: z.string().min(1, t("Vui lòng chọn khách hàng")),
  doctorId: z.string().min(1, t("Vui lòng chọn bác sĩ")),
  date: z.string().min(1, t("Vui lòng chọn ngày")),
  startTime: z.string().min(1, t("Vui lòng chọn giờ bắt đầu")),
  endTime: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

interface Props {
  open: boolean;
  appointmentId?: string | null;
  initialDate?: string;
  initialTime?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AppointmentEditorModal({ open, appointmentId, initialDate, onClose, onSuccess }: Props) {
  const isEdit = Boolean(appointmentId);
  const createMutation = useCreateAppointment();

  const { data: patients } = usePatientOptions();
  const { data: dentists } = useDentistList();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(buildSchema()),
    defaultValues: {
      patientId: "",
      doctorId: "",
      date: initialDate ?? dayjs().format("YYYY-MM-DD"),
      startTime: "",
      endTime: "",
      reason: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const onSubmit = (data: FormValues) => {
    const startDateTime = `${data.date}T${data.startTime}:00`;

    // A slot must end after it starts, so an unset end falls back to one slot long.
    const endTime = data.endTime || dayjs(startDateTime).add(SLOT_MINUTES, "minute").format("HH:mm");
    const endDateTime = `${data.date}T${endTime}:00`;

    createMutation.mutate(
      {
        patientId: data.patientId,
        doctorId: data.doctorId,
        startTime: startDateTime,
        endTime: endDateTime,
        reason: data.reason || undefined,
        notes: data.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t("Tạo lịch hẹn thành công!"));
          reset();
          onSuccess?.();
          onClose();
        },
        onError: (err) => {
          toast.error((err as Error).message || t("Tạo lịch hẹn thất bại"));
        },
      },
    );
  };

  const fieldStyle = { marginBottom: 12 };
  const labelStyle = { fontSize: 13, fontWeight: 500, color: "#41505f", display: "block", marginBottom: 4 };
  const requiredMark = <span style={{ color: "#ef4d4d", marginLeft: 2 }}>*</span>;

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent style={{ maxWidth: 580 }}>
        <DialogHeader>
          <DialogTitle>{isEdit ? t("Chỉnh sửa lịch hẹn") : t("Tạo lịch hẹn mới")}</DialogTitle>
        </DialogHeader>

        <div style={{ paddingTop: 8 }}>
          {/* Patient */}
          <div style={fieldStyle}>
            <label style={labelStyle}>{t("Khách hàng")}{requiredMark}</label>
            <Controller
              name="patientId"
              control={control}
              render={({ field }) => (
                <SearchSelect
                  value={field.value || undefined}
                  placeholder={t("Tìm kiếm khách hàng...")}
                  options={(patients ?? []).map((p) => ({
                    value: p.id,
                    label: `[${p.code}] - ${p.name.toUpperCase()}`,
                  }))}
                  onChange={(v) => field.onChange(v ?? "")}
                  status={errors.patientId ? "error" : ""}
                />
              )}
            />
            {errors.patientId && <span style={{ color: "#ef4d4d", fontSize: 12 }}>{errors.patientId.message}</span>}
          </div>

          {/* Doctor */}
          <div style={fieldStyle}>
            <label style={labelStyle}>{t("Bác sĩ")}{requiredMark}</label>
            <Controller
              name="doctorId"
              control={control}
              render={({ field }) => (
                <SearchSelect
                  value={field.value || undefined}
                  placeholder={t("Chọn bác sĩ")}
                  options={(dentists ?? []).map((d) => ({ value: d.id, label: d.name }))}
                  onChange={(v) => field.onChange(v ?? "")}
                  status={errors.doctorId ? "error" : ""}
                />
              )}
            />
            {errors.doctorId && <span style={{ color: "#ef4d4d", fontSize: 12 }}>{errors.doctorId.message}</span>}
          </div>

          {/* Date + Time row */}
          <div style={{ display: "flex", gap: 12, ...fieldStyle }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t("Ngày hẹn")}{requiredMark}</label>
              <Controller
                name="date"
                control={control}
                render={({ field }) => (
                  <DatePickerInput
                    value={field.value}
                    onChange={(v) => field.onChange(v)}
                    className={errors.date ? "border-destructive" : ""}
                  />
                )}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t("Giờ bắt đầu")}{requiredMark}</label>
              <Controller
                name="startTime"
                control={control}
                render={({ field }) => (
                  <Input
                    type="time"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    step={1800}
                    style={{ height: 40 }}
                    className={errors.startTime ? "border-destructive" : ""}
                  />
                )}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t("Giờ kết thúc")}</label>
              <Controller
                name="endTime"
                control={control}
                render={({ field }) => (
                  <Input
                    type="time"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    step={1800}
                    style={{ height: 40 }}
                  />
                )}
              />
            </div>
          </div>

          {/* Reason */}
          <div style={fieldStyle}>
            <label style={labelStyle}>{t("Lý do khám")}</label>
            <Controller
              name="reason"
              control={control}
              render={({ field }) => (
                <Input {...field} placeholder={t("Nhập lý do khám")} style={{ height: 40 }} />
              )}
            />
          </div>

          {/* Notes */}
          <div style={fieldStyle}>
            <label style={labelStyle}>{t("Ghi chú")}</label>
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <textarea
                  {...field}
                  rows={3}
                  placeholder={t("Nội dung ghi chú")}
                  style={{ resize: "none", width: "100%", padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 14 }}
                />
              )}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("Hủy")}</Button>
          <Button
            disabled={createMutation.isPending}
            onClick={handleSubmit(onSubmit)}
            style={{ background: "#1c3566" }}
          >
            {createMutation.isPending ? t("Đang lưu...") : isEdit ? t("Cập nhật") : t("Lưu lịch hẹn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
