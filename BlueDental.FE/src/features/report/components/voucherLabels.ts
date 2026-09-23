import { t } from "@/lib/i18n";
import { SALES_ENTRY_TYPE, type SalesEntryType } from "../api/financeApi";

/** Everything on a Thu nhập / Chi phí voucher that changes with its type. */
export interface VoucherLabels {
  title: string;
  printButton: string;
  actualDate: string;
  content: string;
  category: string;
  staff: string;
  amount: string;
  receiver: string;
}

/** The reference's `ev(type)` table: income vouchers read "thu", expense ones "chi". */
export function voucherLabels(type: SalesEntryType): VoucherLabels {
  if (type === SALES_ENTRY_TYPE.Expense) {
    return {
      title: t("Report:Voucher:ExpenseTitle"),
      printButton: t("Report:EntryDetail:PrintExpense"),
      actualDate: t("Report:SalesModal:ActualExpenseDate"),
      content: t("Report:SalesModal:ExpenseDescription"),
      category: t("Report:SalesModal:ExpenseCategory"),
      staff: t("Report:Voucher:ExpenseStaff"),
      amount: t("Report:Column:TotalMoney"),
      receiver: t("Report:SalesModal:Receiver"),
    };
  }
  return {
    title: t("Report:Voucher:IncomeTitle"),
    printButton: t("Report:EntryDetail:PrintIncome"),
    actualDate: t("Report:SalesModal:ActualIncomeDate"),
    content: t("Report:SalesModal:IncomeDescription"),
    category: t("Report:SalesModal:IncomeCategory"),
    staff: t("Report:Voucher:IncomeStaff"),
    amount: t("Report:BusinessResult:Revenue"),
    receiver: t("Report:SalesModal:Payer"),
  };
}
