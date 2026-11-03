import { useState } from "react";
import { Form, type FormInstance } from "antd";
import dayjs from "dayjs";
import { toast } from "sonner";
import { useWarrantyCardDrafts, WARRANTY_CARD_SIDES, type WarrantyCardDrafts } from "@/components/WarrantyCardPhotos";
import { toothKey } from "@/features/labo/components/check/laboCheckRules";
import { CATALOG_DURATION, SHARED_CARD } from "@/features/labo/components/warranty/laboWarrantyRules";
import {
  isWarrantyCardReady,
  type LaboWarrantyValues,
} from "@/features/labo/components/warranty/useLaboWarrantyForm";
import { useWarrantySharing, type WarrantySharing } from "@/features/labo/components/warranty/useWarrantySharing";
import { t } from "@/lib/i18n";
import { useActivateServiceWarranty, type WarrantyServiceRowDto } from "../../api/planWarrantyApi";

/**
 * The one card of a line without teeth sits under tooth 0, as its photos do on
 * the server. It never meets SHARED_CARD (also 0): sharing needs two teeth.
 */
export const NO_TOOTH = 0;

export interface ServiceWarrantyForm {
  form: FormInstance<LaboWarrantyValues>;
  initialValues: LaboWarrantyValues;
  busy: boolean;
  /** Teeth still without a dental card; [NO_TOOTH] on a line without teeth. */
  teeth: number[];
  /** The line has teeth to pick from: 1. Chọn răng kích hoạt shows. */
  hasTeeth: boolean;
  selected: number[];
  toggle: (tooth: number) => void;
  /** "Tất cả": every pending tooth picked, or none. */
  toggleAll: (on: boolean) => void;
  /** Dùng chung 1 thông số, and each tooth's card as it will be sent. */
  sharing: WarrantySharing;
  photos: WarrantyCardDrafts;
  /** Picked teeth whose start and duration are both filled. */
  readyCount: number;
  activate: () => Promise<void>;
}

/**
 * "Bảo hành dịch vụ" (REQ-B5) on the frame of Labo's Kích hoạt bảo hành: one
 * dental card per tooth still without one, starting today (never before the
 * line was finished) on the catalog's days unless a number of months is
 * picked — typed per tooth, or once for them all under Dùng chung. The teeth
 * left out wait for later.
 */
export function useServiceWarrantyForm(row: WarrantyServiceRowDto, planId: string, onDone: () => void): ServiceWarrantyForm {
  const activateWarranty = useActivateServiceWarranty();
  const photos = useWarrantyCardDrafts();
  const [form] = Form.useForm<LaboWarrantyValues>();
  const teeth = row.dentalPendingTeeth.map((tooth) => tooth ?? NO_TOOTH);
  const [selected, setSelected] = useState<number[]>(teeth);
  const sharing = useWarrantySharing(form, selected, photos);

  const startDate = dayjs().startOf("day");
  const months = row.warrantyDays > 0 ? CATALOG_DURATION : undefined;
  const initialValues: LaboWarrantyValues = {
    cards: Object.fromEntries(teeth.map((tooth) => [toothKey(tooth), { startDate, months }])),
  };

  const toggle = (tooth: number) =>
    setSelected((current) => (current.includes(tooth) ? current.filter((n) => n !== tooth) : [...current, tooth]));
  const toggleAll = (on: boolean) => setSelected(on ? teeth : []);

  const activate = async () => {
    const fields = sharing.on
      ? [["shared", "startDate"], ["shared", "months"]]
      : selected.flatMap((tooth) => [
          ["cards", toothKey(tooth), "startDate"],
          ["cards", toothKey(tooth), "months"],
        ]);
    try {
      await form.validateFields(fields);
    } catch {
      form.scrollToField(form.getFieldsError().find((field) => field.errors.length)?.name ?? []);
      return;
    }
    try {
      await activateWarranty.mutateAsync({
        planId,
        lineId: row.lineId,
        cards: selected.map((tooth) => {
          const card = sharing.cardOf(tooth) ?? {};
          return {
            toothNumber: tooth === NO_TOOTH ? null : tooth,
            startDate: card.startDate?.format("YYYY-MM-DD") ?? "",
            months: card.months === CATALOG_DURATION ? null : (card.months ?? null),
            conditions: card.conditions,
          };
        }),
        photos: selected.flatMap((tooth) => {
          const files = sharing.filesOf(tooth);
          return WARRANTY_CARD_SIDES.flatMap((side) => {
            const file = files[side];
            return file ? [{ tooth, side, file }] : [];
          });
        }),
      });
      toast.success(t("Treatment:Warranty:ActivatedToast", selected.length));
      photos.clear([...selected, SHARED_CARD]);
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
    hasTeeth: teeth.some((tooth) => tooth !== NO_TOOTH),
    selected,
    toggle,
    toggleAll,
    sharing,
    photos,
    readyCount: selected.filter((tooth) => isWarrantyCardReady(sharing.cardOf(tooth))).length,
    activate,
  };
}
