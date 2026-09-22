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
      title: t("PHIẾU CHI"),
      printButton: t("In chi phí"),
      actualDate: t("Ngày thực chi"),
      content: t("Nội dung chi"),
      category: t("Mục chi"),
      staff: t("Nhân viên chi"),
      amount: t("Tổng tiền"),
      receiver: t("Người nhận"),
    };
  }
  return {
    title: t("PHIẾU THU"),
    printButton: t("In khoản thu"),
    actualDate: t("Ngày thực thu"),
    content: t("Nội dung thu"),
    category: t("Mục thu"),
    staff: t("Nhân viên thu"),
    amount: t("Doanh thu"),
    receiver: t("Người nộp"),
  };
}
