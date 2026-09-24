import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
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
  /** Lời dặn on a Đơn thuốc mẫu; the note of anything else. */
  description: string | null;
  /** The medicine lines of a Đơn thuốc mẫu; empty for every other catalog. */
  prescriptionLines: CatalogPrescriptionLine[];
}

/** One line of a Đơn thuốc mẫu as the catalog API returns it. */
export interface CatalogPrescriptionLine {
  id: string;
  medicineEntryId: string;
  medicineName: string | null;
  timesPerDay: number;
  amountPerTime: number;
  days: number;
  /** Flags of PRESCRIPTION_USAGE. */
  usage: number;
  otherUsage: string | null;
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
  description?: string | null;
  prescriptionLines?: CatalogPrescriptionLine[];
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
        description: entry.description ?? null,
        prescriptionLines: entry.prescriptionLines ?? [],
      }));
    },
    enabled: Boolean(branchId),
  });
}

/** One page of a catalog, as the pickers read it. */
export interface CatalogOptionPage {
  items: CatalogOption[];
  totalCount: number;
}

/** The reference's pickers ask for twenty rows at a time and scroll for more. */
export const CATALOG_PAGE_SIZE = 20;

function toOption(entry: CatalogEntryResponse): CatalogOption {
  return {
    id: entry.id,
    name: entry.name,
    code: entry.code,
    price: entry.price,
    taxonomyId: entry.taxonomyId,
    taxonomyName: entry.taxonomyName,
    isImageRequired: entry.isImageRequired,
    content: entry.content ?? null,
    description: entry.description ?? null,
    prescriptionLines: entry.prescriptionLines ?? [],
  };
}

interface CatalogSearchInput {
  /** What the user typed. Sent to the server as `filter`, never matched here. */
  search?: string;
  /** Narrow to one group — the picker's group panel does. */
  taxonomyId?: string;
  /**
   * Offer every row that is not deleted, switched off or not — the
   * reference's "Chọn Dịch Vụ" asks for `isDeleted: false` alone. Left unset,
   * only active rows come back, as the other pickers want.
   */
  includeInactive?: boolean;
  enabled?: boolean;
}

/**
 * A catalog searched **on the server**, a page at a time.
 *
 * The reference's service picker does not hold the catalog in the browser: it
 * calls its list endpoint with `search` and `page` on every keystroke and grows
 * the list as the popup is scrolled. A clinic's catalog outgrows any one page,
 * so filtering a prefetched slice would quietly hide rows that do exist.
 */
export function useCatalogOptionSearch(group: CatalogGroup, input: CatalogSearchInput = {}) {
  const branchId = useCurrentBranchId();
  const search = input.search?.trim() ?? "";

  return useInfiniteQuery({
    queryKey: [
      ...catalogOptionKeys.group(branchId, group),
      "search",
      search,
      input.taxonomyId ?? null,
      input.includeInactive ?? false,
    ] as const,
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<CatalogOptionPage> => {
      const page = await api
        .get<PagedResult<CatalogEntryResponse>>("/v1/app/catalog-entries", {
          params: {
            clinicBranchId: branchId,
            group,
            ...(input.includeInactive ? { isDeleted: false } : { isActive: true }),
            taxonomyId: input.taxonomyId,
            filter: search || undefined,
            skipCount: pageParam,
            maxResultCount: CATALOG_PAGE_SIZE,
          },
        })
        .then((r) => r.data);

      return { items: page.items.map(toOption), totalCount: page.totalCount };
    },
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, item) => sum + item.items.length, 0);
      return loaded < last.totalCount ? loaded : undefined;
    },
    // The old rows stay on screen while the next search lands, so the popup
    // does not blink empty between keystrokes.
    placeholderData: keepPreviousData,
    enabled: Boolean(branchId) && (input.enabled ?? true),
  });
}

/** The same server-side search over a catalog's groups. */
export function useTaxonomyGroupSearch(group: CatalogGroup, search: string, enabled = true) {
  const branchId = useCurrentBranchId();
  const term = search.trim();

  return useQuery({
    queryKey: [...catalogOptionKeys.group(branchId, group), "taxonomies", "search", term] as const,
    queryFn: async (): Promise<TaxonomyGroupOption[]> => {
      const page = await api
        .get<PagedResult<TaxonomyResponse>>("/v1/app/taxonomies", {
          params: {
            clinicBranchId: branchId,
            group,
            includeCount: true,
            filter: term || undefined,
            maxResultCount: 100,
          },
        })
        .then((r) => r.data);

      return page.items.map((item) => ({ id: item.id, name: item.name, itemCount: item.itemCount }));
    },
    placeholderData: keepPreviousData,
    enabled: Boolean(branchId) && enabled,
  });
}

/** One page of a catalog's groups. */
export interface TaxonomyGroupPage {
  items: TaxonomyGroupOption[];
  totalCount: number;
}

/**
 * A catalog's groups a page at a time, in their Danh mục order — how the
 * reference's "Lựa chọn dịch vụ" strip reads them (`perPage: 20`,
 * `orderBy: order:asc`, the next page asked for as the strip nears its end).
 * A clinic can hold far more groups than one request should carry.
 */
export function useTaxonomyGroupPages(group: CatalogGroup, enabled = true) {
  const branchId = useCurrentBranchId();

  return useInfiniteQuery({
    queryKey: [...catalogOptionKeys.group(branchId, group), "taxonomies", "pages"] as const,
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<TaxonomyGroupPage> => {
      const page = await api
        .get<PagedResult<TaxonomyResponse>>("/v1/app/taxonomies", {
          params: {
            clinicBranchId: branchId,
            group,
            includeCount: true,
            skipCount: pageParam,
            maxResultCount: CATALOG_PAGE_SIZE,
          },
        })
        .then((r) => r.data);

      return {
        items: page.items.map((t) => ({ id: t.id, name: t.name, itemCount: t.itemCount })),
        totalCount: page.totalCount,
      };
    },
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, item) => sum + item.items.length, 0);
      return loaded < last.totalCount ? loaded : undefined;
    },
    enabled: Boolean(branchId) && enabled,
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
