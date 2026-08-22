import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";
import { DISCOUNT_TYPE, type DiscountType } from "@/features/treatment-management/api/consultingApi";

/** Matches BlueDental.Promotions.VoucherStatus */
export const VOUCHER_STATUS = {
  Draft: 1,
  Active: 2,
  Paused: 3,
  Expired: 4,
} as const;
export type VoucherStatus = (typeof VOUCHER_STATUS)[keyof typeof VOUCHER_STATUS];

export const VOUCHER_STATUS_CONFIG: Record<VoucherStatus, { label: string; color: string }> = {
  [VOUCHER_STATUS.Draft]: { label: "Nháp", color: "default" },
  [VOUCHER_STATUS.Active]: { label: "Đang hoạt động", color: "green" },
  [VOUCHER_STATUS.Paused]: { label: "Tạm dừng", color: "orange" },
  [VOUCHER_STATUS.Expired]: { label: "Hết hạn", color: "red" },
};

/** Matches BlueDental.Promotions.VoucherCustomerTarget */
export const CUSTOMER_TARGET = { All: 0, New: 1, Returning: 2 } as const;
export type VoucherCustomerTarget = (typeof CUSTOMER_TARGET)[keyof typeof CUSTOMER_TARGET];

export const CUSTOMER_TARGET_LABELS: Record<VoucherCustomerTarget, string> = {
  [CUSTOMER_TARGET.All]: "Mọi khách",
  [CUSTOMER_TARGET.New]: "Khách mới",
  [CUSTOMER_TARGET.Returning]: "Khách cũ",
};

export { DISCOUNT_TYPE };
export type { DiscountType };

export interface VoucherDto {
  id: string;
  clinicBranchId: string | null;
  code: string;
  name: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number | null;
  customerTarget: VoucherCustomerTarget;
  validFrom: string;
  validTo: string;
  usageLimit: number | null;
  usedCount: number;
  remainingUses: number | null;
  status: VoucherStatus;
}

export interface VoucherStatsDto {
  total: number;
  active: number;
  issued: number;
  expired: number;
  totalRedemptions: number;
}

export interface CreateVoucherInput {
  clinicBranchId?: string;
  code: string;
  name: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  customerTarget: VoucherCustomerTarget;
  validFrom: string;
  validTo: string;
  usageLimit?: number | null;
}

export interface UpdateVoucherInput {
  name: string;
  description?: string;
  minOrderAmount?: number | null;
  maxDiscountAmount?: number | null;
  customerTarget: VoucherCustomerTarget;
  validFrom: string;
  validTo: string;
}

const voucherApi = {
  list: (params: {
    clinicBranchId?: string;
    status?: VoucherStatus;
    filter?: string;
    maxResultCount?: number;
  }): Promise<PagedResult<VoucherDto>> =>
    api.get<PagedResult<VoucherDto>>("/v1/app/vouchers", { params }).then((r) => r.data),

  stats: (clinicBranchId?: string): Promise<VoucherStatsDto> =>
    api.get<VoucherStatsDto>("/v1/app/vouchers/stats", { params: { clinicBranchId } }).then((r) => r.data),

  create: (input: CreateVoucherInput): Promise<VoucherDto> =>
    api.post<VoucherDto>("/v1/app/vouchers", input).then((r) => r.data),

  update: (id: string, input: UpdateVoucherInput): Promise<VoucherDto> =>
    api.put<VoucherDto>(`/v1/app/vouchers/${id}`, input).then((r) => r.data),

  activate: (id: string): Promise<VoucherDto> =>
    api.post<VoucherDto>(`/v1/app/vouchers/${id}/activate`).then((r) => r.data),

  pause: (id: string): Promise<VoucherDto> =>
    api.post<VoucherDto>(`/v1/app/vouchers/${id}/pause`).then((r) => r.data),

  remove: (id: string): Promise<void> =>
    api.delete(`/v1/app/vouchers/${id}`).then(() => undefined),
};

export const voucherKeys = {
  all: ["vouchers"] as const,
  list: (branchId: string, status?: VoucherStatus, filter?: string) =>
    [...voucherKeys.all, "list", branchId, status ?? null, filter ?? ""] as const,
  stats: (branchId: string) => [...voucherKeys.all, "stats", branchId] as const,
};

export function useVouchers(branchId: string, status?: VoucherStatus, filter?: string) {
  return useQuery({
    queryKey: voucherKeys.list(branchId, status, filter),
    queryFn: () =>
      voucherApi.list({
        clinicBranchId: branchId,
        status,
        filter: filter || undefined,
        maxResultCount: 100,
      }),
    enabled: Boolean(branchId),
  });
}

export function useVoucherStats(branchId: string) {
  return useQuery({
    queryKey: voucherKeys.stats(branchId),
    queryFn: () => voucherApi.stats(branchId),
    enabled: Boolean(branchId),
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

export function useCreateVoucher() {
  return useVoucherMutation((input: CreateVoucherInput) => voucherApi.create(input));
}

export function useUpdateVoucher() {
  return useVoucherMutation(({ id, input }: { id: string; input: UpdateVoucherInput }) =>
    voucherApi.update(id, input),
  );
}

export function useActivateVoucher() {
  return useVoucherMutation((id: string) => voucherApi.activate(id));
}

export function usePauseVoucher() {
  return useVoucherMutation((id: string) => voucherApi.pause(id));
}

export function useDeleteVoucher() {
  return useVoucherMutation((id: string) => voucherApi.remove(id));
}
