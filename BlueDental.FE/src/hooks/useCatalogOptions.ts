import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import type { PagedResult } from "@/types";

/**
 * Catalog lookups shared by feature folders.
 *
 * Features do not import each other, but several of them need the same option
 * lists (services, diagnoses, medicines...). The taxonomy screen owns catalog
 * *management*; this hook only reads options, so it lives with the shared hooks.
 */

/** Slugs from BlueDental.Catalogs.TaxonomyGroups. */
export const CATALOG_GROUP = {
  CareService: "care_service",
  Diagnosis: "diagnosis",
  MedicationType: "medication_type",
  ConsultingData: "consulting_data",
  PrescriptionTemplate: "prescription_template",
  Supplies: "supplies",
  Source: "source",
  DiseaseHistory: "disease_history",
  Occupation: "occupation",
} as const;

export type CatalogGroup = (typeof CATALOG_GROUP)[keyof typeof CATALOG_GROUP];

export interface CatalogOption {
  id: string;
  name: string;
  code: string | null;
  price: number | null;
  taxonomyId: string;
  taxonomyName: string | null;
  isImageRequired: boolean;
  /** Set for the template catalogs — the body a picked template fills in. */
  content: string | null;
}

interface CatalogEntryResponse {
  id: string;
  name: string;
  code: string | null;
  price: number | null;
  taxonomyId: string;
  taxonomyName: string | null;
  isImageRequired: boolean;
  isActive: boolean;
  content: string | null;
}

export const catalogOptionKeys = {
  all: ["catalog-options"] as const,
  group: (branchId: string, group: string) =>
    [...catalogOptionKeys.all, branchId, group] as const,
};

/** Active entries of one catalog, shaped for a Select. */
export function useCatalogOptions(group: CatalogGroup) {
  const branchId = useCurrentBranchId();

  return useQuery({
    queryKey: catalogOptionKeys.group(branchId, group),
    queryFn: async (): Promise<CatalogOption[]> => {
      const page = await api
        .get<PagedResult<CatalogEntryResponse>>("/v1/app/catalog-entries", {
          params: { clinicBranchId: branchId, group, isActive: true, maxResultCount: 200 },
        })
        .then((r) => r.data);

      return page.items.map((entry) => ({
        id: entry.id,
        name: entry.name,
        code: entry.code,
        price: entry.price,
        taxonomyId: entry.taxonomyId,
        taxonomyName: entry.taxonomyName,
        isImageRequired: entry.isImageRequired,
        content: entry.content ?? null,
      }));
    },
    enabled: Boolean(branchId),
  });
}

export interface TaxonomyGroupOption {
  id: string;
  name: string;
  itemCount: number;
}

interface TaxonomyResponse {
  id: string;
  name: string;
  itemCount: number;
}

/**
 * Group panel of a catalog. Read + create only — full group management lives on
 * the Danh mục screen; other features just need to pick or add a group.
 */
export function useTaxonomyGroupOptions(group: CatalogGroup) {
  const branchId = useCurrentBranchId();

  return useQuery({
    queryKey: [...catalogOptionKeys.group(branchId, group), "taxonomies"] as const,
    queryFn: async (): Promise<TaxonomyGroupOption[]> => {
      const page = await api
        .get<PagedResult<TaxonomyResponse>>("/v1/app/taxonomies", {
          params: { clinicBranchId: branchId, group, includeCount: true, maxResultCount: 100 },
        })
        .then((r) => r.data);

      return page.items.map((t) => ({ id: t.id, name: t.name, itemCount: t.itemCount }));
    },
    enabled: Boolean(branchId),
  });
}

export function useCreateTaxonomyGroupOption() {
  const queryClient = useQueryClient();
  const branchId = useCurrentBranchId();

  return useMutation({
    mutationFn: (input: { group: CatalogGroup; name: string; sortOrder?: number }) =>
      api
        .post<TaxonomyResponse>("/v1/app/taxonomies", {
          clinicBranchId: branchId,
          group: input.group,
          name: input.name,
          sortOrder: input.sortOrder ?? 0,
        })
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: catalogOptionKeys.all });
    },
  });
}
