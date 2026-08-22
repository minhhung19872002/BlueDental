import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

/**
 * Taxonomy group slugs, matching BlueDental.Catalogs.TaxonomyGroups — which in
 * turn mirrors the reference's own `group` query values.
 */
export const TAXONOMY_GROUP = {
  CareService: "care_service",
  Diagnosis: "diagnosis",
  MedicationType: "medication_type",
  ConsultingData: "consulting_data",
  Source: "source",
  DiseaseHistory: "disease_history",
  PrescriptionTemplate: "prescription_template",
  MedicalRecordTemplate: "medical_record_template",
  Occupation: "occupation",
  Supplies: "supplies",
} as const;

export type TaxonomyGroup = (typeof TAXONOMY_GROUP)[keyof typeof TAXONOMY_GROUP];

export interface TaxonomyDto {
  id: string;
  clinicBranchId: string;
  group: string;
  name: string;
  alias: string | null;
  color: string | null;
  description: string | null;
  subGroup: string | null;
  isSystem: boolean;
  sortOrder: number;
  isPriced: boolean;
  isTemplated: boolean;
  itemCount: number;
}

export interface CatalogEntryDto {
  id: string;
  clinicBranchId: string;
  taxonomyId: string;
  group: string;
  name: string;
  code: string | null;
  description: string | null;
  price: number | null;
  content: string | null;
  isImageRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  taxonomyName: string | null;
  lastModificationTime: string | null;
  creationTime: string;
}

export interface CreateTaxonomyInput {
  clinicBranchId: string;
  group: string;
  name: string;
  alias?: string;
  color?: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateTaxonomyInput {
  name: string;
  alias?: string;
  color?: string;
  description?: string;
  sortOrder: number;
}

export interface CreateCatalogEntryInput {
  clinicBranchId: string;
  taxonomyId: string;
  name: string;
  code?: string;
  price?: number | null;
  content?: string | null;
  description?: string;
  isImageRequired?: boolean;
  sortOrder?: number;
}

export interface UpdateCatalogEntryInput {
  taxonomyId: string;
  name: string;
  code?: string;
  price?: number | null;
  content?: string | null;
  description?: string;
  isImageRequired: boolean;
  isActive: boolean;
  sortOrder: number;
}

const taxonomyApi = {
  groups: (params: {
    clinicBranchId: string;
    group: string;
    includeCount?: boolean;
    maxResultCount?: number;
  }): Promise<PagedResult<TaxonomyDto>> =>
    api.get<PagedResult<TaxonomyDto>>("/v1/app/taxonomies", { params }).then((r) => r.data),

  createGroup: (input: CreateTaxonomyInput): Promise<TaxonomyDto> =>
    api.post<TaxonomyDto>("/v1/app/taxonomies", input).then((r) => r.data),

  updateGroup: (id: string, input: UpdateTaxonomyInput): Promise<TaxonomyDto> =>
    api.put<TaxonomyDto>(`/v1/app/taxonomies/${id}`, input).then((r) => r.data),

  deleteGroup: (id: string): Promise<void> =>
    api.delete(`/v1/app/taxonomies/${id}`).then(() => undefined),

  entries: (params: {
    clinicBranchId: string;
    group?: string;
    taxonomyId?: string;
    filter?: string;
    maxResultCount?: number;
  }): Promise<PagedResult<CatalogEntryDto>> =>
    api.get<PagedResult<CatalogEntryDto>>("/v1/app/catalog-entries", { params }).then((r) => r.data),

  createEntry: (input: CreateCatalogEntryInput): Promise<CatalogEntryDto> =>
    api.post<CatalogEntryDto>("/v1/app/catalog-entries", input).then((r) => r.data),

  updateEntry: (id: string, input: UpdateCatalogEntryInput): Promise<CatalogEntryDto> =>
    api.put<CatalogEntryDto>(`/v1/app/catalog-entries/${id}`, input).then((r) => r.data),

  deleteEntry: (id: string): Promise<void> =>
    api.delete(`/v1/app/catalog-entries/${id}`).then(() => undefined),
};

export const taxonomyKeys = {
  all: ["taxonomy"] as const,
  groups: (branchId: string, group: string) =>
    [...taxonomyKeys.all, "groups", branchId, group] as const,
  entries: (branchId: string, group: string, taxonomyId?: string, filter?: string) =>
    [...taxonomyKeys.all, "entries", branchId, group, taxonomyId ?? null, filter ?? ""] as const,
};

export function useTaxonomyGroups(branchId: string, group: string) {
  return useQuery({
    queryKey: taxonomyKeys.groups(branchId, group),
    queryFn: () =>
      taxonomyApi.groups({
        clinicBranchId: branchId,
        group,
        includeCount: true,
        maxResultCount: 100,
      }),
    enabled: Boolean(branchId && group),
  });
}

export function useCatalogEntries(
  branchId: string,
  group: string,
  taxonomyId?: string,
  filter?: string,
) {
  return useQuery({
    queryKey: taxonomyKeys.entries(branchId, group, taxonomyId, filter),
    queryFn: () =>
      taxonomyApi.entries({
        clinicBranchId: branchId,
        group,
        taxonomyId,
        filter: filter || undefined,
        maxResultCount: 100,
      }),
    enabled: Boolean(branchId && group),
  });
}

/** Any catalog write invalidates both panels — item counts live on the groups. */
function useCatalogMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: taxonomyKeys.all });
    },
  });
}

export function useCreateTaxonomyGroup() {
  return useCatalogMutation((input: CreateTaxonomyInput) => taxonomyApi.createGroup(input));
}

export function useUpdateTaxonomyGroup() {
  return useCatalogMutation(({ id, input }: { id: string; input: UpdateTaxonomyInput }) =>
    taxonomyApi.updateGroup(id, input),
  );
}

export function useDeleteTaxonomyGroup() {
  return useCatalogMutation((id: string) => taxonomyApi.deleteGroup(id));
}

export function useCreateCatalogEntry() {
  return useCatalogMutation((input: CreateCatalogEntryInput) => taxonomyApi.createEntry(input));
}

export function useUpdateCatalogEntry() {
  return useCatalogMutation(({ id, input }: { id: string; input: UpdateCatalogEntryInput }) =>
    taxonomyApi.updateEntry(id, input),
  );
}

export function useDeleteCatalogEntry() {
  return useCatalogMutation((id: string) => taxonomyApi.deleteEntry(id));
}
