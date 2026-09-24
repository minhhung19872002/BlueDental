import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
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
import { namedSteps, pickTeeth, toothCodes, warrantyCandidates } from "./stageModel";
import { syncStageContent } from "./syncStageContent";
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
  /**
   * Every công đoạn of the stage's line — where a warranty finds the root whose
   * teeth it may take. Only read for a warranty.
   */
  lineStages: TreatmentStageDto[];
  kind: "guarantee" | "reExamination";
  /**
   * A warranty raised from LỊCH SỬ ĐIỀU TRỊ lists the source công đoạn's steps;
   * one raised from the profile tab's table lists none — the reference's two
   * warranty mappers differ exactly there (`stageChecklist: e.stageChecklist`
   * vs `stageChecklist: []`, read 2026-09-24).
   */
  inheritSteps: boolean;
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
  lineStages,
  kind,
  inheritSteps,
  saved,
  onClose,
}: Options) {
  const warranty = kind === "guarantee";
  const createStage = useCreateStage();
  const createReExam = useCreateReExamination();
  const attachReExamImage = useAttachReExaminationImage();
  const uploadImage = useUploadPatientImage();

  const [staffId, setStaffId] = useState<string>();
  const [subStaffId, setSubStaffId] = useState<string>();
  const [secondStaffId, setSecondStaffId] = useState<string>();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<File[]>([]);
  /** Tooth codes ticked in the form. */
  const [picked, setPicked] = useState<number[]>([]);
  /**
   * "Danh sách công đoạn" ids ticked on the form. A warranty sends them as its
   * steps; a tái khám lets them be toggled but sends nothing for them — see
   * UNKNOWN_REFERENCE_BEHAVIOR in docs/clone/unknowns.md.
   */
  const [pickedSteps, setPickedSteps] = useState<string[]>([]);
  /** Which fields failed the last save attempt — see {@link StageFieldErrors}. */
  const [errors, setErrors] = useState<StageFieldErrors>({});

  const line = plan?.services.find((item) => item.id === stage?.treatmentServiceId) ?? null;

  /**
   * The teeth on offer. A tái khám picks among the công đoạn's own. A warranty
   * picks among its root's — measured on staging 2026-09-24: raised off a
   * finished warranty of 11·21·22 whose root took 11·21·22·32, "Tạo bảo hành"
   * offered all four with the three preselected.
   */
  const candidates = useMemo(() => {
    if (!stage) return [];
    if (warranty && line) return warrantyCandidates(stage, line, lineStages);
    return stage.teeth.length > 0 ? stage.teeth : (line?.teeth ?? []);
  }, [stage, line, lineStages, warranty]);

  useEffect(() => {
    if (!open) return;
    setStaffId(stage?.staffId);
    setSubStaffId(stage?.subStaffId ?? undefined);
    setSecondStaffId(stage?.secondStaffId ?? undefined);
    setNote("");
    setPending([]);
    // A warranty starts with the source công đoạn's teeth picked; a tái khám
    // starts with none.
    setPicked(warranty && stage ? toothCodes(stage.teeth) : []);
    setPickedSteps([]);
    setErrors({});
  }, [open, stage, warranty]);

  /**
   * "Danh sách công đoạn". A warranty lists the source công đoạn's own steps,
   * all unticked (the reference's `stageChecklist` of the history row). A tái
   * khám carries the source's content as its one entry even though Nội dung
   * điều trị starts blank, so this reads the stage rather than `note`.
   */
  const checklist = useMemo(
    () =>
      warranty
        ? inheritSteps
          ? namedSteps(stage?.serviceItems ?? [])
          : []
        : reExaminationChecklist(stage),
    [stage, warranty, inheritSteps],
  );

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

  const changeTeeth = (codes: number[]) => {
    if (codes.length > 0) setErrors((current) => ({ ...current, teeth: undefined }));
    setPicked(codes);
  };

  const changeStaff = (value: string) => {
    setErrors((current) => ({ ...current, staff: undefined }));
    setStaffId(value);
  };

  const changeNote = (value: string) => {
    if (value.trim()) setErrors((current) => ({ ...current, note: undefined }));
    setNote(value);
  };

  /**
   * Ticking a công đoạn writes its text into Nội dung điều trị, unticking takes
   * it back out — the reference runs both off one helper, see
   * {@link syncStageContent}.
   */
  const toggleStep = (stepId: string, next: boolean) => {
    const picked = next
      ? [...pickedSteps, stepId]
      : pickedSteps.filter((id) => id !== stepId);
    setPickedSteps(picked);
    setNote((current) => syncStageContent(current, checklist, picked));
    if (picked.length > 0) setErrors((current) => ({ ...current, note: undefined }));
  };

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

    const found = stageFieldErrors({ staffId, note, teethPicked: picked.length > 0 });
    setErrors(found);
    if (hasStageFieldError(found) || !staffId) return;

    try {
      if (!warranty) {
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
          teeth: pickTeeth(candidates, picked),
          isGuarantee: true,
          warrantySourceStageId: stage.id,
          serviceItemIds: pickedSteps,
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
      notifyError(extractApiError(error));
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
    changeTeeth,
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
