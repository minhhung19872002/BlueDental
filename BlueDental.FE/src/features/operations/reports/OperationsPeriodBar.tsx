import { CalendarOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import { periodOptions, type PeriodRange, type ReportPeriod } from "./usePeriodRange";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

interface Props {
  range: PeriodRange;
  /** Khách hàng phát sinh and Hóa đơn stop at Tháng; the rest offer Năm too. */
  periods?: ReportPeriod[];
}

/**
 * Ngày / Tuần / Tháng / Năm and the stepper beside it.
 *
 * The reference puts this at the right-hand end of whichever tab row is
 * directly above the report, so it sits in that row here too rather than in a
 * strip of its own.
 */
export function OperationsPeriodBar({ range, periods }: Props) {
  const options = periodOptions().filter((o) => !periods || periods.includes(o.key));

  return (
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

        <span className="bd-ops-period-label">
          <CalendarOutlined aria-hidden="true" />
          {range.label}
        </span>

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
}
