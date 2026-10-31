import { useState } from "react";
import { Form, type FormInstance } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { toast } from "sonner";
import { useWarrantyCardDrafts, WARRANTY_CARD_SIDES, type WarrantyCardDrafts } from "@/components/WarrantyCardPhotos";
import { CATALOG_DURATION, warrantyEndDate } from "@/features/labo/components/warranty/laboWarrantyRules";
import { t } from "@/lib/i18n";
import { useActivateServiceWarranty, type WarrantyServiceRowDto } from "../../api/planWarrantyApi";

/** The one card of a line without teeth sits under tooth 0, as its photos do on the server. */
const NO_TOOTH = 0;

export const cardKey = (tooth: number) => `t${tooth}`;

export interface ServiceWarrantyCardValues {
  startDate?: Dayjs;
  /** Months, or {@link CATALOG_DURATION} for "Theo danh mục". */
  months?: number;
  conditions?: string;
}

interface ServiceWarrantyValues {
  cards?: Record<string, ServiceWarrantyCardValues | undefined>;
}

export interface ServiceWarrantyForm {
  form: FormInstance<ServiceWarrantyValues>;
  initialValues: ServiceWarrantyValues;
  busy: boolean;
  /** Teeth still without a dental card; [0] on a line without teeth. */
  teeth: number[];
  selected: number[];
  toggle: (tooth: number) => void;
  photos: WarrantyCardDrafts;
  readyCount: number;
  activate: () => Promise<void>;
}

/** Ngày hết hạn: start + months, or start + the catalog's days on "Theo danh mục". */
export function serviceCardEnd(card: ServiceWarrantyCardValues | undefined, catalogDays: number): Dayjs | null {
  if (!card?.startDate) return null;
  return card.months === CATALOG_DURATION ? card.startDate.add(catalogDays, "day") : warrantyEndDate(card.startDate, card.months);
}

const isReady = (card: ServiceWarrantyCardValues | undefined) => Boolean(card?.startDate) && card?.months !== undefined;

/**
 * "Bảo hành dịch vụ" (REQ-B5): one dental card per tooth still without one,
 * starting today (never before the line was finished) on the catalog's days
 * unless a number of months is picked; the teeth left out wait for later.
 */
export function useServiceWarrantyForm(row: WarrantyServiceRowDto, planId: string, onDone: () => void): ServiceWarrantyForm {
  const activateWarranty = useActivateServiceWarranty();
  const photos = useWarrantyCardDrafts();
  const [form] = Form.useForm<ServiceWarrantyValues>();
  const cards = Form.useWatch("cards", form);
  const teeth = row.dentalPendingTeeth.map((tooth) => tooth ?? NO_TOOTH);
  const [selected, setSelected] = useState<number[]>(teeth);

  const startDate = dayjs().startOf("day");
  const months = row.warrantyDays > 0 ? CATALOG_DURATION : undefined;
  const initialValues: ServiceWarrantyValues = {
    cards: Object.fromEntries(teeth.map((tooth) => [cardKey(tooth), { startDate, months }])),
  };

  const toggle = (tooth: number) =>
    setSelected((current) => (current.includes(tooth) ? current.filter((n) => n !== tooth) : [...current, tooth]));

  const activate = async () => {
    const fields = selected.flatMap((tooth) => [
      ["cards", cardKey(tooth), "startDate"],
      ["cards", cardKey(tooth), "months"],
    ]);
    try {
      await form.validateFields(fields);
    } catch {
      form.scrollToField(form.getFieldsError().find((field) => field.errors.length)?.name ?? []);
      return;
    }
    const values: ServiceWarrantyValues = form.getFieldsValue(true);
    try {
      await activateWarranty.mutateAsync({
        planId,
        lineId: row.lineId,
        cards: selected.map((tooth) => {
          const card = values.cards?.[cardKey(tooth)] ?? {};
          return {
            toothNumber: tooth === NO_TOOTH ? null : tooth,
            startDate: card.startDate?.format("YYYY-MM-DD") ?? "",
            months: card.months === CATALOG_DURATION ? null : (card.months ?? null),
            conditions: card.conditions,
          };
        }),
        photos: selected.flatMap((tooth) => {
          const files = photos.filesOf(tooth);
          return WARRANTY_CARD_SIDES.flatMap((side) => {
            const file = files[side];
            return file ? [{ tooth, side, file }] : [];
          });
        }),
      });
      toast.success(t("Treatment:Warranty:ActivatedToast", selected.length));
      photos.clear(selected);
      onDone();
    } catch {
      // The global MutationCache toasts the server's message; the dialog stays for the fix.
    }
  };

  return {
    form,
    initialValues,
    busy: activateWarranty.isPending,
    teeth,
    selected,
    toggle,
    photos,
    readyCount: selected.filter((tooth) => isReady(cards?.[cardKey(tooth)])).length,
    activate,
  };
}
