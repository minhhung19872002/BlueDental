import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { validateImageFile } from "@/utils/validateImageFile";
import {
  useAttachReExaminationImage,
  useCreateReExamination,
  useCreateStage,
  type TreatmentStageDto,
} from "@/features/treatment-management/api/stageApi";
import type { TreatmentPlanSlipDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { useUploadPatientImage } from "../../../api/patientImageApi";
import { reExaminationChecklist } from "./reExaminationChecklist";
import {
  hasStageFieldError,
  stageFieldErrors,
  type StageFieldErrors,
} from "./stageFieldErrors";

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
   * "Danh sách công đoạn" ids ticked on the form. The reference lets these be
   * toggled but sends nothing for them — see UNKNOWN_REFERENCE_BEHAVIOR in
   * docs/clone/unknowns.md — so they stay local and are not part of `save`.
   */
  const [pickedSteps, setPickedSteps] = useState<string[]>([]);
  /** Which fields failed the last save attempt — see {@link StageFieldErrors}. */
  const [errors, setErrors] = useState<StageFieldErrors>({});

  useEffect(() => {
    if (!open) return;
    setStaffId(stage?.staffId);
    setSubStaffId(stage?.subStaffId ?? undefined);
    setSecondStaffId(stage?.secondStaffId ?? undefined);
    setNote("");
    setPending([]);
    setPicked([]);
    setPickedSteps([]);
    setErrors({});
  }, [open, stage]);

  const line = plan?.services.find((item) => item.id === stage?.treatmentServiceId) ?? null;

  /**
   * The reference keeps the source công đoạn's content as the form's one
   * checklist entry even though Nội dung điều trị starts blank for the new
   * visit, so this reads the stage rather than `note`.
   */
  const checklist = useMemo(() => reExaminationChecklist(stage), [stage]);

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

  const toggleStep = (stepId: string, next: boolean) =>
    setPickedSteps((current) =>
      next ? [...current, stepId] : current.filter((id) => id !== stepId),
    );

  const addFiles = (files: File[]) => {
    const valid = files.filter((file) => {
      const error = validateImageFile(file);
      if (error) toast.error(`${file.name}: ${error}`);
      return !error;
    });
    if (valid.length > 0) setPending((current) => [...current, ...valid]);
  };
  const removeFile = (at: number) =>
    setPending((current) => current.filter((_, index) => index !== at));

  const save = async () => {
    if (!stage || !line || !plan) return;

    const found = stageFieldErrors({
      staffId,
      note,
      // A warranty visit inherits the công đoạn's teeth as they stand, so it
      // has nothing to get wrong there.
      teethPicked: !pickTeeth || picked.length > 0,
    });
    setErrors(found);
    if (hasStageFieldError(found) || !staffId) return;

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
    checklist,
    pickedSteps,
    toggleStep,
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
