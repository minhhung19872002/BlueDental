import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { WarrantyCardSide } from "@/components/WarrantyCardPhotos";
import { api } from "@/lib/axios";
import {
  LABO_ORDERS_URL,
  type LABO_ORDER_LAYOUT,
  type LaboCaseType,
  type LaboShadeZonesDto,
  type LaboCheckConclusion,
  type LaboOrderDto,
  type LaboSpecMode,
  type LaboToothResult,
} from "./laboApi";

/** The Đặt hàng tab. Mirrors BlueDental.Labo.SaveLaboOrderDto. */
export interface LaboOrderFields {
  dentistId?: string;
  supplierId?: string;
  materialId?: string;
  /** Khớp cắn — one for the whole order since R-1150. */
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
  /** Thông số từng răng (P3110), one row per tooth, the shared values copied in. */
  toothSpecs: LaboToothSpecInput[];
  /** Thông số răng / Màu răng Chung or Riêng (R-1150). */
  specMode: LaboSpecMode;
  /** Gửi Labo (true) or Lưu nháp (false). */
  submit: boolean;
  /** New Ảnh đính kèm chung; at most five with the ones kept. */
  pictures: File[];
  /** New pictures of the tooth rows: FDI, or 0 for the "Dùng chung" row. */
  toothPictures: LaboToothPicture[];
}

/** One Mặt răng. Mirrors BlueDental.Labo.LaboToothSurfaceDto. */
export interface LaboToothSurfaceInput {
  code: string;
  shade?: string;
  finishLineId?: string;
}

/** One tooth of Thông số từng răng. Mirrors BlueDental.Labo.LaboToothSpecDto. */
export interface LaboToothSpecInput {
  toothNumber: number;
  shade?: string;
  finishLineId?: string;
  rhythmId?: string;
  /** "Riêng theo mặt". */
  shadeBySurface: boolean;
  surfaces: LaboToothSurfaceInput[];
}

export interface LaboToothPicture {
  tooth: number;
  file: File;
}

/**
 * The Phiếu yêu cầu (F-91): one spec for the whole order, which the server
 * copies onto every tooth. No supplier, and no plan link on a new order.
 */
export interface LaboRequestSlipFields {
  layout: typeof LABO_ORDER_LAYOUT.RequestSlip;
  labSlipNo?: string;
  caseType: LaboCaseType;
  dentistId?: string;
  teeth: number[];
  quantity: number;
  notes?: string;
  sentAt?: string;
  dueAt?: string;
  shadeZones: LaboShadeZonesDto;
  finishLineIds: string[];
  restorations: { materialId: string; onImplant: boolean }[];
  /** Thông tin bổ sung (F-93): none sent clears it. */
  extraFormTemplateId?: string;
  extraFormAnswers: { key: string; values: string[] }[];
  /** Only an old draft re-saved on this form sends its links back. */
  treatmentServiceId?: string;
  treatmentStageId?: string;
  submit: boolean;
  pictures: File[];
}

/** Lưu nháp / Tạo phiếu Labo on a new order, or on a Nháp already saved. */
export type SaveLaboOrderInput =
  | {
      id?: undefined;
      patientId: string;
      branchId: string;
      orderCode?: string;
      fields: LaboOrderFields | LaboRequestSlipFields;
    }
  | { id: string; keepImageIds: string[]; fields: LaboOrderFields | LaboRequestSlipFields };

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

/**
 * The order's own values with each spec row under indexed keys, as ABP binds
 * a list of objects — its surfaces one level down: `toothSpecs[0].surfaces[1].code`.
 */
function orderValues({ toothSpecs, ...fields }: Omit<LaboOrderFields, "pictures" | "toothPictures">) {
  const values: Record<string, FormValue> = { ...fields };
  toothSpecs.forEach(({ surfaces, ...spec }, i) => {
    const row = `toothSpecs[${i}]`;
    for (const [key, value] of Object.entries(spec)) values[`${row}.${key}`] = value;
    surfaces.forEach((surface, j) => {
      for (const [key, value] of Object.entries(surface)) values[`${row}.surfaces[${j}].${key}`] = value;
    });
  });
  return values;
}

/** The tooth rows' pictures, each beside the tooth it belongs to in the same order. */
function appendToothPictures(form: FormData, pictures: LaboToothPicture[]): FormData {
  for (const { tooth, file } of pictures) {
    form.append("toothPictures", file);
    form.append("toothPictureTeeth", String(tooth));
  }
  return form;
}

/** The Phiếu yêu cầu's values: the zones and restorations bound as ABP binds nested objects. */
function requestSlipValues({
  shadeZones,
  restorations,
  extraFormAnswers,
  ...fields
}: Omit<LaboRequestSlipFields, "pictures">) {
  const values: Record<string, FormValue> = { ...fields, estimatedCost: 0 };
  for (const [key, value] of Object.entries(shadeZones)) values[`shadeZones.${key}`] = value;
  restorations.forEach((restoration, i) => {
    values[`restorations[${i}].materialId`] = restoration.materialId;
    values[`restorations[${i}].onImplant`] = restoration.onImplant;
  });
  extraFormAnswers.forEach((answer, i) => {
    values[`extraFormAnswers[${i}].key`] = answer.key;
    answer.values.forEach((value, j) => {
      values[`extraFormAnswers[${i}].values[${j}]`] = value;
    });
  });
  return values;
}

function splitFields(fields: LaboOrderFields | LaboRequestSlipFields) {
  if ("layout" in fields) {
    const { pictures, ...rest } = fields;
    return { values: requestSlipValues(rest), pictures, toothPictures: [] };
  }
  const { pictures, toothPictures, ...rest } = fields;
  return { values: orderValues(rest), pictures, toothPictures };
}

function saveRequest(input: SaveLaboOrderInput): Promise<LaboOrderDto> {
  const { values, pictures, toothPictures } = splitFields(input.fields);
  if (input.id === undefined) {
    const { patientId, branchId, orderCode } = input;
    const form = toForm({ ...values, patientId, branchId, orderCode }, pictures);
    return api.post<LaboOrderDto>(LABO_ORDERS_URL, appendToothPictures(form, toothPictures)).then((r) => r.data);
  }
  // A multipart update without keepImageIds drops every picture, so the kept ones are always listed.
  const form = toForm({ ...values, keepImageIds: input.keepImageIds }, pictures);
  return api
    .put<LaboOrderDto>(`${LABO_ORDERS_URL}/${input.id}`, appendToothPictures(form, toothPictures))
    .then((r) => r.data);
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
  /** `faultSurfaces`: Mặt bị lỗi of a Lỗi tooth (R-1151), at least one when the tooth has Mặt răng. */
  teeth: { toothNumber: number; result: LaboToothResult; note?: string; faultSurfaces?: string[] }[];
  conclusion: LaboCheckConclusion;
  returnedAt?: string;
  redeliveryDueAt?: string;
  /** Hình ảnh lỗi of each Lỗi tooth (P3110 REQ-D6); a return needs at least one. */
  toothPictures: LaboToothPicture[];
}

function checkForm(input: CheckLaboOrderInput): FormData {
  const { teeth, toothPictures, conclusion, returnedAt, redeliveryDueAt } = input;
  const values: Record<string, FormValue> = { conclusion, returnedAt, redeliveryDueAt };
  teeth.forEach((tooth, i) => {
    values[`teeth[${i}].toothNumber`] = tooth.toothNumber;
    values[`teeth[${i}].result`] = tooth.result;
    values[`teeth[${i}].note`] = tooth.note;
    (tooth.faultSurfaces ?? []).forEach((code, j) => {
      values[`teeth[${i}].faultSurfaces[${j}]`] = code;
    });
  });
  return appendToothPictures(toForm(values, []), toothPictures);
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

/** An Ảnh thẻ bảo hành (P3110 REQ-E1): one face of a tooth's card. */
export interface LaboWarrantyCardPhoto {
  tooth: number;
  side: WarrantyCardSide;
  file: File;
}

export interface ActivateLaboWarrantyInput {
  id: string;
  cards: LaboWarrantyCardInput[];
  photos: LaboWarrantyCardPhoto[];
}

/** Multipart, so the card photos land with the cards: each beside its tooth and face, in the same order. */
function warrantyForm({ cards, photos }: ActivateLaboWarrantyInput): FormData {
  const values: Record<string, FormValue> = {};
  cards.forEach((card, i) => {
    for (const [key, value] of Object.entries(card)) values[`cards[${i}].${key}`] = value;
  });
  const form = toForm(values);
  for (const { tooth, side, file } of photos) {
    form.append("cardPhotos", file);
    form.append("cardPhotoTeeth", String(tooth));
    form.append("cardPhotoSides", String(side));
  }
  return form;
}

export function useActivateLaboWarranty() {
  return useMutation({
    mutationFn: (input: ActivateLaboWarrantyInput) =>
      api.post<LaboOrderDto>(`${LABO_ORDERS_URL}/${input.id}/warranty`, warrantyForm(input)).then((r) => r.data),
    meta: { invalidates: ["laboOrder"] },
  });
}
