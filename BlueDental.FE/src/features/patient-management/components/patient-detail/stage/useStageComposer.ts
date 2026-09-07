import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/features/auth/store/authStore";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import {
  useCompleteStage,
  useRevertStage,
  useUpdateStageServiceItems,
  useCreateStage,
  useTreatmentStages,
  useUpdateStage,
  type TreatmentStageDto,
} from "@/features/treatment-management/api/stageApi";
import type {
  TreatmentPlanSlipDto,
  TreatmentServiceDto,
} from "@/features/treatment-management/api/treatmentPlanApi";
import { usePatientImages, useUploadPatientImage } from "../../../api/patientImageApi";
import type { StageDay } from "./StageHistory";

/**
 * The reference splits the eligible services in two: those with no công đoạn
 * yet ("THÊM CÔNG ĐOẠN") and those that already have one ("TIẾP TỤC CÔNG ĐOẠN").
 */
export type StageTab = "add" | "continue";

interface Args {
  open: boolean;
  patientId: string;
  branchId: string;
  plan: TreatmentPlanSlipDto | null;
  focusServiceId: string | null;
}

/** Stages bucketed by the calendar day they were worked, newest day first. */
function byDay(stages: TreatmentStageDto[]): StageDay[] {
  const days = new Map<string, StageDay>();

  for (const stage of stages) {
    const key = stage.creationTime.slice(0, 10);
    const day = days.get(key);
    if (day) {
      day.stages.push(stage);
    } else {
      days.set(key, { key, date: stage.creationTime, stages: [stage] });
    }
  }

  return [...days.values()].sort((a, b) => b.key.localeCompare(a.key));
}

/**
 * Everything "Chi tiết phiếu" reads and writes.
 *
 * Split out of the dialog so the component stays a layout: this owns the form's
 * draft, the four server calls behind it (create, update, complete, upload) and
 * the file picker both Tải Ảnh buttons share.
 */
export function useStageComposer({ open, patientId, branchId, plan, focusServiceId }: Args) {
  const currentStaffId = useAuthStore((state) => state.user?.id) ?? "";
  const createStage = useCreateStage();
  const updateStage = useUpdateStage();
  const completeStage = useCompleteStage();
  const revertStage = useRevertStage();
  const updateServiceItems = useUpdateStageServiceItems();
  const uploadImage = useUploadPatientImage();

  const fileInput = useRef<HTMLInputElement>(null);
  /** Which stage a chosen file belongs to; null means the form's own picker. */
  const uploadFor = useRef<string | null>(null);

  /**
   * Null until the user picks a tab, so the dialog can still land on the right
   * one once the stage list arrives — it opens before that query settles.
   */
  const [chosenTab, setChosenTab] = useState<StageTab | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string>();
  const [subStaffId, setSubStaffId] = useState<string>();
  const [secondStaffId, setSecondStaffId] = useState<string>();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<File[]>([]);
  /** Step ids ticked under "Danh sách công đoạn" on the form. */
  const [pickedSteps, setPickedSteps] = useState<string[]>([]);
  const [busyStage, setBusyStage] = useState<string | null>(null);

  const services = useMemo(() => plan?.services ?? [], [plan]);
  const stages = useTreatmentStages(
    { patientId, clinicBranchId: branchId, treatmentId: plan?.id, maxResultCount: 200 },
    open && Boolean(patientId) && Boolean(plan),
  );
  const images = usePatientImages(open ? patientId : "", branchId);

  const slipStages = useMemo(
    () =>
      [...(stages.data?.items ?? [])].sort((a, b) =>
        b.creationTime.localeCompare(a.creationTime),
      ),
    [stages.data],
  );

  const stagedLineIds = useMemo(
    () => new Set(slipStages.map((stage) => stage.treatmentServiceId)),
    [slipStages],
  );

  /**
   * The newest công đoạn of each service line. The reference marks every
   * earlier one `disabled` and only that one keeps its Tạo Labo — a line is
   * worked one step at a time.
   */
  const liveStageIds = useMemo(() => {
    const newest = new Map<string, TreatmentStageDto>();
    for (const stage of slipStages) {
      const held = newest.get(stage.treatmentServiceId);
      if (!held || stage.creationTime > held.creationTime) newest.set(stage.treatmentServiceId, stage);
    }
    return new Set([...newest.values()].map((stage) => stage.id));
  }, [slipStages]);
  const focused = services.find((line) => line.id === focusServiceId);
  const tab: StageTab =
    chosenTab ?? (focused && stagedLineIds.has(focused.id) ? "continue" : "add");
  const inTab = (line: TreatmentServiceDto) =>
    tab === "add" ? !stagedLineIds.has(line.id) : stagedLineIds.has(line.id);

  useEffect(() => {
    if (!open) return;
    setChosenTab(null);
    setSelected(focusServiceId);
    setStaffId(plan?.dentistId ?? currentStaffId);
    setSubStaffId(undefined);
    setSecondStaffId(undefined);
    setNote("");
    setPending([]);
    setPickedSteps([]);
    // Re-seeding on every stage refetch would wipe what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, focusServiceId, plan?.id]);

  const line = services.find((item) => item.id === selected) ?? null;

  /**
   * Blob previews for the chosen files, revoked when the list changes or the
   * dialog closes — minting them in the render would hand out a fresh URL on
   * every keystroke and never release one.
   */
  const previews = useMemo(() => pending.map((file) => URL.createObjectURL(file)), [pending]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const removePending = (at: number) =>
    setPending((current) => current.filter((_, index) => index !== at));

  const toggleStep = (stepId: string, next: boolean) =>
    setPickedSteps((current) =>
      next ? [...current, stepId] : current.filter((id) => id !== stepId),
    );

  const upload = async (stageId: string, files: File[]) => {
    for (const file of files) {
      await uploadImage.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        treatmentStageId: stageId,
        file,
      });
    }
  };

  const save = async () => {
    if (!line || !plan) return;
    // The reference's own schema: doctor, teeth and the treatment note are all
    // required, and the note is capped at 1000 characters.
    if (!staffId) {
      toast.error(t("Vui lòng chọn bác sĩ"));
      return;
    }
    if (line.teeth.length === 0) {
      toast.error(t("Vui lòng chọn răng"));
      return;
    }
    if (!note.trim()) {
      toast.error(t("Vui lòng nhập nội dung điều trị"));
      return;
    }

    try {
      const created = await createStage.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        treatmentId: plan.id,
        treatmentServiceId: line.id,
        serviceId: line.serviceId,
        // The reference shows no name field: a công đoạn is a step of its
        // service and is listed under that service's name.
        name: line.serviceName ?? line.code,
        note: note.trim(),
        staffId,
        subStaffId,
        secondStaffId,
        teeth: line.teeth,
        serviceItemIds: pickedSteps,
      });

      // Pictures chosen in the form belong to a công đoạn that did not exist
      // when they were picked, so they are attached now.
      if (pending.length > 0) await upload(created.id, pending);

      toast.success(t("Đã thêm công đoạn"));
      setSelected(null);
      setNote("");
      setPending([]);
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  /**
   * Ticks or unticks one step on a saved công đoạn, from the history row.
   *
   * The whole list goes up, not just the step that moved: the endpoint treats
   * its payload as the complete picture, which is what lets one call both tick
   * and untick.
   */
  const toggleStageStep = async (stage: TreatmentStageDto, stepId: string, next: boolean) => {
    setBusyStage(stage.id);
    try {
      await updateServiceItems.mutateAsync({
        id: stage.id,
        items: stage.serviceItems.map((item) => ({
          catalogServiceStageId: item.catalogServiceStageId,
          isCompleted:
            item.catalogServiceStageId === stepId ? next : item.isCompleted,
        })),
      });
      toast.success(t("Cập nhật thành công"));
    } catch (error) {
      // The reference's own wording when this call fails.
      toast.error(extractApiError(error) || t("Không thể cập nhật công đoạn"));
    } finally {
      setBusyStage(null);
    }
  };

  const saveNote = async (stage: TreatmentStageDto, next: string) => {
    setBusyStage(stage.id);
    try {
      await updateStage.mutateAsync({
        id: stage.id,
        name: stage.name,
        note: next.trim() || undefined,
        staffId: stage.staffId,
        secondStaffId: stage.secondStaffId ?? undefined,
        subStaffId: stage.subStaffId ?? undefined,
        scheduledDate: stage.scheduledDate ?? undefined,
        teeth: stage.teeth,
      });
      toast.success(t("Đã lưu ghi chú"));
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setBusyStage(null);
    }
  };

  /**
   * Ticks or un-ticks Hoàn thành. The reference's box turns both ways — it has a
   * `revert-status` beside its `status` — so un-ticking re-opens the công đoạn
   * and carries its service line back out of Hoàn thành with it.
   */
  const finish = async (stage: TreatmentStageDto) => {
    const reopening = stage.completedAt !== null;
    setBusyStage(stage.id);
    try {
      if (reopening) {
        await revertStage.mutateAsync(stage.id);
        toast.success(t("Đã mở lại công đoạn"));
      } else {
        await completeStage.mutateAsync(stage.id);
        toast.success(t("Đã hoàn thành công đoạn"));
      }
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setBusyStage(null);
    }
  };

  const pickFor = (stageId: string | null) => {
    uploadFor.current = stageId;
    fileInput.current?.click();
  };

  const handleFiles = async (list: FileList | null) => {
    const files = list ? [...list] : [];
    if (fileInput.current) fileInput.current.value = "";
    if (files.length === 0) return;

    const stageId = uploadFor.current;
    if (stageId === null) {
      // The form's picker: hold them until the công đoạn is saved.
      setPending((current) => [...current, ...files]);
      return;
    }

    setBusyStage(stageId);
    try {
      await upload(stageId, files);
      toast.success(t("Đã tải ảnh"));
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setBusyStage(null);
      uploadFor.current = null;
    }
  };

  return {
    tab,
    setTab: setChosenTab,
    counts: {
      add: services.filter((item) => !stagedLineIds.has(item.id)).length,
      continue: services.filter((item) => stagedLineIds.has(item.id)).length,
    },
    offered: services.filter(inTab),
    selected,
    setSelected,
    line,
    staffId,
    setStaffId,
    subStaffId,
    setSubStaffId,
    secondStaffId,
    setSecondStaffId,
    note,
    setNote,
    pending,
    previews,
    removePending,
    pickedSteps,
    toggleStep,
    saving: createStage.isPending || uploadImage.isPending,

    days: byDay(slipStages),
    stages: slipStages,
    liveStageIds,
    imagesOf: (stageId: string) =>
      (images.data?.items ?? []).filter((image) => image.treatmentStageId === stageId),
    statusOf: (treatmentServiceId: string) =>
      services.find((item) => item.id === treatmentServiceId)?.status ?? null,

    /** The service behind a công đoạn carries a warranty period at all. */
    warrantable: (stage: TreatmentStageDto) =>
      (services.find((item) => item.id === stage.treatmentServiceId)?.warrantyDays ?? 0) > 0,

    savingNoteFor: updateStage.isPending ? busyStage : null,
    togglingStepFor: updateServiceItems.isPending ? busyStage : null,
    toggleStageStep,
    uploadingFor: uploadImage.isPending ? busyStage : null,
    completingId: completeStage.isPending || revertStage.isPending ? busyStage : null,

    fileInput,
    pickFor,
    handleFiles,
    save,
    saveNote,
    finish,
  };
}
