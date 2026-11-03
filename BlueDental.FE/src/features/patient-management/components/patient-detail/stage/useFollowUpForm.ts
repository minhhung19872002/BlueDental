import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { t } from "@/lib/i18n";
import { todayIsoDate } from "@/utils/todayIsoDate";
import { validateImageFile } from "@/utils/validateImageFile";
import {
  useAttachReExaminationImage,
  useCreateReExamination,
  type TreatmentStageDto,
} from "@/features/treatment-management/api/stageApi";
import type { TreatmentPlanSlipDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { useUploadPatientImage } from "../../../api/patientImageApi";
import { reExaminationChecklist } from "./reExaminationChecklist";
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
  /** The finished công đoạn the tái khám is raised against. */
  stage: TreatmentStageDto | null;
  /** Toast shown once the tái khám is written. */
  saved: string;
  onClose: () => void;
}

/**
 * The state and the write behind "Tạo tái khám": a row of its own with its own
 * resource, taking only the teeth that were ticked.
 *
 * "Tạo bảo hành" used to share this form; P3110 (REQ-A9, G24) moved warranty
 * work to the slip's Bảo hành tab, where it is picked under a card.
 */
export function useFollowUpForm({ open, patientId, branchId, plan, stage, saved, onClose }: Options) {
  const createReExam = useCreateReExamination();
  const attachReExamImage = useAttachReExaminationImage();
  const uploadImage = useUploadPatientImage();

  const [staffId, setStaffId] = useState<string>();
  const [subStaffId, setSubStaffId] = useState<string>();
  const [secondStaffId, setSecondStaffId] = useState<string>();
  const [note, setNote] = useState("");
  /** Ngày điều trị, "YYYY-MM-DD" — today or earlier, today when the form opens. */
  const [treatmentDate, setTreatmentDate] = useState(todayIsoDate);
  const [pending, setPending] = useState<File[]>([]);
  /** Tooth codes ticked in the form. */
  const [picked, setPicked] = useState<number[]>([]);
  /**
   * "Danh sách công đoạn" ids ticked on the form. A tái khám lets them be
   * toggled but sends nothing for them — see UNKNOWN_REFERENCE_BEHAVIOR in
   * docs/clone/unknowns.md.
   */
  const [pickedSteps, setPickedSteps] = useState<string[]>([]);
  /** Which fields failed the last save attempt — see {@link StageFieldErrors}. */
  const [errors, setErrors] = useState<StageFieldErrors>({});

  const line = plan?.services.find((item) => item.id === stage?.treatmentServiceId) ?? null;

  /** The teeth on offer: the công đoạn's own, else the line's. */
  const candidates = useMemo(() => {
    if (!stage) return [];
    return stage.teeth.length > 0 ? stage.teeth : (line?.teeth ?? []);
  }, [stage, line]);

  useEffect(() => {
    if (!open) return;
    setStaffId(stage?.staffId);
    setSubStaffId(stage?.subStaffId ?? undefined);
    setSecondStaffId(stage?.secondStaffId ?? undefined);
    setNote("");
    setTreatmentDate(todayIsoDate());
    setPending([]);
    setPicked([]);
    setPickedSteps([]);
    setErrors({});
  }, [open, stage]);

  /**
   * "Danh sách công đoạn". A tái khám carries the source's content as its one
   * entry even though Nội dung điều trị starts blank, so this reads the stage
   * rather than `note`.
   */
  const checklist = useMemo(() => reExaminationChecklist(stage), [stage]);

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

  const changeTreatmentDate = (value: string) => {
    if (value) setErrors((current) => ({ ...current, treatmentDate: undefined }));
    setTreatmentDate(value);
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
  const pickSteps = (picked: string[]) => {
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

    const found = {
      ...stageFieldErrors({ staffId, note, teethPicked: picked.length > 0 }),
      treatmentDate: treatmentDate ? undefined : t("Patient:Stage:RequiredTreatmentDate"),
    };
    setErrors(found);
    if (hasStageFieldError(found) || !staffId) return;

    try {
      const created = await createReExam.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        patientStageId: stage.id,
        staffId,
        subStaffId,
        secondStaffId,
        note: note.trim(),
        treatmentDate,
        teeth: candidates.filter((tooth) => picked.includes(tooth.toothCode)),
      });

      for (const file of pending) {
        const image = await uploadImage.mutateAsync({ patientId, clinicBranchId: branchId, file });
        await attachReExamImage.mutateAsync({ id: created.id, imageUrl: image.url });
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
    pickSteps,
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
    treatmentDate,
    setTreatmentDate: changeTreatmentDate,
    pending,
    picked,
    toggleTooth,
    changeTeeth,
    addFiles,
    removeFile,
    save,
    saving: createReExam.isPending || uploadImage.isPending || attachReExamImage.isPending,
  };
}
