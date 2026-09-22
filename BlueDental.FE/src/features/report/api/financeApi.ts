import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { t } from "@/lib/i18n";
import type { PagedResult } from "@/types";
import { clinicReportKeys } from "./clinicReportApi";

/** The API binds `entryDate` to a DateOnly, which only accepts a bare calendar date. */
export const API_DATE_FORMAT = "YYYY-MM-DD";

/** Matches BlueDental.Finance.SalesEntryType */
export const SALES_ENTRY_TYPE = { Income: 1, Expense: 2 } as const;
export type SalesEntryType = (typeof SALES_ENTRY_TYPE)[keyof typeof SALES_ENTRY_TYPE];

/**
 * Matches BlueDental.Finance.PaymentChannel for sales entries; the report's
 * payment / refund lines carry the same numbering (PaymentMethodKind).
 */
export const PAYMENT_CHANNEL = {
  Cash: 1,
  Banking: 2,
  Card: 3,
  OutstandingDebt: 4,
  EWallet: 5,
} as const;
export type PaymentChannel = (typeof PAYMENT_CHANNEL)[keyof typeof PAYMENT_CHANNEL];

export const paymentChannelLabels = (): Record<PaymentChannel, string> => ({
  [PAYMENT_CHANNEL.Cash]: t("Tiền mặt"),
  [PAYMENT_CHANNEL.Banking]: t("Chuyển khoản"),
  [PAYMENT_CHANNEL.Card]: t("Quẹt thẻ"),
  [PAYMENT_CHANNEL.OutstandingDebt]: t("Dư nợ"),
  [PAYMENT_CHANNEL.EWallet]: t("Ví điện tử"),
});

/** Matches BlueDental.Finance.SalesApprovalStatus */
export const SALES_APPROVAL_STATUS = {
  NotRequired: 0,
  Pending: 1,
  Approved: 2,
  Rejected: 3,
} as const;
export type SalesApprovalStatus =
  (typeof SALES_APPROVAL_STATUS)[keyof typeof SALES_APPROVAL_STATUS];

/** Matches BlueDental.Finance.CashTransactionType */
export const CASH_TRANSACTION_TYPE = { Deposit: 1, Withdraw: 2, Transfer: 3 } as const;
export type CashTransactionType =
  (typeof CASH_TRANSACTION_TYPE)[keyof typeof CASH_TRANSACTION_TYPE];

export const cashTransactionLabels = (): Record<CashTransactionType, string> => ({
  [CASH_TRANSACTION_TYPE.Deposit]: t("Nạp"),
  [CASH_TRANSACTION_TYPE.Withdraw]: t("Rút"),
  [CASH_TRANSACTION_TYPE.Transfer]: t("Luân chuyển"),
});

/** Matches BlueDental.Finance.CashHolding */
export const CASH_HOLDING = { Cash: 1, Bank: 2, CustomerPrepaid: 3, Card: 4 } as const;
export type CashHolding = (typeof CASH_HOLDING)[keyof typeof CASH_HOLDING];

export const cashHoldingLabels = (): Record<CashHolding, string> => ({
  [CASH_HOLDING.Cash]: t("Tiền mặt"),
  [CASH_HOLDING.Bank]: t("Chuyển khoản"),
  [CASH_HOLDING.CustomerPrepaid]: t("Giữ hộ khách"),
  [CASH_HOLDING.Card]: t("Cà thẻ (đối soát)"),
});

/**
 * Which holdings each tab-4 dialog lists under "Hình thức" — read off the
 * reference: only a deposit (Nạp) may land on the card holding.
 */
export const cashHoldingsFor = (transactionType: CashTransactionType): CashHolding[] =>
  transactionType === CASH_TRANSACTION_TYPE.Deposit
    ? [CASH_HOLDING.Cash, CASH_HOLDING.Bank, CASH_HOLDING.Card]
    : [CASH_HOLDING.Cash, CASH_HOLDING.Bank];

/**
 * "Hình thức" of a cash movement: "Tiền mặt → Chuyển khoản" for a transfer,
 * the single holding for a deposit/withdrawal, "—" when neither side is set.
 */
export function formatCashMovement(fromHolding: CashHolding | null, toHolding: CashHolding | null): string {
  const labels = cashHoldingLabels();
  const label = (value: CashHolding | null) => (value === null ? "—" : labels[value]);
  if (fromHolding !== null && toHolding !== null) return `${label(fromHolding)} → ${label(toHolding)}`;
  return label(fromHolding ?? toHolding);
}

export interface SalesEntryDto {
  id: string;
  clinicBranchId: string;
  code: string;
  type: SalesEntryType;
  categoryId: string;
  patientId: string | null;
  staffId: string;
  amount: number;
  channel: PaymentChannel;
  description: string;
  entryDate: string;
  approvalStatus: SalesApprovalStatus;
  approvedByStaffId: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  countsTowardsCashflow: boolean;
  /** Free-text "Người nộp" / "Người nhận" when the voucher is not tied to a patient. */
  payerName: string | null;
  categoryName: string | null;
  staffName: string | null;
  patientName: string | null;
  /** The patient's code, so the table can read "[code] - name" like the reference. */
  patientCode: string | null;
}

export interface SalesStatsDto {
  totalIncome: number;
  totalExpense: number;
  net: number;
  pendingExpense: number;
  pendingExpenseCount: number;
  incomeByCash: number;
  incomeByBanking: number;
  expenseByCash: number;
  expenseByBanking: number;
}

export interface CashBalanceDto {
  total: number;
  cash: number;
  bank: number;
  customerPrepaid: number;
  /** Treatment payments net of refunds ("Doanh thu dịch vụ"). */
  serviceRevenue: number;
  /** Card payments net of refunds plus deposits into the card holding ("Cà thẻ (đối soát)"). */
  cardPending: number;
}

export interface CashflowCategoryTotalDto {
  categoryId: string | null;
  categoryName: string | null;
  amount: number;
  entryCount: number;
}

export interface CashflowOverviewDto {
  balance: CashBalanceDto;
  totalDeposit: number;
  totalWithdraw: number;
  totalTransfer: number;
  entryCount: number;
  byCategory: CashflowCategoryTotalDto[];
}

export interface CashflowEntryDto {
  id: string;
  clinicBranchId: string;
  transactionType: CashTransactionType;
  fromHolding: CashHolding | null;
  toHolding: CashHolding | null;
  amount: number;
  categoryId: string | null;
  createdByStaffId: string;
  entryDate: string;
  note: string | null;
  categoryName: string | null;
  /** The category's colour code, so the ledger pill can wear it like the reference. */
  categoryColor: string | null;
  createdByStaffName: string | null;
  creationTime: string;
}

export interface CashflowCategoryDto {
  id: string;
  clinicBranchId: string;
  name: string;
  type: SalesEntryType;
  appliesToTransfers: boolean;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  description: string | null;
  /** Hex swatch of a cashbook category; sales categories carry none. */
  colorCode: string | null;
}

export interface CreateCashflowCategoryInput {
  clinicBranchId: string;
  name: string;
  type: SalesEntryType;
  appliesToTransfers: boolean;
  sortOrder?: number;
  description?: string;
  colorCode?: string;
}

export interface UpdateCashflowCategoryInput {
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  colorCode?: string;
}

export interface CreateSalesEntryInput {
  clinicBranchId: string;
  type: SalesEntryType;
  categoryId: string;
  staffId: string;
  patientId?: string;
  amount: number;
  channel: PaymentChannel;
  description: string;
  entryDate: string;
  payerName?: string;
}

export interface UpdateSalesEntryInput {
  categoryId: string;
  patientId?: string;
  amount: number;
  channel: PaymentChannel;
  description: string;
  entryDate: string;
  payerName?: string;
}

export interface CreateCashflowEntryInput {
  clinicBranchId: string;
  transactionType: CashTransactionType;
  fromHolding?: CashHolding | null;
  toHolding?: CashHolding | null;
  amount: number;
  categoryId?: string | null;
  createdByStaffId: string;
  entryDate: string;
  note?: string;
}

/** PUT cashflow-entries/{id}: the type and the execution date stay as booked. */
export interface UpdateCashflowEntryInput {
  fromHolding?: CashHolding | null;
  toHolding?: CashHolding | null;
  amount: number;
  categoryId?: string | null;
  note?: string;
}

export interface SalesQueryInput {
  clinicBranchId?: string;
  type?: SalesEntryType;
  fromDate?: string;
  toDate?: string;
  approved?: boolean;
  skipCount?: number;
  maxResultCount?: number;
}

export interface CashflowQueryInput {
  clinicBranchId?: string;
  transactionType?: CashTransactionType;
  fromDate?: string;
  toDate?: string;
  skipCount?: number;
  maxResultCount?: number;
}

const financeApi = {
  categories: (params: {
    clinicBranchId: string;
    appliesToTransfers?: boolean;
    isActive?: boolean;
    maxResultCount?: number;
  }): Promise<PagedResult<CashflowCategoryDto>> =>
    api
      .get<PagedResult<CashflowCategoryDto>>("/v1/app/cashflow-categories", { params })
      .then((r) => r.data),

  createCategory: (input: CreateCashflowCategoryInput): Promise<CashflowCategoryDto> =>
    api.post<CashflowCategoryDto>("/v1/app/cashflow-categories", input).then((r) => r.data),

  updateCategory: (id: string, input: UpdateCashflowCategoryInput): Promise<CashflowCategoryDto> =>
    api.put<CashflowCategoryDto>(`/v1/app/cashflow-categories/${id}`, input).then((r) => r.data),

  deleteCategory: (id: string): Promise<void> =>
    api.delete(`/v1/app/cashflow-categories/${id}`).then(() => undefined),

  createSales: (input: CreateSalesEntryInput): Promise<SalesEntryDto> =>
    api.post<SalesEntryDto>("/v1/app/sales", input).then((r) => r.data),

  updateSales: (id: string, input: UpdateSalesEntryInput): Promise<SalesEntryDto> =>
    api.put<SalesEntryDto>(`/v1/app/sales/${id}`, input).then((r) => r.data),

  /** The reference approves with a bodiless PUT; the server stamps the current user as approver. */
  approveSales: (id: string): Promise<SalesEntryDto> =>
    api.put<SalesEntryDto>(`/v1/app/sales/${id}/approve`).then((r) => r.data),

  deleteSales: (id: string): Promise<void> =>
    api.delete(`/v1/app/sales/${id}`).then(() => undefined),

  createCashflowEntry: (input: CreateCashflowEntryInput): Promise<CashflowEntryDto> =>
    api
      .post<CashflowEntryDto>("/v1/app/cash-management/cashflow-entries", input)
      .then((r) => r.data),

  updateCashflowEntry: (id: string, input: UpdateCashflowEntryInput): Promise<CashflowEntryDto> =>
    api
      .put<CashflowEntryDto>(`/v1/app/cash-management/cashflow-entries/${id}`, input)
      .then((r) => r.data),

  deleteCashflowEntry: (id: string): Promise<void> =>
    api.delete(`/v1/app/cash-management/cashflow-entries/${id}`).then(() => undefined),

  sales: (params: SalesQueryInput): Promise<PagedResult<SalesEntryDto>> =>
    api.get<PagedResult<SalesEntryDto>>("/v1/app/sales", { params }).then((r) => r.data),

  salesStats: (params: SalesQueryInput): Promise<SalesStatsDto> =>
    api.get<SalesStatsDto>("/v1/app/sales/stats", { params }).then((r) => r.data),

  cashBalance: (clinicBranchId: string): Promise<CashBalanceDto> =>
    api
      .get<CashBalanceDto>("/v1/app/cash-management/balance", { params: { clinicBranchId } })
      .then((r) => r.data),

  cashflowOverview: (params: CashflowQueryInput): Promise<CashflowOverviewDto> =>
    api
      .get<CashflowOverviewDto>("/v1/app/cash-management/cashflow-overview", { params })
      .then((r) => r.data),

  cashflowEntries: (params: CashflowQueryInput): Promise<PagedResult<CashflowEntryDto>> =>
    api
      .get<PagedResult<CashflowEntryDto>>("/v1/app/cash-management/cashflow-entries", { params })
      .then((r) => r.data),
};

export const financeKeys = {
  all: ["finance"] as const,
  sales: (params: SalesQueryInput) => [...financeKeys.all, "sales", params] as const,
  salesStats: (params: SalesQueryInput) => [...financeKeys.all, "sales-stats", params] as const,
  cashBalance: (branchId: string) => [...financeKeys.all, "cash-balance", branchId] as const,
  cashflowOverview: (params: CashflowQueryInput) =>
    [...financeKeys.all, "cashflow-overview", params] as const,
  cashflowEntries: (params: CashflowQueryInput) =>
    [...financeKeys.all, "cashflow-entries", params] as const,
};

export function useCashflowCategories(clinicBranchId: string, appliesToTransfers: boolean) {
  return useQuery({
    queryKey: [...financeKeys.all, "categories", clinicBranchId, appliesToTransfers] as const,
    queryFn: () =>
      financeApi.categories({
        clinicBranchId,
        appliesToTransfers,
        isActive: true,
        maxResultCount: 100,
      }),
    enabled: Boolean(clinicBranchId),
  });
}

/**
 * Any finance write invalidates the whole finance tree — lists, stats and balances move together.
 * The clinic reports (overview "Thông tin thu chi", business result) also aggregate sales entries,
 * so they are refreshed as well.
 */
function useFinanceMutation<TVariables, TData>(fn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeKeys.all });
      void queryClient.invalidateQueries({ queryKey: clinicReportKeys.all });
    },
  });
}

export function useCreateCashflowCategory() {
  return useFinanceMutation((input: CreateCashflowCategoryInput) => financeApi.createCategory(input));
}

export function useUpdateCashflowCategory() {
  return useFinanceMutation(({ id, input }: { id: string; input: UpdateCashflowCategoryInput }) =>
    financeApi.updateCategory(id, input),
  );
}

export function useDeleteCashflowCategory() {
  return useFinanceMutation((id: string) => financeApi.deleteCategory(id));
}

export function useCreateSalesEntry() {
  return useFinanceMutation((input: CreateSalesEntryInput) => financeApi.createSales(input));
}

export function useUpdateSalesEntry() {
  return useFinanceMutation(({ id, input }: { id: string; input: UpdateSalesEntryInput }) =>
    financeApi.updateSales(id, input),
  );
}

export function useApproveSalesEntry() {
  return useFinanceMutation((id: string) => financeApi.approveSales(id));
}

export function useDeleteSalesEntry() {
  return useFinanceMutation((id: string) => financeApi.deleteSales(id));
}

export function useCreateCashflowEntry() {
  return useFinanceMutation((input: CreateCashflowEntryInput) =>
    financeApi.createCashflowEntry(input),
  );
}

export function useUpdateCashflowEntry() {
  return useFinanceMutation(({ id, input }: { id: string; input: UpdateCashflowEntryInput }) =>
    financeApi.updateCashflowEntry(id, input),
  );
}

export function useDeleteCashflowEntry() {
  return useFinanceMutation((id: string) => financeApi.deleteCashflowEntry(id));
}

export function useSalesEntries(params: SalesQueryInput) {
  return useQuery({
    queryKey: financeKeys.sales(params),
    queryFn: () => financeApi.sales(params),
  });
}

export function useSalesStats(params: SalesQueryInput) {
  return useQuery({
    queryKey: financeKeys.salesStats(params),
    queryFn: () => financeApi.salesStats(params),
  });
}

export function useCashBalance(clinicBranchId: string) {
  return useQuery({
    queryKey: financeKeys.cashBalance(clinicBranchId),
    queryFn: () => financeApi.cashBalance(clinicBranchId),
    enabled: Boolean(clinicBranchId),
  });
}

export function useCashflowOverview(params: CashflowQueryInput) {
  return useQuery({
    queryKey: financeKeys.cashflowOverview(params),
    queryFn: () => financeApi.cashflowOverview(params),
  });
}

export function useCashflowEntries(params: CashflowQueryInput) {
  return useQuery({
    queryKey: financeKeys.cashflowEntries(params),
    queryFn: () => financeApi.cashflowEntries(params),
  });
}