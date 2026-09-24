import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/features/auth/store/authStore";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { t } from "@/lib/i18n";
import { validateImageFile } from "@/utils/validateImageFile";
import {
  useContinueStage,
  useCreateStage,
  useTreatmentStages,
  type TreatmentStageDto,
} from "@/features/treatment-management/api/stageApi";
import type { TreatmentPlanSlipDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { usePatientImages, useUploadPatientImage } from "../../../api/patientImageApi";
import type { StageDay } from "./StageHistory";
import {
  draftErrors,
  initialDraft,
  isDraftDirty,
  type StageDraft,
  type StaffFallback,
} from "./stageDraft";
import type { StageFieldErrors } from "./stageFieldErrors";
import {
  STAGE_TABS,
  buildStageItems,
  pickTeeth,
  warrantyState,
  type StageItem,
  type StageTab,
  type WarrantyState,
} from "./stageModel";
import { syncStageContent } from "./syncStageContent";
import { useStageHistoryActions } from "./useStageHistoryActions";

export type { StageTab };

interface Args {
  open: boolean;
  patientId: string;
  branchId: string;
  plan: TreatmentPlanSlipDto | null;
  /** The line of the row the dialog was opened from. */
  focusServiceId: string | null;
  /** The công đoạn of that row, when it has one. */
  focusStageId?: string | null;
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

/** Where a picture chosen in the OS dialog goes: a form's draft, or a saved row. */
type UploadTarget = { form: string } | { stage: string };

/**
 * Everything "Chi tiết phiếu" reads and writes.
 *
 * Measured on staging 2026-09-24: the Chi tiết column is a **multi**-select —
 * each card clicked opens its own form under the column heads, the forms stack,
 * and one "Lưu công đoạn" / "Tiếp tục công đoạn" / "Tiếp tục bảo hành" at the
 * foot of the last one saves them all — one request per form. Every form keeps
 * its own draft, so switching tabs and back does not lose what was typed.
 */
export function useStageComposer({
  open,
  patientId,
  branchId,
  plan,
  focusServiceId,
  focusStageId = null,
}: Args) {
  const currentUser = useAuthStore((state) => state.user);
  const createStage = useCreateStage();
  const continueStage = useContinueStage();
  const uploadImage = useUploadPatientImage();
  const history = useStageHistoryActions();

  const fileInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<UploadTarget | null>(null);

  /**
   * Null until the user picks a tab, so the dialog can still land on the right
   * one once the stage list arrives — it opens before that query settles.
   */
  const [chosenTab, setChosenTab] = useState<StageTab | null>(null);
  /** The open cards. Nothing starts open — the reference opens none either. */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, StageDraft>>({});
  const [errors, setErrors] = useState<Record<string, StageFieldErrors>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const services = useMemo(() => plan?.services ?? [], [plan]);
  const stagesQuery = useTreatmentStages(
    { patientId, clinicBranchId: branchId, treatmentId: plan?.id, maxResultCount: 1000 },
    open && Boolean(patientId) && Boolean(plan),
  );
  const images = usePatientImages(open ? patientId : "", branchId);

  const stages = useMemo(
    () =>
      [...(stagesQuery.data?.items ?? [])].sort((a, b) =>
        b.creationTime.localeCompare(a.creationTime),
      ),
    [stagesQuery.data],
  );

  const items = useMemo(() => buildStageItems(services, stages), [services, stages]);

  /** The newest công đoạn of each line — whose doctor a new form starts with. */
  const newestByLine = useMemo(() => {
    const newest = new Map<string, TreatmentStageDto>();
    for (const stage of stages) {
      if (!newest.has(stage.treatmentServiceId)) newest.set(stage.treatmentServiceId, stage);
    }
    return newest;
  }, [stages]);

  // The card the row stood for — its công đoạn when that is still open,
  // otherwise its line when the line still has teeth to start — decides which
  // tab the dialog lands on. The reference always lands on THÊM CÔNG ĐOẠN;
  // landing where the clicked row's work is saves a click.
  const everyItem = STAGE_TABS.flatMap((tab) => items[tab]);
  const focused =
    everyItem.find((item) => item.stage !== null && item.id === focusStageId) ??
    items.add.find((item) => item.id === focusServiceId);
  const tab: StageTab = chosenTab ?? focused?.tab ?? "add";
  const offered = items[tab];
  /** The open forms, in the order their cards are listed. */
  const chosen = offered.filter((item) => selectedIds.includes(item.id));

  useEffect(() => {
    if (!open) return;
    setChosenTab(null);
    setSelectedIds([]);
    setDrafts({});
    setErrors({});
  }, [open, focusServiceId, focusStageId, plan?.id]);

  /** Bác sĩ when neither the line nor its công đoạn names one: the slip's, then you. */
  const fallbackDoctor: StaffFallback | null = plan?.dentistId
    ? { id: plan.dentistId, name: plan.dentistName }
    : currentUser?.id
      ? { id: currentUser.id, name: currentUser.name ?? null }
      : null;

  const seed = (item: StageItem): StageDraft =>
    initialDraft(item, newestByLine.get(item.line.id), fallbackDoctor);

  const draftOf = (item: StageItem): StageDraft => drafts[item.id] ?? seed(item);

  const patchDraft = (item: StageItem, patch: Partial<StageDraft>) => {
    setDrafts((current) => ({
      ...current,
      [item.id]: {
        ...(current[item.id] ?? seed(item)),
        ...patch,
      },
    }));
    // A field's message goes as soon as that field is filled in.
    setErrors((current) => {
      const held = current[item.id];
      if (!held) return current;
      return {
        ...current,
        [item.id]: {
          staff: "staffId" in patch && patch.staffId ? undefined : held.staff,
          note: "note" in patch && patch.note?.trim() ? undefined : held.note,
          teeth: "teeth" in patch && (patch.teeth?.length ?? 0) > 0 ? undefined : held.teeth,
        },
      };
    });
  };

  /** A tab switch starts with nothing open, as the reference's does. */
  const pickTab = (next: StageTab) => {
    setChosenTab(next);
    setSelectedIds([]);
    setErrors({});
  };

  const toggleItem = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  /**
   * A ticked step puts its name into Nội dung điều trị and unticking takes it out
   * again — see {@link syncStageContent}, cloned from the reference's own helper.
   */
  const toggleStep = (item: StageItem, stepId: string, next: boolean) => {
    const draft = draftOf(item);
    const steps = next ? [...draft.steps, stepId] : draft.steps.filter((id) => id !== stepId);
    const checklist = (item.line.serviceSteps ?? []).map((step) => ({ id: step.id, name: step.name }));
    patchDraft(item, { steps, note: syncStageContent(draft.note, checklist, steps) });
  };

  const uploadTo = async (stageId: string, files: File[]) => {
    for (const file of files) {
      await uploadImage.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        treatmentStageId: stageId,
        file,
      });
    }
  };

  /** One form, one request: a new công đoạn on `add`, the next visit otherwise. */
  const saveOne = async (item: StageItem, draft: StageDraft) => {
    // Checked by draftErrors before anything is sent.
    const staffId = draft.staffId ?? "";
    const saved = item.stage
      ? await continueStage.mutateAsync({
          id: item.stage.id,
          staffId,
          subStaffId: draft.subStaffId,
          secondStaffId: draft.secondStaffId,
          note: draft.note.trim(),
          serviceItemIds: draft.steps,
        })
      : await createStage.mutateAsync({
          patientId,
          clinicBranchId: branchId,
          treatmentId: plan?.id,
          treatmentServiceId: item.line.id,
          serviceId: item.line.serviceId,
          // The reference shows no name field: a công đoạn is listed under its
          // service's name.
          name: item.line.serviceName ?? item.line.code,
          note: draft.note.trim(),
          staffId,
          subStaffId: draft.subStaffId,
          secondStaffId: draft.secondStaffId,
          teeth: pickTeeth(item.teeth, draft.teeth),
          serviceItemIds: draft.steps,
        });

    // Pictures chosen in the form belong to a công đoạn that did not exist
    // when they were picked, so they are attached now.
    if (draft.pending.length > 0) await uploadTo(saved.id, draft.pending);
  };

  const save = async () => {
    if (!plan || chosen.length === 0 || saving) return;

    const found: Record<string, StageFieldErrors> = {};
    for (const item of chosen) {
      const problems = draftErrors(draftOf(item), item);
      if (problems) found[item.id] = problems;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // One form at a time. The reference fires them together (`Promise.all`),
    // but here every công đoạn also moves its line on the slip, and two writes
    // to one slip at once trip its concurrency stamp (409) and lose the second.
    // A form that has saved closes at once, so a later failure leaves only the
    // forms still to save open — resaving never writes the first one twice.
    setSaving(true);
    const done = new Set<string>();
    try {
      for (const item of chosen) {
        await saveOne(item, draftOf(item));
        done.add(item.id);
      }
      toast.success(tab === "add" ? t("Patient:Stage:Added") : t("Patient:Stage:Continued"));
    } catch (error) {
      notifyError(extractApiError(error));
    } finally {
      setSaving(false);
      if (done.size > 0) {
        setDrafts((current) =>
          Object.fromEntries(Object.entries(current).filter(([id]) => !done.has(id))),
        );
        setSelectedIds((current) => current.filter((id) => !done.has(id)));
      }
    }
  };

  const pickFor = (target: UploadTarget) => {
    uploadTarget.current = target;
    fileInput.current?.click();
  };

  const handleFiles = async (list: FileList | null) => {
    const files = (list ? [...list] : []).filter((file) => {
      const error = validateImageFile(file);
      if (error) toast.error(`${file.name}: ${error}`);
      return !error;
    });
    if (fileInput.current) fileInput.current.value = "";
    const target = uploadTarget.current;
    uploadTarget.current = null;
    if (files.length === 0 || !target) return;

    if ("form" in target) {
      // The form's picker: hold them until the công đoạn is saved.
      const item = chosen.find((candidate) => candidate.id === target.form);
      if (item) patchDraft(item, { pending: [...draftOf(item).pending, ...files] });
      return;
    }

    setUploadingFor(target.stage);
    try {
      await uploadTo(target.stage, files);
      toast.success(t("Patient:Photo:Uploaded"));
    } catch (error) {
      notifyError(extractApiError(error));
    } finally {
      setUploadingFor(null);
    }
  };

  const lineOf = (stage: TreatmentStageDto) =>
    services.find((line) => line.id === stage.treatmentServiceId) ?? null;

  return {
    tab,
    setTab: pickTab,
    counts: {
      add: items.add.length,
      continue: items.continue.length,
      continueWarranty: items.continueWarranty.length,
    },
    offered,
    selectedIds,
    toggleItem,
    chosen,
    draftOf,
    errorsOf: (item: StageItem): StageFieldErrors => errors[item.id] ?? {},
    patchDraft,
    toggleStep,
    /**
     * Measured on the reference 2026-09-22 (its published stage chunk): only the
     * **treatment content** and the **pictures** make leaving ask first.
     */
    dirty: Object.values(drafts).some(isDraftDirty),
    saving: saving || createStage.isPending || continueStage.isPending || uploadImage.isPending,
    save,

    days: byDay(stages),
    stages,
    imagesOf: (stageId: string) =>
      (images.data?.items ?? []).filter((image) => image.treatmentStageId === stageId),
    statusOf: (treatmentServiceId: string) =>
      services.find((item) => item.id === treatmentServiceId)?.status ?? null,
    /** What a finished row offers — see {@link warrantyState}. */
    warrantyOf: (stage: TreatmentStageDto): WarrantyState => {
      const line = lineOf(stage);
      if (!line) return { kind: "none" };
      return warrantyState(
        stage,
        line,
        stages.filter((item) => item.treatmentServiceId === line.id),
      );
    },

    ...history,
    uploadingFor: uploadImage.isPending ? uploadingFor : null,
    fileInput,
    pickForForm: (item: StageItem) => pickFor({ form: item.id }),
    pickForStage: (stage: TreatmentStageDto) => pickFor({ stage: stage.id }),
    handleFiles,
  };
}
