import { useState } from "react";
import { Form, type FormInstance } from "antd";
import { WARRANTY_CARD_SIDES, type WarrantyCardDrafts, type WarrantyCardFiles } from "@/components/WarrantyCardPhotos";
import { toothKey } from "../check/laboCheckRules";
import { filledShared, SHARED_CARD, sharedPart, withShared, type WarrantySharedValues } from "./laboWarrantyRules";
import type { LaboWarrantyCardValues, LaboWarrantyValues } from "./useLaboWarrantyForm";

export interface WarrantySharing {
  /** Dùng chung 1 thông số cho tất cả răng is ticked. */
  on: boolean;
  /** Ticked, the shared card starts from `first`'s card if filled (the open tooth), else the first filled one. */
  set: (on: boolean, first?: number | null) => void;
  /** The tooth's card as it will be sent: its own, or its serial over the shared rest. */
  cardOf: (tooth: number) => LaboWarrantyCardValues | undefined;
  /** The tooth's Ảnh thẻ bảo hành as they will be sent: the shared face wins. */
  filesOf: (tooth: number) => WarrantyCardFiles;
}

const isEmpty = (shared: WarrantySharedValues | undefined) => Object.keys(filledShared(shared)).length === 0;

/**
 * Dùng chung 1 thông số (BA mock): the teeth of one package start the same day
 * and run the same time, so their start, duration, conditions and card photos
 * are typed once; each serial stays the tooth's own. Ticked, the shared card
 * starts from the open (else first) picked tooth already filled in; unticked, what it held
 * is copied onto every picked tooth, to be told apart from there.
 */
export function useWarrantySharing(
  form: FormInstance<LaboWarrantyValues>,
  selected: number[],
  photos: WarrantyCardDrafts,
): WarrantySharing {
  const [on, setOn] = useState(false);
  // `preserve`: Labo v2 mounts one tooth's card form at a time (R-1152), the rest stay in the store unregistered.
  const cards = Form.useWatch("cards", { form, preserve: true });
  const shared = Form.useWatch("shared", { form, preserve: true });

  const start = (first?: number | null) => {
    const values: LaboWarrantyValues = form.getFieldsValue(true);
    if (!isEmpty(values.shared)) return;
    const order = first != null ? [first, ...selected.filter((tooth) => tooth !== first)] : selected;
    const seed = order.map((tooth) => values.cards?.[toothKey(tooth)]).find((card) => !isEmpty(card));
    if (seed) form.setFieldValue("shared", sharedPart(seed));
  };

  const spread = () => {
    const values: LaboWarrantyValues = form.getFieldsValue(true);
    const filled = filledShared(values.shared);
    const files = photos.filesOf(SHARED_CARD);
    selected.forEach((tooth) => {
      form.setFieldValue(["cards", toothKey(tooth)], { ...values.cards?.[toothKey(tooth)], ...filled });
      const own = photos.filesOf(tooth);
      WARRANTY_CARD_SIDES.forEach((side) => {
        const file = files[side];
        if (file && !own[side]) photos.pick(tooth, side, file);
      });
    });
  };

  return {
    on,
    set: (next, first) => {
      if (next === on) return;
      if (next) start(first);
      else spread();
      setOn(next);
    },
    cardOf: (tooth) => {
      const own = cards?.[toothKey(tooth)];
      return on ? withShared(own, shared) : own;
    },
    filesOf: (tooth) => (on ? { ...photos.filesOf(tooth), ...photos.filesOf(SHARED_CARD) } : photos.filesOf(tooth)),
  };
}
