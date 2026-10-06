import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { t } from "@/lib/i18n";

/** Matches BlueDental.Billing.PaymentMethodKind. */
export const LEDGER_METHOD = {
  Cash: 1,
  Banking: 2,
  Card: 3,
  OutstandingDebt: 4,
  EWallet: 5,
} as const;
export type LedgerMethod = (typeof LEDGER_METHOD)[keyof typeof LEDGER_METHOD];

/** The wording the plan's Thanh toán tab uses for the same receipts. */
export const ledgerMethodLabels = (): Record<LedgerMethod, string> => ({
  [LEDGER_METHOD.Cash]: t("Treatment:Payment:Cash"),
  [LEDGER_METHOD.Banking]: t("Treatment:Payment:Banking"),
  [LEDGER_METHOD.EWallet]: t("Treatment:Payment:EWallet"),
  [LEDGER_METHOD.Card]: t("Treatment:Payment:Card"),
  [LEDGER_METHOD.OutstandingDebt]: t("Treatment:Debt:OutstandingDebt"),
});

/** Matches BlueDental.Billing.PaymentLedgerItemDto. */
export interface PaymentLedgerItemDto {
  id: string;
  code: string;
  paidAt: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  treatmentPlanId: string | null;
  treatmentPlanCode: string | null;
  treatmentPlanTitle: string | null;
  serviceNames: string;
  amount: number;
  method: LedgerMethod;
  staffName: string | null;
  note: string | null;
  /** Server-side: no published invoice of its own and its slip not billed whole. */
  canIssueEInvoice: boolean;
}

export interface PaymentLedgerResult {
  items: PaymentLedgerItemDto[];
  totalCount: number;
  /** Sum of every receipt the filter matches, not just this page. */
  totalAmount: number;
}

export interface PaymentLedgerParams {
  filter?: string;
  /** `YYYY-MM-DD`, clinic-local, inclusive. */
  fromDate?: string;
  toDate?: string;
  skipCount?: number;
  maxResultCount?: number;
}

const LEDGER_URL = "/v1/app/payment-ledger";
export const PAYMENT_LEDGER_EXCEL_URL = `${LEDGER_URL}/excel`;

export const paymentLedgerKeys = {
  all: ["payment-ledger"] as const,
  // The branch is part of the key: the server scopes by the signed-in branch,
  // so switching branch must not show the previous one's cached page.
  list: (branchId: string, params: PaymentLedgerParams) =>
    [...paymentLedgerKeys.all, branchId, params] as const,
};

/**
 * Tài chính → Thanh toán. Receipts are written on a plan's Thanh toán tab;
 * that mutation names the "payment" entity, which invalidates this key.
 */
export function usePaymentLedger(branchId: string, params: PaymentLedgerParams) {
  return useQuery({
    queryKey: paymentLedgerKeys.list(branchId, params),
    queryFn: () =>
      api.get<PaymentLedgerResult>(LEDGER_URL, { params }).then((response) => response.data),
    placeholderData: keepPreviousData,
  });
}
