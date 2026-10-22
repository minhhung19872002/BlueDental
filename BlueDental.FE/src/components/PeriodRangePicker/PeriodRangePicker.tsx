import { useState } from "react";
import { Popover } from "antd";
import { CalendarOutlined, DownOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { formatPeriodRange, type PeriodRangeValue } from "./periodGrain";
import { PeriodRangePanel } from "./PeriodRangePanel";
import "./PeriodRangePicker.css";

interface Props {
  value: PeriodRangeValue;
  onChange: (next: PeriodRangeValue) => void;
  /** The longest period the screen can read, in days. */
  maxDays?: number;
  className?: string;
}

/**
 * A period picked by day, month, quarter, half-year or year, with presets and
 * "So sánh kỳ trước" (BA P2110, Thống kê CSKH). Nothing changes until Áp dụng.
 *
 * Shared rather than feature-local so other report screens can wear it; the
 * Ngày / Tuần / Tháng stepper stays `PeriodPicker`.
 */
export function PeriodRangePicker({ value, onChange, maxDays, className }: Props) {
  const [open, setOpen] = useState(false);
  const label = formatPeriodRange(value.grain, dayjs(value.from), dayjs(value.to));

  const handleApply = (next: PeriodRangeValue) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomLeft"
      arrow={false}
      classNames={{ root: "bd-prp-popover" }}
      destroyOnHidden
      content={
        <PeriodRangePanel initial={value} maxDays={maxDays} onApply={handleApply} onCancel={() => setOpen(false)} />
      }
    >
      <button
        type="button"
        className={["bd-prp-trigger", className].filter(Boolean).join(" ")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${t("PeriodRange:Label")}: ${label}`}
      >
        <CalendarOutlined className="bd-prp-trigger-icon" />
        <span className="bd-prp-trigger-text">
          <span className="bd-prp-trigger-caption">{t(`PeriodRange:By:${value.grain}`)}</span>
          <span className="bd-prp-trigger-range">{label}</span>
        </span>
        <DownOutlined className="bd-prp-trigger-chevron" />
      </button>
    </Popover>
  );
}
