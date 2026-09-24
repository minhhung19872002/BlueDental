import { useEffect, useRef } from "react";
import { Form, type FormInstance } from "antd";
import type { Rule } from "antd/es/form";
import dayjs, { type Dayjs } from "dayjs";
import {
  LABO_TAXONOMY,
  useLaboMaterialOptions,
  useLaboSupplierOptions,
  useLaboTaxonomyOptions,
  type CreateLaboOrderInput,
  type PickerOption,
} from "@/hooks/useLaboPickers";
import { useLaboPictures, type LaboPictures } from "./useLaboPictures";

/** The fields every labo order form shares, whichever tab it is on. */
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
  /** Every tooth the source offers, and the ones still ticked. */
  teeth: string[];
  picked: string[];
}

export type LaboOrderSeed = Partial<LaboOrderValues> & Pick<LaboOrderValues, "teeth">;

export interface LaboOrderForm extends Omit<LaboPictures, "reset"> {
  form: FormInstance<LaboOrderValues>;
  toggleTooth: (label: string) => void;
  setAllTeeth: (checked: boolean) => void;
  options: Record<
    "suppliers" | "services" | "materials" | "bites" | "finishLines" | "rhythms",
    PickerOption[]
  >;
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
    picked: seed.teeth,
    ...seed,
  };
}

/**
 * Teeth and picks are read here with `preserve`: they never sit in a
 * Form.Item, and without it useWatch drops values no field registered.
 */
export function useLaboValue<K extends keyof LaboOrderValues>(
  form: FormInstance<LaboOrderValues>,
  name: K,
): LaboOrderValues[K] | undefined {
  return Form.useWatch(name, { form, preserve: true });
}

/**
 * Option lists and the tooth row behind the AntD form the labo dialogs share.
 * The seed is re-applied whenever `seedKey` changes — the công đoạn, the parent
 * order, or the dialog opening — so a dialog reopened on another row never
 * shows the last one's values. Validation lives on the fields themselves.
 */
export function useLaboOrderForm(
  form: FormInstance<LaboOrderValues>,
  branchId: string,
  open: boolean,
  seed: LaboOrderSeed,
  seedKey: string,
): LaboOrderForm {
  const { pictures, previews, addPictures, removePicture, reset } = useLaboPictures();
  const seedRef = useRef(seed);
  seedRef.current = seed;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(fromSeed(seedRef.current));
    reset();
  }, [form, open, seedKey, reset]);

  const serviceGroupId = useLaboValue(form, "serviceGroupId");
  const suppliers = useLaboSupplierOptions(branchId, open);
  const services = useLaboTaxonomyOptions(LABO_TAXONOMY.material, branchId, open);
  const bites = useLaboTaxonomyOptions(LABO_TAXONOMY.bite, branchId, open);
  const finishLines = useLaboTaxonomyOptions(LABO_TAXONOMY.finishLine, branchId, open);
  const rhythms = useLaboTaxonomyOptions(LABO_TAXONOMY.rhythm, branchId, open);
  const materials = useLaboMaterialOptions(branchId, serviceGroupId);

  /**
   * Số lượng is the count of ticked teeth, 0 once they are all unticked. A
   * tick also clears the "Vui lòng chọn răng." a failed Lưu may have left.
   */
  const setPicked = (picked: string[]) => {
    form.setFields([{ name: "picked", value: picked, errors: [] }]);
    form.setFieldsValue({ quantity: String(picked.length) });
  };

  return {
    form,
    toggleTooth: (label) => {
      const teeth: string[] = form.getFieldValue("teeth") ?? [];
      const picked: string[] = form.getFieldValue("picked") ?? [];
      setPicked(
        picked.includes(label)
          ? picked.filter((item) => item !== label)
          : teeth.filter((item) => item === label || picked.includes(item)),
      );
    },
    setAllTeeth: (checked) => setPicked(checked ? (form.getFieldValue("teeth") ?? []) : []),
    options: {
      suppliers: suppliers.data ?? [],
      services: services.data ?? [],
      materials: serviceGroupId ? (materials.data ?? []) : [],
      bites: bites.data ?? [],
      finishLines: finishLines.data ?? [],
      rhythms: rhythms.data ?? [],
    },
    pictures,
    previews,
    addPictures,
    removePicture,
  };
}

/** The part of the payload the shared fields decide. */
export function laboOrderBody(
  values: LaboOrderValues,
  suppliers: PickerOption[],
): Pick<
  CreateLaboOrderInput,
  | "labProviderName"
  | "supplierId"
  | "materialId"
  | "biteId"
  | "finishLineId"
  | "rhythmId"
  | "toothNumbers"
  | "toothShade"
  | "quantity"
  | "notes"
  | "sentAt"
  | "dueAt"
> {
  return {
    labProviderName: suppliers.find((row) => row.value === values.supplierId)?.label ?? "",
    supplierId: values.supplierId,
    materialId: values.materialId,
    biteId: values.biteId,
    finishLineId: values.finishLineId,
    rhythmId: values.rhythmId,
    toothNumbers: values.picked.join(", ") || undefined,
    toothShade: values.shade.trim() || undefined,
    quantity: Number(values.quantity) || 1,
    notes: values.notes.trim() || undefined,
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
