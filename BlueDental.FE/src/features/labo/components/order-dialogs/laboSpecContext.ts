import type { LaboSpecMode } from "@/features/labo/api/laboApi";
import { specErrors, type LaboSpecError, type LaboSpecNames } from "./laboSpecRules";
import { DEFAULT_SPEC_MODE, type LaboSpecRows, type LaboSpecValue } from "./laboToothSpecs";
import { useLaboValue, type LaboOrderForm } from "./useLaboOrderForm";

/** What every card of Thông số từng răng reads. */
export interface LaboSpecContext {
  form: LaboOrderForm;
  teeth: string[];
  mode: LaboSpecMode;
  rows: LaboSpecRows | undefined;
  names: LaboSpecNames;
  errors: LaboSpecError[];
}

/** The cards' values, live, and the errors «Tạo phiếu Labo» waits on. */
export function useLaboSpecContext(form: LaboOrderForm): LaboSpecContext {
  const teeth = useLaboValue(form.form, "teeth") ?? [];
  const mode = useLaboValue(form.form, "specMode") ?? DEFAULT_SPEC_MODE;
  const rows = useLaboValue(form.form, "specs");
  const label = (list: LaboOrderForm["options"]["finishLines"], id: string | undefined) =>
    id === undefined ? undefined : list.find((option) => option.value === id)?.label;
  const names: LaboSpecNames = {
    finishLine: (id) => label(form.options.finishLines, id),
    rhythm: (id) => label(form.options.rhythms, id),
  };
  return { form, teeth, mode, rows, names, errors: specErrors(teeth, mode, rows) };
}

/** One card's whole value replaced — a surface picked or taken off, a split flipped. */
export function setSpecRow(context: LaboSpecContext, key: string, value: LaboSpecValue) {
  context.form.form.setFieldValue(["specs", key], value);
}
