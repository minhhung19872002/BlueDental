import { useMemo, useState, type ReactNode } from "react";
import { Input, Select } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import type { SlipOption } from "./paymentDialogModel";

interface Props {
  options: SlipOption[];
  value: string | null;
  loading: boolean;
  /** A reopened receipt stays on its own slip. */
  locked: boolean;
  onChange: (slipId: string) => void;
}

const STATE_KEYS = {
  unpaid: "Patient:Payment:SlipUnpaid",
  partial: "Patient:Payment:SlipPartlyPaid",
} as const;

function SlipRow({ option }: { option: SlipOption }) {
  return (
    <div className="pd-newpay-sliprow">
      <div>
        <div className="pd-newpay-sliprow-code">
          <b>{option.slip.code}</b>
          <span className={`pd-newpay-slipbadge pd-newpay-slipbadge--${option.state}`}>
            {t(STATE_KEYS[option.state])}
          </span>
        </div>
        <small>{slipMeta(option)}</small>
      </div>
      <b className="pd-newpay-sliprow-debt">{formatMoneyUnit(option.debt)}</b>
    </div>
  );
}

/** "Ngày tạo dd/MM/yyyy · N dịch vụ". */
function slipMeta(option: SlipOption): string {
  return t("Patient:Payment:SlipMeta", formatDate(option.slip.creationTime), option.owingCount);
}

/**
 * "Số phiếu cần thanh toán": the patient's slips that still owe money, searched
 * by code or by the day they were created.
 */
export function PaymentSlipPicker({ options, value, loading, locked, onChange }: Props) {
  const [keyword, setKeyword] = useState("");
  const visible = useMemo(() => {
    const needle = keyword.trim().toLocaleLowerCase("vi");
    if (!needle) return options;
    return options.filter(
      ({ slip }) =>
        slip.code.toLocaleLowerCase("vi").includes(needle) || formatDate(slip.creationTime).includes(needle),
    );
  }, [keyword, options]);

  const popup = (menu: ReactNode) => (
    <div className="pd-newpay-slippop">
      <Input
        allowClear
        value={keyword}
        prefix={<SearchOutlined />}
        placeholder={t("Patient:Payment:SlipSearch")}
        // The Select would take the keys as its own navigation.
        onKeyDown={(event) => event.stopPropagation()}
        onChange={(event) => setKeyword(event.target.value)}
      />
      <div className="pd-newpay-sliphead">
        <span>{t("Patient:Payment:SlipNumber")}</span>
        <span>{t("Patient:Payment:Outstanding")}</span>
      </div>
      {menu}
    </div>
  );

  return (
    <Select
      className="pd-newpay-slipselect"
      aria-label={t("Patient:Payment:SlipHeader")}
      prefix={<SearchOutlined />}
      value={value ?? undefined}
      // The chosen slip reads as in the owner's mock: code, then its day and count.
      labelRender={(item) => {
        const chosen = options.find((option) => option.slip.id === item.value);
        if (!chosen) return item.label;
        return (
          <span className="pd-newpay-slipvalue">
            <b>{chosen.slip.code}</b>
            <small>{slipMeta(chosen)}</small>
          </span>
        );
      }}
      loading={loading}
      disabled={locked}
      placeholder={t("Patient:Payment:SlipPlaceholder")}
      notFoundContent={t("Patient:Payment:NoSlips")}
      options={visible.map((option) => ({ value: option.slip.id, label: option.slip.code, option }))}
      optionRender={(item) => <SlipRow option={item.data.option} />}
      popupRender={popup}
      onOpenChange={(open) => (open ? undefined : setKeyword(""))}
      onChange={onChange}
    />
  );
}
