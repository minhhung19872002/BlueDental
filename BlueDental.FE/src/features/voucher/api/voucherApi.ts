import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";
import { t } from "@/lib/i18n";

export type VoucherStatus = "active" | "expired" | "out_of_uses";
export type VoucherScopeTarget = "service" | "treatment";
export type VoucherDiscountType = "percentage" | "fixed_amount";
export type CustomerTarget = "new" | "returning";

export const VOUCHER_STATUS_CONFIG: Record<VoucherStatus, { label: () => string; color: string }> =
  {
    active: { label: () => t("Đang hoạt động"), color: "green" },
    expired: { label: () => t("Hết hạn"), color: "red" },
    out_of_uses: { label: () => t("Hết lượt"), color: "blue" },
  };

export const SCOPE_TARGET_CONFIG: Record<VoucherScopeTarget, { label: () => string }> = {
  service: { label: () => t("Theo dịch vụ") },
  treatment: { label: () => t("Tổng kế hoạch") },
};

export interface VoucherDto {
  id: string;
  name: string;
  code: string;
  prefix: string | null;
  description: string | null;
  discountType: VoucherDiscountType;
  discountValue: number;
  minOrderValue: number | null;
  maxDiscountAmount: number | null;
  scopeTarget: VoucherScopeTarget;
  targetIds: string[];
  startDate: string;
  endDate: string;
  usageLimit: number | null;
  usedCount: number;
  status: VoucherStatus;
  isPublished: boolean;
  publishedAt: string | null;
  isExclusive: boolean;
  customerTargets: string[];
  perCustomerLimit: number | null;
  isDaysOfWeekLimited: boolean;
  daysOfWeek: number[];
  displayOnNfcDental: boolean;
  clinicBranchId: string | null;
  isDeleted: boolean;
  creationTime: string;
  creatorId: string | null;
  lastModificationTime: string | null;
  lastModifierId: string | null;
}

export interface CreateVoucherInput {
  prefix?: string;
  code?: string;
  name: string;
  description?: string;
  discountType: string;
  discountValue: number;
  maxDiscountAmount?: number | null;
  scopeTarget: string;
  targetIds: string[];
  minOrderValue?: number | null;
  startDate: string;
  endDate: string;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  isExclusive: boolean;
  customerTargets: string[];
  isDaysOfWeekLimited: boolean;
  daysOfWeek: number[];
  displayOnNfcDental: boolean;
  branchId?: string;
}

/**
 * One voucher of a batch. With "Cấu hình tất cả" the item carries only
 * code+name and the server falls back to the batch-level fields; a per-code
 * configuration ("cấu hình riêng") fills the overrides in. The server treats
 * a non-null discountType as the marker for a fully-configured item.
 */
export interface VoucherBatchItemInput {
  code?: string;
  name: string;
  description?: string;
  discountType?: string;
  discountValue?: number;
  maxDiscountAmount?: number | null;
  scopeTarget?: string;
  targetIds?: string[];
  minOrderValue?: number | null;
  startDate?: string;
  endDate?: string;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  isExclusive?: boolean;
  customerTargets?: string[];
  isDaysOfWeekLimited?: boolean;
  daysOfWeek?: number[];
  displayOnNfcDental?: boolean;
}

export interface CreateVoucherBatchInput {
  prefix?: string;
  count: number;
  configureAll: boolean;
  items: VoucherBatchItemInput[];
  description?: string;
  discountType: string;
  discountValue: number;
  maxDiscountAmount?: number | null;
  scopeTarget: string;
  targetIds: string[];
  minOrderValue?: number | null;
  startDate: string;
  endDate: string;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  isExclusive: boolean;
  customerTargets: string[];
  isDaysOfWeekLimited: boolean;
  daysOfWeek: number[];
  displayOnNfcDental: boolean;
  branchId?: string;
}

/** The server-owned prefix shown before every voucher code. */
export interface VoucherCodePrefix {
  prefix: string;
}

export interface UpdateVoucherInput {
  /** Blank lets the server generate a fresh code, mirroring create. */
  code?: string;
  /** Blank keeps the stored prefix; sending one adopts it. */
  prefix?: string;
  name: string;
  discountType: string;
  discountValue: number;
  description?: string;
  scopeTarget: string;
  targetIds: string[];
  minOrderValue?: number | null;
  maxDiscountAmount?: number | null;
  isExclusive: boolean;
  customerTargets: string[];
  perCustomerLimit?: number | null;
  isDaysOfWeekLimited: boolean;
  daysOfWeek: number[];
  displayOnNfcDental: boolean;
  startDate: string;
  endDate: string;
  usageLimit?: number | null;
}

export type VoucherFilterStatus = VoucherStatus | "created";

/** What `GET vouchers/available` needs to judge a voucher against one order. */
export interface AvailableVoucherParams {
  orderAmount: number;
  clinicBranchId?: string;
}

const voucherApi = {
  available: (params: AvailableVoucherParams): Promise<VoucherDto[]> =>
    api.get<VoucherDto[]>("/v1/app/vouchers/available", { params }).then((r) => r.data),

  list: (params: {
    status?: string;
    filter?: string;
    branchId?: string;
    skipCount?: number;
    maxResultCount?: number;
  }): Promise<PagedResult<VoucherDto>> =>
    api.get<PagedResult<VoucherDto>>("/v1/app/vouchers", { params }).then((r) => r.data),

  get: (id: string): Promise<VoucherDto> =>
    api.get<VoucherDto>(`/v1/app/vouchers/${id}`).then((r) => r.data),

  getCodePrefix: (): Promise<VoucherCodePrefix> =>
    api.get<VoucherCodePrefix>("/v1/app/vouchers/code-prefix").then((r) => r.data),

  create: (input: CreateVoucherInput): Promise<VoucherDto> =>
    api.post<VoucherDto>("/v1/app/vouchers", input).then((r) => r.data),

  createBatch: (input: CreateVoucherBatchInput): Promise<VoucherDto[]> =>
    api.post<VoucherDto[]>("/v1/app/vouchers/batch", input).then((r) => r.data),

  update: (id: string, input: UpdateVoucherInput): Promise<VoucherDto> =>
    api.put<VoucherDto>(`/v1/app/vouchers/${id}`, input).then((r) => r.data),

  publish: (id: string): Promise<VoucherDto> =>
    api.post<VoucherDto>(`/v1/app/vouchers/${id}/publish`).then((r) => r.data),

  unpublish: (id: string): Promise<VoucherDto> =>
    api.post<VoucherDto>(`/v1/app/vouchers/${id}/unpublish`).then((r) => r.data),

  remove: (id: string): Promise<void> => api.delete(`/v1/app/vouchers/${id}`).then(() => undefined),
};

export const voucherKeys = {
  all: ["vouchers"] as const,
  list: (status?: string, filter?: string, branchId?: string) =>
    [...voucherKeys.all, "list", status ?? "", filter ?? "", branchId ?? ""] as const,
  available: (orderAmount: number, branchId?: string) =>
    [...voucherKeys.all, "available", orderAmount, branchId ?? ""] as const,
};

/**
 * The vouchers the server judges usable for an order of `orderAmount` today:
 * published, active, inside their dates, not exhausted and above their minimum.
 * The server already sorts them best discount first.
 */
export function useAvailableVouchers(orderAmount: number, branchId?: string) {
  return useQuery({
    queryKey: voucherKeys.available(orderAmount, branchId),
    queryFn: () => voucherApi.available({ orderAmount, clinicBranchId: branchId }),
    placeholderData: (previous) => previous,
  });
}

/**
 * The discount one voucher takes off an order — the same arithmetic the server
 * runs in `Voucher.CalculateDiscount`, so the total the page shows is the total
 * the server would charge.
 */
export function calculateVoucherDiscount(voucher: VoucherDto, orderAmount: number): number {
  if (orderAmount <= 0) return 0;
  const raw =
    voucher.discountType === "percentage"
      ? (orderAmount * voucher.discountValue) / 100
      : voucher.discountValue;
  const capped =
    voucher.maxDiscountAmount !== null && raw > voucher.maxDiscountAmount
      ? voucher.maxDiscountAmount
      : raw;
  return Math.min(capped, orderAmount);
}

/** "-10%" or "-500.000đ", as the voucher table writes it. */
/** The voucher's face value as staging chips it: "10%" or "50.000đ". */
export function formatVoucherValue(voucher: VoucherDto): string {
  return voucher.discountType === "percentage"
    ? `${voucher.discountValue}%`
    : `${voucher.discountValue.toLocaleString("vi-VN")}đ`;
}

export function useVouchers(status?: string, filter?: string, branchId?: string) {
  return useQuery({
    queryKey: voucherKeys.list(status, filter, branchId),
    queryFn: () =>
      voucherApi.list({
        status: status || undefined,
        filter: filter || undefined,
        branchId: branchId || undefined,
        maxResultCount: 100,
      }),
  });
}

function useVoucherMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: voucherKeys.all });
    },
  });
}

/** The prefix is a server constant, so cache it for the whole session. */
export function useVoucherCodePrefix(enabled: boolean) {
  return useQuery({
    queryKey: [...voucherKeys.all, "code-prefix"] as const,
    queryFn: voucherApi.getCodePrefix,
    enabled,
    staleTime: Infinity,
  });
}

export function useCreateVoucher() {
  return useVoucherMutation((input: CreateVoucherInput) => voucherApi.create(input));
}

export function useCreateVoucherBatch() {
  return useVoucherMutation((input: CreateVoucherBatchInput) => voucherApi.createBatch(input));
}

export function useUpdateVoucher() {
  return useVoucherMutation(({ id, input }: { id: string; input: UpdateVoucherInput }) =>
    voucherApi.update(id, input),
  );
}

export function usePublishVoucher() {
  return useVoucherMutation((id: string) => voucherApi.publish(id));
}

export function useUnpublishVoucher() {
  return useVoucherMutation((id: string) => voucherApi.unpublish(id));
}

export function useDeleteVoucher() {
  return useVoucherMutation((id: string) => voucherApi.remove(id));
}
