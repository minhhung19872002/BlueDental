import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

/**
 * The lists behind the Labo "Đặt mới" form.
 *
 * They live here rather than in `features/labo/api` because the form is opened
 * from a treatment row in `features/patient-management`, and feature folders do
 * not import one another — the same reason `usePaymentAccountOptions` sits
 * beside this file. The Labo screens keep their own richer hooks.
 */

/** Taxonomy groups the Labo form picks from. */
export const LABO_TAXONOMY = {
  supplier: "labo_supplier",
  bite: "labo_bite",
  finishLine: "labo_finish_line",
  rhythm: "labo_rhythm",
  /** The groups of Vật liệu & loại phục hình; the reference calls it "Lựa chọn dịch vụ". */
  material: "labo_material",
} as const;

/**
 * The three fixed groups of Vật liệu & loại phục hình (BA P1011), by the code
 * the server seeds them with, in their order — BlueDental.Labo.LaboMaterialGroups.
 * Toàn sứ and Hợp kim give every material a plain and a "Trên implant" column;
 * Phục hình khác trên implant has one column, always on an implant.
 */
export const LABO_MATERIAL_GROUP = {
  AllCeramic: "TOAN_SU",
  Alloy: "HOP_KIM",
  OtherOnImplant: "KHAC_TREN_IMPLANT",
} as const;

export type LaboMaterialGroupCode = (typeof LABO_MATERIAL_GROUP)[keyof typeof LABO_MATERIAL_GROUP];

const FIXED_GROUP_ORDER: readonly LaboMaterialGroupCode[] = Object.values(LABO_MATERIAL_GROUP);

/** A taxonomy row's fixed-group code; undefined for a group made before P1011. */
export function laboMaterialGroupCode(row: {
  subGroup?: string | null;
  isSystem?: boolean;
}): LaboMaterialGroupCode | undefined {
  if (!row.isSystem) return undefined;
  return FIXED_GROUP_ORDER.find((code) => code === row.subGroup);
}

/** Where a fixed group sits among the three: the panel and the slip list them in this order. */
export const laboMaterialGroupRank = (code: LaboMaterialGroupCode): number =>
  FIXED_GROUP_ORDER.indexOf(code);

export interface PickerOption {
  value: string;
  label: string;
}

interface NamedRow {
  id: string;
  name: string;
}

function toOptions(rows: NamedRow[]): PickerOption[] {
  return rows.map((row) => ({ value: row.id, label: row.name }));
}

/** The roots of the three picker lists below. */
export const laboPickerKeys = {
  taxonomies: ["labo-taxonomy-options"] as const,
  suppliers: ["labo-supplier-options"] as const,
  materials: ["labo-material-options"] as const,
};

/** Every row of one labo taxonomy group, unpaged. */
export function useLaboTaxonomyOptions(group: string, clinicBranchId: string, enabled = true) {
  return useQuery<PickerOption[]>({
    queryKey: [...laboPickerKeys.taxonomies, group, clinicBranchId],
    queryFn: () =>
      api
        .get<PagedResult<NamedRow>>("/v1/app/taxonomies", {
          params: { ClinicBranchId: clinicBranchId, Group: group, MaxResultCount: 200 },
        })
        .then((r) => toOptions(r.data.items)),
    enabled: enabled && Boolean(group) && Boolean(clinicBranchId),
    staleTime: 5 * 60_000,
  });
}

/** Nhà cung cấp — its own table, not a taxonomy. */
export function useLaboSupplierOptions(clinicBranchId: string, enabled = true) {
  return useQuery<PickerOption[]>({
    queryKey: [...laboPickerKeys.suppliers, clinicBranchId],
    queryFn: () =>
      api
        .get<PagedResult<NamedRow>>("/v1/app/labo-suppliers", {
          params: { ClinicBranchId: clinicBranchId, MaxResultCount: 200 },
        })
        .then((r) => toOptions(r.data.items)),
    enabled: enabled && Boolean(clinicBranchId),
    staleTime: 5 * 60_000,
  });
}

/** A Dịch vụ Labo with what the Chọn dịch vụ Labo popup groups and prints it by (P3110 m158). */
export interface LaboServiceOption extends PickerOption {
  /** The catalog's sub-group: the popup's section and group chip. */
  group?: string;
  /** The line under the name. */
  description?: string;
  /** One of the three fixed groups (P1011); undefined for an older group. */
  code?: LaboMaterialGroupCode;
}

interface ServiceRow extends NamedRow {
  subGroup?: string | null;
  isSystem?: boolean;
  description?: string | null;
}

/** Dịch vụ Labo — the Lựa chọn dịch vụ groups, with their sub-group and description. */
export function useLaboServiceOptions(clinicBranchId: string, enabled = true) {
  return useQuery<LaboServiceOption[]>({
    queryKey: [...laboPickerKeys.taxonomies, LABO_TAXONOMY.material, "rich", clinicBranchId],
    queryFn: () =>
      api
        .get<PagedResult<ServiceRow>>("/v1/app/taxonomies", {
          params: { ClinicBranchId: clinicBranchId, Group: LABO_TAXONOMY.material, MaxResultCount: 200 },
        })
        .then((r) =>
          r.data.items.map((row) => {
            const code = laboMaterialGroupCode(row);
            return {
              value: row.id,
              label: row.name,
              // A fixed group's sub-group is its code, not a section of the popup.
              group: code ? undefined : row.subGroup?.trim() || undefined,
              description: row.description?.trim() || undefined,
              code,
            };
          }),
        ),
    enabled: enabled && Boolean(clinicBranchId),
    staleTime: 5 * 60_000,
  });
}

/** A Vật liệu and the Dịch vụ Labo it belongs to. */
export interface LaboMaterialOption extends PickerOption {
  serviceId: string;
  /** "Có lựa chọn Trên implant" (F-91); since P1011 only read for groups made before it. */
  allowOnImplant: boolean;
  isActive: boolean;
}

interface MaterialRow extends NamedRow {
  taxonomyId: string;
  allowOnImplant?: boolean;
  isActive?: boolean;
}

/**
 * Every Vật liệu of the branch at once: the service popup counts them per
 * service and searches their names, and the material row filters them by the
 * service picked.
 */
export function useLaboMaterialOptions(clinicBranchId: string, enabled = true) {
  return useQuery<LaboMaterialOption[]>({
    queryKey: [...laboPickerKeys.materials, clinicBranchId],
    queryFn: () =>
      api
        .get<PagedResult<MaterialRow>>("/v1/app/labo-materials", {
          params: { ClinicBranchId: clinicBranchId, MaxResultCount: 1000 },
        })
        .then((r) =>
          r.data.items.map((row) => ({
            value: row.id,
            label: row.name,
            serviceId: row.taxonomyId,
            allowOnImplant: row.allowOnImplant ?? false,
            isActive: row.isActive ?? true,
          })),
        ),
    enabled: enabled && Boolean(clinicBranchId),
    staleTime: 5 * 60_000,
  });
}

/** A Đường hoàn tất with the description the Phiếu yêu cầu shows on hover (F-91). */
export interface LaboFinishLineOption extends PickerOption {
  description?: string;
}

/** Đường hoàn tất — the labo_finish_line taxonomy with each row's description. */
export function useLaboFinishLineOptions(clinicBranchId: string, enabled = true) {
  return useQuery<LaboFinishLineOption[]>({
    queryKey: [...laboPickerKeys.taxonomies, LABO_TAXONOMY.finishLine, "rich", clinicBranchId],
    queryFn: () =>
      api
        .get<PagedResult<ServiceRow>>("/v1/app/taxonomies", {
          params: { ClinicBranchId: clinicBranchId, Group: LABO_TAXONOMY.finishLine, MaxResultCount: 200 },
        })
        .then((r) =>
          r.data.items.map((row) => ({
            value: row.id,
            label: row.name,
            description: row.description?.trim() || undefined,
          })),
        ),
    enabled: enabled && Boolean(clinicBranchId),
    staleTime: 5 * 60_000,
  });
}

/** Số phiếu Labo the next order would take. */
export function useNextLaboCode(enabled: boolean) {
  return useQuery<string>({
    queryKey: ["labo-next-code"],
    queryFn: () => api.get<string>("/v1/app/labo-orders/next-code").then((r) => r.data),
    enabled,
    // A code is claimed by whoever saves first, so never serve a cached one.
    staleTime: 0,
    gcTime: 0,
  });
}

