import { useState } from "react";
import { Form, type FormInstance } from "antd";
import type { Dayjs } from "dayjs";
import { toast } from "sonner";
import { useWarrantyCardDrafts, WARRANTY_CARD_SIDES, type WarrantyCardDrafts } from "@/components/WarrantyCardPhotos";
import { t } from "@/lib/i18n";
import { useAbility } from "@/hooks/useAbility";
import type { LaboOrderDto, LaboOrderToothDto } from "@/features/labo/api/laboApi";
import { useActivateLaboWarranty } from "@/features/labo/api/laboMutations";
import { toothKey } from "../check/laboCheckRules";
import { isActivated, isWarrantyOpen, warrantyTeeth } from "./laboWarrantyRules";

export interface LaboWarrantyCardValues {
  startDate?: Dayjs;
  months?: number;
  manufacturerSerial?: string;
  conditions?: string;
}

export interface LaboWarrantyValues {
  cards?: Record<string, LaboWarrantyCardValues | undefined>;
}

export interface LaboWarrantyForm {
  form: FormInstance<LaboWarrantyValues>;
  /** May activate here: the right, and Đạt teeth still without a card. */
  editable: boolean;
  /** The whole order passed, so the picked teeth can be activated now. */
  open: boolean;
  busy: boolean;
  /** Đạt teeth without a card yet. */
  pending: LaboOrderToothDto[];
  selected: number[];
  toggle: (tooth: number) => void;
  /** "Tất cả": every pending tooth picked, or none. */
  toggleAll: (on: boolean) => void;
  /** The card forms as typed so far, keyed by toothKey. */
  cards: LaboWarrantyValues["cards"];
  /** Ảnh thẻ bảo hành picked per tooth, sent with the activation (P3110 REQ-E1). */
  photos: WarrantyCardDrafts;
  /** Picked teeth whose start and duration are both filled. */
  readyCount: number;
  activate: () => Promise<void>;
}

/** Both Ngày bắt đầu and Thời hạn filled. */
export const isWarrantyCardReady = (card: LaboWarrantyCardValues | undefined) => Boolean(card?.startDate && card.months);

/**
 * Kích hoạt bảo hành (n răng): pick the Đạt teeth still without a card, give
 * each a start day (not before it passed), a duration and, if at hand, the
 * photos of its card, and activate them together. A tooth can be left for
 * later; the first card moves the order to Bảo hành. `readOnly` (R-1120)
 * offers nothing to activate, whatever the right.
 */
export function useLaboWarrantyForm(order: LaboOrderDto, readOnly = false): LaboWarrantyForm {
  const ability = useAbility("treatmentLabo");
  const activateWarranty = useActivateLaboWarranty();
  const photos = useWarrantyCardDrafts();
  const [form] = Form.useForm<LaboWarrantyValues>();
  const cards = Form.useWatch("cards", form);

  const pending = warrantyTeeth(order).filter((tooth) => !isActivated(tooth));
  const [picked, setPicked] = useState<number[]>(() => pending.map((tooth) => tooth.toothNumber));
  // A tooth activated meanwhile drops out of the pick on its own.
  const selected = picked.filter((number) => pending.some((tooth) => tooth.toothNumber === number));
  const open = isWarrantyOpen(order);

  const toggle = (tooth: number) =>
    setPicked((current) => (current.includes(tooth) ? current.filter((n) => n !== tooth) : [...current, tooth]));
  const toggleAll = (on: boolean) => setPicked(on ? pending.map((tooth) => tooth.toothNumber) : []);

  const activate = async () => {
    const fields = selected.flatMap((tooth) => [
      ["cards", toothKey(tooth), "startDate"],
      ["cards", toothKey(tooth), "months"],
    ]);
    try {
      await form.validateFields(fields);
    } catch {
      form.scrollToField(form.getFieldsError().find((field) => field.errors.length)?.name ?? []);
      return;
    }
    const values: LaboWarrantyValues = form.getFieldsValue(true);
    try {
      await activateWarranty.mutateAsync({
        id: order.id,
        cards: selected.map((tooth) => {
          const card = values.cards?.[toothKey(tooth)] ?? {};
          return {
            toothNumber: tooth,
            startDate: card.startDate?.format("YYYY-MM-DD") ?? "",
            months: card.months ?? 0,
            manufacturerSerial: card.manufacturerSerial,
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
      toast.success(t("Labo:Warranty:Activated", selected.length));
      form.resetFields(selected.map((tooth) => ["cards", toothKey(tooth)]));
      photos.clear(selected);
    } catch {
      // The global MutationCache toasts the server's message; the tab stays for the fix.
    }
  };

  return {
    form,
    editable: !readOnly && ability.canUpdate && pending.length > 0,
    open,
    busy: activateWarranty.isPending,
    pending,
    selected,
    toggle,
    toggleAll,
    cards,
    photos,
    readyCount: selected.filter((tooth) => isWarrantyCardReady(cards?.[toothKey(tooth)])).length,
    activate,
  };
}
