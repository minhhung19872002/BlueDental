import { Button, DatePicker } from "antd";
import { CalendarOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { t } from "@/lib/i18n";

/** Ngày / Tuần / Tháng, or nothing at all — the reference starts with nothing. */
export type LaboPeriodMode = "day" | "week" | "month";

export interface LaboPeriod {
  mode: LaboPeriodMode | null;
  anchor: Date;
}

interface Props {
  value: LaboPeriod;
  onChange: (next: LaboPeriod) => void;
}

/** The picker granularity each mode opens at. */
const PICKER_OF: Record<LaboPeriodMode, "date" | "week" | "month"> = {
  day: "date",
  week: "week",
  month: "month",
};

const STEP_LABEL: Record<LaboPeriodMode, { back: string; forward: string }> = {
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
export function formatLaboPeriod(mode: LaboPeriodMode, anchor: Date): string {
  const at = dayjs(anchor);
  if (mode === "day") return at.format("DD/MM/YYYY");
  if (mode === "month") return at.format("MM/YYYY");

  const start = at.startOf("week").add(1, "day");
  return `${start.format("DD/MM")} – ${start.add(6, "day").format("DD/MM/YYYY")}`;
}

/** The inclusive window a mode and its anchor resolve to. */
export function laboPeriodRange(period: LaboPeriod): { from: string; to: string } | null {
  if (!period.mode) return null;

  const at = dayjs(period.anchor);
  const unit = period.mode === "day" ? "day" : period.mode;
  // Weeks start on Monday here, as the rest of the app steps them.
  const start = period.mode === "week" ? at.startOf("week").add(1, "day") : at.startOf(unit);
  const end = period.mode === "week" ? start.add(6, "day") : at.endOf(unit);

  return { from: start.format("YYYY-MM-DD"), to: end.format("YYYY-MM-DD") };
}

/**
 * The date control above Mẫu Labo.
 *
 * Two states, as the reference has them: until a mode is chosen there is one
 * disabled "Chọn thời gian" button and no date filter is sent; choosing one
 * swaps it for a stepper around the period being read.
 */
export function LaboPeriodPicker({ value, onChange }: Props) {
  const step = (direction: -1 | 1) => {
    if (!value.mode) return;
    const unit = value.mode === "day" ? "day" : value.mode;
    onChange({ ...value, anchor: dayjs(value.anchor).add(direction, unit).toDate() });
  };

  return (
    <div className="bd-labo-period">
      <SegmentedTabs
        items={modeOptions()}
        activeKey={value.mode ?? ""}
        onChange={(mode) => onChange({ ...value, mode: mode as LaboPeriodMode })}
      />

      {value.mode === null ? (
        <Button disabled icon={<CalendarOutlined />}>
          {t("Chọn thời gian")}
        </Button>
      ) : (
        <div className="bd-labo-step">
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
            format={() => formatLaboPeriod(value.mode as LaboPeriodMode, value.anchor)}
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
