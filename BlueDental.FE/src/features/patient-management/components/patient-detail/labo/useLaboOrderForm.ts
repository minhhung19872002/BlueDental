import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Form, type FormInstance } from "antd";
import type { Rule } from "antd/es/form";
import dayjs, { type Dayjs } from "dayjs";
import { validateImageFile } from "@/utils/validateImageFile";
import {
  LABO_TAXONOMY,
  useLaboMaterialOptions,
  useLaboSupplierOptions,
  useLaboTaxonomyOptions,
  type CreateLaboOrderInput,
  type PickerOption,
} from "@/hooks/useLaboPickers";

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

export interface LaboOrderForm {
  form: FormInstance<LaboOrderValues>;
  toggleTooth: (label: string) => void;
  setAllTeeth: (checked: boolean) => void;
  options: Record<
    "suppliers" | "services" | "materials" | "bites" | "finishLines" | "rhythms",
    PickerOption[]
  >;
  pictures: File[];
  previews: string[];
  addPictures: (files: File[]) => void;
  removePicture: (index: number) => void;
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
  const [pictures, setPictures] = useState<File[]>([]);
  const seedRef = useRef(seed);
  seedRef.current = seed;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(fromSeed(seedRef.current));
    setPictures([]);
  }, [form, open, seedKey]);

  const serviceGroupId = useLaboValue(form, "serviceGroupId");
  const suppliers = useLaboSupplierOptions(branchId, open);
  const services = useLaboTaxonomyOptions(LABO_TAXONOMY.material, branchId, open);
  const bites = useLaboTaxonomyOptions(LABO_TAXONOMY.bite, branchId, open);
  const finishLines = useLaboTaxonomyOptions(LABO_TAXONOMY.finishLine, branchId, open);
  const rhythms = useLaboTaxonomyOptions(LABO_TAXONOMY.rhythm, branchId, open);
  const materials = useLaboMaterialOptions(branchId, serviceGroupId);

  /**
   * One blob URL per draft, revoked when the list changes or the dialog goes.
   * Minting them inside the render would hand out a fresh URL on every
   * keystroke in this form and never release any of them.
   */
  const previews = useMemo(() => pictures.map((file) => URL.createObjectURL(file)), [pictures]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

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
    addPictures: (files) => {
      const valid = files.filter((file) => {
        const error = validateImageFile(file);
        if (error) toast.error(`${file.name}: ${error}`);
        return !error;
      });
      if (valid.length > 0) setPictures((current) => [...current, ...valid]);
    },
    removePicture: (index) => setPictures((current) => current.filter((_, at) => at !== index)),
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
  | "dueDate"
> {
  // The reference collects the day and the hour apart; the server takes one stamp.
  const sentAt = values.sentDate
    ?.hour(values.sentTime?.hour() ?? 0)
    .minute(values.sentTime?.minute() ?? 0)
    .second(0);
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
    sentAt: sentAt?.toISOString(),
    // The day is what the list sorts and filters on, so the due hour rides
    // along on the sent stamp only.
    dueDate: values.dueDate?.format("YYYY-MM-DD"),
  };
}
