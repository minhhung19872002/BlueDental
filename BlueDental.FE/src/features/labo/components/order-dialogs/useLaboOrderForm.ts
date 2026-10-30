import { useEffect, useRef } from "react";
import { Form, type FormInstance } from "antd";
import type { Rule } from "antd/es/form";
import dayjs, { type Dayjs } from "dayjs";
import {
  LABO_TAXONOMY,
  useLaboMaterialOptions,
  useLaboSupplierOptions,
  useLaboTaxonomyOptions,
  type PickerOption,
} from "@/hooks/useLaboPickers";
import type { LaboOrderDto, LaboOrderImageDto } from "@/features/labo/api/laboApi";
import type { LaboOrderFields } from "@/features/labo/api/laboMutations";
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
  biteId?: string;
  finishLineId?: string;
  rhythmId?: string;
  shade: string;
  quantity: string;
  notes: string;
  sentDate: Dayjs | null;
  sentTime: Dayjs | null;
  dueDate: Dayjs | null;
  dueTime: Dayjs | null;
  /** The FDI numbers the order carries: every tooth of its source (P2910_03). */
  teeth: string[];
}

export type LaboOrderSeed = Partial<LaboOrderValues> & Pick<LaboOrderValues, "teeth">;

export interface LaboOrderForm extends Omit<LaboPictureTiles, "reset"> {
  form: FormInstance<LaboOrderValues>;
  /** A sent or cancelled order, or a Nháp the user may not edit: every control is shown, none moves. */
  readOnly: boolean;
  options: Record<
    "suppliers" | "services" | "materials" | "bites" | "finishLines" | "rhythms",
    PickerOption[]
  >;
}

export interface LaboOrderFormSetup {
  branchId: string;
  open: boolean;
  seed: LaboOrderSeed;
  /** Re-applies the seed when it changes: the công đoạn, the order, or the dialog opening. */
  seedKey: string;
  /** The order's saved pictures, put back on the strip with the seed. */
  savedImages: LaboOrderImageDto[];
  readOnly: boolean;
}

/** The one rule the reference puts on its required fields, worded its way. */
export function requiredRule(message: string): Rule[] {
  return [{ required: true, message }];
}

/** The reference opens with "now" in Ngày gửi / Giờ gửi and everything else blank. */
export function fromSeed(seed: LaboOrderSeed): LaboOrderValues {
  const now = dayjs();
  return {
    shade: "",
    quantity: String(seed.teeth.length),
    notes: "",
    sentDate: now,
    sentTime: now,
    dueDate: null,
    dueTime: null,
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
  const sent = order.sentAt ? dayjs(order.sentAt) : dayjs();
  const due = order.dueAt ? dayjs(order.dueAt) : null;
  return {
    dentistId: order.dentistId,
    supplierId: order.supplierId,
    serviceGroupId: order.laboServiceId,
    materialId: order.materialId,
    biteId: order.biteId,
    finishLineId: order.finishLineId,
    rhythmId: order.rhythmId,
    shade: order.toothShade ?? "",
    quantity: String(saved.length > 0 ? order.quantity : teeth.length),
    notes: order.notes ?? "",
    sentDate: sent,
    sentTime: sent,
    dueDate: due,
    dueTime: due,
    teeth,
  };
}

/**
 * The teeth and Số lượng are read here with `preserve`: they never sit in a
 * Form.Item, and without it useWatch drops values no field registered.
 */
export function useLaboValue<K extends keyof LaboOrderValues>(
  form: FormInstance<LaboOrderValues>,
  name: K,
): LaboOrderValues[K] | undefined {
  return Form.useWatch(name, { form, preserve: true });
}

/**
 * Option lists and the picture strip behind the Đặt hàng tab.
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

  const serviceGroupId = useLaboValue(form, "serviceGroupId");
  const suppliers = useLaboSupplierOptions(branchId, open);
  const services = useLaboTaxonomyOptions(LABO_TAXONOMY.material, branchId, open);
  const bites = useLaboTaxonomyOptions(LABO_TAXONOMY.bite, branchId, open);
  const finishLines = useLaboTaxonomyOptions(LABO_TAXONOMY.finishLine, branchId, open);
  const rhythms = useLaboTaxonomyOptions(LABO_TAXONOMY.rhythm, branchId, open);
  const materials = useLaboMaterialOptions(branchId, serviceGroupId);

  return {
    form,
    readOnly,
    options: {
      suppliers: suppliers.data ?? [],
      services: services.data ?? [],
      materials: serviceGroupId ? (materials.data ?? []) : [],
      bites: bites.data ?? [],
      finishLines: finishLines.data ?? [],
      rhythms: rhythms.data ?? [],
    },
    ...pictures,
  };
}

/** The part of the payload the form's own fields decide. */
export function laboOrderBody(
  values: LaboOrderValues,
): Omit<LaboOrderFields, "estimatedCost" | "treatmentServiceId" | "treatmentStageId" | "submit" | "pictures"> {
  return {
    dentistId: values.dentistId,
    supplierId: values.supplierId,
    materialId: values.materialId,
    biteId: values.biteId,
    finishLineId: values.finishLineId,
    rhythmId: values.rhythmId,
    teeth: (values.teeth ?? []).map(Number).filter((fdi) => fdi > 0),
    toothShade: values.shade?.trim() || undefined,
    quantity: Number(values.quantity) || 1,
    notes: values.notes?.trim() || undefined,
    // The reference collects each day and hour apart; the server takes one stamp of each.
    sentAt: stamp(values.sentDate, values.sentTime)?.toISOString(),
    dueAt: stamp(values.dueDate, values.dueTime)?.toISOString(),
  };
}

/** A day and an hour picked apart, as the one stamp the server takes; none without the day. */
export function stamp(date: Dayjs | null | undefined, time: Dayjs | null | undefined): Dayjs | undefined {
  if (!date) return undefined;
  return date
    .hour(time?.hour() ?? 0)
    .minute(time?.minute() ?? 0)
    .second(0)
    .millisecond(0);
}

type StampFields = Pick<LaboOrderValues, "sentDate" | "sentTime" | "dueDate" | "dueTime">;

/**
 * "Ngày và giờ nhận dự kiến phải sau ngày và giờ gửi" — the reference's second
 * rule on the due pair. Holds while either pair is still incomplete: the
 * required rules speak to that.
 */
export function dueAfterSent(values: StampFields): boolean {
  if (!values.sentDate || !values.sentTime || !values.dueDate || !values.dueTime) return true;
  const sent = stamp(values.sentDate, values.sentTime);
  const due = stamp(values.dueDate, values.dueTime);
  return sent === undefined || due === undefined || due.isAfter(sent);
}
