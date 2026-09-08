import { Button, Input, Popover, Spin } from "antd";
import { CheckCircleFilled, SearchOutlined, TagOutlined } from "@ant-design/icons";
import {
  calculateVoucherDiscount,
  formatVoucherValue,
  type VoucherDto,
} from "@/features/voucher/api/voucherApi";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import type { PlanVoucherState } from "../../hooks/usePlanVoucher";

/**
 * "Voucher áp dụng" under the plan total — staging's tag button that drops a
 * search-and-pick popover: the search box with "Đã chọn: n" beside it, then a
 * bordered box of voucher cards (or the reference's empty sentence). A picked
 * card turns green, and the button outside counts the picks as "Voucher (n)".
 */
function VoucherRow({
  voucher,
  saving,
  active,
  onToggle,
}: {
  voucher: VoucherDto;
  saving: number;
  active: boolean;
  onToggle: (voucher: VoucherDto) => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={["pd-voucher-row", active && "pd-voucher-row--on"].filter(Boolean).join(" ")}
        aria-pressed={active}
        onClick={() => onToggle(voucher)}
      >
        <span className="pd-voucher-row__mark" aria-hidden>
          {active ? <CheckCircleFilled /> : <span className="pd-voucher-row__ring" />}
        </span>
        <span className="pd-voucher-row__body">
          <span className="pd-voucher-row__head">
            <b className="pd-voucher-row__code">{voucher.code}</b>
            <span className="pd-voucher-row__value">{formatVoucherValue(voucher)}</span>
            <span className="pd-voucher-row__scope">{t("Kế hoạch")}</span>
          </span>
          <span className="pd-voucher-row__name">{voucher.name}</span>
          <small className="pd-voucher-row__saving">
            {t("≈ giảm {0}", formatMoneyUnit(saving))}
          </small>
        </span>
      </button>
    </li>
  );
}

function VoucherList({ plan }: { plan: PlanVoucherState }) {
  if (plan.loading) {
    return (
      <div className="pd-voucher-list pd-voucher-list--empty">
        <Spin size="small" />
      </div>
    );
  }
  if (plan.vouchers.length === 0) {
    return (
      <div className="pd-voucher-list pd-voucher-list--empty">
        <p>{t("Không có voucher nào khả dụng cho kế hoạch điều trị.")}</p>
      </div>
    );
  }
  return (
    <ul className="pd-voucher-list" aria-label={t("Voucher khả dụng")}>
      {plan.vouchers.map((voucher) => (
        <VoucherRow
          key={voucher.id}
          voucher={voucher}
          saving={calculateVoucherDiscount(voucher, plan.gross)}
          active={plan.selected.some((item) => item.id === voucher.id)}
          onToggle={plan.toggle}
        />
      ))}
    </ul>
  );
}

export function AdviseVoucherPicker({ plan }: { plan: PlanVoucherState }) {
  const count = plan.selected.length;

  return (
    <div className="pd-plan-voucher">
      <span>{t("Voucher áp dụng")}:</span>
      <Popover
        trigger="click"
        placement="topLeft"
        content={
          <div className="pd-voucher-popover">
            <div className="pd-voucher-search">
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder={t("Tìm voucher theo mã hoặc tên...")}
                aria-label={t("Tìm voucher")}
                value={plan.query}
                onChange={(event) => plan.setQuery(event.target.value)}
              />
              <small>{t("Đã chọn: {0}", count)}</small>
            </div>
            <VoucherList plan={plan} />
          </div>
        }
      >
        <Button icon={<TagOutlined />}>
          {count === 0 ? t("Chọn voucher") : t("Voucher ({0})", count)}
        </Button>
      </Popover>
      {count === 0 && <em>{t("Chưa có voucher nào cho kế hoạch điều trị.")}</em>}
    </div>
  );
}
