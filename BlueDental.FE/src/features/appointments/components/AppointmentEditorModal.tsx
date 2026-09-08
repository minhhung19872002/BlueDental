import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import { AppDialog } from "@/components/AppDialog";
// The dialog carries its own styling: it opens from the calendar *and* from a
// patient's record, and the record's page does not import the calendar's CSS.
// Without this the modal renders full-width with its two columns collapsed.
import "./calendar.css";
import { useAppointment } from "../api/appointmentQueries";
import { useSaveAppointment } from "../hooks/useSaveAppointment";
import { APPOINTMENT_STATUSES } from "../types/appointment";
import type { AppointmentEditorValues } from "../types/appointmentEditor";
import { usePatientOptions } from "@/hooks/usePatientOptions";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useClinicBranches } from "@/features/organizations/api";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { APPT_COLORS } from "./AppointmentColorPicker";
import { AppointmentEditorForm } from "./AppointmentEditorForm";
import { STATUS_GROUP } from "./appointmentStatusOptions";

const buildSchema = () =>
  z.object({
    patientId: z.string().min(1, t("Vui lòng chọn bệnh nhân")),
    branchId: z.string().min(1, t("Vui lòng chọn chi nhánh")),
    doctorId: z.string().min(1, t("Vui lòng chọn bác sĩ")),
    date: z.string().min(1, t("Vui lòng chọn ngày")),
    startTime: z.string().min(1, t("Vui lòng chọn giờ hẹn")),
    durationMinutes: z.number().int().min(15),
    // Plain strings, not `.optional().default()`: that makes zod's input type
    // differ from its output type, and react-hook-form's resolver generics then
    // refuse the form values. The form always supplies all three.
    content: z.string(),
    color: z.string(),
    notes: z.string(),
    status: z.enum(APPOINTMENT_STATUSES),
  });

interface Props {
  open: boolean;
  appointmentId?: string | null;
  initialDate?: string;
  initialTime?: string;
  initialDoctorId?: string;
  /**
   * Opened from a patient's own record: the patient is already known, so the
   * form seeds it and `lockPatient` stops it being changed — the reference
   * greys the field out in exactly that case.
   */
  initialPatientId?: string;
  initialReason?: string;
  lockPatient?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AppointmentEditorModal({
  open,
  appointmentId,
  initialDate,
  initialTime,
  initialDoctorId,
  initialPatientId,
  initialReason,
  lockPatient,
  onClose,
  onSuccess,
}: Props) {
  const isEdit = Boolean(appointmentId);
  const { save, saving } = useSaveAppointment(appointmentId);
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
      status: "scheduled",
    },
  });

  const watchedDoctorId = useWatch({ control, name: "doctorId" });
  const watchedDate = useWatch({ control, name: "date" });
  const watchedNotes = useWatch({ control, name: "notes" });

  // The create seed runs once per opening. Anything that settles late — the
  // branch store, an option list — must not reset the form under a user who
  // has already picked a date.
  const seeded = useRef(false);

  useEffect(() => {
    if (!open) {
      seeded.current = false;
      reset();
      return;
    }
    if (isEdit) {
      if (!existingAppt) return;
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
        status: STATUS_GROUP[existingAppt.status],
      });
      return;
    }

    // Creating: seed whatever the caller already knows. A patient screen knows
    // the patient, a diagnosis row knows what the visit is for, and the
    // calendar knows the slot and the doctor whose column was clicked.
    if (seeded.current) return;
    seeded.current = true;
    reset({
      patientId: initialPatientId ?? "",
      branchId: currentBranchId,
      doctorId: initialDoctorId ?? "",
      date: initialDate ?? dayjs().format("YYYY-MM-DD"),
      startTime: initialTime ?? "",
      durationMinutes: 30,
      content: initialReason ?? "",
      color: APPT_COLORS[0].value,
      notes: "",
      status: "scheduled",
    });
  }, [
    open,
    isEdit,
    existingAppt,
    reset,
    currentBranchId,
    initialPatientId,
    initialReason,
    initialDate,
    initialTime,
    initialDoctorId,
  ]);

  const onSubmit = async (data: AppointmentEditorValues) => {
    if (data.date && data.startTime) {
      const slot = dayjs(`${data.date} ${data.startTime}`);
      if (slot.isBefore(dayjs().startOf("minute"))) {
        toast.error(t("Không thể tạo lịch hẹn trong quá khứ"));
        return;
      }
    }
    try {
      await save(data);
    } catch {
      return; // queryClient has already reported it; the dialog stays open.
    }
    toast.success(isEdit ? t("Cập nhật lịch hẹn thành công!") : t("Tạo lịch hẹn thành công!"));
    reset();
    onSuccess?.();
    onClose();
  };

  return (
    <AppDialog
      open={open}
      // The reference titles the two differently: "Tạo" for a new booking,
      // "Cập nhật" once it exists.
      title={isEdit ? t("Cập nhật lịch hẹn") : t("Tạo lịch hẹn")}
      width="calc(100vw - 80px)"
      className="appt-editor-dialog"
      canSave={isValid && !saving}
      saving={saving}
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
        currentStatus={existingAppt?.status}
        lockPatient={lockPatient}
      />
    </AppDialog>
  );
}
