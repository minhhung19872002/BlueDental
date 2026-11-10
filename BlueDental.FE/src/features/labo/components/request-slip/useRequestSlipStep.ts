import { useEffect, useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { useAbility } from "@/hooks/useAbility";
import {
  LABO_ORDER_LAYOUT,
  LABO_STATUS,
  usePatientLaboOrders,
  type LaboOrderDto,
} from "@/features/labo/api/laboApi";
import { useSaveLaboOrder } from "@/features/labo/api/laboMutations";
import { priorLaboTeeth, type LaboPriorTeeth } from "../order-dialogs/laboPriorTeeth";
import { useLaboPictureTiles, type LaboPictureTiles } from "../order-dialogs/useLaboPictureTiles";
import {
  requestSlipBody,
  requestSlipErrors,
  requestSlipSeed,
  type RequestSlipStart,
  type RequestSlipValues,
} from "./requestSlipModel";

export interface RequestSlipStepSetup {
  branchId: string;
  patientId: string;
  order: LaboOrderDto | undefined;
  /** A new order's known teeth and doctor (the công đoạn it was raised on). */
  start: RequestSlipStart;
  /** Opened to look only (R-1120): even a Nháp stays locked. */
  readOnly: boolean;
  /** After a save: `submit` is true once the order went to the Labo. */
  onSaved: (submit: boolean) => void;
}

export interface RequestSlipStep {
  values: RequestSlipValues;
  /** Changes some fields; the rest stay. */
  change: (patch: Partial<RequestSlipValues>) => void;
  editable: boolean;
  /** The i18n keys of what «Tạo phiếu Labo» still waits for. */
  errors: string[];
  priors: LaboPriorTeeth;
  pictures: LaboPictureTiles;
  saving: boolean;
  saveDraft: () => Promise<void>;
  submit: () => Promise<void>;
}

const NO_PRIORS: LaboPriorTeeth = new Map();

/**
 * The Phiếu yêu cầu (F-91): one spec for the whole order, entered once and
 * kept on every tooth by the server. A new order carries no plan link; an old
 * Nháp re-saved here sends its own links back so it stays where it was raised.
 * Lưu nháp takes the form as it is; «Tạo phiếu Labo» waits for every field.
 */
export function useRequestSlipStep({ branchId, patientId, order, start, readOnly, onSaved }: RequestSlipStepSetup): RequestSlipStep {
  const ability = useAbility("treatmentLabo");
  const save = useSaveLaboOrder();
  const [values, setValues] = useState(() => requestSlipSeed(order, start));
  const pictures = useLaboPictureTiles();
  const editable = !readOnly && ability.canCreate && (order === undefined || order.status === LABO_STATUS.Draft);

  const { reset } = pictures;
  const savedImages = order?.images;
  useEffect(() => reset(savedImages ?? []), [reset, savedImages]);

  // Every order of the patient still on its way, not only the plan's (F-91).
  const patientOrders = usePatientLaboOrders({ patientId, maxResultCount: 1000 }, editable).data?.items;
  const priors = editable ? priorLaboTeeth(patientOrders ?? [], order?.id) : NO_PRIORS;

  const change = (patch: Partial<RequestSlipValues>) => setValues((current) => ({ ...current, ...patch }));

  const persist = async (submit: boolean) => {
    // The tooth sets of an old draft are listed so its per-tooth pictures are kept.
    const upload = pictures.upload([0, ...values.teeth]);
    const fields = {
      layout: LABO_ORDER_LAYOUT.RequestSlip,
      ...requestSlipBody(values),
      treatmentServiceId: order?.treatmentServiceId,
      treatmentStageId: order?.treatmentStageId,
      submit,
      pictures: upload.pictures,
    };
    try {
      await save.mutateAsync(
        order
          ? { id: order.id, keepImageIds: upload.keepImageIds, fields }
          : { patientId, branchId, fields },
      );
      toast.success(t(submit ? "Labo:Workflow:Submitted" : "Labo:Workflow:DraftSaved"));
      onSaved(submit);
    } catch {
      // The global MutationCache toasts the server's message; the form stays for the fix.
    }
  };

  const errors = requestSlipErrors(values);

  return {
    values,
    change,
    editable,
    errors,
    priors,
    pictures,
    saving: save.isPending,
    saveDraft: () => persist(false),
    submit: async () => {
      if (errors.length === 0) await persist(true);
    },
  };
}
