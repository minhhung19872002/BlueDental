import { useEffect } from "react";
import { Modal, Button, Input, DatePicker, TimePicker, Form, message } from "antd";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import { useCreateAppointment } from "../api/appointmentMutations";
import { SearchSelect } from "@/components/SearchSelect";
import { MOCK_PATIENTS } from "@/features/reception/api/receptionApi";

const MOCK_DOCTORS = [
  { id: "d1", name: "BS Khanh" },
  { id: "d2", name: "BS Tiên" },
  { id: "d3", name: "BS Hương 4" },
  { id: "d4", name: "BS Hương" },
  { id: "d5", name: "BS Tới 10" },
  { id: "d6", name: "BS Tới 3" },
  { id: "d7", name: "BS Tới 1" },
  { id: "d8", name: "BS Tới" },
];

const schema = z.object({
  patientId: z.string().min(1, "Vui lòng chọn khách hàng"),
  doctorId: z.string().min(1, "Vui lòng chọn bác sĩ"),
  date: z.string().min(1, "Vui lòng chọn ngày"),
  startTime: z.string().min(1, "Vui lòng chọn giờ bắt đầu"),
  endTime: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

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

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
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
    const endDateTime = data.endTime ? `${data.date}T${data.endTime}:00` : `${data.date}T${data.startTime}:00`;

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
          message.success("Tạo lịch hẹn thành công!");
          reset();
          onSuccess?.();
          onClose();
        },
        onError: (err) => {
          message.error((err as Error).message || "Tạo lịch hẹn thất bại");
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
      title={isEdit ? "Chỉnh sửa lịch hẹn" : "Tạo lịch hẹn mới"}
      onCancel={onClose}
      width={580}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={onClose}>Hủy</Button>
          <Button
            type="primary"
            loading={createMutation.isPending}
            onClick={handleSubmit(onSubmit)}
            style={{ background: "#2671D8" }}
          >
            {isEdit ? "Cập nhật" : "Lưu lịch hẹn"}
          </Button>
        </div>
      }
    >
      <div style={{ paddingTop: 8 }}>
        {/* Patient */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Khách hàng{requiredMark}</label>
          <Controller
            name="patientId"
            control={control}
            render={({ field }) => (
              <SearchSelect
                value={field.value || undefined}
                placeholder="Tìm kiếm khách hàng..."
                options={MOCK_PATIENTS.map((p) => ({
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
          <label style={labelStyle}>Bác sĩ{requiredMark}</label>
          <Controller
            name="doctorId"
            control={control}
            render={({ field }) => (
              <SearchSelect
                value={field.value || undefined}
                placeholder="Chọn bác sĩ"
                options={MOCK_DOCTORS.map((d) => ({ value: d.id, label: d.name }))}
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
            <label style={labelStyle}>Ngày hẹn{requiredMark}</label>
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
            <label style={labelStyle}>Giờ bắt đầu{requiredMark}</label>
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
            <label style={labelStyle}>Giờ kết thúc</label>
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
          <label style={labelStyle}>Lý do khám</label>
          <Controller
            name="reason"
            control={control}
            render={({ field }) => (
              <Input {...field} placeholder="Nhập lý do khám" style={{ height: 40 }} />
            )}
          />
        </div>

        {/* Notes */}
        <div style={fieldStyle}>
          <label style={labelStyle}>Ghi chú</label>
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <Input.TextArea {...field} rows={3} placeholder="Nội dung ghi chú" style={{ resize: "none" }} />
            )}
          />
        </div>
      </div>
    </Modal>
  );
}
