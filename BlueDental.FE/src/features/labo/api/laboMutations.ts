import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { LABO_ORDERS_URL, type LaboCheckConclusion, type LaboOrderDto, type LaboToothResult } from "./laboApi";

/** The Đặt hàng tab. Mirrors BlueDental.Labo.SaveLaboOrderDto. */
export interface LaboOrderFields {
  dentistId?: string;
  supplierId?: string;
  materialId?: string;
  biteId?: string;
  finishLineId?: string;
  rhythmId?: string;
  teeth: number[];
  toothShade?: string;
  quantity: number;
  workDescription?: string;
  notes?: string;
  sentAt?: string;
  dueAt?: string;
  estimatedCost: number;
  treatmentServiceId?: string;
  treatmentStageId?: string;
  /** Tạo phiếu Labo (true) or Lưu nháp (false). */
  submit: boolean;
  /** New Hình ảnh gửi Labo; at most five with the ones kept. */
  pictures: File[];
}

/** Lưu nháp / Tạo phiếu Labo on a new order, or on a Nháp already saved. */
export type SaveLaboOrderInput =
  | { id?: undefined; patientId: string; branchId: string; orderCode?: string; fields: LaboOrderFields }
  | { id: string; keepImageIds: string[]; fields: LaboOrderFields };

type FormValue = string | number | boolean | undefined | null | readonly (string | number)[];

/** Multipart: an array repeats its key, an unset field stays out so the server keeps its default. */
function toForm(values: Record<string, FormValue>, pictures: File[] = []): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;
    for (const one of Array.isArray(value) ? value : [value]) form.append(key, String(one));
  }
  for (const file of pictures) form.append("pictures", file);
  return form;
}

function saveRequest(input: SaveLaboOrderInput): Promise<LaboOrderDto> {
  const { pictures, ...fields } = input.fields;
  if (input.id === undefined) {
    const { patientId, branchId, orderCode } = input;
    const form = toForm({ ...fields, patientId, branchId, orderCode }, pictures);
    return api.post<LaboOrderDto>(LABO_ORDERS_URL, form).then((r) => r.data);
  }
  // A multipart update without keepImageIds drops every picture, so the kept ones are always listed.
  const form = toForm({ ...fields, keepImageIds: input.keepImageIds }, pictures);
  return api.put<LaboOrderDto>(`${LABO_ORDERS_URL}/${input.id}`, form).then((r) => r.data);
}

export function useSaveLaboOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveRequest,
    meta: { invalidates: ["laboOrder"] },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["labo-next-code"] });
    },
  });
}

/** Hủy phiếu → Đã hủy; the row stays in the lists. */
export function useCancelLaboOrder() {
  return useMutation({
    mutationFn: (id: string) => api.post<LaboOrderDto>(`${LABO_ORDERS_URL}/${id}/cancel`).then((r) => r.data),
    meta: { invalidates: ["laboOrder"] },
  });
}

/** Only a Nháp can be deleted. */
export function useDeleteLaboOrder() {
  return useMutation({
    mutationFn: (id: string) => api.delete(`${LABO_ORDERS_URL}/${id}`).then(() => undefined),
    meta: { invalidates: ["laboOrder"] },
  });
}

/** A. Nhận hàng · lần N. Mirrors BlueDental.Labo.ReceiveLaboOrderDto. */
export interface ReceiveLaboOrderInput {
  id: string;
  receivedAt: string;
  receivedQuantity: number;
}

export function useReceiveLaboOrder() {
  return useMutation({
    mutationFn: ({ id, ...body }: ReceiveLaboOrderInput) =>
      api.post<LaboOrderDto>(`${LABO_ORDERS_URL}/${id}/receive`, body).then((r) => r.data),
    meta: { invalidates: ["laboOrder"] },
  });
}

/** B. Kiểm tra từng răng + C. Kết luận. Mirrors BlueDental.Labo.CheckLaboOrderDto. */
export interface CheckLaboOrderInput {
  id: string;
  teeth: { toothNumber: number; result: LaboToothResult; note?: string }[];
  conclusion: LaboCheckConclusion;
  description?: string;
  returnedAt?: string;
  redeliveryDueAt?: string;
  /** Ảnh kiểm tra — required when a tooth is Lỗi. */
  pictures: File[];
}

function checkForm(input: CheckLaboOrderInput): FormData {
  const { teeth, pictures, conclusion, description, returnedAt, redeliveryDueAt } = input;
  const values: Record<string, FormValue> = { conclusion, description, returnedAt, redeliveryDueAt };
  teeth.forEach((tooth, i) => {
    values[`teeth[${i}].toothNumber`] = tooth.toothNumber;
    values[`teeth[${i}].result`] = tooth.result;
    values[`teeth[${i}].note`] = tooth.note;
  });
  return toForm(values, pictures);
}

export function useCheckLaboOrder() {
  return useMutation({
    mutationFn: (input: CheckLaboOrderInput) =>
      api.post<LaboOrderDto>(`${LABO_ORDERS_URL}/${input.id}/check`, checkForm(input)).then((r) => r.data),
    meta: { invalidates: ["laboOrder"] },
  });
}

/** One card of Kích hoạt bảo hành. Mirrors BlueDental.Labo.LaboWarrantyCardDto. */
export interface LaboWarrantyCardInput {
  toothNumber: number;
  /** `YYYY-MM-DD`. */
  startDate: string;
  months: number;
  manufacturerSerial?: string;
  conditions?: string;
}

export function useActivateLaboWarranty() {
  return useMutation({
    mutationFn: ({ id, cards }: { id: string; cards: LaboWarrantyCardInput[] }) =>
      api.post<LaboOrderDto>(`${LABO_ORDERS_URL}/${id}/warranty`, { cards }).then((r) => r.data),
    meta: { invalidates: ["laboOrder"] },
  });
}
