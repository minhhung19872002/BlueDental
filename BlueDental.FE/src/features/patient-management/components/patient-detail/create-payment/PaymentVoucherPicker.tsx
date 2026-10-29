import { Select } from "antd";
import { TagOutlined } from "@ant-design/icons";
import { formatVoucherValue } from "@/features/voucher/api/voucherApi";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import { foldFilterOption } from "@/utils/foldForSearch";
import type { RoundVoucher } from "./useRoundVoucher";

/**
 * The voucher of this đợt (P2910): one at most, taken on what the chosen
 * services still owe before VAT and split evenly over those it reaches. Only
 * those that would take something off are offered. Hidden without Khuyến mãi
 * → Xem; a reopened receipt then keeps the voucher it holds.
 */
export function PaymentVoucherPicker({ voucher }: { voucher: RoundVoucher }) {
  if (!voucher.canView) return null;
  const options = voucher.offered.map((item) => ({
    value: item.id,
    label: `${item.code} · ${formatVoucherValue(item)}`,
  }));
  return (
    <div className="pd-newpay-voucher">
      <Select
        allowClear
        showSearch
        filterOption={foldFilterOption}
        className="pd-newpay-voucher-select"
        aria-label={t("Patient:Payment:VoucherLabel")}
        prefix={<TagOutlined />}
        placeholder={t("Patient:Payment:VoucherPlaceholder")}
        notFoundContent={t("Patient:Payment:NoVoucher")}
        options={options}
        value={voucher.value ?? undefined}
        onChange={(id?: string) => voucher.choose(id ?? null)}
      />
      {voucher.applied ? (
        <b className="pd-newpay-voucher-off">−{formatMoneyUnit(voucher.price.total)}</b>
      ) : (
        <small className="pd-newpay-hint">{t("Patient:Payment:VoucherCount", voucher.offered.length)}</small>
      )}
    </div>
  );
}
