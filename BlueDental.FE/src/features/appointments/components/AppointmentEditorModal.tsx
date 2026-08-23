import { useEffect, useMemo, useState } from "react";
import { Modal, Button, Input, DatePicker, TimePicker, message } from "antd";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import { useCreateAppointment } from "../api/appointmentMutations";
import { SearchSelect } from "@/components/SearchSelect";
import { usePatientList } from "@/features/patient-management/api/patientQueries";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useDebounce } from "@/hooks/useDebounce";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

function createSchema(t: TFunction) {
  return z.object({
    patientId: z.string().min(1, t("appointmentEditor.validation.patientRequired")),
    doctorId: z.string().min(1, t("appointmentEditor.validation.doctorRequired")),
    date: z.string().min(1, t("appointmentEditor.validation.dateRequired")),
    startTime: z.string().min(1, t("appointmentEditor.validation.startTimeRequired")),
    endTime: z.string().optional(),
    reason: z.string().optional(),
    notes: z.string().optional(),
  });
}

type FormValues = z.infer<ReturnType<typeof createSchema>>;

interface Props {
  open: boolean;
  appointmentId?: string | null;
  initialDate?: string;
  initialTime?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AppointmentEditorModal({ open, appointmentId, initialDate, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const schema = useMemo(() => createSchema(t), [t]);
  const isEdit = Boolean(appointmentId);
  const createMutation = useCreateAppointment();
  const [patientKeyword, setPatientKeyword] = useState("");
  const debouncedPatientKeyword = useDebounce(patientKeyword);
  const { data: patientData } = usePatientList({ keyword: debouncedPatientKeyword || undefined, maxResultCount: 20 });
  const { data: dentists } = useDentistList();

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
          message.success(t("appointment.createSuccess"));
          reset();
          onSuccess?.();
          onClose();
        },
        onError: (err) => {
          message.error((err as Error).message || t("appointment.createFailed"));
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
      title={isEdit ? t("appointment.editTitle") : t("appointment.createTitle")}
      onCancel={onClose}
      width={580}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            type="primary"
            loading={createMutation.isPending}
            onClick={handleSubmit(onSubmit)}
            style={{ background: "#2671D8" }}
          >
            {isEdit ? t("common.update") : t("appointment.saveBtn")}
          </Button>
        </div>
      }
    >
      <div style={{ paddingTop: 8 }}>
        {/* Patient */}
        <div style={fieldStyle}>
          <label style={labelStyle}>{t("appointment.patientLabel")}{requiredMark}</label>
          <Controller
            name="patientId"
            control={control}
            render={({ field }) => (
              <SearchSelect
                value={field.value || undefined}
                placeholder={t("appointment.searchPatientPlaceholder")}
                options={(patientData?.items ?? []).map((p) => ({
                  value: p.id,
                  label: `[${p.code}] - ${p.fullName.toUpperCase()}`,
                }))}
                onSearch={setPatientKeyword}
                onChange={(v) => field.onChange(v ?? "")}
                status={errors.patientId ? "error" : ""}
              />
            )}
          />
          {errors.patientId && <span style={{ color: "#EF4444", fontSize: 12 }}>{errors.patientId.message}</span>}
        </div>

        {/* Doctor */}
        <div style={fieldStyle}>
          <label style={labelStyle}>{t("appointment.doctorLabel")}{requiredMark}</label>
          <Controller
            name="doctorId"
            control={control}
            render={({ field }) => (
              <SearchSelect
                value={field.value || undefined}
                placeholder={t("appointment.selectDoctor")}
                options={(dentists ?? []).map((d) => ({ value: d.id, label: d.name ?? d.userName }))}
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
            <label style={labelStyle}>{t("appointment.dateLabel")}{requiredMark}</label>
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
            <label style={labelStyle}>{t("appointment.startTimeLabel")}{requiredMark}</label>
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
            <label style={labelStyle}>{t("appointment.endTimeLabel")}</label>
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
          <label style={labelStyle}>{t("appointment.colReason")}</label>
          <Controller
            name="reason"
            control={control}
            render={({ field }) => (
              <Input {...field} placeholder={t("appointment.reasonPlaceholder")} style={{ height: 40 }} />
            )}
          />
        </div>

        {/* Notes */}
        <div style={fieldStyle}>
          <label style={labelStyle}>{t("common.note")}</label>
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <Input.TextArea {...field} rows={3} placeholder={t("appointment.notesPlaceholder")} style={{ resize: "none" }} />
            )}
          />
        </div>
      </div>
    </Modal>
  );
}
