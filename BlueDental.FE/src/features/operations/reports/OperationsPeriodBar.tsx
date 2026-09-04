import { createPortal } from "react-dom";
import { Segmented } from "antd";
import dayjs from "dayjs";
import { DateNavigator } from "@/components/DateNavigator";
import { periodOptions, type PeriodRange, type ReportPeriod } from "@/hooks/usePeriodRange";
import { usePeriodSlot } from "./periodBarSlot";

interface Props {
  range: PeriodRange;
  periods?: ReportPeriod[];
}

export function OperationsPeriodBar({ range, periods }: Props) {
  const slot = usePeriodSlot();
  const options = periodOptions().filter((o) => !periods || periods.includes(o.key));
  const segmentedOptions = options.map((o) => ({ value: o.key, label: o.label }));
  const dateNavMode = range.period === "year" ? "month" : range.period;

  const bar = (
    <div className="bd-ops-period">
      <Segmented
        value={range.period}
        options={segmentedOptions}
        onChange={(val) => range.setPeriod(val as ReportPeriod)}
        style={{ flexShrink: 0 }}
      />
      <DateNavigator
        value={dayjs(range.anchor)}
        mode={dateNavMode}
        onChange={(d) => range.setAnchor(d.toDate())}
      />
    </div>
  );

  return slot ? createPortal(bar, slot) : bar;
}
