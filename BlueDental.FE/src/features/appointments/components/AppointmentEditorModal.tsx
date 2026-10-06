import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import { useQueryClient } from "@tanstack/react-query";
import { AppDialog } from "@/components/AppDialog";
// The dialog carries its own styling: it opens from the calendar *and* from a
// patient's record, and the record's page does not import the calendar's CSS.
// Without this the modal renders full-width with its two columns collapsed.
import "./calendar.css";
import { useAppointment } from "../api/appointmentQueries";
import { useBookableDoctorOptions } from "../hooks/useBookableDoctorOptions";
import { useSaveAppointment } from "../hooks/useSaveAppointment";
import { APPOINTMENT_STATUSES, type AppointmentStatus } from "../types/appointment";
import type { AppointmentEditorValues } from "../types/appointmentEditor";
import { useClinicBranches } from "@/features/organizations/api";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { PatientEditorDialog } from "@/features/patient-management/components/PatientEditorDialog";
import type { PatientDto } from "@/features/patient-management/types/patient";
import { APPT_COLORS } from "./AppointmentColorPicker";
import { AppointmentEditorForm } from "./AppointmentEditorForm";
import { STATUS_GROUP } from "./appointmentStatusOptions";

/**
 * `storedStatus` is the edited booking's group: moving it to Đã huỷ needs a
 * written reason (bug list #16), one already cancelled keeps the one it has.
 */
const buildSchema = (storedStatus?: AppointmentStatus) =>
  z.object({
    patientId: z.string().min(1, t("Appointment:Form:SelectPatientRequired")),
    branchId: z.string().min(1, t("Appointment:Form:SelectBranchRequired")),
    doctorId: z.string().min(1, t("Appointment:Form:SelectDoctorRequired")),
    date: z.string().min(1, t("Appointment:Form:SelectDateRequired")),
    startTime: z.string().min(1, t("Appointment:Form:SelectTimeRequired")),
    durationMinutes: z.number().int().min(15),
    // Plain strings, not `.optional().default()`: that makes zod's input type
    // differ from its output type, and react-hook-form's resolver generics then
    // refuse the form values. The form always supplies all three.
    content: z.string(),
    color: z.string(),
    notes: z.string(),
    status: z.enum(APPOINTMENT_STATUSES),
    cancelNote: z.string(),
  }).superRefine((values, ctx) => {
    if (values.status === "cancelled" && storedStatus !== "cancelled" && !values.cancelNote.trim()) {
      ctx.addIssue({ code: "custom", path: ["cancelNote"], message: t("Common:CancelReasonRequired") });
    }
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
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const isEdit = Boolean(appointmentId);
  const { save, saving } = useSaveAppointment(appointmentId);
  const currentBranchId = useCurrentBranchId();

  const { data: existingAppt } = useAppointment(appointmentId ?? "");
  const { data: branches } = useClinicBranches(true);

  const storedStatus = existingAppt ? STATUS_GROUP[existingAppt.status] : undefined;
  const resolver = useMemo(() => zodResolver(buildSchema(storedStatus)), [storedStatus]);
  const { control, handleSubmit, reset, setValue, setError, clearErrors, formState: { errors, isValid } } = useForm<AppointmentEditorValues>({
    resolver,
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
      cancelNote: "",
    },
  });

  const branchOptions = useMemo(
    () => (branches ?? []).map((b) => ({ value: b.id, label: b.name })),
    [branches],
  );

  const watchedDoctorId = useWatch({ control, name: "doctorId" });
  const watchedDate = useWatch({ control, name: "date" });
  const watchedNotes = useWatch({ control, name: "notes" });

  const handleDoctorOff = useCallback(() => {
    setValue("doctorId", "", { shouldValidate: false });
    setError("doctorId", { type: "manual", message: t("Appointment:Form:DoctorOffOnDate") });
  }, [setValue, setError]);

  useEffect(() => {
    if (watchedDoctorId) clearErrors("doctorId");
  }, [watchedDoctorId, clearErrors]);

  // An existing booking keeps its doctor on its own day even if that doctor
  // has since gone OFF; moved to another day, the doctor must be free there.
  const keptDoctor = useMemo(() => {
    if (!existingAppt?.doctorId) return null;
    if (dayjs(existingAppt.startTime).format("YYYY-MM-DD") !== watchedDate) return null;
    return { id: existingAppt.doctorId, name: existingAppt.doctorName };
  }, [existingAppt, watchedDate]);

  const doctorOptions = useBookableDoctorOptions({
    date: watchedDate,
    doctorId: watchedDoctorId,
    kept: isEdit ? keptDoctor : null,
    onUnavailable: handleDoctorOff,
  });

  // The create seed runs once per opening. Anything that settles late — the
  // branch store, an option list — must not reset the form under a user who
  // has already picked a date.
  const seeded = useRef(false);

  useEffect(() => {
    if (!open) {
      seeded.current = false;
      setNewPatientOpen(false);
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
        cancelNote: existingAppt.cancellationNote ?? "",
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
      cancelNote: "",
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

  const queryClient = useQueryClient();

  const handlePatientCreated = useCallback(
    (created: PatientDto) => {
      setNewPatientOpen(false);
      setValue("patientId", created.id);
      queryClient.invalidateQueries({ queryKey: ["patient-options"] });
    },
    [setValue, queryClient],
  );

  const handleOpenNewPatient = useCallback(() => setNewPatientOpen(true), []);

  const onSubmit = async (data: AppointmentEditorValues) => {
    if (data.date && data.startTime) {
      const slot = dayjs(`${data.date} ${data.startTime}`);
      if (slot.isBefore(dayjs().startOf("minute"))) {
        toast.error(t("Appointment:Form:CannotCreatePast"));
        return;
      }
    }
    try {
      await save(data);
    } catch {
      return; // queryClient has already reported it; the dialog stays open.
    }
    toast.success(isEdit ? t("Appointment:Toast:UpdateSuccess") : t("Appointment:Toast:CreateSuccess"));
    reset();
    onSuccess?.();
    onClose();
  };

  return (
    <>
      <AppDialog
        open={open && !newPatientOpen}
        // The reference titles the two differently: "Tạo" for a new booking,
        // "Cập nhật" once it exists.
        title={isEdit ? t("Appointment:Modal:EditTitle") : t("Appointment:Modal:CreateTitle")}
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
          branchOptions={branchOptions}
          doctorOptions={doctorOptions}
          watchedDoctorId={watchedDoctorId}
          watchedDate={watchedDate}
          watchedNotes={watchedNotes}
          isEdit={isEdit}
          currentStatus={existingAppt?.status}
          lockPatient={lockPatient}
          onOpenNewPatient={handleOpenNewPatient}
        />
      </AppDialog>

      {newPatientOpen && (
        <PatientEditorDialog
          open
          patient={null}
          onClose={() => setNewPatientOpen(false)}
          onCreated={handlePatientCreated}
        />
      )}
    </>
  );
}
