import { useMemo, useState } from "react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { t } from "@/lib/i18n";
import {
  SLIP_STATUS,
  useCancelRecordSet,
  useCreateRecordSet,
  useRecordSetPlans,
  useRecordSets,
  useUpdateRecordSet,
  type RecordSetDto,
  type RecordSetInput,
} from "../../../api/medicalRecordSetApi";
import type { RecordSetDialogMode } from "./RecordSetDialog";

/**
 * The bộ hồ sơ side of Bệnh án: the patient's sets, which one is open, and the
 * create / edit / cancel dialogs. The sheets of the open set are the tab's own
 * business; this hook only says which set that is.
 */
export function useRecordSetWorkflow(patientId: string) {
  const setsQuery = useRecordSets(patientId);
  const plansQuery = useRecordSetPlans(patientId);
  const createSet = useCreateRecordSet(patientId);
  const updateSet = useUpdateRecordSet(patientId);
  const cancelSet = useCancelRecordSet(patientId);

  const sets = useMemo(() => setsQuery.data ?? [], [setsQuery.data]);
  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data]);
  /** Slips no live set holds; a cancelled slip joins nothing, so it is not offered. */
  const freeSlips = useMemo(
    () => plans.filter((plan) => !plan.recordSetId && plan.planStatus !== SLIP_STATUS.Cancelled),
    [plans],
  );

  const [chosenId, setChosenId] = useState<string | null>(null);
  /** The open set: the one picked, else the newest live one (the list leads with it). */
  const active = sets.find((set) => set.id === chosenId) ?? sets[0] ?? null;

  const [dialog, setDialog] = useState<RecordSetDialogMode | null>(null);
  /** Bumped per opening so the dialog seeds its picks afresh. */
  const [dialogKey, setDialogKey] = useState(0);
  const [cancelling, setCancelling] = useState<RecordSetDto | null>(null);
  /**
   * Set while the dialog's data is read again. The dialog seeds its picks once,
   * so it waits: seeded from a cache a save or a started slip has outdated, it
   * would show a slip's old status, or the set as it was before the last save.
   */
  const [refreshing, setRefreshing] = useState(false);

  /** Both lists are read again on every opening, so the dialog shows today's. */
  const openDialog = (mode: RecordSetDialogMode) => {
    setRefreshing(true);
    void Promise.all([plansQuery.refetch(), setsQuery.refetch()]).finally(() =>
      setRefreshing(false),
    );
    setDialogKey((key) => key + 1);
    setDialog(mode);
  };

  /** An edit view takes the set as just read, not as it was when the pencil was pressed. */
  const shownMode: RecordSetDialogMode | null =
    dialog?.kind === "edit"
      ? { kind: "edit", set: sets.find((set) => set.id === dialog.set.id) ?? dialog.set }
      : dialog;

  const submit = async (input: RecordSetInput) => {
    if (!dialog) return;
    try {
      if (dialog.kind === "create") {
        const created = await createSet.mutateAsync(input);
        setChosenId(created.id);
        toast.success(t("Patient:RecordSet:Created"));
      } else {
        await updateSet.mutateAsync({ id: dialog.set.id, ...input });
        toast.success(t("Patient:RecordSet:Saved"));
      }
      setDialog(null);
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  const confirmCancel = async () => {
    if (!cancelling) return;
    try {
      await cancelSet.mutateAsync(cancelling.id);
      // The set just cancelled drops to the bottom; the newest live one opens instead.
      if (cancelling.id === active?.id) setChosenId(null);
      setCancelling(null);
      toast.success(t("Patient:RecordSet:CancelledToast"));
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  return {
    sets,
    active,
    plans,
    freeSlips,
    loading: setsQuery.isLoading,
    plansLoading: plansQuery.isLoading,
    select: (set: RecordSetDto) => setChosenId(set.id),
    openCreate: (preselected: readonly string[] = []) =>
      openDialog({ kind: "create", preselected }),
    openEdit: (set: RecordSetDto) => openDialog({ kind: "edit", set }),
    askCancel: setCancelling,
    dialog: {
      mode: shownMode,
      key: dialogKey,
      refreshing,
      saving: createSet.isPending || updateSet.isPending,
      submit: (input: RecordSetInput) => void submit(input),
      close: () => setDialog(null),
    },
    cancel: {
      set: cancelling,
      pending: cancelSet.isPending,
      confirm: () => void confirmCancel(),
      close: () => setCancelling(null),
    },
  };
}

export type RecordSetWorkflow = ReturnType<typeof useRecordSetWorkflow>;
