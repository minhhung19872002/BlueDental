import { Form } from "antd";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { useAbility } from "@/hooks/useAbility";
import { useNextLaboCode } from "@/hooks/useLaboPickers";
import type { TreatmentPlanSlipDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { LABO_STATUS, usePlanLaboOrders, type LaboOrderDto } from "@/features/labo/api/laboApi";
import { useSaveLaboOrder } from "@/features/labo/api/laboMutations";
import type { LaboHeaderSource } from "../order-dialogs/LaboNewOrderHeader";
import { sourceFromPick, toothCodes, type LaboOrderSource } from "../order-dialogs/laboOrderSource";
import { priorLaboTeeth, type LaboPriorTeeth } from "../order-dialogs/laboPriorTeeth";
import {
  laboOrderBody,
  orderSeed,
  useLaboOrderForm,
  type LaboOrderForm,
  type LaboOrderSeed,
  type LaboOrderValues,
} from "../order-dialogs/useLaboOrderForm";

export interface LaboOrderStepSetup {
  branchId: string;
  patientId: string;
  /** The saved order; absent while a new one is being raised. */
  order: LaboOrderDto | undefined;
  /** Raised from a công đoạn: the line is known and locked. */
  source: LaboOrderSource | null | undefined;
  /** The patient's plans: the tab's pickers, and the teeth a reopened Nháp's line still offers. */
  plans: TreatmentPlanSlipDto[];
  /** Opened to look only (R-1120): even a Nháp stays locked. */
  readOnly?: boolean;
  onDone: () => void;
}

export interface LaboOrderStep {
  form: LaboOrderForm;
  code: string;
  /** The plan and line the header prints locked; null while they are picked in it. */
  headerSource: LaboHeaderSource | null;
  /** A new order raised from the Labo tab picks its plan and line in the header. */
  picksSource: boolean;
  editable: boolean;
  /** The teeth already on another order of the phiếu điều trị, while the order is editable (R-1106). */
  priors: LaboPriorTeeth;
  saving: boolean;
  saveDraft: () => Promise<void>;
  submit: () => Promise<void>;
}

/** The header's locked plan and line for a saved order, as its DTO names them. */
function orderHeader(order: LaboOrderDto): LaboHeaderSource {
  const plan = [order.treatmentPlanCode, order.treatmentPlanDentistName].filter(Boolean).join(" - ");
  return { planLabel: plan, serviceName: order.treatmentServiceName ?? "" };
}

const NO_PRIORS: LaboPriorTeeth = new Map();

function lineTeeth(plans: TreatmentPlanSlipDto[], lineId: string | undefined): string[] {
  const line = plans.flatMap((plan) => plan.services).find((row) => row.id === lineId);
  return line ? toothCodes(line.teeth) : [];
}

/**
 * The Đặt hàng tab: Lưu nháp keeps a Nháp (only the plan, line and doctor are
 * needed), «Tạo phiếu Labo» checks every field — pictures are optional
 * (P3110 REQ-C3) — and sends it: Đã gửi Labo, the tab locked from then on.
 * Nothing prints by itself any more (P0111_02, R-1108).
 */
export function useLaboOrderStep({ branchId, patientId, order, source, plans, readOnly, onDone }: LaboOrderStepSetup): LaboOrderStep {
  const ability = useAbility("treatmentLabo");
  const save = useSaveLaboOrder();
  const [antForm] = Form.useForm<LaboOrderValues>();
  const isNew = order === undefined;
  const picksSource = isNew && !source;
  const editable = !readOnly && ability.canCreate && (isNew || order.status === LABO_STATUS.Draft);
  const nextCode = useNextLaboCode(isNew && ability.canCreate).data ?? "";

  // A reopened Nháp saved without teeth waits for the plans to take its line's.
  const plansReady = plans.length > 0;
  const seed: LaboOrderSeed = order
    ? orderSeed(order, lineTeeth(plans, order.treatmentServiceId))
    : source
      ? { teeth: source.teeth, dentistId: source.dentistId }
      : { teeth: [], quantity: "0" };
  const seedKey = order ? `${order.id}:${order.status}:${plansReady}` : (source?.treatmentStageId ?? source?.treatmentServiceId ?? "tab");

  // The slip is the order's, the công đoạn's, or the one picked in the header.
  const pickedPlanId = Form.useWatch("planId", antForm);
  const planId = order?.treatmentPlanId ?? source?.treatmentPlanId ?? pickedPlanId;
  const planOrders = usePlanLaboOrders(patientId, planId, editable).data?.items;
  const priors = editable ? priorLaboTeeth(planOrders ?? [], order?.id) : NO_PRIORS;

  const form = useLaboOrderForm(antForm, {
    branchId,
    open: true,
    seed,
    seedKey,
    savedImages: order?.images ?? [],
    readOnly: !editable,
  });

  const persist = async (submit: boolean) => {
    const values = antForm.getFieldsValue(true) as LaboOrderValues;
    // Only the mode on screen goes: a tooth's own pictures in shared mode are dropped, and the other way round.
    const pictures = form.upload(values.sharedSpec ? [0] : laboOrderBody(values).teeth);
    const picked = picksSource ? sourceFromPick(plans, values.planId, values.lineId, values.dentistId) : null;
    const fields = {
      ...laboOrderBody(values),
      estimatedCost: order?.estimatedCost ?? 0,
      treatmentServiceId: order?.treatmentServiceId ?? source?.treatmentServiceId ?? picked?.treatmentServiceId,
      treatmentStageId: order?.treatmentStageId ?? source?.treatmentStageId,
      submit,
      pictures: pictures.pictures,
      toothPictures: pictures.toothPictures,
    };
    try {
      await save.mutateAsync(
        order
          ? { id: order.id, keepImageIds: pictures.keepImageIds, fields }
          : { patientId, branchId, orderCode: nextCode || undefined, fields },
      );
      toast.success(t(submit ? "Labo:Workflow:Submitted" : "Labo:Workflow:DraftSaved"));
      onDone();
    } catch {
      // The global MutationCache toasts the server's message; the dialog stays for the fix.
    }
  };

  const saveDraft = async () => {
    const required = picksSource ? ["planId", "lineId", "dentistId"] : ["dentistId"];
    try {
      await antForm.validateFields(required);
    } catch {
      return;
    }
    await persist(false);
  };

  const submit = async () => {
    try {
      await antForm.validateFields();
    } catch {
      antForm.scrollToField(antForm.getFieldsError().find((field) => field.errors.length)?.name ?? []);
      return;
    }
    await persist(true);
  };

  return {
    form,
    code: order?.orderCode ?? nextCode,
    headerSource: order ? orderHeader(order) : (source ?? null),
    picksSource,
    editable,
    priors,
    saving: save.isPending,
    saveDraft,
    submit,
  };
}
