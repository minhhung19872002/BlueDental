import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import { AppDialog } from "@/components/AppDialog";
import { useCreateTempAppointment } from "../api/appointmentMutations";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useClinicBranches } from "@/features/organizations/api";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { extractApiError } from "@/lib/apiError";
import { APPT_COLORS } from "./AppointmentColorPicker";
import { TempAppointmentForm, type TempAppointmentFormValues } from "./TempAppointmentForm";

const buildSchema = () =>
  z.object({
    patientName: z.string().min(1, t("Vui lòng nhập họ tên bệnh nhân")),
    patientPhone: z.string(),
    branchId: z.string().min(1, t("Vui lòng chọn chi nhánh")),
    doctorId: z.string(),
    date: z.string().min(1, t("Vui lòng chọn ngày")),
    startTime: z.string().min(1, t("Vui lòng chọn giờ hẹn")),
    durationMinutes: z.number().int().min(15),
    sourceTaxonomyId: z.string(),
    sourceEntryId: z.string(),
    color: z.string(),
    notes: z.string(),
  });

interface Props {
  open: boolean;
  initialDate?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TempAppointmentEditorModal({ open, initialDate, onClose, onSuccess }: Props) {
  const createMutation = useCreateTempAppointment();
  const currentBranchId = useCurrentBranchId();

  const { data: dentists } = useDentistList();
  const { data: branches } = useClinicBranches(true);

  const doctorOptions = useMemo(
    () => (dentists ?? []).map((d) => ({ value: d.id, label: d.name })),
    [dentists],
  );
  const branchOptions = useMemo(
    () => (branches ?? []).map((b) => ({ value: b.id, label: b.name })),
    [branches],
  );

  const { control, handleSubmit, reset, formState: { errors, isValid } } = useForm<TempAppointmentFormValues>({
    resolver: zodResolver(buildSchema()),
    defaultValues: {
      patientName: "",
      patientPhone: "",
      branchId: currentBranchId,
      doctorId: "",
      date: initialDate ?? dayjs().format("YYYY-MM-DD"),
      startTime: "",
      durationMinutes: 30,
      sourceTaxonomyId: "",
      sourceEntryId: "",
      color: APPT_COLORS[0].value,
      notes: "",
    },
  });

  const watchedDoctorId = useWatch({ control, name: "doctorId" });
  const watchedDate = useWatch({ control, name: "date" });
  const watchedSourceTaxonomyId = useWatch({ control, name: "sourceTaxonomyId" });

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const onSubmit = (data: TempAppointmentFormValues) => {
    const startDateTime = `${data.date}T${data.startTime}:00`;
    const endDateTime = dayjs(startDateTime).add(data.durationMinutes, "minute").format(`${data.date}THH:mm:00`);

    createMutation.mutate(
      {
        patientName: data.patientName,
        patientPhone: data.patientPhone || undefined,
        doctorId: data.doctorId || undefined,
        branchId: data.branchId,
        startTime: startDateTime,
        endTime: endDateTime,
        sourceTaxonomyId: data.sourceTaxonomyId || undefined,
        sourceEntryId: data.sourceEntryId || undefined,
        color: data.color || undefined,
        notes: data.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t("Tạo lịch tạm thành công!"));
          reset();
          onSuccess?.();
          onClose();
        },
        onError: (err) => {
          toast.error(extractApiError(err));
        },
      },
    );
  };

  return (
    <AppDialog
      open={open}
      title={t("Tạo lịch tạm")}
      width="calc(100vw - 80px)"
      className="appt-editor-dialog"
      canSave={isValid && !createMutation.isPending}
      saving={createMutation.isPending}
      onSave={handleSubmit(onSubmit)}
      onClose={onClose}
    >
      <TempAppointmentForm
        control={control}
        errors={errors}
        branchOptions={branchOptions}
        doctorOptions={doctorOptions}
        watchedDoctorId={watchedDoctorId}
        watchedDate={watchedDate}
        watchedSourceTaxonomyId={watchedSourceTaxonomyId}
      />
    </AppDialog>
  );
}
