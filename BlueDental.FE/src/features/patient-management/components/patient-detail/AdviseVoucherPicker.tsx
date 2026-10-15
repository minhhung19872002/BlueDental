import { Button, Input, Popover } from "antd";
import { CheckCircleFilled, CloseOutlined, SearchOutlined, TagOutlined } from "@ant-design/icons";
import { formatVoucherValue, type VoucherDto } from "@/features/voucher/api/voucherApi";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";
import type { PlanVoucherState } from "../../hooks/usePlanVoucher";
import { SelectLoading } from "@/components/SelectLoading";

/**
 * "Voucher áp dụng" under the plan total — staging's tag button that drops a
 * search-and-pick popover: the search box with "Đã chọn: n" beside it, then a
 * bordered box of voucher cards (or the reference's empty sentence). A picked
 * card turns green, and the button outside counts the picks as "Voucher (n)".
 * Each pick then gets a boxed line of its own under the button — code, what it
 * takes off, the amount, and a × to drop it (project owner's layout, 2026-09-30).
 */
/** "Áp cho: Tẩy trắng, Trám răng" under a "Theo dịch vụ" voucher; nothing for a plan one. */
function VoucherTargets({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <small className="pd-voucher-targets" title={names.join(", ")}>
      {t("Patient:VoucherAppliesTo", names.join(", "))}
    </small>
  );
}

function VoucherRow({
  voucher,
  saving,
  targets,
  active,
  onToggle,
}: {
  voucher: VoucherDto;
  saving: number;
  targets: string[];
  active: boolean;
  onToggle: (voucher: VoucherDto) => void;
}) {
  const scope = voucher.scopeTarget === "service" ? "Patient:VoucherService" : "Patient:VoucherPlan";
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
            <span className="pd-voucher-row__scope">{t(scope)}</span>
          </span>
          <span className="pd-voucher-row__name">{voucher.name}</span>
          <VoucherTargets names={targets} />
          <small className="pd-voucher-row__saving">
            {t("Patient:VoucherSaving", formatMoneyUnit(saving))}
          </small>
        </span>
      </button>
    </li>
  );
}

function VoucherList({ plan }: { plan: PlanVoucherState }) {
  // Placeholder cards rather than a spinner the list then pushes open.
  if (plan.loading) return <SelectLoading rows={3} rowHeight={70} trailing />;
  if (plan.vouchers.length === 0) {
    return (
      <div className="pd-voucher-list pd-voucher-list--empty">
        <p>{t("Patient:NoVoucherForPlan")}</p>
      </div>
    );
  }
  return (
    <ul className="pd-voucher-list" aria-label={t("Patient:AvailableVouchers")}>
      {plan.vouchers.map((voucher) => (
        <VoucherRow
          key={voucher.id}
          voucher={voucher}
          saving={plan.savingOf(voucher)}
          targets={plan.targetNamesOf(voucher)}
          active={plan.selected.some((item) => item.id === voucher.id)}
          onToggle={plan.toggle}
        />
      ))}
    </ul>
  );
}

/**
 * One applied voucher under "Voucher áp dụng": its code, what it takes off,
 * the amount, and a × that takes it off the plan again.
 */
function AppliedVoucher({
  voucher,
  saving,
  targets,
  onRemove,
}: {
  voucher: VoucherDto;
  saving: number;
  /** The ticked services a "Theo dịch vụ" voucher takes off; empty for a plan voucher. */
  targets: string[];
  onRemove: (voucher: VoucherDto) => void;
}) {
  const what =
    targets.length > 0
      ? t("Patient:PlanTotals:ServiceVoucherLine", formatVoucherValue(voucher), targets.join(", "))
      : t("Patient:PlanTotals:VoucherLine", formatVoucherValue(voucher));
  return (
    <li className="pd-plan-applied" title={`${voucher.name} — ${what}`}>
      <b className="pd-plan-applied__code">[{voucher.code}]</b>
      <span className="pd-plan-applied__what">{what}</span>
      <b className="pd-plan-applied__saving">-{formatMoneyUnit(saving)}</b>
      <button
        type="button"
        className="pd-plan-applied__remove"
        aria-label={t("Patient:PlanTotals:RemoveVoucher", voucher.code)}
        onClick={() => onRemove(voucher)}
      >
        <CloseOutlined aria-hidden="true" />
      </button>
    </li>
  );
}

export function AdviseVoucherPicker({
  plan,
  disabled,
}: {
  plan: PlanVoucherState;
  /** No row ticked: there is no amount to judge a voucher against yet. */
  disabled?: boolean;
}) {
  const count = plan.selected.length;

  return (
    <div className="pd-plan-voucher">
      <div className="pd-plan-row">
        <span>{t("Patient:AppliedVouchers")}</span>
      <Popover
        trigger={disabled ? [] : "click"}
        placement="topRight"
        content={
          <div className="pd-voucher-popover">
            <div className="pd-voucher-search">
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder={t("Patient:SearchVoucherPlaceholder")}
                aria-label={t("Patient:SearchVoucher")}
                value={plan.query}
                onChange={(event) => plan.setQuery(event.target.value)}
              />
              <small>{t("Patient:SelectedCount", count)}</small>
            </div>
            <VoucherList plan={plan} />
          </div>
        }
      >
        <Button className="pd-plan-voucher__pick" icon={<TagOutlined />} disabled={disabled}>
          {count === 0 ? t("Patient:SelectVoucher") : t("Patient:VoucherCount", count)}
        </Button>
      </Popover>
      </div>
      {count === 0 && (
        <em>
          {disabled
            ? t("Patient:SelectServiceFirst")
            : t("Patient:NoVoucherForPlanAlt")}
        </em>
      )}
      {count > 0 && (
        <ul className="pd-plan-applied-list" aria-label={t("Patient:AppliedVouchers")}>
          {plan.selected.map((voucher) => (
            <AppliedVoucher
              key={voucher.id}
              voucher={voucher}
              saving={plan.savingOf(voucher)}
              targets={plan.targetNamesOf(voucher)}
              onRemove={plan.toggle}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
