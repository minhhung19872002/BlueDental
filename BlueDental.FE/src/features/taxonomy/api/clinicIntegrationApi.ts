import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";

/**
 * The branch's link to its partner system, as far as Danh mục needs it: the
 * flag that shows "Đồng bộ danh mục dịch vụ", the dialog's service tree and the
 * sync itself. Shapes follow the reference's payloads (docs/clone/api.md §
 * Clinic integration).
 */

export interface ClinicSyncFlagsDto {
  /** `none` when the branch has no connection; otherwise `pending` / `active` / `failed`. */
  status: string;
  invoiceSyncEnabled: boolean;
  serviceCatalogSyncEnabled: boolean;
}

export interface ServiceCatalogSyncItemDto {
  id: string;
  name: string;
  /** Null shows "Chưa có mã"; such a service cannot be picked. */
  code: string | null;
  synced: boolean;
  isDeleted: boolean;
}

export interface ServiceCatalogGroupDto {
  taxonomyId: string;
  name: string;
  totalServices: number;
  syncedServices: number;
  services: ServiceCatalogSyncItemDto[];
}

/** Whole groups as `taxonomyIds`, the picks of a partly-ticked group as `serviceIds`. */
export interface SyncServiceCatalogInput {
  taxonomyIds?: string[];
  serviceIds?: string[];
}

export interface ServiceCatalogSyncNote {
  code: string | null;
  reason: string | null;
  externalId: string;
}

export interface ServiceCatalogSyncResultDto {
  summary: { total: number; sent: number; updated: number; failed: number; skipped: number };
  duplicated: { code: string | null; dentalName: string; systemName: string | null; externalId: string }[];
  warned: ServiceCatalogSyncNote[];
  skipped: ServiceCatalogSyncNote[];
  updated: { code: string | null; externalId: string; relinked: boolean }[];
  batchErrors: { reason: string; message: string | null }[];
}

const base = (branchId: string) => `/v1/app/clinic-integration/sync/${encodeURIComponent(branchId)}`;

const clinicIntegrationApi = {
  flags: (branchId: string, signal?: AbortSignal): Promise<ClinicSyncFlagsDto> =>
    api.get<ClinicSyncFlagsDto>(`${base(branchId)}/flags`, { signal }).then((r) => r.data),

  serviceCatalogGroups: (branchId: string, signal?: AbortSignal): Promise<ServiceCatalogGroupDto[]> =>
    api.get<ServiceCatalogGroupDto[]>(`${base(branchId)}/service-catalog-groups`, { signal }).then((r) => r.data),

  syncServiceCatalog: (branchId: string, input: SyncServiceCatalogInput): Promise<ServiceCatalogSyncResultDto> =>
    api.post<ServiceCatalogSyncResultDto>(`${base(branchId)}/service-catalog`, input).then((r) => r.data),
};

export const clinicIntegrationKeys = {
  all: ["clinic-integration"] as const,
  flags: (branchId: string) => [...clinicIntegrationKeys.all, "flags", branchId] as const,
  serviceCatalogGroups: (branchId: string) =>
    [...clinicIntegrationKeys.all, "service-catalog-groups", branchId] as const,
};

/** Whether this branch may sync its catalog. Off until a connection is active and switched on. */
export function useClinicSyncFlags(branchId: string, enabled = true) {
  return useQuery({
    queryKey: clinicIntegrationKeys.flags(branchId),
    queryFn: ({ signal }) => clinicIntegrationApi.flags(branchId, signal),
    enabled: Boolean(branchId) && enabled,
  });
}

/**
 * The dialog's tree. Loaded when the dialog opens and always fresh, so a
 * service just added or given a code shows up at once.
 */
export function useServiceCatalogGroups(branchId: string, enabled: boolean) {
  return useQuery({
    queryKey: clinicIntegrationKeys.serviceCatalogGroups(branchId),
    queryFn: ({ signal }) => clinicIntegrationApi.serviceCatalogGroups(branchId, signal),
    enabled: Boolean(branchId) && enabled,
    staleTime: 0,
  });
}

export function useSyncServiceCatalog(branchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SyncServiceCatalogInput) => clinicIntegrationApi.syncServiceCatalog(branchId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: clinicIntegrationKeys.serviceCatalogGroups(branchId) }),
  });
}
