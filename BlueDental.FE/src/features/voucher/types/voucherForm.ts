import dayjs from "dayjs";
import type { VoucherDiscountType, VoucherScopeTarget } from "../api/voucherApi";

export interface VoucherFormValues {
  prefix?: string;
  code?: string;
  name: string;
  description?: string;
  discountType: VoucherDiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  scopeTarget: VoucherScopeTarget;
  targetIds: string[];
  minOrderValue?: number | null;
  startDate: dayjs.Dayjs;
  endDate: dayjs.Dayjs;
  usageLimit?: number | null;
  perCustomerLimit?: number | null;
  isExclusive: boolean;
  customerTargets: string[];
  isDaysOfWeekLimited: boolean;
  daysOfWeek: number[];
  displayOnNfcDental: boolean;
  /** Batch tab only: how many codes to create at once. */
  batchCount?: number;
  /** Batch tab only: the code of the card being configured individually. */
  batchCode?: string;
}

/**
 * The part of the form every voucher of a batch carries as its own
 * configuration. Code and name live on the card itself.
 */
export type VoucherBatchItemValues = Omit<
  VoucherFormValues,
  "prefix" | "code" | "name" | "batchCount" | "batchCode"
>;

export const VOUCHER_FORM_DEFAULTS: VoucherFormValues = {
  prefix: "",
  code: "",
  name: "",
  description: "",
  discountType: "percentage",
  discountValue: 10,
  maxDiscountAmount: null,
  scopeTarget: "service",
  targetIds: [],
  minOrderValue: null,
  startDate: dayjs(),
  endDate: dayjs().add(30, "day"),
  usageLimit: null,
  perCustomerLimit: null,
  isExclusive: false,
  customerTargets: ["new", "returning"],
  isDaysOfWeekLimited: false,
  daysOfWeek: [],
  displayOnNfcDental: true,
  batchCount: 1,
  batchCode: "",
};

export function pickBatchItemValues(v: VoucherFormValues): VoucherBatchItemValues {
  return {
    description: v.description,
    discountType: v.discountType,
    discountValue: v.discountValue,
    maxDiscountAmount: v.maxDiscountAmount,
    scopeTarget: v.scopeTarget,
    targetIds: v.targetIds,
    minOrderValue: v.minOrderValue,
    startDate: v.startDate,
    endDate: v.endDate,
    usageLimit: v.usageLimit,
    perCustomerLimit: v.perCustomerLimit,
    isExclusive: v.isExclusive,
    customerTargets: v.customerTargets,
    isDaysOfWeekLimited: v.isDaysOfWeekLimited,
    daysOfWeek: v.daysOfWeek,
    displayOnNfcDental: v.displayOnNfcDental,
  };
}
