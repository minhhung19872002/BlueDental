import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useBranchFilter, useCurrentBranchId } from "@/lib/clinicBranch";
import type { PagedResult } from "@/types";

/**
 * Mẫu phiếu bổ sung (F-93, the hybrid of labo.md §11.1): a branch's own lists
 * of extra fields that the Phiếu yêu cầu can take on top of its fixed core.
 * Mirrors BlueDental.Labo.LaboFormTemplateDto.
 */

const BASE = "/v1/app/labo-form-templates";

/** Mirrors BlueDental.Labo.LaboFormFieldType. */
export const LABO_FIELD_TYPE = {
  Text: 1,
  LongText: 2,
  Number: 3,
  Date: 4,
  Select: 5,
  MultiSelect: 6,
  YesNo: 7,
} as const;
export type LaboFieldType = (typeof LABO_FIELD_TYPE)[keyof typeof LABO_FIELD_TYPE];

export const LABO_FIELD_TYPES: readonly LaboFieldType[] = Object.values(LABO_FIELD_TYPE);

export const isChoiceType = (type: LaboFieldType): boolean =>
  type === LABO_FIELD_TYPE.Select || type === LABO_FIELD_TYPE.MultiSelect;

export interface LaboFormFieldDto {
  /** Stable across edits; a new field sends none and the server gives it one. */
  key?: string | null;
  label: string;
  type: LaboFieldType;
  required: boolean;
  options: string[];
  /** The custom section it sits in (F-94). */
  blockKey?: string | null;
}

/** Mirrors BlueDental.Labo.LaboFormBlockKind: the slip's own blocks, and the template's sections. */
export const LABO_BLOCK_KIND = {
  Custom: 0,
  Info: 1,
  Restoration: 2,
  Shade: 3,
  Teeth: 4,
  FinishLine: 5,
  Notes: 6,
  /**
   * Loại phục hình's cards (R-1202). Gone since R-1216 made it one Dịch vụ →
   * Vật liệu picker: only a layout saved in between holds them, and every
   * reader folds them back into Restoration (withoutRestorationCards).
   */
  AllCeramic: 7,
  Alloy: 8,
  OtherOnImplant: 9,
} as const;
export type LaboBlockKind = (typeof LABO_BLOCK_KIND)[keyof typeof LABO_BLOCK_KIND];

type LaboCardKind =
  | typeof LABO_BLOCK_KIND.AllCeramic
  | typeof LABO_BLOCK_KIND.Alloy
  | typeof LABO_BLOCK_KIND.OtherOnImplant;

/** The system blocks a slip is made of; each comes once in every layout. */
export type LaboSystemBlockKind = Exclude<LaboBlockKind, typeof LABO_BLOCK_KIND.Custom | LaboCardKind>;

/** Thông tin phiếu and Chỉ định hold what every order needs, so they always show. */
export const isLockedBlock = (kind: LaboBlockKind): boolean =>
  kind === LABO_BLOCK_KIND.Info || kind === LABO_BLOCK_KIND.Teeth;

/** One block of a Mẫu phiếu's layout (F-94). Span is the width on the slip's three-column grid. */
export interface LaboFormBlockDto {
  key?: string | null;
  kind: LaboBlockKind;
  /** None keeps a system block's own name; a custom section always has one. */
  title?: string | null;
  visible: boolean;
  span: number;
}

export interface LaboFormTemplateDto {
  id: string;
  clinicBranchId: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  version: number;
  fields: LaboFormFieldDto[];
  /** The slip's layout in order; a template saved before F-94 reads as the default one. */
  blocks: LaboFormBlockDto[];
  creationTime: string;
  lastModificationTime?: string | null;
}

export interface LaboFormTemplateInput {
  name: string;
  description?: string;
  isActive: boolean;
  fields: LaboFormFieldDto[];
  blocks?: LaboFormBlockDto[];
}

/** Thông tin bổ sung as an order keeps it: the template's fields copied, with the answers. */
export interface LaboExtraFormEntryDto {
  key: string;
  label: string;
  type: LaboFieldType;
  required: boolean;
  options: string[];
  values: string[];
  /** The section of the copied layout it sits in; none on a copy made before F-94. */
  blockKey?: string | null;
}

export interface LaboExtraFormDto {
  templateId: string;
  templateName: string;
  version: number;
  entries: LaboExtraFormEntryDto[];
  /** The layout as copied (F-94); empty on a copy made before layouts, which keeps the fixed slip. */
  blocks?: LaboFormBlockDto[];
}

export interface LaboFormTemplateQuery {
  filter?: string;
  skipCount: number;
  maxResultCount: number;
}

export const laboFormTemplateKeys = {
  all: ["labo-form-templates"] as const,
  list: (branchId: string | undefined, query: LaboFormTemplateQuery) =>
    [
      ...laboFormTemplateKeys.all,
      "list",
      branchId ?? "all",
      query.filter?.trim() ?? "",
      query.skipCount,
      query.maxResultCount,
    ] as const,
  active: (branchId: string) => [...laboFormTemplateKeys.all, "active", branchId] as const,
};

/** The Mẫu phiếu tab: searched and paged on the server. */
export function useLaboFormTemplateList(query: LaboFormTemplateQuery) {
  const clinicBranchId = useBranchFilter();
  return useQuery({
    queryKey: laboFormTemplateKeys.list(clinicBranchId, query),
    queryFn: () =>
      api
        .get<PagedResult<LaboFormTemplateDto>>(BASE, {
          params: {
            ClinicBranchId: clinicBranchId,
            Filter: query.filter?.trim() || undefined,
            SkipCount: query.skipCount,
            MaxResultCount: query.maxResultCount,
          },
        })
        .then((r) => r.data),
    placeholderData: (previous) => previous,
  });
}

/** The Đang dùng templates of the order's branch, for the slip's Mẫu bổ sung picker. */
export function useActiveLaboFormTemplates(clinicBranchId: string, enabled: boolean) {
  return useQuery({
    queryKey: laboFormTemplateKeys.active(clinicBranchId),
    queryFn: () =>
      api
        .get<PagedResult<LaboFormTemplateDto>>(BASE, {
          params: { ClinicBranchId: clinicBranchId, IsActive: true, MaxResultCount: 200 },
        })
        .then((r) => r.data.items),
    enabled: enabled && Boolean(clinicBranchId),
  });
}

/** Create, edit, Trạng thái and delete; each refreshes every list of templates. */
export function useLaboFormTemplateCommands() {
  const clinicBranchId = useCurrentBranchId();
  const meta = { invalidates: ["laboFormTemplate"] } as const;

  const create = useMutation({
    mutationFn: (input: LaboFormTemplateInput) =>
      api.post<LaboFormTemplateDto>(BASE, { ...input, clinicBranchId }).then((r) => r.data),
    meta,
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: LaboFormTemplateInput }) =>
      api.put<LaboFormTemplateDto>(`${BASE}/${id}`, input).then((r) => r.data),
    meta,
  });

  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put<LaboFormTemplateDto>(`${BASE}/${id}/active`, { isActive }).then((r) => r.data),
    meta,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${BASE}/${id}`).then(() => undefined),
    meta,
  });

  return { create, update, setActive, remove };
}
