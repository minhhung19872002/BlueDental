import { useEffect, useRef } from "react";
import { Form, type FormInstance } from "antd";
import type { Rule } from "antd/es/form";
import dayjs, { type Dayjs } from "dayjs";
import {
  LABO_TAXONOMY,
  useLaboMaterialOptions,
  useLaboServiceOptions,
  useLaboSupplierOptions,
  useLaboTaxonomyOptions,
  type LaboMaterialOption,
  type LaboServiceOption,
  type PickerOption,
} from "@/hooks/useLaboPickers";
import type { LaboOrderDto, LaboOrderImageDto, LaboSpecMode } from "@/features/labo/api/laboApi";
import type { LaboOrderFields } from "@/features/labo/api/laboMutations";
import { DEFAULT_SPEC_MODE, savedSpecRows, specInputs, type LaboSpecRows } from "./laboToothSpecs";
import { useLaboPictureTiles, type LaboPictureTiles } from "./useLaboPictureTiles";

/** The fields of the Đặt hàng tab. */
export interface LaboOrderValues {
  /** Picked in the header when the dialog opens from the Labo tab. */
  planId?: string;
  lineId?: string;
  dentistId?: string;
  supplierId?: string;
  serviceGroupId?: string;
  materialId?: string;
  quantity: string;
  notes: string;
  /** Days only: the hour went with P3110 (REQ-C2); the server stamps when the order was made. */
  sentDate: Dayjs | null;
  dueDate: Dayjs | null;
  /** The FDI numbers the order carries, picked on the chart (P3110 REQ-C6). */
  teeth: string[];
  /** Khớp cắn, one for the whole order (R-1150). */
  biteId?: string;
  /** Thông số răng / Màu răng Chung or Riêng (R-1150); set by the switches, read with `preserve`. */
  specMode: LaboSpecMode;
  /** Thông số từng răng, by FDI, and the shared row under "0". */
  specs: LaboSpecRows;
}

export type LaboOrderSeed = Partial<LaboOrderValues> & Pick<LaboOrderValues, "teeth">;

export interface LaboOrderForm extends Omit<LaboPictureTiles, "reset"> {
  form: FormInstance<LaboOrderValues>;
  /** A sent or cancelled order, or a Nháp the user may not edit: every control is shown, none moves. */
  readOnly: boolean;
  options: Record<"suppliers" | "bites" | "finishLines" | "rhythms", PickerOption[]> & {
    services: LaboServiceOption[];
    /** Every material of the branch; the material row narrows them to the service picked. */
    materials: LaboMaterialOption[];
  };
}

export interface LaboOrderFormSetup {
  branchId: string;
  open: boolean;
  seed: LaboOrderSeed;
  /** Re-applies the seed when it changes: the công đoạn, the order, or the dialog opening. */
  seedKey: string;
  /** The order's saved pictures, put back in their sets with the seed. */
  savedImages: LaboOrderImageDto[];
  readOnly: boolean;
}

/** The one rule the reference puts on its required fields, worded its way. */
export function requiredRule(message: string): Rule[] {
  return [{ required: true, message }];
}

/** A new order opens on today in Ngày gửi and everything else blank. */
export function fromSeed(seed: LaboOrderSeed): LaboOrderValues {
  return {
    quantity: String(seed.teeth.length),
    notes: "",
    sentDate: dayjs(),
    dueDate: null,
    specMode: DEFAULT_SPEC_MODE,
    specs: {},
    ...seed,
  };
}

/**
 * A saved order back in the form, with the teeth it was saved with; a Nháp
 * saved before its line named any takes the line's.
 */
export function orderSeed(order: LaboOrderDto, lineTeeth: string[] = []): LaboOrderSeed {
  const saved = order.teeth.map((tooth) => String(tooth.toothNumber));
  const teeth = saved.length > 0 ? saved : lineTeeth;
  const firstTooth = order.teeth[0];
  return {
    dentistId: order.dentistId,
    supplierId: order.supplierId,
    serviceGroupId: order.laboServiceId,
    materialId: order.materialId,
    quantity: String(saved.length > 0 ? order.quantity : teeth.length),
    notes: order.notes ?? "",
    sentDate: order.sentAt ? dayjs(order.sentAt) : dayjs(),
    dueDate: order.dueAt ? dayjs(order.dueAt) : null,
    teeth,
    // Orders before R-1150 kept a Khớp cắn per tooth: the first one stands for the order.
    biteId: order.biteId ?? firstTooth?.biteId ?? undefined,
    specMode: order.specMode,
    specs: savedSpecRows(order.teeth),
  };
}

/**
 * Values no Form.Item registers — the teeth, Số lượng, the spec rows — are
 * read with `preserve`: without it useWatch drops them.
 */
export function useLaboValue<K extends keyof LaboOrderValues>(
  form: FormInstance<LaboOrderValues>,
  name: K,
): LaboOrderValues[K] | undefined {
  return Form.useWatch(name, { form, preserve: true });
}

/**
 * Option lists and the picture sets behind the Đặt hàng tab.
 * The seed is re-applied whenever `seedKey` changes, so a dialog reopened on
 * another row never shows the last one's values. Validation lives on the
 * fields themselves.
 */
export function useLaboOrderForm(
  form: FormInstance<LaboOrderValues>,
  { branchId, open, seed, seedKey, savedImages, readOnly }: LaboOrderFormSetup,
): LaboOrderForm {
  const { reset, ...pictures } = useLaboPictureTiles();
  const seedRef = useRef({ seed, savedImages });
  seedRef.current = { seed, savedImages };

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(fromSeed(seedRef.current.seed));
    reset(seedRef.current.savedImages);
  }, [form, open, seedKey, reset]);

  const suppliers = useLaboSupplierOptions(branchId, open);
  const services = useLaboServiceOptions(branchId, open);
  const materials = useLaboMaterialOptions(branchId, open);
  const bites = useLaboTaxonomyOptions(LABO_TAXONOMY.bite, branchId, open);
  const finishLines = useLaboTaxonomyOptions(LABO_TAXONOMY.finishLine, branchId, open);
  const rhythms = useLaboTaxonomyOptions(LABO_TAXONOMY.rhythm, branchId, open);

  return {
    form,
    readOnly,
    options: {
      suppliers: suppliers.data ?? [],
      services: services.data ?? [],
      materials: materials.data ?? [],
      bites: bites.data ?? [],
      finishLines: finishLines.data ?? [],
      rhythms: rhythms.data ?? [],
    },
    ...pictures,
  };
}

/** The day itself, sent as the clinic's midnight; the server keeps only the day. */
const dayOf = (date: Dayjs | null | undefined) => date?.startOf("day").toISOString();

/** The part of the payload the form's own fields decide. */
export function laboOrderBody(
  values: LaboOrderValues,
): Omit<
  LaboOrderFields,
  "estimatedCost" | "treatmentServiceId" | "treatmentStageId" | "submit" | "pictures" | "toothPictures"
> {
  const teeth = (values.teeth ?? []).map(Number).filter((fdi) => fdi > 0);
  const specMode = values.specMode ?? DEFAULT_SPEC_MODE;
  return {
    dentistId: values.dentistId,
    supplierId: values.supplierId,
    materialId: values.materialId,
    teeth,
    quantity: Number(values.quantity) || 1,
    notes: values.notes?.trim() || undefined,
    sentAt: dayOf(values.sentDate),
    dueAt: dayOf(values.dueDate),
    biteId: values.biteId,
    specMode,
    toothSpecs: specInputs(teeth, specMode, values.specs),
  };
}

/**
 * Ngày nhận dự kiến has to fall after Ngày gửi — a later day, as the server
 * holds it (DueBeforeSent). Holds while either day is blank: the required
 * rules speak to that.
 */
export function dueAfterSent(sentDate: Dayjs | null | undefined, dueDate: Dayjs | null | undefined): boolean {
  if (!sentDate || !dueDate) return true;
  return dueDate.startOf("day").isAfter(sentDate.startOf("day"));
}
