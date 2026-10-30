import { useEffect, useRef } from "react";
import { Form, type FormInstance } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { useAbility } from "@/hooks/useAbility";
import { useAuthStore } from "@/features/auth/store/authStore";
import {
  LABO_CHECK_CONCLUSION,
  LABO_TOOTH_RESULT,
  type LaboCheckConclusion,
  type LaboOrderDto,
} from "@/features/labo/api/laboApi";
import { useCheckLaboOrder, useReceiveLaboOrder } from "@/features/labo/api/laboMutations";
import { useLaboPictures, type LaboPictures } from "../order-dialogs/useLaboPictures";
import {
  checkVerdict,
  composeDescription,
  dueTeeth,
  isCheckOpen,
  openRound,
  receiveRoundNo,
  toothKey,
  type LaboCheckVerdict,
  type LaboToothPicks,
} from "./laboCheckRules";

export interface LaboCheckValues {
  receivedAt?: Dayjs;
  receivedQuantity?: number;
  teeth?: LaboToothPicks;
  description?: string;
  returnedAt?: Dayjs;
  redeliveryDueAt?: Dayjs;
}

export interface LaboCheckForm {
  form: FormInstance<LaboCheckValues>;
  editable: boolean;
  busy: boolean;
  roundNo: number;
  /** "lần N" of the Trả hàng this check would record. */
  returnNo: number;
  receiverName: string;
  /** The teeth B. lists for a result; the passed ones stay passed. */
  teeth: number[];
  verdict: LaboCheckVerdict;
  pictures: LaboPictures;
  saveReceive: () => Promise<void>;
  conclude: (conclusion: LaboCheckConclusion) => Promise<void>;
}

const RECEIVE_FIELDS = ["receivedAt", "receivedQuantity"];
const RETURN_FIELDS = ["description", "returnedAt", "redeliveryDueAt"];

/**
 * Tab 2 "Nhận hàng & kiểm tra": A. records the delivery (round N), B. takes a
 * Đạt / Lỗi per tooth, and the conclusion either confirms the Labo passed or
 * sends the faulty work back with C. Kết luận. A conclusion first saves the
 * delivery — the server amends an open round, so saving it twice is harmless.
 */
export function useLaboCheckForm(order: LaboOrderDto, onDone: () => void): LaboCheckForm {
  const ability = useAbility("treatmentLabo");
  const userName = useAuthStore((s) => s.user?.name) ?? "";
  const receive = useReceiveLaboOrder();
  const check = useCheckLaboOrder();
  const pictures = useLaboPictures();
  const [form] = Form.useForm<LaboCheckValues>();

  const round = openRound(order);
  const teeth = dueTeeth(order);
  const picks = Form.useWatch("teeth", form);
  const verdict = checkVerdict(teeth, picks);

  // Mô tả gửi Labo follows the Lỗi notes until someone writes their own text.
  const composed = useRef("");
  const description = composeDescription(teeth, picks);
  useEffect(() => {
    const current = form.getFieldValue("description") ?? "";
    if (current === "" || current === composed.current) form.setFieldValue("description", description);
    composed.current = description;
  }, [description, form]);

  useEffect(() => {
    form.setFieldsValue({
      receivedAt: round ? dayjs(round.receivedAt) : dayjs(),
      receivedQuantity: round?.receivedQuantity ?? order.quantity,
      returnedAt: dayjs(),
    });
  }, [form, round, order.quantity]);

  const receiveBody = (values: LaboCheckValues) => ({
    id: order.id,
    receivedAt: (values.receivedAt ?? dayjs()).toISOString(),
    receivedQuantity: values.receivedQuantity ?? order.quantity,
  });

  const validate = async (names: (string | string[])[]) => {
    try {
      await form.validateFields(names);
      return true;
    } catch {
      form.scrollToField(form.getFieldsError().find((field) => field.errors.length)?.name ?? []);
      return false;
    }
  };

  const saveReceive = async () => {
    if (!(await validate(RECEIVE_FIELDS))) return;
    try {
      await receive.mutateAsync(receiveBody(form.getFieldsValue(true)));
      toast.success(t("Labo:Check:Received"));
    } catch {
      // The global MutationCache toasts the server's message.
    }
  };

  const conclude = async (conclusion: LaboCheckConclusion) => {
    const returning = conclusion !== LABO_CHECK_CONCLUSION.Pass;
    const toothFields = teeth.map((tooth) => ["teeth", toothKey(tooth), "result"]);
    if (!(await validate([...RECEIVE_FIELDS, ...toothFields, ...(returning ? RETURN_FIELDS : [])]))) return;
    if (returning && pictures.pictures.length === 0) {
      toast.error(t("Labo:Check:PicturesRequired"));
      return;
    }
    const values: LaboCheckValues = form.getFieldsValue(true);
    try {
      await receive.mutateAsync(receiveBody(values));
      await check.mutateAsync({
        id: order.id,
        conclusion,
        teeth: teeth.map((tooth) => {
          const pick = values.teeth?.[toothKey(tooth)];
          const result = pick?.result ?? LABO_TOOTH_RESULT.Passed;
          return { toothNumber: tooth, result, note: result === LABO_TOOTH_RESULT.Failed ? pick?.note : undefined };
        }),
        description: returning ? values.description : undefined,
        returnedAt: returning ? values.returnedAt?.toISOString() : undefined,
        redeliveryDueAt: returning ? values.redeliveryDueAt?.toISOString() : undefined,
        pictures: returning ? pictures.pictures : [],
      });
      toast.success(t(returning ? "Labo:Check:Returned" : "Labo:Check:Passed"));
      pictures.reset();
      onDone();
    } catch {
      // The global MutationCache toasts the server's message; the tab stays for the fix.
    }
  };

  return {
    form,
    editable: ability.canUpdate && isCheckOpen(order),
    busy: receive.isPending || check.isPending,
    roundNo: receiveRoundNo(order),
    returnNo: order.returnCount + 1,
    receiverName: round?.receiverName ?? userName,
    teeth,
    verdict,
    pictures,
    saveReceive,
    conclude,
  };
}
