import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import { AppDialog } from "@/components/AppDialog";
import { useCreateAppointment, useUpdateAppointment } from "../api/appointmentMutations";
import { useAppointment } from "../api/appointmentQueries";
import { usePatientOptions } from "@/hooks/usePatientOptions";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useClinicBranches } from "@/features/organizations/api";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { APPT_COLORS } from "./AppointmentColorPicker";
import { AppointmentEditorForm, type AppointmentEditorValues } from "./AppointmentEditorForm";

const buildSchema = () =>
  z.object({
    patientId: z.string().min(1, t("Vui lòng chọn bệnh nhân")),
    branchId: z.string().min(1, t("Vui lòng chọn chi nhánh")),
    doctorId: z.string().min(1, t("Vui lòng chọn bác sĩ")),
    date: z.string().min(1, t("Vui lòng chọn ngày")),
    startTime: z.string().min(1, t("Vui lòng chọn giờ hẹn")),
    durationMinutes: z.number().int().min(15),
    content: z.string(),
    color: z.string(),
    notes: z.string(),
  });

interface Props {
  open: boolean;
  appointmentId?: string | null;
  initialDate?: string;
  initialTime?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AppointmentEditorModal({
  open,
  appointmentId,
  initialDate,
  onClose,
  onSuccess,
}: Props) {
  const isEdit = Boolean(appointmentId);
  const createMutation = useCreateAppointment();
  const updateMutation = useUpdateAppointment(appointmentId ?? "");
  const currentBranchId = useCurrentBranchId();

  const { data: existingAppt } = useAppointment(appointmentId ?? "");
  const { data: patients } = usePatientOptions();
  const { data: dentists } = useDentistList();
  const { data: branches } = useClinicBranches(true);

  const patientOptions = useMemo(
    () => (patients ?? []).map((p) => ({ value: p.id, label: `[${p.code}] - ${p.name.toUpperCase()}` })),
    [patients],
  );
  const doctorOptions = useMemo(
    () => (dentists ?? []).map((d) => ({ value: d.id, label: d.name })),
    [dentists],
  );
  const branchOptions = useMemo(
    () => (branches ?? []).map((b) => ({ value: b.id, label: b.name })),
    [branches],
  );

  const { control, handleSubmit, reset, setValue, formState: { errors, isValid } } = useForm<AppointmentEditorValues>({
    resolver: zodResolver(buildSchema()),
    defaultValues: {
      patientId: "",
      branchId: currentBranchId,
      doctorId: "",
      date: initialDate ?? dayjs().format("YYYY-MM-DD"),
      startTime: "",
      durationMinutes: 30,
      content: "",
      color: APPT_COLORS[0].value,
      notes: "",
    },
  });

  const watchedDoctorId = useWatch({ control, name: "doctorId" });
  const watchedDate = useWatch({ control, name: "date" });
  const watchedNotes = useWatch({ control, name: "notes" });

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    if (isEdit && existingAppt) {
      const start = dayjs(existingAppt.startTime);
      const end = dayjs(existingAppt.endTime);
      reset({
        patientId: existingAppt.patientId,
        branchId: currentBranchId,
        doctorId: existingAppt.doctorId,
        date: start.format("YYYY-MM-DD"),
        startTime: start.format("HH:mm"),
        durationMinutes: end.diff(start, "minute"),
        content: existingAppt.reason ?? "",
        color: existingAppt.color ?? APPT_COLORS[0].value,
        notes: existingAppt.notes ?? "",
      });
    }
  }, [open, isEdit, existingAppt, reset, currentBranchId]);

  const activeMutation = isEdit ? updateMutation : createMutation;

  const onSubmit = (data: AppointmentEditorValues) => {
    const startDateTime = `${data.date}T${data.startTime}:00`;
    const endDateTime = dayjs(startDateTime).add(data.durationMinutes, "minute").format(`${data.date}THH:mm:00`);

    if (isEdit) {
      updateMutation.mutate(
        {
          doctorId: data.doctorId,
          startTime: startDateTime,
          endTime: endDateTime,
          reason: data.content ?? "",
          color: data.color ?? "",
          notes: data.notes ?? "",
        },
        {
          onSuccess: () => {
            toast.success(t("Cập nhật lịch hẹn thành công!"));
            reset();
            onSuccess?.();
            onClose();
          },
        },
      );
    } else {
      createMutation.mutate(
        {
          patientId: data.patientId,
          doctorId: data.doctorId,
          branchId: data.branchId,
          startTime: startDateTime,
          endTime: endDateTime,
          reason: data.content || undefined,
          color: data.color || undefined,
          notes: data.notes || undefined,
        },
        {
          onSuccess: () => {
            toast.success(t("Tạo lịch hẹn thành công!"));
            reset();
            onSuccess?.();
            onClose();
          },
        },
      );
    }
  };

  return (
    <AppDialog
      open={open}
      title={isEdit ? t("Chỉnh sửa lịch hẹn") : t("Tạo lịch hẹn")}
      width="calc(100vw - 80px)"
      className="appt-editor-dialog"
      canSave={isValid && !activeMutation.isPending}
      saving={activeMutation.isPending}
      onSave={handleSubmit(onSubmit)}
      onClose={onClose}
    >
      <AppointmentEditorForm
        control={control}
        errors={errors}
        setValue={setValue}
        patientOptions={patientOptions}
        branchOptions={branchOptions}
        doctorOptions={doctorOptions}
        watchedDoctorId={watchedDoctorId}
        watchedDate={watchedDate}
        watchedNotes={watchedNotes}
        isEdit={isEdit}
      />
    </AppDialog>
  );
}
