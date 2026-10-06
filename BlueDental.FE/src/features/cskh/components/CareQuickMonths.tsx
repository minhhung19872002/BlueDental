import { Button } from "antd";
import type { Dayjs } from "dayjs";
import { t } from "@/lib/i18n";

const QUICK_MONTHS = [3, 6, 9] as const;

interface Props {
  onShift: (shift: (current: Dayjs) => Dayjs) => void;
}

/** +3 / +6 / +9 tháng — pushes the care date forward from what it is now. */
export function CareQuickMonths({ onShift }: Props) {
  return (
    <div className="cskh-quick-months">
      {QUICK_MONTHS.map((months) => (
        <Button key={months} size="small" onClick={() => onShift((current) => current.add(months, "month"))}>
          {t("CSKH:AddMonths", months)}
        </Button>
      ))}
    </div>
  );
}
