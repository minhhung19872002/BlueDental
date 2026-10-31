import { useEffect, useState } from "react";
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
  type LaboOrderToothDto,
} from "@/features/labo/api/laboApi";
import { useCheckLaboOrder, useReceiveLaboOrder } from "@/features/labo/api/laboMutations";
import { useLaboPictureTiles, type LaboPictureTiles } from "../order-dialogs/useLaboPictureTiles";
import type { LaboLiveCheck } from "./laboCheckHistory";
import {
  checkVerdict,
  dueTeeth,
  failedTeeth,
  isCheckOpen,
  latestReturnNote,
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
  returnedAt?: Dayjs;
  redeliveryDueAt?: Dayjs;
}

export interface LaboCheckForm {
  form: FormInstance<LaboCheckValues>;
  editable: boolean;
  /** «Kiểm tra Labo» was pressed: the delivery is in and B. lists the teeth (P3110 REQ-D4). */
  started: boolean;
  busy: boolean;
  roundNo: number;
  receiverName: string;
  /** The teeth B. lists for a result; the passed ones stay passed. */
  teeth: LaboOrderToothDto[];
  picks: LaboToothPicks | undefined;
  verdict: LaboCheckVerdict;
  /** The Lỗi teeth now: what Trả hàng bị lỗi sends back. */
  failed: number[];
  /** Hình ảnh lỗi, one set per tooth. */
  tiles: LaboPictureTiles;
  /** A Lỗi tooth left without Hình ảnh lỗi after a refused Trả hàng bị lỗi (REQ-D6, R-1093). */
  picturesMissing: (tooth: number) => boolean;
  /** The Lỗi groups folded with «Thu gọn». */
  collapsed: ReadonlySet<number>;
  toggleCollapsed: (tooth: number) => void;
  /** The check on screen, for the history's "đang nhập" round. */
  live: LaboLiveCheck | null;
  start: () => Promise<void>;
  conclude: (conclusion: LaboCheckConclusion) => Promise<void>;
}

const RECEIVE_FIELDS = ["receivedAt", "receivedQuantity"];
const RETURN_FIELDS = ["returnedAt", "redeliveryDueAt"];

/**
 * Tab 2 "Nhận hàng & kiểm tra": A. records the delivery, «Kiểm tra Labo»
 * saves it and opens B., where each tooth is Đạt or Lỗi with its own Mô tả
 * gửi Labo and Hình ảnh lỗi (P3110 REQ-D4–D6). A conclusion first saves the
 * delivery again — the server amends an open round, so that is harmless.
 */
export function useLaboCheckForm(order: LaboOrderDto, onDone: () => void): LaboCheckForm {
  const ability = useAbility("treatmentLabo");
  const userName = useAuthStore((s) => s.user?.name) ?? "";
  const receive = useReceiveLaboOrder();
  const check = useCheckLaboOrder();
  const tiles = useLaboPictureTiles();
  const [form] = Form.useForm<LaboCheckValues>();
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(new Set());
  const [picturesChecked, setPicturesChecked] = useState(false);

  const round = openRound(order);
  const teeth = dueTeeth(order);
  const numbers = teeth.map((tooth) => tooth.toothNumber);
  const picks = Form.useWatch("teeth", form);
  const redeliveryDueAt = Form.useWatch("redeliveryDueAt", form);
  const failed = failedTeeth(numbers, picks);

  useEffect(() => {
    form.setFieldsValue({
      receivedAt: round ? dayjs(round.receivedAt) : dayjs(),
      receivedQuantity: round?.receivedQuantity ?? order.quantity,
      returnedAt: dayjs(),
    });
  }, [form, round?.receivedAt, round?.receivedQuantity, order.quantity]);

  // A tooth that went back starts from the note it went back with (REQ-D6).
  // The order is refetched often; only a new round prefills again.
  const roundNo = round?.roundNo;
  useEffect(() => {
    if (roundNo === undefined) return;
    for (const tooth of order.teeth) {
      const note = latestReturnNote(order, tooth.toothNumber);
      const path: ["teeth", string, "note"] = ["teeth", toothKey(tooth.toothNumber), "note"];
      if (note && !form.getFieldValue(path)) form.setFieldValue(path, note);
    }
  }, [form, roundNo]);

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
      setCollapsed(new Set());
      form.scrollToField(form.getFieldsError().find((field) => field.errors.length)?.name ?? []);
      return false;
    }
  };

  const start = async () => {
    if (!(await validate(RECEIVE_FIELDS))) return;
    try {
      await receive.mutateAsync(receiveBody(form.getFieldsValue(true)));
      toast.success(t("Labo:Check:Started"));
    } catch {
      // The global MutationCache toasts the server's message.
    }
  };

  const conclude = async (conclusion: LaboCheckConclusion) => {
    const returning = conclusion !== LABO_CHECK_CONCLUSION.Pass;
    const toothFields = numbers.map((tooth) => ["teeth", toothKey(tooth), "result"]);
    const noteFields = failed.map((tooth) => ["teeth", toothKey(tooth), "note"]);
    if (!(await validate([...RECEIVE_FIELDS, ...toothFields, ...(returning ? [...noteFields, ...RETURN_FIELDS] : [])]))) return;
    const toothPictures = returning ? tiles.upload(failed).toothPictures : [];
    // P3110 REQ-D6: every Lỗi tooth carries its own Hình ảnh lỗi.
    const unpictured = returning ? failed.find((tooth) => !toothPictures.some((picture) => picture.tooth === tooth)) : undefined;
    if (unpictured !== undefined) {
      setPicturesChecked(true);
      setCollapsed(new Set());
      toast.error(t("Labo:Check:PicturesRequired", unpictured));
      return;
    }
    const values: LaboCheckValues = form.getFieldsValue(true);
    try {
      await receive.mutateAsync(receiveBody(values));
      await check.mutateAsync({
        id: order.id,
        conclusion,
        teeth: numbers.map((tooth) => {
          const pick = values.teeth?.[toothKey(tooth)];
          const result = pick?.result ?? LABO_TOOTH_RESULT.Passed;
          return { toothNumber: tooth, result, note: result === LABO_TOOTH_RESULT.Failed ? pick?.note?.trim() : undefined };
        }),
        // Days only (R-1092): the server's "after" check then compares days too.
        returnedAt: returning ? values.returnedAt?.startOf("day").toISOString() : undefined,
        redeliveryDueAt: returning ? values.redeliveryDueAt?.startOf("day").toISOString() : undefined,
        toothPictures,
      });
      toast.success(t(returning ? "Labo:Check:Returned" : "Labo:Check:Passed"));
      tiles.reset([]);
      setPicturesChecked(false);
      onDone();
    } catch {
      // The global MutationCache toasts the server's message; the tab stays for the fix.
    }
  };

  const toggleCollapsed = (tooth: number) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(tooth)) next.add(tooth);
      return next;
    });

  return {
    form,
    editable: ability.canUpdate && isCheckOpen(order),
    started: round !== undefined,
    busy: receive.isPending || check.isPending,
    roundNo: receiveRoundNo(order),
    receiverName: round?.receiverName ?? userName,
    teeth,
    picks,
    verdict: checkVerdict(numbers, picks),
    failed,
    tiles,
    picturesMissing: (tooth) => picturesChecked && tiles.tilesOf(tooth).length === 0,
    collapsed,
    toggleCollapsed,
    live: round ? { teeth: numbers, picks, redeliveryDueAt: redeliveryDueAt?.toISOString() } : null,
    start,
    conclude,
  };
}
