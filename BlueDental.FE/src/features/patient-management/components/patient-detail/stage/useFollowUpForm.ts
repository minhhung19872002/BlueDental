import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import {
  useAttachReExaminationImage,
  useCreateReExamination,
  useCreateStage,
  type TreatmentStageDto,
} from "@/features/treatment-management/api/stageApi";
import type { TreatmentPlanSlipDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { useUploadPatientImage } from "../../../api/patientImageApi";

/** Field-level messages, keyed by the field they sit under. */
export interface FollowUpErrors {
  staff?: string;
  note?: string;
  teeth?: string;
}

interface Options {
  open: boolean;
  patientId: string;
  branchId: string;
  plan: TreatmentPlanSlipDto | null;
  /** The finished công đoạn the follow-up is raised against. */
  stage: TreatmentStageDto | null;
  /** A tái khám picks among the stage's teeth; a warranty visit inherits them. */
  pickTeeth: boolean;
  /** Toast shown once the follow-up is written. */
  saved: string;
  onClose: () => void;
}

/**
 * The state and the write behind "Tạo bảo hành" / "Tạo tái khám".
 *
 * The two forms look identical but land in different places: a warranty visit
 * is another công đoạn on the same line flagged `isGuarantee`, while a tái khám
 * is a row of its own with its own resource. Keeping that fork here leaves the
 * dialog as layout.
 */
export function useFollowUpForm({
  open,
  patientId,
  branchId,
  plan,
  stage,
  pickTeeth,
  saved,
  onClose,
}: Options) {
  const createStage = useCreateStage();
  const createReExam = useCreateReExamination();
  const attachReExamImage = useAttachReExaminationImage();
  const uploadImage = useUploadPatientImage();

  const [staffId, setStaffId] = useState<string>();
  const [subStaffId, setSubStaffId] = useState<string>();
  const [secondStaffId, setSecondStaffId] = useState<string>();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<File[]>([]);
  /** Tooth codes ticked in the form; only meaningful when `pickTeeth`. */
  const [picked, setPicked] = useState<number[]>([]);
  /**
   * Which fields failed the last save attempt. The reference reports these
   * **under the field**, not as a toast: a toast leaves you hunting for which
   * of three inputs it meant, and it is gone by the time you look.
   */
  const [errors, setErrors] = useState<FollowUpErrors>({});

  useEffect(() => {
    if (!open) return;
    setStaffId(stage?.staffId);
    setSubStaffId(stage?.subStaffId ?? undefined);
    setSecondStaffId(stage?.secondStaffId ?? undefined);
    setNote("");
    setPending([]);
    setPicked([]);
    setErrors({});
  }, [open, stage]);

  const line = plan?.services.find((item) => item.id === stage?.treatmentServiceId) ?? null;

  /** The công đoạn's own teeth are the candidates; a follow-up picks among them. */
  const candidates = (stage?.teeth.length ?? 0) > 0 ? (stage?.teeth ?? []) : (line?.teeth ?? []);

  /**
   * Blob previews for the chosen files, revoked when the list changes or the
   * dialog closes — minting them in the render would hand out a fresh URL on
   * every keystroke and never release one.
   */
  const previews = useMemo(() => pending.map((file) => URL.createObjectURL(file)), [pending]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const toggleTooth = (toothCode: number) => {
    setErrors((current) => ({ ...current, teeth: undefined }));
    setPicked((current) =>
      current.includes(toothCode)
        ? current.filter((code) => code !== toothCode)
        : [...current, toothCode],
    );
  };

  const changeStaff = (value: string) => {
    setErrors((current) => ({ ...current, staff: undefined }));
    setStaffId(value);
  };

  const changeNote = (value: string) => {
    if (value.trim()) setErrors((current) => ({ ...current, note: undefined }));
    setNote(value);
  };

  const addFiles = (files: File[]) => setPending((current) => [...current, ...files]);
  const removeFile = (at: number) =>
    setPending((current) => current.filter((_, index) => index !== at));

  const save = async () => {
    if (!stage || !line || !plan) return;

    const found: FollowUpErrors = {
      staff: staffId ? undefined : t("Vui lòng chọn bác sĩ"),
      note: note.trim() ? undefined : t("Vui lòng nhập nội dung điều trị"),
      teeth: pickTeeth && picked.length === 0 ? t("Vui lòng chọn răng") : undefined,
    };
    setErrors(found);
    // Report every empty field at once, beneath each one, instead of making the
    // user press Lưu three times to discover them one at a time.
    if (found.staff || found.note || found.teeth || !staffId) return;

    try {
      if (pickTeeth) {
        // A tái khám is its own row, so it goes to its own resource and takes
        // only the teeth that were ticked.
        const created = await createReExam.mutateAsync({
          patientId,
          clinicBranchId: branchId,
          patientStageId: stage.id,
          staffId,
          subStaffId,
          secondStaffId,
          note: note.trim(),
          teeth: candidates.filter((tooth) => picked.includes(tooth.toothCode)),
        });

        for (const file of pending) {
          const image = await uploadImage.mutateAsync({ patientId, clinicBranchId: branchId, file });
          await attachReExamImage.mutateAsync({ id: created.id, imageUrl: image.url });
        }
      } else {
        const created = await createStage.mutateAsync({
          patientId,
          clinicBranchId: branchId,
          treatmentId: plan.id,
          treatmentServiceId: line.id,
          serviceId: line.serviceId,
          name: line.serviceName ?? line.code,
          note: note.trim(),
          staffId,
          subStaffId,
          secondStaffId,
          teeth: candidates,
          isGuarantee: true,
        });

        for (const file of pending) {
          await uploadImage.mutateAsync({
            patientId,
            clinicBranchId: branchId,
            treatmentStageId: created.id,
            file,
          });
        }
      }

      toast.success(t(saved));
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return {
    line,
    candidates,
    previews,
    errors,
    staffId,
    setStaffId: changeStaff,
    subStaffId,
    setSubStaffId,
    secondStaffId,
    setSecondStaffId,
    note,
    setNote: changeNote,
    pending,
    picked,
    toggleTooth,
    addFiles,
    removeFile,
    save,
    saving:
      createStage.isPending ||
      createReExam.isPending ||
      uploadImage.isPending ||
      attachReExamImage.isPending,
  };
}
