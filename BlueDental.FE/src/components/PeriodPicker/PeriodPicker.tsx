import { Button, DatePicker } from "antd";
import { CalendarOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { t } from "@/lib/i18n";
import "./PeriodPicker.css";

/** Ngày / Tuần / Tháng, or nothing at all — the reference starts with nothing. */
export type PeriodMode = "day" | "week" | "month";

export interface Period {
  mode: PeriodMode | null;
  anchor: Date;
}

interface Props {
  value: Period;
  onChange: (next: Period) => void;
  /**
   * Lets a second click on the active mode clear it, as the patient list does —
   * the tabs there are how the date filter is turned off again. Screens whose
   * reference has no way back to "no period" leave this off.
   */
  clearableMode?: boolean;
  className?: string;
}

/** The picker granularity each mode opens at. */
const PICKER_OF: Record<PeriodMode, "date" | "week" | "month"> = {
  day: "date",
  week: "week",
  month: "month",
};

const STEP_LABEL: Record<PeriodMode, { back: string; forward: string }> = {
  day: { back: "Ngày trước", forward: "Ngày kế tiếp" },
  week: { back: "Tuần trước", forward: "Tuần kế tiếp" },
  month: { back: "Tháng trước", forward: "Tháng kế tiếp" },
};

function modeOptions() {
  return [
    { key: "day" as const, label: t("Ngày") },
    { key: "week" as const, label: t("Tuần") },
    { key: "month" as const, label: t("Tháng") },
  ];
}

/** How the reference labels the window being read. */
export function formatPeriod(mode: PeriodMode, anchor: Date): string {
  const at = dayjs(anchor);
  if (mode === "day") return at.format("DD/MM/YYYY");
  if (mode === "month") return at.format("MM/YYYY");

  const start = at.startOf("week").add(1, "day");
  return `${start.format("DD/MM")} – ${start.add(6, "day").format("DD/MM/YYYY")}`;
}

/** The inclusive window a mode and its anchor resolve to. */
export function periodRange(period: Period): { from: string; to: string } | null {
  if (!period.mode) return null;

  const at = dayjs(period.anchor);
  const unit = period.mode === "day" ? "day" : period.mode;
  // Weeks start on Monday here, as the rest of the app steps them.
  const start = period.mode === "week" ? at.startOf("week").add(1, "day") : at.startOf(unit);
  const end = period.mode === "week" ? start.add(6, "day") : at.endOf(unit);

  return { from: start.format("YYYY-MM-DD"), to: end.format("YYYY-MM-DD") };
}

/**
 * Ngày / Tuần / Tháng and the window they read.
 *
 * Two states, as the reference has them: until a mode is chosen there is one
 * disabled "Chọn thời gian" button and no date filter is sent; choosing one
 * swaps it for a stepper around the period being read.
 *
 * Shared rather than feature-local — Mẫu Labo and the patient list both wear
 * it, and a feature may not reach into another feature's folder.
 */
export function PeriodPicker({ value, onChange, clearableMode, className }: Props) {
  const step = (direction: -1 | 1) => {
    if (!value.mode) return;
    const unit = value.mode === "day" ? "day" : value.mode;
    onChange({ ...value, anchor: dayjs(value.anchor).add(direction, unit).toDate() });
  };

  const handleModeChange = (mode: string) => {
    const next = clearableMode && mode === value.mode ? null : (mode as PeriodMode);
    // Re-anchoring on today is what the reference does: switching mode always
    // lands on the period containing now, never on a stale week from last month.
    onChange({ mode: next, anchor: next === value.mode ? value.anchor : new Date() });
  };

  return (
    <div className={["bd-period", className].filter(Boolean).join(" ")}>
      <SegmentedTabs
        items={modeOptions()}
        activeKey={value.mode ?? ""}
        onChange={handleModeChange}
      />

      {value.mode === null ? (
        <Button disabled icon={<CalendarOutlined />} className="bd-period-empty">
          {t("Chọn thời gian")}
        </Button>
      ) : (
        <div className="bd-period-step">
          <Button
            type="text"
            aria-label={t(STEP_LABEL[value.mode].back)}
            icon={<LeftOutlined />}
            onClick={() => step(-1)}
          />

          {/* The label is the picker's own input, so clicking it opens the
              calendar rather than being dead text between two arrows. */}
          <DatePicker
            picker={PICKER_OF[value.mode]}
            value={dayjs(value.anchor)}
            allowClear={false}
            variant="borderless"
            suffixIcon={null}
            prefix={<CalendarOutlined aria-hidden="true" />}
            format={() => formatPeriod(value.mode as PeriodMode, value.anchor)}
            aria-label={t("Chọn thời gian")}
            onChange={(next: Dayjs | null) => {
              if (next) onChange({ ...value, anchor: next.toDate() });
            }}
          />

          <Button
            type="text"
            aria-label={t(STEP_LABEL[value.mode].forward)}
            icon={<RightOutlined />}
            onClick={() => step(1)}
          />
        </div>
      )}
    </div>
  );
}
