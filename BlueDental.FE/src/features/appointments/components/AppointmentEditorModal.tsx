import { useEffect } from "react";
import { Modal, Button, Input, DatePicker, TimePicker, message } from "antd";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
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
          message.success(t("Tạo lịch hẹn thành công!"));
          reset();
          onSuccess?.();
          onClose();
        },
        onError: (err) => {
          message.error((err as Error).message || t("Tạo lịch hẹn thất bại"));
        },
      },
    );
  };

  const fieldStyle = { marginBottom: 12 };
  const labelStyle = { fontSize: 13, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 };
  const requiredMark = <span style={{ color: "#EF4444", marginLeft: 2 }}>*</span>;

  return (
    <Modal
      open={open}
      title={isEdit ? t("Chỉnh sửa lịch hẹn") : t("Tạo lịch hẹn mới")}
      onCancel={onClose}
      width={580}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={onClose}>{t("Hủy")}</Button>
          <Button
            type="primary"
            loading={createMutation.isPending}
            onClick={handleSubmit(onSubmit)}
            style={{ background: "#2671D8" }}
          >
            {isEdit ? t("Cập nhật") : t("Lưu lịch hẹn")}
          </Button>
        </div>
      }
    >
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
          {errors.patientId && <span style={{ color: "#EF4444", fontSize: 12 }}>{errors.patientId.message}</span>}
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
          {errors.doctorId && <span style={{ color: "#EF4444", fontSize: 12 }}>{errors.doctorId.message}</span>}
        </div>

        {/* Date + Time row */}
        <div style={{ display: "flex", gap: 12, ...fieldStyle }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>{t("Ngày hẹn")}{requiredMark}</label>
            <Controller
              name="date"
              control={control}
              render={({ field }) => (
                <DatePicker
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(d) => field.onChange(d ? d.format("YYYY-MM-DD") : "")}
                  format="DD/MM/YYYY"
                  style={{ width: "100%", height: 40 }}
                  status={errors.date ? "error" : ""}
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
                <TimePicker
                  value={field.value ? dayjs(`2000-01-01 ${field.value}`) : null}
                  onChange={(t) => field.onChange(t ? t.format("HH:mm") : "")}
                  format="HH:mm"
                  minuteStep={30}
                  style={{ width: "100%", height: 40 }}
                  status={errors.startTime ? "error" : ""}
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
                <TimePicker
                  value={field.value ? dayjs(`2000-01-01 ${field.value}`) : null}
                  onChange={(t) => field.onChange(t ? t.format("HH:mm") : "")}
                  format="HH:mm"
                  minuteStep={30}
                  style={{ width: "100%", height: 40 }}
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
              <Input.TextArea {...field} rows={3} placeholder={t("Nội dung ghi chú")} style={{ resize: "none" }} />
            )}
          />
        </div>
      </div>
    </Modal>
  );
}
