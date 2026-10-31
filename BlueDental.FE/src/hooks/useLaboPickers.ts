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
  /** The groups of Dịch vụ - vật liệu; the reference calls it "Lựa chọn dịch vụ". */
  material: "labo_material",
} as const;

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
}

interface ServiceRow extends NamedRow {
  subGroup?: string | null;
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
          r.data.items.map((row) => ({
            value: row.id,
            label: row.name,
            group: row.subGroup?.trim() || undefined,
            description: row.description?.trim() || undefined,
          })),
        ),
    enabled: enabled && Boolean(clinicBranchId),
    staleTime: 5 * 60_000,
  });
}

/** A Vật liệu and the Dịch vụ Labo it belongs to. */
export interface LaboMaterialOption extends PickerOption {
  serviceId: string;
}

interface MaterialRow extends NamedRow {
  taxonomyId: string;
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
        .then((r) => r.data.items.map((row) => ({ value: row.id, label: row.name, serviceId: row.taxonomyId }))),
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

