// Synthetic, deterministic demo data for the report page.
// Nothing here is real production data — names, codes and amounts are invented.
import dayjs, { type Dayjs } from "dayjs";
import {
  CASH_HOLDING,
  CASH_TRANSACTION_TYPE,
  PAYMENT_CHANNEL,
  SALES_APPROVAL_STATUS,
  SALES_ENTRY_TYPE,
  type PaymentChannel,
} from "./financeApi";
import type {
  BusinessResultVm,
  CashBalanceVm,
  CashflowEntryVm,
  CategoryVm,
  DailyTotalVm,
  DebtLineVm,
  MockOption,
  OverviewStatsVm,
  PaymentLineVm,
  PrepaidEventType,
  PrepaidLineVm,
  RefundLineVm,
  SalesEntryVm,
  SalesSummaryVm,
  ServiceLineStatus,
  ServiceLineVm,
} from "../types/mock";

export const MOCK_PATIENTS = [
  { code: "BN0001", name: "Nguyễn Văn An" },
  { code: "BN0002", name: "Trần Thị Bích" },
  { code: "BN0003", name: "Lê Minh Châu" },
  { code: "BN0004", name: "Phạm Quốc Dũng" },
  { code: "BN0005", name: "Hoàng Thị Em" },
  { code: "BN0006", name: "Vũ Đức Phúc" },
  { code: "BN0007", name: "Đặng Thu Giang" },
  { code: "BN0008", name: "Bùi Hữu Hoàng" },
] as const;

export const MOCK_DOCTORS: MockOption[] = [
  { value: "doc-1", label: "BS. Trần Minh Khoa" },
  { value: "doc-2", label: "BS. Lê Thu Hà" },
  { value: "doc-3", label: "BS. Phạm Anh Tuấn" },
];

export const MOCK_STAFF: MockOption[] = [
  { value: "stf-1", label: "NV. Nguyễn Thu Trang" },
  { value: "stf-2", label: "NV. Đỗ Văn Bình" },
  ...MOCK_DOCTORS,
];

export const MOCK_PATIENT_OPTIONS: MockOption[] = MOCK_PATIENTS.map((p) => ({
  value: p.code,
  label: `[${p.code}] - ${p.name}`,
}));

const SERVICES = [
  { name: "Cạo vôi, đánh bóng", price: 300_000 },
  { name: "Trám răng composite", price: 500_000 },
  { name: "Nhổ răng khôn", price: 1_500_000 },
  { name: "Tẩy trắng răng", price: 2_000_000 },
  { name: "Bọc răng sứ", price: 4_000_000 },
  { name: "Niềng răng mắc cài kim loại", price: 25_000_000 },
] as const;

const COUNSELORS = ["NV. Nguyễn Thu Trang", "NV. Đỗ Văn Bình"];
/** Synthetic branch label shared by demo rows and exports. */
export const MOCK_BRANCH_NAME = "NHA KHOA BLUEDENTAL";
const CREATORS = ["Admin", "Lễ tân BD"];
const BANK_INFOS = ["VIETCOMBANK - CTCP DICH VU NHA KHOA", "TECHCOMBANK - PHONG KHAM BLUEDENTAL"];
const PAYMENT_NOTES = ["", "", "Khách chuyển khoản công ty", "Thu đủ đợt 1"];
const CHANNELS: PaymentChannel[] = [
  PAYMENT_CHANNEL.Cash,
  PAYMENT_CHANNEL.Cash,
  PAYMENT_CHANNEL.Banking,
  PAYMENT_CHANNEL.Card,
];

type Rng = { next: () => number; int: (max: number) => number };

/** Small LCG so the same period always renders the same demo rows. */
function seeded(seed: string): Rng {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  return { next, int: (max) => Math.floor(next() * max) };
}

function eachDay(from: string, to: string): Dayjs[] {
  const days: Dayjs[] = [];
  let cur = dayjs(from);
  const end = dayjs(to);
  while (!cur.isAfter(end, "day") && days.length < 400) {
    days.push(cur);
    cur = cur.add(1, "day");
  }
  return days;
}

function mockPatient(i: number) {
  return MOCK_PATIENTS[i % MOCK_PATIENTS.length];
}

function patientLabel(i: number) {
  const p = mockPatient(i);
  return `[${p.code}] - ${p.name}`;
}

const OPEN_STATUSES: ServiceLineStatus[] = ["created", "inProgress", "inProgress", "completed"];

function serviceStatus(rng: Rng): ServiceLineStatus {
  if (rng.next() < 0.1) return "cancelled";
  return OPEN_STATUSES[rng.int(OPEN_STATUSES.length)];
}

function doctorName(rng: Rng, doctorId?: string) {
  const fixed = MOCK_DOCTORS.find((d) => d.value === doctorId);
  return (fixed ?? MOCK_DOCTORS[rng.int(MOCK_DOCTORS.length)]).label;
}

const roundTo = (v: number, unit: number) => Math.round(v / unit) * unit;

export function buildServiceLines(from: string, to: string, doctorId?: string): ServiceLineVm[] {
  const rng = seeded(`svc-${from}-${to}`);
  const days = eachDay(from, to);
  const density = days.length > 60 ? 0.12 : 0.7;
  const lines: ServiceLineVm[] = [];
  let ticketSeq = 1;
  days.forEach((day, di) => {
    if (rng.next() > density) return;
    const patients = 1 + rng.int(2);
    for (let p = 0; p < patients; p++) {
      const patient = mockPatient(rng.int(MOCK_PATIENTS.length));
      const ticketCode = `DT${String(ticketSeq++).padStart(2, "0")}`;
      const items = 1 + rng.int(2);
      for (let s = 0; s < items; s++) {
        const svc = SERVICES[rng.int(SERVICES.length)];
        const status = serviceStatus(rng);
        const cancelled = status === "cancelled";
        const quantity = 1 + rng.int(2);
        const total = svc.price * quantity;
        lines.push({
          id: `svc-${di}-${p}-${s}`,
          date: day.format("YYYY-MM-DD"),
          patientCode: patient.code,
          patientName: patient.name,
          patientLabel: `[${patient.code}] - ${patient.name}`,
          counselorName: COUNSELORS[rng.int(COUNSELORS.length)],
          doctorName: doctorName(rng, doctorId),
          serviceName: svc.name,
          ticketCode,
          status,
          cancelled,
          quantity,
          totalAmount: cancelled ? -total : total,
          paidAmount: cancelled ? 0 : roundTo(total * (0.3 + rng.next() * 0.7), 1000),
        });
      }
    }
  });
  return lines.slice(0, 200);
}

export function buildPaymentLines(from: string, to: string): PaymentLineVm[] {
  const rng = seeded(`pay-${from}-${to}`);
  const days = eachDay(from, to);
  const density = days.length > 60 ? 0.1 : 0.6;
  const lines: PaymentLineVm[] = [];
  days.forEach((day, di) => {
    if (rng.next() > density) return;
    const count = 1 + rng.int(2);
    for (let i = 0; i < count; i++) {
      const svc = SERVICES[rng.int(SERVICES.length)];
      const paid = roundTo(svc.price * (0.2 + rng.next() * 0.8), 100_000) || 100_000;
      const seq = String(lines.length + 1).padStart(2, "0");
      const dt = String(di + 1).padStart(2, "0");
      const patient = MOCK_PATIENTS[rng.int(MOCK_PATIENTS.length)];
      const channel = CHANNELS[rng.int(CHANNELS.length)];
      lines.push({
        id: `pay-${di}-${i}`,
        date: day.format("YYYY-MM-DD"),
        patientLabel: `[${patient.code}] - ${patient.name}`,
        patientCode: patient.code,
        patientName: patient.name,
        paymentCode: `THANHTOAN-${seq}/DT${dt}/${day.format("YYYY")}`,
        createdBy: CREATORS[rng.int(CREATORS.length)],
        treatmentCode: `DT${dt}`,
        branchName: MOCK_BRANCH_NAME,
        serviceNames: svc.name,
        invoiceAmount: svc.price,
        paidAmount: paid,
        actualReceived: paid,
        remainingPrepaid: paid < svc.price ? 0 : roundTo(rng.next() * 500_000, 100_000),
        channel,
        paymentInfo: channel === PAYMENT_CHANNEL.Cash ? "" : BANK_INFOS[rng.int(BANK_INFOS.length)],
        note: PAYMENT_NOTES[rng.int(PAYMENT_NOTES.length)],
      });
    }
  });
  return lines.slice(0, 200);
}

export function buildRefundLines(from: string, to: string): RefundLineVm[] {
  const rng = seeded(`ref-${from}-${to}`);
  const days = eachDay(from, to);
  const density = days.length > 60 ? 0.04 : 0.2;
  const lines: RefundLineVm[] = [];
  days.forEach((day, di) => {
    if (rng.next() > density) return;
    const svc = SERVICES[rng.int(SERVICES.length)];
    const patient = MOCK_PATIENTS[rng.int(MOCK_PATIENTS.length)];
    lines.push({
      id: `ref-${di}`,
      date: day.format("YYYY-MM-DD"),
      patientLabel: `[${patient.code}] - ${patient.name}`,
      patientCode: patient.code,
      patientName: patient.name,
      refundCode: `HOANTIEN-${String(lines.length + 1).padStart(2, "0")}/${day.format("YYYY")}`,
      serviceNames: svc.name,
      refundAmount: roundTo(svc.price * 0.3, 100_000) || 100_000,
      channel: CHANNELS[rng.int(2)],
      note: rng.next() < 0.5 ? "Khách đổi kế hoạch điều trị" : "Hoàn phần chưa thực hiện",
    });
  });
  return lines.slice(0, 100);
}

export function buildDebtLines(from: string, to: string): DebtLineVm[] {
  const rng = seeded(`debt-${from}-${to}`);
  const days = eachDay(from, to);
  const density = days.length > 60 ? 0.05 : 0.3;
  const lines: DebtLineVm[] = [];
  days.forEach((day, di) => {
    if (rng.next() > density) return;
    const svc = SERVICES[rng.int(SERVICES.length)];
    const incurred = roundTo(svc.price * 0.5, 100_000) || 100_000;
    lines.push({
      id: `debt-${di}`,
      date: day.format("YYYY-MM-DD"),
      patientLabel: patientLabel(rng.int(MOCK_PATIENTS.length)),
      counselorName: COUNSELORS[rng.int(COUNSELORS.length)],
      doctorName: doctorName(rng),
      serviceName: svc.name,
      quantity: 1,
      debtIncurred: incurred,
      debtUsed: rng.next() < 0.5 ? roundTo(incurred / 2, 100_000) : 0,
      debtRefund: rng.next() < 0.2 ? 100_000 : 0,
    });
  });
  return lines.slice(0, 100);
}

const PREPAID_EVENTS: PrepaidEventType[] = ["deposit", "deposit", "consume", "consume", "refund"];

export function buildPrepaidLines(from: string, to: string): PrepaidLineVm[] {
  const rng = seeded(`prepaid-${from}-${to}`);
  const days = eachDay(from, to);
  const density = days.length > 60 ? 0.05 : 0.3;
  const balances = new Map<string, number>();
  const lines: PrepaidLineVm[] = [];
  days.forEach((day, di) => {
    if (rng.next() > density) return;
    const label = patientLabel(rng.int(MOCK_PATIENTS.length));
    const svc = SERVICES[rng.int(SERVICES.length)];
    const before = balances.get(label) ?? 0;
    // Only a patient holding a balance can consume or be refunded from it.
    const eventType = before > 0 ? PREPAID_EVENTS[rng.int(PREPAID_EVENTS.length)] : "deposit";
    const deposit = roundTo(svc.price * 0.5, 100_000) || 100_000;
    const amount =
      eventType === "deposit" ? deposit : -Math.min(before, roundTo(before * 0.6, 100_000) || before);
    const balanceAfter = before + amount;
    balances.set(label, balanceAfter);
    lines.push({
      id: `prepaid-${di}`,
      date: day.format("YYYY-MM-DD"),
      patientLabel: label,
      eventType,
      serviceName: eventType === "refund" ? "" : svc.name,
      paymentCode: `THANHTOAN-${String(lines.length + 1).padStart(2, "0")}/TU/${day.format("YYYY")}`,
      doctorName: doctorName(rng),
      amount,
      balanceAfter,
    });
  });
  return lines.slice(0, 100);
}

export function buildDailyTotals(
  from: string,
  to: string,
  lines: { date: string; amount: number }[],
): DailyTotalVm[] {
  const byDate = new Map<string, number>();
  for (const l of lines) byDate.set(l.date, (byDate.get(l.date) ?? 0) + l.amount);
  return eachDay(from, to)
    .map((d) => d.format("YYYY-MM-DD"))
    .reverse()
    .slice(0, 60)
    .map((date) => ({ date, amount: byDate.get(date) ?? 0 }));
}

export function buildSalesSummary(from: string, to: string): SalesSummaryVm {
  const payments = buildPaymentLines(from, to);
  const refunds = buildRefundLines(from, to);
  const debts = buildDebtLines(from, to);
  const prepaid = buildPrepaidLines(from, to);
  const services = buildServiceLines(from, to);
  const sumBy = (ch: PaymentChannel) =>
    payments.filter((p) => p.channel === ch).reduce((s, p) => s + p.paidAmount, 0);
  const refundBy = (ch: PaymentChannel) =>
    refunds.filter((r) => r.channel === ch).reduce((s, r) => s + r.refundAmount, 0);
  const debtIncurred = debts.reduce((s, d) => s + d.debtIncurred, 0);
  const prepaidBy = (type: PrepaidEventType) =>
    prepaid.filter((p) => p.eventType === type).reduce((s, p) => s + Math.abs(p.amount), 0);
  const prepaidIncurred = prepaidBy("deposit");
  const prepaidConsumed = prepaidBy("consume");
  const prepaidRefund = prepaidBy("refund");
  return {
    revenue: services.reduce((s, l) => s + l.totalAmount, 0),
    byCash: sumBy(PAYMENT_CHANNEL.Cash),
    byBanking: sumBy(PAYMENT_CHANNEL.Banking),
    byCard: sumBy(PAYMENT_CHANNEL.Card),
    byDebt: debtIncurred,
    refund: refunds.reduce((s, r) => s + r.refundAmount, 0),
    refundByCash: refundBy(PAYMENT_CHANNEL.Cash),
    refundByBanking: refundBy(PAYMENT_CHANNEL.Banking),
    refundByCard: refundBy(PAYMENT_CHANNEL.Card),
    actualReceived: payments.reduce((s, p) => s + p.actualReceived, 0),
    debtIncurred,
    debtUsed: debts.reduce((s, d) => s + d.debtUsed, 0),
    debtRefund: debts.reduce((s, d) => s + d.debtRefund, 0),
    prepaidIncurred,
    prepaidConsumed,
    prepaidRefund,
    prepaidBalance: prepaidIncurred - prepaidConsumed - prepaidRefund,
  };
}

const MONTHS = Array.from({ length: 12 }, (_, i) => `T${i + 1}`);
const OVERVIEW_LABELS = ["Hôm nay", "Tuần này", "Tháng này", "Năm nay", "Toàn bộ"];

export function buildOverviewStats(): OverviewStatsVm {
  const rng = seeded("overview");
  const series = (scaleA: number, scaleB: number, scaleC?: number) =>
    MONTHS.map((month) => ({
      month,
      a: Math.round(scaleA * (0.4 + rng.next())),
      b: Math.round(scaleB * (0.4 + rng.next())),
      ...(scaleC ? { c: Math.round(scaleC * (0.4 + rng.next())) } : {}),
    }));
  const rows = (base: number[]) =>
    OVERVIEW_LABELS.map((label, i) => ({
      label,
      values: base.map((b) => Math.round(b * (i + 1) * (i + 1) * 0.5)),
    }));
  return {
    visits: rows([3]),
    appointments: rows([4]),
    payments: rows([200_000, 1_300_000]),
    incomeExpense: rows([1_300_000, 450_000]),
    visitSeries: series(12, 30),
    appointmentSeries: series(20, 35, 5),
    paymentSeries: series(800_000, 12_000_000),
    incomeExpenseSeries: series(12_000_000, 4_000_000),
  };
}

const INCOME_CATEGORIES = ["Thu dịch vụ", "Thu khác", "Bán sản phẩm"];
const EXPENSE_CATEGORIES = ["Vật tư", "Lương nhân viên", "Điện nước", "Marketing"];

export function buildCategories(): CategoryVm[] {
  const income = INCOME_CATEGORIES.map((name, i) => ({
    id: `cat-in-${i}`,
    name,
    type: SALES_ENTRY_TYPE.Income,
    priority: i + 1,
    colorCode: null,
  }));
  const expense = EXPENSE_CATEGORIES.map((name, i) => ({
    id: `cat-ex-${i}`,
    name,
    type: SALES_ENTRY_TYPE.Expense,
    priority: i + 1,
    colorCode: null,
  }));
  return [...income, ...expense];
}

const CASHBOOK_COLORS = ["#6366f1", "#0e9f6e", "#d98b0f", "#e5484d"];
const CASHBOOK_NAMES = ["Doanh thu dịch vụ", "Chi vật tư", "Nộp ngân hàng", "Rút tiền mặt"];

export function buildCashbookCategories(): CategoryVm[] {
  return CASHBOOK_NAMES.map((name, i) => ({
    id: `cb-${i}`,
    name,
    type: SALES_ENTRY_TYPE.Income,
    priority: i + 1,
    colorCode: CASHBOOK_COLORS[i],
  }));
}

const APPROVAL_POOL = [
  SALES_APPROVAL_STATUS.Pending,
  SALES_APPROVAL_STATUS.Approved,
  SALES_APPROVAL_STATUS.Approved,
  SALES_APPROVAL_STATUS.Rejected,
];

export function buildSalesEntries(from: string, to: string): SalesEntryVm[] {
  const rng = seeded(`sales-${from}-${to}`);
  const days = eachDay(from, to);
  const density = days.length > 60 ? 0.1 : 0.5;
  const entries: SalesEntryVm[] = [];
  days.forEach((day, di) => {
    if (rng.next() > density) return;
    const isExpense = rng.next() < 0.5;
    const n = String(entries.length + 1).padStart(3, "0");
    const expenseCat = EXPENSE_CATEGORIES[rng.int(EXPENSE_CATEGORIES.length)];
    const patient = isExpense ? null : mockPatient(rng.int(MOCK_PATIENTS.length));
    entries.push({
      id: `se-${di}`,
      code: `${isExpense ? "PC" : "PT"}-${n}`,
      type: isExpense ? SALES_ENTRY_TYPE.Expense : SALES_ENTRY_TYPE.Income,
      entryDate: day.format("YYYY-MM-DD"),
      paidDate: day.add(isExpense ? rng.int(3) : 0, "day").format("YYYY-MM-DD"),
      patientCode: patient?.code ?? null,
      patientName: patient?.name ?? null,
      patientLabel: patient ? `[${patient.code}] - ${patient.name}` : null,
      description: isExpense
        ? `Chi ${expenseCat.toLowerCase()} tháng ${day.format("MM")}`
        : "Thu tiền dịch vụ điều trị",
      staffName: MOCK_STAFF[rng.int(2)].label,
      categoryName: isExpense ? expenseCat : INCOME_CATEGORIES[rng.int(INCOME_CATEGORIES.length)],
      amount: (1 + rng.int(20)) * 100_000,
      channel: CHANNELS[rng.int(3)],
      approvalStatus: isExpense ? APPROVAL_POOL[rng.int(APPROVAL_POOL.length)] : SALES_APPROVAL_STATUS.NotRequired,
    });
  });
  return entries.slice(0, 120);
}

const CASH_TYPES = [
  CASH_TRANSACTION_TYPE.Deposit,
  CASH_TRANSACTION_TYPE.Withdraw,
  CASH_TRANSACTION_TYPE.Transfer,
];

export function buildCashflowEntries(): CashflowEntryVm[] {
  const rng = seeded("cashflow-v2");
  const cats = buildCashbookCategories();
  return Array.from({ length: 12 }, (_, i) => {
    const type = CASH_TYPES[rng.int(CASH_TYPES.length)];
    const isTransfer = type === CASH_TRANSACTION_TYPE.Transfer;
    const isDeposit = type === CASH_TRANSACTION_TYPE.Deposit;
    return {
      id: `cf-${i}`,
      entryDate: dayjs().subtract(i * 3, "day").format("YYYY-MM-DD"),
      transactionType: type,
      fromHolding: isDeposit ? null : CASH_HOLDING.Cash,
      toHolding: isTransfer ? CASH_HOLDING.Bank : isDeposit ? CASH_HOLDING.Cash : null,
      categoryName: cats[rng.int(cats.length)].name,
      amount: (1 + rng.int(30)) * 500_000,
      createdByName: MOCK_STAFF[rng.int(2)].label,
      note: rng.next() < 0.4 ? "Giao dịch demo" : null,
    };
  });
}

export function buildCashBalance(): CashBalanceVm {
  return {
    total: 48_500_000,
    cash: 18_200_000,
    bank: 27_300_000,
    customerPrepaid: 3_000_000,
    serviceRevenue: 36_800_000,
  };
}

export function buildBusinessResult(from: string, to: string): BusinessResultVm {
  const summary = buildSalesSummary(from, to);
  const entries = buildSalesEntries(from, to);
  const otherIncome = entries
    .filter((e) => e.type === SALES_ENTRY_TYPE.Income)
    .reduce((s, e) => s + e.amount, 0);
  const expense = entries
    .filter((e) => e.type === SALES_ENTRY_TYPE.Expense && e.approvalStatus === SALES_APPROVAL_STATUS.Approved)
    .reduce((s, e) => s + e.amount, 0);
  const treatmentIncome = summary.actualReceived;
  return {
    totalRevenue: treatmentIncome + otherIncome,
    treatmentIncome,
    otherIncome,
    treatmentRefund: summary.refund,
    expense,
    result: treatmentIncome + otherIncome - summary.refund - expense,
  };
}
