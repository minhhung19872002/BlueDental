import { expect, type Page } from "@playwright/test";
import { runId } from "./auth";
import { BRANCH_ONE, call, LABO_ORDERS, type FormValue } from "./laboApi";
import { slipForm, type SlipBody, type SlipOrderView } from "./laboSlipApi";

/**
 * Seeding for the Mẫu phiếu bổ sung specs (F-93): templates through the real
 * /labo-form-templates endpoint, and Phiếu yêu cầu bodies that carry a picked
 * template with its answers the way the slip posts them (multipart,
 * `extraFormAnswers[i].key` / `extraFormAnswers[i].values[j]`).
 */

export const FORM_TEMPLATES = "/api/v1/app/labo-form-templates";

/** LaboFormFieldType on the wire. */
export const FieldType = {
  Text: 1,
  LongText: 2,
  Number: 3,
  Date: 4,
  Select: 5,
  MultiSelect: 6,
  YesNo: 7,
} as const;

export interface FieldInput {
  key?: string;
  label: string;
  type: number;
  required?: boolean;
  options?: string[];
  /** The custom section it sits in (F-94). */
  blockKey?: string;
}

/** LaboFormBlockKind on the wire (F-94). */
export const BlockKind = {
  Custom: 0,
  Info: 1,
  Restoration: 2,
  Shade: 3,
  Teeth: 4,
  FinishLine: 5,
  Notes: 6,
  /**
   * Loại phục hình's cards (R-1202), gone since R-1216: a layout that still
   * sends them is stored with them folded into Restoration.
   */
  AllCeramic: 7,
  Alloy: 8,
  OtherOnImplant: 9,
} as const;

export interface BlockInput {
  key?: string;
  kind: number;
  title?: string;
  visible?: boolean;
  span?: number;
}

export interface BlockView {
  key: string;
  kind: number;
  title: string | null;
  visible: boolean;
  span: number;
}

/**
 * The slip's own blocks as a new template lays them out (R-1216), every one
 * shown: Thông tin phiếu across, then Loại phục hình, Màu răng and Chỉ định
 * side by side, Đường hoàn tất under Loại phục hình — a layout to edit from.
 */
export function systemBlocks(): BlockInput[] {
  return [
    { kind: BlockKind.Info, span: 3 },
    { kind: BlockKind.Restoration, span: 1 },
    { kind: BlockKind.Shade, span: 1 },
    { kind: BlockKind.Teeth, span: 1 },
    { kind: BlockKind.FinishLine, span: 1 },
    { kind: BlockKind.Notes, span: 3 },
  ];
}

export interface TemplateView {
  id: string;
  clinicBranchId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  version: number;
  fields: { key: string; label: string; type: number; required: boolean; options: string[]; blockKey: string | null }[];
  blocks: BlockView[];
}

export interface ExtraEntryView {
  key: string;
  label: string;
  type: number;
  required: boolean;
  options: string[];
  values: string[];
  blockKey: string | null;
}

export interface ExtraOrderView extends SlipOrderView {
  extraForm: {
    templateId: string;
    templateName: string;
    version: number;
    entries: ExtraEntryView[];
    blocks: BlockView[];
  } | null;
}

export interface Answer {
  key: string;
  values: string[];
}

/** Every kind of field once; Mã labo and Hạn bảo hành are Bắt buộc. */
export const ALL_KINDS: FieldInput[] = [
  { label: "Mã labo", type: FieldType.Text, required: true },
  { label: "Ghi chú kỹ thuật", type: FieldType.LongText },
  { label: "Số lượng trụ", type: FieldType.Number },
  { label: "Hạn bảo hành", type: FieldType.Date, required: true },
  { label: "Hãng sứ", type: FieldType.Select, options: ["Cercon", "Emax", "Lava"] },
  { label: "Phụ kiện", type: FieldType.MultiSelect, options: ["Trụ", "Ốc", "Khay"] },
  { label: "Có mẫu hàm", type: FieldType.YesNo },
];

export function templateName(tag: string): string {
  return `Mẫu ${tag} ${runId()}${Math.floor(Math.random() * 1000)}`;
}

export function saveTemplate(
  page: Page,
  body: {
    name?: string;
    description?: string;
    isActive?: boolean;
    fields: FieldInput[];
    blocks?: BlockInput[];
    clinicBranchId?: string;
  },
  options: { id?: string; branchId?: string } = {},
) {
  const branchId = options.branchId ?? BRANCH_ONE;
  return call<TemplateView & { error?: { code?: string } }>(page, options.id ? `${FORM_TEMPLATES}/${options.id}` : FORM_TEMPLATES, {
    method: options.id ? "PUT" : "POST",
    branchId,
    json: { clinicBranchId: branchId, ...body },
  });
}

export async function newTemplate(page: Page, tag: string, fields: FieldInput[] = ALL_KINDS, branchId = BRANCH_ONE) {
  const res = await saveTemplate(page, { name: templateName(tag), fields }, { branchId });
  expect(res.status, res.text).toBe(200);
  return res.body as TemplateView;
}

export async function setActive(page: Page, id: string, isActive: boolean) {
  const res = await call(page, `${FORM_TEMPLATES}/${id}/active`, { method: "PUT", branchId: BRANCH_ONE, json: { isActive } });
  expect(res.status, res.text).toBe(200);
}

export function keyOf(template: TemplateView, label: string): string {
  const field = template.fields.find((f) => f.label === label);
  expect(field, `field ${label}`).toBeTruthy();
  return field!.key;
}

/** The slip's multipart body plus Mẫu bổ sung and its answers. */
export function extraSlipForm(body: SlipBody, templateId: string | undefined, answers: Answer[]): Record<string, FormValue> {
  const form = slipForm(body);
  form.extraFormTemplateId = templateId;
  answers.forEach((answer, i) => {
    form[`extraFormAnswers[${i}].key`] = answer.key;
    answer.values.forEach((value, j) => {
      form[`extraFormAnswers[${i}].values[${j}]`] = value;
    });
  });
  return form;
}

export function saveExtra(page: Page, body: SlipBody, templateId: string | undefined, answers: Answer[], orderId?: string) {
  return call<ExtraOrderView & { error?: { code?: string } }>(page, orderId ? `${LABO_ORDERS}/${orderId}` : LABO_ORDERS, {
    method: orderId ? "PUT" : "POST",
    branchId: BRANCH_ONE,
    form: extraSlipForm(body, templateId, answers),
  });
}

export async function readExtra(page: Page, id: string): Promise<ExtraOrderView> {
  const res = await call<ExtraOrderView>(page, `${LABO_ORDERS}/${id}`, { branchId: BRANCH_ONE });
  expect(res.status, res.text).toBe(200);
  return res.body as ExtraOrderView;
}

export function valuesOf(order: ExtraOrderView, label: string): string[] {
  const entry = order.extraForm?.entries.find((e) => e.label === label);
  expect(entry, `entry ${label}`).toBeTruthy();
  return entry!.values;
}
