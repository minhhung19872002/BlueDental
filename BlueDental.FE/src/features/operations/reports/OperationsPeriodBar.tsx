import { createPortal } from "react-dom";
import { DatePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { CalendarOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import { usePeriodSlot } from "./periodBarSlot";
import { periodOptions, type PeriodRange, type ReportPeriod } from "./usePeriodRange";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

interface Props {
  range: PeriodRange;
  /** Khách hàng phát sinh and Hóa đơn stop at Tháng; the rest offer Năm too. */
  periods?: ReportPeriod[];
}

/** The picker granularity each period opens at, as the reference opens it. */
const PICKER_OF: Record<ReportPeriod, "date" | "week" | "month" | "year"> = {
  day: "date",
  week: "week",
  month: "month",
  year: "year",
};

/**
 * Ngày / Tuần / Tháng / Năm, a stepper, and a picker.
 *
 * The reference puts this at the right-hand end of whichever tab row is
 * directly above the report, so it sits in that row here too rather than in a
 * strip of its own. Clicking the date opens a picker at the granularity of the
 * period being read — a year grid for Năm, a month grid for Tháng, and so on.
 */
export function OperationsPeriodBar({ range, periods }: Props) {
  const options = periodOptions().filter((o) => !periods || periods.includes(o.key));
  const slot = usePeriodSlot();

  const bar = (
    <div className="bd-ops-period">
      <div className="bd-ops-period-switch" role="tablist" aria-label={t("Kỳ báo cáo")}>
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={option.key === range.period}
            className={cn(
              "bd-ops-period-option",
              option.key === range.period && "bd-ops-period-option--active",
            )}
            onClick={() => range.setPeriod(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="bd-ops-period-step">
        <button
          type="button"
          className="bd-ops-period-arrow"
          aria-label={t("Kỳ trước")}
          onClick={() => range.step(-1)}
        >
          <LeftOutlined aria-hidden="true" />
        </button>

        {/* The label is the picker's own input, so clicking it opens the
            calendar rather than being dead text between two arrows. */}
        <DatePicker
          className="bd-ops-period-picker"
          picker={PICKER_OF[range.period]}
          value={dayjs(range.anchor)}
          allowClear={false}
          variant="borderless"
          suffixIcon={null}
          prefix={<CalendarOutlined aria-hidden="true" />}
          format={() => range.label}
          aria-label={t("Chọn kỳ")}
          onChange={(value: Dayjs | null) => {
            if (value) range.setAnchor(value.toDate());
          }}
        />

        <button
          type="button"
          className="bd-ops-period-arrow"
          aria-label={t("Kỳ sau")}
          onClick={() => range.step(1)}
        >
          <RightOutlined aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  // Into the tab row where there is one; in place while the page is still
  // mounting, so the control is never missing.
  return slot ? createPortal(bar, slot) : bar;
}
