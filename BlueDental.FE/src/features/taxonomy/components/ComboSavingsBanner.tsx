import { TagOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";

interface Props {
  savings: number;
  savingsPercent: number;
}

const PERCENT_FORMAT = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

/** Stands in for the amount so the translated sentence can be cut around it. */
const AMOUNT_SLOT = "\u0000";

/**
 * "Khách tiết kiệm X đ (x%) so với mua lẻ" under Cấu hình giá & thuế, the
 * amount in bold as the BA mock draws it — nothing when the combo saves nothing.
 */
export function ComboSavingsBanner({ savings, savingsPercent }: Props) {
  if (savings <= 0) return null;
  const [before, after = ""] = t(
    "Taxonomy:Combo:Savings",
    AMOUNT_SLOT,
    PERCENT_FORMAT.format(savingsPercent),
  ).split(AMOUNT_SLOT);
  return (
    <p className="bd-combo-savings" role="status">
      <TagOutlined aria-hidden />
      <span>
        {before}
        <strong>{formatVND(savings)}</strong>
        {after}
      </span>
    </p>
  );
}
