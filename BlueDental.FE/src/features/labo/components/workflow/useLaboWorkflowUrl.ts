import { useSearchParams } from "react-router-dom";
import { isLaboStep, type LaboStep, type LaboWorkflowTarget } from "./laboWorkflowSteps";

/**
 * The reference's `laboModal` query value: `new` while an order is being
 * raised, `order` with `laboRowId` naming the one open, `laboStep` the tab.
 */
const MODAL_PARAM = "laboModal";
const ROW_PARAM = "laboRowId";
const STEP_PARAM = "laboStep";

export interface LaboWorkflowUrl {
  target: LaboWorkflowTarget | null;
  openCreate: () => void;
  openOrder: (orderId: string, step?: LaboStep) => void;
  setStep: (step: LaboStep) => void;
  close: () => void;
}

/** The Labo dialog of the patient's Labo tab, kept in the URL so a reload reopens it. */
export function useLaboWorkflowUrl(): LaboWorkflowUrl {
  const [searchParams, setSearchParams] = useSearchParams();
  const modal = searchParams.get(MODAL_PARAM);
  const rowId = searchParams.get(ROW_PARAM);
  const step = searchParams.get(STEP_PARAM);

  let target: LaboWorkflowTarget | null = null;
  if (modal === "new") target = { kind: "create" };
  else if (modal === "order" && rowId) {
    target = { kind: "open", orderId: rowId, step: isLaboStep(step) ? step : undefined };
  }

  const update = (values: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };

  return {
    target,
    openCreate: () => update({ [MODAL_PARAM]: "new", [ROW_PARAM]: undefined, [STEP_PARAM]: undefined }),
    openOrder: (orderId, next) => update({ [MODAL_PARAM]: "order", [ROW_PARAM]: orderId, [STEP_PARAM]: next }),
    setStep: (next) => update({ [STEP_PARAM]: next }),
    close: () => update({ [MODAL_PARAM]: undefined, [ROW_PARAM]: undefined, [STEP_PARAM]: undefined }),
  };
}
