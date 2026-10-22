import dayjs, { type Dayjs } from "dayjs";
import { t } from "@/lib/i18n";
import { unitEnd, unitStart, type PeriodGrain } from "./periodGrain";
import { rangeCellClass } from "./rangeCell";

type UnitGrain = Exclude<PeriodGrain, "day">;

interface Props {
  grain: UnitGrain;
  /** Any day of the year shown (or of the twelve-year block, for Năm). */
  view: Dayjs;
  from: Dayjs;
  to: Dayjs;
  onPick: (date: Dayjs) => void;
  onHover: (date: Dayjs | null) => void;
}

interface UnitCell {
  start: Dayjs;
  label: string;
}

const BLOCK_YEARS = 12;

/** The first year of the twelve-year block the Năm grid shows. */
export function yearBlockStart(view: Dayjs): number {
  return Math.floor(view.year() / BLOCK_YEARS) * BLOCK_YEARS;
}

function unitCells(grain: UnitGrain, view: Dayjs): UnitCell[] {
  const year = view.startOf("year");
  if (grain === "month") {
    return Array.from({ length: 12 }, (_, index) => ({
      start: year.month(index),
      label: t("PeriodRange:MonthCell", index + 1),
    }));
  }
  if (grain === "quarter") {
    return Array.from({ length: 4 }, (_, index) => ({
      start: year.month(index * 3),
      label: t("PeriodRange:QuarterCell", index + 1),
    }));
  }
  if (grain === "half") {
    return Array.from({ length: 2 }, (_, index) => ({
      start: year.month(index * 6),
      label: t("PeriodRange:HalfCell", index + 1),
    }));
  }
  const first = yearBlockStart(view);
  return Array.from({ length: BLOCK_YEARS }, (_, index) => ({
    start: year.year(first + index),
    label: String(first + index),
  }));
}

/** Tháng / Quý / Nửa năm / Năm: one cell per unit, picked like days. */
export function PeriodGridUnits({ grain, view, from, to, onPick, onHover }: Props) {
  const today = dayjs();

  return (
    <div className={`bd-prp-grid bd-prp-grid--${grain}`} role="grid" onMouseLeave={() => onHover(null)}>
      {unitCells(grain, view).map((cell) => (
        <button
          key={cell.start.valueOf()}
          type="button"
          role="gridcell"
          className={rangeCellClass({ start: cell.start, end: unitEnd(grain, cell.start) }, from, to, {
            current: unitStart(grain, today).isSame(cell.start, "day"),
          })}
          onClick={() => onPick(cell.start)}
          onMouseEnter={() => onHover(cell.start)}
        >
          {cell.label}
        </button>
      ))}
    </div>
  );
}
