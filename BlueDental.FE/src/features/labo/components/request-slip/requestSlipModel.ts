import dayjs, { type Dayjs } from "dayjs";
import {
  LABO_CASE_TYPE,
  type LaboCaseType,
  type LaboOrderDto,
  type LaboShadeZonesDto,
} from "@/features/labo/api/laboApi";
import { extraBody, extraFromOrder, extraMissing, type ExtraFormValues } from "./extraFormModel";

/** The six cells of Màu răng, in the order the 2×3 map lays them out (Gần then Xa, Cổ → Rìa cắn). */
export const SHADE_ZONES = [
  "cervicalMesial",
  "cervicalDistal",
  "bodyMesial",
  "bodyDistal",
  "incisalMesial",
  "incisalDistal",
] as const satisfies readonly (keyof LaboShadeZonesDto)[];

export type ShadeZone = (typeof SHADE_ZONES)[number];
export type ShadeValues = Record<ShadeZone, string>;

/** One ticked Loại phục hình: the material, and whether it is the "Trên implant" column. */
export interface RestorationPick {
  materialId: string;
  onImplant: boolean;
}

export interface RequestSlipValues {
  labSlipNo: string;
  caseType: LaboCaseType;
  dentistId: string | undefined;
  sentDate: Dayjs | null;
  dueDate: Dayjs | null;
  /** FDI, ascending. */
  teeth: number[];
  /** In the order they were ticked: the summary names the first. */
  restorations: RestorationPick[];
  shade: ShadeValues;
  finishLineIds: string[];
  notes: string;
  /** Thông tin bổ sung (F-93); null while no Mẫu bổ sung is picked. */
  extra: ExtraFormValues | null;
}

/** What a new order starts from: the known teeth and doctor of the công đoạn it was raised on. */
export interface RequestSlipStart {
  teeth: number[];
  dentistId?: string;
}

/** A new order from a công đoạn or plan line starts on its chart teeth and doctor; a jaw-wide pick names no tooth. */
export function requestSlipStart(
  source: { teeth: string[]; dentistId?: string } | null | undefined,
): RequestSlipStart {
  const teeth = (source?.teeth ?? []).map(Number).filter((fdi) => CHART_POSITION.has(fdi));
  return { teeth: [...new Set(teeth)], dentistId: source?.dentistId };
}

/** Builds a value for every zone without a cast. */
function mapZones<T>(pick: (zone: ShadeZone) => T): Record<ShadeZone, T> {
  return {
    cervicalMesial: pick("cervicalMesial"),
    cervicalDistal: pick("cervicalDistal"),
    bodyMesial: pick("bodyMesial"),
    bodyDistal: pick("bodyDistal"),
    incisalMesial: pick("incisalMesial"),
    incisalDistal: pick("incisalDistal"),
  };
}

const EMPTY_SHADE: ShadeValues = mapZones(() => "");

/**
 * The form's first values. A saved Phiếu yêu cầu reads its spec off the first
 * tooth — every tooth carries the same one; an old draft brings only what the
 * new form shares with it (doctor, teeth, dates, note) and is filled in again.
 */
export function requestSlipSeed(
  order: LaboOrderDto | undefined,
  start: RequestSlipStart,
): RequestSlipValues {
  if (!order) {
    return {
      labSlipNo: "",
      caseType: LABO_CASE_TYPE.New,
      dentistId: start.dentistId,
      sentDate: dayjs(),
      dueDate: null,
      teeth: [...start.teeth].sort((a, b) => a - b),
      restorations: [],
      shade: { ...EMPTY_SHADE },
      finishLineIds: [],
      notes: "",
      extra: null,
    };
  }
  const first = order.teeth[0];
  const zones = first?.shadeZones ?? {};
  return {
    labSlipNo: order.labSlipNo ?? "",
    caseType: order.caseType ?? LABO_CASE_TYPE.New,
    dentistId: order.dentistId,
    sentDate: order.sentAt ? dayjs(order.sentAt) : dayjs(),
    dueDate: order.dueAt ? dayjs(order.dueAt) : null,
    teeth: order.teeth.map((tooth) => tooth.toothNumber).sort((a, b) => a - b),
    restorations: (first?.restorations ?? []).map(({ materialId, onImplant }) => ({
      materialId,
      onImplant,
    })),
    shade: mapZones((zone) => zones[zone] ?? ""),
    finishLineIds: first?.finishLineIds ?? [],
    notes: order.notes ?? "",
    extra: extraFromOrder(order.extraForm),
  };
}

const range = (from: number, to: number) =>
  Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => (from < to ? from + i : from - i));

/** The Chỉ định chart as the Labo slip draws it: 18→11 | 21→28 over 48→41 | 31→38. */
export const CHART_ROWS = [
  [range(18, 11), range(21, 28)],
  [range(48, 41), range(31, 38)],
] as const;

/** The baby teeth the same way: 55→51 | 61→65 over 85→81 | 71→75. */
export const DECIDUOUS_ROWS = [
  [range(55, 51), range(61, 65)],
  [range(85, 81), range(71, 75)],
] as const;

const CHART_POSITION = new Map(
  [...CHART_ROWS, ...DECIDUOUS_ROWS].flat(2).map((fdi, index) => [fdi, index]),
);

/** The teeth in the chart's reading order (R18, R17 … R38, then the baby teeth), as the slip lists them. */
export const chartOrder = (teeth: number[]): number[] =>
  [...teeth].sort((a, b) => (CHART_POSITION.get(a) ?? 99) - (CHART_POSITION.get(b) ?? 99));

export const hasShade = (shade: ShadeValues): boolean =>
  SHADE_ZONES.some((zone) => shade[zone].trim() !== "");

export const sameRestoration = (a: RestorationPick, b: RestorationPick): boolean =>
  a.materialId === b.materialId && a.onImplant === b.onImplant;

/** The i18n keys of what «Tạo phiếu Labo» still waits for, in the mock's order. */
export function requestSlipErrors(values: RequestSlipValues): string[] {
  const errors: string[] = [];
  if (!values.labSlipNo.trim()) errors.push("Labo:Slip:Err:SlipNo");
  if (!values.dentistId) errors.push("Labo:Slip:Err:Dentist");
  if (isDueBad(values)) errors.push("Labo:Slip:Err:Due");
  if (values.teeth.length === 0) errors.push("Labo:Slip:Err:Teeth");
  if (values.restorations.length === 0) errors.push("Labo:Slip:Err:Restoration");
  if (!hasShade(values.shade)) errors.push("Labo:Slip:Err:Shade");
  if (extraMissing(values.extra)) errors.push("Labo:Slip:Err:Extra");
  return errors;
}

/** Ngày nhận dự kiến missing, or not after Ngày gửi. */
export function isDueBad({
  sentDate,
  dueDate,
}: Pick<RequestSlipValues, "sentDate" | "dueDate">): boolean {
  if (!dueDate) return true;
  return sentDate !== null && !dueDate.isAfter(sentDate, "day");
}

const dayOf = (date: Dayjs | null) => date?.startOf("day").toISOString();
const blankToUndefined = (value: string) => value.trim() || undefined;

/** The values as the mutation sends them; empty zones stay out of the request. */
export function requestSlipBody(values: RequestSlipValues) {
  return {
    labSlipNo: blankToUndefined(values.labSlipNo),
    caseType: values.caseType,
    dentistId: values.dentistId,
    teeth: values.teeth,
    quantity: values.teeth.length,
    notes: blankToUndefined(values.notes),
    sentAt: dayOf(values.sentDate),
    dueAt: dayOf(values.dueDate),
    shadeZones: mapZones((zone) => blankToUndefined(values.shade[zone])),
    finishLineIds: values.finishLineIds,
    restorations: values.restorations,
    ...extraBody(values.extra),
  };
}
