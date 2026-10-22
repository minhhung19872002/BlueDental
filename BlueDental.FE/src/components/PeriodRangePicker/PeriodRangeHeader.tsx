import { Button } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import { t } from "@/lib/i18n";
import type { PeriodGrain } from "./periodGrain";
import { yearBlockStart } from "./PeriodGridUnits";

interface Props {
  grain: PeriodGrain;
  view: Dayjs;
  onPage: (direction: -1 | 1) => void;
}

/** "Tháng 10, 2026" over days, the year over its units, a decade-ish block over years. */
function viewTitle(grain: PeriodGrain, view: Dayjs): string {
  if (grain === "day") return t("PeriodRange:MonthTitle", view.month() + 1, view.year());
  if (grain !== "year") return String(view.year());
  const first = yearBlockStart(view);
  return `${first} – ${first + 11}`;
}

/** ‹ title › over the grid. */
export function PeriodRangeHeader({ grain, view, onPage }: Props) {
  return (
    <div className="bd-prp-head">
      <Button
        type="text"
        size="small"
        icon={<LeftOutlined />}
        aria-label={t("PeriodRange:Prev")}
        onClick={() => onPage(-1)}
      />
      <strong className="bd-prp-title">{viewTitle(grain, view)}</strong>
      <Button
        type="text"
        size="small"
        icon={<RightOutlined />}
        aria-label={t("PeriodRange:Next")}
        onClick={() => onPage(1)}
      />
    </div>
  );
}
