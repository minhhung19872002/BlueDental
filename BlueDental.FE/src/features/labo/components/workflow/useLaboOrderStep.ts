import { useState } from "react";
import { Form } from "antd";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { useAbility } from "@/hooks/useAbility";
import { useNextLaboCode } from "@/hooks/useLaboPickers";
import type { TreatmentPlanSlipDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { LABO_STATUS, type LaboOrderDto } from "@/features/labo/api/laboApi";
import { useSaveLaboOrder } from "@/features/labo/api/laboMutations";
import type { LaboHeaderSource } from "../order-dialogs/LaboNewOrderHeader";
import { sourceFromPick, toothCodes, type LaboOrderSource } from "../order-dialogs/laboOrderSource";
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
  saving: boolean;
  /** The order «Gửi Labo & in phiếu» just sent, while its Phiếu Labo prints. */
  printing: LaboOrderDto | null;
  saveDraft: () => Promise<void>;
  submit: () => Promise<void>;
}

/** The header's locked plan and line for a saved order, as its DTO names them. */
function orderHeader(order: LaboOrderDto): LaboHeaderSource {
  const plan = [order.treatmentPlanCode, order.treatmentPlanDentistName].filter(Boolean).join(" - ");
  return { planLabel: plan, serviceName: order.treatmentServiceName ?? "" };
}

function lineTeeth(plans: TreatmentPlanSlipDto[], lineId: string | undefined): string[] {
  const line = plans.flatMap((plan) => plan.services).find((row) => row.id === lineId);
  return line ? toothCodes(line.teeth) : [];
}

/**
 * The Đặt hàng tab: Lưu nháp keeps a Nháp (only the plan, line and doctor are
 * needed), «Gửi Labo & in phiếu» checks every field — pictures are optional
 * (P3110 REQ-C3) — sends it and prints its Phiếu Labo: Đã gửi Labo, the tab
 * locked from then on.
 */
export function useLaboOrderStep({ branchId, patientId, order, source, plans, onDone }: LaboOrderStepSetup): LaboOrderStep {
  const ability = useAbility("treatmentLabo");
  const save = useSaveLaboOrder();
  const [antForm] = Form.useForm<LaboOrderValues>();
  const [printing, setPrinting] = useState<LaboOrderDto | null>(null);
  const isNew = order === undefined;
  const picksSource = isNew && !source;
  const editable = ability.canCreate && (isNew || order.status === LABO_STATUS.Draft);
  const nextCode = useNextLaboCode(isNew && ability.canCreate).data ?? "";

  // A reopened Nháp saved without teeth waits for the plans to take its line's.
  const plansReady = plans.length > 0;
  const seed: LaboOrderSeed = order
    ? orderSeed(order, lineTeeth(plans, order.treatmentServiceId))
    : source
      ? { teeth: source.teeth, dentistId: source.dentistId }
      : { teeth: [], quantity: "0" };
  const seedKey = order ? `${order.id}:${order.status}:${plansReady}` : (source?.treatmentStageId ?? source?.treatmentServiceId ?? "tab");

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
      const saved = await save.mutateAsync(
        order
          ? { id: order.id, keepImageIds: pictures.keepImageIds, fields }
          : { patientId, branchId, orderCode: nextCode || undefined, fields },
      );
      toast.success(t(submit ? "Labo:Workflow:Submitted" : "Labo:Workflow:DraftSaved"));
      if (submit) setPrinting(saved);
      else onDone();
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
    saving: save.isPending,
    printing,
    saveDraft,
    submit,
  };
}
