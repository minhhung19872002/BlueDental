/**
 * Thẻ trả trước (function list cụm 3). BlueDental-local — the reference has no
 * prepaid cards; decisions in docs/clone/pages/prepaid-card.md. These mirror
 * the DTOs of BlueDental.PrepaidCards.
 */

/** Mirrors BlueDental.PrepaidCards.PrepaidCardStatus. */
export const CARD_STATUS = { Active: 1, Locked: 2 } as const;
export type CardStatus = (typeof CARD_STATUS)[keyof typeof CARD_STATUS];

/** Mirrors BlueDental.PrepaidCards.PrepaidCardListState — the status filter of the list. */
export const CARD_STATE = { Usable: 1, Locked: 2, Exhausted: 3 } as const;
export type CardState = (typeof CARD_STATE)[keyof typeof CARD_STATE];

/** Mirrors BlueDental.PrepaidCards.PrepaidCardCommissionType. */
export const COMMISSION_TYPE = { Percent: 1, Amount: 2 } as const;
export type CommissionType = (typeof COMMISSION_TYPE)[keyof typeof COMMISSION_TYPE];

/** Mirrors BlueDental.PrepaidCards.PrepaidCardTransactionType. */
export const TRANSACTION_TYPE = { Issue: 1, Topup: 2, Use: 3, Refund: 4 } as const;
export type TransactionType = (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];

/**
 * How the money for a card is taken — the subset of BlueDental.Billing.PaymentMethodKind
 * a card may be bought with (cash, bank transfer, card swipe, e-wallet).
 */
export const SALE_METHOD = { Cash: 1, Banking: 2, Card: 3, EWallet: 5 } as const;
export type SaleMethod = (typeof SALE_METHOD)[keyof typeof SALE_METHOD];

export interface CardTypeDto {
  id: string;
  clinicBranchId: string;
  name: string;
  salePrice: number;
  usageValue: number;
  maxUses: number | null;
  commissionType: CommissionType;
  commissionValue: number;
  allowFamily: boolean;
  serviceIds: string[];
  serviceGroupIds: string[];
  isOnSale: boolean;
  note: string | null;
  soldCount: number;
  creationTime: string;
}

export interface SaveCardTypeInput {
  name: string;
  salePrice: number;
  usageValue: number;
  maxUses: number | null;
  commissionType: CommissionType;
  commissionValue: number;
  allowFamily: boolean;
  serviceIds: string[];
  serviceGroupIds: string[];
  isOnSale: boolean;
  note: string | null;
}

export interface CardMemberDto {
  patientId: string;
  name: string | null;
  code: string | null;
}

export interface CardDto {
  id: string;
  clinicBranchId: string;
  code: string;
  cardTypeId: string;
  name: string;
  ownerPatientId: string;
  ownerName: string | null;
  ownerCode: string | null;
  allowFamily: boolean;
  members: CardMemberDto[];
  salePrice: number;
  usageValue: number;
  totalLoaded: number;
  balance: number;
  maxUses: number | null;
  usedCount: number;
  remainingUses: number | null;
  serviceIds: string[];
  serviceGroupIds: string[];
  sellerStaffId: string;
  sellerName: string | null;
  commissionAmount: number;
  soldAt: string;
  status: CardStatus;
  isExhausted: boolean;
  note: string | null;
}

export interface CardTransactionDto {
  id: string;
  sequence: number;
  type: TransactionType;
  value: number;
  balanceAfter: number;
  paidAmount: number;
  method: number | null;
  patientId: string | null;
  patientName: string | null;
  patientPaymentId: string | null;
  patientPaymentCode: string | null;
  staffName: string | null;
  occurredAt: string;
  note: string | null;
}

export interface CardDetailDto extends CardDto {
  /** Newest first, each with the balance it left. */
  transactions: CardTransactionDto[];
}

export interface CardSummaryDto {
  cardCount: number;
  usableCount: number;
  outstandingBalance: number;
  moneyReceived: number;
  commissionTotal: number;
}

export interface CardListFilter {
  filter: string;
  state: CardState | undefined;
  cardTypeId: string | undefined;
  skipCount: number;
  maxResultCount: number;
}

/** How a card sale or a top-up was paid for. */
export interface MoneyTaken {
  method: SaleMethod;
  paymentAccountId: string | null;
}

export interface SellCardInput extends MoneyTaken {
  cardTypeId: string;
  ownerPatientId: string;
  memberPatientIds: string[];
  sellerStaffId: string;
  note: string | null;
}

export interface TopupCardInput extends MoneyTaken {
  value: number;
  paidAmount: number;
  note: string | null;
}
