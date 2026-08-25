import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { notifyApiError } from "@/lib/notify";
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

/** Mirrors BlueDental.Catalogs.ServiceTaxRate — two of these are not numbers. */
export const SERVICE_TAX_RATE = {
  NotTaxable: 0,
  NotDeclared: 1,
  Zero: 2,
  Five: 3,
  Eight: 4,
  Ten: 5,
} as const;

export type ServiceTaxRate = (typeof SERVICE_TAX_RATE)[keyof typeof SERVICE_TAX_RATE];

/** The labels the reference puts in its "% thuế" select, in its order. */
export const SERVICE_TAX_RATE_OPTIONS: { value: ServiceTaxRate; label: string }[] = [
  { value: SERVICE_TAX_RATE.NotTaxable, label: "KCT" },
  { value: SERVICE_TAX_RATE.NotDeclared, label: "KKKNT" },
  { value: SERVICE_TAX_RATE.Zero, label: "0%" },
  { value: SERVICE_TAX_RATE.Five, label: "5%" },
  { value: SERVICE_TAX_RATE.Eight, label: "8%" },
  { value: SERVICE_TAX_RATE.Ten, label: "10%" },
];

/** Mirrors BlueDental.Catalogs.PrescriptionUsage — a multi-choice, so flags. */
export const PRESCRIPTION_USAGE = {
  AfterMeal: 1,
  BeforeMeal: 2,
  DuringMeal: 4,
  AfterWakingUp: 8,
  BeforeSleep: 16,
  Other: 32,
} as const;

export type PrescriptionUsageFlag =
  (typeof PRESCRIPTION_USAGE)[keyof typeof PRESCRIPTION_USAGE];

/** Warranty choices the reference lists, plus its free "Tuỳ chỉnh … Ngày". */
export const WARRANTY_PRESETS = [0, 30, 90, 180, 270, 365, 730] as const;

export interface ServiceConfigDto {
  taxRate: ServiceTaxRate;
  priceIncludesTax: boolean;
  discountIsPercent: boolean;
  discountValue: number;
  requireImage: boolean;
  deductDoctorOnWarranty: boolean;
  separateRevenue: boolean;
  showToothOnInvoice: boolean;
  revenueByStage: boolean;
  requireStageSequence: boolean;
  warrantyDays: number;
  /** Computed by the server — "Giá sau giảm". */
  priceAfterDiscount: number;
  /** Computed by the server — "Thực thu từ khách (Đã gồm VAT)". */
  amountCollected: number;
}

export interface ServiceStageDto {
  id?: string;
  name: string;
  value: number;
}

export interface MedicineDto {
  activeIngredient: string | null;
  usage: string | null;
  purchasePrice: number;
  prescriptionCode: string | null;
  usageNote: string | null;
}

export interface PrescriptionTemplateLineDto {
  id?: string;
  medicineEntryId: string;
  timesPerDay: number;
  amountPerTime: number;
  days: number;
  /** Flags of PRESCRIPTION_USAGE. */
  usage: number;
  /** What the user wrote for "Khác"; null unless that flag is set. */
  otherUsage: string | null;
  /** Computed by the server. */
  quantity?: number;
  medicineName?: string | null;
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
  isActive: boolean;
  /**
   * Soft delete. A deleted entry stays in the list without its delete action,
   * and is brought back by ticking "Đang hoạt động" in its dialog.
   */
  isDeleted: boolean;
  sortOrder: number;
  detailName: string | null;
  note: string | null;
  unit: string | null;
  serviceConfig: ServiceConfigDto | null;
  medicine: MedicineDto | null;
  stages: ServiceStageDto[];
  prescriptionLines: PrescriptionTemplateLineDto[];
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
  sortOrder?: number;
  detailName?: string | null;
  note?: string | null;
  unit?: string | null;
  /** Sent by the service dialog only; omitted means "leave as it is". */
  serviceConfig?: Omit<ServiceConfigDto, "priceAfterDiscount" | "amountCollected">;
  medicine?: MedicineDto;
  stages?: ServiceStageDto[];
  prescriptionLines?: Omit<PrescriptionTemplateLineDto, "quantity" | "medicineName">[];
}

export interface UpdateCatalogEntryInput {
  taxonomyId: string;
  name: string;
  code?: string;
  price?: number | null;
  content?: string | null;
  description?: string;
  isActive: boolean;
  /** The other half of the dialog's one state — see CatalogEntryDto. */
  isDeleted?: boolean;
  sortOrder: number;
  detailName?: string | null;
  note?: string | null;
  unit?: string | null;
  /** Sent by the service dialog only; omitted means "leave as it is". */
  serviceConfig?: Omit<ServiceConfigDto, "priceAfterDiscount" | "amountCollected">;
  medicine?: MedicineDto;
  stages?: ServiceStageDto[];
  prescriptionLines?: Omit<PrescriptionTemplateLineDto, "quantity" | "medicineName">[];
}

const taxonomyApi = {
  groups: (params: {
    clinicBranchId?: string;
    group: string;
    filter?: string;
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
    clinicBranchId?: string;
    group?: string;
    taxonomyId?: string;
    filter?: string;
    skipCount?: number;
    maxResultCount?: number;
  }): Promise<PagedResult<CatalogEntryDto>> =>
    api
      .get<PagedResult<CatalogEntryDto>>("/v1/app/catalog-entries", { params })
      .then((r) => r.data),

  createEntry: (input: CreateCatalogEntryInput): Promise<CatalogEntryDto> =>
    api.post<CatalogEntryDto>("/v1/app/catalog-entries", input).then((r) => r.data),

  updateEntry: (id: string, input: UpdateCatalogEntryInput): Promise<CatalogEntryDto> =>
    api.put<CatalogEntryDto>(`/v1/app/catalog-entries/${id}`, input).then((r) => r.data),

  deleteEntry: (id: string): Promise<void> =>
    api.delete(`/v1/app/catalog-entries/${id}`).then(() => undefined),

  reorderGroups: (input: ReorderGroupsInput): Promise<void> =>
    api.post("/v1/app/taxonomies/reorder", input).then(() => undefined),

  reorderEntries: (input: ReorderEntriesInput): Promise<void> =>
    api.post("/v1/app/catalog-entries/reorder", input).then(() => undefined),
};

/** One row and the position it should hold, as the reorder endpoint takes it. */
export interface ReorderItem {
  id: string;
  order: number;
}

export interface ReorderGroupsInput {
  clinicBranchId?: string;
  group: string;
  items: ReorderItem[];
}

export interface ReorderEntriesInput {
  clinicBranchId?: string;
  group: string;
  taxonomyId?: string;
  items: ReorderItem[];
}

export interface CatalogEntryQuery {
  /**
   * "group" lists one classification group and waits for one to be selected;
   * "catalog" lists every entry of the catalog, for the flat sub-routes that
   * have no group panel.
   */
  scope: "group" | "catalog";
  taxonomyId?: string;
  filter?: string;
  skipCount: number;
  maxResultCount: number;
}

export const taxonomyKeys = {
  all: ["taxonomy"] as const,
  groups: (branchId: string | undefined, group: string, filter?: string) =>
    [...taxonomyKeys.all, "groups", branchId ?? "all", group, filter ?? ""] as const,
  entries: (branchId: string | undefined, group: string, query: CatalogEntryQuery) =>
    [
      ...taxonomyKeys.all,
      "entries",
      branchId ?? "all",
      group,
      query.scope,
      query.taxonomyId ?? null,
      query.filter?.trim() ?? "",
      query.skipCount,
      query.maxResultCount,
    ] as const,
};

/**
 * The group panel searches on the server, like the entry table does — a client
 * filter would only ever search the page it happens to be holding.
 */
export function useTaxonomyGroups(branchId: string | undefined, group: string, filter?: string) {
  // Trimmed here as well as on the server, so "trám " and "trám" are one cache
  // entry and one request rather than two.
  const term = filter?.trim() || undefined;

  return useQuery({
    queryKey: taxonomyKeys.groups(branchId, group, term),
    queryFn: () =>
      taxonomyApi.groups({
        clinicBranchId: branchId,
        group,
        filter: term,
        includeCount: true,
        maxResultCount: 200,
      }),
    enabled: Boolean(group),
    // Typing should narrow the list in place rather than blank the panel.
    placeholderData: (previous) => previous,
  });
}

/**
 * The list is always scoped to one group, so the query stays idle until a group
 * is known — otherwise the first render would briefly show every entry in the
 * catalog before the group selection settled.
 */
export function useCatalogEntries(
  branchId: string | undefined,
  group: string,
  query: CatalogEntryQuery,
) {
  return useQuery({
    queryKey: taxonomyKeys.entries(branchId, group, query),
    queryFn: () =>
      taxonomyApi.entries({
        clinicBranchId: branchId,
        group,
        taxonomyId: query.taxonomyId,
        filter: query.filter?.trim() || undefined,
        skipCount: query.skipCount,
        maxResultCount: query.maxResultCount,
      }),
    // Paging through a catalog should not blank the table on every step.
    placeholderData: (previous) => previous,
    enabled: Boolean(group && (query.scope === "catalog" || query.taxonomyId)),
  });
}

/**
 * Any catalog write invalidates both panels — item counts live on the groups.
 *
 * The invalidation is returned rather than fired and forgotten, so the mutation
 * settles only once the refetched data is in hand. A reorder holds the dragged
 * order until then; resolving earlier would flash the old order for a frame.
 */
function useCatalogMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taxonomyKeys.all }),
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

/**
 * Applies the order the drag just produced to every cached list of this shape,
 * so the screen shows the new order the instant the pointer is released.
 *
 * Without this the list falls back to whatever the cache still holds while the
 * request is in flight — which is the order *before* the drag, so the rows
 * visibly snap back for a moment and then jump again when the refetch lands.
 */
function applyOptimisticOrder<T extends { id: string; sortOrder: number }>(
  queryClient: QueryClient,
  keyPrefix: readonly unknown[],
  items: ReorderItem[],
) {
  const order = new Map(items.map((item) => [item.id, item.order]));
  const snapshot = queryClient.getQueriesData<PagedResult<T>>({ queryKey: keyPrefix });

  for (const [key, data] of snapshot) {
    if (!data) continue;

    queryClient.setQueryData<PagedResult<T>>(key, {
      ...data,
      items: data.items
        .map((item) => ({ ...item, sortOrder: order.get(item.id) ?? item.sortOrder }))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    });
  }

  return snapshot;
}

/**
 * Persists a new group order in a single request carrying the whole list, the
 * way the reference does it.
 *
 * One drag is one action: sending it as one call keeps the catalog from ending
 * up half-sorted when a write fails, and keeps N requests off the wire.
 */
export function useReorderTaxonomyGroups() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReorderGroupsInput) => taxonomyApi.reorderGroups(input),
    onMutate: async (input) => {
      // A refetch already in flight would land on top of the optimistic order.
      await queryClient.cancelQueries({ queryKey: taxonomyKeys.all });
      return {
        snapshot: applyOptimisticOrder<TaxonomyDto>(
          queryClient,
          [...taxonomyKeys.all, "groups"],
          input.items,
        ),
      };
    },
    onError: (error, _input, context) => {
      // The save failed, so the order the user saw was never real: put back
      // exactly what the cache held before the drag.
      for (const [key, data] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, data);
      }
      // queryClient reads "this mutation has an onError" as "it reports
      // itself", and this one only exists to roll back — so say what broke.
      notifyApiError(error);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: taxonomyKeys.all }),
  });
}

/**
 * Persists a new entry order in a single request. The order sent is the row's
 * absolute position in the catalog, so row 1 of page 3 keeps sorting after
 * page 2. Optimistic for the same reason the group reorder is.
 */
export function useReorderCatalogEntries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReorderEntriesInput) => taxonomyApi.reorderEntries(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: taxonomyKeys.all });
      return {
        snapshot: applyOptimisticOrder<CatalogEntryDto>(
          queryClient,
          [...taxonomyKeys.all, "entries"],
          input.items,
        ),
      };
    },
    onError: (error, _input, context) => {
      for (const [key, data] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, data);
      }
      // queryClient reads "this mutation has an onError" as "it reports
      // itself", and this one only exists to roll back — so say what broke.
      notifyApiError(error);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: taxonomyKeys.all }),
  });
}

export function useDeleteCatalogEntry() {
  return useCatalogMutation((id: string) => taxonomyApi.deleteEntry(id));
}
