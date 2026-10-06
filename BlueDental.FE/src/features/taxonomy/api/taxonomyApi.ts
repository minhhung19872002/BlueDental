import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { notifyApiError } from "@/lib/notify";
import { api } from "@/lib/axios";
import { invalidateEntities } from "@/lib/queryEntities";
import { downloadFile, downloadPostedFile } from "@/lib/download";
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

/** The usage flags live with the shared types now; kept here for the callers that import them from the taxonomy API. */
export { PRESCRIPTION_USAGE, type PrescriptionUsageFlag } from "@/types/prescriptionUsage";

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
  /** Labo tab — suppliers a labo slip for this service may go to; empty = all. */
  laboSupplierIds: string[];
  /** Computed by the server — "Giá sau giảm". */
  priceAfterDiscount: number;
  /** Computed by the server — "Thực thu từ khách (Đã gồm VAT)". */
  amountCollected: number;
}

/** Mirrors BlueDental.Catalogs.ServiceStageValueType — the %/VNĐ toggle on a stage. */
export const SERVICE_STAGE_VALUE_TYPE = {
  Percentage: 0,
  Amount: 1,
} as const;

export type ServiceStageValueType =
  (typeof SERVICE_STAGE_VALUE_TYPE)[keyof typeof SERVICE_STAGE_VALUE_TYPE];

export interface ServiceStageDto {
  id?: string;
  name: string;
  value: number;
  valueType: ServiceStageValueType;
  /** The star — "Tính lương cho phòng MKT". */
  isMarketingSalary: boolean;
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

/** One "Thành phần combo" row of a combo — BlueDental.Catalogs.CatalogComboItemDto. */
export interface CatalogComboItemDto {
  id?: string;
  /** The single service the row puts in the combo. */
  componentEntryId: string;
  quantity: number;
  /** "Thành tiền" — one unit's price inside the combo; the service's own price is untouched. */
  unitPrice: number;
  /** Read side only. */
  componentName?: string | null;
  componentCode?: string | null;
  /** Read side only — "Giá lẻ", the service's catalogue price today. */
  componentPrice?: number | null;
}

/** The counts on Danh mục's "Tất cả / Dịch vụ lẻ / Combo" switch. */
export interface CatalogEntryKindCounts {
  total: number;
  single: number;
  combo: number;
}

/** Which rows of the dịch vụ catalog the table lists. */
export type ServiceKindFilter = "all" | "single" | "combo";

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
  /** A combo of the dịch vụ catalog — its price is the sum of `comboItems`. */
  isCombo: boolean;
  comboItems: CatalogComboItemDto[];
  /** Combos only — "Tổng giá lẻ" at today's catalogue prices. */
  retailPrice: number | null;
  taxonomyName: string | null;
  lastModificationTime: string | null;
  creationTime: string;
}

/** Mirrors BlueDental.Catalogs.CatalogComboHolderDto — a live combo holding a service. */
export interface CatalogComboHolderDto {
  id: string;
  name: string;
  code: string | null;
  /** The service is the combo's only component, so the server refuses the delete. */
  isLastComponent: boolean;
}

/** What a combo row sends — the read-side names stay behind. */
export type CatalogComboItemInput = Pick<CatalogComboItemDto, "componentEntryId" | "quantity" | "unitPrice">;

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
  /** Creates a combo instead of a single service; its price comes from `comboItems`. */
  isCombo?: boolean;
  comboItems?: CatalogComboItemInput[];
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
  /** A combo's whole table; omitted leaves it as it is. */
  comboItems?: CatalogComboItemInput[];
}

/** The list's filters, shared by the entry list and the kind counts. */
interface EntryListParams {
  clinicBranchId?: string;
  group?: string;
  taxonomyId?: string;
  filter?: string;
  isCombo?: boolean;
  isDeleted?: boolean;
  skipCount?: number;
  maxResultCount?: number;
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

  entries: (params: EntryListParams): Promise<PagedResult<CatalogEntryDto>> =>
    api
      .get<PagedResult<CatalogEntryDto>>("/v1/app/catalog-entries", { params })
      .then((r) => r.data),

  kindCounts: (params: EntryListParams): Promise<CatalogEntryKindCounts> =>
    api
      .get<CatalogEntryKindCounts>("/v1/app/catalog-entries/kind-counts", { params })
      .then((r) => r.data),

  createEntry: (input: CreateCatalogEntryInput): Promise<CatalogEntryDto> =>
    api.post<CatalogEntryDto>("/v1/app/catalog-entries", input).then((r) => r.data),

  updateEntry: (id: string, input: UpdateCatalogEntryInput): Promise<CatalogEntryDto> =>
    api.put<CatalogEntryDto>(`/v1/app/catalog-entries/${id}`, input).then((r) => r.data),

  deleteEntry: (id: string): Promise<void> =>
    api.delete(`/v1/app/catalog-entries/${id}`).then(() => undefined),

  comboHolders: (id: string): Promise<CatalogComboHolderDto[]> =>
    api
      .get<{ items: CatalogComboHolderDto[] }>(`/v1/app/catalog-entries/${id}/combo-holders`)
      .then((r) => r.data.items),

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
  /** Dịch vụ only — "Dịch vụ lẻ" or "Combo"; unset lists both. */
  isCombo?: boolean;
  skipCount: number;
  maxResultCount: number;
}

/** The switch's choice as the list endpoint's `isCombo`. */
export function isComboParam(kind: ServiceKindFilter): boolean | undefined {
  if (kind === "all") return undefined;
  return kind === "combo";
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
      query.isCombo ?? null,
      query.skipCount,
      query.maxResultCount,
    ] as const,
  kindCounts: (branchId: string | undefined, group: string, taxonomyId: string | null, filter: string) =>
    [...taxonomyKeys.all, "kind-counts", branchId ?? "all", group, taxonomyId, filter] as const,
  components: (branchId: string | undefined, taxonomyId: string | null, filter: string) =>
    [...taxonomyKeys.all, "combo-components", branchId ?? "all", taxonomyId, filter] as const,
  comboHolders: (entryId: string) => [...taxonomyKeys.all, "combo-holders", entryId] as const,
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
        isCombo: query.isCombo,
        skipCount: query.skipCount,
        maxResultCount: query.maxResultCount,
      }),
    // Paging through a catalog should not blank the table on every step.
    placeholderData: (previous) => previous,
    enabled: Boolean(group && (query.scope === "catalog" || query.taxonomyId)),
  });
}

/**
 * The numbers on "Tất cả / Dịch vụ lẻ / Combo", counted by the server under
 * the same group and search as the table — Dịch vụ only.
 */
export function useCatalogEntryKindCounts(
  branchId: string | undefined,
  group: string,
  taxonomyId: string | null,
  filter: string,
  enabled: boolean,
) {
  const term = filter.trim();
  return useQuery({
    queryKey: taxonomyKeys.kindCounts(branchId, group, taxonomyId, term),
    queryFn: () =>
      taxonomyApi.kindCounts({
        clinicBranchId: branchId,
        group,
        taxonomyId: taxonomyId ?? undefined,
        filter: term || undefined,
      }),
    placeholderData: (previous) => previous,
    enabled: enabled && Boolean(taxonomyId),
  });
}

/** How many services the combo dialog's "Danh mục" panel lists at once; a search narrows them. */
export const COMBO_COMPONENT_PAGE_SIZE = 100;

/**
 * The single services a combo can be built from — the combo dialog's
 * "Danh mục" panel. Searched on the server like every other catalog list;
 * combos and deleted rows are left out, as the server would refuse them.
 */
export function useComboComponentOptions(
  branchId: string | undefined,
  taxonomyId: string | null,
  filter: string,
  enabled: boolean,
) {
  const term = filter.trim();
  return useQuery({
    queryKey: taxonomyKeys.components(branchId, taxonomyId, term),
    queryFn: () =>
      taxonomyApi.entries({
        clinicBranchId: branchId,
        group: TAXONOMY_GROUP.CareService,
        taxonomyId: taxonomyId ?? undefined,
        filter: term || undefined,
        isCombo: false,
        isDeleted: false,
        maxResultCount: COMBO_COMPONENT_PAGE_SIZE,
      }),
    placeholderData: (previous) => previous,
    enabled: enabled && Boolean(branchId),
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
    meta: { invalidates: ["catalog"] },
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
    meta: { invalidates: ["catalog"] },
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
    meta: { invalidates: ["catalog"] },
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

/**
 * The live combos holding a service — the delete confirmation names them,
 * since deleting the service takes it out of them (BA rule, R-768).
 */
export function useComboHolders(entryId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: taxonomyKeys.comboHolders(entryId ?? ""),
    queryFn: () => taxonomyApi.comboHolders(entryId ?? ""),
    enabled: enabled && Boolean(entryId),
  });
}

export function useDeleteCatalogEntry() {
  return useCatalogMutation((id: string) => taxonomyApi.deleteEntry(id));
}

// ── Import from Excel ───────────────────────────────────────────────────
//
// BlueDental's own feature: the reference has no import on Danh mục. The
// shapes mirror BlueDental.Catalogs.CatalogImportDtos.

/** Mirrors BlueDental.Catalogs.CatalogImportRowAction. */
export const IMPORT_ROW_ACTION = {
  Create: 0,
  Skip: 1,
  Restore: 2,
  Line: 3,
  Error: 4,
  /** Appended after Error on the server so the earlier numbers stay put. */
  Update: 5,
} as const;

export type ImportRowAction = (typeof IMPORT_ROW_ACTION)[keyof typeof IMPORT_ROW_ACTION];

export interface CatalogImportRowDto {
  /** Excel row number, header included, so the user can find it in the file. */
  row: number;
  /** Cell text in the order of the sheet's `columns`. */
  values: (string | null)[];
  action: ImportRowAction;
  errors: string[];
}

export interface CatalogImportSheetDto {
  name: string;
  columns: string[];
  rows: CatalogImportRowDto[];
}

export interface CatalogImportResultDto {
  dryRun: boolean;
  committed: boolean;
  fileErrors: string[];
  totalRows: number;
  createCount: number;
  /** Existing rows whose other fields differ in the file. */
  updateCount: number;
  /** Existing rows the file changes nothing about. */
  skipCount: number;
  restoreCount: number;
  errorCount: number;
  newGroups: string[];
  sheets: CatalogImportSheetDto[];
}

export interface ImportCatalogEntriesInput {
  group: string;
  clinicBranchId: string;
  file: File;
  /** True reads and validates only — the preview step. */
  dryRun: boolean;
}

function importForm(input: ImportCatalogEntriesInput): FormData {
  const form = new FormData();
  form.append("file", input.file);
  form.append("group", input.group);
  form.append("clinicBranchId", input.clinicBranchId);
  form.append("dryRun", String(input.dryRun));
  return form;
}

const IMPORT_URL = "/v1/app/catalog-entries";

const catalogImportApi = {
  downloadTemplate: (group: string): Promise<void> =>
    downloadFile(`${IMPORT_URL}/import-template`, `mau-nhap-${group}.xlsx`, { group }),

  run: (input: ImportCatalogEntriesInput): Promise<CatalogImportResultDto> =>
    api.post<CatalogImportResultDto>(`${IMPORT_URL}/import`, importForm(input)).then((r) => r.data),

  downloadErrors: (input: ImportCatalogEntriesInput): Promise<void> =>
    downloadPostedFile(`${IMPORT_URL}/import-errors`, importForm(input), `loi-nhap-${input.group}.xlsx`),
};

export function useDownloadImportTemplate() {
  return useMutation({ mutationFn: (group: string) => catalogImportApi.downloadTemplate(group) });
}

export function useDownloadImportErrors() {
  return useMutation({
    mutationFn: (input: ImportCatalogEntriesInput) => catalogImportApi.downloadErrors(input),
  });
}

/** One mutation serves both the preview (dryRun) and the real import. */
export function useImportCatalogEntries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ImportCatalogEntriesInput) => catalogImportApi.run(input),
    onSuccess: (result) => {
      // A commit may have created groups as well as entries; both panels reload,
      // and so does every picker reading the catalog. A dry run wrote nothing,
      // which is why this is not a static `meta.invalidates`.
      if (result.committed) {
        invalidateEntities(queryClient, ["catalog"]);
      }
    },
  });
}
