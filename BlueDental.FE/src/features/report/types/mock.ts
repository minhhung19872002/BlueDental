import type {
  CashHolding,
  CashTransactionType,
  PaymentChannel,
  SalesApprovalStatus,
  SalesEntryType,
} from "../api/financeApi";

/** Synthetic patient — never real production data. */
export interface MockPatient {
  code: string;
  name: string;
}

export interface MockOption {
  value: string;
  label: string;
}

/** Treatment-ticket service status as the reference labels it in its Excel export. */
export type ServiceLineStatus = "created" | "inProgress" | "completed" | "cancelled";

export interface ServiceLineVm {
  id: string;
  date: string; // YYYY-MM-DD
  patientCode: string;
  patientName: string;
  /** `[code] - NAME`, the table's display form. */
  patientLabel: string;
  counselorName: string;
  doctorName: string;
  serviceName: string;
  /** Treatment ticket the service belongs to (e.g. DT05). */
  ticketCode: string;
  status: ServiceLineStatus;
  cancelled: boolean;
  quantity: number;
  totalAmount: number;
  paidAmount: number;
}

/**
 * One payment voucher line. The table shows a subset; the Excel export writes
 * every field, in the reference's column order (see docs/clone/pages/report.md).
 */
export interface PaymentLineVm {
  id: string;
  date: string;
  /** "[code] - name", the table's patient link. */
  patientLabel: string;
  patientCode: string;
  patientName: string;
  paymentCode: string;
  createdBy: string;
  treatmentCode: string;
  branchName: string;
  serviceNames: string;
  invoiceAmount: number;
  paidAmount: number;
  actualReceived: number;
  remainingPrepaid: number;
  channel: PaymentChannel;
  /** Bank / card details for non-cash channels, empty for cash. */
  paymentInfo: string;
  note: string;
}

export interface RefundLineVm {
  id: string;
  date: string;
  /** "[code] - name", the table's patient link. */
  patientLabel: string;
  patientCode: string;
  patientName: string;
  /** `HOANTIEN-NN/yyyy`; the table heads it "Mã thanh toán", the workbook "Mã hoàn tiền". */
  refundCode: string;
  serviceNames: string;
  refundAmount: number;
  channel: PaymentChannel;
  note: string;
}

export interface DebtLineVm {
  id: string;
  date: string;
  patientLabel: string;
  counselorName: string;
  doctorName: string;
  serviceName: string;
  quantity: number;
  debtIncurred: number;
  debtUsed: number;
  debtRefund: number;
}

export interface DailyTotalVm {
  date: string;
  amount: number;
}

export interface SalesSummaryVm {
  revenue: number;
  byCash: number;
  byBanking: number;
  byCard: number;
  byDebt: number;
  refund: number;
  refundByCash: number;
  refundByBanking: number;
  refundByCard: number;
  actualReceived: number;
  debtIncurred: number;
  debtUsed: number;
  debtRefund: number;
}

export interface OverviewRowVm {
  label: string;
  values: number[];
}

export interface MonthlyPointVm {
  month: string;
  a: number;
  b: number;
  c?: number;
}

export interface OverviewStatsVm {
  visits: OverviewRowVm[];
  appointments: OverviewRowVm[];
  payments: OverviewRowVm[];
  incomeExpense: OverviewRowVm[];
  visitSeries: MonthlyPointVm[];
  appointmentSeries: MonthlyPointVm[];
  paymentSeries: MonthlyPointVm[];
  incomeExpenseSeries: MonthlyPointVm[];
}

export interface SalesEntryVm {
  id: string;
  code: string;
  type: SalesEntryType;
  entryDate: string;
  paidDate: string;
  patientCode: string | null;
  patientName: string | null;
  patientLabel: string | null;
  description: string;
  staffName: string;
  categoryName: string;
  amount: number;
  channel: PaymentChannel;
  approvalStatus: SalesApprovalStatus;
}

export interface CategoryVm {
  id: string;
  name: string;
  type: SalesEntryType;
  priority: number;
  colorCode: string | null;
}

export interface CashflowEntryVm {
  id: string;
  entryDate: string;
  transactionType: CashTransactionType;
  fromHolding: CashHolding | null;
  toHolding: CashHolding | null;
  categoryName: string | null;
  amount: number;
  createdByName: string;
  note: string | null;
}

export interface CashBalanceVm {
  total: number;
  cash: number;
  bank: number;
  customerPrepaid: number;
  serviceRevenue: number;
}

export interface BusinessResultVm {
  totalRevenue: number;
  treatmentIncome: number;
  otherIncome: number;
  treatmentRefund: number;
  expense: number;
  result: number;
}
